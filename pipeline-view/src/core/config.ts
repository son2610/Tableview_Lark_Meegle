import { CONFIG_VERSION, FieldType } from '../types';
import type { Edge, FieldMeta, NodeConfig, NodeFieldRule, PipelineConfig, SelectOption, StatusCategory } from '../types';

const STAGE_HINTS = ['stage', 'phase', 'step', 'pipeline', 'flow', 'giai đoạn', 'bước', 'quy trình', 'công đoạn', '阶段', '流程'];
const STATUS_HINTS = ['status', 'state', 'trạng thái', 'tình trạng', '状态'];

const CATEGORIES: readonly StatusCategory[] = ['todo', 'doing', 'done', 'blocked'];

/**
 * Best-effort default config for a table that has never been configured.
 * - titleFieldId: primary field.
 * - stageFieldId: the SingleSelect whose name best matches stage hints
 *   (stage, phase, step, pipeline, flow, giai đoạn, bước, quy trình, công đoạn, 阶段, 流程),
 *   else the first SingleSelect, else undefined.
 *   "Best": an exact (normalized) name match beats a substring match; a name that also
 *   matches a status hint ranks lower; ties keep field order. The "first SingleSelect"
 *   fallback skips fields named like a status field when another SingleSelect exists.
 * - statusFieldId: another SingleSelect matching status hints
 *   (status, state, trạng thái, tình trạng, 状态), else undefined.
 * - enteredAtFieldId / historyFieldId: undefined.
 * - statusCategories from guessStatusCategory for every status option.
 * - defaultEntryStatusId: first status option with category 'todo', else first option.
 * - requireDoneToAdvance false, allowRollback true, edges null, nodes {} filled by normalizeConfig,
 *   roleFieldIds / checklistFieldIds / listFieldIds empty.
 * The result is passed through normalizeConfig before being returned.
 */
export function createDefaultConfig(fields: FieldMeta[]): PipelineConfig {
  const list = asFieldList(fields);
  return repair(buildDefault(list), list);
}

/**
 * Validate and repair a stored config against the current fields. Never throws.
 * - Non-object / wrong version -> createDefaultConfig(fields).
 * - Field ids that no longer exist or have an unexpected type are dropped
 *   (stage/status must be SingleSelect, enteredAt DateTime, history Text, owner User,
 *   role fields User, checklist fields Checkbox). titleFieldId falls back to primary.
 *   statusFieldId is also dropped when it equals stageFieldId.
 * - nodes: exactly one entry per current stage option (missing -> {fields: []});
 *   rules referencing missing fields are dropped; duplicate fieldIds collapsed (first wins);
 *   entryStatusId dropped when not a current status option; description kept when a
 *   non-empty string. No stage field -> nodes {}.
 * - edges: if not null, keep only edges between current stage options, no duplicates /
 *   self loops; an edge into a removed option is bridged to the surviving options after it
 *   (A→B→C with B deleted becomes A→C). (A stored empty array stays [] – the user removed
 *   all edges on purpose.)
 *   Missing / non-array edges, or no stage field -> null (linear).
 * - statusCategories: keep known options, guess categories for new ones, drop stale ids.
 * - defaultEntryStatusId must be a current status option, else re-derived.
 * - Booleans default as in createDefaultConfig.
 * - sourceViewId kept when a non-empty string (views are not known here).
 * - Id lists (role / checklist / list fields) are de-duplicated, order kept.
 * Returns a NEW object; does not mutate `raw`.
 */
export function normalizeConfig(raw: unknown, fields: FieldMeta[]): PipelineConfig {
  const list = asFieldList(fields);
  try {
    if (!isPlainObject(raw) || raw.version !== CONFIG_VERSION) return createDefaultConfig(list);
    return repair(raw, list);
  } catch {
    // Defensive: hostile inputs (throwing getters, proxies) must never break the UI.
    return createDefaultConfig(list);
  }
}

/**
 * Category from a status option name (case/diacritics-insensitive, vi/en/zh):
 * done: done, complete(d), finish(ed), closed, resolved, approved, hoàn thành, xong, đã xong, 完成, 已完成
 * blocked: block(ed), stuck, hold, on hold, pending review? (NO), cancel(l)ed, reject(ed), bị chặn, tạm dừng, hủy, từ chối, 阻塞, 暂停
 * doing: progress, doing, working, review(ing), testing, active, started, đang, thực hiện, 进行中
 * otherwise todo (not started, todo, new, open, chưa, mới, 未开始 ...).
 * "Pending ..." counts as todo.
 * Implementation: the name is lowercased, Vietnamese diacritics are stripped (đ -> d),
 * `_`/`-` become spaces. Names starting with a negation / waiting word ("not ...",
 * "pending ...", "chưa ...", "未...") or containing "not started" are todo; otherwise the
 * keyword groups are checked in the order done, blocked, doing (latin keywords match
 * whole words only), else todo.
 */
export function guessStatusCategory(name: string): StatusCategory {
  const text = normalizeText(typeof name === 'string' ? name : String(name ?? '')).replace(/[_\-]+/g, ' ');
  if (TODO_FIRST.test(text)) return 'todo';
  if (DONE.test(text)) return 'done';
  if (BLOCKED.test(text)) return 'blocked';
  if (DOING.test(text)) return 'doing';
  return 'todo';
}

/** Status option to set when a record enters `nodeId` (node override, else default). */
export function getEntryStatusId(config: PipelineConfig, nodeId: string): string | undefined {
  return getNodeConfig(config, nodeId)?.entryStatusId ?? config.defaultEntryStatusId;
}

/**
 * Status option used to mark a finished record: first option (in option order) whose
 * category is 'done'; undefined if none / no status field.
 */
export function getDoneStatusId(config: PipelineConfig, statusField: FieldMeta | undefined): string | undefined {
  for (const opt of statusField?.options ?? []) {
    if (hasOwn(config.statusCategories, opt.id) && config.statusCategories[opt.id] === 'done') return opt.id;
  }
  return undefined;
}

/** True when a stage field is set and still exists as a SingleSelect in `fields`. */
export function isConfigured(config: PipelineConfig, fields: FieldMeta[]): boolean {
  if (!config || !config.stageFieldId) return false;
  return asFieldList(fields).some((f) => f.id === config.stageFieldId && f.type === FieldType.SingleSelect);
}

/** Node config of `nodeId` (own property only), or undefined. */
export function getNodeConfig(config: PipelineConfig, nodeId: string): NodeConfig | undefined {
  return hasOwn(config.nodes, nodeId) ? config.nodes[nodeId] : undefined;
}

/** Lowercase, trimmed, Vietnamese diacritics stripped (NFD + combining marks removed, đ -> d). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Status keyword tables                                               */
/* ------------------------------------------------------------------ */

const TODO_FIRST = /^(not|pending|chua)\b|^未|\bnot (yet )?started\b/;
const DONE = new RegExp(
  [
    '\\b(done|complete[ds]?|completion|finish(ed)?|closed|resolved|approved|delivered|hoan thanh|xong|da duyet)\\b',
    '完成|已关闭|已解决|已通过',
  ].join('|'),
);
const BLOCKED = new RegExp(
  [
    '\\b(block(ed|er|ing)?|stuck|hold|on hold|paused?|cancell?ed|cancel|reject(ed)?|fail(ed)?)\\b',
    '\\b(bi chan|tam dung|tam hoan|huy|tu choi)\\b',
    '阻塞|暂停|挂起|取消|拒绝|驳回|失败',
  ].join('|'),
);
const DOING = new RegExp(
  [
    '\\b(progress|doing|working|wip|ongoing|review(ing)?|testing|active|started|processing)\\b',
    '\\b(dang|thuc hien|da bat dau)\\b',
    '进行中|处理中|开发中|测试中|审核中|评审中',
  ].join('|'),
);

/* ------------------------------------------------------------------ */
/* Defaults & repair                                                   */
/* ------------------------------------------------------------------ */

type RawConfig = Record<string, unknown>;

function buildDefault(fields: FieldMeta[]): RawConfig {
  const singleSelects = fields.filter((f) => f.type === FieldType.SingleSelect);
  const stage = pickStageField(singleSelects);
  const status = bestMatch(
    singleSelects.filter((f) => f !== stage),
    STATUS_HINTS,
  );
  return {
    version: CONFIG_VERSION,
    titleFieldId: fields.find((f) => f.isPrimary)?.id,
    stageFieldId: stage?.id,
    statusFieldId: status?.id,
    statusCategories: {},
    requireDoneToAdvance: false,
    allowRollback: true,
    nodes: {},
    edges: null,
    roleFieldIds: [],
    checklistFieldIds: [],
    listFieldIds: [],
  };
}

function pickStageField(singleSelects: FieldMeta[]): FieldMeta | undefined {
  const scored = singleSelects.map((f) => ({
    field: f,
    score: hintScore(f.name, STAGE_HINTS) * 2 - (hintScore(f.name, STATUS_HINTS) > 0 ? 1 : 0),
  }));
  let best: { field: FieldMeta; score: number } | undefined;
  for (const s of scored) if (s.score > 0 && (!best || s.score > best.score)) best = s;
  if (best) return best.field;
  return singleSelects.find((f) => hintScore(f.name, STATUS_HINTS) === 0) ?? singleSelects[0];
}

function bestMatch(candidates: FieldMeta[], hints: string[]): FieldMeta | undefined {
  let best: FieldMeta | undefined;
  let bestScore = 0;
  for (const f of candidates) {
    const score = hintScore(f.name, hints);
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

/** 2 = exact (normalized) match, 1 = contains a hint, 0 = no match. */
function hintScore(name: string, hints: string[]): number {
  const n = normalizeText(typeof name === 'string' ? name : '');
  let score = 0;
  for (const hint of hints) {
    const h = normalizeText(hint);
    if (n === h) return 2;
    if (n.includes(h)) score = 1;
  }
  return score;
}

function repair(raw: RawConfig, fields: FieldMeta[]): PipelineConfig {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const fieldOf = (value: unknown, types?: FieldType[]): FieldMeta | undefined => {
    if (typeof value !== 'string') return undefined;
    const f = byId.get(value);
    return f && (!types || types.includes(f.type)) ? f : undefined;
  };

  const stageField = fieldOf(raw.stageFieldId, [FieldType.SingleSelect]);
  const statusCandidate = fieldOf(raw.statusFieldId, [FieldType.SingleSelect]);
  const statusField = statusCandidate && statusCandidate !== stageField ? statusCandidate : undefined;
  const stageOptions = optionsOf(stageField);
  const statusOptions = optionsOf(statusField);
  const statusIds = new Set(statusOptions.map((o) => o.id));

  const rawCategories = isPlainObject(raw.statusCategories) ? raw.statusCategories : {};
  const statusCategories: Record<string, StatusCategory> = {};
  for (const opt of statusOptions) {
    const stored = hasOwn(rawCategories, opt.id) ? rawCategories[opt.id] : undefined;
    statusCategories[opt.id] = isCategory(stored) ? stored : guessStatusCategory(opt.name);
  }

  const storedDefault = raw.defaultEntryStatusId;
  const defaultEntryStatusId =
    typeof storedDefault === 'string' && statusIds.has(storedDefault)
      ? storedDefault
      : (statusOptions.find((o) => statusCategories[o.id] === 'todo') ?? statusOptions[0])?.id;

  const rawNodes = isPlainObject(raw.nodes) ? raw.nodes : {};
  const nodes: Record<string, NodeConfig> = {};
  for (const opt of stageOptions) {
    nodes[opt.id] = repairNode(hasOwn(rawNodes, opt.id) ? rawNodes[opt.id] : undefined, byId, statusIds);
  }

  const title = fieldOf(raw.titleFieldId) ?? fields.find((f) => f.isPrimary);

  return {
    version: CONFIG_VERSION,
    titleFieldId: title?.id,
    stageFieldId: stageField?.id,
    statusFieldId: statusField?.id,
    enteredAtFieldId: fieldOf(raw.enteredAtFieldId, [FieldType.DateTime])?.id,
    historyFieldId: fieldOf(raw.historyFieldId, [FieldType.Text])?.id,
    sourceViewId: typeof raw.sourceViewId === 'string' && raw.sourceViewId !== '' ? raw.sourceViewId : undefined,
    statusCategories,
    defaultEntryStatusId,
    requireDoneToAdvance: typeof raw.requireDoneToAdvance === 'boolean' ? raw.requireDoneToAdvance : false,
    allowRollback: typeof raw.allowRollback === 'boolean' ? raw.allowRollback : true,
    nodes,
    edges: stageField && Array.isArray(raw.edges) ? repairEdges(raw.edges, stageOptions) : null,
    roleFieldIds: idList(raw.roleFieldIds, (id) => !!fieldOf(id, [FieldType.User])),
    checklistFieldIds: idList(raw.checklistFieldIds, (id) => !!fieldOf(id, [FieldType.Checkbox])),
    listFieldIds: idList(raw.listFieldIds, (id) => !!fieldOf(id)),
  };
}

function repairNode(raw: unknown, byId: Map<string, FieldMeta>, statusIds: Set<string>): NodeConfig {
  const node: NodeConfig = { fields: [] };
  if (!isPlainObject(raw)) return node;

  const seen = new Set<string>();
  for (const rule of Array.isArray(raw.fields) ? raw.fields : []) {
    if (!isPlainObject(rule) || typeof rule.fieldId !== 'string') continue;
    if (!byId.has(rule.fieldId) || seen.has(rule.fieldId)) continue;
    seen.add(rule.fieldId);
    const clean: NodeFieldRule = { fieldId: rule.fieldId, required: rule.required === true };
    node.fields.push(clean);
  }
  const owner = typeof raw.ownerFieldId === 'string' ? byId.get(raw.ownerFieldId) : undefined;
  if (owner && owner.type === FieldType.User) node.ownerFieldId = owner.id;
  if (typeof raw.entryStatusId === 'string' && statusIds.has(raw.entryStatusId)) node.entryStatusId = raw.entryStatusId;
  if (typeof raw.description === 'string' && raw.description !== '') node.description = raw.description;
  return node;
}

/**
 * Edges between current stage options. An edge into an option that no longer exists is
 * bridged to the surviving options reached through removed ones, so deleting a middle node
 * (A→B→C with B deleted) keeps A→C instead of splitting the pipeline.
 */
function repairEdges(raw: unknown[], stageOptions: SelectOption[]): Edge[] {
  const ids = new Set(stageOptions.map((o) => o.id));
  const valid: Edge[] = [];
  const successors = new Map<string, string[]>();
  for (const e of raw) {
    if (!isPlainObject(e) || typeof e.from !== 'string' || typeof e.to !== 'string' || e.from === e.to) continue;
    valid.push({ from: e.from, to: e.to });
    successors.set(e.from, [...(successors.get(e.from) ?? []), e.to]);
  }

  /** Surviving options reachable from the removed option `id` through removed options only. */
  const survivorsAfter = (id: string): string[] => {
    const found: string[] = [];
    const seen = new Set([id]);
    const queue = [id];
    while (queue.length > 0) {
      for (const next of successors.get(queue.shift() as string) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        if (ids.has(next)) found.push(next);
        else queue.push(next);
      }
    }
    return found;
  };

  const seen = new Set<string>();
  const edges: Edge[] = [];
  const add = (from: string, to: string) => {
    const key = `${from}\u0000${to}`;
    if (from === to || seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };
  for (const e of valid) {
    if (!ids.has(e.from)) continue;
    if (ids.has(e.to)) add(e.from, e.to);
    else for (const to of survivorsAfter(e.to)) add(e.from, to);
  }
  return edges;
}

function idList(raw: unknown, keep: (id: string) => boolean): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === 'string' && !out.includes(id) && keep(id)) out.push(id);
  }
  return out;
}

function optionsOf(field: FieldMeta | undefined): SelectOption[] {
  if (!field || !Array.isArray(field.options)) return [];
  const seen = new Set<string>();
  return field.options.filter((o) => {
    if (!o || typeof o.id !== 'string' || seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

function asFieldList(fields: unknown): FieldMeta[] {
  if (!Array.isArray(fields)) return [];
  return fields.filter((f): f is FieldMeta => isPlainObject(f) && typeof f.id === 'string');
}

function isCategory(value: unknown): value is StatusCategory {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
