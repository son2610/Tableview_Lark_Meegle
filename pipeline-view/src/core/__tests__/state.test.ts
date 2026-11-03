import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, FieldType } from '../../types';
import type { Edge, FieldMeta, NodeState, PipelineConfig, RecordData, SelectOption } from '../../types';
import { normalizeConfig } from '../config';
import { buildGraph } from '../graph';
import { formatHistoryLine } from '../history';
import { computeNodeStates, getEnteredAt, getStatusCategory, readHistory, visitedNodeIds } from '../state';

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
const FIELDS: FieldMeta[] = [
  { id: 'title', name: 'Title', type: FieldType.Text, isPrimary: true },
  { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options: STAGE_OPTIONS },
  { id: 'status', name: 'Status', type: FieldType.SingleSelect, isPrimary: false, options: STATUS_OPTIONS },
  { id: 'entered', name: 'Entered', type: FieldType.DateTime, isPrimary: false },
  { id: 'history', name: 'History', type: FieldType.Text, isPrimary: false },
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
    expect(s.unknownStageText).toBeUndefined();
    expect(statesOf(s.states)).toEqual({ A: 'done', B: 'done', C: 'active', D: 'pending', E: 'pending' });
  });

  it('with an empty history cell behaves as if history were not configured', () => {
    const s = computeNodeStates(graph, record({ stage: stage('H'), history: null }), config(), fieldById);
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) expect(s.states.get(id)).toBe('done');
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
    expect([...s.states.values()].every((v) => v === 'done')).toBe(true);
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

  it('accepts a plain string history cell and matches names ignoring surrounding spaces', () => {
    const text = `[2026-11-02 09:00] ▶  ${name('A')}  \n[2026-11-02 10:00] ${name('A')} → ${name('C')}`;
    const s = computeNodeStates(linear, record({ stage: stage('C'), history: text }), config({ edges: null }), fieldById);
    expect(statesOf(s.states)).toEqual({ A: 'done', B: 'skipped', C: 'active', D: 'pending', E: 'pending' });
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
