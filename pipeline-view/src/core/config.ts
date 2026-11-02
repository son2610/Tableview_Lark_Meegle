import type { FieldMeta, PipelineConfig, StatusCategory } from '../types';

/**
 * Best-effort default config for a table that has never been configured.
 * - titleFieldId: primary field.
 * - stageFieldId: the SingleSelect whose name best matches stage hints
 *   (stage, phase, step, pipeline, flow, giai đoạn, bước, quy trình, công đoạn, 阶段, 流程),
 *   else the first SingleSelect, else undefined.
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
  void fields;
  throw new Error('TODO: implement createDefaultConfig');
}

/**
 * Validate and repair a stored config against the current fields. Never throws.
 * - Non-object / wrong version -> createDefaultConfig(fields).
 * - Field ids that no longer exist or have an unexpected type are dropped
 *   (stage/status must be SingleSelect, enteredAt DateTime, history Text, owner User,
 *   role fields User, checklist fields Checkbox). titleFieldId falls back to primary.
 * - nodes: exactly one entry per current stage option (missing -> {fields: []});
 *   rules referencing missing fields are dropped; duplicate fieldIds collapsed;
 *   entryStatusId dropped when not a current status option.
 * - edges: if not null, keep only edges between current stage options, no duplicates /
 *   self loops. (A stored empty array stays [] – the user removed all edges on purpose.)
 * - statusCategories: keep known options, guess categories for new ones, drop stale ids.
 * - defaultEntryStatusId must be a current status option, else re-derived.
 * - Booleans default as in createDefaultConfig.
 * Returns a NEW object; does not mutate `raw`.
 */
export function normalizeConfig(raw: unknown, fields: FieldMeta[]): PipelineConfig {
  void raw;
  void fields;
  throw new Error('TODO: implement normalizeConfig');
}

/**
 * Category from a status option name (case/diacritics-insensitive, vi/en/zh):
 * done: done, complete(d), finish(ed), closed, resolved, approved, hoàn thành, xong, đã xong, 完成, 已完成
 * blocked: block(ed), stuck, hold, on hold, pending review? (NO), cancel(l)ed, reject(ed), bị chặn, tạm dừng, hủy, từ chối, 阻塞, 暂停
 * doing: progress, doing, working, review(ing), testing, active, started, đang, thực hiện, 进行中
 * otherwise todo (not started, todo, new, open, chưa, mới, 未开始 ...).
 * "Pending ..." counts as todo.
 */
export function guessStatusCategory(name: string): StatusCategory {
  void name;
  throw new Error('TODO: implement guessStatusCategory');
}

/** Status option to set when a record enters `nodeId` (node override, else default). */
export function getEntryStatusId(config: PipelineConfig, nodeId: string): string | undefined {
  void config;
  void nodeId;
  throw new Error('TODO: implement getEntryStatusId');
}

/**
 * Status option used to mark a finished record: first option (in option order) whose
 * category is 'done'; undefined if none / no status field.
 */
export function getDoneStatusId(config: PipelineConfig, statusField: FieldMeta | undefined): string | undefined {
  void config;
  void statusField;
  throw new Error('TODO: implement getDoneStatusId');
}

/** True when a stage field is set and still exists as a SingleSelect in `fields`. */
export function isConfigured(config: PipelineConfig, fields: FieldMeta[]): boolean {
  void config;
  void fields;
  throw new Error('TODO: implement isConfigured');
}
