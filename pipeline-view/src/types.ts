/**
 * Shared, SDK-agnostic domain types.
 *
 * Core logic (src/core) and UI depend only on these types, never on
 * `@lark-opdev/block-bitable-api` directly. The Lark adapter converts SDK
 * shapes into these; the mock adapter produces them natively.
 */

/** Numeric values are identical to the SDK's `FieldType` enum. */
export enum FieldType {
  NotSupport = 0,
  Text = 1,
  Number = 2,
  SingleSelect = 3,
  MultiSelect = 4,
  DateTime = 5,
  Checkbox = 7,
  User = 11,
  Phone = 13,
  Url = 15,
  Attachment = 17,
  SingleLink = 18,
  Lookup = 19,
  Formula = 20,
  DuplexLink = 21,
  Location = 22,
  GroupChat = 23,
  Denied = 403,
  CreatedTime = 1001,
  ModifiedTime = 1002,
  CreatedUser = 1003,
  ModifiedUser = 1004,
  AutoNumber = 1005,
  Barcode = 99001,
  Progress = 99002,
  Currency = 99003,
  Rating = 99004,
  Email = 99005,
}

export interface SelectOption {
  id: string;
  name: string;
  /** Lark option color index (0..54). */
  color: number;
}

export interface FieldMeta {
  id: string;
  name: string;
  type: FieldType;
  isPrimary: boolean;
  /** Present for SingleSelect / MultiSelect, in the field's option order. */
  options?: SelectOption[];
  /** Raw SDK property, passed through for type-specific details (e.g. date format). */
  property?: unknown;
}

/**
 * Raw cell value in the SDK's IOpenCellValue shape:
 * - Text/Barcode: `{type:'text'|'url'|'mention', text, link?}[]`
 * - Email: string
 * - Number/Currency/Progress/Rating: number
 * - SingleSelect: `{id, text}`; MultiSelect: `{id, text}[]`
 * - DateTime/CreatedTime/ModifiedTime: ms timestamp number
 * - Checkbox: boolean
 * - User/CreatedUser/ModifiedUser: `{id, name?, enName?, email?}[]`
 * - Phone: string
 * - Url: `{type:'url', text, link}[]`
 * - Attachment: `{name, size, type, token, timeStamp}[]`
 * - SingleLink/DuplexLink: `{text, type, recordIds, tableId}`
 * - AutoNumber: `{value: string, status}`
 * - Location: `{address, name, fullAddress, location, ...}`
 * - GroupChat: `{id, name, avatarUrl}[]`
 * - Lookup/Formula: arrays of the above, number, string or segments
 * Empty cells are `null` or `undefined`.
 */
export type CellValue = unknown;

export interface RecordData {
  id: string;
  /** fieldId -> raw cell value. Missing key == empty. */
  fields: Record<string, CellValue>;
}

export interface TableInfo {
  id: string;
  name: string;
}

export interface ViewInfo {
  id: string;
  name: string;
  /** SDK ViewType: 1 Grid, 2 Kanban, 3 Form, 4 Gallery, 5 Gantt, 6 Hierarchy, 7 Calendar, 100 Widget */
  type: number;
}

export type ThemeMode = 'light' | 'dark';
export type Lang = 'vi' | 'en';

/** Resolved colors for a Lark select-option color index. */
export interface OptionColor {
  bg: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* Persisted configuration (one per pipeline view instance)            */
/* ------------------------------------------------------------------ */

export type StatusCategory = 'todo' | 'doing' | 'done' | 'blocked';

export interface NodeFieldRule {
  fieldId: string;
  /** Must be non-empty (checkbox: checked) before the record may leave this node. */
  required: boolean;
}

export interface NodeConfig {
  /** Fields to fill in at this node, in display order. */
  fields: NodeFieldRule[];
  /** Optional User field that represents this node's owner(s). */
  ownerFieldId?: string;
  /** Status option set when a record enters this node. Falls back to config.defaultEntryStatusId. */
  entryStatusId?: string;
  /** Free-text guidance shown in the node panel. */
  description?: string;
}

/** Directed edge between two stage option ids (forward transition). */
export interface Edge {
  from: string;
  to: string;
}

export const CONFIG_VERSION = 1 as const;

export interface PipelineConfig {
  version: typeof CONFIG_VERSION;
  /** Field shown as the record title. Defaults to the primary field. */
  titleFieldId?: string;
  /** SingleSelect field whose options are the pipeline nodes and whose value is the current node. */
  stageFieldId?: string;
  /** Optional SingleSelect field: status of the record at its current node. */
  statusFieldId?: string;
  /** Optional DateTime field the plugin stamps with "now" whenever the stage changes. */
  enteredAtFieldId?: string;
  /** Optional Text field the plugin appends a transition log line to on every stage change. */
  historyFieldId?: string;
  /** Optional Grid view whose filter/sort defines which records are shown. Empty = all records. */
  sourceViewId?: string;
  /** statusOptionId -> category. */
  statusCategories: Record<string, StatusCategory>;
  /** Status set on entering any node without its own entryStatusId. */
  defaultEntryStatusId?: string;
  /** When true, the current status must be in category 'done' before advancing. */
  requireDoneToAdvance: boolean;
  /** When true, a record can be sent back to an earlier (ancestor) node. */
  allowRollback: boolean;
  /** stageOptionId -> node config. Every stage option has an entry after normalization. */
  nodes: Record<string, NodeConfig>;
  /** Forward edges. `null` means "linear, following the stage field's option order". */
  edges: Edge[] | null;
  /** User fields shown as role chips in the record header (like Meegle roles). */
  roleFieldIds: string[];
  /** Checkbox fields shown as a toggleable checklist in the record header. */
  checklistFieldIds: string[];
  /** Extra fields shown under the title in the record list. */
  listFieldIds: string[];
}

/* ------------------------------------------------------------------ */
/* Graph & layout                                                      */
/* ------------------------------------------------------------------ */

export interface PipelineNode {
  /** Stage option id. */
  id: string;
  name: string;
  color: number;
  /** Position in the stage field's option list. */
  index: number;
}

export interface PipelineGraph {
  /** In stage option order. */
  nodes: PipelineNode[];
  nodeById: Map<string, PipelineNode>;
  /** Only edges whose both ends exist, de-duplicated, no self loops. */
  edges: Edge[];
  /** nodeId -> successor ids, ordered by successor option index. */
  successors: Map<string, string[]>;
  /** nodeId -> predecessor ids, ordered by option index. */
  predecessors: Map<string, string[]>;
  /** Nodes without predecessors, in option order. */
  roots: string[];
  /** Nodes without successors, in option order. */
  terminals: string[];
}

export interface LayoutNode {
  id: string;
  /** Top-left corner, px. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Column index (longest path from a root). */
  layer: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  /** SVG path `d` attribute (cubic bezier from source right-middle to target left-middle). */
  path: string;
}

export interface GraphLayout {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/* Per-record runtime state                                            */
/* ------------------------------------------------------------------ */

/**
 * done    – completed (an ancestor of the current node that was visited, or the
 *           current node itself when it is terminal and its status is 'done')
 * active  – the current node (not yet done)
 * pending – not reached yet
 * skipped – an ancestor of the current node that history proves was never visited
 */
export type NodeState = 'done' | 'active' | 'pending' | 'skipped';

export interface RecordNodeStates {
  /** Current stage option id, or null when the stage cell is empty / refers to an unknown option. */
  current: string | null;
  /** Raw stage value text when it does not match any node (deleted option). */
  unknownStageText?: string;
  /** Category of the record's status, when a status field is configured and set. */
  currentCategory: StatusCategory | null;
  /** State for every node in the graph. */
  states: Map<string, NodeState>;
  /** Node ids that the history log shows were entered at some point. */
  visited: Set<string>;
  /** True when the record sits at a terminal node whose status category is 'done'. */
  finished: boolean;
}

export type TransitionKind = 'start' | 'advance' | 'rollback' | 'complete';

export interface HistoryEntry {
  /** ms timestamp, NaN when unparsable. */
  at: number;
  kind: TransitionKind;
  /** Node names (not ids – names are what humans read in the log). */
  from?: string;
  to?: string;
  raw: string;
}

export interface ValidationIssue {
  fieldId: string;
  /** 'empty' for generic fields, 'unchecked' for checkbox fields. */
  reason: 'empty' | 'unchecked';
}

export interface ValidationResult {
  ok: boolean;
  missing: ValidationIssue[];
  /** True when config.requireDoneToAdvance and the status is not in category 'done'. */
  statusNotDone: boolean;
}

/** fieldId -> new raw cell value (null clears the cell). */
export type FieldsPatch = Record<string, CellValue>;

export interface ActionResult {
  ok: boolean;
  /** Human readable error (already translated) when ok === false. */
  error?: string;
  missing?: ValidationIssue[];
  statusNotDone?: boolean;
}

/* ------------------------------------------------------------------ */
/* UI contract between the data hook and the presentational components */
/* ------------------------------------------------------------------ */

/** Everything the presentational components need to render; produced by usePipelineData. */
export interface PipelineContextValue {
  table: TableInfo;
  /** Id of the pipeline view itself (from selection), if known. */
  viewId: string | null;
  lang: Lang;
  theme: ThemeMode;
  editable: boolean;
  fields: FieldMeta[];
  fieldById: Map<string, FieldMeta>;
  config: PipelineConfig;
  /** Stage field meta (undefined when not configured / deleted). */
  stageField?: FieldMeta;
  statusField?: FieldMeta;
  graph: PipelineGraph;
  layout: GraphLayout;
  /** Lark option color palette, index = color id. */
  optionColors: OptionColor[];
  records: RecordData[];
  recordById: Map<string, RecordData>;
}

/** Mutations exposed by usePipelineData. All resolve (never reject); check `ok`. */
export interface PipelineActions {
  /** Validate the current node, then move to `toNodeId` (must be a successor). */
  advance(recordId: string, toNodeId: string): Promise<ActionResult>;
  /** Send the record back to an ancestor node (no validation). */
  rollback(recordId: string, toNodeId: string): Promise<ActionResult>;
  /** Put a record with an empty stage onto `nodeId` (defaults to the first root). */
  start(recordId: string, nodeId?: string): Promise<ActionResult>;
  /** Validate and mark a record at a terminal node as finished (status -> done status). */
  complete(recordId: string): Promise<ActionResult>;
  setStatus(recordId: string, statusOptionId: string | null): Promise<ActionResult>;
  setCell(recordId: string, fieldId: string, value: CellValue): Promise<ActionResult>;
  /** Open Lark's native record card, optionally limited to some fields. */
  openRecord(recordId: string, fieldIds?: string[]): Promise<void>;
  /** Open Lark's native editor for one cell (for types without an inline editor). */
  editField(recordId: string, fieldId: string): Promise<void>;
}
