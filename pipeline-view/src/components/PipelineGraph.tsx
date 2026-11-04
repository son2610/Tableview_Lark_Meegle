import { useEffect, useMemo, useRef } from 'react';
import { IconFlag } from '@douyinfe/semi-icons';
import type {
  GraphLayout,
  LayoutNode,
  NodeState,
  OptionColor,
  PipelineGraph as GraphModel,
  PipelineNode,
  StatusCategory,
} from '../types';
import { useI18n } from '../i18n';
import { OptionDot } from './OptionTag';
import './PipelineGraph.css';

export interface PipelineGraphProps {
  graph: GraphModel;
  layout: GraphLayout;
  mode: 'record' | 'overview' | 'preview';
  /** record mode */
  states?: Map<string, NodeState>;
  /** record mode: active dot colour */
  currentCategory?: StatusCategory | null;
  /** overview mode: count badge per node */
  counts?: Map<string, number>;
  /** optional small text per node, e.g. "1/3" */
  badges?: Map<string, string>;
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
  optionColors?: OptionColor[];
}

type PortTone = 'default' | 'strong' | 'active';

interface Port {
  key: string;
  x: number;
  y: number;
  tone: PortTone;
}

const PORT_RADIUS = 3.5;
const TONE_RANK: Record<PortTone, number> = { default: 0, strong: 1, active: 2 };

function isReached(state: NodeState | undefined): boolean {
  return state === 'done' || state === 'active';
}

function midY(n: LayoutNode): number {
  return n.y + n.height / 2;
}

/**
 * Meegle-style node flow: curved SVG connectors under absolutely positioned pill buttons,
 * with port dots drawn on top of the pills' borders. Purely presentational.
 */
export function PipelineGraph(props: PipelineGraphProps): JSX.Element {
  const { graph, layout, mode, states, currentCategory, counts, badges, selectedNodeId, onNodeClick } = props;
  const optionColors = props.optionColors ?? [];
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRecord = mode === 'record';

  const stateOf = (id: string): NodeState | undefined => (isRecord ? states?.get(id) : undefined);

  const activeId = useMemo(() => {
    if (!isRecord || !states) return undefined;
    for (const [id, s] of states) if (s === 'active') return id;
    return undefined;
  }, [isRecord, states]);

  const { edges, ports } = useMemo(() => {
    const portMap = new Map<string, Port>();
    const addPort = (key: string, x: number, y: number, tone: PortTone) => {
      const prev = portMap.get(key);
      if (!prev || TONE_RANK[tone] > TONE_RANK[prev.tone]) portMap.set(key, { key, x, y, tone });
    };
    const drawn = layout.edges.map((edge) => {
      const strong = isRecord && isReached(states?.get(edge.from)) && isReached(states?.get(edge.to));
      const src = layout.nodes.get(edge.from);
      const dst = layout.nodes.get(edge.to);
      if (src) {
        const tone: PortTone = edge.from === activeId ? 'active' : strong ? 'strong' : 'default';
        addPort(`${edge.from}:out`, src.x + src.width, midY(src), tone);
      }
      if (dst) {
        const tone: PortTone = edge.to === activeId ? 'active' : strong ? 'strong' : 'default';
        addPort(`${edge.to}:in`, dst.x, midY(dst), tone);
      }
      return { key: `${edge.from}->${edge.to}`, path: edge.path, strong };
    });
    // Strong edges last so they paint over the grey ones where curves overlap.
    drawn.sort((a, b) => Number(a.strong) - Number(b.strong));
    return { edges: drawn, ports: [...portMap.values()] };
  }, [layout, isRecord, states, activeId]);

  // Keep the node of interest in view when the pipeline is wider than the container.
  const focusId = selectedNodeId ?? activeId;
  useEffect(() => {
    const el = scrollRef.current;
    const target = focusId ? layout.nodes.get(focusId) : undefined;
    if (!el || !target || el.scrollWidth <= el.clientWidth) return;
    const left = target.x;
    const right = target.x + target.width;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, left - el.clientWidth / 3);
    }
  }, [focusId, layout]);

  const terminals = useMemo(() => new Set(graph.terminals), [graph]);

  const describe = (node: PipelineNode, state: NodeState | undefined, count: number | undefined): string => {
    if (isRecord && state) {
      const badge = badges?.get(node.id);
      const label =
        state === 'unknown'
          ? t('detail.graph.unknownState')
          : state === 'skipped'
            ? t('detail.graph.skippedState')
            : t(`detail.state.${state}`);
      return `${node.name} – ${label}${badge ? ` (${badge})` : ''}`;
    }
    if (mode === 'overview') return `${node.name} – ${t('detail.graph.countAria', { count: count ?? 0 })}`;
    return node.name;
  };

  const renderIndicator = (node: PipelineNode, state: NodeState | undefined) => {
    if (!isRecord) return <OptionDot color={node.color} colors={optionColors} size={mode === 'preview' ? 9 : 12} />;
    if (state === 'pending' && terminals.has(node.id)) {
      return <IconFlag className="pv-node__flag" size="small" aria-hidden />;
    }
    const tone = state === 'active' ? `active-${currentCategory ?? 'unknown'}` : (state ?? 'pending');
    return <span className={`pv-node__dot pv-node__dot--${tone}`} aria-hidden />;
  };

  return (
    <div className={`pv-graph pv-graph--${mode}`} ref={scrollRef}>
      <div className="pv-graph__canvas" style={{ width: layout.width, height: layout.height }}>
        <svg
          className="pv-graph__edges"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden
        >
          {edges.map((e) => (
            <path key={e.key} d={e.path} className={e.strong ? 'pv-edge pv-edge--strong' : 'pv-edge'} />
          ))}
        </svg>

        {graph.nodes.map((node) => {
          const box = layout.nodes.get(node.id);
          if (!box) return null;
          const state = stateOf(node.id);
          const count = counts?.get(node.id);
          const badge = mode === 'preview' ? undefined : badges?.get(node.id);
          const classes = [
            'pv-node',
            state ? `is-${state}` : '',
            node.id === selectedNodeId ? 'is-selected' : '',
            onNodeClick ? 'is-clickable' : '',
            mode === 'overview' && !count ? 'is-empty' : '',
          ]
            .filter(Boolean)
            .join(' ');
          // Unknown and skipped steps explain themselves on hover; the others only need their (possibly truncated) name.
          const title = state === 'unknown' || state === 'skipped' ? describe(node, state, count) : node.name;
          return (
            <button
              key={node.id}
              type="button"
              className={classes}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                borderRadius: box.height / 2,
              }}
              title={title}
              aria-label={describe(node, state, count)}
              aria-current={state === 'active' ? 'step' : undefined}
              aria-pressed={onNodeClick ? node.id === selectedNodeId : undefined}
              onClick={onNodeClick ? () => onNodeClick(node.id) : undefined}
              tabIndex={onNodeClick ? 0 : -1}
            >
              {renderIndicator(node, state)}
              <span className="pv-node__label">{node.name}</span>
              {badge || mode === 'overview' ? (
                // Corner bubbles: the layout sizes pills for their label only, so inline badges would truncate it.
                <span className="pv-node__bubbles" aria-hidden>
                  {badge ? <span className="pv-node__badge">{badge}</span> : null}
                  {mode === 'overview' ? <span className="pv-node__count">{count ?? 0}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}

        <svg
          className="pv-graph__ports"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden
        >
          {ports.map((p) => (
            <circle key={p.key} cx={p.x} cy={p.y} r={PORT_RADIUS} className={`pv-port pv-port--${p.tone}`} />
          ))}
        </svg>
      </div>
    </div>
  );
}
