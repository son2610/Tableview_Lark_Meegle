import type { Edge, PipelineGraph, PipelineNode, SelectOption } from '../types';

/**
 * Edges for a linear pipeline following the option order:
 * opt[0] -> opt[1] -> ... -> opt[n-1].
 */
export function defaultLinearEdges(stageOptions: SelectOption[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i + 1 < stageOptions.length; i++) {
    edges.push({ from: stageOptions[i].id, to: stageOptions[i + 1].id });
  }
  return edges;
}

/**
 * Build the pipeline graph.
 * - nodes = stage options (option order, `index` = position). An option whose id was
 *   already seen is ignored (first wins), so `index` is the position among nodes.
 * - edges = `edges ?? defaultLinearEdges(stageOptions)`, keeping only edges whose
 *   endpoints both exist, dropping self loops, duplicates and malformed entries.
 *   `graph.edges` is sorted by (from index, to index), independent of input order.
 * - successors/predecessors lists are sorted by node index; every node has an entry.
 * - roots / terminals in option order. An isolated node is both a root and a terminal.
 * Never throws; cycles are allowed in the input (use findCycle to report them).
 */
export function buildGraph(stageOptions: SelectOption[], edges: Edge[] | null): PipelineGraph {
  const nodes: PipelineNode[] = [];
  const nodeById = new Map<string, PipelineNode>();
  for (const opt of Array.isArray(stageOptions) ? stageOptions : []) {
    if (!opt || typeof opt.id !== 'string' || nodeById.has(opt.id)) continue;
    const node: PipelineNode = {
      id: opt.id,
      name: typeof opt.name === 'string' ? opt.name : String(opt.name ?? ''),
      color: typeof opt.color === 'number' ? opt.color : 0,
      index: nodes.length,
    };
    nodes.push(node);
    nodeById.set(node.id, node);
  }

  const rawEdges: unknown[] = Array.isArray(edges) ? edges : edges == null ? defaultLinearEdges(nodes) : [];
  const seen = new Set<string>();
  const kept: Edge[] = [];
  for (const e of rawEdges) {
    if (!isEdgeLike(e)) continue;
    const { from, to } = e;
    if (from === to || !nodeById.has(from) || !nodeById.has(to)) continue;
    const key = edgeKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ from, to });
  }
  const indexOf = (id: string) => (nodeById.get(id) as PipelineNode).index;
  kept.sort((a, b) => indexOf(a.from) - indexOf(b.from) || indexOf(a.to) - indexOf(b.to));

  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const n of nodes) {
    successors.set(n.id, []);
    predecessors.set(n.id, []);
  }
  // `kept` is sorted by (from, to), so both adjacency lists come out index-sorted.
  for (const e of kept) {
    (successors.get(e.from) as string[]).push(e.to);
    (predecessors.get(e.to) as string[]).push(e.from);
  }

  return {
    nodes,
    nodeById,
    edges: kept,
    successors,
    predecessors,
    roots: nodes.filter((n) => (predecessors.get(n.id) as string[]).length === 0).map((n) => n.id),
    terminals: nodes.filter((n) => (successors.get(n.id) as string[]).length === 0).map((n) => n.id),
  };
}

/**
 * Return one cycle as a list of node ids (first id repeated at the end is NOT included),
 * or null when the directed graph is acyclic. Unknown ids in edges are ignored.
 * A self loop `a -> a` is reported as the cycle `[a]`. Deterministic: DFS starts from
 * `nodeIds` in the given order and explores successors in `nodeIds` order.
 */
export function findCycle(nodeIds: string[], edges: Edge[]): string[] | null {
  const order: string[] = [];
  const position = new Map<string, number>();
  for (const id of nodeIds) {
    if (typeof id !== 'string' || position.has(id)) continue;
    position.set(id, order.length);
    order.push(id);
  }

  const adjacency = new Map<string, string[]>(order.map((id) => [id, []]));
  const seen = new Set<string>();
  for (const e of Array.isArray(edges) ? edges : []) {
    if (!isEdgeLike(e) || !position.has(e.from) || !position.has(e.to)) continue;
    const key = edgeKey(e.from, e.to);
    if (seen.has(key)) continue;
    seen.add(key);
    (adjacency.get(e.from) as string[]).push(e.to);
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => (position.get(a) as number) - (position.get(b) as number));
  }

  const done = new Set<string>();
  // Iterative DFS: `stack` doubles as the current path; `onStack` maps id -> depth.
  for (const start of order) {
    if (done.has(start)) continue;
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    const onStack = new Map<string, number>([[start, 0]]);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const succ = adjacency.get(top.id) as string[];
      if (top.next < succ.length) {
        const v = succ[top.next++];
        const depth = onStack.get(v);
        if (depth !== undefined) return stack.slice(depth).map((f) => f.id);
        if (!done.has(v)) {
          onStack.set(v, stack.length);
          stack.push({ id: v, next: 0 });
        }
      } else {
        stack.pop();
        onStack.delete(top.id);
        done.add(top.id);
      }
    }
  }
  return null;
}

/** All nodes that can reach `nodeId` (excluding itself). Safe on cyclic graphs. */
export function ancestors(graph: PipelineGraph, nodeId: string): Set<string> {
  return reach(graph.predecessors, nodeId);
}

/** All nodes reachable from `nodeId` (excluding itself). Safe on cyclic graphs. */
export function descendants(graph: PipelineGraph, nodeId: string): Set<string> {
  return reach(graph.successors, nodeId);
}

/**
 * Node ids in a topological order that is stable w.r.t. option order
 * (Kahn's algorithm picking the smallest option index first). Nodes on cycles
 * (and nodes only reachable through a cycle) are appended at the end in option order.
 */
export function topoOrder(graph: PipelineGraph): string[] {
  const indexOf = (id: string) => (graph.nodeById.get(id) as PipelineNode).index;
  const inDegree = new Map<string, number>();
  for (const n of graph.nodes) inDegree.set(n.id, (graph.predecessors.get(n.id) ?? []).length);

  // `ready` is kept sorted by index so the smallest index is always at the front.
  const ready = graph.nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const s of graph.successors.get(id) ?? []) {
      const d = (inDegree.get(s) as number) - 1;
      inDegree.set(s, d);
      if (d === 0) insertSorted(ready, s, indexOf);
    }
  }

  if (order.length < graph.nodes.length) {
    const placed = new Set(order);
    for (const n of graph.nodes) if (!placed.has(n.id)) order.push(n.id);
  }
  return order;
}

function reach(adjacency: Map<string, string[]>, nodeId: string): Set<string> {
  const result = new Set<string>();
  if (!adjacency.has(nodeId)) return result;
  const queue = [nodeId];
  const visited = new Set<string>([nodeId]);
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacency.get(queue[i]) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      result.add(next);
      queue.push(next);
    }
  }
  return result;
}

function insertSorted(list: string[], id: string, indexOf: (id: string) => number): void {
  const idx = indexOf(id);
  let i = list.length;
  while (i > 0 && indexOf(list[i - 1]) > idx) i--;
  list.splice(i, 0, id);
}

function isEdgeLike(value: unknown): value is Edge {
  if (!value || typeof value !== 'object') return false;
  const e = value as { from?: unknown; to?: unknown };
  return typeof e.from === 'string' && typeof e.to === 'string';
}

function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}
