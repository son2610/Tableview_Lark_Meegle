import {
  bitable,
  DateFormatter,
  OperationType,
  PermissionEntity,
  type IAddFieldConfig,
  type IFieldMeta,
  type IOpenCellValue,
  type ISelectOptionColor,
  type ISingleSelectField,
  type ITable,
} from '@lark-opdev/block-bitable-api';
import { FieldType } from '../types';
import type {
  CellValue,
  FieldMeta,
  FieldsPatch,
  Lang,
  OptionColor,
  RecordData,
  SelectOption,
  TableInfo,
  ThemeMode,
  ViewInfo,
} from '../types';
import type { AddFieldConfig, BaseAdapter, RecordsChangeEvent, Unsubscribe } from './adapter';
import { FALLBACK_OPTION_COLORS } from './palette';

/** bridge storage key of the pipeline config (scoped to this view instance by the host). */
export const CONFIG_KEY = 'pipeline-config';

const PAGE_SIZE = 5000;
const FALLBACK_CONCURRENCY = 50;

/* ------------------------------------------------------------------ */
/* SDK-boundary helpers                                                */
/* ------------------------------------------------------------------ */

type Loose = { [key: string]: unknown };

function isObject(v: unknown): v is Loose {
  return typeof v === 'object' && v !== null;
}

/** Lark error codes are 102 + scope(2 digits) + detail(3 digits), e.g. 10214997. */
function describeCode(code: number): string {
  const detail = code % 1000;
  switch (detail) {
    case 997:
      return 'permission denied';
    case 998:
      return 'not found';
    case 995:
      return 'name already exists';
    case 994:
      return 'limit exceeded';
    case 992:
      return 'invalid parameter';
    case 991:
      return 'unsupported type';
    default:
      return 'unknown error';
  }
}

/** Readable text for anything the SDK may throw (OpenError, transferable error object, string). */
export function sdkErrorMessage(e: unknown): string {
  let message = '';
  let code: number | string | undefined;
  if (typeof e === 'string') message = e;
  else if (isObject(e)) {
    if (typeof e.message === 'string') message = e.message;
    else if (typeof e.msg === 'string') message = e.msg;
    if (typeof e.code === 'number' || typeof e.code === 'string') code = e.code;
  }
  const numericCode = typeof code === 'number' ? code : Number(code);
  if (!message) message = Number.isFinite(numericCode) ? describeCode(numericCode) : 'unknown error';
  return code !== undefined && code !== '' ? `${message} (code ${code})` : message;
}

function wrapError(action: string, e: unknown): Error {
  return new Error(`${action}: ${sdkErrorMessage(e)}`);
}

/** True when the host does not implement an API (older Lark clients). */
function isMissingApi(e: unknown): boolean {
  const message = sdkErrorMessage(e);
  if (/not a function|not registered|not implemented|not support|unknown method/i.test(message)) return true;
  const code = isObject(e) ? Number(e.code) : NaN;
  if (!Number.isFinite(code)) return false;
  const scope = Math.floor(code / 1000) % 100;
  return scope >= 89 && code % 1000 === 997; // open-platform scope "HostNotRegistered"
}

function isNotFound(e: unknown): boolean {
  const code = isObject(e) ? Number(e.code) : NaN;
  if (Number.isFinite(code) && code % 1000 === 998) return true;
  return /not found|not exist/i.test(sdkErrorMessage(e));
}

function toLang(value: unknown): Lang {
  return String(value ?? '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function toTheme(value: unknown): ThemeMode {
  return String(value ?? '').toUpperCase() === 'DARK' ? 'dark' : 'light';
}

function toSelectOptions(raw: unknown): SelectOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(isObject).map((o) => ({
    id: String(o.id ?? ''),
    name: String(o.name ?? ''),
    color: typeof o.color === 'number' ? o.color : 0,
  }));
}

function isSelectType(type: number): boolean {
  return type === FieldType.SingleSelect || type === FieldType.MultiSelect;
}

function toFieldMeta(meta: IFieldMeta): FieldMeta {
  const property = (meta as { property?: unknown }).property;
  const type = meta.type as number as FieldType;
  const field: FieldMeta = { id: meta.id, name: meta.name, type, isPrimary: !!meta.isPrimary, property };
  if (isSelectType(type)) field.options = toSelectOptions(isObject(property) ? property.options : undefined) ?? [];
  return field;
}

/** Record ids from a RecordAdd / RecordDelete / RecordModify payload, whatever its exact shape. */
export function eventRecordIds(data: unknown): string[] {
  if (typeof data === 'string') return [data];
  if (Array.isArray(data)) return data.flatMap(eventRecordIds);
  if (isObject(data)) {
    if (typeof data.recordId === 'string') return [data.recordId];
    if (Array.isArray(data.recordIds)) return data.recordIds.filter((id): id is string => typeof id === 'string');
  }
  return [];
}

/** Palette indexed by color id; holes and missing ids are filled from the fallback palette. */
export function toOptionColors(list: ISelectOptionColor[] | null | undefined): OptionColor[] {
  if (!Array.isArray(list) || list.length === 0) return FALLBACK_OPTION_COLORS;
  const sorted = [...list].filter((c) => typeof c?.id === 'number').sort((a, b) => a.id - b.id);
  if (sorted.length === 0) return FALLBACK_OPTION_COLORS;
  const size = Math.max(FALLBACK_OPTION_COLORS.length, sorted[sorted.length - 1].id + 1);
  const colors: OptionColor[] = [];
  for (let i = 0; i < size; i++) colors.push(FALLBACK_OPTION_COLORS[i % FALLBACK_OPTION_COLORS.length]);
  for (const c of sorted) {
    if (c.bgColor && c.textColor) colors[c.id] = { bg: c.bgColor, text: c.textColor };
  }
  return colors;
}

function combine(unsubscribers: (() => void)[]): Unsubscribe {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const off of unsubscribers) {
      try {
        off();
      } catch {
        /* host already gone */
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

class LarkAdapter implements BaseAdapter {
  readonly kind = 'lark' as const;
  private table: ITable | null = null;
  private tableId = '';
  private viewId: string | null = null;

  private requireTable(): ITable {
    if (!this.table) throw new Error('Lark adapter used before init()');
    return this.table;
  }

  async init(): Promise<{ table: TableInfo; viewId: string | null }> {
    try {
      const selection = await bitable.base.getSelection();
      const table = selection?.tableId
        ? await bitable.base.getTableById(selection.tableId)
        : await bitable.base.getActiveTable();
      this.table = table;
      this.tableId = selection?.tableId ?? table.id;
      this.viewId = selection?.viewId ?? null;
      return { table: { id: this.tableId, name: await this.readTableName(table) }, viewId: this.viewId };
    } catch (e) {
      throw wrapError('Cannot open the current table', e);
    }
  }

  private async readTableName(table: ITable): Promise<string> {
    try {
      const name = await table.getName();
      if (name) return name;
    } catch {
      /* fall through */
    }
    try {
      return (await table.getMeta()).name ?? '';
    } catch {
      return '';
    }
  }

  async getLanguage(): Promise<Lang> {
    try {
      return toLang(await bitable.bridge.getLanguage());
    } catch {
      try {
        return toLang(await bitable.bridge.getLocale());
      } catch {
        return 'en';
      }
    }
  }

  async getTheme(): Promise<ThemeMode> {
    try {
      return toTheme(await bitable.bridge.getTheme());
    } catch {
      return 'light';
    }
  }

  onThemeChange(cb: (theme: ThemeMode) => void): Unsubscribe {
    return combine([bitable.bridge.onThemeChange((ev) => cb(toTheme(ev?.data?.theme)))]);
  }

  async isEditable(): Promise<boolean> {
    try {
      const allowed: unknown = await bitable.base.getPermission({
        entity: PermissionEntity.Table,
        type: OperationType.Editable,
        param: { tableId: this.tableId || undefined },
      });
      if (typeof allowed === 'boolean') return allowed;
    } catch {
      /* older hosts: fall back below */
    }
    try {
      return (await bitable.base.isEditable()) === true;
    } catch {
      return false;
    }
  }

  async getFields(): Promise<FieldMeta[]> {
    const table = this.requireTable();
    let metas: IFieldMeta[];
    try {
      metas = await table.getFieldMetaList();
    } catch (e) {
      throw wrapError('Cannot read fields', e);
    }
    const fields = metas.map(toFieldMeta);
    // Some hosts omit property.options; read them from the field object instead.
    await Promise.all(
      fields
        .filter((f) => isSelectType(f.type) && (!f.options || f.options.length === 0))
        .map(async (f) => {
          try {
            const field = await table.getFieldById<ISingleSelectField>(f.id);
            f.options = toSelectOptions(await field.getOptions()) ?? [];
          } catch {
            f.options = f.options ?? [];
          }
        }),
    );
    return fields;
  }

  async getViews(): Promise<ViewInfo[]> {
    try {
      const metas = await this.requireTable().getViewMetaList();
      return metas.map((m) => ({ id: m.id, name: m.name, type: Number(m.type) }));
    } catch (e) {
      throw wrapError('Cannot read views', e);
    }
  }

  async getAllRecords(opts?: { viewId?: string; onProgress?: (loaded: number) => void }): Promise<RecordData[]> {
    const table = this.requireTable();
    if (typeof table.getRecords !== 'function') return this.getAllRecordsById(table, opts);
    try {
      return await this.getAllRecordsPaged(table, opts);
    } catch (e) {
      if (isMissingApi(e)) return this.getAllRecordsById(table, opts);
      throw wrapError('Cannot read records', e);
    }
  }

  private async getAllRecordsPaged(
    table: ITable,
    opts?: { viewId?: string; onProgress?: (loaded: number) => void },
  ): Promise<RecordData[]> {
    const records: RecordData[] = [];
    const seenTokens = new Set<string>();
    let pageToken: string | undefined;
    for (;;) {
      const page = await table.getRecords({ pageSize: PAGE_SIZE, pageToken, viewId: opts?.viewId || undefined });
      for (const r of page?.records ?? []) records.push({ id: r.recordId, fields: r.fields ?? {} });
      opts?.onProgress?.(records.length);
      const next = page?.pageToken;
      if (!page?.hasMore || !next || seenTokens.has(next)) break;
      seenTokens.add(next);
      pageToken = next;
    }
    return records;
  }

  /** Slow path for hosts without `getRecords`: ids first, then records in concurrent chunks. */
  private async getAllRecordsById(
    table: ITable,
    opts?: { viewId?: string; onProgress?: (loaded: number) => void },
  ): Promise<RecordData[]> {
    try {
      let ids: string[];
      if (opts?.viewId) {
        const view = await table.getViewById(opts.viewId);
        ids = (await view.getVisibleRecordIdList()).filter((id): id is string => typeof id === 'string');
      } else {
        ids = await table.getRecordIdList();
      }
      const records: RecordData[] = [];
      for (let i = 0; i < ids.length; i += FALLBACK_CONCURRENCY) {
        const chunk = await Promise.all(
          ids.slice(i, i + FALLBACK_CONCURRENCY).map(async (id) => {
            const value = await table.getRecordById(id);
            return { id, fields: value?.fields ?? {} };
          }),
        );
        records.push(...chunk);
        opts?.onProgress?.(records.length);
      }
      if (ids.length === 0) opts?.onProgress?.(0);
      return records;
    } catch (e) {
      throw wrapError('Cannot read records', e);
    }
  }

  async getRecord(recordId: string): Promise<RecordData | null> {
    try {
      const value = await this.requireTable().getRecordById(recordId);
      if (!value) return null;
      return { id: recordId, fields: value.fields ?? {} };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw wrapError('Cannot read record', e);
    }
  }

  async setRecord(recordId: string, fields: FieldsPatch): Promise<void> {
    const table = this.requireTable();
    try {
      await table.setRecord(recordId, { fields: fields as Record<string, IOpenCellValue> });
    } catch (e) {
      throw wrapError('Cannot update record', e);
    }
  }

  async setCell(recordId: string, fieldId: string, value: CellValue): Promise<void> {
    const table = this.requireTable();
    let ok: boolean;
    try {
      ok = await table.setCellValue(fieldId, recordId, value as IOpenCellValue);
    } catch (e) {
      throw wrapError('Cannot update cell', e);
    }
    if (ok === false) throw new Error('Cannot update cell: the host rejected the value');
  }

  async addField(config: AddFieldConfig): Promise<string> {
    const table = this.requireTable();
    const base: Loose = { name: config.name, type: config.type };
    if (isSelectType(config.type)) {
      base.property = {
        options: (config.options ?? []).map((o) => (o.color === undefined ? { name: o.name } : { name: o.name, color: o.color })),
      };
    }
    const attempts: Loose[] = [base];
    // Prefer date + time display for timestamps the plugin writes; retry plain if the host refuses it.
    if (config.type === FieldType.DateTime) attempts.unshift({ ...base, property: { dateFormat: DateFormatter.DATE_TIME } });
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await table.addField(attempt as unknown as IAddFieldConfig);
      } catch (e) {
        lastError = e;
      }
    }
    throw wrapError(`Cannot create field "${config.name}"`, lastError);
  }

  async addSelectOption(fieldId: string, name: string, color?: number): Promise<string> {
    const table = this.requireTable();
    try {
      const field = await table.getFieldById<ISingleSelectField>(fieldId);
      const before = new Set((await field.getOptions()).map((o) => o.id));
      await field.addOption(name, color);
      const after = await field.getOptions();
      const added =
        after.find((o) => !before.has(o.id) && o.name === name) ??
        after.find((o) => !before.has(o.id)) ??
        [...after].reverse().find((o) => o.name === name);
      if (!added) throw new Error('option was added but could not be found');
      return added.id;
    } catch (e) {
      throw wrapError(`Cannot add option "${name}"`, e);
    }
  }

  /** null only when nothing is stored: a failed read must not look like "never configured". */
  async loadConfig(): Promise<unknown | null> {
    try {
      const value = await bitable.bridge.getData<unknown>(CONFIG_KEY);
      return value ?? null;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw wrapError('Cannot read the pipeline settings', e);
    }
  }

  async saveConfig(config: unknown): Promise<void> {
    let ok: boolean;
    try {
      // JSON round trip: the bridge needs plain serializable data.
      ok = await bitable.bridge.setData(CONFIG_KEY, JSON.parse(JSON.stringify(config ?? null)));
    } catch (e) {
      throw wrapError('Cannot save the pipeline settings', e);
    }
    if (ok === false) throw new Error('Cannot save the pipeline settings: the host rejected the request');
  }

  onConfigChange(cb: () => void): Unsubscribe {
    return combine([
      bitable.bridge.onDataChange((ev) => {
        const keys = ev?.data?.keys;
        if (!Array.isArray(keys) || keys.length === 0 || keys.includes(CONFIG_KEY)) cb();
      }),
    ]);
  }

  onRecordsChange(cb: (e: RecordsChangeEvent) => void): Unsubscribe {
    const table = this.requireTable();
    return combine([
      table.onRecordAdd((ev) => cb({ type: 'add', recordIds: eventRecordIds(ev?.data) })),
      table.onRecordModify((ev) => cb({ type: 'modify', recordIds: eventRecordIds(ev?.data) })),
      table.onRecordDelete((ev) => cb({ type: 'delete', recordIds: eventRecordIds(ev?.data) })),
    ]);
  }

  onFieldsChange(cb: () => void): Unsubscribe {
    const table = this.requireTable();
    const notify = () => cb();
    return combine([table.onFieldAdd(notify), table.onFieldDelete(notify), table.onFieldModify(notify)]);
  }

  async getOptionColors(): Promise<OptionColor[]> {
    try {
      return toOptionColors(await bitable.ui.getSelectOptionColorInfoList());
    } catch {
      return FALLBACK_OPTION_COLORS;
    }
  }

  async openRecord(recordId: string, fieldIds?: string[]): Promise<void> {
    const params: { tableId: string; recordId: string; fieldIdList?: string[] } = { tableId: this.tableId, recordId };
    if (fieldIds && fieldIds.length > 0) params.fieldIdList = fieldIds;
    try {
      await bitable.ui.showRecordDetailDialog(params);
    } catch (e) {
      throw wrapError('Cannot open the record', e);
    }
  }

  async editField(recordId: string, fieldId: string, viewId?: string | null): Promise<void> {
    const targetView = viewId ?? this.viewId;
    if (targetView) {
      try {
        const shown = await bitable.ui.showFieldValueEditor({ tableId: this.tableId, viewId: targetView, recordId, fieldId });
        if (shown !== false) return;
      } catch {
        /* the record may be hidden in that view: use the record card instead */
      }
    }
    await this.openRecord(recordId, [fieldId]);
  }
}

export function createLarkAdapter(): BaseAdapter {
  return new LarkAdapter();
}
