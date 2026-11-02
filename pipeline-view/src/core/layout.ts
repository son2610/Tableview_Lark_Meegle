import type { Edge, GraphLayout, LayoutEdge, LayoutNode, PipelineGraph } from '../types';
import { buildGraph, topoOrder } from './graph';

export interface LayoutOptions {
  /** Pill height in px. Default 40. */
  nodeHeight?: number;
  /** Horizontal gap between columns in px. Default 72. */
  gapX?: number;
  /** Vertical gap between nodes in a column in px. Default 28. */
  gapY?: number;
  /** Min / max pill width in px. Defaults 132 / 220. */
  minNodeWidth?: number;
  maxNodeWidth?: number;
  /**
   * Text width estimator in px for a node label. Default: a deterministic
   * estimate (~7.6px per char, wide glyphs CJK/emoji ~14px) – no DOM access, so
   * layout stays pure and testable.
   */
  measure?: (text: string) => number;
  /** Extra horizontal space inside a pill (dot + paddings), px. Default 52. */
  chromeWidth?: number;
  /** Outer margin around the drawing, px. Default 16. */
  margin?: number;
}

type ResolvedOptions = Required<LayoutOptions>;

const DEFAULTS: Omit<ResolvedOptions, 'measure'> = {
  nodeHeight: 40,
  gapX: 72,
  gapY: 28,
  minNodeWidth: 132,
  maxNodeWidth: 220,
  chromeWidth: 52,
  margin: 16,
};

/** Barycenter iterations (each = one forward + one backward sweep). */
const SWEEPS = 4;
/** Vertical distance between stacked loop lanes of backward edges, px. */
const LOOP_LANE = 10;
/** Horizontal bulge of a backward-edge loop beyond the node, px (stays inside the default margin). */
const LOOP_BULGE = 16;

/**
 * Layered left-to-right layout in the style of Meegle's node flow.
 *
 * 1. Layer (column) = longest path from any root (cycle-safe: back edges found by
 *    DFS in topoOrder are ignored for layering).
 * 2. Order inside a column: start with option order, then a few barycenter sweeps
 *    (forward + backward) to reduce crossings; ties keep option order. Deterministic.
 *    The ordering with the fewest crossings seen (initial one included) is kept.
 * 3. Column width = widest pill in that column (each pill width = clamp(measure(name)
 *    + chromeWidth, min, max)); all pills in a column share the column width.
 * 4. Each column is vertically centered against the tallest column.
 * 5. Edge path: cubic bezier from (src.x+src.width, src.midY) to (dst.x, dst.midY)
 *    with horizontal control points (dx = max(24, (dst.x - srcRight) / 2)). For a
 *    backward edge (dst column <= src column) route a loop below the nodes.
 * Disconnected components (weakly connected) are laid out one below the other in order
 * of their first option, each starting at column 0; column x positions and widths are
 * shared by all components so the drawing stays aligned. Steps 2 and 4 apply per component.
 * Coordinates and path numbers are rounded to at most 1 decimal.
 * Returns empty layout (width/height = 2*margin) for an empty graph.
 */
export function layoutGraph(graph: PipelineGraph, opts?: LayoutOptions): GraphLayout {
  const o = resolveOptions(opts);
  if (graph.nodes.length === 0) {
    return { nodes: new Map(), edges: [], width: 2 * o.margin, height: 2 * o.margin };
  }

  const indexOf = (id: string) => graph.nodeById.get(id)?.index ?? 0;
  const backEdges = findBackEdges(graph);
  const forwardEdges = graph.edges.filter((e) => !backEdges.has(edgeKey(e)));
  // The graph without back edges is acyclic: reuse buildGraph/topoOrder on it.
  const dag = buildGraph(graph.nodes, forwardEdges);
  const layer = assignLayers(dag);

  const columnCount = Math.max(...graph.nodes.map((n) => layer.get(n.id) as number)) + 1;
  const pillWidth = new Map(graph.nodes.map((n) => [n.id, measurePill(n.name, o)]));
  const columnWidth = new Array<number>(columnCount).fill(0);
  for (const n of graph.nodes) {
    const c = layer.get(n.id) as number;
    columnWidth[c] = Math.max(columnWidth[c], pillWidth.get(n.id) as number);
  }
  const columnX: number[] = [];
  let x = o.margin;
  for (let c = 0; c < columnCount; c++) {
    columnX.push(x);
    x += columnWidth[c] + o.gapX;
  }
  const width = x - o.gapX + o.margin;

  const nodes = new Map<string, LayoutNode>();
  const loopLane = new Map<string, number>();
  const rowStep = o.nodeHeight + o.gapY;
  let top = o.margin;
  const components = findComponents(graph);
  components.forEach((component, ci) => {
    const columns = orderColumns(component, layer, dag, indexOf);
    const tallest = Math.max(...columns.map((col) => col.length));
    const blockHeight = tallest * o.nodeHeight + (tallest - 1) * o.gapY;
    columns.forEach((col, c) => {
      const offset = ((tallest - col.length) * rowStep) / 2;
      col.forEach((id, i) => {
        nodes.set(id, {
          id,
          x: round1(columnX[c]),
          y: round1(top + offset + i * rowStep),
          width: columnWidth[c],
          height: o.nodeHeight,
          layer: c,
        });
      });
    });

    // Backward edges of this component get stacked lanes below its nodes.
    const members = new Set(component);
    let lanes = 0;
    for (const e of graph.edges) {
      if (!members.has(e.from)) continue;
      if ((layer.get(e.to) as number) <= (layer.get(e.from) as number)) {
        lanes++;
        loopLane.set(edgeKey(e), top + blockHeight + lanes * LOOP_LANE);
      }
    }
    top += blockHeight + (lanes > 0 ? (lanes + 1) * LOOP_LANE : 0);
    if (ci < components.length - 1) top += o.gapY;
  });
  let bottom = top;
  for (const n of nodes.values()) bottom = Math.max(bottom, n.y + n.height);
  const height = bottom + o.margin;

  // Re-insert in option order so consumers iterating the map get a stable order.
  const orderedNodes = new Map<string, LayoutNode>();
  for (const n of graph.nodes) orderedNodes.set(n.id, nodes.get(n.id) as LayoutNode);

  const edges: LayoutEdge[] = graph.edges.map((e) => {
    const src = orderedNodes.get(e.from) as LayoutNode;
    const dst = orderedNodes.get(e.to) as LayoutNode;
    const lane = loopLane.get(edgeKey(e));
    return { from: e.from, to: e.to, path: lane === undefined ? forwardPath(src, dst) : loopPath(src, dst, lane) };
  });

  return { nodes: orderedNodes, edges, width: round1(width), height: round1(height) };
}

/** The default label width estimator used by layoutGraph. */
export function estimateTextWidth(text: string): number {
  let total = 0;
  for (const ch of String(text ?? '')) {
    total += glyphWidth(ch.codePointAt(0) as number);
  }
  return round1(total);
}

/* ------------------------------------------------------------------ */

function resolveOptions(opts: LayoutOptions | undefined): ResolvedOptions {
  // Sizes are rounded to 0.1px so every derived coordinate stays on the same grid.
  const pick = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? round1(value) : fallback;
  const minNodeWidth = pick(opts?.minNodeWidth, DEFAULTS.minNodeWidth);
  return {
    nodeHeight: pick(opts?.nodeHeight, DEFAULTS.nodeHeight),
    gapX: pick(opts?.gapX, DEFAULTS.gapX),
    gapY: pick(opts?.gapY, DEFAULTS.gapY),
    minNodeWidth,
    maxNodeWidth: Math.max(minNodeWidth, pick(opts?.maxNodeWidth, DEFAULTS.maxNodeWidth)),
    chromeWidth: pick(opts?.chromeWidth, DEFAULTS.chromeWidth),
    margin: pick(opts?.margin, DEFAULTS.margin),
    measure: typeof opts?.measure === 'function' ? opts.measure : estimateTextWidth,
  };
}

function measurePill(name: string, o: ResolvedOptions): number {
  const text = o.measure(name);
  const raw = Number.isFinite(text) ? Math.ceil(text + o.chromeWidth) : o.minNodeWidth;
  return Math.min(o.maxNodeWidth, Math.max(o.minNodeWidth, raw));
}

/** Edges closing a cycle, found by DFS started from nodes in topoOrder (successors in index order). */
function findBackEdges(graph: PipelineGraph): Set<string> {
  const back = new Set<string>();
  const done = new Set<string>();
  for (const start of topoOrder(graph)) {
    if (done.has(start)) continue;
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    const onStack = new Set<string>([start]);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const succ = graph.successors.get(top.id) ?? [];
      if (top.next < succ.length) {
        const v = succ[top.next++];
        if (onStack.has(v)) back.add(edgeKey({ from: top.id, to: v }));
        else if (!done.has(v)) {
          onStack.add(v);
          stack.push({ id: v, next: 0 });
        }
      } else {
        stack.pop();
        onStack.delete(top.id);
        done.add(top.id);
      }
    }
  }
  return back;
}

/** Longest path from a root over an acyclic graph. */
function assignLayers(dag: PipelineGraph): Map<string, number> {
  const layer = new Map<string, number>();
  for (const id of topoOrder(dag)) {
    let l = 0;
    for (const p of dag.predecessors.get(id) ?? []) l = Math.max(l, (layer.get(p) ?? 0) + 1);
    layer.set(id, l);
  }
  return layer;
}

/** Weakly connected components, each sorted by index, ordered by their first index. */
function findComponents(graph: PipelineGraph): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const n of graph.nodes) {
    if (seen.has(n.id)) continue;
    const members = [n.id];
    seen.add(n.id);
    for (let i = 0; i < members.length; i++) {
      const id = members[i];
      for (const next of [...(graph.successors.get(id) ?? []), ...(graph.predecessors.get(id) ?? [])]) {
        if (seen.has(next)) continue;
        seen.add(next);
        members.push(next);
      }
    }
    members.sort((a, b) => (graph.nodeById.get(a)?.index ?? 0) - (graph.nodeById.get(b)?.index ?? 0));
    components.push(members);
  }
  return components;
}

/**
 * Column contents (top to bottom) for one component. Positions are compared on a
 * centered scale (rank - (columnSize - 1) / 2) because columns are centered vertically.
 */
function orderColumns(
  component: string[],
  layer: Map<string, number>,
  dag: PipelineGraph,
  indexOf: (id: string) => number,
): string[][] {
  const depth = Math.max(...component.map((id) => layer.get(id) as number)) + 1;
  const columns: string[][] = Array.from({ length: depth }, () => []);
  for (const id of component) columns[layer.get(id) as number].push(id); // already index-sorted

  const pos = new Map<string, number>();
  const refresh = (col: string[]) => col.forEach((id, i) => pos.set(id, i - (col.length - 1) / 2));
  columns.forEach(refresh);

  const reorder = (col: string[], neighbours: Map<string, string[]>) => {
    const bary = new Map<string, number>();
    for (const id of col) {
      const ns = neighbours.get(id) ?? [];
      bary.set(id, ns.length === 0 ? (pos.get(id) as number) : mean(ns.map((n) => pos.get(n) as number)));
    }
    col.sort((a, b) => (bary.get(a) as number) - (bary.get(b) as number) || indexOf(a) - indexOf(b));
    refresh(col);
  };

  const edges = dag.edges.filter((e) => pos.has(e.from));
  let best = columns.map((col) => col.slice());
  let bestCrossings = countCrossings(edges, layer, pos);
  for (let sweep = 0; sweep < SWEEPS && bestCrossings > 0; sweep++) {
    for (let c = 1; c < depth; c++) reorder(columns[c], dag.predecessors);
    for (let c = depth - 2; c >= 0; c--) reorder(columns[c], dag.successors);
    const crossings = countCrossings(edges, layer, pos);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      best = columns.map((col) => col.slice());
    }
  }
  return best;
}

/** Crossings between edges that span the same pair of columns (a cheap, deterministic proxy). */
function countCrossings(edges: Edge[], layer: Map<string, number>, pos: Map<string, number>): number {
  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      if (layer.get(a.from) !== layer.get(b.from) || layer.get(a.to) !== layer.get(b.to)) continue;
      const ds = (pos.get(a.from) as number) - (pos.get(b.from) as number);
      const dt = (pos.get(a.to) as number) - (pos.get(b.to) as number);
      if (ds * dt < 0) count++;
    }
  }
  return count;
}

function forwardPath(src: LayoutNode, dst: LayoutNode): string {
  const sx = src.x + src.width;
  const sy = src.y + src.height / 2;
  const tx = dst.x;
  const ty = dst.y + dst.height / 2;
  const dx = Math.max(24, (tx - sx) / 2);
  return `M${pt(sx, sy)} C${pt(sx + dx, sy)} ${pt(tx - dx, ty)} ${pt(tx, ty)}`;
}

/** Out of the source's right side, down to `laneY`, left along the lane, up into the target's left side. */
function loopPath(src: LayoutNode, dst: LayoutNode, laneY: number): string {
  const sx = src.x + src.width;
  const sy = src.y + src.height / 2;
  const tx = dst.x;
  const ty = dst.y + dst.height / 2;
  const c = (LOOP_BULGE * 4) / 3; // a cubic with both handles at +c bulges by 3c/4
  return (
    `M${pt(sx, sy)} C${pt(sx + c, sy)} ${pt(sx + c, laneY)} ${pt(sx, laneY)}` +
    ` L${pt(tx, laneY)} C${pt(tx - c, laneY)} ${pt(tx - c, ty)} ${pt(tx, ty)}`
  );
}

function glyphWidth(cp: number): number {
  if ((cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f)) {
    return 0; // combining marks, zero-width chars, variation selectors
  }
  const wide =
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK radicals .. Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) || // full-width forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x2600 && cp <= 0x27bf) || // misc symbols & dingbats (emoji-like)
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji
    cp >= 0x20000; // CJK extensions
  return wide ? 14 : 7.6;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function edgeKey(e: Edge): string {
  return `${e.from}\u0000${e.to}`;
}

function round1(n: number): number {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r; // normalise -0
}

function pt(x: number, y: number): string {
  return `${round1(x)},${round1(y)}`;
}
