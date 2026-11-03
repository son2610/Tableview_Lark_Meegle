import { FieldType } from '../types';
import type {
  FieldMeta,
  FieldsPatch,
  PipelineConfig,
  PipelineGraph,
  RecordData,
  TransitionKind,
  ValidationIssue,
  ValidationResult,
} from '../types';
import { cellToText, getSelectId, isCellEmpty, makeSelectValue, segmentsToText, textToSegments } from './cell';
import { getDoneStatusId, getEntryStatusId, getNodeConfig } from './config';
import { ancestors, topoOrder } from './graph';
import { appendHistory, formatHistoryLine } from './history';
import { getStatusCategory, readHistory, trustedVisited } from './state';

export interface TransitionContext {
  config: PipelineConfig;
  fieldById: Map<string, FieldMeta>;
  graph: PipelineGraph;
  /** ms timestamp used for enteredAt and history lines. */
  now: number;
}

/**
 * Check the node's required fields on `record` (isCellEmpty; checkbox -> 'unchecked'),
 * in the node's field order. Rules whose field no longer exists are ignored.
 * statusNotDone = config.requireDoneToAdvance && status field configured &&
 *                 category of the record's status !== 'done'.
 * ok = missing.length === 0 && !statusNotDone.
 * "Configured" means config.statusFieldId is set AND present in ctx.fieldById (a deleted
 * status field must not block every record).
 */
export function validateNode(ctx: TransitionContext, record: RecordData, nodeId: string): ValidationResult {
  const missing: ValidationIssue[] = [];
  for (const rule of getNodeConfig(ctx.config, nodeId)?.fields ?? []) {
    if (!rule.required) continue;
    const field = ctx.fieldById.get(rule.fieldId);
    if (!field || !isCellEmpty(field, record.fields[rule.fieldId])) continue;
    missing.push({ fieldId: rule.fieldId, reason: field.type === FieldType.Checkbox ? 'unchecked' : 'empty' });
  }
  const statusFieldId = configuredField(ctx, ctx.config.statusFieldId)?.id;
  const statusNotDone =
    ctx.config.requireDoneToAdvance &&
    statusFieldId !== undefined &&
    getStatusCategory(ctx.config, getSelectId(record.fields[statusFieldId])) !== 'done';
  return { ok: missing.length === 0 && !statusNotDone, missing, statusNotDone };
}

/** Current stage option id of the record if it is a node of the graph, else null. */
export function currentNodeId(ctx: TransitionContext, record: RecordData): string | null {
  if (!ctx.config.stageFieldId) return null;
  const id = getSelectId(record.fields[ctx.config.stageFieldId]);
  return id !== null && ctx.graph.nodeById.has(id) ? id : null;
}

/** Successor node ids of the record's current node ([] when none / not started). */
export function nextTargets(ctx: TransitionContext, record: RecordData): string[] {
  const current = currentNodeId(ctx, record);
  return current === null ? [] : [...(ctx.graph.successors.get(current) ?? [])];
}

/**
 * Nodes the record may be sent back to: [] unless config.allowRollback. Otherwise the
 * strict ancestors of the current node, filtered to visited nodes when history is
 * configured and non-empty, ordered by topoOrder.
 * "Non-empty" means at least one history line could be parsed; a log naming a node that no
 * longer exists (renamed / deleted option) is not used for filtering (see trustedVisited).
 */
export function rollbackTargets(ctx: TransitionContext, record: RecordData): string[] {
  if (!ctx.config.allowRollback) return [];
  const current = currentNodeId(ctx, record);
  if (current === null) return [];
  const candidates = ancestors(ctx.graph, current);
  const visited = trustedVisited(ctx.graph, readHistory(record, ctx.config));
  return topoOrder(ctx.graph).filter((id) => candidates.has(id) && (visited === null || visited.has(id)));
}

/**
 * Cells to write for a transition. Does NOT validate (callers run validateNode first).
 * - start/advance/rollback (toNodeId required):
 *     stage := {id, text} of toNodeId;
 *     status := entry status of toNodeId (getEntryStatusId) when status field configured
 *               (omitted when no entry status is defined);
 *     enteredAt := ctx.now when configured;
 *     history := appendHistory(old text, formatHistoryLine(...)) when configured, as text segments.
 * - complete (record must be at a terminal node; toNodeId ignored):
 *     status := getDoneStatusId when available; history line "✓ <current>"; stage/enteredAt unchanged.
 * Throws Error when the stage field is not configured, toNodeId is unknown, or 'complete'
 * is requested for a record without a current node.
 * Also throws when 'complete' is requested on a node that has successors.
 * Optional fields (status / enteredAt / history) count as configured only when their id is
 * set AND present in ctx.fieldById; an entry status that is not an option of the status
 * field is omitted. The history `from` of advance/rollback is the current node's name, or
 * the raw stage text when the stage value is not a node; when the stage is empty the line
 * is written as a start ("▶ <to>").
 */
export function buildTransitionPatch(
  ctx: TransitionContext,
  record: RecordData,
  kind: TransitionKind,
  toNodeId?: string,
): FieldsPatch {
  const { config, graph } = ctx;
  const stageFieldId = config.stageFieldId;
  if (!stageFieldId) throw new Error('Pipeline stage field is not configured');

  const statusField = configuredField(ctx, config.statusFieldId);
  const enteredAtField = configuredField(ctx, config.enteredAtFieldId);
  const historyField = configuredField(ctx, config.historyFieldId);
  const current = currentNodeId(ctx, record);
  const patch: FieldsPatch = {};

  const appendLine = (entry: { kind: TransitionKind; from?: string; to?: string }) => {
    if (!historyField) return;
    const old = segmentsToText(record.fields[historyField.id]);
    patch[historyField.id] = textToSegments(appendHistory(old, formatHistoryLine({ at: ctx.now, ...entry })));
  };

  if (kind === 'complete') {
    if (current === null) throw new Error('Cannot complete a record that is not at a pipeline node');
    if ((graph.successors.get(current) ?? []).length > 0) {
      throw new Error('Only a record at a terminal node can be completed');
    }
    const doneId = statusField ? getDoneStatusId(config, statusField) : undefined;
    const doneOption = doneId ? statusField?.options?.find((o) => o.id === doneId) : undefined;
    if (statusField && doneOption) patch[statusField.id] = makeSelectValue(doneOption);
    appendLine({ kind, to: graph.nodeById.get(current)?.name });
    return patch;
  }

  const target = toNodeId ? graph.nodeById.get(toNodeId) : undefined;
  if (!target) throw new Error(`Unknown pipeline node: ${toNodeId ?? '(none)'}`);

  patch[stageFieldId] = makeSelectValue(target);

  if (statusField) {
    const entryId = getEntryStatusId(config, target.id);
    const entryOption = entryId ? statusField.options?.find((o) => o.id === entryId) : undefined;
    if (entryOption) patch[statusField.id] = makeSelectValue(entryOption);
  }
  if (enteredAtField) patch[enteredAtField.id] = ctx.now;

  const from =
    kind === 'start'
      ? ''
      : current !== null
        ? graph.nodeById.get(current)?.name ?? ''
        : cellToText(ctx.fieldById.get(stageFieldId), record.fields[stageFieldId]).trim();
  // Leaving "nothing" is logged as a start so the line stays parseable.
  appendLine(from ? { kind, from, to: target.name } : { kind: 'start', to: target.name });
  return patch;
}

/**
 * Count of required fields filled vs total for a node, e.g. {filled: 2, total: 3}.
 * Rules whose field no longer exists are not counted.
 */
export function requiredProgress(ctx: TransitionContext, record: RecordData, nodeId: string): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const rule of getNodeConfig(ctx.config, nodeId)?.fields ?? []) {
    const field = ctx.fieldById.get(rule.fieldId);
    if (!rule.required || !field) continue;
    total++;
    if (!isCellEmpty(field, record.fields[rule.fieldId])) filled++;
  }
  return { filled, total };
}

function configuredField(ctx: TransitionContext, fieldId: string | undefined): FieldMeta | undefined {
  return fieldId ? ctx.fieldById.get(fieldId) : undefined;
}
