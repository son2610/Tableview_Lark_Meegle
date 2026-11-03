import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, FieldType } from '../../types';
import type { Edge, FieldMeta, PipelineConfig, RecordData, SelectOption } from '../../types';
import { segmentsToText } from '../cell';
import { normalizeConfig } from '../config';
import { buildGraph } from '../graph';
import { formatHistoryLine, parseHistory } from '../history';
import {
  buildTransitionPatch,
  currentNodeId,
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
const FIELDS: FieldMeta[] = [
  { id: 'title', name: 'Title', type: FieldType.Text, isPrimary: true },
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
    const rec = record({ stage: stage('A'), history: historyOf(line('start', undefined, 'A')) });
    const snapshot = JSON.parse(JSON.stringify(rec));
    buildTransitionPatch(makeCtx(), rec, 'advance', 'B');
    expect(rec).toEqual(snapshot);
  });
});
