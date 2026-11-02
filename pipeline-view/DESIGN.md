# Pipeline View — design spec

A Lark Base **table view extension** (block type "Data Table View", SDK
`@lark-opdev/block-bitable-api@0.4.0`) that renders a Meegle-style node pipeline
for the records of the table it lives in. It replaces the built-in *Flow/Stage*
field for teams that need more than 10 nodes, branching, per-node required
fields and a richer UI.

## 1. User requirements (from the request, translated)

1. Configure the pipeline from **one Single-select field** (the *stage field*):
   each option is a node; the record's value is its current node. No node limit.
2. Pick **another Single-select field** (the *status field*) that shows the
   status of the record at its current node (e.g. Not started / In progress /
   Done / Blocked).
3. For **each node**, choose which fields must be filled in at that node
   (required or optional). The record cannot leave a node until its required
   fields are filled.
4. Look & feel of the Meegle screenshot: header with title + status chip +
   time-in-stage, role chips (people), checklist pills, and a left-to-right node
   graph with curved connectors; the current node is highlighted.

## 2. Semantics

- **Graph**: nodes = stage options (option order). Edges default to linear
  (`config.edges === null`). The user can customise successors per node to
  build a DAG (branching = alternative routes; when a node has several
  successors the user chooses which one on "Complete"). Forward edges must be
  acyclic (designer refuses to save a cycle). A single-select can only hold one
  value, so a record is at exactly one node; true parallel nodes are out of
  scope (would need a multi-select stage field — listed as follow-up).
- **Rollback**: when `allowRollback`, a record can be sent back to any strict
  ancestor of its current node (restricted to visited nodes when a history
  field is configured). No validation on rollback.
- **Start**: a record whose stage is empty shows "Not started" + a Start
  button (choose a root when several).
- **Advance**: validate current node (required fields; plus status must be in
  category `done` when `requireDoneToAdvance`), then ONE `setRecord` call writes:
  stage := target, status := entry status (node override → default), enteredAt := now,
  history += line. Targets = successors of the current node.
- **Complete** (terminal node): validate, then status := first `done` status,
  history += "✓ node". The record is then *finished* (terminal node shown green).
- **Node states** (record graph): `done` (green dot), `active` (blue border; dot
  colour by status category: todo grey, doing amber, blocked red, done green),
  `pending` (grey text + grey dot; terminal nodes show a flag icon), `skipped`
  (ancestor never visited according to history: dashed border, faded).
- **Status categories**: each status option is mapped to todo/doing/done/blocked
  (auto-guessed from the name, editable in settings).
- Stage edits made directly in the grid bypass validation — the view only
  guards transitions done through it (documented limitation).

## 3. Persistence

- Config: `adapter.saveConfig(config)` → `bitable.bridge.setData('pipeline-config', config)`;
  scoped to this view instance. Shape: `PipelineConfig` in `src/types.ts`.
  Always passed through `normalizeConfig(raw, fields)` after loading and before
  use, so deleted fields/options never crash the UI.
- Record data lives only in the table's own fields (stage, status, optional
  enteredAt DateTime and history Text fields). Nothing per-record is stored in
  plugin storage.

## 4. Architecture

```
src/
  types.ts                 shared domain types + UI contracts (DO NOT change signatures)
  sdk/adapter.ts           BaseAdapter interface (host boundary)
  sdk/larkAdapter.ts       real implementation over @lark-opdev/block-bitable-api
  sdk/mock/mockData.ts     sample table (fields, options, ~14 records, demo config)
  sdk/mock/mockAdapter.ts  in-memory BaseAdapter with events + latency
  core/*.ts                pure logic, no React, no SDK (unit tested with vitest)
  core/__tests__/*.test.ts
  i18n/index.tsx           createT/useI18n; parts/{common,detail,settings}.ts
  styles/tokens.css        CSS variables (light + dark)
  hooks/usePipelineData.ts loads everything, subscribes to events, exposes actions
  theme.ts                 applies theme to <body theme-mode>
  components/
    App.tsx                layout, selection, filters, settings toggle
    Toolbar.tsx            search / stage filter / status filter / overview / settings
    EmptyState.tsx         onboarding when not configured
    SettingsPanel.tsx      Semi SideSheet: fields, pipeline designer, statuses, display
    settings/*.tsx         sub-sections of the settings panel
    PipelineGraph.tsx      SVG edges + HTML pills; modes record | overview | preview
    OptionTag.tsx          select option chip in Lark colours
    RecordList.tsx         left list of records
    RecordDetail.tsx       header, roles, checklist, graph, node panel
    NodePanel.tsx          fields of a node + actions (complete / route / rollback)
    FieldEditor.tsx        inline editor per field type, host editor fallback
  index.tsx                picks mock vs lark adapter, renders <App/>
```

### 4.1 Adapter selection (index.tsx)
`process.env.PV_MOCK === '1'` (set by `npm run demo`) or URL has `?mock` →
`import('./sdk/mock/mockAdapter')`; else `import('./sdk/larkAdapter')`. Dynamic
imports keep the SDK out of the demo and the mock out of the main chunk.

Mock URL params: `preset=demo` (pre-configured demo pipeline; default when no
config saved in localStorage) / `preset=none` (unconfigured, onboarding),
`readonly=1`, `theme=dark`, `lang=en|vi` (default vi), `latency=<ms>` (default 120),
`reset=1` (clear stored mock config).

### 4.2 Component contracts

```ts
// components/PipelineGraph.tsx
export interface PipelineGraphProps {
  graph: PipelineGraph;
  layout: GraphLayout;
  mode: 'record' | 'overview' | 'preview';
  states?: Map<string, NodeState>;          // record mode
  currentCategory?: StatusCategory | null;  // record mode: active dot colour
  counts?: Map<string, number>;             // overview mode: count badge per node
  badges?: Map<string, string>;             // optional small text per node, e.g. "1/3"
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
  optionColors?: OptionColor[];
}
export function PipelineGraph(props: PipelineGraphProps): JSX.Element;

// components/OptionTag.tsx
export function OptionTag(props: {
  option?: { name: string; color: number } | null;
  colors: OptionColor[];
  size?: 'small' | 'default';
  placeholder?: string;
}): JSX.Element;

// components/RecordList.tsx
export interface RecordListProps {
  ctx: PipelineContextValue;
  records: RecordData[];            // already filtered/sorted by App
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
}

// components/RecordDetail.tsx
export interface RecordDetailProps {
  ctx: PipelineContextValue;
  actions: PipelineActions;
  record: RecordData;
  selectedNodeId: string | null;    // null => current node
  onSelectNode: (nodeId: string | null) => void;
}

// components/FieldEditor.tsx
export interface FieldEditorProps {
  field: FieldMeta;
  value: CellValue;
  editable: boolean;
  invalid?: boolean;
  optionColors: OptionColor[];
  onCommit: (value: CellValue) => void;   // called on blur / select / toggle, only when changed
  onOpenHostEditor: () => void;           // for non-inline types
}

// hooks/usePipelineData.ts
export interface PipelineData {
  phase: 'loading' | 'error' | 'ready';
  error?: string;
  loadedCount: number;
  ctx: PipelineContextValue | null;     // non-null when phase === 'ready'
  configured: boolean;                  // isConfigured(ctx.config, ctx.fields)
  hasSavedConfig: boolean;
  views: ViewInfo[];
  actions: PipelineActions;
  saveConfig(next: PipelineConfig): Promise<ActionResult>;
  createField(cfg: AddFieldConfig): Promise<string | null>;   // returns new field id
  addStageOption(name: string): Promise<string | null>;       // returns new option id
  reload(): void;
}
export function usePipelineData(adapter: BaseAdapter): PipelineData;
```

## 5. UI

Visual reference: the Meegle screenshot (white cards, light grey dividers,
pill-shaped nodes ~40px high with a 12px status dot, 1.5px grey borders,
curved grey connectors with small port dots at both ends, blue 2px border on
the current node). Use Semi UI (`@douyinfe/semi-ui`) for inputs, selects,
buttons, SideSheet, Toast, Tooltip, Dropdown; custom CSS (with `--pv-*` tokens
from `styles/tokens.css`) for the graph and header. All user-facing text goes
through `useI18n().t` (Vietnamese + English).

Layout (App):
```
┌ Toolbar: [Pipeline icon] Table name · search · stage filter · status filter · [Overview] [⚙ Settings]
├──────────────┬──────────────────────────────────────────────────────────┐
│ RecordList   │ RecordDetail (selected)  — or Overview when none selected │
│ (280px)      │  header: icon, title, status chip, time in stage, open ↗  │
│ title        │  roles row: chips per configured User field               │
│ stage tag    │  checklist row: pills per configured Checkbox field       │
│ status dot   │  graph (record mode, horizontally scrollable)             │
│ ...          │  NodePanel for selected node (default = current node)     │
└──────────────┴──────────────────────────────────────────────────────────┘
```
- Overview: the graph in overview mode with record counts per node + chips for
  "Not started" and "Finished" counts; clicking a node sets the stage filter.
- NodePanel: node name + state tag + owner users; guidance text; the node's
  fields as a form (label with red * when required, FieldEditor; missing
  required fields get a red outline after a failed attempt); host button "Fill
  in Lark form" → `openRecord(recordId, nodeFieldIds)`. Actions when the node
  is the current node and the user can edit: status select; primary button
  "Complete & go to <next>" (single successor) or a dropdown "Complete & go to…"
  (several); "Complete pipeline" on a terminal node; "Send back to…" dropdown
  (rollback targets). For a record without a stage: "Start at <root>".
  On a non-current node: read-only form + note "Not reached yet" / "Done".
- Narrow widths (< 720px): list collapses above the detail as a Select.
- Read-only users: no edit controls, settings disabled with tooltip.
- Settings (SideSheet, ~720px, tabs):
  1. *Fields*: title field, stage field (SingleSelect, required), status field
     (SingleSelect), "entered stage at" (DateTime), history (Text), source view
     (Grid views, optional). Quick-create buttons for missing stage / status /
     enteredAt / history fields (`createField`).
  2. *Pipeline*: live preview graph; "Add node" (adds a stage option);
     "Reset to linear"; per-node card: next nodes (multi-select), owner (User field),
     fields to fill (multi-select) + per-field "required" checkbox, entry status,
     guidance. Cycle → inline error, Save disabled.
  3. *Statuses*: each status option → category select; default entry status;
     switches requireDoneToAdvance / allowRollback.
  4. *Display*: role fields (User), checklist fields (Checkbox), list fields (any).
  Save → `saveConfig` (normalizes first) → toast.
