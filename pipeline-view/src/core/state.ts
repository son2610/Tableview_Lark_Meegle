import type { FieldMeta, PipelineConfig, PipelineGraph, RecordData, RecordNodeStates, StatusCategory } from '../types';

/** Category of a status option id under the config (null when unknown / no id). */
export function getStatusCategory(config: PipelineConfig, statusOptionId: string | null | undefined): StatusCategory | null {
  void config;
  void statusOptionId;
  throw new Error('TODO: implement getStatusCategory');
}

/**
 * Per-record node states.
 * - current = stage option id of the record if it is a graph node, else null
 *   (unknownStageText set when the cell has a value that is not a node).
 * - visited = node ids whose NAME appears as `from`/`to` of a parsed history entry
 *   (history read from config.historyFieldId, if configured).
 * - For every node:
 *   current node -> 'done' if it is terminal and currentCategory === 'done' (finished), else 'active';
 *   strict ancestor of current -> 'done' when history is empty/unconfigured or the node is visited,
 *                                 'skipped' otherwise;
 *   everything else -> 'pending'.
 * - When current is null every node is 'pending'.
 */
export function computeNodeStates(
  graph: PipelineGraph,
  record: RecordData,
  config: PipelineConfig,
  fieldById: Map<string, FieldMeta>,
): RecordNodeStates {
  void graph;
  void record;
  void config;
  void fieldById;
  throw new Error('TODO: implement computeNodeStates');
}

/** ms timestamp from config.enteredAtFieldId, or null. */
export function getEnteredAt(record: RecordData, config: PipelineConfig): number | null {
  void record;
  void config;
  throw new Error('TODO: implement getEnteredAt');
}
