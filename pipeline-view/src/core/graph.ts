import type { Edge, PipelineGraph, SelectOption } from '../types';

/**
 * Edges for a linear pipeline following the option order:
 * opt[0] -> opt[1] -> ... -> opt[n-1].
 */
export function defaultLinearEdges(stageOptions: SelectOption[]): Edge[] {
  void stageOptions;
  throw new Error('TODO: implement defaultLinearEdges');
}

/**
 * Build the pipeline graph.
 * - nodes = stage options (option order, `index` = position).
 * - edges = `edges ?? defaultLinearEdges(stageOptions)`, keeping only edges whose
 *   endpoints both exist, dropping self loops and duplicates.
 * - successors/predecessors lists are sorted by node index.
 * - roots / terminals in option order. An isolated node is both a root and a terminal.
 * Never throws; cycles are allowed in the input (use findCycle to report them).
 */
export function buildGraph(stageOptions: SelectOption[], edges: Edge[] | null): PipelineGraph {
  void stageOptions;
  void edges;
  throw new Error('TODO: implement buildGraph');
}

/**
 * Return one cycle as a list of node ids (first id repeated at the end is NOT included),
 * or null when the directed graph is acyclic. Unknown ids in edges are ignored.
 */
export function findCycle(nodeIds: string[], edges: Edge[]): string[] | null {
  void nodeIds;
  void edges;
  throw new Error('TODO: implement findCycle');
}

/** All nodes that can reach `nodeId` (excluding itself). Safe on cyclic graphs. */
export function ancestors(graph: PipelineGraph, nodeId: string): Set<string> {
  void graph;
  void nodeId;
  throw new Error('TODO: implement ancestors');
}

/** All nodes reachable from `nodeId` (excluding itself). Safe on cyclic graphs. */
export function descendants(graph: PipelineGraph, nodeId: string): Set<string> {
  void graph;
  void nodeId;
  throw new Error('TODO: implement descendants');
}

/**
 * Node ids in a topological order that is stable w.r.t. option order
 * (Kahn's algorithm picking the smallest option index first). Nodes on cycles
 * are appended at the end in option order.
 */
export function topoOrder(graph: PipelineGraph): string[] {
  void graph;
  throw new Error('TODO: implement topoOrder');
}
