/**
 * In-memory BaseAdapter for `npm run demo` and tests. Behaves like the Lark host
 * where it matters to the app: async calls with latency, writes validated
 * against the schema, change events delivered asynchronously after a write,
 * config persisted per browser (localStorage) and shared across tabs.
 *
 * URL params (DESIGN.md §4.1): preset=demo|none, readonly=1, theme=dark,
 * lang=en|vi, latency=<ms>, reset=1.
 */
import { FieldType } from '../../types';
import type { CellValue, FieldMeta, FieldsPatch, Lang, OptionColor, RecordData, SelectOption, TableInfo, ThemeMode, ViewInfo } from '../../types';
import type { AddFieldConfig, BaseAdapter, RecordsChangeEvent, Unsubscribe } from '../adapter';
import { FALLBACK_OPTION_COLORS } from '../palette';
import { formatMockCell, openHostDialog, type HostDialogField, type HostDialogLabels } from './hostDialog';
import { cloneDemoConfig, cloneMockData, MOCK_VIEW_FILTERS, type MockDataSet } from './mockData';

export const MOCK_CONFIG_STORAGE_KEY = 'pv-mock-config';

const DEFAULT_LATENCY = 120;
const RECORD_PAGE_SIZE = 6;

export interface MockOptions {
  preset: 'demo' | 'none';
  readonly: boolean;
  theme: ThemeMode;
  lang: Lang;
  /** Simulated host round trip in ms. */
  latency: number;
  /** Clear the stored mock config on start. */
  reset: boolean;
}

export interface MockAdapter extends BaseAdapter {
  readonly kind: 'mock';
  /** Live in-memory data (mutated by writes). */
  readonly data: MockDataSet;
  readonly options: MockOptions;
  /** Simulate the host switching between light and dark. */
  setTheme(theme: ThemeMode): void;
}

function flag(params: URLSearchParams, key: string): boolean {
  if (!params.has(key)) return false;
  const value = (params.get(key) ?? '').toLowerCase();
  return value !== '0' && value !== 'false';
}

export function parseMockOptions(params?: URLSearchParams): MockOptions {
  const p = params ?? new URLSearchParams();
  const latency = Number(p.get('latency'));
  return {
    preset: p.get('preset') === 'none' ? 'none' : 'demo',
    readonly: flag(p, 'readonly'),
    theme: p.get('theme') === 'dark' ? 'dark' : 'light',
    lang: p.get('lang') === 'en' ? 'en' : 'vi',
    latency: p.has('latency') && Number.isFinite(latency) && latency >= 0 ? latency : DEFAULT_LATENCY,
    reset: flag(p, 'reset'),
  };
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

class Emitter<T> {
  private listeners = new Set<(value: T) => void>();

  on(cb: (value: T) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(value);
      } catch (e) {
        console.error('[pv-mock] listener failed', e);
      }
    }
  }
}

const copy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

function localStore(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Stored config, or undefined when nothing is stored / storage is unavailable or corrupt. */
function readStoredConfig(): unknown | undefined {
  try {
    const raw = localStore()?.getItem(MOCK_CONFIG_STORAGE_KEY);
    return raw === null || raw === undefined ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeStoredConfig(value: unknown): void {
  try {
    localStore()?.setItem(MOCK_CONFIG_STORAGE_KEY, JSON.stringify(value ?? null));
  } catch {
    /* quota / privacy mode: keep the in-memory copy only */
  }
}

function clearStoredConfig(): void {
  try {
    localStore()?.removeItem(MOCK_CONFIG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomId(prefix: string, taken: (id: string) => boolean): string {
  for (;;) {
    let id = prefix;
    for (let i = 0; i < 7; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    if (!taken(id)) return id;
  }
}

/** First Lark color id not used by `options` (wraps when all 55 are taken). */
function nextColor(options: SelectOption[]): number {
  const used = new Set(options.map((o) => o.color));
  for (let c = 0; c < FALLBACK_OPTION_COLORS.length; c++) if (!used.has(c)) return c;
  return options.length % FALLBACK_OPTION_COLORS.length;
}

const COMPUTED_TYPES = new Set<FieldType>([
  FieldType.Formula,
  FieldType.Lookup,
  FieldType.CreatedTime,
  FieldType.ModifiedTime,
  FieldType.CreatedUser,
  FieldType.ModifiedUser,
  FieldType.AutoNumber,
]);

const DIALOG_LABELS: Record<Lang, HostDialogLabels> = {
  vi: {
    close: 'Đóng',
    save: 'Lưu',
    empty: 'Trống',
    invalidNumber: 'Giá trị phải là một số.',
    readOnlyHint: 'Bản demo: chỉ sửa trực tiếp được trường Văn bản và Số trong hộp thoại này.',
  },
  en: {
    close: 'Close',
    save: 'Save',
    empty: 'Empty',
    invalidNumber: 'The value must be a number.',
    readOnlyHint: 'Demo: only Text and Number fields can be edited in this dialog.',
  },
};

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

class InMemoryAdapter implements MockAdapter {
  readonly kind = 'mock' as const;
  readonly data: MockDataSet;
  readonly options: MockOptions;
  private theme: ThemeMode;
  /** Last saved config (mirrors localStorage when available); undefined = never saved. */
  private savedConfig: unknown | undefined;

  private readonly recordEvents = new Emitter<RecordsChangeEvent>();
  private readonly fieldEvents = new Emitter<void>();
  private readonly configEvents = new Emitter<void>();
  private readonly themeEvents = new Emitter<ThemeMode>();

  constructor(options: MockOptions) {
    this.options = options;
    this.theme = options.theme;
    this.data = cloneMockData();
    if (options.reset) clearStoredConfig();
    this.savedConfig = readStoredConfig();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key !== MOCK_CONFIG_STORAGE_KEY && e.key !== null) return;
        this.savedConfig = readStoredConfig();
        this.configEvents.emit();
      });
    }
  }

  /* -------------------------- plumbing --------------------------- */

  private wait(ms = this.options.latency): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  /** Deliver a host event after the simulated latency, like Lark does after a write. */
  private later(fn: () => void): void {
    setTimeout(fn, Math.max(0, this.options.latency));
  }

  private assertWritable(action: string): void {
    if (this.options.readonly) throw new Error(`${action}: permission denied (read-only demo)`);
  }

  private findRecord(recordId: string): RecordData {
    const record = this.data.records.find((r) => r.id === recordId);
    if (!record) throw new Error(`Record not found: ${recordId}`);
    return record;
  }

  private findField(fieldId: string): FieldMeta {
    const field = this.data.fields.find((f) => f.id === fieldId);
    if (!field) throw new Error(`Field not found: ${fieldId}`);
    return field;
  }

  private resolveOption(field: FieldMeta, raw: unknown): { id: string; text: string } {
    const options = field.options ?? [];
    let id: string | undefined;
    let name: string | undefined;
    if (typeof raw === 'string') name = raw;
    else if (typeof raw === 'object' && raw !== null) {
      const o = raw as { id?: unknown; text?: unknown; name?: unknown };
      if (typeof o.id === 'string') id = o.id;
      if (typeof o.text === 'string') name = o.text;
      else if (typeof o.name === 'string') name = o.name;
    }
    const found =
      (id !== undefined ? options.find((o) => o.id === id) : undefined) ??
      (name !== undefined ? options.find((o) => o.name === name || o.id === name) : undefined);
    if (!found) throw new Error(`Option "${name ?? id ?? String(raw)}" does not exist in field "${field.name}"`);
    return { id: found.id, text: found.name };
  }

  /** Coerce a written value into the stored IOpenCellValue shape; null clears the cell. */
  private normalizeValue(field: FieldMeta, value: CellValue): CellValue {
    if (value === null || value === undefined) return null;
    const invalid = () => new Error(`Invalid value for field "${field.name}"`);
    switch (field.type) {
      case FieldType.Text:
      case FieldType.Barcode:
        if (typeof value === 'string') return value === '' ? null : [{ type: 'text', text: value }];
        if (Array.isArray(value)) return value.length === 0 ? null : value;
        throw invalid();
      case FieldType.Email:
        // IEmailField is a plain string in SDK 0.4.0 (its transform is the identity).
        if (typeof value === 'string') return value === '' ? null : value;
        throw invalid();
      case FieldType.Number:
      case FieldType.Currency:
      case FieldType.Progress:
      case FieldType.Rating: {
        const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
        if (typeof n === 'number' && Number.isFinite(n)) return n;
        throw invalid();
      }
      case FieldType.SingleSelect: {
        const raw = Array.isArray(value) ? value[0] : value;
        return raw === undefined ? null : this.resolveOption(field, raw);
      }
      case FieldType.MultiSelect: {
        const list = (Array.isArray(value) ? value : [value]).map((v) => this.resolveOption(field, v));
        return list.length === 0 ? null : list;
      }
      case FieldType.DateTime:
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        throw invalid();
      case FieldType.Checkbox:
        if (typeof value === 'boolean') return value;
        throw invalid();
      case FieldType.User:
        if (!Array.isArray(value)) throw invalid();
        return value.length === 0
          ? null
          : value.map((u) => {
              const id = typeof u === 'object' && u !== null ? (u as { id?: unknown }).id : undefined;
              if (typeof id !== 'string') throw invalid();
              return { ...(this.data.users.find((user) => user.id === id) ?? {}), ...(u as object) };
            });
      case FieldType.Url:
        if (typeof value === 'string') return value === '' ? null : [{ type: 'url', text: value, link: value }];
        if (Array.isArray(value)) return value.length === 0 ? null : value;
        throw invalid();
      default:
        return value;
    }
  }

  /* --------------------------- context --------------------------- */

  async init(): Promise<{ table: TableInfo; viewId: string | null }> {
    await this.wait();
    return { table: { ...this.data.table }, viewId: this.data.viewId };
  }

  async getLanguage(): Promise<Lang> {
    return this.options.lang;
  }

  async getTheme(): Promise<ThemeMode> {
    return this.theme;
  }

  onThemeChange(cb: (theme: ThemeMode) => void): Unsubscribe {
    return this.themeEvents.on(cb);
  }

  setTheme(theme: ThemeMode): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.themeEvents.emit(theme);
  }

  async isEditable(): Promise<boolean> {
    await this.wait(this.options.latency / 2);
    return !this.options.readonly;
  }

  /* ---------------------------- reads ---------------------------- */

  async getFields(): Promise<FieldMeta[]> {
    await this.wait();
    return copy(this.data.fields);
  }

  async getViews(): Promise<ViewInfo[]> {
    await this.wait(this.options.latency / 2);
    return copy(this.data.views);
  }

  async getAllRecords(opts?: { viewId?: string; onProgress?: (loaded: number) => void }): Promise<RecordData[]> {
    const viewId = opts?.viewId;
    if (viewId && !this.data.views.some((v) => v.id === viewId)) {
      await this.wait();
      throw new Error(`View not found: ${viewId}`);
    }
    const filter = viewId ? MOCK_VIEW_FILTERS[viewId] : undefined;
    const rows = this.data.records.filter((r) => !filter || filter(r));
    const out: RecordData[] = [];
    if (rows.length === 0) {
      await this.wait();
      opts?.onProgress?.(0);
      return out;
    }
    for (let i = 0; i < rows.length; i += RECORD_PAGE_SIZE) {
      await this.wait(this.options.latency / 2);
      out.push(...copy(rows.slice(i, i + RECORD_PAGE_SIZE)));
      opts?.onProgress?.(out.length);
    }
    return out;
  }

  async getRecord(recordId: string): Promise<RecordData | null> {
    await this.wait(this.options.latency / 2);
    const record = this.data.records.find((r) => r.id === recordId);
    return record ? copy(record) : null;
  }

  /* ---------------------------- writes --------------------------- */

  async setRecord(recordId: string, fields: FieldsPatch): Promise<void> {
    await this.wait();
    this.assertWritable('Cannot update record');
    const record = this.findRecord(recordId);
    // Validate everything first so a bad cell leaves the record untouched (the host writes atomically).
    const updates = Object.entries(fields).map(([fieldId, value]) => {
      const field = this.findField(fieldId);
      if (COMPUTED_TYPES.has(field.type)) throw new Error(`Field "${field.name}" is computed and cannot be edited`);
      return [fieldId, this.normalizeValue(field, value)] as const;
    });
    for (const [fieldId, value] of updates) {
      if (value === null) delete record.fields[fieldId];
      else record.fields[fieldId] = copy(value);
    }
    if (updates.length > 0) this.later(() => this.recordEvents.emit({ type: 'modify', recordIds: [recordId] }));
  }

  async setCell(recordId: string, fieldId: string, value: CellValue): Promise<void> {
    await this.setRecord(recordId, { [fieldId]: value });
  }

  async addField(config: AddFieldConfig): Promise<string> {
    await this.wait();
    this.assertWritable('Cannot create field');
    const name = (config.name ?? '').trim();
    if (!name) throw new Error('Cannot create field: the name is empty');
    if (this.data.fields.some((f) => f.name === name)) throw new Error(`Cannot create field: "${name}" already exists`);
    const taken = (id: string) => this.data.fields.some((f) => f.id === id || (f.options ?? []).some((o) => o.id === id));
    const field: FieldMeta = { id: randomId('fld', taken), name, type: config.type, isPrimary: false, property: null };
    if (config.type === FieldType.SingleSelect || config.type === FieldType.MultiSelect) {
      const options: SelectOption[] = [];
      for (const o of config.options ?? []) {
        options.push({ id: randomId('opt', taken), name: o.name, color: o.color ?? nextColor(options) });
      }
      field.options = options;
      field.property = { options, optionsType: 0 };
    } else if (config.type === FieldType.DateTime) {
      field.property = { dateFormat: 'yyyy/MM/dd HH:mm', displayTimeZone: false, autoFill: false };
    }
    this.data.fields.push(field);
    this.later(() => this.fieldEvents.emit());
    return field.id;
  }

  async addSelectOption(fieldId: string, name: string, color?: number): Promise<string> {
    await this.wait();
    this.assertWritable('Cannot add option');
    const field = this.findField(fieldId);
    if (field.type !== FieldType.SingleSelect && field.type !== FieldType.MultiSelect) {
      throw new Error(`Cannot add option: field "${field.name}" is not a select field`);
    }
    const optionName = (name ?? '').trim();
    if (!optionName) throw new Error('Cannot add option: the name is empty');
    const options = field.options ?? [];
    if (options.some((o) => o.name === optionName)) throw new Error(`Cannot add option: "${optionName}" already exists`);
    const option: SelectOption = {
      id: randomId('opt', (id) => options.some((o) => o.id === id)),
      name: optionName,
      color: color ?? nextColor(options),
    };
    field.options = [...options, option];
    field.property = { ...(typeof field.property === 'object' && field.property ? field.property : {}), options: field.options };
    this.later(() => this.fieldEvents.emit());
    return option.id;
  }

  /* ---------------------------- config --------------------------- */

  async loadConfig(): Promise<unknown | null> {
    await this.wait(this.options.latency / 2);
    const stored = readStoredConfig();
    if (stored !== undefined) this.savedConfig = stored;
    if (this.savedConfig !== undefined) return copy(this.savedConfig);
    return this.options.preset === 'demo' ? cloneDemoConfig() : null;
  }

  async saveConfig(config: unknown): Promise<void> {
    await this.wait();
    this.assertWritable('Cannot save the pipeline settings');
    this.savedConfig = copy(config ?? null);
    writeStoredConfig(this.savedConfig);
    this.later(() => this.configEvents.emit());
  }

  onConfigChange(cb: () => void): Unsubscribe {
    return this.configEvents.on(cb);
  }

  /* ---------------------------- events --------------------------- */

  onRecordsChange(cb: (e: RecordsChangeEvent) => void): Unsubscribe {
    return this.recordEvents.on(cb);
  }

  onFieldsChange(cb: () => void): Unsubscribe {
    return this.fieldEvents.on(() => cb());
  }

  async getOptionColors(): Promise<OptionColor[]> {
    return FALLBACK_OPTION_COLORS.map((c) => ({ ...c }));
  }

  /* -------------------------- host UI ---------------------------- */

  private recordTitle(record: RecordData): string {
    const primary = this.data.fields.find((f) => f.isPrimary);
    return primary ? formatMockCell(primary, record.fields[primary.id]) : record.id;
  }

  async openRecord(recordId: string, fieldIds?: string[]): Promise<void> {
    await this.wait(this.options.latency / 2);
    const record = this.findRecord(recordId);
    const fields =
      fieldIds && fieldIds.length > 0
        ? fieldIds.map((id) => this.data.fields.find((f) => f.id === id)).filter((f): f is FieldMeta => !!f)
        : this.data.fields;
    openHostDialog({
      title: this.recordTitle(record),
      subtitle: this.data.table.name,
      fields: fields.map((f) => ({ id: f.id, name: f.name, text: formatMockCell(f, record.fields[f.id]) })),
      labels: DIALOG_LABELS[this.options.lang],
    });
  }

  async editField(recordId: string, fieldId: string): Promise<void> {
    await this.wait(this.options.latency / 2);
    const record = this.findRecord(recordId);
    const field = this.findField(fieldId);
    const input =
      this.options.readonly ? undefined : field.type === FieldType.Text ? 'text' : field.type === FieldType.Number ? 'number' : undefined;
    const dialogField: HostDialogField = { id: field.id, name: field.name, text: formatMockCell(field, record.fields[field.id]), input };
    openHostDialog({
      title: this.recordTitle(record),
      subtitle: this.data.table.name,
      fields: [dialogField],
      labels: DIALOG_LABELS[this.options.lang],
      onSave: this.options.readonly
        ? undefined
        : async (id, raw) => {
            const trimmed = raw.trim();
            const value = field.type === FieldType.Number ? (trimmed === '' ? null : Number(trimmed)) : raw === '' ? null : raw;
            await this.setCell(recordId, id, value);
          },
    });
  }
}

export function createMockAdapter(params?: URLSearchParams): MockAdapter {
  const search = params ?? (typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : undefined);
  const adapter = new InMemoryAdapter(parseMockOptions(search));
  if (typeof window !== 'undefined') {
    (window as unknown as { __pvMock?: unknown }).__pvMock = { adapter, data: adapter.data };
  }
  return adapter;
}
