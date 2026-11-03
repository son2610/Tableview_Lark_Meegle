import type {
  FieldMeta,
  HistoryEntry,
  NodeState,
  PipelineConfig,
  PipelineGraph,
  RecordData,
  RecordNodeStates,
  StatusCategory,
} from '../types';
import { cellToText, getSelectId, segmentsToText } from './cell';
import { ancestors } from './graph';
import { parseHistory } from './history';

/** Category of a status option id under the config (null when unknown / no id). */
export function getStatusCategory(config: PipelineConfig, statusOptionId: string | null | undefined): StatusCategory | null {
  if (!statusOptionId || !Object.prototype.hasOwnProperty.call(config.statusCategories, statusOptionId)) return null;
  return config.statusCategories[statusOptionId] ?? null;
}

/**
 * Per-record node states.
 * - current = stage option id of the record if it is a graph node, else null
 *   (unknownStageText set when the cell has a value that is not a node).
 * - visited = node ids whose NAME appears as `from`/`to` of a parsed history entry
 *   (history read from config.historyFieldId, if configured).
 * - For every node:
 *   current node -> 'done' if it is terminal and currentCategory === 'done' (finished), else 'active';
 *   strict ancestor of current -> 'done' when history is empty/unconfigured/ambiguous (see
 *                                 trustedVisited) or the node is visited, 'skipped' otherwise;
 *   everything else -> 'pending'.
 * - When current is null every node is 'pending'.
 * "Empty history" means no line of the history cell could be parsed. Names are compared
 * trimmed; every node carrying a logged name counts as visited.
 */
export function computeNodeStates(
  graph: PipelineGraph,
  record: RecordData,
  config: PipelineConfig,
  fieldById: Map<string, FieldMeta>,
): RecordNodeStates {
  const stageValue = config.stageFieldId ? record.fields[config.stageFieldId] : undefined;
  const stageId = getSelectId(stageValue);
  const current = stageId !== null && graph.nodeById.has(stageId) ? stageId : null;

  let unknownStageText: string | undefined;
  if (current === null && config.stageFieldId) {
    const text = cellToText(fieldById.get(config.stageFieldId), stageValue).trim() || stageId || '';
    if (text) unknownStageText = text;
  }

  const currentCategory = config.statusFieldId
    ? getStatusCategory(config, getSelectId(record.fields[config.statusFieldId]))
    : null;

  const history = readHistory(record, config);
  const visited = visitedNodeIds(graph, history);
  const trusted = trustedVisited(graph, history);
  const finished =
    current !== null && (graph.successors.get(current) ?? []).length === 0 && currentCategory === 'done';

  const states = new Map<string, NodeState>();
  const before = current === null ? new Set<string>() : ancestors(graph, current);
  for (const node of graph.nodes) {
    let state: NodeState = 'pending';
    if (node.id === current) state = finished ? 'done' : 'active';
    else if (before.has(node.id)) state = trusted === null || trusted.has(node.id) ? 'done' : 'skipped';
    states.set(node.id, state);
  }

  const result: RecordNodeStates = { current, currentCategory, states, visited, finished };
  if (unknownStageText !== undefined) result.unknownStageText = unknownStageText;
  return result;
}

/** ms timestamp from config.enteredAtFieldId, or null. */
export function getEnteredAt(record: RecordData, config: PipelineConfig): number | null {
  if (!config.enteredAtFieldId) return null;
  const value = record.fields[config.enteredAtFieldId];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Parsed entries of the record's history cell ([] when no history field is configured). */
export function readHistory(record: RecordData, config: PipelineConfig): HistoryEntry[] {
  if (!config.historyFieldId) return [];
  return parseHistory(segmentsToText(record.fields[config.historyFieldId]));
}

/** Node ids whose name appears as `from` / `to` in the given history entries. */
export function visitedNodeIds(graph: PipelineGraph, history: HistoryEntry[]): Set<string> {
  const names = new Set<string>();
  for (const e of history) {
    if (e.from) names.add(e.from.trim());
    if (e.to) names.add(e.to.trim());
  }
  const visited = new Set<string>();
  for (const node of graph.nodes) if (names.has(node.name.trim())) visited.add(node.id);
  return visited;
}

/**
 * Visited node ids when the history can say which ancestors were visited, else null: no line
 * could be parsed, or a logged name matches no current node (an option was renamed or deleted,
 * so the log no longer maps back to nodes and must not hide ancestors as skipped).
 */
export function trustedVisited(graph: PipelineGraph, history: HistoryEntry[]): Set<string> | null {
  if (history.length === 0) return null;
  const names = new Set(graph.nodes.map((n) => n.name.trim()));
  const known = (name: string | undefined) => !name || names.has(name.trim());
  if (!history.every((e) => known(e.from) && known(e.to))) return null;
  return visitedNodeIds(graph, history);
}
