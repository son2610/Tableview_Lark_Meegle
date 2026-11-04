import { FieldType } from '../types';
import type {
  FieldMeta,
  FieldsPatch,
  PipelineConfig,
  PipelineGraph,
  RecordData,
  SelectOption,
  TransitionKind,
  ValidationIssue,
  ValidationResult,
} from '../types';
import { cellToText, getSelectId, isCellEmpty, makeSelectValue, segmentsToText, textToSegments } from './cell';
import { getDoneStatusId, getEntryStatusId, getNodeConfig } from './config';
import { ancestors, topoOrder } from './graph';
import { appendHistory, formatHistoryLine } from './history';
import {
  getPathField,
  missingPathNodes,
  nodesWithoutOption,
  pathAfter,
  pathCellValue,
  pathCoverage,
  replayHistory,
  selectedPathOptions,
  splitPathOptions,
  withCellOptions,
} from './path';
import { getStatusCategory, readHistory, readVisits, trustedVisited } from './state';

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
 * strict ancestors of the current node, ordered by topoOrder and filtered by what is known
 * about the record's visits (readVisits): ancestors known to have been passed (visited or
 * certain), plus those nothing is known about. Only ancestors proven never passed are left out, so
 * - 'path': ancestors named by the path field, those on every route, and those the cell does not
 *   cover (before a gap in the ticked route, or without an option in the field);
 * - 'history': ancestors named in the log; with a log that names a node that no longer exists
 *   (renamed / deleted option) or starts mid-way, also the ancestors it says nothing about;
 * - 'inferred': every ancestor, so a record without visit information is never stuck.
 */
export function rollbackTargets(ctx: TransitionContext, record: RecordData): string[] {
  if (!ctx.config.allowRollback) return [];
  const current = currentNodeId(ctx, record);
  if (current === null) return [];
  const candidates = ancestors(ctx.graph, current);
  const { visited, uncovered, certain } = readVisits(ctx.graph, record, ctx.config, ctx.fieldById);
  return topoOrder(ctx.graph).filter(
    (id) => candidates.has(id) && (visited.has(id) || uncovered.has(id) || certain.has(id)),
  );
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
 * Path field (config.pathFieldId, a MultiSelect present in ctx.fieldById), written on every kind:
 *   start → {to}; advance → existing ∪ {current, to}; rollback to X → (existing ∪ {X}) minus the
 *   descendants of X; complete → existing ∪ {current} (see pathAfter, which also drops ticks that
 *   do not lead to the current node). The value lists the options of those nodes in topoOrder,
 *   then the selected options that match no node, untouched and in their original order (also
 *   those missing from the cached field metadata). Nodes whose name has no option are left out
 *   (missingPathOptionNames lists them so the caller can create the options first); an empty
 *   result clears the cell. A cell that ticks no node yet is seeded from what is known (see
 *   planPath).
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
  const writePath = (to: string | null) => {
    const plan = planPath(ctx, record, kind, to);
    if (plan) patch[plan.field.id] = pathCellValue(graph, plan.field, plan.nodes, plan.others);
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
    writePath(null);
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
  writePath(target.id);
  return patch;
}

/**
 * Names (trimmed, in topoOrder) of the nodes that buildTransitionPatch would tick in the path
 * field but that have no option there yet. [] when no path field is configured or the transition
 * cannot be built (unknown target, 'complete' without a current node).
 */
export function missingPathOptionNames(
  ctx: TransitionContext,
  record: RecordData,
  kind: TransitionKind,
  toNodeId?: string,
): string[] {
  if (kind !== 'complete' && (!toNodeId || !ctx.graph.nodeById.has(toNodeId))) return [];
  if (kind === 'complete' && currentNodeId(ctx, record) === null) return [];
  const plan = planPath(ctx, record, kind, kind === 'complete' ? null : (toNodeId as string));
  if (!plan) return [];
  return missingPathNodes(ctx.graph, plan.field, plan.nodes).map((id) => (ctx.graph.nodeById.get(id)?.name ?? '').trim());
}

/**
 * Path field (with the options the cell proves exist, see withCellOptions) and the steps passed
 * after the transition, or null when no path field is configured. The cell is written on every
 * transition: a gap in the ticked route reads as "not recorded", never as "not passed" (see
 * pathCoverage), so ticking what is known never misstates an unknown branch.
 */
function planPath(
  ctx: TransitionContext,
  record: RecordData,
  kind: TransitionKind,
  to: string | null,
): { field: FieldMeta; nodes: Set<string>; others: SelectOption[] } | null {
  const configured = getPathField(ctx.config, ctx.fieldById);
  if (!configured) return null;
  const { graph } = ctx;
  const value = record.fields[configured.id];
  const field = withCellOptions(configured, value);
  const current = currentNodeId(ctx, record);
  const { nodes: ticked, others } = splitPathOptions(graph, selectedPathOptions(field, value));
  const base = ticked.size > 0 || kind === 'start' ? ticked : seedPath(ctx, record, field, kind, current, to);
  return { field, nodes: pathAfter(graph, base, kind, current, to), others };
}

/**
 * Steps to start from when the cell ticks no step yet (a record from before the field existed):
 * the current run as the trusted history log proves it (replayHistory, so a branch undone by a
 * rollback is not ticked), limited to the current node and its ancestors; plus the steps that lie
 * on every route there (readVisits' `certain`), unless ticking them would make the written route
 * look complete across an unknown branch (a shortcut edge, e.g. A → D beside A → B → D, would turn
 * B into "not passed"). Steps whose name has no option are not written, so they are not ticked
 * in that check either.
 */
function seedPath(
  ctx: TransitionContext,
  record: RecordData,
  field: FieldMeta,
  kind: TransitionKind,
  current: string | null,
  to: string | null,
): Set<string> {
  const { graph, config, fieldById } = ctx;
  if (current === null) return new Set();
  const route = ancestors(graph, current).add(current);
  const history = readHistory(record, config);
  const proven = trustedVisited(graph, history) ? replayHistory(graph, history) : new Set<string>();
  const known = new Set([...proven].filter((id) => route.has(id)));
  const visits = readVisits(graph, record, config, fieldById);
  const seeded = new Set([...known, ...[...visits.certain].filter((id) => route.has(id))]);
  const destination = kind === 'complete' ? current : to;
  if (seeded.size === known.size || destination === null) return known;

  const noOption = nodesWithoutOption(graph, field);
  const written = new Set([...pathAfter(graph, seeded, kind, current, to)].filter((id) => !noOption.has(id)));
  const after = pathCoverage(graph, destination, written, noOption);
  const reached = ancestors(graph, destination);
  const hidesUnknown = [...visits.uncovered].some(
    (id) =>
      reached.has(id) &&
      !visits.visited.has(id) &&
      !visits.certain.has(id) &&
      !written.has(id) &&
      !after.uncovered.has(id) &&
      !after.certain.has(id),
  );
  return hidesUnknown ? known : seeded;
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
