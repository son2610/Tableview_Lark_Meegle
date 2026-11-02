import type {
  FieldMeta,
  FieldsPatch,
  PipelineConfig,
  PipelineGraph,
  RecordData,
  TransitionKind,
  ValidationResult,
} from '../types';

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
 */
export function validateNode(ctx: TransitionContext, record: RecordData, nodeId: string): ValidationResult {
  void ctx;
  void record;
  void nodeId;
  throw new Error('TODO: implement validateNode');
}

/** Current stage option id of the record if it is a node of the graph, else null. */
export function currentNodeId(ctx: TransitionContext, record: RecordData): string | null {
  void ctx;
  void record;
  throw new Error('TODO: implement currentNodeId');
}

/** Successor node ids of the record's current node ([] when none / not started). */
export function nextTargets(ctx: TransitionContext, record: RecordData): string[] {
  void ctx;
  void record;
  throw new Error('TODO: implement nextTargets');
}

/**
 * Nodes the record may be sent back to: [] unless config.allowRollback. Otherwise the
 * strict ancestors of the current node, filtered to visited nodes when history is
 * configured and non-empty, ordered by topoOrder.
 */
export function rollbackTargets(ctx: TransitionContext, record: RecordData): string[] {
  void ctx;
  void record;
  throw new Error('TODO: implement rollbackTargets');
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
 */
export function buildTransitionPatch(
  ctx: TransitionContext,
  record: RecordData,
  kind: TransitionKind,
  toNodeId?: string,
): FieldsPatch {
  void ctx;
  void record;
  void kind;
  void toNodeId;
  throw new Error('TODO: implement buildTransitionPatch');
}

/** Count of required fields filled vs total for a node, e.g. {filled: 2, total: 3}. */
export function requiredProgress(ctx: TransitionContext, record: RecordData, nodeId: string): { filled: number; total: number } {
  void ctx;
  void record;
  void nodeId;
  throw new Error('TODO: implement requiredProgress');
}
