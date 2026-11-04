import type {
  FieldMeta,
  HistoryEntry,
  NodeState,
  PipelineConfig,
  PipelineGraph,
  RecordData,
  RecordNodeStates,
  StatusCategory,
  VisitSource,
} from '../types';
import { cellToText, getSelectId, segmentsToText } from './cell';
import { ancestors, dominators } from './graph';
import { parseHistory } from './history';
import { pathCoverage, readPathCell } from './path';

/** Category of a status option id under the config (null when unknown / no id). */
export function getStatusCategory(config: PipelineConfig, statusOptionId: string | null | undefined): StatusCategory | null {
  if (!statusOptionId || !Object.prototype.hasOwnProperty.call(config.statusCategories, statusOptionId)) return null;
  return config.statusCategories[statusOptionId] ?? null;
}

/**
 * Per-record node states.
 * - current = stage option id of the record if it is a graph node, else null
 *   (unknownStageText set when the cell has a value that is not a node).
 * - What is known about the visited steps comes from readVisits: the path field when it names
 *   a node ('path'), else the history log ('history'), else only the graph itself ('inferred').
 * - For every node:
 *   current node -> 'done' if it is terminal and currentCategory === 'done' (finished), else 'active';
 *   strict ancestor of current -> 'done' when known visited or certain (on every route to a
 *                                 step known passed: a dominator); 'unknown' when the source says
 *                                 nothing about it (no path / history, before a log that starts
 *                                 mid-way, before a gap in the ticked steps, or a step the path
 *                                 field has no option for); else 'skipped' (the source covers it
 *                                 and it was not passed) — so a linear pipeline without any record
 *                                 of visits is all done;
 *   everything else -> 'pending'.
 * - When current is null every node is 'pending'.
 * - visited = path nodes plus the current node for 'path', else the nodes named in the history log.
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

  const visits = readVisits(graph, record, config, fieldById);
  const finished =
    current !== null && (graph.successors.get(current) ?? []).length === 0 && currentCategory === 'done';

  const states = new Map<string, NodeState>();
  const before = current === null ? new Set<string>() : ancestors(graph, current);
  for (const node of graph.nodes) {
    let state: NodeState = 'pending';
    if (node.id === current) state = finished ? 'done' : 'active';
    else if (before.has(node.id)) {
      if (visits.visited.has(node.id) || visits.certain.has(node.id)) state = 'done';
      else if (visits.uncovered.has(node.id)) state = 'unknown';
      else state = 'skipped';
    }
    states.set(node.id, state);
  }

  const visited = new Set(visits.visited);
  if (visits.source === 'path' && current !== null) visited.add(current);

  const result: RecordNodeStates = { current, currentCategory, states, visited, visitSource: visits.source, finished };
  if (unknownStageText !== undefined) result.unknownStageText = unknownStageText;
  return result;
}

/** What is known about the steps a record went through (see readVisits). */
export interface RecordVisits {
  source: VisitSource;
  /** Nodes known to have been visited. */
  visited: Set<string>;
  /**
   * Nodes the source says nothing about. Any other node that is in neither `visited` nor
   * `certain` is known NOT to have been visited (in the current run).
   */
  uncovered: Set<string>;
  /** Nodes visited all the same: they lie on every route to a node known to have been reached. */
  certain: Set<string>;
}

/**
 * What is known about the steps a record went through, from the first available source:
 * - 'path': the configured path field (MultiSelect, still present in `fieldById`) names at least
 *   one node. visited = those nodes (options naming no node are ignored); uncovered / certain as
 *   pathCoverage explains: the steps before a gap in the ticked route, and those the field has no
 *   option for, are uncovered; the steps on every route to the current node or to a ticked step
 *   are certain.
 * - 'history': the history log names at least one current node. visited = the logged nodes.
 *   A log with a start line ("▶") covers everything. A log without one began mid-way (the field
 *   was added later, or old lines were trimmed): it covers only its first logged node (the target
 *   when the first line is a rollback: the run restarts there) and what comes after it, so the
 *   ancestors of that node are uncovered. A log naming a node that no
 *   longer exists (renamed / deleted option) proves visits but nothing skipped: the ancestors of
 *   the current node are uncovered.
 * - 'inferred': otherwise; nothing visited, the ancestors of the current node are uncovered.
 * For 'history' / 'inferred', certain = the dominators of the node the uncovered part leads to
 * (the first logged node, or the current node).
 */
export function readVisits(
  graph: PipelineGraph,
  record: RecordData,
  config: PipelineConfig,
  fieldById: Map<string, FieldMeta>,
): RecordVisits {
  const none = new Set<string>();
  const stageId = config.stageFieldId ? getSelectId(record.fields[config.stageFieldId]) : null;
  const current = stageId !== null && graph.nodeById.has(stageId) ? stageId : null;

  const path = readPathCell(graph, record, config, fieldById);
  if (path && path.ticked.size > 0) {
    const coverage = current === null ? { uncovered: none, certain: none } : pathCoverage(graph, current, path.ticked, path.noOption);
    return { source: 'path', visited: path.ticked, ...coverage };
  }

  const history = readHistory(record, config);
  const visited = visitedNodeIds(graph, history);
  // Before `anchor` only the graph tells what was visited; from it on, the log is complete.
  let anchor = current;
  if (visited.size > 0 && trustedVisited(graph, history) !== null) {
    if (history.some((e) => e.kind === 'start')) return { source: 'history', visited, uncovered: none, certain: none };
    anchor = firstLoggedNode(graph, history) ?? current;
  }
  return {
    source: visited.size > 0 ? 'history' : 'inferred',
    visited,
    uncovered: anchor === null ? none : ancestors(graph, anchor),
    certain: anchor === null ? none : dominators(graph, anchor),
  };
}

/**
 * Node of the first logged step: the `from` of an advance, the target of a rollback (the run
 * restarts there, and the log covers it from then on), the node of a "✓" line.
 */
function firstLoggedNode(graph: PipelineGraph, history: HistoryEntry[]): string | null {
  const first = history[0];
  const name = ((first?.kind === 'advance' ? first.from : first?.to) ?? '').trim();
  return graph.nodes.find((n) => n.name.trim() === name)?.id ?? null;
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
