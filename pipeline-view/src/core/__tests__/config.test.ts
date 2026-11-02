import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, FieldType } from '../../types';
import type { FieldMeta, PipelineConfig, SelectOption, StatusCategory } from '../../types';
import {
  createDefaultConfig,
  getDoneStatusId,
  getEntryStatusId,
  getNodeConfig,
  guessStatusCategory,
  isConfigured,
  normalizeConfig,
} from '../config';

const field = (id: string, name: string, type: FieldType, extra: Partial<FieldMeta> = {}): FieldMeta => ({
  id,
  name,
  type,
  isPrimary: false,
  ...extra,
});
const options = (...names: string[]): SelectOption[] => names.map((name, i) => ({ id: `o${i}_${name}`, name, color: i }));

const STAGE_OPTIONS: SelectOption[] = [
  { id: 's1', name: 'Detail Review', color: 0 },
  { id: 's2', name: 'Tech Design', color: 1 },
  { id: 's3', name: 'Release', color: 2 },
];
const STATUS_OPTIONS: SelectOption[] = [
  { id: 'st_todo', name: 'Chưa bắt đầu', color: 0 },
  { id: 'st_doing', name: 'Đang thực hiện', color: 1 },
  { id: 'st_done', name: 'Hoàn thành', color: 2 },
  { id: 'st_block', name: 'Tạm dừng', color: 3 },
];

const FIELDS: FieldMeta[] = [
  field('f_title', 'Tên công việc', FieldType.Text, { isPrimary: true }),
  field('f_priority', 'Priority', FieldType.SingleSelect, { options: options('High', 'Low') }),
  field('f_stage', 'Giai đoạn', FieldType.SingleSelect, { options: STAGE_OPTIONS }),
  field('f_status', 'Trạng thái', FieldType.SingleSelect, { options: STATUS_OPTIONS }),
  field('f_entered', 'Entered at', FieldType.DateTime),
  field('f_history', 'History', FieldType.Text),
  field('f_owner', 'Owner', FieldType.User),
  field('f_qa', 'QA', FieldType.User),
  field('f_check', 'Safety review', FieldType.Checkbox),
  field('f_num', 'Estimate', FieldType.Number),
];

const validRaw = (): Record<string, unknown> => ({
  version: CONFIG_VERSION,
  titleFieldId: 'f_title',
  stageFieldId: 'f_stage',
  statusFieldId: 'f_status',
  enteredAtFieldId: 'f_entered',
  historyFieldId: 'f_history',
  sourceViewId: 'vew1',
  statusCategories: { st_todo: 'todo', st_doing: 'doing', st_done: 'done', st_block: 'blocked' },
  defaultEntryStatusId: 'st_todo',
  requireDoneToAdvance: true,
  allowRollback: false,
  nodes: {
    s1: { fields: [{ fieldId: 'f_num', required: true }], ownerFieldId: 'f_owner', entryStatusId: 'st_doing', description: 'Check it' },
    s2: { fields: [] },
    s3: { fields: [{ fieldId: 'f_check', required: false }] },
  },
  edges: [{ from: 's1', to: 's2' }, { from: 's2', to: 's3' }],
  roleFieldIds: ['f_owner', 'f_qa'],
  checklistFieldIds: ['f_check'],
  listFieldIds: ['f_num'],
});

describe('guessStatusCategory', () => {
  const table: [string, StatusCategory][] = [
    // English
    ['Done', 'done'],
    ['Completed', 'done'],
    ['Complete', 'done'],
    ['Finished', 'done'],
    ['Closed', 'done'],
    ['Resolved', 'done'],
    ['Approved', 'done'],
    ['Blocked', 'blocked'],
    ['Stuck', 'blocked'],
    ['On hold', 'blocked'],
    ['Cancelled', 'blocked'],
    ['Canceled', 'blocked'],
    ['Rejected', 'blocked'],
    ['In progress', 'doing'],
    ['IN_PROGRESS', 'doing'],
    ['in-progress', 'doing'],
    ['Doing', 'doing'],
    ['Working on it', 'doing'],
    ['Under review', 'doing'],
    ['Reviewing', 'doing'],
    ['Testing', 'doing'],
    ['Active', 'doing'],
    ['Started', 'doing'],
    ['Not started', 'todo'],
    ['Not yet started', 'todo'],
    ['Pending Design', 'todo'],
    ['Pending review', 'todo'],
    ['Todo', 'todo'],
    ['To do', 'todo'],
    ['New', 'todo'],
    ['Open', 'todo'],
    ['Reopened', 'todo'],
    ['Inactive', 'todo'],
    ['Notes', 'todo'],
    ['', 'todo'],
    // Vietnamese (composed and decomposed forms, any case)
    ['Hoàn thành', 'done'],
    ['HOÀN THÀNH', 'done'],
    ['Hoàn thành'.normalize('NFD'), 'done'],
    ['Đã xong', 'done'],
    ['Xong', 'done'],
    ['Đã duyệt', 'done'],
    ['Đang thực hiện', 'doing'],
    ['đang review', 'doing'],
    ['Thực hiện', 'doing'],
    ['Tạm dừng', 'blocked'],
    ['Bị chặn', 'blocked'],
    ['Đã hủy', 'blocked'],
    ['Từ chối', 'blocked'],
    ['Chưa bắt đầu', 'todo'],
    ['Chưa thực hiện', 'todo'],
    ['Chưa xong', 'todo'],
    ['Mới', 'todo'],
    ['Chờ duyệt', 'todo'],
    // Chinese
    ['完成', 'done'],
    ['已完成', 'done'],
    ['阻塞', 'blocked'],
    ['暂停', 'blocked'],
    ['进行中', 'doing'],
    ['未开始', 'todo'],
    ['未完成', 'todo'],
    ['待处理', 'todo'],
  ];

  it.each(table)('%j -> %s', (name, expected) => {
    expect(guessStatusCategory(name)).toBe(expected);
  });

  it('never throws on non-string input', () => {
    expect(guessStatusCategory(undefined as unknown as string)).toBe('todo');
    expect(guessStatusCategory(42 as unknown as string)).toBe('todo');
  });
});

describe('createDefaultConfig', () => {
  it('guesses title, stage and status fields from names (Vietnamese hints included)', () => {
    const cfg = createDefaultConfig(FIELDS);
    expect(cfg.version).toBe(CONFIG_VERSION);
    expect(cfg.titleFieldId).toBe('f_title');
    expect(cfg.stageFieldId).toBe('f_stage');
    expect(cfg.statusFieldId).toBe('f_status');
    expect(cfg.enteredAtFieldId).toBeUndefined();
    expect(cfg.historyFieldId).toBeUndefined();
    expect(cfg.sourceViewId).toBeUndefined();
  });

  it('guesses status categories and picks the first todo status as default entry', () => {
    const cfg = createDefaultConfig(FIELDS);
    expect(cfg.statusCategories).toEqual({ st_todo: 'todo', st_doing: 'doing', st_done: 'done', st_block: 'blocked' });
    expect(cfg.defaultEntryStatusId).toBe('st_todo');
  });

  it('uses the documented defaults for flags, nodes, edges and lists', () => {
    const cfg = createDefaultConfig(FIELDS);
    expect(cfg.requireDoneToAdvance).toBe(false);
    expect(cfg.allowRollback).toBe(true);
    expect(cfg.edges).toBeNull();
    expect(cfg.nodes).toEqual({ s1: { fields: [] }, s2: { fields: [] }, s3: { fields: [] } });
    expect(cfg.roleFieldIds).toEqual([]);
    expect(cfg.checklistFieldIds).toEqual([]);
    expect(cfg.listFieldIds).toEqual([]);
  });

  it('prefers an exact stage name and English / Chinese hints', () => {
    const fields = [
      field('a', 'Workflow notes', FieldType.SingleSelect, { options: [] }),
      field('b', 'Stage', FieldType.SingleSelect, { options: [] }),
      field('c', '状态', FieldType.SingleSelect, { options: [] }),
    ];
    const cfg = createDefaultConfig(fields);
    expect(cfg.stageFieldId).toBe('b');
    expect(cfg.statusFieldId).toBe('c');
    expect(createDefaultConfig([field('z', '流程阶段', FieldType.SingleSelect, { options: [] })]).stageFieldId).toBe('z');
  });

  it('falls back to the first SingleSelect that does not look like a status field', () => {
    const fields = [
      field('st', 'Status', FieldType.SingleSelect, { options: options('Done') }),
      field('cat', 'Category', FieldType.SingleSelect, { options: options('X', 'Y') }),
    ];
    const cfg = createDefaultConfig(fields);
    expect(cfg.stageFieldId).toBe('cat');
    expect(cfg.statusFieldId).toBe('st');
  });

  it('uses the only SingleSelect as stage even if it is named like a status', () => {
    const cfg = createDefaultConfig([field('st', 'Status', FieldType.SingleSelect, { options: options('A') })]);
    expect(cfg.stageFieldId).toBe('st');
    expect(cfg.statusFieldId).toBeUndefined();
  });

  it('leaves stage/status undefined when the table has no SingleSelect field', () => {
    const cfg = createDefaultConfig([field('t', 'Name', FieldType.Text, { isPrimary: true })]);
    expect(cfg.stageFieldId).toBeUndefined();
    expect(cfg.statusFieldId).toBeUndefined();
    expect(cfg.nodes).toEqual({});
    expect(cfg.statusCategories).toEqual({});
    expect(cfg.defaultEntryStatusId).toBeUndefined();
    expect(isConfigured(cfg, [])).toBe(false);
  });

  it('defaults the entry status to the first option when no option looks like todo', () => {
    const fields = [
      field('stage', 'Stage', FieldType.SingleSelect, { options: options('A') }),
      field('status', 'Status', FieldType.SingleSelect, { options: options('In progress', 'Done') }),
    ];
    expect(createDefaultConfig(fields).defaultEntryStatusId).toBe('o0_In progress');
  });

  it('works with an empty field list', () => {
    const cfg = createDefaultConfig([]);
    expect(cfg.titleFieldId).toBeUndefined();
    expect(cfg.stageFieldId).toBeUndefined();
  });
});

describe('normalizeConfig', () => {
  it('keeps a valid config intact', () => {
    const raw = validRaw();
    const cfg = normalizeConfig(raw, FIELDS);
    expect(cfg).toEqual({
      ...raw,
      nodes: {
        s1: { fields: [{ fieldId: 'f_num', required: true }], ownerFieldId: 'f_owner', entryStatusId: 'st_doing', description: 'Check it' },
        s2: { fields: [] },
        s3: { fields: [{ fieldId: 'f_check', required: false }] },
      },
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'pipeline'],
    ['a number', 42],
    ['an array', [validRaw()]],
    ['a wrong version', { ...validRaw(), version: 2 }],
    ['a string version', { ...validRaw(), version: '1' }],
    ['no version', { stageFieldId: 'f_stage' }],
  ])('falls back to the default config for %s', (_label, raw) => {
    expect(normalizeConfig(raw, FIELDS)).toEqual(createDefaultConfig(FIELDS));
  });

  it('never throws, even for hostile objects or garbage field lists', () => {
    const hostile = { version: CONFIG_VERSION };
    Object.defineProperty(hostile, 'stageFieldId', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(() => normalizeConfig(hostile, FIELDS)).not.toThrow();
    expect(normalizeConfig(hostile, FIELDS)).toEqual(createDefaultConfig(FIELDS));
    expect(() => normalizeConfig(validRaw(), null as unknown as FieldMeta[])).not.toThrow();
    expect(() => normalizeConfig(validRaw(), [null, 1, 'x', {}] as unknown as FieldMeta[])).not.toThrow();
    expect(normalizeConfig(validRaw(), null as unknown as FieldMeta[]).stageFieldId).toBeUndefined();
  });

  it('survives wrong types in every property', () => {
    const raw = {
      version: CONFIG_VERSION,
      titleFieldId: 12,
      stageFieldId: ['f_stage'],
      statusFieldId: { id: 'f_status' },
      enteredAtFieldId: true,
      historyFieldId: null,
      sourceViewId: 5,
      statusCategories: 'todo',
      defaultEntryStatusId: 3,
      requireDoneToAdvance: 'yes',
      allowRollback: 0,
      nodes: [1, 2],
      edges: 'linear',
      roleFieldIds: 'f_owner',
      checklistFieldIds: { 0: 'f_check' },
      listFieldIds: null,
    };
    const cfg = normalizeConfig(raw, FIELDS);
    expect(cfg).toEqual({
      version: CONFIG_VERSION,
      titleFieldId: 'f_title',
      stageFieldId: undefined,
      statusFieldId: undefined,
      enteredAtFieldId: undefined,
      historyFieldId: undefined,
      sourceViewId: undefined,
      statusCategories: {},
      defaultEntryStatusId: undefined,
      requireDoneToAdvance: false,
      allowRollback: true,
      nodes: {},
      edges: null,
      roleFieldIds: [],
      checklistFieldIds: [],
      listFieldIds: [],
    });
  });

  it('drops field ids that no longer exist or have the wrong type', () => {
    const raw = {
      ...validRaw(),
      titleFieldId: 'deleted',
      enteredAtFieldId: 'f_num', // not a DateTime
      historyFieldId: 'f_check', // not a Text
      roleFieldIds: ['f_owner', 'f_check', 'deleted', 'f_owner', 7, 'f_qa'],
      checklistFieldIds: ['f_owner', 'f_check', 'f_check'],
      listFieldIds: ['f_num', 'gone', 'f_title', 'f_num'],
    };
    const cfg = normalizeConfig(raw, FIELDS);
    expect(cfg.titleFieldId).toBe('f_title'); // falls back to primary
    expect(cfg.enteredAtFieldId).toBeUndefined();
    expect(cfg.historyFieldId).toBeUndefined();
    expect(cfg.roleFieldIds).toEqual(['f_owner', 'f_qa']);
    expect(cfg.checklistFieldIds).toEqual(['f_check']);
    expect(cfg.listFieldIds).toEqual(['f_num', 'f_title']);
  });

  it('drops a stage field that was deleted or is not a SingleSelect (no silent re-guess)', () => {
    const deleted = normalizeConfig({ ...validRaw(), stageFieldId: 'gone' }, FIELDS);
    expect(deleted.stageFieldId).toBeUndefined();
    expect(deleted.nodes).toEqual({});
    expect(deleted.edges).toBeNull();
    expect(isConfigured(deleted, FIELDS)).toBe(false);
    expect(normalizeConfig({ ...validRaw(), stageFieldId: 'f_num' }, FIELDS).stageFieldId).toBeUndefined();
  });

  it('drops a status field that is the stage field itself', () => {
    const cfg = normalizeConfig({ ...validRaw(), statusFieldId: 'f_stage' }, FIELDS);
    expect(cfg.statusFieldId).toBeUndefined();
    expect(cfg.statusCategories).toEqual({});
    expect(cfg.defaultEntryStatusId).toBeUndefined();
  });

  it('creates exactly one node entry per current stage option', () => {
    const raw = { ...validRaw(), nodes: { s1: { fields: [] }, deleted_option: { fields: [] } } };
    const cfg = normalizeConfig(raw, FIELDS);
    expect(Object.keys(cfg.nodes)).toEqual(['s1', 's2', 's3']);
    expect(cfg.nodes.s2).toEqual({ fields: [] });
    expect(cfg.nodes).not.toHaveProperty('deleted_option');
  });

  it('repairs node rules: dangling fields, duplicates, wrong types', () => {
    const raw = {
      ...validRaw(),
      nodes: {
        s1: {
          fields: [
            { fieldId: 'f_num', required: true },
            { fieldId: 'deleted', required: true },
            { fieldId: 'f_num', required: false },
            { fieldId: 'f_check', required: 'yes' },
            'f_title',
            null,
            { required: true },
          ],
          ownerFieldId: 'f_num', // not a User field
          entryStatusId: 'stale',
          description: 42,
        },
        s2: 'garbage',
        s3: { fields: 'nope', ownerFieldId: 'f_qa', entryStatusId: 'st_done', description: '' },
      },
    };
    const cfg = normalizeConfig(raw, FIELDS);
    expect(cfg.nodes.s1).toEqual({
      fields: [
        { fieldId: 'f_num', required: true },
        { fieldId: 'f_check', required: false },
      ],
    });
    expect(cfg.nodes.s2).toEqual({ fields: [] });
    expect(cfg.nodes.s3).toEqual({ fields: [], ownerFieldId: 'f_qa', entryStatusId: 'st_done' });
  });

  it('cleans edges but keeps an intentionally empty edge list', () => {
    const raw = {
      ...validRaw(),
      edges: [
        { from: 's1', to: 's2' },
        { from: 's1', to: 's2' },
        { from: 's2', to: 's2' },
        { from: 's2', to: 'deleted' },
        { from: 'deleted', to: 's3' },
        { from: 's1' },
        null,
        { from: 's1', to: 's3' },
      ],
    };
    expect(normalizeConfig(raw, FIELDS).edges).toEqual([
      { from: 's1', to: 's2' },
      { from: 's1', to: 's3' },
    ]);
    expect(normalizeConfig({ ...validRaw(), edges: [] }, FIELDS).edges).toEqual([]);
    expect(normalizeConfig({ ...validRaw(), edges: null }, FIELDS).edges).toBeNull();
    const { edges: _omit, ...withoutEdges } = validRaw();
    void _omit;
    expect(normalizeConfig(withoutEdges, FIELDS).edges).toBeNull();
  });

  it('keeps known status categories, guesses new options and drops stale ids', () => {
    const raw = {
      ...validRaw(),
      statusCategories: { st_todo: 'blocked', st_doing: 'nonsense', stale: 'done' },
    };
    const cfg = normalizeConfig(raw, FIELDS);
    expect(cfg.statusCategories).toEqual({
      st_todo: 'blocked', // user override survives
      st_doing: 'doing', // invalid value -> guessed
      st_done: 'done', // new option -> guessed
      st_block: 'blocked',
    });
  });

  it('re-derives a stale default entry status', () => {
    const cfg = normalizeConfig({ ...validRaw(), defaultEntryStatusId: 'stale', statusCategories: {} }, FIELDS);
    expect(cfg.defaultEntryStatusId).toBe('st_todo');
  });

  it('defaults booleans of the wrong type', () => {
    const cfg = normalizeConfig({ ...validRaw(), requireDoneToAdvance: 1, allowRollback: 'false' }, FIELDS);
    expect(cfg.requireDoneToAdvance).toBe(false);
    expect(cfg.allowRollback).toBe(true);
  });

  it('returns a new object and never mutates the input', () => {
    const raw = validRaw();
    const snapshot = JSON.parse(JSON.stringify(raw));
    const cfg = normalizeConfig(raw, FIELDS);
    expect(raw).toEqual(snapshot);
    expect(cfg).not.toBe(raw);
    expect(cfg.nodes).not.toBe(raw.nodes);
    expect(cfg.nodes.s1.fields).not.toBe((raw.nodes as Record<string, { fields: unknown }>).s1.fields);
    cfg.roleFieldIds.push('mutated');
    expect(raw.roleFieldIds).toEqual(['f_owner', 'f_qa']);
  });

  it('is idempotent', () => {
    const once = normalizeConfig({ ...validRaw(), edges: [{ from: 's1', to: 'x' }] }, FIELDS);
    expect(normalizeConfig(once, FIELDS)).toEqual(once);
  });

  it('ignores prototype keys in stored maps', () => {
    const raw = JSON.parse('{"version":1,"stageFieldId":"f_stage","nodes":{"__proto__":{"fields":[]}},"statusCategories":{"__proto__":"done"}}');
    const cfg = normalizeConfig(raw, FIELDS);
    expect(Object.keys(cfg.nodes)).toEqual(['s1', 's2', 's3']);
  });
});

describe('config helpers', () => {
  const cfg: PipelineConfig = normalizeConfig(validRaw(), FIELDS);
  const statusField = FIELDS.find((f) => f.id === 'f_status');

  it('getEntryStatusId prefers the node override, then the default', () => {
    expect(getEntryStatusId(cfg, 's1')).toBe('st_doing');
    expect(getEntryStatusId(cfg, 's2')).toBe('st_todo');
    expect(getEntryStatusId(cfg, 'unknown')).toBe('st_todo');
    expect(getEntryStatusId({ ...cfg, defaultEntryStatusId: undefined }, 's2')).toBeUndefined();
  });

  it('getDoneStatusId returns the first done option in option order', () => {
    expect(getDoneStatusId(cfg, statusField)).toBe('st_done');
    const twoDone = { ...cfg, statusCategories: { ...cfg.statusCategories, st_block: 'done' as const, st_todo: 'done' as const } };
    expect(getDoneStatusId(twoDone, statusField)).toBe('st_todo');
    expect(getDoneStatusId(cfg, undefined)).toBeUndefined();
    const noDone = { ...cfg, statusCategories: { st_todo: 'todo' as const } };
    expect(getDoneStatusId(noDone, statusField)).toBeUndefined();
  });

  it('isConfigured requires an existing SingleSelect stage field', () => {
    expect(isConfigured(cfg, FIELDS)).toBe(true);
    expect(isConfigured(cfg, FIELDS.filter((f) => f.id !== 'f_stage'))).toBe(false);
    expect(isConfigured({ ...cfg, stageFieldId: 'f_num' }, FIELDS)).toBe(false);
    expect(isConfigured({ ...cfg, stageFieldId: undefined }, FIELDS)).toBe(false);
  });

  it('getNodeConfig only returns own entries', () => {
    expect(getNodeConfig(cfg, 's1')?.description).toBe('Check it');
    expect(getNodeConfig(cfg, 'toString')).toBeUndefined();
  });
});
