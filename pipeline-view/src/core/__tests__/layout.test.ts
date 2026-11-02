import { describe, expect, it } from 'vitest';
import type { Edge, GraphLayout, LayoutNode, PipelineGraph, SelectOption } from '../../types';
import { buildGraph } from '../graph';
import { estimateTextWidth, layoutGraph } from '../layout';

const opts = (...ids: string[]): SelectOption[] => ids.map((id, i) => ({ id, name: `Node ${id}`, color: i }));
const e = (from: string, to: string): Edge => ({ from, to });
const chain = (...ids: string[]): Edge[] => ids.slice(1).map((id, i) => e(ids[i], id));

const MEEGLE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const MEEGLE_EDGES: Edge[] = [
  ...chain('A', 'B', 'C'),
  e('C', 'D'), e('C', 'E'), e('C', 'F'),
  e('D', 'G'), e('D', 'H'), e('E', 'H'), e('F', 'H'), e('F', 'I'),
  e('G', 'J'), e('H', 'J'), e('I', 'J'), e('J', 'K'),
];

const midY = (n: LayoutNode) => n.y + n.height / 2;
const node = (layout: GraphLayout, id: string) => layout.nodes.get(id) as LayoutNode;

/** Every number inside every edge path, as written. */
function pathNumbers(layout: GraphLayout): string[] {
  return layout.edges.flatMap((edge) => edge.path.match(/-?\d+(\.\d+)?/g) ?? []);
}

/** Shared structural invariants for any layout. */
function expectWellFormed(graph: PipelineGraph, layout: GraphLayout, margin = 16) {
  expect([...layout.nodes.keys()]).toEqual(graph.nodes.map((n) => n.id));
  for (const n of layout.nodes.values()) {
    expect(n.x).toBeGreaterThanOrEqual(margin);
    expect(n.y).toBeGreaterThanOrEqual(margin);
    // 1e-6 absorbs floating point noise of sums like 98.2 + 33.3.
    expect(n.x + n.width).toBeLessThanOrEqual(layout.width - margin + 1e-6);
    expect(n.y + n.height).toBeLessThanOrEqual(layout.height - margin + 1e-6);
  }
  // No two nodes overlap (same column => vertical separation, different column => horizontal).
  const all = [...layout.nodes.values()];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const overlapX = a.x < b.x + b.width && b.x < a.x + a.width;
      const overlapY = a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlapX && overlapY, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
  expect(layout.edges.map((x) => [x.from, x.to])).toEqual(graph.edges.map((x) => [x.from, x.to]));
  for (const num of pathNumbers(layout)) {
    expect(num).toMatch(/^-?\d+(\.\d)?$/); // at most one decimal
    expect(Number.isFinite(Number(num))).toBe(true);
  }
}

describe('layoutGraph', () => {
  it('returns an empty layout of 2*margin for an empty graph', () => {
    const layout = layoutGraph(buildGraph([], null));
    expect(layout.nodes.size).toBe(0);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(32);
    expect(layout.height).toBe(32);
    expect(layoutGraph(buildGraph([], null), { margin: 5 }).width).toBe(10);
  });

  it('lays a linear pipeline out on one row, one column per node', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'd'), null);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    const nodes = ['a', 'b', 'c', 'd'].map((id) => node(layout, id));
    expect(nodes.map((n) => n.layer)).toEqual([0, 1, 2, 3]);
    expect(new Set(nodes.map((n) => n.y)).size).toBe(1);
    expect(nodes[0].x).toBe(16);
    expect(nodes[0].y).toBe(16);
    expect(nodes[1].x).toBe(nodes[0].x + nodes[0].width + 72);
    expect(layout.height).toBe(16 + 40 + 16);
    expect(layout.width).toBe(nodes[3].x + nodes[3].width + 16);
  });

  it('draws forward edges as cubic beziers from the right middle to the left middle', () => {
    const g = buildGraph(opts('a', 'b'), null);
    const layout = layoutGraph(g, { measure: () => 50 });
    const a = node(layout, 'a');
    const b = node(layout, 'b');
    expect(a.width).toBe(132); // 50 + 52 chrome, clamped to the minimum
    const sx = a.x + a.width;
    const y = midY(a);
    const dx = Math.max(24, (b.x - sx) / 2);
    expect(layout.edges[0].path).toBe(`M${sx},${y} C${sx + dx},${y} ${b.x - dx},${y} ${b.x},${y}`);
  });

  it('places the Meegle DAG in longest-path columns with branches stacked and centered', () => {
    const g = buildGraph(opts(...MEEGLE_IDS), MEEGLE_EDGES);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);

    const layers = Object.fromEntries(MEEGLE_IDS.map((id) => [id, node(layout, id).layer]));
    expect(layers).toEqual({ A: 0, B: 1, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4, J: 5, K: 6 });

    // Columns strictly increase along every edge.
    for (const edge of g.edges) {
      expect(node(layout, edge.to).x).toBeGreaterThan(node(layout, edge.from).x + node(layout, edge.from).width);
    }
    // Branch columns keep a crossing-free top-to-bottom order.
    const top = (ids: string[]) => [...ids].sort((p, q) => node(layout, p).y - node(layout, q).y);
    expect(top(['D', 'E', 'F'])).toEqual(['D', 'E', 'F']);
    expect(top(['G', 'H', 'I'])).toEqual(['G', 'H', 'I']);
    // Single-node columns are centered on the 3-node columns.
    expect(midY(node(layout, 'C'))).toBe(midY(node(layout, 'E')));
    expect(midY(node(layout, 'J'))).toBe(midY(node(layout, 'H')));
    // Nodes of one column share x and width, and keep the vertical gap.
    const [d, eNode, f] = ['D', 'E', 'F'].map((id) => node(layout, id));
    expect(new Set([d.x, eNode.x, f.x]).size).toBe(1);
    expect(new Set([d.width, eNode.width, f.width]).size).toBe(1);
    expect(eNode.y - d.y).toBe(40 + 28);
    expect(layout.height).toBe(16 + 3 * 40 + 2 * 28 + 16);
  });

  it('is deterministic and independent of the edge input order', () => {
    const first = layoutGraph(buildGraph(opts(...MEEGLE_IDS), MEEGLE_EDGES));
    const again = layoutGraph(buildGraph(opts(...MEEGLE_IDS), MEEGLE_EDGES));
    const shuffled = layoutGraph(buildGraph(opts(...MEEGLE_IDS), [...MEEGLE_EDGES].reverse()));
    expect(again).toEqual(first);
    expect(shuffled).toEqual(first);
  });

  it('reorders a column to remove an avoidable crossing', () => {
    // a -> d and b -> c cross when the second column keeps option order (c above d);
    // b -> d keeps everything in one component.
    const g = buildGraph(opts('a', 'b', 'c', 'd'), [e('a', 'd'), e('b', 'c'), e('b', 'd')]);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    expect(node(layout, 'a').y).toBeLessThan(node(layout, 'b').y);
    expect(node(layout, 'd').y).toBeLessThan(node(layout, 'c').y);
  });

  it('keeps option order when sweeps cannot improve anything', () => {
    const g = buildGraph(opts('A', 'B', 'C', 'D'), [e('A', 'B'), e('A', 'C'), e('B', 'D'), e('C', 'D')]);
    const layout = layoutGraph(g);
    expect(node(layout, 'B').y).toBeLessThan(node(layout, 'C').y);
    expect(midY(node(layout, 'A'))).toBe(midY(node(layout, 'D')));
  });

  it('sizes pills from the label, clamped, and shares the widest width within a column', () => {
    const g = buildGraph(
      [
        { id: 'r', name: 'R', color: 0 },
        { id: 'short', name: 'x', color: 0 },
        { id: 'long', name: 'y'.repeat(80), color: 0 },
        { id: 'mid', name: 'z'.repeat(15), color: 0 },
      ],
      [e('r', 'short'), e('r', 'long'), e('long', 'mid')],
    );
    const measure = (text: string) => text.length * 10;
    const layout = layoutGraph(g, { measure });
    expect(node(layout, 'r').width).toBe(132); // 10 + 52 -> min
    expect(node(layout, 'long').width).toBe(220); // 852 -> max
    expect(node(layout, 'short').width).toBe(220); // shares the column width
    expect(node(layout, 'mid').width).toBe(150 + 52);
    expectWellFormed(g, layout);
  });

  it('honours custom spacing options', () => {
    const g = buildGraph(opts('a', 'b', 'c'), [e('a', 'b'), e('a', 'c')]);
    const layout = layoutGraph(g, { nodeHeight: 30, gapX: 40, gapY: 10, minNodeWidth: 100, maxNodeWidth: 100, margin: 8 });
    expectWellFormed(g, layout, 8);
    expect(node(layout, 'a')).toEqual({ id: 'a', x: 8, y: 8 + 20, width: 100, height: 30, layer: 0 });
    expect(node(layout, 'b')).toEqual({ id: 'b', x: 148, y: 8, width: 100, height: 30, layer: 1 });
    expect(node(layout, 'c').y).toBe(48);
    expect(layout.width).toBe(8 + 100 + 40 + 100 + 8);
    expect(layout.height).toBe(8 + 70 + 8);
  });

  it('falls back to defaults for invalid options and a broken measure function', () => {
    const g = buildGraph(opts('a', 'b'), null);
    const layout = layoutGraph(g, { nodeHeight: NaN, gapX: -5, measure: () => NaN });
    expect(node(layout, 'a').height).toBe(40);
    expect(node(layout, 'a').width).toBe(132);
    expect(node(layout, 'b').x).toBe(16 + 132 + 72);
  });

  it('stacks disconnected components, each starting at column 0', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'x', 'y', 'solo'), [...chain('a', 'b', 'c'), e('x', 'y')]);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    expect(node(layout, 'a').layer).toBe(0);
    expect(node(layout, 'x').layer).toBe(0);
    expect(node(layout, 'solo').layer).toBe(0);
    expect(node(layout, 'x').x).toBe(node(layout, 'a').x);
    // Components are ordered by their first option and do not share rows.
    expect(node(layout, 'x').y).toBeGreaterThanOrEqual(node(layout, 'a').y + 40 + 28);
    expect(node(layout, 'solo').y).toBeGreaterThanOrEqual(node(layout, 'x').y + 40 + 28);
    expect(layout.height).toBe(16 + 3 * 40 + 2 * 28 + 16);
  });

  it('lays out a pipeline without edges as a vertical list of nodes', () => {
    const g = buildGraph(opts('a', 'b', 'c'), []);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    expect(['a', 'b', 'c'].map((id) => node(layout, id).x)).toEqual([16, 16, 16]);
    expect(['a', 'b', 'c'].map((id) => node(layout, id).y)).toEqual([16, 84, 152]);
  });

  it('survives cycles: back edges are ignored for layering and loop below the nodes', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'd'), [...chain('a', 'b', 'c', 'd'), e('c', 'b')]);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    expect(['a', 'b', 'c', 'd'].map((id) => node(layout, id).layer)).toEqual([0, 1, 2, 3]);
    const back = layout.edges.find((x) => x.from === 'c' && x.to === 'b');
    expect(back?.path).toContain(' L');
    const bottom = Math.max(...[...layout.nodes.values()].map((n) => n.y + n.height));
    const ys = (back?.path.match(/-?\d+(\.\d+)?,(-?\d+(\.\d+)?)/g) ?? []).map((p) => Number(p.split(',')[1]));
    expect(Math.max(...ys)).toBeGreaterThan(bottom);
    expect(Math.max(...ys)).toBeLessThanOrEqual(layout.height);
    // Forward edges stay simple beziers.
    expect(layout.edges.find((x) => x.from === 'a')?.path).not.toContain(' L');
  });

  it('handles a cycle without any root', () => {
    const g = buildGraph(opts('a', 'b', 'c'), [e('a', 'b'), e('b', 'c'), e('c', 'a')]);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    expect(['a', 'b', 'c'].map((id) => node(layout, id).layer)).toEqual([0, 1, 2]);
  });

  it('gives several back edges separate loop lanes', () => {
    const g = buildGraph(opts('a', 'b', 'c'), [...chain('a', 'b', 'c'), e('c', 'a'), e('b', 'a')]);
    const layout = layoutGraph(g);
    expectWellFormed(g, layout);
    const lane = (from: string) => {
      const path = layout.edges.find((x) => x.from === from && x.to === 'a')?.path ?? '';
      return Number((/ L-?[\d.]+,(-?[\d.]+)/.exec(path) as RegExpExecArray)[1]);
    };
    expect(lane('b')).not.toBe(lane('c'));
  });

  it('rounds every coordinate to at most one decimal', () => {
    const g = buildGraph(opts('a', 'b', 'c', 'd', 'e'), [e('a', 'b'), e('a', 'c'), e('a', 'd'), e('b', 'e'), e('c', 'e'), e('d', 'e')]);
    const layout = layoutGraph(g, { nodeHeight: 33.33, gapY: 7.77, gapX: 50.55, measure: (t) => t.length * 7.33 });
    expectWellFormed(g, layout);
    for (const n of layout.nodes.values()) {
      for (const v of [n.x, n.y, n.width, n.height]) expect(Math.round(v * 10) / 10).toBe(v);
    }
    expect(Math.round(layout.width * 10) / 10).toBe(layout.width);
    expect(Math.round(layout.height * 10) / 10).toBe(layout.height);
  });
});

describe('estimateTextWidth', () => {
  it('counts ~7.6px per latin char and ~14px per wide glyph', () => {
    expect(estimateTextWidth('')).toBe(0);
    expect(estimateTextWidth('abc')).toBe(22.8);
    expect(estimateTextWidth('阶段')).toBe(28);
    expect(estimateTextWidth('🚀')).toBe(14);
    expect(estimateTextWidth('QA 测试')).toBe(Math.round((3 * 7.6 + 2 * 14) * 10) / 10);
  });

  it('ignores combining marks so decomposed and composed Vietnamese measure alike', () => {
    expect(estimateTextWidth('Thiết kế'.normalize('NFD'))).toBe(estimateTextWidth('Thiết kế'.normalize('NFC')));
  });

  it('is monotonic in the label length', () => {
    expect(estimateTextWidth('Detail Review')).toBeGreaterThan(estimateTextWidth('Review'));
  });
});
