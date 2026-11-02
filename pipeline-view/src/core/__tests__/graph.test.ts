import { describe, expect, it } from 'vitest';
import type { Edge, SelectOption } from '../../types';
import { ancestors, buildGraph, defaultLinearEdges, descendants, findCycle, topoOrder } from '../graph';

const opts = (...ids: string[]): SelectOption[] => ids.map((id, i) => ({ id, name: `Node ${id}`, color: i }));
const e = (from: string, to: string): Edge => ({ from, to });
const chain = (...ids: string[]): Edge[] => ids.slice(1).map((id, i) => e(ids[i], id));

/** Meegle-like DAG: A->B->C->{D,E,F}, D->G, D->H, E->H, F->H, F->I, G,H,I->J->K. */
const MEEGLE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const MEEGLE_EDGES: Edge[] = [
  ...chain('A', 'B', 'C'),
  e('C', 'D'), e('C', 'E'), e('C', 'F'),
  e('D', 'G'), e('D', 'H'), e('E', 'H'), e('F', 'H'), e('F', 'I'),
  e('G', 'J'), e('H', 'J'), e('I', 'J'), e('J', 'K'),
];
const DIAMOND_EDGES = [e('A', 'B'), e('A', 'C'), e('B', 'D'), e('C', 'D')];

/** True when `cycle` is a closed walk over `edges`. */
function isRealCycle(cycle: string[], edges: Edge[]): boolean {
  return cycle.every((from, i) => edges.some((x) => x.from === from && x.to === cycle[(i + 1) % cycle.length]));
}

describe('defaultLinearEdges', () => {
  it('chains options in option order', () => {
    expect(defaultLinearEdges(opts('a', 'b', 'c'))).toEqual([e('a', 'b'), e('b', 'c')]);
  });

  it('returns no edges for zero or one option', () => {
    expect(defaultLinearEdges([])).toEqual([]);
    expect(defaultLinearEdges(opts('a'))).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('builds a linear pipeline when edges is null', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'd'), null);
    expect(g.nodes.map((n) => [n.id, n.index])).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3]]);
    expect(g.nodes[1]).toEqual({ id: 'b', name: 'Node b', color: 1, index: 1 });
    expect(g.nodeById.get('c')?.index).toBe(2);
    expect(g.edges).toEqual(chain('a', 'b', 'c', 'd'));
    expect(g.successors.get('b')).toEqual(['c']);
    expect(g.predecessors.get('b')).toEqual(['a']);
    expect(g.roots).toEqual(['a']);
    expect(g.terminals).toEqual(['d']);
  });

  it('handles an empty option list', () => {
    const g = buildGraph([], null);
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
    expect(g.roots).toEqual([]);
    expect(g.terminals).toEqual([]);
  });

  it('treats an empty edge array as "no edges": every node is isolated', () => {
    const g = buildGraph(opts('a', 'b', 'c'), []);
    expect(g.edges).toEqual([]);
    expect(g.roots).toEqual(['a', 'b', 'c']);
    expect(g.terminals).toEqual(['a', 'b', 'c']);
    expect(g.successors.get('a')).toEqual([]);
    expect(g.predecessors.get('c')).toEqual([]);
  });

  it('marks an isolated node as both root and terminal', () => {
    const g = buildGraph(opts('a', 'b', 'x', 'c'), chain('a', 'b', 'c'));
    expect(g.roots).toEqual(['a', 'x']);
    expect(g.terminals).toEqual(['x', 'c']);
  });

  it('drops edges to deleted options, self loops, duplicates and malformed entries', () => {
    const messy = [
      e('a', 'b'),
      e('a', 'b'),
      e('b', 'b'),
      e('b', 'gone'),
      e('gone', 'c'),
      { from: 'b' } as unknown as Edge,
      null as unknown as Edge,
      { from: 1, to: 2 } as unknown as Edge,
      e('b', 'c'),
    ];
    const g = buildGraph(opts('a', 'b', 'c'), messy);
    expect(g.edges).toEqual([e('a', 'b'), e('b', 'c')]);
  });

  it('sorts edges and adjacency lists by option index, whatever the input order', () => {
    const shuffled = [...MEEGLE_EDGES].reverse();
    const g = buildGraph(opts(...MEEGLE_IDS), shuffled);
    expect(g.edges).toEqual(buildGraph(opts(...MEEGLE_IDS), MEEGLE_EDGES).edges);
    expect(g.successors.get('C')).toEqual(['D', 'E', 'F']);
    expect(g.successors.get('F')).toEqual(['H', 'I']);
    expect(g.predecessors.get('H')).toEqual(['D', 'E', 'F']);
    expect(g.predecessors.get('J')).toEqual(['G', 'H', 'I']);
    expect(g.roots).toEqual(['A']);
    expect(g.terminals).toEqual(['K']);
  });

  it('orders successors by node index, not by edge order', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'd'), [e('a', 'd'), e('a', 'b'), e('a', 'c')]);
    expect(g.successors.get('a')).toEqual(['b', 'c', 'd']);
  });

  it('keeps the first option when ids are duplicated', () => {
    const g = buildGraph([{ id: 'a', name: 'First', color: 1 }, { id: 'a', name: 'Dup', color: 2 }, { id: 'b', name: 'B', color: 3 }], null);
    expect(g.nodes.map((n) => n.name)).toEqual(['First', 'B']);
    expect(g.nodeById.get('b')?.index).toBe(1);
    expect(g.edges).toEqual([e('a', 'b')]);
  });

  it('accepts cycles without throwing', () => {
    const g = buildGraph(opts('a', 'b', 'c'), [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
    expect(g.edges).toHaveLength(3);
    expect(g.roots).toEqual([]);
    expect(g.terminals).toEqual([]);
  });
});

describe('findCycle', () => {
  it('returns null for acyclic graphs', () => {
    expect(findCycle(MEEGLE_IDS, MEEGLE_EDGES)).toBeNull();
    expect(findCycle(['A', 'B', 'C', 'D'], DIAMOND_EDGES)).toBeNull();
    expect(findCycle([], [])).toBeNull();
  });

  it('returns the nodes of one cycle, without repeating the first id', () => {
    const edges = [e('a', 'b'), e('b', 'c'), e('c', 'd'), e('d', 'b')];
    const cycle = findCycle(['a', 'b', 'c', 'd'], edges);
    expect(cycle).toEqual(['b', 'c', 'd']);
    expect(isRealCycle(cycle as string[], edges)).toBe(true);
  });

  it('finds a cycle that closes back into the Meegle DAG', () => {
    const edges = [...MEEGLE_EDGES, e('K', 'C')];
    const cycle = findCycle(MEEGLE_IDS, edges) as string[];
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('C');
    expect(cycle).toContain('K');
    expect(new Set(cycle).size).toBe(cycle.length);
    expect(isRealCycle(cycle, edges)).toBe(true);
  });

  it('reports a self loop as a one-node cycle', () => {
    expect(findCycle(['a', 'b'], [e('a', 'b'), e('b', 'b')])).toEqual(['b']);
  });

  it('ignores edges with unknown ids', () => {
    expect(findCycle(['a', 'b'], [e('a', 'b'), e('b', 'x'), e('x', 'a')])).toBeNull();
  });

  it('is deterministic', () => {
    const edges = [e('a', 'b'), e('b', 'a'), e('c', 'd'), e('d', 'c')];
    expect(findCycle(['a', 'b', 'c', 'd'], edges)).toEqual(['a', 'b']);
    expect(findCycle(['c', 'd', 'a', 'b'], edges)).toEqual(['c', 'd']);
  });
});

describe('ancestors / descendants', () => {
  const g = buildGraph(opts(...MEEGLE_IDS), MEEGLE_EDGES);

  it('collects every node that reaches / is reachable from a node', () => {
    expect([...ancestors(g, 'H')].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect([...descendants(g, 'D')].sort()).toEqual(['G', 'H', 'J', 'K']);
    expect([...descendants(g, 'C')].sort()).toEqual(['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']);
    expect([...ancestors(g, 'K')].sort()).toEqual(MEEGLE_IDS.filter((id) => id !== 'K'));
  });

  it('returns empty sets for roots, terminals and unknown ids', () => {
    expect(ancestors(g, 'A').size).toBe(0);
    expect(descendants(g, 'K').size).toBe(0);
    expect(ancestors(g, 'nope').size).toBe(0);
    expect(descendants(g, 'nope').size).toBe(0);
  });

  it('terminates on cycles and never includes the node itself', () => {
    const cyc = buildGraph(opts('a', 'b', 'c', 'd'), [e('a', 'b'), e('b', 'c'), e('c', 'b'), e('c', 'd')]);
    expect([...ancestors(cyc, 'b')].sort()).toEqual(['a', 'c']);
    expect([...descendants(cyc, 'b')].sort()).toEqual(['c', 'd']);
    expect(ancestors(cyc, 'c').has('c')).toBe(false);
  });
});

describe('topoOrder', () => {
  it('follows option order for a linear pipeline', () => {
    expect(topoOrder(buildGraph(opts('a', 'b', 'c'), null))).toEqual(['a', 'b', 'c']);
  });

  it('orders the Meegle DAG with the smallest index first', () => {
    expect(topoOrder(buildGraph(opts(...MEEGLE_IDS), MEEGLE_EDGES))).toEqual(MEEGLE_IDS);
  });

  it('orders a diamond', () => {
    expect(topoOrder(buildGraph(opts('A', 'B', 'C', 'D'), DIAMOND_EDGES))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('respects edges that go against option order', () => {
    expect(topoOrder(buildGraph(opts('x', 'y', 'z'), [e('z', 'x')]))).toEqual(['y', 'z', 'x']);
  });

  it('lists every node exactly once, isolated ones included', () => {
    const order = topoOrder(buildGraph(opts('a', 'b', 'iso', 'c'), chain('a', 'b', 'c')));
    expect(order).toEqual(['a', 'b', 'iso', 'c']);
  });

  it('appends nodes on (or behind) a cycle in option order', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'd'), [e('a', 'b'), e('b', 'c'), e('c', 'b'), e('c', 'd')]);
    expect(topoOrder(g)).toEqual(['a', 'b', 'c', 'd']);
    const g2 = buildGraph(opts('p', 'q', 'r'), [e('q', 'r'), e('r', 'q')]);
    expect(topoOrder(g2)).toEqual(['p', 'q', 'r']);
  });
});
