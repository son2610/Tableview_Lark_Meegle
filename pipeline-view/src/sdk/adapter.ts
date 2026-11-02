import type {
  CellValue,
  FieldMeta,
  FieldType,
  FieldsPatch,
  Lang,
  OptionColor,
  RecordData,
  TableInfo,
  ThemeMode,
  ViewInfo,
} from '../types';

export type Unsubscribe = () => void;

export interface RecordsChangeEvent {
  type: 'add' | 'modify' | 'delete';
  recordIds: string[];
}

export interface AddFieldConfig {
  name: string;
  type: FieldType;
  /** For SingleSelect / MultiSelect. */
  options?: { name: string; color?: number }[];
}

/**
 * Thin boundary between the app and the host. `larkAdapter` wraps
 * `@lark-opdev/block-bitable-api`; `mock/mockAdapter` is an in-memory fake used
 * by `npm run demo` and by tests. Everything is scoped to ONE table: the table
 * that hosts the pipeline view.
 *
 * Methods that write must throw an Error with a readable message on failure.
 */
export interface BaseAdapter {
  readonly kind: 'lark' | 'mock';

  /** Resolve the host table (and this view's id, when available). Must be called first. */
  init(): Promise<{ table: TableInfo; viewId: string | null }>;

  getLanguage(): Promise<Lang>;
  getTheme(): Promise<ThemeMode>;
  onThemeChange(cb: (theme: ThemeMode) => void): Unsubscribe;
  /** Whether the current user may edit records / the view configuration. */
  isEditable(): Promise<boolean>;

  getFields(): Promise<FieldMeta[]>;
  getViews(): Promise<ViewInfo[]>;
  /** Load every record (paginated internally). With viewId, use that view's filter + order. */
  getAllRecords(opts?: { viewId?: string; onProgress?: (loaded: number) => void }): Promise<RecordData[]>;
  /** Fresh copy of one record, or null when it no longer exists. */
  getRecord(recordId: string): Promise<RecordData | null>;
  /** Write several cells of one record in a single call. `null` clears a cell. */
  setRecord(recordId: string, fields: FieldsPatch): Promise<void>;
  setCell(recordId: string, fieldId: string, value: CellValue): Promise<void>;

  /** Create a field in the host table; returns the new field id. */
  addField(config: AddFieldConfig): Promise<string>;
  /** Append an option to a select field; returns the new option id. */
  addSelectOption(fieldId: string, name: string, color?: number): Promise<string>;

  /** Raw stored config (unvalidated) or null when never saved. */
  loadConfig(): Promise<unknown | null>;
  saveConfig(config: unknown): Promise<void>;
  /** Fires when the stored config changes (e.g. another collaborator saved settings). */
  onConfigChange(cb: () => void): Unsubscribe;

  onRecordsChange(cb: (e: RecordsChangeEvent) => void): Unsubscribe;
  /** Fires on field add / delete / modify (including option changes). */
  onFieldsChange(cb: () => void): Unsubscribe;

  /** Palette for select option colors, index = color id. Never rejects (falls back to a built-in palette). */
  getOptionColors(): Promise<OptionColor[]>;

  /** Open the host's record card, optionally limited to the given fields. */
  openRecord(recordId: string, fieldIds?: string[]): Promise<void>;
  /** Open the host's cell editor for one field of one record. */
  editField(recordId: string, fieldId: string, viewId?: string | null): Promise<void>;
}
