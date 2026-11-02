import type { GraphLayout, PipelineGraph } from '../types';

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

/**
 * Layered left-to-right layout in the style of Meegle's node flow.
 *
 * 1. Layer (column) = longest path from any root (cycle-safe: back edges found by
 *    DFS in topoOrder are ignored for layering).
 * 2. Order inside a column: start with option order, then a few barycenter sweeps
 *    (forward + backward) to reduce crossings; ties keep option order. Deterministic.
 * 3. Column width = widest pill in that column (each pill width = clamp(measure(name)
 *    + chromeWidth, min, max)); all pills in a column share the column width.
 * 4. Each column is vertically centered against the tallest column.
 * 5. Edge path: cubic bezier from (src.x+src.width, src.midY) to (dst.x, dst.midY)
 *    with horizontal control points (dx = max(24, (dst.x - srcRight) / 2)). For a
 *    backward edge (dst column <= src column) route a loop below the nodes.
 * Returns empty layout (width/height = 2*margin) for an empty graph.
 */
export function layoutGraph(graph: PipelineGraph, opts?: LayoutOptions): GraphLayout {
  void graph;
  void opts;
  throw new Error('TODO: implement layoutGraph');
}

/** The default label width estimator used by layoutGraph. */
export function estimateTextWidth(text: string): number {
  void text;
  throw new Error('TODO: implement estimateTextWidth');
}
