/**
 * Demo table for `npm run demo` and tests: "Product Requirements", a product
 * team's requirement tracker that mirrors the Meegle screenshot. Every id is a
 * stable constant shaped like a Lark id (tbl…, vew…, fld…, opt…, rec…, ou_…).
 *
 * Timestamps are relative to MOCK_NOW (module load) so durations such as
 * "time in stage" look realistic whenever the demo is opened.
 */
import { CONFIG_VERSION, FieldType } from '../../types';
import type { CellValue, Edge, FieldMeta, NodeConfig, PipelineConfig, RecordData, SelectOption, TableInfo, ViewInfo } from '../../types';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Reference "now" of the demo data, rounded to the minute so history lines round-trip exactly. */
export const MOCK_NOW = Math.floor(Date.now() / MINUTE) * MINUTE;

function ago(days: number): number {
  return Math.round((MOCK_NOW - days * DAY) / MINUTE) * MINUTE;
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Local "YYYY-MM-DD HH:mm", the history line timestamp format. */
function stamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* Table, views, users                                                 */
/* ------------------------------------------------------------------ */

export const MOCK_TABLE: TableInfo = { id: 'tblPq7Rm2XkVd9sLw', name: 'Product Requirements' };

export const MOCK_VIEW_IDS = {
  all: 'vewAllRq7K',
  mine: 'vewMyItm3P',
  /** The pipeline view itself (a widget view, type 100). */
  pipeline: 'vewPipeL9Z',
} as const;

export const MOCK_VIEWS: ViewInfo[] = [
  { id: MOCK_VIEW_IDS.all, name: 'All requirements', type: 1 },
  { id: MOCK_VIEW_IDS.mine, name: 'My items', type: 1 },
  { id: MOCK_VIEW_IDS.pipeline, name: 'Pipeline', type: 100 },
];

export interface MockUser {
  id: string;
  name: string;
  enName: string;
  email: string;
}

export const MOCK_USERS = {
  minhAnh: { id: 'ou_4ab5b19ec77fa5b60782df12438e2328', name: 'Nguyễn Minh Anh', enName: 'Minh Anh Nguyen', email: 'minhanh.nguyen@example.com' },
  quocBao: { id: 'ou_26dfc064cfcc7d888e521d4aa1248c13', name: 'Trần Quốc Bảo', enName: 'Quoc Bao Tran', email: 'quocbao.tran@example.com' },
  thuHa: { id: 'ou_70cb6b6c31f09bd6ecc7f8f2e93c7e56', name: 'Lê Thu Hà', enName: 'Thu Ha Le', email: 'thuha.le@example.com' },
  ducHuy: { id: 'ou_7fe5296c7d7ba257bd90f603537f6cd9', name: 'Phạm Đức Huy', enName: 'Duc Huy Pham', email: 'duchuy.pham@example.com' },
  giaLinh: { id: 'ou_eaad36051cb681d2482d5ad98b111e2e', name: 'Hoàng Gia Linh', enName: 'Gia Linh Hoang', email: 'gialinh.hoang@example.com' },
  ngocMai: { id: 'ou_25b2a73dde40aedda2186a70f79f04d9', name: 'Vũ Ngọc Mai', enName: 'Ngoc Mai Vu', email: 'ngocmai.vu@example.com' },
  tuanKiet: { id: 'ou_0389eb0c165ef078c202c275e75e7c53', name: 'Đặng Tuấn Kiệt', enName: 'Tuan Kiet Dang', email: 'tuankiet.dang@example.com' },
  thanhSon: { id: 'ou_a2e97f5aa5e7c453040cac809afb957c', name: 'Bùi Thanh Sơn', enName: 'Thanh Son Bui', email: 'thanhson.bui@example.com' },
} satisfies Record<string, MockUser>;

/** The demo's current user: "My items" = records where this user is the Project Manager. */
export const MOCK_ME: MockUser = MOCK_USERS.minhAnh;

/* ------------------------------------------------------------------ */
/* Fields and options                                                  */
/* ------------------------------------------------------------------ */

export const F = {
  name: 'fldK2nAm3Q',
  stage: 'fldStg8Wq1',
  status: 'fldSts5Lp0',
  priority: 'fldPri3Xz7',
  tags: 'fldTag6Mb2',
  projectManager: 'fldUpm1Rk4',
  dataAnalyst: 'fldUda7Hc9',
  reviewCommittee: 'fldUrc2Vn5',
  androidDev: 'fldUad4Ty8',
  frontendDev: 'fldUfe9Gs3',
  qa: 'fldUqa5Jd6',
  iosDev: 'fldUio3Wm1',
  serverDevOwner: 'fldUsv8Pk2',
  safetyReview: 'fldCsf1Bx7',
  feGrayBox: 'fldCfg6Nz4',
  serverGrayBox: 'fldCsg2Qe8',
  updateManual: 'fldCum7Lr3',
  monitoringSetup: 'fldCmn4Ha9',
  prdLink: 'fldLpr5Ks0',
  techDesignDoc: 'fldLtd8Vw2',
  testPlan: 'fldLtp3Cy6',
  estimate: 'fldNes9Df1',
  bugsFound: 'fldNbg4Xu7',
  dueDate: 'fldDdu6Ji2',
  releaseDate: 'fldDrl1Ot5',
  reviewerNotes: 'fldTrn7Ea3',
  releaseNotes: 'fldTrl2Fm8',
  attachments: 'fldAtt5Gq4',
  relatedEpic: 'fldLnk3Ep9',
  score: 'fldFsc8Ry6',
  enteredAt: 'fldDea4Zh1',
  history: 'fldThy9Bn5',
  createdBy: 'fldCby6Wc7',
  ticketNo: 'fldAno1Mv3',
} as const;

type StageKey = 'DA' | 'DR' | 'TD' | 'FEP' | 'SVP' | 'QAP' | 'FED' | 'SVD' | 'QAT' | 'IT' | 'REL' | 'RETRO';

export const STAGE: Record<StageKey, SelectOption> = {
  DA: { id: 'optDaTrk7Q', name: 'DA Tracking', color: 0 },
  DR: { id: 'optDtRev3M', name: 'Detail Review', color: 1 },
  TD: { id: 'optTchDs9K', name: 'Tech Design', color: 2 },
  FEP: { id: 'optFePln2W', name: 'FE Plan', color: 3 },
  SVP: { id: 'optSvPln6R', name: 'Server Plan', color: 4 },
  QAP: { id: 'optQaPln1X', name: 'QA Plan', color: 5 },
  FED: { id: 'optFeDev8T', name: 'FE Dev', color: 6 },
  SVD: { id: 'optSvDev4N', name: 'Server Dev', color: 7 },
  QAT: { id: 'optQaTst5J', name: 'QA Test', color: 8 },
  IT: { id: 'optIntTs0B', name: 'Integration Test', color: 50 },
  REL: { id: 'optRlse7Cv', name: 'Release', color: 12 },
  RETRO: { id: 'optRetro2H', name: 'Retrospective', color: 9 },
};

const STAGE_ORDER: StageKey[] = ['DA', 'DR', 'TD', 'FEP', 'SVP', 'QAP', 'FED', 'SVD', 'QAT', 'IT', 'REL', 'RETRO'];
export const STAGE_OPTIONS: SelectOption[] = STAGE_ORDER.map((k) => STAGE[k]);

/** A stage value whose option was deleted from the field (exercises the "unknown stage" path). */
export const DELETED_STAGE_OPTION: SelectOption = { id: 'optUatLg9S', name: 'UAT (legacy)', color: 3 };

export const STATUS = {
  notStarted: { id: 'optNtSt4Rw', name: 'Not started', color: 9 },
  inProgress: { id: 'optInPr8Lm', name: 'In progress', color: 0 },
  pendingDesign: { id: 'optPdDs2Yq', name: 'Pending Design', color: 4 },
  done: { id: 'optDone6Fx', name: 'Done', color: 2 },
  blocked: { id: 'optBlck1Zt', name: 'Blocked', color: 5 },
} satisfies Record<string, SelectOption>;
type StatusKey = keyof typeof STATUS;

export const PRIORITY = {
  P0: { id: 'optP0Urg5D', name: 'P0', color: 25 },
  P1: { id: 'optP1Hgh2K', name: 'P1', color: 4 },
  P2: { id: 'optP2Nrm8V', name: 'P2', color: 0 },
} satisfies Record<string, SelectOption>;
type PriorityKey = keyof typeof PRIORITY;

export const TAG = {
  onboarding: { id: 'optTgOnb1A', name: 'Onboarding', color: 1 },
  growth: { id: 'optTgGrw4B', name: 'Growth', color: 2 },
  payments: { id: 'optTgPay7C', name: 'Payments', color: 7 },
  mobile: { id: 'optTgMob3D', name: 'Mobile', color: 6 },
  web: { id: 'optTgWeb9E', name: 'Web', color: 0 },
  infra: { id: 'optTgInf6F', name: 'Infra', color: 8 },
  compliance: { id: 'optTgCmp2G', name: 'Compliance', color: 13 },
} satisfies Record<string, SelectOption>;
type TagKey = keyof typeof TAG;

const EPIC_TABLE_ID = 'tblEpcK4wQ8nZ2rHy';
const EPICS = {
  growth: { recordId: 'recEpGrw01q', text: 'Growth Q4' },
  payments: { recordId: 'recEpPay02w', text: 'Payments 2.0' },
  platform: { recordId: 'recEpPlt03e', text: 'Platform Hardening' },
};

const DATE_PROPERTY = { dateFormat: 'yyyy/MM/dd', displayTimeZone: false, autoFill: false };
const DATE_TIME_PROPERTY = { dateFormat: 'yyyy/MM/dd HH:mm', displayTimeZone: false, autoFill: false };

function plain(id: string, name: string, type: FieldType, property: unknown = null): FieldMeta {
  return { id, name, type, isPrimary: false, property };
}

function select(id: string, name: string, type: FieldType.SingleSelect | FieldType.MultiSelect, options: SelectOption[]): FieldMeta {
  return { id, name, type, isPrimary: false, options, property: { options, optionsType: 0 } };
}

const userField = (id: string, name: string) => plain(id, name, FieldType.User, { multiple: true });

export const MOCK_FIELDS: FieldMeta[] = [
  { ...plain(F.name, 'Name', FieldType.Text), isPrimary: true },
  select(F.stage, 'Stage', FieldType.SingleSelect, STAGE_OPTIONS),
  select(F.status, 'Status', FieldType.SingleSelect, Object.values(STATUS)),
  select(F.priority, 'Priority', FieldType.SingleSelect, Object.values(PRIORITY)),
  select(F.tags, 'Tags', FieldType.MultiSelect, Object.values(TAG)),
  userField(F.projectManager, 'Project Manager'),
  userField(F.dataAnalyst, 'Data Analyst'),
  userField(F.reviewCommittee, 'Review Committee'),
  userField(F.androidDev, 'Android Dev'),
  userField(F.frontendDev, 'Frontend Dev'),
  userField(F.qa, 'QA'),
  userField(F.iosDev, 'iOS Dev'),
  userField(F.serverDevOwner, 'Server Dev Owner'),
  plain(F.safetyReview, 'Safety review', FieldType.Checkbox),
  plain(F.feGrayBox, 'Front-end gray-box testing', FieldType.Checkbox),
  plain(F.serverGrayBox, 'Server gray-box testing', FieldType.Checkbox),
  plain(F.updateManual, 'Update Manual', FieldType.Checkbox),
  plain(F.monitoringSetup, 'Monitoring setup', FieldType.Checkbox),
  plain(F.prdLink, 'PRD link', FieldType.Url),
  plain(F.techDesignDoc, 'Tech design doc', FieldType.Url),
  plain(F.testPlan, 'Test plan', FieldType.Url),
  plain(F.estimate, 'Estimate (days)', FieldType.Number, { formatter: '0.0' }),
  plain(F.bugsFound, 'Bugs found', FieldType.Number, { formatter: '0' }),
  plain(F.dueDate, 'Due date', FieldType.DateTime, DATE_PROPERTY),
  plain(F.releaseDate, 'Release date', FieldType.DateTime, DATE_PROPERTY),
  plain(F.reviewerNotes, 'Reviewer notes', FieldType.Text),
  plain(F.releaseNotes, 'Release notes', FieldType.Text),
  plain(F.attachments, 'Attachments', FieldType.Attachment),
  plain(F.relatedEpic, 'Related epic', FieldType.DuplexLink, { tableId: EPIC_TABLE_ID, multiple: true }),
  plain(F.score, 'Score', FieldType.Formula, { formula: 'IF([Priority]="P0",30,IF([Priority]="P1",20,10))+[Estimate (days)]' }),
  plain(F.enteredAt, 'Entered stage at', FieldType.DateTime, DATE_TIME_PROPERTY),
  plain(F.history, 'Pipeline history', FieldType.Text),
  plain(F.createdBy, 'Created by', FieldType.CreatedUser),
  plain(F.ticketNo, 'Ticket No.', FieldType.AutoNumber),
];

/* ------------------------------------------------------------------ */
/* Demo pipeline config                                                */
/* ------------------------------------------------------------------ */

const edge = (from: StageKey, to: StageKey): Edge => ({ from: STAGE[from].id, to: STAGE[to].id });

export const DEMO_EDGES: Edge[] = [
  edge('DA', 'DR'),
  edge('DR', 'TD'),
  edge('TD', 'FEP'),
  edge('TD', 'SVP'),
  edge('TD', 'QAP'),
  edge('FEP', 'FED'),
  edge('FEP', 'SVD'),
  edge('SVP', 'SVD'),
  edge('QAP', 'SVD'),
  edge('QAP', 'QAT'),
  edge('FED', 'IT'),
  edge('SVD', 'IT'),
  edge('QAT', 'IT'),
  edge('IT', 'REL'),
  edge('REL', 'RETRO'),
];

const req = (fieldId: string) => ({ fieldId, required: true });
const opt = (fieldId: string) => ({ fieldId, required: false });

const DEMO_NODES: Record<StageKey, NodeConfig> = {
  DA: {
    fields: [req(F.prdLink)],
    ownerFieldId: F.dataAnalyst,
    description: 'Thu thập số liệu hiện trạng và đính kèm link PRD trước khi chuyển sang review.',
  },
  DR: {
    fields: [req(F.safetyReview), opt(F.reviewerNotes)],
    ownerFieldId: F.reviewCommittee,
    entryStatusId: STATUS.pendingDesign.id,
    description: 'Hội đồng review rà soát PRD và kiểm tra an toàn/bảo mật. Ghi chú các điểm cần bổ sung.',
  },
  TD: {
    fields: [req(F.techDesignDoc), req(F.estimate)],
    ownerFieldId: F.serverDevOwner,
    description: 'Viết tài liệu thiết kế kỹ thuật và ước lượng effort (ngày). Bước tiếp theo chọn nhánh FE, Server hoặc QA.',
  },
  FEP: { fields: [req(F.frontendDev)], ownerFieldId: F.frontendDev },
  SVP: { fields: [req(F.serverDevOwner)], ownerFieldId: F.serverDevOwner },
  QAP: { fields: [req(F.qa), opt(F.testPlan)], ownerFieldId: F.qa },
  FED: { fields: [req(F.feGrayBox)], ownerFieldId: F.frontendDev },
  SVD: { fields: [req(F.serverGrayBox)], ownerFieldId: F.serverDevOwner },
  QAT: {
    fields: [req(F.bugsFound)],
    ownerFieldId: F.qa,
    description: 'Ghi số bug tìm được trong đợt test (nhập 0 nếu không có bug).',
  },
  IT: { fields: [req(F.updateManual), opt(F.monitoringSetup)], ownerFieldId: F.qa },
  REL: {
    fields: [req(F.releaseDate), opt(F.releaseNotes)],
    ownerFieldId: F.projectManager,
    description: 'Chốt ngày phát hành và viết release notes cho người dùng.',
  },
  RETRO: { fields: [opt(F.reviewerNotes)], ownerFieldId: F.projectManager },
};

export const DEMO_CONFIG: PipelineConfig = {
  version: CONFIG_VERSION,
  titleFieldId: F.name,
  stageFieldId: F.stage,
  statusFieldId: F.status,
  enteredAtFieldId: F.enteredAt,
  historyFieldId: F.history,
  statusCategories: {
    [STATUS.notStarted.id]: 'todo',
    [STATUS.inProgress.id]: 'doing',
    [STATUS.pendingDesign.id]: 'todo',
    [STATUS.done.id]: 'done',
    [STATUS.blocked.id]: 'blocked',
  },
  defaultEntryStatusId: STATUS.notStarted.id,
  requireDoneToAdvance: false,
  allowRollback: true,
  nodes: Object.fromEntries(STAGE_ORDER.map((k) => [STAGE[k].id, DEMO_NODES[k]])),
  edges: DEMO_EDGES,
  roleFieldIds: [
    F.projectManager,
    F.dataAnalyst,
    F.reviewCommittee,
    F.androidDev,
    F.frontendDev,
    F.qa,
    F.iosDev,
    F.serverDevOwner,
  ],
  checklistFieldIds: [F.safetyReview, F.feGrayBox, F.serverGrayBox, F.updateManual, F.monitoringSetup],
  listFieldIds: [F.priority, F.dueDate],
};

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

const text = (s: string): CellValue => [{ type: 'text', text: s }];
const url = (link: string, label: string): CellValue => [{ type: 'url', text: label, link }];
const users = (...list: MockUser[]): CellValue => list.map((u) => ({ ...u }));
const option = (o: SelectOption): CellValue => ({ id: o.id, text: o.name });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type StepKind = 'start' | 'advance' | 'rollback' | 'complete';
/** [days ago, kind, target stage]; complete has no target. Oldest first. */
type JourneyStep = [number, StepKind, StageKey?];

interface Journey {
  current: StageKey | null;
  enteredAt: number | null;
  history: string;
  /** Nodes the record left forward (or completed), in order. */
  passed: StageKey[];
  /** When the record left each passed node. */
  leftAt: Partial<Record<StageKey, number>>;
}

/** Replays a journey through the DEMO graph, producing the stage, enteredAt and history log. */
function replay(steps: JourneyStep[]): Journey {
  const j: Journey = { current: null, enteredAt: null, history: '', passed: [], leftAt: {} };
  const lines: string[] = [];
  for (const [daysAgo, kind, to] of steps) {
    const at = ago(daysAgo);
    const from = j.current;
    if (kind === 'complete') {
      if (!from) throw new Error('mockData: complete without a current stage');
      lines.push(`[${stamp(at)}] ✓ ${STAGE[from].name}`);
      j.passed.push(from);
      j.leftAt[from] = at;
      continue;
    }
    if (!to) throw new Error(`mockData: ${kind} without a target`);
    if (kind === 'start') lines.push(`[${stamp(at)}] ▶ ${STAGE[to].name}`);
    else if (!from) throw new Error(`mockData: ${kind} before start`);
    else if (kind === 'advance') {
      lines.push(`[${stamp(at)}] ${STAGE[from].name} → ${STAGE[to].name}`);
      j.passed.push(from);
      j.leftAt[from] = at;
    } else {
      lines.push(`[${stamp(at)}] ${STAGE[from].name} ↩ ${STAGE[to].name}`);
    }
    j.current = to;
    j.enteredAt = at;
  }
  j.history = lines.join('\n');
  return j;
}

const ESTIMATES = [5, 8, 3, 13, 2.5, 8, 5, 3];
const BUG_COUNTS = [3, 0, 7, 1, 2];

/** Cells a record would have filled in at a node it has already left. */
function cellsForPassedNode(stage: StageKey, i: number, name: string, leftAt: number | undefined): Record<string, CellValue> {
  const s = slug(name);
  switch (stage) {
    case 'DA':
      return { [F.prdLink]: url(`https://docs.example.com/prd/${s}`, `PRD - ${name}`) };
    case 'DR':
      return { [F.safetyReview]: true };
    case 'TD':
      return {
        [F.techDesignDoc]: url(`https://docs.example.com/tech/${s}`, `Tech design - ${name}`),
        [F.estimate]: ESTIMATES[i % ESTIMATES.length],
      };
    case 'FEP':
      return { [F.frontendDev]: users(MOCK_USERS.giaLinh) };
    case 'SVP':
      return { [F.serverDevOwner]: users(MOCK_USERS.thanhSon) };
    case 'QAP':
      return { [F.qa]: users(MOCK_USERS.ngocMai), [F.testPlan]: url(`https://docs.example.com/qa/${s}`, 'Test plan') };
    case 'FED':
      return { [F.feGrayBox]: true };
    case 'SVD':
      return { [F.serverGrayBox]: true };
    case 'QAT':
      return { [F.bugsFound]: BUG_COUNTS[i % BUG_COUNTS.length] };
    case 'IT':
      return { [F.updateManual]: true, [F.monitoringSetup]: true };
    case 'REL':
      return {
        [F.releaseDate]: startOfLocalDay(leftAt ?? MOCK_NOW),
        [F.releaseNotes]: text(`Phát hành ${name} cho toàn bộ người dùng.`),
      };
    case 'RETRO':
      return { [F.reviewerNotes]: text('Retro: đúng hạn, cần tự động hoá thêm test hồi quy.') };
  }
}

interface RecordSpec {
  id: string;
  name: string;
  steps?: JourneyStep[];
  status?: StatusKey;
  priority: PriorityKey;
  tags: TagKey[];
  pm: MockUser;
  dueInDays?: number;
  epic?: keyof typeof EPICS;
  /** Applied last; `null` clears a cell. */
  cells?: Record<string, CellValue>;
}

const PRIORITY_WEIGHT: Record<PriorityKey, number> = { P0: 30, P1: 20, P2: 10 };

function buildRecord(spec: RecordSpec, i: number): RecordData {
  const journey = replay(spec.steps ?? []);
  const fields: Record<string, CellValue> = {
    [F.name]: text(spec.name),
    [F.priority]: option(PRIORITY[spec.priority]),
    [F.tags]: spec.tags.map((t) => option(TAG[t])),
    [F.projectManager]: users(spec.pm),
    [F.createdBy]: users(spec.pm),
    [F.ticketNo]: { value: `REQ-${pad(i + 1, 3)}`, status: 'completed' },
  };
  if (spec.status) fields[F.status] = option(STATUS[spec.status]);
  if (spec.dueInDays !== undefined) fields[F.dueDate] = startOfLocalDay(MOCK_NOW + spec.dueInDays * DAY);
  if (spec.epic) {
    const epic = EPICS[spec.epic];
    fields[F.relatedEpic] = { text: epic.text, type: 'text', recordIds: [epic.recordId], tableId: EPIC_TABLE_ID };
  }
  if (spec.tags.includes('mobile')) {
    fields[F.androidDev] = users(MOCK_USERS.ducHuy);
    fields[F.iosDev] = users(MOCK_USERS.tuanKiet);
  }
  if (journey.current) {
    fields[F.stage] = option(STAGE[journey.current]);
    fields[F.dataAnalyst] = users(MOCK_USERS.quocBao);
    fields[F.history] = text(journey.history);
    if (journey.enteredAt !== null) fields[F.enteredAt] = journey.enteredAt;
    if (journey.current === 'DR' || journey.passed.includes('DR')) fields[F.reviewCommittee] = users(MOCK_USERS.thuHa);
  }
  for (const stage of journey.passed) Object.assign(fields, cellsForPassedNode(stage, i, spec.name, journey.leftAt[stage]));
  for (const [fieldId, value] of Object.entries(spec.cells ?? {})) fields[fieldId] = value;

  const estimate = typeof fields[F.estimate] === 'number' ? (fields[F.estimate] as number) : 0;
  fields[F.score] = PRIORITY_WEIGHT[spec.priority] + estimate;

  for (const key of Object.keys(fields)) if (fields[key] === null || fields[key] === undefined) delete fields[key];
  return { id: spec.id, fields };
}

const { minhAnh, quocBao, thuHa, ducHuy, giaLinh, ngocMai, tuanKiet, thanhSon } = MOCK_USERS;

const RECORD_SPECS: RecordSpec[] = [
  {
    id: 'recPv01Onbd',
    name: 'Product User Onboarding Flow - Phase One',
    steps: [
      [45.3, 'start', 'DA'],
      [31.2, 'advance', 'DR'],
    ],
    status: 'pendingDesign',
    priority: 'P0',
    tags: ['onboarding', 'mobile'],
    pm: minhAnh,
    dueInDays: 21,
    epic: 'growth',
    cells: {
      [F.dataAnalyst]: users(quocBao),
      [F.reviewCommittee]: users(thuHa, minhAnh),
      [F.androidDev]: users(ducHuy),
      [F.frontendDev]: users(giaLinh),
      [F.qa]: users(ngocMai),
      [F.iosDev]: users(tuanKiet),
      [F.serverDevOwner]: users(thanhSon),
      [F.safetyReview]: true,
      [F.updateManual]: true,
      [F.reviewerNotes]: text('Cần bổ sung luồng "bỏ qua" cho người dùng cũ và số liệu tỉ lệ rời bỏ ở bước 3.'),
      [F.attachments]: [
        { name: 'onboarding-flow-v3.fig', size: 2481152, type: 'application/octet-stream', token: 'boxcnOnb7Kq2XmA9', timeStamp: ago(40) },
        { name: 'user-research-summary.pdf', size: 845312, type: 'application/pdf', token: 'boxcnUrs4Lp8WnB2', timeStamp: ago(38) },
      ],
    },
  },
  {
    id: 'recPv02Chkt',
    name: 'Checkout Payment Retry',
    steps: [
      [40.1, 'start', 'DA'],
      [36.4, 'advance', 'DR'],
      [30.2, 'advance', 'TD'],
      [24.3, 'advance', 'FEP'],
      [15.1, 'advance', 'FED'],
    ],
    status: 'inProgress',
    priority: 'P0',
    tags: ['payments', 'web'],
    pm: thuHa,
    dueInDays: 5,
    epic: 'payments',
  },
  {
    id: 'recPv03Dark',
    name: 'Dark Mode for Mobile App',
    steps: [
      [50.2, 'start', 'DA'],
      [46.3, 'advance', 'DR'],
      [41.1, 'advance', 'TD'],
      [35.2, 'advance', 'QAP'],
      [20.4, 'advance', 'SVD'],
    ],
    status: 'inProgress',
    priority: 'P2',
    tags: ['mobile'],
    pm: minhAnh,
    dueInDays: 10,
    cells: { [F.serverDevOwner]: users(thanhSon) },
  },
  {
    id: 'recPv04Refr',
    name: 'Referral Rewards Program',
    steps: [
      [60.1, 'start', 'DA'],
      [55.3, 'advance', 'DR'],
      [49.2, 'advance', 'TD'],
      [42.1, 'advance', 'QAP'],
      [12.3, 'advance', 'QAT'],
    ],
    status: 'inProgress',
    priority: 'P1',
    tags: ['growth'],
    pm: thuHa,
    dueInDays: 3,
    epic: 'growth',
  },
  {
    id: 'recPv05Srch',
    name: 'Search Ranking Improvements',
    steps: [
      [70.2, 'start', 'DA'],
      [65.1, 'advance', 'DR'],
      [58.3, 'advance', 'TD'],
      [50.2, 'advance', 'SVP'],
      [38.1, 'advance', 'SVD'],
      [6.2, 'advance', 'IT'],
    ],
    status: 'inProgress',
    priority: 'P1',
    tags: ['web', 'infra'],
    pm: minhAnh,
    dueInDays: -2,
    epic: 'platform',
    cells: { [F.monitoringSetup]: true },
  },
  {
    id: 'recPv06Noti',
    name: 'Notification Preferences Center',
    steps: [
      [80.1, 'start', 'DA'],
      [74.2, 'advance', 'DR'],
      [68.3, 'advance', 'TD'],
      [60.1, 'advance', 'FEP'],
      [48.2, 'advance', 'FED'],
      [20.1, 'advance', 'IT'],
      [3.2, 'advance', 'REL'],
    ],
    status: 'notStarted',
    priority: 'P2',
    tags: ['web'],
    pm: thuHa,
    dueInDays: 7,
  },
  {
    id: 'recPv07Gdpr',
    name: 'Account Deletion (GDPR)',
    steps: [
      [120.2, 'start', 'DA'],
      [113.1, 'advance', 'DR'],
      [105.3, 'advance', 'TD'],
      [98.2, 'advance', 'SVP'],
      [85.1, 'advance', 'SVD'],
      [60.3, 'advance', 'IT'],
      [41.2, 'advance', 'REL'],
      [30.1, 'advance', 'RETRO'],
      [26.2, 'complete'],
    ],
    status: 'done',
    priority: 'P0',
    tags: ['compliance'],
    pm: minhAnh,
    dueInDays: -35,
    epic: 'platform',
    cells: {
      [F.attachments]: [
        { name: 'dpia-account-deletion.pdf', size: 412876, type: 'application/pdf', token: 'boxcnDpi9Rt3VkC6', timeStamp: ago(110) },
      ],
    },
  },
  {
    id: 'recPv08Fdbk',
    name: 'In-app Feedback Widget',
    steps: [
      [25.3, 'start', 'DA'],
      [20.2, 'advance', 'DR'],
      [14.1, 'advance', 'TD'],
    ],
    status: 'blocked',
    priority: 'P2',
    tags: ['mobile'],
    pm: thuHa,
    dueInDays: 12,
    cells: { [F.reviewerNotes]: text('Đang chờ quyết định dùng SDK bên thứ ba hay tự xây widget phản hồi.') },
  },
  {
    id: 'recPv09L10n',
    name: 'Localization: Vietnamese & Thai',
    steps: [
      [33.2, 'start', 'DA'],
      [29.1, 'advance', 'DR'],
      [22.3, 'advance', 'TD'],
      [10.2, 'rollback', 'DR'],
    ],
    status: 'inProgress',
    priority: 'P1',
    tags: ['growth', 'web'],
    pm: minhAnh,
    dueInDays: 18,
    epic: 'growth',
    cells: { [F.reviewerNotes]: text('Tech Design trả lại: thiếu phạm vi tiếng Thái cho email giao dịch.') },
  },
  {
    id: 'recPv10Paus',
    name: 'Subscription Pause Feature',
    steps: [[2.1, 'start', 'DA']],
    status: 'notStarted',
    priority: 'P2',
    tags: ['payments'],
    pm: thuHa,
    dueInDays: 30,
    epic: 'payments',
  },
  {
    id: 'recPv11Anly',
    name: 'Analytics Event Taxonomy v2',
    steps: [
      [21.2, 'start', 'DA'],
      [18.1, 'advance', 'DR'],
      [12.3, 'advance', 'TD'],
      [5.1, 'advance', 'QAP'],
    ],
    status: 'notStarted',
    priority: 'P1',
    tags: ['infra'],
    pm: minhAnh,
    dueInDays: 14,
    epic: 'platform',
  },
  {
    id: 'recPv12Prmo',
    name: 'Promo Code Engine',
    steps: [
      [30.1, 'start', 'DA'],
      [26.2, 'advance', 'DR'],
      [19.3, 'advance', 'TD'],
      [1.2, 'advance', 'FEP'],
    ],
    status: 'notStarted',
    priority: 'P1',
    tags: ['payments', 'growth'],
    pm: thuHa,
    dueInDays: 20,
    epic: 'payments',
  },
  {
    id: 'recPv13Offl',
    name: 'Offline Mode for Field Agents',
    priority: 'P2',
    tags: ['mobile'],
    pm: minhAnh,
  },
  {
    id: 'recPv14Audt',
    name: 'Admin Audit Log Export',
    status: 'notStarted',
    priority: 'P2',
    tags: ['compliance'],
    pm: thuHa,
    dueInDays: 45,
  },
  {
    id: 'recPv15Lgcy',
    name: 'Legacy Report Builder Migration',
    steps: [
      [90.1, 'start', 'DA'],
      [84.2, 'advance', 'DR'],
      [77.3, 'advance', 'TD'],
    ],
    status: 'inProgress',
    priority: 'P2',
    tags: ['infra'],
    pm: minhAnh,
    epic: 'platform',
    // Moved to a stage option that was later deleted from the Stage field (edited in the grid, so no history line).
    cells: { [F.stage]: option(DELETED_STAGE_OPTION), [F.enteredAt]: ago(18.2) },
  },
  {
    id: 'recPv16TwoF',
    name: 'Two-factor Authentication Revamp',
    steps: [
      [28.1, 'start', 'DA'],
      [23.3, 'advance', 'DR'],
      [16.2, 'advance', 'TD'],
      [4.1, 'advance', 'SVP'],
    ],
    status: 'inProgress',
    priority: 'P0',
    tags: ['compliance', 'mobile'],
    pm: thuHa,
    dueInDays: 9,
    epic: 'platform',
    cells: { [F.serverDevOwner]: users(thanhSon) },
  },
  {
    id: 'recPv17Tips',
    name: 'Onboarding Checklist Tooltips',
    steps: [
      [55.2, 'start', 'DA'],
      [50.1, 'advance', 'DR'],
      [44.3, 'advance', 'TD'],
      [39.2, 'advance', 'FEP'],
      [27.1, 'advance', 'SVD'],
      [8.3, 'advance', 'IT'],
    ],
    status: 'inProgress',
    priority: 'P2',
    tags: ['onboarding', 'web'],
    pm: minhAnh,
    dueInDays: 4,
    epic: 'growth',
  },
];

export const MOCK_RECORDS: RecordData[] = RECORD_SPECS.map(buildRecord);

/* ------------------------------------------------------------------ */
/* Data set                                                            */
/* ------------------------------------------------------------------ */

export interface MockDataSet {
  table: TableInfo;
  /** Id of the pipeline (widget) view, returned by init(). */
  viewId: string;
  views: ViewInfo[];
  fields: FieldMeta[];
  records: RecordData[];
  users: MockUser[];
}

/** "My items": records whose Project Manager is MOCK_ME. */
export function isMyItem(record: RecordData): boolean {
  const pm = record.fields[F.projectManager];
  return Array.isArray(pm) && pm.some((u) => typeof u === 'object' && u !== null && (u as { id?: unknown }).id === MOCK_ME.id);
}

/** Record filters of the fake Grid views (views without an entry show every record). */
export const MOCK_VIEW_FILTERS: Record<string, (record: RecordData) => boolean> = {
  [MOCK_VIEW_IDS.mine]: isMyItem,
};

/** A fresh, deep-copied data set (all values are JSON-safe). */
export function cloneMockData(): MockDataSet {
  const data: MockDataSet = {
    table: MOCK_TABLE,
    viewId: MOCK_VIEW_IDS.pipeline,
    views: MOCK_VIEWS,
    fields: MOCK_FIELDS,
    records: MOCK_RECORDS,
    users: Object.values(MOCK_USERS),
  };
  return JSON.parse(JSON.stringify(data)) as MockDataSet;
}

/** A deep copy of DEMO_CONFIG. */
export function cloneDemoConfig(): PipelineConfig {
  return JSON.parse(JSON.stringify(DEMO_CONFIG)) as PipelineConfig;
}
