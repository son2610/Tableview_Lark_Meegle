/**
 * Regression for the user's contract pipeline (real Lark report):
 *   Soạn HĐ → {Chờ ký, Đã ký/Hiệu lực, Hoàn thành/Thanh lý} → Hủy
 * A record that went Soạn HĐ → Đã ký → Hủy must not show every branch as done.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, FieldType } from '../../types';
import type { FieldMeta, NodeState, RecordData, SelectOption } from '../../types';
import { getSelectId, getMultiSelectIds } from '../cell';
import { normalizeConfig } from '../config';
import { buildGraph } from '../graph';
import { computeNodeStates } from '../state';
import { buildTransitionPatch } from '../transitions';
import type { TransitionContext } from '../transitions';

const STAGES: SelectOption[] = [
  { id: 'soan', name: 'Soạn HĐ', color: 0 },
  { id: 'cho', name: 'Chờ ký', color: 1 },
  { id: 'daky', name: 'Đã ký/Hiệu lực', color: 2 },
  { id: 'xong', name: 'Hoàn thành/Thanh lý', color: 3 },
  { id: 'huy', name: 'Hủy', color: 4 },
];
const EDGES = [
  { from: 'soan', to: 'cho' },
  { from: 'soan', to: 'daky' },
  { from: 'soan', to: 'xong' },
  { from: 'cho', to: 'huy' },
  { from: 'daky', to: 'huy' },
  { from: 'xong', to: 'huy' },
];
// The "Các bước đã qua" field has its own option ids, matched to steps by name.
const PATH_OPTIONS: SelectOption[] = STAGES.map((s) => ({ id: `p_${s.id}`, name: s.name, color: s.color }));

const fields = (withPath: boolean): FieldMeta[] => [
  { id: 'title', name: 'Mã HĐ', type: FieldType.Text, isPrimary: true },
  { id: 'stage', name: 'Trạng thái HĐ', type: FieldType.SingleSelect, isPrimary: false, options: STAGES },
  ...(withPath
    ? [{ id: 'path', name: 'Các bước đã qua', type: FieldType.MultiSelect, isPrimary: false, options: PATH_OPTIONS }]
    : []),
];

const setup = (withPath: boolean) => {
  const fieldList = fields(withPath);
  const config = normalizeConfig(
    { version: CONFIG_VERSION, stageFieldId: 'stage', pathFieldId: withPath ? 'path' : undefined, edges: EDGES },
    fieldList,
  );
  const fieldById = new Map(fieldList.map((f) => [f.id, f]));
  const graph = buildGraph(STAGES, config.edges);
  return { config, fieldById, graph };
};

const stateNames = (s: ReturnType<typeof setup>, record: RecordData): Record<string, NodeState> => {
  const { states } = computeNodeStates(s.graph, record, s.config, s.fieldById);
  return Object.fromEntries(STAGES.map((n) => [n.name, states.get(n.id) as NodeState]));
};

/** Apply a transition the way the view does: one patch merged into the record. */
const move = (s: ReturnType<typeof setup>, record: RecordData, kind: 'start' | 'advance' | 'rollback', to: string, now: number) => {
  const ctx: TransitionContext = { ...s, now };
  return { ...record, fields: { ...record.fields, ...buildTransitionPatch(ctx, record, kind, to) } };
};

describe('contract pipeline: which branch was taken', () => {
  it('without any visit info, only the must-pass step is green; branches are unknown', () => {
    const s = setup(false);
    const record: RecordData = { id: 'r1', fields: { stage: { id: 'huy', text: 'Hủy' } } };
    expect(stateNames(s, record)).toEqual({
      'Soạn HĐ': 'done',
      'Chờ ký': 'unknown',
      'Đã ký/Hiệu lực': 'unknown',
      'Hoàn thành/Thanh lý': 'unknown',
      Hủy: 'active',
    });
  });

  it('a hand-ticked "Các bước đã qua" cell decides the branch (backfilling old records)', () => {
    const s = setup(true);
    const record: RecordData = {
      id: 'r1',
      fields: {
        stage: { id: 'huy', text: 'Hủy' },
        path: [
          { id: 'p_soan', text: 'Soạn HĐ' },
          { id: 'p_daky', text: 'Đã ký/Hiệu lực' },
        ],
      },
    };
    expect(stateNames(s, record)).toEqual({
      'Soạn HĐ': 'done',
      'Chờ ký': 'skipped',
      'Đã ký/Hiệu lực': 'done',
      'Hoàn thành/Thanh lý': 'skipped',
      Hủy: 'active',
    });
  });

  it('moves made in the view record the path, including after a rollback to another branch', () => {
    const s = setup(true);
    let record: RecordData = { id: 'r1', fields: {} };
    let t = new Date(2026, 10, 1, 9, 0).getTime();
    record = move(s, record, 'start', 'soan', (t += 60_000));
    record = move(s, record, 'advance', 'daky', (t += 60_000));
    record = move(s, record, 'advance', 'huy', (t += 60_000));

    expect(getSelectId(record.fields.stage)).toBe('huy');
    expect(getMultiSelectIds(record.fields.path)).toEqual(['p_soan', 'p_daky', 'p_huy']);
    expect(stateNames(s, record)['Đã ký/Hiệu lực']).toBe('done');
    expect(stateNames(s, record)['Chờ ký']).toBe('skipped');

    // Sent back to the start, then the other branch is taken: the abandoned branch is no longer "done".
    record = move(s, record, 'rollback', 'soan', (t += 60_000));
    record = move(s, record, 'advance', 'cho', (t += 60_000));
    record = move(s, record, 'advance', 'huy', (t += 60_000));
    expect(getMultiSelectIds(record.fields.path)).toEqual(['p_soan', 'p_cho', 'p_huy']);
    expect(stateNames(s, record)).toEqual({
      'Soạn HĐ': 'done',
      'Chờ ký': 'done',
      'Đã ký/Hiệu lực': 'skipped',
      'Hoàn thành/Thanh lý': 'skipped',
      Hủy: 'active',
    });
  });
});
