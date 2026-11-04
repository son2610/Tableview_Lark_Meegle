import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, FieldType } from '../../types';
import type { Edge, FieldMeta, PipelineConfig, RecordData, SelectOption } from '../../types';
import { segmentsToText } from '../cell';
import { normalizeConfig } from '../config';
import { buildGraph } from '../graph';
import { formatHistoryLine, parseHistory } from '../history';
import { computeNodeStates } from '../state';
import {
  buildTransitionPatch,
  currentNodeId,
  missingPathOptionNames,
  nextTargets,
  requiredProgress,
  rollbackTargets,
  validateNode,
} from '../transitions';
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
  { id: 'st_todo', name: 'Chưa bắt đầu', color: 0 },
  { id: 'st_doing', name: 'Đang thực hiện', color: 1 },
  { id: 'st_done', name: 'Hoàn thành', color: 2 },
  { id: 'st_review', name: 'Review', color: 3 },
];
/**
 * "Steps passed" options, deliberately out of stage order and without "Stage D" / "Stage J",
 * plus two options of the user's own that name no stage.
 */
const PATH_OPTIONS: SelectOption[] = [
  { id: 'p_urgent', name: 'Urgent', color: 5 },
  ...['K', 'I', 'H', 'G', 'F', 'E', 'C', 'B', 'A'].map((id, i) => ({ id: `p_${id}`, name: `Stage ${id}`, color: i })),
  { id: 'p_vip', name: 'VIP', color: 6 },
];
const FIELDS: FieldMeta[] = [
  { id: 'title', name: 'Title', type: FieldType.Text, isPrimary: true },
  { id: 'path', name: 'Steps passed', type: FieldType.MultiSelect, isPrimary: false, options: PATH_OPTIONS },
  { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options: STAGE_OPTIONS },
  { id: 'status', name: 'Status', type: FieldType.SingleSelect, isPrimary: false, options: STATUS_OPTIONS },
  { id: 'entered', name: 'Entered', type: FieldType.DateTime, isPrimary: false },
  { id: 'history', name: 'History', type: FieldType.Text, isPrimary: false },
  { id: 'spec', name: 'Spec link', type: FieldType.Url, isPrimary: false },
  { id: 'estimate', name: 'Estimate', type: FieldType.Number, isPrimary: false },
  { id: 'safety', name: 'Safety review', type: FieldType.Checkbox, isPrimary: false },
  { id: 'notes', name: 'Notes', type: FieldType.Text, isPrimary: false },
];

const NOW = new Date(2026, 10, 2, 14, 3).getTime();
const STAMP = '[2026-11-02 14:03]';

function makeCtx(overrides: Record<string, unknown> = {}, fields: FieldMeta[] = FIELDS): TransitionContext {
  const config: PipelineConfig = normalizeConfig(
    {
      version: CONFIG_VERSION,
      stageFieldId: 'stage',
      statusFieldId: 'status',
      enteredAtFieldId: 'entered',
      historyFieldId: 'history',
      defaultEntryStatusId: 'st_todo',
      edges: MEEGLE_EDGES,
      nodes: {
        C: {
          fields: [
            { fieldId: 'spec', required: true },
            { fieldId: 'notes', required: false },
            { fieldId: 'safety', required: true },
            { fieldId: 'estimate', required: true },
          ],
        },
        D: { fields: [], entryStatusId: 'st_review' },
      },
      ...overrides,
    },
    FIELDS,
  );
  return {
    config,
    fieldById: new Map(fields.map((f) => [f.id, f])),
    graph: buildGraph(STAGE_OPTIONS, config.edges),
    now: NOW,
  };
}

const record = (fields: Record<string, unknown>): RecordData => ({ id: 'rec1', fields });
const stage = (id: string) => ({ id, text: `Stage ${id}` });
const status = (id: string) => ({ id, text: id });
const text = (t: string) => [{ type: 'text', text: t }];
const historyOf = (...lines: string[]) => text(lines.join('\n'));
const line = (kind: 'start' | 'advance' | 'rollback' | 'complete', from: string | undefined, to: string) =>
  formatHistoryLine({ at: NOW, kind, from: from && `Stage ${from}`, to: `Stage ${to}` });
/** Path cell value ticking stages / own options ('urgent', 'vip'), in the given order. */
const ticked = (...ids: string[]) =>
  ids.map((id) => {
    const option = PATH_OPTIONS.find((o) => o.id === `p_${id}`);
    if (!option) throw new Error(`no path option for ${id}`);
    return { id: option.id, text: option.name };
  });

describe('validateNode', () => {
  it('reports missing required fields in node order with the right reason', () => {
    const ctx = makeCtx();
    const result = validateNode(ctx, record({ stage: stage('C'), estimate: 0 }), 'C');
    expect(result.missing).toEqual([
      { fieldId: 'spec', reason: 'empty' },
      { fieldId: 'safety', reason: 'unchecked' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.statusNotDone).toBe(false);
  });

  it('passes when every required field is filled (optional ones may stay empty)', () => {
    const ctx = makeCtx();
    const rec = record({
      stage: stage('C'),
      spec: [{ type: 'url', text: 'Spec', link: 'https://x.dev' }],
      safety: true,
      estimate: 3,
    });
    expect(validateNode(ctx, rec, 'C')).toEqual({ ok: true, missing: [], statusNotDone: false });
  });

  it('ignores rules whose field was deleted', () => {
    const ctx = makeCtx({}, FIELDS.filter((f) => f.id !== 'spec' && f.id !== 'safety'));
    expect(validateNode(ctx, record({ estimate: 1 }), 'C').ok).toBe(true);
  });

  it('accepts nodes without rules and unknown nodes', () => {
    const ctx = makeCtx();
    expect(validateNode(ctx, record({}), 'A').ok).toBe(true);
    expect(validateNode(ctx, record({}), 'nope').ok).toBe(true);
  });

  it('requires a done status when requireDoneToAdvance is on', () => {
    const ctx = makeCtx({ requireDoneToAdvance: true });
    const doing = validateNode(ctx, record({ stage: stage('A'), status: status('st_doing') }), 'A');
    expect(doing).toEqual({ ok: false, missing: [], statusNotDone: true });
    expect(validateNode(ctx, record({ stage: stage('A') }), 'A').statusNotDone).toBe(true);
    expect(validateNode(ctx, record({ stage: stage('A'), status: status('st_done') }), 'A').ok).toBe(true);
  });

  it('reports both problems together', () => {
    const ctx = makeCtx({ requireDoneToAdvance: true });
    const result = validateNode(ctx, record({ status: status('st_todo') }), 'C');
    expect(result.ok).toBe(false);
    expect(result.statusNotDone).toBe(true);
    expect(result.missing.map((m) => m.fieldId)).toEqual(['spec', 'safety', 'estimate']);
  });

  it('does not require a done status without a (still existing) status field', () => {
    expect(validateNode(makeCtx({ requireDoneToAdvance: true, statusFieldId: undefined }), record({}), 'A').ok).toBe(true);
    const deleted = makeCtx({ requireDoneToAdvance: true }, FIELDS.filter((f) => f.id !== 'status'));
    expect(validateNode(deleted, record({}), 'A').statusNotDone).toBe(false);
  });
});

describe('requiredProgress', () => {
  it('counts filled required fields only', () => {
    const ctx = makeCtx();
    expect(requiredProgress(ctx, record({}), 'C')).toEqual({ filled: 0, total: 3 });
    expect(requiredProgress(ctx, record({ safety: true, estimate: 0, notes: text('n') }), 'C')).toEqual({ filled: 2, total: 3 });
    expect(requiredProgress(ctx, record({}), 'A')).toEqual({ filled: 0, total: 0 });
  });

  it('skips rules whose field was deleted', () => {
    const ctx = makeCtx({}, FIELDS.filter((f) => f.id !== 'spec'));
    expect(requiredProgress(ctx, record({}), 'C')).toEqual({ filled: 0, total: 2 });
  });
});

describe('navigation', () => {
  it('currentNodeId resolves the stage cell to a node', () => {
    const ctx = makeCtx();
    expect(currentNodeId(ctx, record({ stage: stage('C') }))).toBe('C');
    expect(currentNodeId(ctx, record({}))).toBeNull();
    expect(currentNodeId(ctx, record({ stage: { id: 'gone', text: 'Old' } }))).toBeNull();
    expect(currentNodeId(makeCtx({ stageFieldId: undefined }), record({ stage: stage('C') }))).toBeNull();
  });

  it('nextTargets lists successors in option order', () => {
    const ctx = makeCtx();
    expect(nextTargets(ctx, record({ stage: stage('C') }))).toEqual(['D', 'E', 'F']);
    expect(nextTargets(ctx, record({ stage: stage('F') }))).toEqual(['H', 'I']);
    expect(nextTargets(ctx, record({ stage: stage('K') }))).toEqual([]);
    expect(nextTargets(ctx, record({}))).toEqual([]);
  });

  it('nextTargets returns a copy', () => {
    const ctx = makeCtx();
    nextTargets(ctx, record({ stage: stage('C') })).push('X');
    expect(ctx.graph.successors.get('C')).toEqual(['D', 'E', 'F']);
  });

  it('follows the linear default when edges are null', () => {
    const ctx = makeCtx({ edges: null });
    expect(nextTargets(ctx, record({ stage: stage('C') }))).toEqual(['D']);
  });
});

describe('rollbackTargets', () => {
  it('is empty when rollback is disabled or the record has not started', () => {
    expect(rollbackTargets(makeCtx({ allowRollback: false }), record({ stage: stage('J') }))).toEqual([]);
    expect(rollbackTargets(makeCtx(), record({}))).toEqual([]);
    expect(rollbackTargets(makeCtx(), record({ stage: stage('A') }))).toEqual([]);
  });

  it('lists every strict ancestor in topological order without history', () => {
    expect(rollbackTargets(makeCtx(), record({ stage: stage('H') }))).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(rollbackTargets(makeCtx({ historyFieldId: undefined }), record({ stage: stage('H'), history: historyOf(line('start', undefined, 'A')) }))).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
    ]);
  });

  it('restricts to visited ancestors when history exists', () => {
    const history = historyOf(
      line('start', undefined, 'A'),
      line('advance', 'A', 'B'),
      line('advance', 'B', 'C'),
      line('advance', 'C', 'F'),
      line('advance', 'F', 'H'),
    );
    expect(rollbackTargets(makeCtx(), record({ stage: stage('H'), history }))).toEqual(['A', 'B', 'C', 'F']);
  });

  it('offers the ancestors a partial log does not rule out', () => {
    // Logged from H on (record at J): D / E / F are unknown, G and I were not passed.
    const fromH = historyOf(line('advance', 'H', 'J'));
    expect(rollbackTargets(makeCtx(), record({ stage: stage('J'), history: fromH }))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'H']);
  });

  it('restricts to the ancestors ticked in the "Steps passed" field, which wins over history', () => {
    const ctx = makeCtx({ pathFieldId: 'path' });
    const history = historyOf(line('start', undefined, 'A'), line('advance', 'A', 'B'), line('advance', 'B', 'C'), line('advance', 'C', 'D'), line('advance', 'D', 'H'));
    // E was not passed; D has no option in the field, so the cell cannot rule it out.
    expect(rollbackTargets(ctx, record({ stage: stage('H'), path: ticked('A', 'B', 'C', 'F'), history }))).toEqual(['A', 'B', 'C', 'D', 'F']);
    // Only the user's own options: the history decides.
    expect(rollbackTargets(ctx, record({ stage: stage('H'), path: ticked('urgent'), history }))).toEqual(['A', 'B', 'C', 'D']);
    // Nothing known: every ancestor, so the record is never stuck.
    expect(rollbackTargets(ctx, record({ stage: stage('H'), path: ticked('urgent') }))).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('does not filter by history once the log names a node that no longer exists (renamed option)', () => {
    const history = historyOf(line('start', undefined, 'A'), line('advance', 'A', 'B'), line('advance', 'B', 'C'));
    const ctx = makeCtx();
    const renamed = STAGE_OPTIONS.map((o) => (o.id === 'B' ? { ...o, name: 'Stage B2' } : o));
    const tc = { ...ctx, graph: buildGraph(renamed, ctx.config.edges) };
    expect(rollbackTargets(tc, record({ stage: stage('C'), history }))).toEqual(['A', 'B']);
  });
});

describe('buildTransitionPatch', () => {
  it('start: stage, default entry status, enteredAt and a first history line', () => {
    const patch = buildTransitionPatch(makeCtx(), record({}), 'start', 'A');
    expect(patch).toEqual({
      stage: { id: 'A', text: 'Stage A' },
      status: { id: 'st_todo', text: 'Chưa bắt đầu' },
      entered: NOW,
      history: [{ type: 'text', text: `${STAMP} ▶ Stage A` }],
    });
  });

  it('advance: uses the target entry status override and appends to the existing log', () => {
    const old = historyOf(line('start', undefined, 'A'), line('advance', 'A', 'B'), line('advance', 'B', 'C'));
    const patch = buildTransitionPatch(makeCtx(), record({ stage: stage('C'), status: status('st_done'), history: old }), 'advance', 'D');
    expect(patch.stage).toEqual({ id: 'D', text: 'Stage D' });
    expect(patch.status).toEqual({ id: 'st_review', text: 'Review' });
    expect(patch.entered).toBe(NOW);
    const log = segmentsToText(patch.history);
    expect(log.split('\n')).toHaveLength(4);
    expect(log.endsWith(`\n${STAMP} Stage C → Stage D`)).toBe(true);
    expect(parseHistory(log).map((x) => x.kind)).toEqual(['start', 'advance', 'advance', 'advance']);
  });

  it('rollback: logs with the rollback arrow and resets the entry status', () => {
    const patch = buildTransitionPatch(makeCtx(), record({ stage: stage('H'), status: status('st_doing') }), 'rollback', 'C');
    expect(patch).toEqual({
      stage: { id: 'C', text: 'Stage C' },
      status: { id: 'st_todo', text: 'Chưa bắt đầu' },
      entered: NOW,
      history: [{ type: 'text', text: `${STAMP} Stage H ↩ Stage C` }],
    });
  });

  it('complete: sets the first done status and logs a check line, leaving stage and enteredAt alone', () => {
    const old = historyOf(line('advance', 'J', 'K'));
    const patch = buildTransitionPatch(makeCtx(), record({ stage: stage('K'), status: status('st_doing'), history: old }), 'complete', 'ignored');
    expect(patch).toEqual({
      status: { id: 'st_done', text: 'Hoàn thành' },
      history: [{ type: 'text', text: `${line('advance', 'J', 'K')}\n${STAMP} ✓ Stage K` }],
    });
  });

  it('complete: works for an isolated node and without a done status option', () => {
    const ctx = makeCtx({ edges: [], statusCategories: { st_todo: 'todo', st_doing: 'doing', st_done: 'doing', st_review: 'doing' } });
    const patch = buildTransitionPatch(ctx, record({ stage: stage('E') }), 'complete');
    expect(patch).toEqual({ history: [{ type: 'text', text: `${STAMP} ✓ Stage E` }] });
  });

  it('writes only the stage when no optional field is configured', () => {
    const ctx = makeCtx({ statusFieldId: undefined, enteredAtFieldId: undefined, historyFieldId: undefined });
    expect(buildTransitionPatch(ctx, record({ stage: stage('A') }), 'advance', 'B')).toEqual({ stage: { id: 'B', text: 'Stage B' } });
    expect(buildTransitionPatch(ctx, record({ stage: stage('K') }), 'complete')).toEqual({});
  });

  it('skips optional fields that were deleted from the table', () => {
    const ctx = makeCtx({}, FIELDS.filter((f) => !['status', 'entered', 'history'].includes(f.id)));
    expect(buildTransitionPatch(ctx, record({ stage: stage('A') }), 'advance', 'B')).toEqual({ stage: { id: 'B', text: 'Stage B' } });
  });

  it('omits the status when no entry status is defined', () => {
    const ctx = makeCtx();
    ctx.config = { ...ctx.config, defaultEntryStatusId: undefined };
    const patch = buildTransitionPatch(ctx, record({ stage: stage('A') }), 'advance', 'B');
    expect(patch).not.toHaveProperty('status');
    expect(buildTransitionPatch(ctx, record({ stage: stage('C') }), 'advance', 'D').status).toEqual({ id: 'st_review', text: 'Review' });
  });

  it('logs the raw stage text when the record sits on a deleted option, and a start when it has no stage', () => {
    const ctx = makeCtx();
    const fromDeleted = buildTransitionPatch(ctx, record({ stage: { id: 'gone', text: 'Old stage' } }), 'advance', 'A');
    expect(segmentsToText(fromDeleted.history)).toBe(`${STAMP} Old stage → Stage A`);
    const fromNothing = buildTransitionPatch(ctx, record({}), 'advance', 'A');
    expect(segmentsToText(fromNothing.history)).toBe(`${STAMP} ▶ Stage A`);
  });

  it('accepts a plain string history cell', () => {
    const patch = buildTransitionPatch(makeCtx(), record({ stage: stage('A'), history: 'previous line' }), 'advance', 'B');
    expect(segmentsToText(patch.history)).toBe(`previous line\n${STAMP} Stage A → Stage B`);
  });

  it('throws on misuse', () => {
    const ctx = makeCtx();
    expect(() => buildTransitionPatch(makeCtx({ stageFieldId: undefined }), record({}), 'start', 'A')).toThrow(/stage field/i);
    expect(() => buildTransitionPatch(ctx, record({}), 'start', 'nope')).toThrow(/unknown/i);
    expect(() => buildTransitionPatch(ctx, record({ stage: stage('A') }), 'advance')).toThrow(/unknown/i);
    expect(() => buildTransitionPatch(ctx, record({}), 'complete')).toThrow();
    expect(() => buildTransitionPatch(ctx, record({ stage: stage('C') }), 'complete')).toThrow(/terminal/i);
  });

  it('does not mutate the record', () => {
    const rec = record({ stage: stage('A'), history: historyOf(line('start', undefined, 'A')), path: ticked('A', 'urgent') });
    const snapshot = JSON.parse(JSON.stringify(rec));
    buildTransitionPatch(makeCtx({ pathFieldId: 'path' }), rec, 'advance', 'B');
    expect(rec).toEqual(snapshot);
  });
});

describe('buildTransitionPatch: "Steps passed" field', () => {
  const ctx = makeCtx({ pathFieldId: 'path' });
  const patchOf = (fields: Record<string, unknown>, kind: 'start' | 'advance' | 'rollback' | 'complete', to?: string) =>
    buildTransitionPatch(ctx, record(fields), kind, to).path;

  it('start: ticks the start node only, keeping the user\u2019s own options', () => {
    expect(patchOf({}, 'start', 'A')).toEqual(ticked('A'));
    expect(patchOf({ path: ticked('vip', 'C', 'B') }, 'start', 'A')).toEqual(ticked('A', 'vip'));
  });

  it('advance: adds the current and the target node, in pipeline order, own options last', () => {
    const existing = ticked('C', 'urgent', 'A', 'B');
    expect(patchOf({ stage: stage('C'), path: existing }, 'advance', 'E')).toEqual(ticked('A', 'B', 'C', 'E', 'urgent'));
  });

  it('starts an empty cell (older record) from what is known, so earlier steps stay done', () => {
    // No history: A and B lie on every route to C, so they were passed.
    expect(patchOf({ stage: stage('C') }, 'advance', 'F')).toEqual(ticked('A', 'B', 'C', 'F'));
    // A trusted history log says which branch was taken.
    const history = historyOf(line('start', undefined, 'A'), line('advance', 'A', 'B'), line('advance', 'B', 'C'), line('advance', 'C', 'F'), line('advance', 'F', 'H'));
    expect(patchOf({ stage: stage('H'), history }, 'advance', 'J')).toEqual(ticked('A', 'B', 'C', 'F', 'H'));
    // Only the user's own options so far: they are kept, the steps are still seeded.
    expect(patchOf({ stage: stage('C'), path: ticked('vip') }, 'advance', 'E')).toEqual(ticked('A', 'B', 'C', 'E', 'vip'));
  });

  it('seeds from a log that starts mid-way without marking the steps before it skipped', () => {
    // Logged from C on: A and B lie on every route, the branch after C is logged.
    const partial = historyOf(line('advance', 'C', 'F'), line('advance', 'F', 'H'));
    expect(patchOf({ stage: stage('H'), history: partial }, 'advance', 'J')).toEqual(ticked('A', 'B', 'C', 'F', 'H'));
    // Logged from H on: the branch before H stays unknown, since none of H's predecessors is ticked
    // (Stage J has no option, so it is left out).
    const fromH = historyOf(line('advance', 'H', 'J'));
    expect(patchOf({ stage: stage('J'), history: fromH }, 'advance', 'K')).toEqual(ticked('A', 'B', 'C', 'H', 'K'));
  });

  it('writes an empty cell while the branch taken is unknown without marking that branch never passed', () => {
    // At H without history: D, E or F was passed, nobody knows which.
    const atJ = record({ stage: stage('J'), path: patchOf({ stage: stage('H') }, 'advance', 'J') });
    expect(atJ.fields.path).toEqual(ticked('A', 'B', 'C', 'H'));
    const states = computeNodeStates(ctx.graph, atJ, ctx.config, ctx.fieldById).states;
    for (const id of ['D', 'E', 'F']) expect(states.get(id)).toBe('unknown');
    expect(patchOf({ stage: stage('K'), status: status('st_doing') }, 'complete')).toEqual(ticked('A', 'B', 'C', 'K'));
    // Sending it back before the branch makes the steps certain again.
    expect(patchOf({ stage: stage('H') }, 'rollback', 'C')).toEqual(ticked('A', 'B', 'C'));
    // Once something is ticked, the cell is the truth and is always maintained.
    expect(patchOf({ stage: stage('H'), path: ticked('A', 'B', 'C', 'E') }, 'advance', 'J')).toEqual(ticked('A', 'B', 'C', 'E', 'H'));
  });

  it('leaves out nodes whose name has no option in the field', () => {
    expect(patchOf({ stage: stage('C'), path: ticked('A', 'B', 'C') }, 'advance', 'D')).toEqual(ticked('A', 'B', 'C'));
    expect(patchOf({}, 'start', 'D')).toBeNull();
  });

  it('rollback: ticks the target and unticks everything after it', () => {
    const existing = ticked('A', 'B', 'C', 'F', 'H', 'vip');
    expect(patchOf({ stage: stage('H'), path: existing }, 'rollback', 'C')).toEqual(ticked('A', 'B', 'C', 'vip'));
    expect(patchOf({ stage: stage('H'), path: ticked('A', 'F', 'H') }, 'rollback', 'B')).toEqual(ticked('A', 'B'));
  });

  it('complete: ticks the terminal node', () => {
    expect(patchOf({ stage: stage('K'), status: status('st_doing'), path: ticked('I', 'A', 'urgent') }, 'complete')).toEqual(
      ticked('A', 'I', 'K', 'urgent'),
    );
  });

  it('resolves cell items by option id (stale text) or by text, and keeps items that match no option', () => {
    const existing = [
      { id: 'p_A', text: 'renamed meanwhile' },
      { id: 'unknown', text: 'Stage B' },
      { id: 'other', text: 'Not cached yet' },
    ];
    expect(patchOf({ stage: stage('B'), path: existing }, 'advance', 'C')).toEqual([
      ...ticked('A', 'B', 'C'),
      { id: 'other', text: 'Not cached yet' },
    ]);
  });

  it('is written alongside the other cells in the same patch', () => {
    const patch = buildTransitionPatch(ctx, record({ stage: stage('A'), path: ticked('A') }), 'advance', 'B');
    expect(Object.keys(patch).sort()).toEqual(['entered', 'history', 'path', 'stage', 'status']);
  });

  it('seeds an empty cell by replaying the log, so a branch undone by a rollback is not ticked', () => {
    const history = historyOf(
      line('start', undefined, 'A'),
      line('advance', 'A', 'B'),
      line('advance', 'B', 'C'),
      line('advance', 'C', 'F'),
      line('rollback', 'F', 'C'),
      line('advance', 'C', 'E'),
    );
    expect(patchOf({ stage: stage('E'), history }, 'advance', 'H')).toEqual(ticked('A', 'B', 'C', 'E', 'H'));
    // Without a start line: from the first logged step on, plus the steps on every route to it.
    const partial = historyOf(line('advance', 'C', 'F'), line('rollback', 'F', 'C'), line('advance', 'C', 'E'));
    expect(patchOf({ stage: stage('E'), history: partial }, 'advance', 'H')).toEqual(ticked('A', 'B', 'C', 'E', 'H'));
  });

  it('drops ticks that do not lead to the current step (stage changed outside the plugin) before adding', () => {
    // Ticked A → B → C → F → H, then the stage was set back to E in the grid.
    expect(patchOf({ stage: stage('E'), path: ticked('A', 'B', 'C', 'F', 'H') }, 'advance', 'H')).toEqual(
      ticked('A', 'B', 'C', 'E', 'H'),
    );
    expect(patchOf({ stage: stage('K'), status: status('st_doing'), path: ticked('A', 'B', 'C', 'F', 'I', 'vip') }, 'complete')).toEqual(
      ticked('A', 'B', 'C', 'F', 'I', 'K', 'vip'),
    );
  });

  it('keeps cell items whose option is not in the cached field metadata (added meanwhile elsewhere)', () => {
    const existing = [...ticked('A', 'B'), { id: 'optNew', text: 'Gấp' }];
    expect(patchOf({ stage: stage('B'), path: existing }, 'advance', 'C')).toEqual([...ticked('A', 'B', 'C'), { id: 'optNew', text: 'Gấp' }]);
    // Such an item naming a step counts as that step's option: it is kept, and not created again.
    const named = [...ticked('A', 'B', 'C'), { id: 'optD', text: 'Stage D' }];
    expect(patchOf({ stage: stage('D'), path: named }, 'advance', 'H')).toEqual([
      ...ticked('A', 'B', 'C'),
      { id: 'optD', text: 'Stage D' },
      ...ticked('H'),
    ]);
    expect(missingPathOptionNames(ctx, record({ stage: stage('D'), path: named }), 'advance', 'H')).toEqual([]);
  });

  it('is not written when the path field is unset, deleted or not a MultiSelect', () => {
    const rec = record({ stage: stage('A'), path: ticked('A') });
    expect(buildTransitionPatch(makeCtx(), rec, 'advance', 'B')).not.toHaveProperty('path');
    const deleted = makeCtx({ pathFieldId: 'path' }, FIELDS.filter((f) => f.id !== 'path'));
    expect(buildTransitionPatch(deleted, rec, 'advance', 'B')).not.toHaveProperty('path');
    const wrongType = makeCtx();
    wrongType.config = { ...wrongType.config, pathFieldId: 'notes' };
    expect(buildTransitionPatch(wrongType, rec, 'advance', 'B')).not.toHaveProperty('notes');
  });
});

describe('missingPathOptionNames', () => {
  const ctx = makeCtx({ pathFieldId: 'path' });

  it('names the nodes the patch would tick but the field has no option for', () => {
    expect(missingPathOptionNames(ctx, record({ stage: stage('C') }), 'advance', 'D')).toEqual(['Stage D']);
    expect(missingPathOptionNames(ctx, record({ stage: stage('D') }), 'advance', 'H')).toEqual(['Stage D']);
    expect(missingPathOptionNames(ctx, record({ stage: stage('J'), path: ticked('A', 'B', 'C', 'F', 'I') }), 'complete')).toEqual(['Stage J']);
    expect(missingPathOptionNames(ctx, record({ stage: stage('H') }), 'rollback', 'D')).toEqual(['Stage D']);
    expect(missingPathOptionNames(ctx, record({}), 'start', 'D')).toEqual(['Stage D']);
  });

  it('is empty when every needed option exists', () => {
    expect(missingPathOptionNames(ctx, record({ stage: stage('C'), path: ticked('A', 'B', 'C') }), 'advance', 'E')).toEqual([]);
    // Rolling back to C from J unticks D / J, so their missing options are not needed.
    expect(missingPathOptionNames(ctx, record({ stage: stage('J') }), 'rollback', 'C')).toEqual([]);
  });

  it('lists names once, trimmed, in pipeline order', () => {
    const options: SelectOption[] = [
      { id: 'n1', name: '  Review  ', color: 0 },
      { id: 'n2', name: 'Build', color: 1 },
    ];
    const fields: FieldMeta[] = [
      { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options },
      { id: 'path', name: 'Steps passed', type: FieldType.MultiSelect, isPrimary: false, options: [] },
    ];
    const config = normalizeConfig({ version: CONFIG_VERSION, stageFieldId: 'stage', pathFieldId: 'path' }, fields);
    const tc: TransitionContext = { config, fieldById: new Map(fields.map((f) => [f.id, f])), graph: buildGraph(options, null), now: NOW };
    expect(missingPathOptionNames(tc, record({ stage: { id: 'n1', text: 'Review' } }), 'advance', 'n2')).toEqual(['Review', 'Build']);
  });

  it('names the steps a seeded cell needs while the branch is unknown', () => {
    // At J with nothing recorded: A, B, C lie on every route; J itself has no option.
    expect(missingPathOptionNames(ctx, record({ stage: stage('J') }), 'complete')).toEqual(['Stage J']);
  });

  it('is empty when no path field is configured or the transition cannot be built', () => {
    expect(missingPathOptionNames(makeCtx(), record({ stage: stage('C') }), 'advance', 'D')).toEqual([]);
    expect(missingPathOptionNames(ctx, record({ stage: stage('C') }), 'advance', 'nope')).toEqual([]);
    expect(missingPathOptionNames(ctx, record({ stage: stage('C') }), 'advance')).toEqual([]);
    expect(missingPathOptionNames(ctx, record({}), 'complete')).toEqual([]);
  });
});

describe('"Steps passed" on branching pipelines (reviewer scenarios)', () => {
  /** Context over `options` / `edges` with a path field ticking every step and, optionally, a history field. */
  function branchCtx(options: SelectOption[], edges: Edge[], withHistory = false): TransitionContext {
    const fields: FieldMeta[] = [
      { id: 'stage', name: 'Stage', type: FieldType.SingleSelect, isPrimary: false, options },
      {
        id: 'path',
        name: 'Các bước đã qua',
        type: FieldType.MultiSelect,
        isPrimary: false,
        options: options.map((o) => ({ ...o, id: `p_${o.id}` })),
      },
      ...(withHistory ? [{ id: 'history', name: 'History', type: FieldType.Text, isPrimary: false }] : []),
    ];
    const config = normalizeConfig(
      { version: CONFIG_VERSION, stageFieldId: 'stage', pathFieldId: 'path', historyFieldId: withHistory ? 'history' : undefined, edges },
      fields,
    );
    return { config, fieldById: new Map(fields.map((f) => [f.id, f])), graph: buildGraph(options, edges), now: NOW };
  }
  const opt = (id: string, name: string, color = 0): SelectOption => ({ id, name, color });
  const cell = (tc: TransitionContext, ...ids: string[]) =>
    ids.map((id) => ({ id: `p_${id}`, text: tc.graph.nodeById.get(id)?.name ?? id }));
  /** Applies a transition patch to a record (what the host stores). */
  const apply = (tc: TransitionContext, rec: RecordData, kind: 'advance' | 'rollback' | 'complete', to?: string): RecordData => ({
    ...rec,
    fields: { ...rec.fields, ...buildTransitionPatch(tc, rec, kind, to) },
  });
  const statesAfter = (tc: TransitionContext, rec: RecordData) =>
    Object.fromEntries(computeNodeStates(tc.graph, rec, tc.config, tc.fieldById).states);

  const contract = [
    opt('draft', 'Soạn HĐ'),
    opt('wait', 'Chờ ký'),
    opt('signed', 'Đã ký/Hiệu lực'),
    opt('closed', 'Hoàn thành/Thanh lý'),
    opt('cancel', 'Hủy'),
  ];
  const contractEdges = [
    e('draft', 'wait'),
    e('draft', 'signed'),
    e('draft', 'closed'),
    e('wait', 'cancel'),
    e('signed', 'cancel'),
    e('closed', 'cancel'),
  ];

  it('first write after a rollback in the log does not tick the abandoned branch', () => {
    const tc = branchCtx(contract, contractEdges, true);
    const log = (...lines: string[]) => text(lines.join('\n'));
    const at = (kind: 'start' | 'advance' | 'rollback', from: string | undefined, to: string) =>
      formatHistoryLine({ at: NOW, kind, from, to });
    const steps = [
      at('advance', 'Soạn HĐ', 'Đã ký/Hiệu lực'),
      at('advance', 'Đã ký/Hiệu lực', 'Hủy'),
      at('rollback', 'Hủy', 'Soạn HĐ'),
      at('advance', 'Soạn HĐ', 'Chờ ký'),
    ];
    const rec = record({ stage: { id: 'wait', text: 'Chờ ký' }, history: log(at('start', undefined, 'Soạn HĐ'), ...steps) });
    const moved = apply(tc, rec, 'advance', 'cancel');
    expect(moved.fields.path).toEqual(cell(tc, 'draft', 'wait', 'cancel'));
    expect(statesAfter(tc, moved)).toEqual({ draft: 'done', wait: 'done', signed: 'skipped', closed: 'skipped', cancel: 'active' });
    // Same log without its start line.
    const noStart = record({ ...rec.fields, history: log(...steps) });
    expect(buildTransitionPatch(tc, noStart, 'advance', 'cancel').path).toEqual(cell(tc, 'draft', 'wait', 'cancel'));
  });

  it('records a branch the plugin chose even while an earlier branch is unknown', () => {
    // A → {B, C} → D → {E, F} → G, path field only; the record sits at D with nothing recorded.
    const options = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id, i) => opt(id, `Step ${id}`, i));
    const edges = [e('A', 'B'), e('A', 'C'), e('B', 'D'), e('C', 'D'), e('D', 'E'), e('D', 'F'), e('E', 'G'), e('F', 'G')];
    const tc = branchCtx(options, edges);
    const atE = apply(tc, record({ stage: { id: 'D', text: 'Step D' } }), 'advance', 'E');
    expect(atE.fields.path).toEqual(cell(tc, 'A', 'D', 'E'));
    const atG = apply(tc, atE, 'advance', 'G');
    expect(atG.fields.path).toEqual(cell(tc, 'A', 'D', 'E', 'G'));
    expect(statesAfter(tc, atG)).toEqual({ A: 'done', B: 'unknown', C: 'unknown', D: 'done', E: 'done', F: 'skipped', G: 'active' });
    expect(rollbackTargets(tc, atG)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('does not tick a step on every route when that would hide an unknown branch behind a shortcut edge', () => {
    // A → D directly, or through B or C. At D without any record, B / C are unknown.
    const options = ['A', 'B', 'C', 'D', 'E'].map((id, i) => opt(id, `Step ${id}`, i));
    const edges = [e('A', 'B'), e('A', 'C'), e('A', 'D'), e('B', 'D'), e('C', 'D'), e('D', 'E')];
    const tc = branchCtx(options, edges);
    const atE = apply(tc, record({ stage: { id: 'D', text: 'Step D' } }), 'advance', 'E');
    // Ticking A would make "A → D" look like the recorded route and B / C look skipped.
    expect(atE.fields.path).toEqual(cell(tc, 'D', 'E'));
    expect(statesAfter(tc, atE)).toEqual({ A: 'done', B: 'unknown', C: 'unknown', D: 'done', E: 'active' });
  });

  it('a stage moved back in the grid, then advanced in the plugin, ticks only the branch taken', () => {
    const tc = branchCtx(contract, contractEdges);
    // Path says Soạn HĐ → Đã ký → Hủy; the stage was then set to Chờ ký in the grid.
    const rec = record({ stage: { id: 'wait', text: 'Chờ ký' }, path: cell(tc, 'draft', 'signed', 'cancel') });
    const moved = apply(tc, rec, 'advance', 'cancel');
    expect(moved.fields.path).toEqual(cell(tc, 'draft', 'wait', 'cancel'));
    expect(statesAfter(tc, moved)).toEqual({ draft: 'done', wait: 'done', signed: 'skipped', closed: 'skipped', cancel: 'active' });
  });

  it('writes the cell at a terminal step without claiming which branch led there', () => {
    const tc = branchCtx(contract, contractEdges);
    const done = apply(tc, record({ stage: { id: 'cancel', text: 'Hủy' } }), 'complete');
    expect(done.fields.path).toEqual(cell(tc, 'draft', 'cancel'));
    expect(statesAfter(tc, done)).toEqual({ draft: 'done', wait: 'unknown', signed: 'unknown', closed: 'unknown', cancel: 'active' });
  });
});
