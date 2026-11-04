import { describe, expect, it, vi } from 'vitest';
import { FieldType } from '../../../types';
import type { Edge, FieldMeta, RecordData } from '../../../types';
import { buildGraph } from '../../../core/graph';
import { computeNodeStates } from '../../../core/state';
import type { RecordsChangeEvent, Unsubscribe } from '../../adapter';
import { createLarkAdapter, eventRecordIds, sdkErrorMessage, toOptionColors } from '../../larkAdapter';
import { FALLBACK_OPTION_COLORS, optionColor } from '../../palette';
import { createMockAdapter, parseMockOptions } from '../mockAdapter';
import {
  DELETED_STAGE_OPTION,
  DEMO_CONFIG,
  DEMO_EDGES,
  F,
  MOCK_FIELDS,
  MOCK_ME,
  MOCK_RECORDS,
  MOCK_TABLE,
  MOCK_VIEW_IDS,
  PATH_OPTIONS,
  PATH_STEP,
  STAGE,
  STAGE_OPTIONS,
  STATUS,
  isMyItem,
} from '../mockData';

/* ------------------------------------------------------------------ */
/* Fake @lark-opdev/block-bitable-api (only larkAdapter imports it)    */
/* ------------------------------------------------------------------ */

type Fn = (...args: never[]) => unknown;
const sdk = vi.hoisted(() => ({
  base: {} as Record<string, Fn>,
  bridge: {} as Record<string, Fn>,
  ui: {} as Record<string, Fn>,
}));

vi.mock('@lark-opdev/block-bitable-api', () => ({
  bitable: {
    get base() {
      return sdk.base;
    },
    get bridge() {
      return sdk.bridge;
    },
    get ui() {
      return sdk.ui;
    },
  },
  PermissionEntity: { Base: 'Base', Table: 'Table' },
  OperationType: { Editable: 'editable' },
  DateFormatter: { DATE_TIME: 'yyyy/MM/dd HH:mm' },
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fast = (query = '') => new URLSearchParams(`latency=0&${query}`);

/** Resolves with the next value delivered to a subscription. */
function nextEvent<T>(subscribe: (cb: (value: T) => void) => Unsubscribe): Promise<T> {
  return new Promise((resolve) => {
    const off = subscribe((value) => {
      off();
      resolve(value);
    });
  });
}

const fieldById = new Map(MOCK_FIELDS.map((f) => [f.id, f]));
const stageByName = new Map(STAGE_OPTIONS.map((o) => [o.name, o.id]));
const stageIds = new Set(STAGE_OPTIONS.map((o) => o.id));
const statusIds = new Set(Object.values(STATUS).map((o) => o.id));

function textOf(value: unknown): string {
  return Array.isArray(value) ? value.map((s) => (s as { text?: string }).text ?? '').join('') : '';
}

function selectId(value: unknown): string | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? String((value as { id?: unknown }).id) : null;
}

/** Nodes reachable from `node` in a DAG given as edges (excluding itself). */
function descendantsOf(node: string, edges: Edge[]): Set<string> {
  const out = new Set<string>();
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const e of edges) {
      if (e.from === cur && !out.has(e.to)) {
        out.add(e.to);
        stack.push(e.to);
      }
    }
  }
  return out;
}

/** Strict ancestors of `node` in a DAG given as edges. */
function ancestorsOf(node: string, edges: Edge[]): Set<string> {
  const out = new Set<string>();
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const e of edges) {
      if (e.to === cur && !out.has(e.from)) {
        out.add(e.from);
        stack.push(e.from);
      }
    }
  }
  return out;
}

const LINE = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\] (?:▶ (.+)|✓ (.+)|(.+?) → (.+)|(.+?) ↩ (.+))$/;

interface ParsedLine {
  at: number;
  kind: 'start' | 'complete' | 'advance' | 'rollback';
  from?: string;
  to: string;
}

function parseLine(line: string): ParsedLine | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  if (m[6]) return { at, kind: 'start', to: m[6] };
  if (m[7]) return { at, kind: 'complete', to: m[7] };
  if (m[8]) return { at, kind: 'advance', from: m[8], to: m[9] };
  return { at, kind: 'rollback', from: m[10], to: m[11] };
}

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

describe('palette', () => {
  it('has 55 colors with distinct hues for ids 0-9', () => {
    expect(FALLBACK_OPTION_COLORS).toHaveLength(55);
    const firstTen = FALLBACK_OPTION_COLORS.slice(0, 10).map((c) => c.bg);
    expect(new Set(firstTen).size).toBe(10);
    for (const c of FALLBACK_OPTION_COLORS) {
      expect(c.bg).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.text).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(FALLBACK_OPTION_COLORS[0].text).toBe('#1f2329');
  });

  it('optionColor wraps and never returns undefined', () => {
    expect(optionColor(FALLBACK_OPTION_COLORS, 55)).toBe(FALLBACK_OPTION_COLORS[0]);
    expect(optionColor(FALLBACK_OPTION_COLORS, -1)).toBe(FALLBACK_OPTION_COLORS[54]);
    expect(optionColor(FALLBACK_OPTION_COLORS, Number.NaN)).toBe(FALLBACK_OPTION_COLORS[0]);
    expect(optionColor([], 3)).toBe(FALLBACK_OPTION_COLORS[3]);
    expect(optionColor(undefined, 7)).toBe(FALLBACK_OPTION_COLORS[7]);
  });
});

/* ------------------------------------------------------------------ */
/* Mock adapter                                                        */
/* ------------------------------------------------------------------ */

describe('parseMockOptions', () => {
  it('uses the documented defaults', () => {
    expect(parseMockOptions()).toEqual({ preset: 'demo', readonly: false, theme: 'light', lang: 'vi', latency: 120, reset: false });
  });

  it('reads every URL parameter', () => {
    const o = parseMockOptions(new URLSearchParams('preset=none&readonly=1&theme=dark&lang=en&latency=5&reset=1'));
    expect(o).toEqual({ preset: 'none', readonly: true, theme: 'dark', lang: 'en', latency: 5, reset: true });
    expect(parseMockOptions(new URLSearchParams('readonly=0&latency=-3')).readonly).toBe(false);
    expect(parseMockOptions(new URLSearchParams('latency=abc')).latency).toBe(120);
  });
});

describe('mock adapter', () => {
  it('init returns the table and the pipeline view id', async () => {
    const adapter = createMockAdapter(fast());
    expect(adapter.kind).toBe('mock');
    await expect(adapter.init()).resolves.toEqual({ table: MOCK_TABLE, viewId: MOCK_VIEW_IDS.pipeline });
    await expect(adapter.getLanguage()).resolves.toBe('vi');
    await expect(adapter.getTheme()).resolves.toBe('light');
    await expect(createMockAdapter(fast('theme=dark&lang=en')).getTheme()).resolves.toBe('dark');
  });

  it('exposes the fields with ordered stage and status options', async () => {
    const fields = await createMockAdapter(fast()).getFields();
    expect(fields.filter((f) => f.isPrimary).map((f) => f.name)).toEqual(['Name']);
    const stage = fields.find((f) => f.id === F.stage) as FieldMeta;
    expect(stage.type).toBe(FieldType.SingleSelect);
    expect(stage.options?.map((o) => o.name)).toEqual([
      'DA Tracking',
      'Detail Review',
      'Tech Design',
      'FE Plan',
      'Server Plan',
      'QA Plan',
      'FE Dev',
      'Server Dev',
      'QA Test',
      'Integration Test',
      'Release',
      'Retrospective',
    ]);
    const status = fields.find((f) => f.id === F.status) as FieldMeta;
    expect(status.options?.map((o) => o.name)).toEqual(['Not started', 'In progress', 'Pending Design', 'Done', 'Blocked']);
  });

  it('loads every record and reports progress', async () => {
    const adapter = createMockAdapter(fast());
    const progress: number[] = [];
    const records = await adapter.getAllRecords({ onProgress: (n) => progress.push(n) });
    expect(records).toHaveLength(MOCK_RECORDS.length);
    expect(progress.length).toBeGreaterThan(1);
    expect(progress[progress.length - 1]).toBe(MOCK_RECORDS.length);
  });

  it('honours the fake view filters', async () => {
    const adapter = createMockAdapter(fast());
    const mine = await adapter.getAllRecords({ viewId: MOCK_VIEW_IDS.mine });
    expect(mine.length).toBeGreaterThan(MOCK_RECORDS.length / 3);
    expect(mine.length).toBeLessThan(MOCK_RECORDS.length);
    expect(mine.every(isMyItem)).toBe(true);
    expect(await adapter.getAllRecords({ viewId: MOCK_VIEW_IDS.all })).toHaveLength(MOCK_RECORDS.length);
    await expect(adapter.getAllRecords({ viewId: 'vewMissing1' })).rejects.toThrow(/View not found/);
    const views = await adapter.getViews();
    expect(views.map((v) => v.type)).toEqual([1, 1, 100]);
  });

  it('returns isolated copies of records', async () => {
    const adapter = createMockAdapter(fast());
    const record = (await adapter.getRecord('recPv01Onbd')) as RecordData;
    record.fields[F.name] = null;
    expect(textOf((await adapter.getRecord('recPv01Onbd'))?.fields[F.name])).toBe('Product User Onboarding Flow - Phase One');
    await expect(adapter.getRecord('recMissing1')).resolves.toBeNull();
  });

  it('setRecord writes all cells and then emits a modify event', async () => {
    const adapter = createMockAdapter(fast());
    const event = nextEvent<RecordsChangeEvent>((cb) => adapter.onRecordsChange(cb));
    await adapter.setRecord('recPv02Chkt', {
      [F.stage]: { id: STAGE.IT.id, text: 'stale name' },
      [F.status]: { id: STATUS.done.id, text: 'Done' },
      [F.reviewerNotes]: 'Looks good',
      [F.bugsFound]: 0,
      [F.feGrayBox]: null,
    });
    await expect(event).resolves.toEqual({ type: 'modify', recordIds: ['recPv02Chkt'] });
    const fields = (await adapter.getRecord('recPv02Chkt'))?.fields ?? {};
    expect(fields[F.stage]).toEqual({ id: STAGE.IT.id, text: 'Integration Test' });
    expect(selectId(fields[F.status])).toBe(STATUS.done.id);
    expect(fields[F.reviewerNotes]).toEqual([{ type: 'text', text: 'Looks good' }]);
    expect(fields[F.bugsFound]).toBe(0);
    expect(F.feGrayBox in fields).toBe(false);
  });

  it('writes "Steps passed" multi-select values and appends options to that field', async () => {
    const adapter = createMockAdapter(fast());
    const value = [
      { id: PATH_STEP.DA.id, text: 'stale text' },
      { id: PATH_STEP.TD.id, text: PATH_STEP.TD.name },
    ];
    await adapter.setRecord('recPv13Offl', { [F.path]: value });
    expect((await adapter.getRecord('recPv13Offl'))?.fields[F.path]).toEqual([
      { id: PATH_STEP.DA.id, text: 'DA Tracking' },
      { id: PATH_STEP.TD.id, text: 'Tech Design' },
    ]);
    const optionId = await adapter.addSelectOption(F.path, 'Security Audit', 7);
    await adapter.setCell('recPv13Offl', F.path, [{ id: optionId, text: 'Security Audit' }]);
    expect((await adapter.getRecord('recPv13Offl'))?.fields[F.path]).toEqual([{ id: optionId, text: 'Security Audit' }]);
    expect((await adapter.getFields()).find((f) => f.id === F.path)?.options?.at(-1)).toMatchObject({ name: 'Security Audit', color: 7 });
    await adapter.setCell('recPv13Offl', F.path, []);
    expect((await adapter.getRecord('recPv13Offl'))?.fields[F.path]).toBeUndefined();
    await expect(adapter.setCell('recPv13Offl', F.path, [{ id: 'optNope123', text: 'Nope' }])).rejects.toThrow(/does not exist/);
  });

  it('setCell delegates to setRecord', async () => {
    const adapter = createMockAdapter(fast());
    const event = nextEvent<RecordsChangeEvent>((cb) => adapter.onRecordsChange(cb));
    await adapter.setCell('recPv10Paus', F.estimate, 4);
    expect((await event).recordIds).toEqual(['recPv10Paus']);
    expect((await adapter.getRecord('recPv10Paus'))?.fields[F.estimate]).toBe(4);
  });

  it('rejects invalid writes without touching the record', async () => {
    const adapter = createMockAdapter(fast());
    const before = await adapter.getRecord('recPv03Dark');
    await expect(adapter.setRecord('recMissing1', { [F.name]: 'x' })).rejects.toThrow(/Record not found/);
    await expect(adapter.setRecord('recPv03Dark', { [F.name]: 'x', fldMissing01: 'y' })).rejects.toThrow(/Field not found/);
    await expect(adapter.setRecord('recPv03Dark', { [F.stage]: { id: 'optNope', text: 'Nope' } })).rejects.toThrow(/does not exist/);
    await expect(adapter.setRecord('recPv03Dark', { [F.score]: 3 })).rejects.toThrow(/computed/);
    await expect(adapter.setRecord('recPv03Dark', { [F.estimate]: 'many' })).rejects.toThrow(/Invalid value/);
    await expect(adapter.getRecord('recPv03Dark')).resolves.toEqual(before);
  });

  it('stores Email cells as plain strings, like IEmailField in SDK 0.4.0', async () => {
    const adapter = createMockAdapter(fast());
    const email = await adapter.addField({ name: 'Contact email', type: FieldType.Email });
    await adapter.setCell('recPv10Paus', email, 'an@example.com');
    expect((await adapter.getRecord('recPv10Paus'))?.fields[email]).toBe('an@example.com');
    await expect(adapter.setCell('recPv10Paus', email, [{ type: 'text', text: 'x@y.z' }])).rejects.toThrow(/Invalid value/);
    await adapter.setCell('recPv10Paus', email, '');
    expect((await adapter.getRecord('recPv10Paus'))?.fields[email]).toBeUndefined();
  });

  it('serves the demo config by default and null for preset=none', async () => {
    await expect(createMockAdapter(fast()).loadConfig()).resolves.toEqual(DEMO_CONFIG);
    await expect(createMockAdapter(fast('preset=none')).loadConfig()).resolves.toBeNull();
  });

  it('saves and reloads the config and notifies listeners', async () => {
    const adapter = createMockAdapter(fast('preset=none'));
    const changed = nextEvent<void>((cb) => adapter.onConfigChange(cb));
    const config = { ...DEMO_CONFIG, allowRollback: false };
    await adapter.saveConfig(config);
    await changed;
    await expect(adapter.loadConfig()).resolves.toEqual(config);
    config.allowRollback = true; // the stored copy must not alias the caller's object
    expect(((await adapter.loadConfig()) as { allowRollback: boolean }).allowRollback).toBe(false);
  });

  it('is read-only with readonly=1', async () => {
    const adapter = createMockAdapter(fast('readonly=1'));
    await expect(adapter.isEditable()).resolves.toBe(false);
    await expect(createMockAdapter(fast()).isEditable()).resolves.toBe(true);
    await expect(adapter.setCell('recPv02Chkt', F.name, 'x')).rejects.toThrow(/permission denied/);
    await expect(adapter.saveConfig(DEMO_CONFIG)).rejects.toThrow(/permission denied/);
    await expect(adapter.addField({ name: 'X', type: FieldType.Text })).rejects.toThrow(/permission denied/);
    await expect(adapter.addSelectOption(F.stage, 'UAT')).rejects.toThrow(/permission denied/);
  });

  it('addField creates a field with Lark-like ids and emits a fields change', async () => {
    const adapter = createMockAdapter(fast());
    const changed = nextEvent<void>((cb) => adapter.onFieldsChange(cb));
    const id = await adapter.addField({
      name: 'Phase',
      type: FieldType.SingleSelect,
      options: [{ name: 'A' }, { name: 'B', color: 7 }],
    });
    await changed;
    expect(id).toMatch(/^fld[A-Za-z0-9]{7}$/);
    const field = (await adapter.getFields()).find((f) => f.id === id) as FieldMeta;
    expect(field.type).toBe(FieldType.SingleSelect);
    expect(field.options?.map((o) => o.name)).toEqual(['A', 'B']);
    expect(field.options?.[1].color).toBe(7);
    expect(field.options?.every((o) => /^opt[A-Za-z0-9]{7}$/.test(o.id))).toBe(true);
    await expect(adapter.addField({ name: 'Phase', type: FieldType.Text })).rejects.toThrow(/already exists/);
    const dateId = await adapter.addField({ name: 'Entered at', type: FieldType.DateTime });
    expect((await adapter.getFields()).find((f) => f.id === dateId)?.type).toBe(FieldType.DateTime);
  });

  it('addSelectOption appends an option and emits a fields change', async () => {
    const adapter = createMockAdapter(fast());
    const changed = nextEvent<void>((cb) => adapter.onFieldsChange(cb));
    const optionId = await adapter.addSelectOption(F.stage, 'Security Audit');
    await changed;
    const stage = (await adapter.getFields()).find((f) => f.id === F.stage) as FieldMeta;
    expect(stage.options).toHaveLength(13);
    expect(stage.options?.[12]).toMatchObject({ id: optionId, name: 'Security Audit' });
    expect((stage.property as { options: unknown[] }).options).toHaveLength(13);
    await adapter.setCell('recPv13Offl', F.stage, { id: optionId, text: 'Security Audit' });
    await expect(adapter.addSelectOption(F.stage, 'Security Audit')).rejects.toThrow(/already exists/);
    await expect(adapter.addSelectOption(F.name, 'X')).rejects.toThrow(/not a select field/);
    await expect(adapter.addSelectOption('fldMissing01', 'X')).rejects.toThrow(/Field not found/);
  });

  it('host UI calls work without a DOM and validate ids', async () => {
    const adapter = createMockAdapter(fast());
    await expect(adapter.openRecord('recPv01Onbd', [F.prdLink])).resolves.toBeUndefined();
    await expect(adapter.editField('recPv01Onbd', F.reviewerNotes)).resolves.toBeUndefined();
    await expect(adapter.openRecord('recMissing1')).rejects.toThrow(/Record not found/);
    expect(await adapter.getOptionColors()).toHaveLength(55);
  });

  it('setTheme notifies theme listeners', async () => {
    const adapter = createMockAdapter(fast());
    const theme = nextEvent((cb) => adapter.onThemeChange(cb));
    adapter.setTheme('dark');
    await expect(theme).resolves.toBe('dark');
    await expect(adapter.getTheme()).resolves.toBe('dark');
  });
});

/* ------------------------------------------------------------------ */
/* Demo data consistency                                               */
/* ------------------------------------------------------------------ */

describe('demo data', () => {
  it('uses Lark-shaped ids', () => {
    for (const f of MOCK_FIELDS) {
      expect(f.id).toMatch(/^fld[A-Za-z0-9]{7}$/);
      for (const o of f.options ?? []) expect(o.id).toMatch(/^opt[A-Za-z0-9]{7}$/);
    }
    expect(new Set(MOCK_FIELDS.map((f) => f.id)).size).toBe(MOCK_FIELDS.length);
    for (const r of MOCK_RECORDS) expect(r.id).toMatch(/^rec[A-Za-z0-9]{8}$/);
    expect(new Set(MOCK_RECORDS.map((r) => r.id)).size).toBe(MOCK_RECORDS.length);
    expect(MOCK_ME.id).toMatch(/^ou_[0-9a-f]{32}$/);
  });

  it('references only existing fields and options in DEMO_CONFIG', () => {
    const expectType = (id: string | undefined, type: FieldType) => {
      expect(id && fieldById.get(id)?.type, `field ${id}`).toBe(type);
    };
    expectType(DEMO_CONFIG.titleFieldId, FieldType.Text);
    expectType(DEMO_CONFIG.stageFieldId, FieldType.SingleSelect);
    expectType(DEMO_CONFIG.statusFieldId, FieldType.SingleSelect);
    expectType(DEMO_CONFIG.enteredAtFieldId, FieldType.DateTime);
    expectType(DEMO_CONFIG.historyFieldId, FieldType.Text);
    expectType(DEMO_CONFIG.pathFieldId, FieldType.MultiSelect);
    // One "Steps passed" option per stage, same names and colours.
    expect(PATH_OPTIONS.map((o) => [o.name, o.color])).toEqual(STAGE_OPTIONS.map((o) => [o.name, o.color]));
    expect(fieldById.get(F.path)?.options).toEqual(PATH_OPTIONS);
    DEMO_CONFIG.roleFieldIds.forEach((id) => expectType(id, FieldType.User));
    DEMO_CONFIG.checklistFieldIds.forEach((id) => expectType(id, FieldType.Checkbox));
    DEMO_CONFIG.listFieldIds.forEach((id) => expect(fieldById.has(id)).toBe(true));
    expect(DEMO_CONFIG.roleFieldIds).toHaveLength(8);

    expect(new Set(Object.keys(DEMO_CONFIG.nodes))).toEqual(stageIds);
    for (const node of Object.values(DEMO_CONFIG.nodes)) {
      for (const rule of node.fields) expect(fieldById.has(rule.fieldId)).toBe(true);
      if (node.ownerFieldId) expectType(node.ownerFieldId, FieldType.User);
      if (node.entryStatusId) expect(statusIds.has(node.entryStatusId)).toBe(true);
    }
    expect(DEMO_CONFIG.nodes[STAGE.DR.id].entryStatusId).toBe(STATUS.pendingDesign.id);
    expect(new Set(Object.keys(DEMO_CONFIG.statusCategories))).toEqual(statusIds);
    expect(DEMO_CONFIG.statusCategories[STATUS.pendingDesign.id]).toBe('todo');
    expect(DEMO_CONFIG.defaultEntryStatusId).toBe(STATUS.notStarted.id);
    for (const e of DEMO_EDGES) {
      expect(stageIds.has(e.from) && stageIds.has(e.to)).toBe(true);
      expect(STAGE_OPTIONS.findIndex((o) => o.id === e.from)).toBeLessThan(STAGE_OPTIONS.findIndex((o) => o.id === e.to));
    }
    expect(DEMO_CONFIG.edges).toEqual(DEMO_EDGES);
  });

  it('has history logs consistent with the DEMO graph and the stage cells', () => {
    const terminals = new Set([STAGE.RETRO.id]);
    const roots = new Set([STAGE.DA.id]);
    const edgeSet = new Set(DEMO_EDGES.map((e) => `${e.from}>${e.to}`));
    for (const record of MOCK_RECORDS) {
      const history = textOf(record.fields[F.history]);
      if (!history) {
        expect(record.fields[F.enteredAt], record.id).toBeUndefined();
        continue;
      }
      const lines = history.split('\n').map(parseLine);
      expect(lines.every(Boolean), `${record.id} format`).toBe(true);
      let current: string | null = null;
      let lastAt = -Infinity;
      let lastMoveAt = NaN;
      let completed = false;
      for (const line of lines as ParsedLine[]) {
        expect(line.at, record.id).toBeGreaterThanOrEqual(lastAt);
        lastAt = line.at;
        expect(completed, `${record.id}: nothing after ✓`).toBe(false);
        const to = stageByName.get(line.to);
        expect(to, `${record.id}: unknown stage "${line.to}"`).toBeDefined();
        if (line.kind === 'start') {
          expect(current).toBeNull();
          expect(roots.has(to as string)).toBe(true);
        } else if (line.kind === 'complete') {
          expect(to).toBe(current);
          expect(terminals.has(to as string)).toBe(true);
          completed = true;
          continue;
        } else {
          const from = stageByName.get(line.from as string);
          expect(from, `${record.id}: unknown stage "${line.from}"`).toBe(current);
          if (line.kind === 'advance') expect(edgeSet.has(`${from}>${to}`), `${record.id}: ${line.from} → ${line.to}`).toBe(true);
          else expect(ancestorsOf(from as string, DEMO_EDGES).has(to as string), `${record.id}: rollback`).toBe(true);
        }
        current = to as string;
        lastMoveAt = line.at;
      }
      const stage = selectId(record.fields[F.stage]);
      if (stage === DELETED_STAGE_OPTION.id) continue;
      expect(stage, `${record.id} stage matches history`).toBe(current);
      expect(record.fields[F.enteredAt], `${record.id} enteredAt`).toBe(lastMoveAt);
    }
  });

  it('has "Steps passed" values equal to the steps the history visited (rollbacks untick later steps)', () => {
    const pathName = new Map(PATH_OPTIONS.map((o) => [o.id, o.name]));
    for (const record of MOCK_RECORDS) {
      const history = textOf(record.fields[F.history]);
      const cell = record.fields[F.path];
      if (!history) {
        expect(cell, `${record.id}: no history, no steps passed`).toBeUndefined();
        continue;
      }
      const visited = new Set<string>();
      for (const line of history.split('\n').map(parseLine) as ParsedLine[]) {
        const to = stageByName.get(line.to) as string;
        if (line.kind === 'start') {
          visited.clear();
          visited.add(to);
        } else if (line.kind === 'advance') {
          visited.add(stageByName.get(line.from as string) as string);
          visited.add(to);
        } else if (line.kind === 'rollback') {
          visited.add(to);
          for (const later of descendantsOf(to, DEMO_EDGES)) visited.delete(later);
        } else {
          visited.add(to);
        }
      }
      expect(Array.isArray(cell), record.id).toBe(true);
      const items = cell as { id: string; text: string }[];
      for (const item of items) expect(pathName.get(item.id), `${record.id}: option ${item.id}`).toBe(item.text);
      // Same steps, listed in pipeline (option) order.
      const expected = STAGE_OPTIONS.filter((o) => visited.has(o.id)).map((o) => o.name);
      expect(items.map((i) => i.text), record.id).toEqual(expected);
    }
  });

  it('shows "unknown" branch steps only for records without steps passed and history', () => {
    const graph = buildGraph(STAGE_OPTIONS, DEMO_EDGES);
    const unknownIn = (r: RecordData) =>
      [...computeNodeStates(graph, r, DEMO_CONFIG, fieldById).states].filter(([, s]) => s === 'unknown').map(([id]) => id);
    const withUnknown = MOCK_RECORDS.filter((r) => unknownIn(r).length > 0);
    expect(withUnknown.map((r) => r.id).sort()).toEqual(['recPv18Prtn', 'recPv19Bill']);
    for (const r of withUnknown) {
      expect(r.fields[F.history], r.id).toBeUndefined();
      expect(r.fields[F.path], r.id).toBeUndefined();
    }
    // At Integration Test, only DA → DR → TD lie on every route: the three branches are unknown.
    const imported = MOCK_RECORDS.find((r) => r.id === 'recPv18Prtn') as RecordData;
    expect(unknownIn(imported).sort()).toEqual([STAGE.FEP.id, STAGE.SVP.id, STAGE.QAP.id, STAGE.FED.id, STAGE.SVD.id, STAGE.QAT.id].sort());
    const states = computeNodeStates(graph, imported, DEMO_CONFIG, fieldById);
    expect(states.visitSource).toBe('inferred');
    for (const id of [STAGE.DA.id, STAGE.DR.id, STAGE.TD.id]) expect(states.states.get(id)).toBe('done');
    // Records written by the plugin read their branch from the path field.
    const branched = MOCK_RECORDS.find((r) => r.id === 'recPv03Dark') as RecordData;
    const fromPath = computeNodeStates(graph, branched, DEMO_CONFIG, fieldById);
    expect(fromPath.visitSource).toBe('path');
    expect(fromPath.states.get(STAGE.QAP.id)).toBe('done');
    expect(fromPath.states.get(STAGE.FEP.id)).toBe('skipped');
  });

  it('covers the scenarios the UI needs', () => {
    const byName = new Map(MOCK_RECORDS.map((r) => [textOf(r.fields[F.name]), r]));
    const onboarding = byName.get('Product User Onboarding Flow - Phase One') as RecordData;
    expect(selectId(onboarding.fields[F.stage])).toBe(STAGE.DR.id);
    expect(selectId(onboarding.fields[F.status])).toBe(STATUS.pendingDesign.id);
    const daysInStage = (Date.now() - (onboarding.fields[F.enteredAt] as number)) / 86_400_000;
    expect(daysInStage).toBeGreaterThan(30);
    expect(daysInStage).toBeLessThan(33);
    expect(onboarding.fields[F.safetyReview]).toBe(true);
    expect(onboarding.fields[F.updateManual]).toBe(true);
    expect(DEMO_CONFIG.roleFieldIds.every((id) => Array.isArray(onboarding.fields[id]))).toBe(true);

    expect(MOCK_RECORDS.length).toBeGreaterThanOrEqual(14);
    expect(MOCK_RECORDS.filter((r) => !r.fields[F.stage])).toHaveLength(2);
    const done = MOCK_RECORDS.filter((r) => selectId(r.fields[F.status]) === STATUS.done.id);
    expect(done).toHaveLength(1);
    expect(selectId(done[0].fields[F.stage])).toBe(STAGE.RETRO.id);
    expect(textOf(done[0].fields[F.history])).toMatch(/✓ Retrospective$/);
    expect(MOCK_RECORDS.filter((r) => selectId(r.fields[F.status]) === STATUS.blocked.id)).toHaveLength(1);
    const orphan = MOCK_RECORDS.filter((r) => {
      const id = selectId(r.fields[F.stage]);
      return id !== null && !stageIds.has(id);
    });
    expect(orphan.map((r) => selectId(r.fields[F.stage]))).toEqual([DELETED_STAGE_OPTION.id]);
    expect(MOCK_RECORDS.some((r) => textOf(r.fields[F.history]).includes(' ↩ '))).toBe(true);
    // Every select value in the data refers to an existing option (except the deliberately deleted stage).
    for (const r of MOCK_RECORDS) {
      for (const field of MOCK_FIELDS.filter((f) => f.type === FieldType.SingleSelect && f.id !== F.stage)) {
        const id = selectId(r.fields[field.id]);
        if (id) expect(field.options?.some((o) => o.id === id)).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Lark adapter over a fake SDK                                        */
/* ------------------------------------------------------------------ */

type Handler = (ev: { data: unknown }) => void;

function fakeTable(overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, Handler> = {};
  const offs: Record<string, ReturnType<typeof vi.fn>> = {};
  const subscribe = (name: string) =>
    vi.fn((cb: Handler) => {
      handlers[name] = cb;
      offs[name] = vi.fn();
      return offs[name];
    });
  const table = {
    id: 'tblFake0000001',
    getName: vi.fn(async () => 'Requirements'),
    getMeta: vi.fn(async () => ({ id: 'tblFake0000001', name: 'Requirements', isSync: false })),
    getFieldMetaList: vi.fn(async () => [
      { id: 'fldName00001', name: 'Name', type: 1, isPrimary: true, property: null },
      {
        id: 'fldStage0001',
        name: 'Stage',
        type: 3,
        isPrimary: false,
        property: { options: [{ id: 'optA', name: 'A', color: 2 }], optionsType: 0 },
      },
    ]),
    getViewMetaList: vi.fn(async () => [{ id: 'vewGrid00001', name: 'Grid', type: 1, property: {} }]),
    getRecords: vi.fn(),
    getRecordIdList: vi.fn(async () => ['rec1', 'rec2', 'rec3']),
    getRecordById: vi.fn(async (id: string) => ({ fields: { fldName00001: [{ type: 'text', text: id }] } })),
    getViewById: vi.fn(),
    setRecord: vi.fn(async () => 'rec1'),
    setCellValue: vi.fn(async () => true),
    addField: vi.fn(async () => 'fldNew000001'),
    getFieldById: vi.fn(),
    onRecordAdd: subscribe('add'),
    onRecordModify: subscribe('modify'),
    onRecordDelete: subscribe('delete'),
    onFieldAdd: subscribe('fieldAdd'),
    onFieldDelete: subscribe('fieldDelete'),
    onFieldModify: subscribe('fieldModify'),
    ...overrides,
  };
  return { table, handlers, offs };
}

async function larkWith(table: object, selection: Record<string, unknown> = { tableId: 'tblFake0000001', viewId: 'vewPipe00001' }) {
  sdk.base = {
    getSelection: vi.fn(async () => ({ baseId: 'bas1', fieldId: null, recordId: null, ...selection })),
    getTableById: vi.fn(async () => table),
    getActiveTable: vi.fn(async () => table),
  } as unknown as Record<string, Fn>;
  const adapter = createLarkAdapter();
  const ctx = await adapter.init();
  return { adapter, ctx };
}

describe('lark adapter (fake SDK)', () => {
  it('init resolves the table from the selection, falling back to the active table', async () => {
    const { table } = fakeTable();
    const { ctx } = await larkWith(table);
    expect(ctx).toEqual({ table: { id: 'tblFake0000001', name: 'Requirements' }, viewId: 'vewPipe00001' });
    expect(sdk.base.getTableById).toHaveBeenCalledWith('tblFake0000001');

    const second = await larkWith(table, { tableId: null, viewId: null });
    expect(sdk.base.getActiveTable).toHaveBeenCalled();
    expect(second.ctx).toEqual({ table: { id: 'tblFake0000001', name: 'Requirements' }, viewId: null });
  });

  it('maps field metas including select options', async () => {
    const { table } = fakeTable();
    const { adapter } = await larkWith(table);
    const fields = await adapter.getFields();
    expect(fields[0]).toMatchObject({ id: 'fldName00001', type: FieldType.Text, isPrimary: true });
    expect(fields[1].options).toEqual([{ id: 'optA', name: 'A', color: 2 }]);
    expect(await adapter.getViews()).toEqual([{ id: 'vewGrid00001', name: 'Grid', type: 1 }]);
  });

  it('pages through getRecords and stops on a repeated page token', async () => {
    const getRecords = vi
      .fn()
      .mockResolvedValueOnce({ total: 3, hasMore: true, pageToken: 't1', records: [{ recordId: 'r1', fields: {} }] })
      .mockResolvedValueOnce({ total: 3, hasMore: true, pageToken: 't2', records: [{ recordId: 'r2', fields: {} }] })
      .mockResolvedValueOnce({ total: 3, hasMore: true, pageToken: 't2', records: [{ recordId: 'r3', fields: { f: 1 } }] });
    const { table } = fakeTable({ getRecords });
    const { adapter } = await larkWith(table);
    const progress: number[] = [];
    const records = await adapter.getAllRecords({ viewId: 'vewGrid00001', onProgress: (n) => progress.push(n) });
    expect(records.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(progress).toEqual([1, 2, 3]);
    expect(getRecords).toHaveBeenCalledTimes(3);
    expect(getRecords.mock.calls[0][0]).toEqual({ pageSize: 5000, pageToken: undefined, viewId: 'vewGrid00001' });
    expect(getRecords.mock.calls[1][0]).toMatchObject({ pageToken: 't1' });
  });

  it('falls back to getRecordIdList + getRecordById when getRecords is unavailable', async () => {
    const missing = fakeTable({ getRecords: undefined });
    const { adapter } = await larkWith(missing.table);
    expect((await adapter.getAllRecords()).map((r) => r.id)).toEqual(['rec1', 'rec2', 'rec3']);

    const notRegistered = fakeTable({ getRecords: vi.fn().mockRejectedValue({ code: 10296997, message: 'not registered' }) });
    const second = await larkWith(notRegistered.table);
    const records = await second.adapter.getAllRecords();
    expect(records).toHaveLength(3);
    expect(records[0].fields).toEqual({ fldName00001: [{ type: 'text', text: 'rec1' }] });

    const failing = fakeTable({ getRecords: vi.fn().mockRejectedValue({ code: 10214997, message: 'no access' }) });
    const third = await larkWith(failing.table);
    await expect(third.adapter.getAllRecords()).rejects.toThrow('Cannot read records: no access (code 10214997)');
  });

  it('wraps write errors into readable Errors', async () => {
    const { table } = fakeTable({ setRecord: vi.fn().mockRejectedValue({ code: 10214997 }) });
    const { adapter } = await larkWith(table);
    await expect(adapter.setRecord('rec1', { f: 1 })).rejects.toThrow('Cannot update record: permission denied (code 10214997)');
    expect(sdkErrorMessage(new Error('boom'))).toBe('boom');
    expect(sdkErrorMessage('plain')).toBe('plain');
  });

  it('isEditable prefers getPermission and falls back safely', async () => {
    const { table } = fakeTable();
    const { adapter } = await larkWith(table);
    sdk.base.getPermission = vi.fn(async () => true);
    await expect(adapter.isEditable()).resolves.toBe(true);
    expect(sdk.base.getPermission).toHaveBeenCalledWith({ entity: 'Table', type: 'editable', param: { tableId: 'tblFake0000001' } });
    sdk.base.getPermission = vi.fn().mockRejectedValue(new Error('not registered'));
    sdk.base.isEditable = vi.fn(async () => true);
    await expect(adapter.isEditable()).resolves.toBe(true);
    sdk.base.isEditable = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(adapter.isEditable()).resolves.toBe(false);
  });

  it('loads config safely and filters data-change events by key', async () => {
    const { table } = fakeTable();
    const { adapter } = await larkWith(table);
    // A failed read is not "never saved": it must surface instead of resetting to defaults.
    sdk.bridge.getData = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(adapter.loadConfig()).rejects.toThrow('Cannot read the pipeline settings: timeout');
    sdk.bridge.getData = vi.fn().mockRejectedValue({ code: 10289998, message: 'key not found' });
    await expect(adapter.loadConfig()).resolves.toBeNull();
    sdk.bridge.getData = vi.fn(async () => undefined);
    await expect(adapter.loadConfig()).resolves.toBeNull();
    sdk.bridge.getData = vi.fn(async () => ({ version: 1 }));
    await expect(adapter.loadConfig()).resolves.toEqual({ version: 1 });
    expect(sdk.bridge.getData).toHaveBeenCalledWith('pipeline-config');

    sdk.bridge.setData = vi.fn(async () => true);
    await adapter.saveConfig({ version: 1, skip: undefined });
    expect(sdk.bridge.setData).toHaveBeenCalledWith('pipeline-config', { version: 1 });

    let emit: Handler = () => undefined;
    const off = vi.fn();
    sdk.bridge.onDataChange = vi.fn((cb: Handler) => {
      emit = cb;
      return off;
    });
    const cb = vi.fn();
    const unsubscribe = adapter.onConfigChange(cb);
    emit({ data: { keys: ['other-key'] } });
    expect(cb).not.toHaveBeenCalled();
    emit({ data: { keys: ['pipeline-config'] } });
    emit({ data: { keys: [] } });
    emit({ data: {} });
    expect(cb).toHaveBeenCalledTimes(3);
    unsubscribe();
    unsubscribe();
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('maps record events and unsubscribes all of them at once', async () => {
    const { table, handlers, offs } = fakeTable();
    const { adapter } = await larkWith(table);
    const events: RecordsChangeEvent[] = [];
    const unsubscribe = adapter.onRecordsChange((e) => events.push(e));
    handlers.add({ data: ['recA', 'recB'] });
    handlers.modify({ data: { recordId: 'recC', fieldIds: ['f1'] } });
    handlers.delete({ data: ['recD'] });
    expect(events).toEqual([
      { type: 'add', recordIds: ['recA', 'recB'] },
      { type: 'modify', recordIds: ['recC'] },
      { type: 'delete', recordIds: ['recD'] },
    ]);
    unsubscribe();
    expect(offs.add).toHaveBeenCalledTimes(1);
    expect(offs.modify).toHaveBeenCalledTimes(1);
    expect(offs.delete).toHaveBeenCalledTimes(1);
    expect(eventRecordIds('recX')).toEqual(['recX']);
    expect(eventRecordIds({ recordIds: ['a', 1] })).toEqual(['a']);
  });

  it('builds the option palette from the host and falls back when empty', async () => {
    const { table } = fakeTable();
    const { adapter } = await larkWith(table);
    sdk.ui.getSelectOptionColorInfoList = vi.fn(async () => [
      { id: 1, bgColor: '#111111', textColor: '#eeeeee', iconColor: '', iconAltColor: '' },
      { id: 0, bgColor: '#000000', textColor: '#ffffff', iconColor: '', iconAltColor: '' },
    ]);
    const colors = await adapter.getOptionColors();
    expect(colors[0]).toEqual({ bg: '#000000', text: '#ffffff' });
    expect(colors[1]).toEqual({ bg: '#111111', text: '#eeeeee' });
    expect(colors[2]).toEqual(FALLBACK_OPTION_COLORS[2]);
    sdk.ui.getSelectOptionColorInfoList = vi.fn().mockRejectedValue(new Error('x'));
    await expect(adapter.getOptionColors()).resolves.toBe(FALLBACK_OPTION_COLORS);
    expect(toOptionColors([])).toBe(FALLBACK_OPTION_COLORS);
  });

  it('opens the host editor with the view id, else the record card', async () => {
    const { table } = fakeTable();
    const { adapter } = await larkWith(table);
    sdk.ui.showFieldValueEditor = vi.fn(async () => true);
    sdk.ui.showRecordDetailDialog = vi.fn(async () => true);
    await adapter.editField('rec1', 'fldName00001');
    expect(sdk.ui.showFieldValueEditor).toHaveBeenCalledWith({
      tableId: 'tblFake0000001',
      viewId: 'vewPipe00001',
      recordId: 'rec1',
      fieldId: 'fldName00001',
    });
    const noView = await larkWith(table, { tableId: 'tblFake0000001', viewId: null });
    await noView.adapter.editField('rec1', 'fldName00001');
    expect(sdk.ui.showRecordDetailDialog).toHaveBeenCalledWith({ tableId: 'tblFake0000001', recordId: 'rec1', fieldIdList: ['fldName00001'] });
    await noView.adapter.openRecord('rec2');
    expect(sdk.ui.showRecordDetailDialog).toHaveBeenLastCalledWith({ tableId: 'tblFake0000001', recordId: 'rec2' });
  });

  it('addSelectOption returns the id of the newly added option', async () => {
    const options = [{ id: 'optOld', name: 'Old', color: 0 }];
    const field = {
      getOptions: vi.fn(async () => [...options]),
      addOption: vi.fn(async (name: string, color?: number) => {
        options.push({ id: 'optNew', name, color: color ?? 1 });
        return 'fldStage0001';
      }),
    };
    const { table } = fakeTable({ getFieldById: vi.fn(async () => field) });
    const { adapter } = await larkWith(table);
    await expect(adapter.addSelectOption('fldStage0001', 'New', 4)).resolves.toBe('optNew');
    expect(field.addOption).toHaveBeenCalledWith('New', 4);
  });

  it('addField sends select options and retries DateTime without a format', async () => {
    const addField = vi.fn().mockRejectedValueOnce(new Error('bad property')).mockResolvedValue('fldDate00001');
    const { table } = fakeTable({ addField });
    const { adapter } = await larkWith(table);
    await expect(adapter.addField({ name: 'Entered at', type: FieldType.DateTime })).resolves.toBe('fldDate00001');
    expect(addField.mock.calls[0][0]).toEqual({ name: 'Entered at', type: FieldType.DateTime, property: { dateFormat: 'yyyy/MM/dd HH:mm' } });
    expect(addField.mock.calls[1][0]).toEqual({ name: 'Entered at', type: FieldType.DateTime });
    await adapter.addField({ name: 'Stage', type: FieldType.SingleSelect, options: [{ name: 'A' }, { name: 'B', color: 3 }] });
    expect(addField.mock.calls[2][0]).toEqual({
      name: 'Stage',
      type: FieldType.SingleSelect,
      property: { options: [{ name: 'A' }, { name: 'B', color: 3 }] },
    });
  });
});
