import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, FieldType } from '../../types';
import type { Edge, FieldMeta, NodeState, PipelineConfig, RecordData, SelectOption } from '../../types';
import { normalizeConfig } from '../config';
import { buildGraph } from '../graph';
import { formatHistoryLine } from '../history';
import { computeNodeStates, getEnteredAt, getStatusCategory, readHistory, readVisits, visitedNodeIds } from '../state';
import { rollbackTargets } from '../transitions';
import type { TransitionContext } from '../transitions';

const e = (from: string, to: string): Edge => ({ from, to });
const chain = (...ids: string[]): Edge[] => ids.slice(1).map((id, i) => e(ids[i], id));

const MEEGLE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const MEEGLE_EDGES: Edge[] = [
  ...chain('A', 'B', 'C'),
  e('C', 'D'), e('C', 'E'), e('C', 'F'),
  e('D', 'G'), e('D', 'H'), e('E', 'H'), e('F', 'H'), e('F', 'I'),
  e('G', 'J'), e('H', 'J'), e('I', 'J'), e('J', 'K'),
];
const STAGE_OPTIONS: SelectOption[] = MEEGLE_IDS.map((id, i) => ({ id, name: `Stage ${id}`, color: i }));
const STATUS_OPTIONS: SelectOption[] = [
  { id: 'todo', name: 'Not started', color: 0 },
  { id: 'doing', name: 'In progress', color: 1 },
  { id: 'done', name: 'Done', color: 2 },
  { id: 'blocked', name: 'Blocked', color: 3 },
];
/** "Steps passed" options: one per stage (own ids) plus a user option that names no stage. */
const PATH_OPTIONS: SelectOption[] = [
  ...MEEGLE_IDS.map((id, i) => ({ id: `p_${id}`, name: `Stage ${id}`, color: i })),
  { id: 'p_urgent', name: 'Urgent', color: 5 },
];
const FIELDS: FieldMeta[] = [
  { id: 'title', name: 'Title', type: FieldType.Text, isPrimary: true },
  { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options: STAGE_OPTIONS },
  { id: 'status', name: 'Status', type: FieldType.SingleSelect, isPrimary: false, options: STATUS_OPTIONS },
  { id: 'entered', name: 'Entered', type: FieldType.DateTime, isPrimary: false },
  { id: 'history', name: 'History', type: FieldType.Text, isPrimary: false },
  { id: 'path', name: 'Steps passed', type: FieldType.MultiSelect, isPrimary: false, options: PATH_OPTIONS },
  { id: 'tags', name: 'Tags', type: FieldType.Text, isPrimary: false },
];
const fieldById = new Map(FIELDS.map((f) => [f.id, f]));

const config = (overrides: Record<string, unknown> = {}): PipelineConfig =>
  normalizeConfig(
    {
      version: CONFIG_VERSION,
      stageFieldId: 'stage',
      statusFieldId: 'status',
      enteredAtFieldId: 'entered',
      historyFieldId: 'history',
      edges: MEEGLE_EDGES,
      ...overrides,
    },
    FIELDS,
  );
const graph = buildGraph(STAGE_OPTIONS, MEEGLE_EDGES);
const linear = buildGraph(STAGE_OPTIONS.slice(0, 5), null);

const at = new Date(2026, 10, 2, 9, 0).getTime();
const name = (id: string) => `Stage ${id}`;
/** History text of a record that walked `path` (first = start). */
function walked(...path: string[]): unknown {
  const lines = path.map((id, i) =>
    i === 0
      ? formatHistoryLine({ at, kind: 'start', to: name(id) })
      : formatHistoryLine({ at, kind: 'advance', from: name(path[i - 1]), to: name(id) }),
  );
  return [{ type: 'text', text: lines.join('\n') }];
}
const record = (fields: Record<string, unknown>): RecordData => ({ id: 'rec1', fields });
const stage = (id: string) => ({ id, text: name(id) });
const status = (id: string) => ({ id, text: id });
/** Path cell ticking the given stages ('urgent' = the user option that names no stage). */
const path = (...ids: string[]) =>
  ids.map((id) => (id === 'urgent' ? { id: 'p_urgent', text: 'Urgent' } : { id: `p_${id}`, text: name(id) }));

function statesOf(states: Map<string, NodeState>): Record<string, NodeState> {
  return Object.fromEntries(states);
}

describe('getStatusCategory', () => {
  const cfg = config();
  it('maps a status option id to its category', () => {
    expect(getStatusCategory(cfg, 'done')).toBe('done');
    expect(getStatusCategory(cfg, 'doing')).toBe('doing');
    expect(getStatusCategory(cfg, 'blocked')).toBe('blocked');
  });

  it('returns null for missing or unknown ids', () => {
    expect(getStatusCategory(cfg, null)).toBeNull();
    expect(getStatusCategory(cfg, undefined)).toBeNull();
    expect(getStatusCategory(cfg, '')).toBeNull();
    expect(getStatusCategory(cfg, 'gone')).toBeNull();
    expect(getStatusCategory(cfg, 'constructor')).toBeNull();
  });
});

describe('computeNodeStates', () => {
  it('without history: ancestors done, current active, the rest pending (linear)', () => {
    const cfg = config({ edges: null, historyFieldId: undefined });
    const s = computeNodeStates(linear, record({ stage: stage('C'), status: status('doing') }), cfg, fieldById);
    expect(s.current).toBe('C');
    expect(s.currentCategory).toBe('doing');
    expect(s.finished).toBe(false);
    expect(s.visited.size).toBe(0);
    expect(s.visitSource).toBe('inferred');
    expect(s.unknownStageText).toBeUndefined();
    expect(statesOf(s.states)).toEqual({ A: 'done', B: 'done', C: 'active', D: 'pending', E: 'pending' });
  });

  it('without visit information marks only the steps on every route done, the other branches unknown', () => {
    const s = computeNodeStates(graph, record({ stage: stage('H'), history: null }), config(), fieldById);
    expect(s.visitSource).toBe('inferred');
    for (const id of ['A', 'B', 'C']) expect(s.states.get(id)).toBe('done');
    for (const id of ['D', 'E', 'F']) expect(s.states.get(id)).toBe('unknown');
    expect(s.states.get('H')).toBe('active');
    expect(s.states.get('G')).toBe('pending'); // sibling, not an ancestor
    expect(s.states.get('I')).toBe('pending');
    expect(s.states.get('J')).toBe('pending');
  });

  it('marks ancestors the history never visited as skipped (branch not taken)', () => {
    const rec = record({ stage: stage('J'), status: status('doing'), history: walked('A', 'B', 'C', 'D', 'G', 'J') });
    const s = computeNodeStates(graph, rec, config(), fieldById);
    expect([...s.visited].sort()).toEqual(['A', 'B', 'C', 'D', 'G', 'J']);
    expect(statesOf(s.states)).toEqual({
      A: 'done',
      B: 'done',
      C: 'done',
      D: 'done',
      E: 'skipped',
      F: 'skipped',
      G: 'done',
      H: 'skipped',
      I: 'skipped',
      J: 'active',
      K: 'pending',
    });
  });

  it('keeps nodes visited before a rollback pending when they are downstream again', () => {
    const history = [
      { type: 'text', text: formatHistoryLine({ at, kind: 'start', to: name('A') }) },
      { type: 'text', text: '\n' + formatHistoryLine({ at, kind: 'advance', from: name('A'), to: name('B') }) },
      { type: 'text', text: '\n' + formatHistoryLine({ at, kind: 'advance', from: name('B'), to: name('C') }) },
      { type: 'text', text: '\n' + formatHistoryLine({ at, kind: 'rollback', from: name('C'), to: name('B') }) },
    ];
    const s = computeNodeStates(graph, record({ stage: stage('B'), history }), config(), fieldById);
    expect(s.visited.has('C')).toBe(true);
    expect(s.states.get('A')).toBe('done');
    expect(s.states.get('B')).toBe('active');
    expect(s.states.get('C')).toBe('pending');
  });

  it('marks a finished record: terminal node with a done status', () => {
    const rec = record({ stage: stage('K'), status: status('done') });
    const s = computeNodeStates(graph, rec, config(), fieldById);
    expect(s.finished).toBe(true);
    expect(s.currentCategory).toBe('done');
    expect(s.states.get('K')).toBe('done');
    // Without visit information only the nodes on every route are certain.
    for (const id of ['A', 'B', 'C', 'J']) expect(s.states.get(id)).toBe('done');
    for (const id of ['D', 'E', 'F', 'G', 'H', 'I']) expect(s.states.get(id)).toBe('unknown');
    const cfg = config({ edges: null });
    const linearDone = computeNodeStates(linear, record({ stage: stage('E'), status: status('done') }), cfg, fieldById);
    expect(linearDone.finished).toBe(true);
    expect([...linearDone.states.values()].every((v) => v === 'done')).toBe(true);
  });

  it('keeps a terminal node active until its status is done', () => {
    const s = computeNodeStates(graph, record({ stage: stage('K'), status: status('doing') }), config(), fieldById);
    expect(s.finished).toBe(false);
    expect(s.states.get('K')).toBe('active');
  });

  it('never marks a non-terminal current node done, even with a done status', () => {
    const s = computeNodeStates(graph, record({ stage: stage('C'), status: status('done') }), config(), fieldById);
    expect(s.finished).toBe(false);
    expect(s.states.get('C')).toBe('active');
  });

  it('treats an isolated node (root and terminal) with a done status as finished', () => {
    const g = buildGraph(STAGE_OPTIONS.slice(0, 3), []);
    const s = computeNodeStates(g, record({ stage: stage('B'), status: status('done') }), config({ edges: [] }), fieldById);
    expect(s.finished).toBe(true);
    expect(statesOf(s.states)).toEqual({ A: 'pending', B: 'done', C: 'pending' });
  });

  it('leaves every node pending for a record that has not started', () => {
    const s = computeNodeStates(graph, record({}), config(), fieldById);
    expect(s.current).toBeNull();
    expect(s.unknownStageText).toBeUndefined();
    expect(s.currentCategory).toBeNull();
    expect([...s.states.values()].every((v) => v === 'pending')).toBe(true);
    expect(s.states.size).toBe(MEEGLE_IDS.length);
  });

  it('reports the text of a stage value that is not a node (deleted option)', () => {
    const s = computeNodeStates(graph, record({ stage: { id: 'gone', text: 'Old stage' } }), config(), fieldById);
    expect(s.current).toBeNull();
    expect(s.unknownStageText).toBe('Old stage');
    expect([...s.states.values()].every((v) => v === 'pending')).toBe(true);
    const noText = computeNodeStates(graph, record({ stage: { id: 'gone', text: '' } }), config(), fieldById);
    expect(noText.unknownStageText).toBe('gone');
  });

  it('ignores the stage cell when no stage field is configured', () => {
    const cfg = { ...config(), stageFieldId: undefined };
    const s = computeNodeStates(graph, record({ stage: stage('C') }), cfg, fieldById);
    expect(s.current).toBeNull();
    expect(s.unknownStageText).toBeUndefined();
  });

  it('has no category without a status field or with an unknown status', () => {
    const noStatus = config({ statusFieldId: undefined });
    expect(computeNodeStates(graph, record({ stage: stage('C'), status: status('done') }), noStatus, fieldById).currentCategory).toBeNull();
    expect(computeNodeStates(graph, record({ stage: stage('C'), status: status('gone') }), config(), fieldById).currentCategory).toBeNull();
  });

  it('does not mark ancestors skipped when the log names a node that no longer exists (renamed option)', () => {
    // Walked A → B → C, then option B was renamed to "B2" (same id).
    const renamed = STAGE_OPTIONS.slice(0, 5).map((o) => (o.id === 'B' ? { ...o, name: 'B2' } : o));
    const g = buildGraph(renamed, null);
    const rec = record({ stage: stage('C'), history: walked('A', 'B', 'C') });
    const s = computeNodeStates(g, rec, config({ edges: null }), fieldById);
    expect(statesOf(s.states)).toEqual({ A: 'done', B: 'done', C: 'active', D: 'pending', E: 'pending' });
  });

  it('keeps what a log naming a renamed option still proves, but marks nothing skipped from it', () => {
    const renamed = STAGE_OPTIONS.map((o) => (o.id === 'B' ? { ...o, name: 'B2' } : o));
    const g = buildGraph(renamed, MEEGLE_EDGES);
    const rec = record({ stage: stage('H'), history: walked('A', 'B', 'C', 'E', 'H') });
    const s = computeNodeStates(g, rec, config(), fieldById);
    expect(s.visitSource).toBe('history');
    expect(s.states.get('B')).toBe('done'); // on every route to H
    expect(s.states.get('E')).toBe('done'); // logged
    expect(s.states.get('D')).toBe('unknown');
    expect(s.states.get('F')).toBe('unknown');
  });

  it('treats a log without a start line as covering only the steps from its first logged node on', () => {
    // The history field was added while the record sat at C: "C → F", "F → H".
    const partial = [
      { type: 'text', text: formatHistoryLine({ at, kind: 'advance', from: name('C'), to: name('F') }) },
      { type: 'text', text: '\n' + formatHistoryLine({ at, kind: 'advance', from: name('F'), to: name('H') }) },
    ];
    const s = computeNodeStates(graph, record({ stage: stage('H'), history: partial }), config(), fieldById);
    expect(s.visitSource).toBe('history');
    expect(statesOf(s.states)).toMatchObject({ A: 'done', B: 'done', C: 'done', D: 'skipped', E: 'skipped', F: 'done', H: 'active' });

    // Logged from H only: which of D / E / F led to H is unknown; G and I come after the branch.
    const fromH = [{ type: 'text', text: formatHistoryLine({ at, kind: 'advance', from: name('H'), to: name('J') }) }];
    const j = computeNodeStates(graph, record({ stage: stage('J'), history: fromH }), config(), fieldById);
    expect(statesOf(j.states)).toEqual({
      A: 'done',
      B: 'done',
      C: 'done',
      D: 'unknown',
      E: 'unknown',
      F: 'unknown',
      G: 'skipped',
      H: 'done',
      I: 'skipped',
      J: 'active',
      K: 'pending',
    });
  });

  it('reports the history as the source when the log can be trusted', () => {
    const rec = record({ stage: stage('H'), history: walked('A', 'B', 'C', 'E', 'H') });
    expect(computeNodeStates(graph, rec, config(), fieldById).visitSource).toBe('history');
  });

  it('accepts a plain string history cell and matches names ignoring surrounding spaces', () => {
    const text = `[2026-11-02 09:00] ▶  ${name('A')}  \n[2026-11-02 10:00] ${name('A')} → ${name('C')}`;
    const s = computeNodeStates(linear, record({ stage: stage('C'), history: text }), config({ edges: null }), fieldById);
    expect(statesOf(s.states)).toEqual({ A: 'done', B: 'skipped', C: 'active', D: 'pending', E: 'pending' });
  });
});

describe('computeNodeStates with a "Steps passed" field', () => {
  const withPath = (overrides: Record<string, unknown> = {}) => config({ pathFieldId: 'path', ...overrides });

  it('marks the ticked ancestors done and the others skipped', () => {
    const rec = record({ stage: stage('J'), path: path('A', 'B', 'C', 'F', 'I') });
    const s = computeNodeStates(graph, rec, withPath({ historyFieldId: undefined }), fieldById);
    expect(s.visitSource).toBe('path');
    expect([...s.visited].sort()).toEqual(['A', 'B', 'C', 'F', 'I', 'J']); // the current node counts as visited
    expect(statesOf(s.states)).toEqual({
      A: 'done',
      B: 'done',
      C: 'done',
      D: 'skipped',
      E: 'skipped',
      F: 'done',
      G: 'skipped',
      H: 'skipped',
      I: 'done',
      J: 'active',
      K: 'pending',
    });
  });

  it('takes priority over the history log', () => {
    const rec = record({ stage: stage('H'), history: walked('A', 'B', 'C', 'D', 'H'), path: path('A', 'B', 'C', 'E') });
    const s = computeNodeStates(graph, rec, withPath(), fieldById);
    expect(s.visitSource).toBe('path');
    expect(s.states.get('D')).toBe('skipped');
    expect(s.states.get('E')).toBe('done');
  });

  it('ignores options that name no node; a cell that names none falls back to history / inference', () => {
    const extra = computeNodeStates(graph, record({ stage: stage('H'), path: path('urgent', 'A', 'B', 'C', 'D') }), withPath(), fieldById);
    expect(extra.visitSource).toBe('path');
    expect(extra.states.get('D')).toBe('done');
    expect([...extra.visited].sort()).toEqual(['A', 'B', 'C', 'D', 'H']);

    const onlyOwn = record({ stage: stage('H'), path: path('urgent'), history: walked('A', 'B', 'C', 'F', 'H') });
    const fromHistory = computeNodeStates(graph, onlyOwn, withPath(), fieldById);
    expect(fromHistory.visitSource).toBe('history');
    expect(fromHistory.states.get('F')).toBe('done');
    expect(fromHistory.states.get('D')).toBe('skipped');

    const inferred = computeNodeStates(graph, record({ stage: stage('H'), path: [] }), withPath(), fieldById);
    expect(inferred.visitSource).toBe('inferred');
    expect(inferred.states.get('D')).toBe('unknown');
  });

  it('is ignored when the path field is not configured, deleted or not a MultiSelect', () => {
    const rec = record({ stage: stage('H'), path: path('A', 'B', 'C', 'D'), tags: path('A', 'B', 'C', 'D') });
    expect(computeNodeStates(graph, rec, config(), fieldById).visitSource).toBe('inferred');
    const deleted = new Map([...fieldById].filter(([id]) => id !== 'path'));
    expect(computeNodeStates(graph, rec, withPath(), deleted).visitSource).toBe('inferred');
    const wrongType = { ...config(), pathFieldId: 'tags' };
    expect(computeNodeStates(graph, rec, wrongType, fieldById).visitSource).toBe('inferred');
  });

  it('matches options by name (trimmed, Unicode-normalized), by id when the cell text is stale', () => {
    const viOptions: SelectOption[] = [
      { id: 'v1', name: 'Soạn HĐ', color: 0 },
      { id: 'v2', name: 'Chờ ký', color: 1 },
      { id: 'v3', name: 'Đã ký/Hiệu lực', color: 2 },
      { id: 'v4', name: 'Hoàn thành/Thanh lý', color: 3 },
      { id: 'v5', name: 'Hủy', color: 4 },
    ];
    const edges = [e('v1', 'v2'), e('v1', 'v3'), e('v1', 'v4'), e('v2', 'v5'), e('v3', 'v5'), e('v4', 'v5')];
    const g = buildGraph(viOptions, edges);
    // The path field was typed by hand: decomposed accents and stray spaces.
    const pathOptions: SelectOption[] = [
      { id: 'q1', name: ' Soạn HĐ '.normalize('NFD'), color: 0 },
      { id: 'q2', name: 'Chờ ký', color: 1 },
      { id: 'q3', name: 'Đã ký/Hiệu lực'.normalize('NFD'), color: 2 },
      { id: 'q4', name: 'Hoàn thành/Thanh lý  ', color: 3 },
      { id: 'q5', name: 'Hủy', color: 4 },
    ];
    const fields: FieldMeta[] = [
      { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options: viOptions },
      { id: 'path', name: 'Các bước đã qua', type: FieldType.MultiSelect, isPrimary: false, options: pathOptions },
    ];
    const cfg = normalizeConfig({ version: CONFIG_VERSION, stageFieldId: 'stage', pathFieldId: 'path', edges }, fields);
    const byId = new Map(fields.map((f) => [f.id, f]));
    // q1 by id (its text is stale); the second item has an unknown id, so its text decides.
    const rec = record({ stage: { id: 'v5', text: 'Hủy' }, path: [{ id: 'q1', text: 'old name' }, { id: 'gone', text: 'Đã ký/Hiệu lực' }] });
    const s = computeNodeStates(g, rec, cfg, byId);
    expect(s.visitSource).toBe('path');
    expect(statesOf(s.states)).toEqual({ v1: 'done', v2: 'skipped', v3: 'done', v4: 'skipped', v5: 'active' });
  });
});

describe('computeNodeStates on the contract pipeline (Soạn HĐ → 3 branches → Hủy)', () => {
  const opts: SelectOption[] = [
    { id: 'draft', name: 'Soạn HĐ', color: 0 },
    { id: 'wait', name: 'Chờ ký', color: 1 },
    { id: 'signed', name: 'Đã ký/Hiệu lực', color: 2 },
    { id: 'closed', name: 'Hoàn thành/Thanh lý', color: 3 },
    { id: 'cancel', name: 'Hủy', color: 4 },
  ];
  const edges = [
    e('draft', 'wait'),
    e('draft', 'signed'),
    e('draft', 'closed'),
    e('wait', 'cancel'),
    e('signed', 'cancel'),
    e('closed', 'cancel'),
  ];
  const g = buildGraph(opts, edges);
  const pathOpts = opts.map((o) => ({ ...o, id: `p_${o.id}` }));
  const fields: FieldMeta[] = [
    { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options: opts },
    { id: 'path', name: 'Các bước đã qua', type: FieldType.MultiSelect, isPrimary: false, options: pathOpts },
  ];
  const byId = new Map(fields.map((f) => [f.id, f]));
  const cfg = normalizeConfig({ version: CONFIG_VERSION, stageFieldId: 'stage', pathFieldId: 'path', edges }, fields);
  const cancelled = { id: 'cancel', text: 'Hủy' };

  it('no longer shows every branch done when nothing says which one was taken', () => {
    const s = computeNodeStates(g, record({ stage: cancelled }), cfg, byId);
    expect(statesOf(s.states)).toEqual({ draft: 'done', wait: 'unknown', signed: 'unknown', closed: 'unknown', cancel: 'active' });
  });

  it('shows exactly the branch the steps-passed field names', () => {
    const ticked = [
      { id: 'p_draft', text: 'Soạn HĐ' },
      { id: 'p_signed', text: 'Đã ký/Hiệu lực' },
    ];
    const s = computeNodeStates(g, record({ stage: cancelled, path: ticked }), cfg, byId);
    expect(statesOf(s.states)).toEqual({ draft: 'done', wait: 'skipped', signed: 'done', closed: 'skipped', cancel: 'active' });
  });

  const tc = (config: PipelineConfig, fieldMap = byId): TransitionContext => ({ config, fieldById: fieldMap, graph: g, now: at });

  it('does not mark the branch skipped when the ticks stop before it (stage changed outside the plugin)', () => {
    // Started in the plugin (path = Soạn HĐ), then moved Soạn HĐ → Đã ký → Hủy in the grid.
    const rec = record({ stage: cancelled, path: [{ id: 'p_draft', text: 'Soạn HĐ' }] });
    const s = computeNodeStates(g, rec, cfg, byId);
    expect(s.visitSource).toBe('path');
    expect(statesOf(s.states)).toEqual({ draft: 'done', wait: 'unknown', signed: 'unknown', closed: 'unknown', cancel: 'active' });
    expect(rollbackTargets(tc(cfg), rec)).toEqual(['draft', 'wait', 'signed', 'closed']);
  });

  it('keeps the steps on every route done when only the branch is ticked by hand', () => {
    const rec = record({ stage: cancelled, path: [{ id: 'p_signed', text: 'Đã ký/Hiệu lực' }] });
    const s = computeNodeStates(g, rec, cfg, byId);
    expect(statesOf(s.states)).toEqual({ draft: 'done', wait: 'skipped', signed: 'done', closed: 'skipped', cancel: 'active' });
    expect(rollbackTargets(tc(cfg), rec)).toEqual(['draft', 'signed']);
  });

  it('treats a step whose name has no option in the path field as unknown, not skipped', () => {
    // "Đã ký/Hiệu lực" has no option (renamed stage, or creating it failed); the move wrote the rest.
    const lacking: FieldMeta[] = [
      fields[0],
      { ...fields[1], options: pathOpts.filter((o) => o.id !== 'p_signed') },
    ];
    const lackingById = new Map(lacking.map((f) => [f.id, f]));
    const rec = record({ stage: cancelled, path: [{ id: 'p_draft', text: 'Soạn HĐ' }, { id: 'p_cancel', text: 'Hủy' }] });
    const s = computeNodeStates(g, rec, cfg, lackingById);
    expect(s.states.get('signed')).toBe('unknown');
    expect(s.states.get('draft')).toBe('done');
    expect(rollbackTargets(tc(cfg, lackingById), rec)).toContain('signed');
  });

  it('counts a ticked option missing from the cached field metadata (just created elsewhere)', () => {
    const stale: FieldMeta[] = [fields[0], { ...fields[1], options: pathOpts.filter((o) => o.id !== 'p_signed') }];
    const staleById = new Map(stale.map((f) => [f.id, f]));
    const rec = record({ stage: cancelled, path: [{ id: 'p_draft', text: 'Soạn HĐ' }, { id: 'p_new', text: 'Đã ký/Hiệu lực' }] });
    expect(statesOf(computeNodeStates(g, rec, cfg, staleById).states)).toEqual({
      draft: 'done',
      wait: 'skipped',
      signed: 'done',
      closed: 'skipped',
      cancel: 'active',
    });
  });

  it('anchors a log without "▶" that begins with a rollback at the rollback target', () => {
    const withHistory: FieldMeta[] = [...fields, { id: 'history', name: 'History', type: FieldType.Text, isPrimary: false }];
    const hById = new Map(withHistory.map((f) => [f.id, f]));
    const hCfg = normalizeConfig({ version: CONFIG_VERSION, stageFieldId: 'stage', historyFieldId: 'history', edges }, withHistory);
    const log = [
      formatHistoryLine({ at, kind: 'rollback', from: 'Hủy', to: 'Soạn HĐ' }),
      formatHistoryLine({ at, kind: 'advance', from: 'Soạn HĐ', to: 'Chờ ký' }),
      formatHistoryLine({ at, kind: 'advance', from: 'Chờ ký', to: 'Hủy' }),
    ].join('\n');
    const s = computeNodeStates(g, record({ stage: cancelled, history: log }), hCfg, hById);
    expect(s.visitSource).toBe('history');
    expect(statesOf(s.states)).toEqual({ draft: 'done', wait: 'done', signed: 'skipped', closed: 'skipped', cancel: 'active' });
  });
});

describe('readVisits', () => {
  it('reports the source and the visited nodes, or null when inferred', () => {
    const cfg = config({ pathFieldId: 'path' });
    const none = new Set<string>();
    // The ticks reach a root without a gap: nothing uncovered; A and B lie on every route to C.
    expect(readVisits(graph, record({ stage: stage('C'), path: path('A', 'B') }), cfg, fieldById)).toEqual({
      source: 'path',
      visited: new Set(['A', 'B']),
      uncovered: none,
      certain: new Set(['A', 'B']),
    });
    expect(readVisits(graph, record({ stage: stage('B'), history: walked('A', 'B') }), cfg, fieldById)).toEqual({
      source: 'history',
      visited: new Set(['A', 'B']),
      uncovered: none,
      certain: none,
    });
    expect(readVisits(graph, record({ stage: stage('H') }), cfg, fieldById)).toEqual({
      source: 'inferred',
      visited: none,
      uncovered: new Set(['A', 'B', 'C', 'D', 'E', 'F']),
      certain: new Set(['A', 'B', 'C']),
    });
  });
});

describe('history helpers', () => {
  it('readHistory parses the configured history field only', () => {
    const rec = record({ history: walked('A', 'B') });
    expect(readHistory(rec, config())).toHaveLength(2);
    expect(readHistory(rec, config({ historyFieldId: undefined }))).toEqual([]);
  });

  it('visitedNodeIds maps logged names back to node ids', () => {
    const entries = readHistory(record({ history: walked('A', 'C', 'K') }), config());
    expect([...visitedNodeIds(graph, entries)].sort()).toEqual(['A', 'C', 'K']);
    expect(visitedNodeIds(graph, []).size).toBe(0);
  });
});

describe('getEnteredAt', () => {
  it('reads the configured DateTime field', () => {
    expect(getEnteredAt(record({ entered: at }), config())).toBe(at);
  });

  it('returns null when unconfigured, empty or invalid', () => {
    expect(getEnteredAt(record({ entered: at }), config({ enteredAtFieldId: undefined }))).toBeNull();
    expect(getEnteredAt(record({}), config())).toBeNull();
    expect(getEnteredAt(record({ entered: null }), config())).toBeNull();
    expect(getEnteredAt(record({ entered: NaN }), config())).toBeNull();
    expect(getEnteredAt(record({ entered: 'soon' }), config())).toBeNull();
    expect(getEnteredAt(record({ entered: [at] }), config())).toBeNull();
  });

  it('accepts a numeric string', () => {
    expect(getEnteredAt(record({ entered: String(at) }), config())).toBe(at);
  });
});
