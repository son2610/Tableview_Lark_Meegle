import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import type { PipelineContextValue, RecordData, RecordNodeStates } from '../types';
import { useI18n } from '../i18n';
import { topoOrder } from '../core/graph';
import { PipelineGraph } from './PipelineGraph';
import { OptionTag } from './OptionTag';
import { STAGE_FINISHED, STAGE_NONE } from './Toolbar';
import type { StageFilter } from './Toolbar';
import './Overview.css';

export interface OverviewProps {
  ctx: PipelineContextValue;
  /** Records after the search / status filters (not the stage filter). */
  records: RecordData[];
  statesById: Map<string, RecordNodeStates>;
  /** True when a search or status filter narrows `records`. */
  filtered: boolean;
  stageFilter: StageFilter;
  onStageFilter(value: StageFilter): void;
}

interface Summary {
  total: number;
  notStarted: number;
  inProgress: number;
  finished: number;
  blocked: number;
  /** Records currently at each node, finished ones included (a terminal node counts its outcomes). */
  perNode: Map<string, number>;
}

export function summarize(ctx: PipelineContextValue, records: RecordData[], statesById: Map<string, RecordNodeStates>): Summary {
  const perNode = new Map<string, number>(ctx.graph.nodes.map((n) => [n.id, 0]));
  const summary: Summary = { total: records.length, notStarted: 0, inProgress: 0, finished: 0, blocked: 0, perNode };
  for (const record of records) {
    const states = statesById.get(record.id);
    if (!states || states.current === null) {
      summary.notStarted++;
      continue;
    }
    perNode.set(states.current, (perNode.get(states.current) ?? 0) + 1);
    if (states.finished) {
      summary.finished++;
    } else {
      summary.inProgress++;
      if (states.currentCategory === 'blocked') summary.blocked++;
    }
  }
  return summary;
}

function onActivate(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}

export function Overview(props: OverviewProps) {
  const { ctx, records, statesById, stageFilter, onStageFilter } = props;
  const { t } = useI18n();

  const summary = useMemo(() => summarize(ctx, records, statesById), [ctx, records, statesById]);
  const order = useMemo(() => topoOrder(ctx.graph), [ctx.graph]);
  const toggle = (value: StageFilter) => onStageFilter(stageFilter === value ? null : value);

  const chips: { key: string; label: string; value: number; tone: string; filter?: StageFilter }[] = [
    { key: 'total', label: t('common.overview.total'), value: summary.total, tone: 'total', filter: null },
    { key: 'none', label: t('common.overview.notStarted'), value: summary.notStarted, tone: 'none', filter: STAGE_NONE },
    { key: 'doing', label: t('common.overview.inProgress'), value: summary.inProgress, tone: 'doing' },
    { key: 'done', label: t('common.overview.finished'), value: summary.finished, tone: 'done', filter: STAGE_FINISHED },
    { key: 'blocked', label: t('common.overview.blocked'), value: summary.blocked, tone: 'blocked' },
  ];

  return (
    <div className="pv-overview">
      <div className="pv-overview__head">
        <div>
          <h2 className="pv-overview__title">{t('common.overview.title')}</h2>
          <div className="pv-overview__hint">{t('common.overview.hint')}</div>
        </div>
        {props.filtered && <span className="pv-overview__filtered">{t('common.overview.filtered')}</span>}
      </div>

      <div className="pv-overview__chips">
        {chips.map((chip) => {
          const clickable = chip.filter !== undefined;
          const active = clickable && chip.filter !== null && stageFilter === chip.filter;
          const activate = () => (chip.filter === null ? onStageFilter(null) : toggle(chip.filter ?? null));
          return (
            <div
              key={chip.key}
              className={`pv-overview__chip pv-overview__chip--${chip.tone}${clickable ? ' is-clickable' : ''}${active ? ' is-active' : ''}`}
              role={clickable ? 'button' : undefined}
              aria-pressed={clickable ? active : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? activate : undefined}
              onKeyDown={clickable ? onActivate(activate) : undefined}
            >
              <span className="pv-overview__chip-value">{chip.value}</span>
              <span className="pv-overview__chip-label">{chip.label}</span>
            </div>
          );
        })}
      </div>

      <section className="pv-overview__card">
        {ctx.graph.nodes.length === 0 ? (
          <div className="pv-overview__empty">{t('common.overview.noNodes')}</div>
        ) : (
          <div className="pv-overview__graph">
            <PipelineGraph
              graph={ctx.graph}
              layout={ctx.layout}
              mode="overview"
              counts={summary.perNode}
              selectedNodeId={stageFilter && ctx.graph.nodeById.has(stageFilter) ? stageFilter : null}
              onNodeClick={(nodeId) => toggle(nodeId)}
              optionColors={ctx.optionColors}
            />
          </div>
        )}
      </section>

      {order.length > 0 && (
        <section className="pv-overview__card pv-overview__table">
          <div className="pv-overview__row pv-overview__row--head" aria-hidden>
            <span>{t('common.overview.node')}</span>
            <span className="pv-overview__num">{t('common.overview.count')}</span>
            <span>{t('common.overview.share')}</span>
          </div>
          {order.map((nodeId) => {
            const node = ctx.graph.nodeById.get(nodeId);
            if (!node) return null;
            const count = summary.perNode.get(nodeId) ?? 0;
            const share = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
            const active = stageFilter === nodeId;
            return (
              <div
                key={nodeId}
                className={`pv-overview__row${active ? ' is-active' : ''}`}
                role="button"
                aria-pressed={active}
                aria-label={`${node.name}: ${count} (${share}%)`}
                tabIndex={0}
                onClick={() => toggle(nodeId)}
                onKeyDown={onActivate(() => toggle(nodeId))}
              >
                <span className="pv-overview__node">
                  <OptionTag option={node} colors={ctx.optionColors} size="small" />
                </span>
                <span className="pv-overview__num">
                  {count}
                </span>
                <span className="pv-overview__bar-cell">
                  <span className="pv-overview__bar">
                    <span className="pv-overview__bar-fill" style={{ width: `${summary.total > 0 ? (count / summary.total) * 100 : 0}%` }} />
                  </span>
                  <span className="pv-overview__pct">{share}%</span>
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
