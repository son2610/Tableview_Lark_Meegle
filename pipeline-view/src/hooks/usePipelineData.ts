import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { AddFieldConfig, BaseAdapter } from '../sdk/adapter';
import type {
  ActionResult,
  CellValue,
  FieldMeta,
  FieldsPatch,
  Lang,
  OptionColor,
  PipelineActions,
  PipelineConfig,
  PipelineContextValue,
  RecordData,
  SelectOption,
  TableInfo,
  ThemeMode,
  TransitionKind,
  ValidationResult,
  ViewInfo,
} from '../types';
import { createDefaultConfig, getDoneStatusId, isConfigured, normalizeConfig } from '../core/config';
import { buildGraph } from '../core/graph';
import { layoutGraph } from '../core/layout';
import { getSelectId, isComputedField, makeSelectValue } from '../core/cell';
import { pathKey } from '../core/path';
import { getStatusCategory } from '../core/state';
import {
  buildTransitionPatch,
  currentNodeId,
  missingPathOptionNames,
  nextTargets,
  rollbackTargets,
  validateNode,
} from '../core/transitions';
import type { TransitionContext } from '../core/transitions';
import { createT, toLang } from '../i18n';
import type { TFunc } from '../i18n';
import { applyTheme } from '../theme';

export type LoadPhase = 'loading' | 'error' | 'ready';

export interface PipelineData {
  phase: LoadPhase;
  error?: string;
  loadedCount: number;
  /** Non-null when phase === 'ready'. */
  ctx: PipelineContextValue | null;
  /** isConfigured(ctx.config, ctx.fields) */
  configured: boolean;
  hasSavedConfig: boolean;
  views: ViewInfo[];
  actions: PipelineActions;
  saveConfig(next: PipelineConfig): Promise<ActionResult>;
  /** Returns the new field id, or null on failure. */
  createField(cfg: AddFieldConfig): Promise<string | null>;
  /**
   * Returns the new option id, or null on failure. `fieldId` defaults to the saved stage field;
   * the settings designer passes its draft stage field (which may not be saved yet).
   */
  addStageOption(name: string, fieldId?: string): Promise<string | null>;
  /**
   * Append options to any select field (one host call each, then one fields refresh).
   * Returns the new option ids in input order, null where adding failed.
   */
  addSelectOptions(fieldId: string, options: { name: string; color?: number }[]): Promise<(string | null)[]>;
  reload(): void;
  /** UI language, known before `ctx` (for the loading / error screens). */
  lang: Lang;
}

/** Collect record events for this long before fetching, so bursts become one update. */
const RECORD_BATCH_MS = 120;
/** Above this many changed records a full reload is cheaper than one getRecord per id. */
const INCREMENTAL_LIMIT = 50;
const FIELDS_DEBOUNCE_MS = 200;
const BUSY_RETRY_MS = 250;
const EMPTY_OPTIONS: SelectOption[] = [];

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}

function initialLang(): Lang {
  try {
    return typeof navigator !== 'undefined' && navigator.language ? toLang(navigator.language) : 'vi';
  } catch {
    return 'vi';
  }
}

/**
 * Config in effect: stored config normalized against the current fields, or the auto-detected
 * default when nothing was saved. A source view that no longer exists falls back to all records.
 */
function resolveConfig(raw: unknown, fields: FieldMeta[], views: ViewInfo[]): PipelineConfig {
  const config = raw == null ? createDefaultConfig(fields) : normalizeConfig(raw, fields);
  if (config.sourceViewId && views.length > 0 && !views.some((v) => v.id === config.sourceViewId)) {
    return { ...config, sourceViewId: undefined };
  }
  return config;
}

/**
 * Apply fetched records (null = no longer exists) and deletions to `prev`, keeping its order.
 * Ids in `appendOrder` that are not in `prev` are appended in that order when fetched.
 */
export function mergeRecordChanges(
  prev: RecordData[],
  fetched: Map<string, RecordData | null>,
  deleted: Set<string>,
  appendOrder: string[],
): RecordData[] {
  const known = new Set<string>();
  const next: RecordData[] = [];
  for (const record of prev) {
    known.add(record.id);
    if (deleted.has(record.id)) continue;
    if (fetched.has(record.id)) {
      const fresh = fetched.get(record.id);
      if (fresh) next.push(fresh);
      continue;
    }
    next.push(record);
  }
  for (const id of appendOrder) {
    if (known.has(id) || deleted.has(id)) continue;
    const fresh = fetched.get(id);
    if (fresh) {
      next.push(fresh);
      known.add(id);
    }
  }
  return next;
}

/**
 * Undo an optimistic write: put back the values `keys` had in `before`, but only where the
 * cell still holds the written value (a newer local write or a fetched remote value wins).
 */
export function restoreKeys(
  current: Record<string, CellValue>,
  before: Record<string, CellValue>,
  keys: string[],
  written: Record<string, CellValue>,
): Record<string, CellValue> {
  const out = { ...current };
  for (const key of keys) {
    if (out[key] !== written[key]) continue;
    if (Object.prototype.hasOwnProperty.call(before, key)) out[key] = before[key];
    else delete out[key];
  }
  return out;
}

/**
 * A per-key queue: `queue(key, task)` starts `task` once every task queued earlier under the same
 * key has settled (failed or not) and resolves like it. Used so that "read the field, see which
 * options are missing, add them, read it again" never interleaves for one field: two moves (or a
 * move and the settings button) would otherwise both see an option missing and both create it.
 */
export function createKeyedQueue(): <T>(key: string, task: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<void>>();
  return <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const run = (tails.get(key) ?? Promise.resolve()).then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}

/** This view's writes to one record: `seq` counts optimistic writes, `inflight` holds unsettled host calls. */
interface WriteState {
  seq: number;
  inflight: Set<Promise<unknown>>;
}

/**
 * Returns `isDirty(id)`: true when a record was written by this view while a read that starts
 * now was running (or had a write still in flight when it started). Such a read may miss the
 * write, so its result must not replace the local optimistic copy.
 */
function markWrites(writes: Map<string, WriteState>): (recordId: string) => boolean {
  const marks = new Map<string, { seq: number; busy: boolean }>();
  for (const [id, w] of writes) marks.set(id, { seq: w.seq, busy: w.inflight.size > 0 });
  return (recordId) => {
    const w = writes.get(recordId);
    if (!w) return false;
    const mark = marks.get(recordId);
    return !mark || mark.busy || mark.seq !== w.seq;
  };
}

/** useState whose latest value is also readable synchronously from async callbacks. */
function useSyncedState<T>(initial: T | (() => T)): [T, (value: T) => void, MutableRefObject<T>] {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(value);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref];
}

interface Prepared {
  c: PipelineContextValue;
  rec: RecordData;
  tc: TransitionContext;
  t: TFunc;
}

export function usePipelineData(adapter: BaseAdapter): PipelineData {
  const [phase, setPhase, phaseRef] = useSyncedState<LoadPhase>('loading');
  const [error, setError] = useState<string | undefined>();
  const [loadedCount, setLoadedCount] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [meta, setMeta] = useState<{ table: TableInfo; viewId: string | null } | null>(null);
  const [lang, setLang, langRef] = useSyncedState<Lang>(initialLang);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [editable, setEditable, editableRef] = useSyncedState(false);
  const [fields, setFields, fieldsRef] = useSyncedState<FieldMeta[]>([]);
  const [views, setViews, viewsRef] = useSyncedState<ViewInfo[]>([]);
  const [optionColors, setOptionColors] = useState<OptionColor[]>([]);
  const [config, setConfig, configRef] = useSyncedState<PipelineConfig | null>(null);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  /** Serializes option creation per field (see createKeyedQueue). */
  const [queueOptions] = useState(createKeyedQueue);
  const [records, setRecords] = useState<RecordData[]>([]);

  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const recordsSeqRef = useRef(0);
  /** Last stored config exactly as loaded/saved; re-normalized whenever fields change. */
  const rawConfigRef = useRef<unknown>(null);
  /** Source of truth for records; every mutation goes through commitRecords. */
  const recordsRef = useRef<RecordData[]>([]);
  const ctxRef = useRef<PipelineContextValue | null>(null);
  const writesRef = useRef(new Map<string, WriteState>());
  /** Full record loads in progress; incremental flushes wait for them (their events queue up). */
  const reloadingRef = useRef(0);
  /** Queue records to be fetched again (set by the host-events effect). */
  const refetchRef = useRef<(recordIds: string[]) => void>(() => undefined);

  const commitRecords = useCallback((update: (prev: RecordData[]) => RecordData[]) => {
    recordsRef.current = update(recordsRef.current);
    setRecords(recordsRef.current);
  }, []);

  const loadRecords = useCallback(
    async (viewId: string | undefined, onProgress?: (loaded: number) => void) => {
      const seq = ++recordsSeqRef.current;
      const isDirty = markWrites(writesRef.current);
      reloadingRef.current++;
      try {
        let loaded: RecordData[];
        try {
          loaded = await adapter.getAllRecords({ viewId, onProgress });
        } catch (e) {
          if (!viewId) throw e;
          console.warn('[pipeline-view] could not load the source view, falling back to all records', e);
          loaded = await adapter.getAllRecords({ onProgress });
        }
        if (!mountedRef.current || seq !== recordsSeqRef.current) return;
        // Records written while loading keep their local copy and are read again afterwards.
        const local = new Map(recordsRef.current.map((r) => [r.id, r] as const));
        const again: string[] = [];
        commitRecords(() =>
          loaded.map((r) => {
            const mine = isDirty(r.id) ? local.get(r.id) : undefined;
            if (!mine) return r;
            again.push(r.id);
            return mine;
          }),
        );
        if (again.length > 0) refetchRef.current(again);
      } finally {
        reloadingRef.current--;
      }
    },
    [adapter, commitRecords],
  );

  const reloadRecords = useCallback(async () => {
    try {
      await loadRecords(configRef.current?.sourceViewId);
    } catch (e) {
      console.warn('[pipeline-view] reloading records failed', e);
    }
  }, [loadRecords, configRef]);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const stale = () => !mountedRef.current || seq !== loadSeqRef.current;
    setPhase('loading');
    setError(undefined);
    setLoadedCount(0);
    try {
      const info = await adapter.init();
      if (stale()) return;
      setMeta(info);
      setInitialized(true);
      const [lng, thm, canEdit, flds, vws, colors, raw] = await Promise.all([
        adapter.getLanguage().catch((): Lang => langRef.current),
        adapter.getTheme().catch((): ThemeMode => 'light'),
        adapter.isEditable().catch(() => false),
        adapter.getFields(),
        adapter.getViews().catch((): ViewInfo[] => []),
        adapter.getOptionColors().catch((): OptionColor[] => []),
        adapter.loadConfig(),
      ]);
      if (stale()) return;
      applyTheme(thm);
      rawConfigRef.current = raw;
      const cfg = resolveConfig(raw, flds, vws);
      setLang(lng);
      setTheme(thm);
      setEditable(canEdit);
      setFields(flds);
      setViews(vws);
      setOptionColors(colors);
      setConfig(cfg);
      setHasSavedConfig(raw != null);
      await loadRecords(cfg.sourceViewId, (n) => {
        if (!stale()) setLoadedCount(n);
      });
      if (stale()) return;
      setPhase('ready');
    } catch (e) {
      if (stale()) return;
      console.error('[pipeline-view] load failed', e);
      setError(createT(langRef.current)('common.error.loadFailed', { message: errorMessage(e) }));
      setPhase('error');
    }
  }, [adapter, loadRecords, setPhase, langRef, setLang, setEditable, setFields, setViews, setConfig]);

  /** Re-read fields and views; resolves with what was applied (null once unmounted). */
  const refreshFields = useCallback(async (): Promise<{ fields: FieldMeta[]; config: PipelineConfig } | null> => {
    const [flds, vws] = await Promise.all([
      adapter.getFields(),
      adapter.getViews().catch(() => viewsRef.current),
    ]);
    if (!mountedRef.current) return null;
    const cfg = resolveConfig(rawConfigRef.current, flds, vws);
    setFields(flds);
    setViews(vws);
    setConfig(cfg);
    return { fields: flds, config: cfg };
  }, [adapter, setFields, setViews, setConfig, viewsRef]);

  /** Append options one by one (no refresh). New ids in input order, null where it failed. */
  const appendOptions = useCallback(
    async (fieldId: string, options: { name: string; color?: number }[]): Promise<(string | null)[]> => {
      const ids: (string | null)[] = [];
      // Sequential: concurrent addOption calls on one field may race in the host.
      for (const o of options) {
        const name = o.name.trim();
        try {
          ids.push(name ? await adapter.addSelectOption(fieldId, name, o.color) : null);
        } catch (e) {
          console.warn('[pipeline-view] addSelectOption failed', name, e);
          ids.push(null);
        }
      }
      return ids;
    },
    [adapter],
  );

  const refreshConfig = useCallback(async () => {
    const raw = await adapter.loadConfig();
    if (!mountedRef.current) return;
    const previousView = configRef.current?.sourceViewId;
    rawConfigRef.current = raw;
    const cfg = resolveConfig(raw, fieldsRef.current, viewsRef.current);
    setConfig(cfg);
    setHasSavedConfig(raw != null);
    if (cfg.sourceViewId !== previousView) void reloadRecords();
  }, [adapter, configRef, fieldsRef, viewsRef, setConfig, reloadRecords]);

  useEffect(() => {
    mountedRef.current = true;
    void loadAll();
    return () => {
      mountedRef.current = false;
      loadSeqRef.current++;
      recordsSeqRef.current++;
    };
  }, [loadAll]);

  // Host events. Subscribed once the adapter is initialised; handlers read state through refs.
  useEffect(() => {
    if (!initialized) return;
    let disposed = false;
    let recordTimer: ReturnType<typeof setTimeout> | undefined;
    let fieldsTimer: ReturnType<typeof setTimeout> | undefined;
    let flushing = false;
    let changed = new Set<string>();
    let deleted = new Set<string>();
    let added: string[] = [];

    const warn = (what: string) => (e: unknown) => console.warn(`[pipeline-view] ${what} failed`, e);

    const scheduleFlush = (delay: number) => {
      if (recordTimer === undefined) recordTimer = setTimeout(() => void flush(), delay);
    };

    const flush = async () => {
      recordTimer = undefined;
      if (disposed) return;
      if (phaseRef.current === 'error') {
        // A full reload (Retry) will fetch everything anyway.
        changed = new Set();
        deleted = new Set();
        added = [];
        return;
      }
      if (flushing || reloadingRef.current > 0 || phaseRef.current !== 'ready') {
        scheduleFlush(BUSY_RETRY_MS);
        return;
      }
      const ids = Array.from(changed);
      const gone = deleted;
      const order = added;
      changed = new Set();
      deleted = new Set();
      added = [];
      if (ids.length === 0 && gone.size === 0) return;

      flushing = true;
      try {
        // A view's filter cannot be evaluated locally: an added or changed record may enter or
        // leave a filtered view, so the view is reloaded.
        const viewFiltered = Boolean(configRef.current?.sourceViewId);
        if (ids.length > INCREMENTAL_LIMIT || (viewFiltered && ids.length > 0)) {
          await reloadRecords();
          return;
        }
        const isDirty = markWrites(writesRef.current);
        const fetched = new Map<string, RecordData | null>();
        await Promise.all(
          ids.map(async (id) => {
            try {
              fetched.set(id, await adapter.getRecord(id));
            } catch (e) {
              warn(`getRecord(${id})`)(e);
            }
          }),
        );
        if (disposed) return;
        // A snapshot read while this view was writing the record may miss that write: keep the
        // local copy and read it again once the write has settled.
        const again = ids.filter((id) => fetched.has(id) && isDirty(id));
        for (const id of again) fetched.delete(id);
        // Without a source view, a modified record we do not know yet (e.g. created while
        // loading) belongs to the table, so it is appended too.
        const appendOrder = viewFiltered ? order : order.concat(ids.filter((id) => !order.includes(id)));
        commitRecords((prev) => mergeRecordChanges(prev, fetched, gone, appendOrder));
        if (again.length > 0) refetch(again, BUSY_RETRY_MS);
      } finally {
        flushing = false;
      }
    };

    const refetch = (recordIds: string[], delay: number) => {
      for (const id of recordIds) {
        deleted.delete(id);
        changed.add(id);
      }
      scheduleFlush(delay);
    };
    refetchRef.current = (recordIds) => refetch(recordIds, RECORD_BATCH_MS);

    const offRecords = adapter.onRecordsChange((e) => {
      for (const id of e.recordIds) {
        if (e.type === 'delete') {
          deleted.add(id);
          changed.delete(id);
        } else {
          deleted.delete(id);
          changed.add(id);
          if (e.type === 'add' && !added.includes(id)) added.push(id);
        }
      }
      scheduleFlush(RECORD_BATCH_MS);
    });

    const offFields = adapter.onFieldsChange(() => {
      if (fieldsTimer !== undefined) clearTimeout(fieldsTimer);
      fieldsTimer = setTimeout(() => {
        fieldsTimer = undefined;
        if (!disposed) refreshFields().catch(warn('refreshing fields'));
      }, FIELDS_DEBOUNCE_MS);
    });

    const offConfig = adapter.onConfigChange(() => {
      if (!disposed) refreshConfig().catch(warn('reloading config'));
    });

    const offTheme = adapter.onThemeChange((mode) => {
      applyTheme(mode);
      setTheme(mode);
    });

    return () => {
      disposed = true;
      refetchRef.current = () => undefined;
      if (recordTimer !== undefined) clearTimeout(recordTimer);
      if (fieldsTimer !== undefined) clearTimeout(fieldsTimer);
      for (const off of [offRecords, offFields, offConfig, offTheme]) {
        try {
          off();
        } catch (e) {
          warn('unsubscribe')(e);
        }
      }
    };
  }, [initialized, adapter, phaseRef, configRef, commitRecords, reloadRecords, refreshFields, refreshConfig]);

  /* ---------------------------------------------------------------- */
  /* Derived context                                                    */
  /* ---------------------------------------------------------------- */

  const fieldById = useMemo(() => new Map(fields.map((f) => [f.id, f] as const)), [fields]);
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r] as const)), [records]);
  const stageField = config?.stageFieldId ? fieldById.get(config.stageFieldId) : undefined;
  const statusField = config?.statusFieldId ? fieldById.get(config.statusFieldId) : undefined;
  const stageOptions = stageField?.options ?? EMPTY_OPTIONS;
  const edges = config?.edges ?? null;
  // Every fields refresh yields new option objects; key on content so graph and layout
  // are only recomputed when the options or edges actually change.
  const graphKey = JSON.stringify([stageOptions.map((o) => [o.id, o.name, o.color]), edges]);
  const graph = useMemo(() => buildGraph(stageOptions, edges), [graphKey]);
  const layout = useMemo(() => layoutGraph(graph), [graph]);

  const ctx = useMemo<PipelineContextValue | null>(() => {
    if (phase !== 'ready' || !meta || !config) return null;
    return {
      table: meta.table,
      viewId: meta.viewId,
      lang,
      theme,
      editable,
      fields,
      fieldById,
      config,
      stageField,
      statusField,
      graph,
      layout,
      optionColors,
      records,
      recordById,
    };
  }, [phase, meta, lang, theme, editable, fields, fieldById, config, stageField, statusField, graph, layout, optionColors, records, recordById]);
  ctxRef.current = ctx;

  /* ---------------------------------------------------------------- */
  /* Record actions                                                     */
  /* ---------------------------------------------------------------- */

  const actions = useMemo<PipelineActions>(() => {
    const fail = (message: string, extra?: Partial<ActionResult>): ActionResult => ({ ok: false, error: message, ...extra });

    const prepare = (recordId: string, needsStage: boolean): Prepared | ActionResult => {
      const t = createT(langRef.current);
      const c = ctxRef.current;
      if (!c) return fail(t('common.error.notReady'));
      if (!c.editable) return fail(t('common.error.readonly'));
      const rec = recordsRef.current.find((r) => r.id === recordId);
      if (!rec) return fail(t('common.error.recordNotFound'));
      if (needsStage && !c.stageField) return fail(t('common.error.notConfigured'));
      return { c, rec, t, tc: { config: c.config, fieldById: c.fieldById, graph: c.graph, now: Date.now() } };
    };
    const isPrepared = (p: Prepared | ActionResult): p is Prepared => 'rec' in p;

    const validationFailure = (p: Prepared, v: ValidationResult): ActionResult => {
      if (v.missing.length > 0) {
        const names = v.missing.map((m) => p.c.fieldById.get(m.fieldId)?.name ?? m.fieldId).join(', ');
        return fail(p.t('common.error.missingFields', { count: v.missing.length, names }), {
          missing: v.missing,
          statusNotDone: v.statusNotDone,
        });
      }
      return fail(p.t('common.error.statusNotDone'), { missing: [], statusNotDone: true });
    };

    /** Optimistic write: update local state, call the host, roll back the touched cells on error. */
    const write = async (p: Prepared, patch: FieldsPatch, mode: 'record' | 'cell'): Promise<ActionResult> => {
      const keys = Object.keys(patch);
      if (keys.length === 0) return { ok: true };
      const recordId = p.rec.id;
      const before = recordsRef.current.find((r) => r.id === recordId)?.fields ?? p.rec.fields;
      let state = writesRef.current.get(recordId);
      if (!state) {
        state = { seq: 0, inflight: new Set() };
        writesRef.current.set(recordId, state);
      }
      state.seq++;
      commitRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, fields: { ...r.fields, ...patch } } : r)));
      const call =
        mode === 'cell' && keys.length === 1
          ? adapter.setCell(recordId, keys[0], patch[keys[0]])
          : adapter.setRecord(recordId, patch);
      state.inflight.add(call);
      try {
        await call;
        return { ok: true };
      } catch (e) {
        commitRecords((prev) =>
          prev.map((r) => (r.id === recordId ? { ...r, fields: restoreKeys(r.fields, before, keys, patch) } : r)),
        );
        // No host event follows a failed write: read the record again to pick up remote changes.
        refetchRef.current([recordId]);
        return fail(p.t('common.error.writeFailed', { message: errorMessage(e) }));
      } finally {
        state.inflight.delete(call);
      }
    };

    /**
     * Re-read the record before a transition, once this view's own writes to it have settled,
     * so validation and the history line use the host's data rather than a possibly stale
     * cache. Fails when someone else moved the record meanwhile.
     */
    const refresh = async (p: Prepared): Promise<Prepared | ActionResult> => {
      const recordId = p.rec.id;
      const pending = writesRef.current.get(recordId)?.inflight;
      if (pending && pending.size > 0) await Promise.all([...pending].map((call) => call.catch(() => undefined)));
      const isDirty = markWrites(writesRef.current);
      let fresh: RecordData | null;
      try {
        fresh = await adapter.getRecord(recordId);
      } catch (e) {
        console.warn('[pipeline-view] could not re-read the record before a transition', e);
        return p;
      }
      const cached = recordsRef.current.find((r) => r.id === recordId) ?? p.rec;
      if (!fresh) return fail(p.t('common.error.recordNotFound'));
      // Written again while reading (e.g. a field edited meanwhile): the local copy is newer.
      if (isDirty(recordId)) return { ...p, rec: cached };
      const latest = fresh;
      commitRecords((prev) => mergeRecordChanges(prev, new Map([[recordId, latest]]), new Set(), []));
      const stageFieldId = p.c.config.stageFieldId;
      if (stageFieldId && getSelectId(latest.fields[stageFieldId]) !== getSelectId(p.rec.fields[stageFieldId])) {
        return fail(p.t('common.error.recordChanged'));
      }
      return { ...p, rec: latest };
    };

    /** prepare() + refresh(). */
    const prepareFresh = async (recordId: string): Promise<Prepared | ActionResult> => {
      const p = prepare(recordId, true);
      return isPrepared(p) ? refresh(p) : p;
    };

    const transition = (p: Prepared, kind: TransitionKind, toNodeId?: string): Promise<ActionResult> => {
      let patch: FieldsPatch;
      try {
        patch = buildTransitionPatch(p.tc, p.rec, kind, toNodeId);
      } catch (e) {
        console.warn('[pipeline-view] cannot build transition', kind, e);
        return Promise.resolve(fail(p.t('common.error.invalidTarget')));
      }
      return write(p, patch, 'record');
    };

    /**
     * Create the "Steps passed" options a transition needs but the field lacks (named and coloured
     * like their nodes). Returns the transition context rebuilt on the refreshed fields when the
     * fields were read again, else null. Failures only log: the patch then leaves those steps out,
     * which the path field reads as "not recorded" rather than "not passed". Runs in the field's
     * option queue, so concurrent moves do not both create the same option.
     */
    const ensurePathOptions = async (p: Prepared, kind: TransitionKind, toNodeId?: string): Promise<TransitionContext | null> => {
      const missing = (tc: TransitionContext): string[] => {
        try {
          return missingPathOptionNames(tc, p.rec, kind, toNodeId);
        } catch {
          return [];
        }
      };
      const fieldId = p.tc.config.pathFieldId;
      if (!fieldId || !p.c.editable || missing(p.tc).length === 0) return null;
      const withFields = (fresh: { fields: FieldMeta[]; config: PipelineConfig }): TransitionContext => ({
        ...p.tc,
        config: fresh.config,
        fieldById: new Map(fresh.fields.map((f) => [f.id, f] as const)),
      });
      return queueOptions(fieldId, async () => {
        try {
          // The cached field list may be stale (another move may have just added the option).
          const before = await refreshFields();
          if (!before) return null;
          const names = missing(withFields(before));
          if (names.length === 0 || before.config.pathFieldId !== fieldId) return withFields(before);
          const colorOf = (name: string) => p.tc.graph.nodes.find((n) => pathKey(n.name) === pathKey(name))?.color;
          await appendOptions(fieldId, names.map((name) => ({ name, color: colorOf(name) })));
          // Read again even when adding failed: a collaborator may have created the option meanwhile.
          const after = await refreshFields();
          return after ? withFields(after) : null;
        } catch (e) {
          console.warn('[pipeline-view] could not prepare the steps-passed options', e);
          return null;
        }
      });
    };

    /**
     * One stage transition: prepareFresh() → `plan` (checks; returns the target or a failure) →
     * create missing "Steps passed" options → build the patch → write. Creating options costs extra
     * host round trips, so the record is then read again and re-planned: the write still starts
     * from the host's data and fails if someone else moved the record meanwhile.
     */
    const move = async (
      recordId: string,
      kind: TransitionKind,
      plan: (p: Prepared) => ActionResult | { to?: string },
    ): Promise<ActionResult> => {
      const first = await prepareFresh(recordId);
      if (!isPrepared(first)) return first;
      let p = first;
      let step = plan(p);
      if ('ok' in step) return step;
      const tc = await ensurePathOptions(p, kind, step.to);
      if (tc) {
        const again = await refresh({ ...p, tc: { ...tc, now: Date.now() } });
        if (!isPrepared(again)) return again;
        p = again;
        step = plan(p);
        if ('ok' in step) return step;
      }
      return transition(p, kind, step.to);
    };

    return {
      advance(recordId, toNodeId) {
        return move(recordId, 'advance', (p) => {
          const current = currentNodeId(p.tc, p.rec);
          if (current === null || !nextTargets(p.tc, p.rec).includes(toNodeId)) return fail(p.t('common.error.invalidTarget'));
          const v = validateNode(p.tc, p.rec, current);
          return v.ok ? { to: toNodeId } : validationFailure(p, v);
        });
      },

      rollback(recordId, toNodeId) {
        return move(recordId, 'rollback', (p) =>
          rollbackTargets(p.tc, p.rec).includes(toNodeId) ? { to: toNodeId } : fail(p.t('common.error.invalidTarget')),
        );
      },

      start(recordId, nodeId) {
        return move(recordId, 'start', (p) => {
          if (currentNodeId(p.tc, p.rec) !== null) return fail(p.t('common.error.invalidTarget'));
          const target = nodeId ?? p.c.graph.roots[0];
          if (!target || !p.c.graph.nodeById.has(target)) return fail(p.t('common.error.invalidTarget'));
          return { to: target };
        });
      },

      complete(recordId) {
        return move(recordId, 'complete', (p) => {
          const current = currentNodeId(p.tc, p.rec);
          if (current === null || !p.c.graph.terminals.includes(current)) return fail(p.t('common.error.invalidTarget'));
          if (!getDoneStatusId(p.c.config, p.c.statusField)) return fail(p.t('common.error.noDoneStatus'));
          const v = validateNode(p.tc, p.rec, current);
          // Completing is what sets the Done status, so requireDoneToAdvance does not apply here.
          return v.missing.length > 0 ? validationFailure(p, v) : {};
        });
      },

      async setStatus(recordId, statusOptionId) {
        const p = prepare(recordId, false);
        if (!isPrepared(p)) return p;
        const field = p.c.statusField;
        if (!field) return fail(p.t('common.error.notConfigured'));
        let value: CellValue = null;
        if (statusOptionId) {
          const option = field.options?.find((o) => o.id === statusOptionId);
          if (!option) return fail(p.t('common.error.invalidTarget'));
          value = makeSelectValue(option);
          // A done status at a terminal node finishes the record: same gate as complete().
          const current = currentNodeId(p.tc, p.rec);
          if (
            current !== null &&
            p.c.graph.terminals.includes(current) &&
            getStatusCategory(p.c.config, statusOptionId) === 'done'
          ) {
            const v = validateNode(p.tc, p.rec, current);
            if (v.missing.length > 0) return validationFailure(p, v);
          }
        }
        return write(p, { [field.id]: value }, 'cell');
      },

      async setCell(recordId, fieldId, value) {
        const p = prepare(recordId, false);
        if (!isPrepared(p)) return p;
        const field = p.c.fieldById.get(fieldId);
        if (!field || isComputedField(field.type)) return fail(p.t('common.error.fieldNotWritable'));
        return write(p, { [fieldId]: value === undefined ? null : value }, 'cell');
      },

      async openRecord(recordId, fieldIds) {
        try {
          await adapter.openRecord(recordId, fieldIds);
        } catch (e) {
          console.warn('[pipeline-view] openRecord failed', e);
        }
      },

      async editField(recordId, fieldId) {
        try {
          await adapter.editField(recordId, fieldId, ctxRef.current?.viewId ?? null);
        } catch (e) {
          console.warn('[pipeline-view] editField failed', e);
        }
      },
    };
  }, [adapter, commitRecords, langRef, refreshFields, appendOptions, queueOptions]);

  /* ---------------------------------------------------------------- */
  /* Configuration                                                      */
  /* ---------------------------------------------------------------- */

  const saveConfig = useCallback(
    async (next: PipelineConfig): Promise<ActionResult> => {
      const t = createT(langRef.current);
      if (!editableRef.current) return { ok: false, error: t('common.error.readonly') };
      try {
        const normalized = normalizeConfig(next, fieldsRef.current);
        await adapter.saveConfig(normalized);
        if (!mountedRef.current) return { ok: true };
        const previousView = configRef.current?.sourceViewId;
        rawConfigRef.current = normalized;
        setConfig(normalized);
        setHasSavedConfig(true);
        if (normalized.sourceViewId !== previousView) void reloadRecords();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: t('common.error.saveFailed', { message: errorMessage(e) }) };
      }
    },
    [adapter, langRef, editableRef, fieldsRef, configRef, setConfig, reloadRecords],
  );

  const createField = useCallback(
    async (cfg: AddFieldConfig): Promise<string | null> => {
      if (!editableRef.current) return null;
      let id: string;
      try {
        id = await adapter.addField(cfg);
      } catch (e) {
        console.warn('[pipeline-view] addField failed', e);
        return null;
      }
      await refreshFields().catch((e) => console.warn('[pipeline-view] refreshing fields failed', e));
      return id;
    },
    [adapter, editableRef, refreshFields],
  );

  const addStageOption = useCallback(
    async (name: string, fieldId?: string): Promise<string | null> => {
      const target = fieldId ?? configRef.current?.stageFieldId;
      const trimmed = name.trim();
      if (!editableRef.current || !target || !trimmed) return null;
      let id: string;
      try {
        id = await adapter.addSelectOption(target, trimmed);
      } catch (e) {
        console.warn('[pipeline-view] addSelectOption failed', e);
        return null;
      }
      await refreshFields().catch((e) => console.warn('[pipeline-view] refreshing fields failed', e));
      return id;
    },
    [adapter, configRef, editableRef, refreshFields],
  );

  /**
   * Make sure `fieldId` has an option per name: names it already has (trimmed, NFC; e.g. created by
   * a move a moment ago) give their existing id, the others are appended. Ids in input order, null
   * where adding failed. Shares the field's option queue with the moves.
   */
  const addSelectOptions = useCallback(
    async (fieldId: string, options: { name: string; color?: number }[]): Promise<(string | null)[]> => {
      if (!editableRef.current || !fieldId) return options.map(() => null);
      return queueOptions(fieldId, async () => {
        let current = fieldsRef.current;
        try {
          current = (await refreshFields())?.fields ?? current;
        } catch (e) {
          console.warn('[pipeline-view] refreshing fields failed', e);
        }
        const existing = new Map<string, string>();
        for (const o of current.find((f) => f.id === fieldId)?.options ?? []) {
          if (!existing.has(pathKey(o.name))) existing.set(pathKey(o.name), o.id);
        }
        const added = await appendOptions(
          fieldId,
          options.filter((o) => !existing.has(pathKey(o.name))),
        );
        if (added.some((id) => id !== null)) {
          await refreshFields().catch((e) => console.warn('[pipeline-view] refreshing fields failed', e));
        }
        let next = 0;
        return options.map((o) => existing.get(pathKey(o.name)) ?? added[next++] ?? null);
      });
    },
    [appendOptions, editableRef, fieldsRef, queueOptions, refreshFields],
  );

  const reload = useCallback(() => {
    void loadAll();
  }, [loadAll]);

  return {
    phase,
    error,
    loadedCount,
    ctx,
    configured: ctx ? isConfigured(ctx.config, ctx.fields) : false,
    hasSavedConfig,
    views,
    actions,
    saveConfig,
    createField,
    addStageOption,
    addSelectOptions,
    reload,
    lang,
  };
}
