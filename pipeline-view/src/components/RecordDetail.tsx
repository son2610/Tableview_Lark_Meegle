import { useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Toast, Tooltip } from '@douyinfe/semi-ui';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconExternalOpen,
  IconPlus,
  IconTick,
  IconTickCircle,
} from '@douyinfe/semi-icons';
import { cellToText, formatDateTime, formatDuration, getSelectId, getUsers } from '../core/cell';
import { computeNodeStates, getEnteredAt } from '../core/state';
import { requiredProgress } from '../core/transitions';
import type { ActionResult, FieldMeta, PipelineActions, PipelineContextValue, RecordData } from '../types';
import { useI18n } from '../i18n';
import { AvatarStack } from './FieldEditor';
import { makeTransitionContext, NodePanel } from './NodePanel';
import { OptionTag } from './OptionTag';
import { PipelineGraph } from './PipelineGraph';
import './RecordDetail.css';

export interface RecordDetailProps {
  ctx: PipelineContextValue;
  actions: PipelineActions;
  record: RecordData;
  /** null => current node */
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

const CHIP_TONES = 8;

function cls(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** Re-render periodically so "time in stage" stays fresh. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

async function settle(p: Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await p;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function RoleChip(props: {
  field: FieldMeta;
  record: RecordData;
  tone: number;
  editable: boolean;
  onEdit: () => void;
}): JSX.Element {
  const { field, record, tone, editable, onEdit } = props;
  const { t } = useI18n();
  const users = getUsers(record.fields[field.id]);
  const empty = users.length === 0;
  const content = (
    <>
      <span className="pv-role-chip__name">{field.name}</span>
      {empty ? (
        editable ? (
          <IconPlus size="small" className="pv-role-chip__add" />
        ) : null
      ) : (
        <AvatarStack users={users} size={20} />
      )}
    </>
  );
  const className = cls('pv-role-chip', empty && 'is-empty', editable && 'is-editable');
  const style = { background: `var(--pv-chip-${tone % CHIP_TONES})` };
  const tip = empty ? t('detail.roles.empty') : users.map((u) => u.name).join(', ');
  return (
    <Tooltip content={tip} position="bottom">
      {editable ? (
        <button
          type="button"
          className={className}
          style={style}
          onClick={onEdit}
          aria-label={`${field.name}: ${empty ? t('detail.roles.assign') : tip}`}
        >
          {content}
        </button>
      ) : (
        <span className={className} style={style} aria-label={`${field.name}: ${tip}`}>
          {content}
        </span>
      )}
    </Tooltip>
  );
}

/**
 * The selected record as one Meegle-style card: header (title, status, time in stage),
 * role chips, checklist pills, the record's pipeline graph and the node panel.
 */
export function RecordDetail(props: RecordDetailProps): JSX.Element {
  const { ctx, actions, record, selectedNodeId, onSelectNode } = props;
  const { t, lang } = useI18n();
  const { config, fieldById, graph, layout, statusField, editable, optionColors } = ctx;
  const now = useNow(60_000);

  const [statusBusy, setStatusBusy] = useState(false);
  // Optimistic checklist values while the write is in flight / not yet echoed back.
  const [checkOverrides, setCheckOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCheckOverrides({});
  }, [record.id]);

  useEffect(() => {
    setCheckOverrides((prev) => {
      const next: Record<string, boolean> = {};
      for (const [id, v] of Object.entries(prev)) if ((record.fields[id] === true) !== v) next[id] = v;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [record]);

  const nodeStates = useMemo(
    () => computeNodeStates(graph, record, config, fieldById),
    [graph, record, config, fieldById],
  );
  const tctx = useMemo(() => makeTransitionContext(ctx), [ctx]);
  const current = nodeStates.current;

  const panelNodeId =
    (selectedNodeId && graph.nodeById.has(selectedNodeId) ? selectedNodeId : null) ??
    current ??
    graph.roots[0] ??
    graph.nodes[0]?.id ??
    null;

  const badges = useMemo(() => {
    const map = new Map<string, string>();
    if (current && nodeStates.states.get(current) === 'active') {
      const p = requiredProgress(tctx, record, current);
      if (p.total > 0) map.set(current, `${p.filled}/${p.total}`);
    }
    return map;
  }, [current, nodeStates, tctx, record]);

  const titleField = config.titleFieldId ? fieldById.get(config.titleFieldId) : undefined;
  const title = (titleField ? cellToText(titleField, record.fields[titleField.id], lang) : '').trim();
  const shownTitle = title || t('detail.untitled');

  const statusId = statusField ? getSelectId(record.fields[statusField.id]) : null;
  const statusOption = statusField?.options?.find((o) => o.id === statusId) ?? null;
  const statusText =
    statusId && !statusOption && statusField ? cellToText(statusField, record.fields[statusField.id], lang) : '';

  const enteredAt = getEnteredAt(record, config);
  const timeInStage = current && enteredAt !== null ? formatDuration(now - enteredAt, lang) : null;

  const roleFields = config.roleFieldIds.map((id) => fieldById.get(id)).filter((f): f is FieldMeta => !!f);
  const checklistFields = config.checklistFieldIds.map((id) => fieldById.get(id)).filter((f): f is FieldMeta => !!f);

  async function changeStatus(optionId: string | null) {
    if (statusBusy || optionId === statusId) return;
    setStatusBusy(true);
    const result = await settle(actions.setStatus(record.id, optionId));
    setStatusBusy(false);
    if (!result.ok) Toast.error(result.error || t('detail.action.failed'));
  }

  async function toggleCheck(fieldId: string, next: boolean) {
    setCheckOverrides((prev) => ({ ...prev, [fieldId]: next }));
    const result = await settle(actions.setCell(record.id, fieldId, next));
    if (!result.ok) {
      Toast.error(result.error || t('detail.field.saveFailed'));
      setCheckOverrides((prev) => {
        const rest = { ...prev };
        delete rest[fieldId];
        return rest;
      });
    }
  }

  /* ---------------------------------------------------------------- */

  const statusTag = (
    <OptionTag
      option={statusOption}
      placeholder={statusText || t('detail.status.none')}
      colors={optionColors}
      className="pv-rd-status-tag"
      style={{ height: 28, padding: '0 10px', fontSize: 14, borderRadius: 6 }}
    />
  );

  const statusChip = !statusField ? null : editable ? (
    <Dropdown
      trigger="click"
      position="bottomLeft"
      showTick
      render={
        <Dropdown.Menu>
          {(statusField.options ?? []).map((o) => (
            <Dropdown.Item key={o.id} active={o.id === statusId} onClick={() => void changeStatus(o.id)}>
              <OptionTag option={o} colors={optionColors} size="small" />
            </Dropdown.Item>
          ))}
          {statusId ? (
            <>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => void changeStatus(null)}>{t('detail.status.clear')}</Dropdown.Item>
            </>
          ) : null}
        </Dropdown.Menu>
      }
    >
      <button
        type="button"
        className={cls('pv-rd-status-btn', statusBusy && 'is-busy')}
        aria-label={t('detail.status.change', { field: statusField.name })}
        aria-haspopup="menu"
        disabled={statusBusy}
      >
        {statusTag}
        <IconChevronDown size="small" className="pv-rd-status-btn__caret" />
      </button>
    </Dropdown>
  ) : (
    statusTag
  );

  return (
    <div className="pv-rd-wrap">
      <article className="pv-record-detail" aria-label={shownTitle}>
        <header className="pv-rd-header">
          <span className="pv-rd-icon" aria-hidden>
            <IconTickCircle />
          </span>
          <h2 className={cls('pv-rd-title', !title && 'is-untitled')} title={shownTitle}>
            {shownTitle}
          </h2>
          <div className="pv-rd-meta">
            {statusChip}
            {nodeStates.finished ? (
              <span className="pv-rd-finished">
                <IconTick size="small" />
                {t('detail.finished')}
              </span>
            ) : null}
            {timeInStage && enteredAt !== null ? (
              <Tooltip content={t('detail.header.enteredAt', { date: formatDateTime(enteredAt) })}>
                <span className="pv-rd-time" tabIndex={0}>
                  {timeInStage}
                </span>
              </Tooltip>
            ) : null}
          </div>
          <Tooltip content={t('detail.header.openRecord')} position="bottomRight">
            <Button
              className="pv-rd-open"
              theme="borderless"
              type="tertiary"
              icon={<IconExternalOpen />}
              aria-label={t('detail.header.openRecord')}
              onClick={() => void actions.openRecord(record.id)}
            />
          </Tooltip>
        </header>

        {roleFields.length > 0 ? (
          <div className="pv-rd-section pv-rd-roles" aria-label={t('detail.roles.title')}>
            {roleFields.map((f, i) => (
              <RoleChip
                key={f.id}
                field={f}
                record={record}
                tone={i}
                editable={editable}
                onEdit={() => void actions.editField(record.id, f.id)}
              />
            ))}
          </div>
        ) : null}

        {checklistFields.length > 0 ? (
          <div className="pv-rd-section pv-rd-checklist" aria-label={t('detail.checklist.title')}>
            {checklistFields.map((f) => {
              const checked = checkOverrides[f.id] ?? record.fields[f.id] === true;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={cls('pv-check-pill', checked && 'is-checked')}
                  disabled={!editable}
                  title={f.name}
                  onClick={() => void toggleCheck(f.id, !checked)}
                >
                  <span className="pv-check-pill__mark" aria-hidden>
                    {checked ? <IconTick size="extra-small" /> : null}
                  </span>
                  <span className="pv-check-pill__name">{f.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <section className="pv-rd-section pv-rd-flow" aria-label={t('detail.graph.title')}>
          <div className="pv-rd-flow__head">
            <span className="pv-rd-section-title">{t('detail.graph.title')}</span>
            <div className="pv-rd-legend" aria-hidden>
              <span className="pv-rd-legend__item">
                <i className="pv-rd-legend__dot is-done" />
                {t('detail.legend.done')}
              </span>
              <span className="pv-rd-legend__item">
                <i className="pv-rd-legend__dot is-current" />
                {t('detail.legend.current')}
              </span>
              <span className="pv-rd-legend__item">
                <i className="pv-rd-legend__dot is-pending" />
                {t('detail.legend.pending')}
              </span>
            </div>
          </div>
          {nodeStates.unknownStageText ? (
            <div className="pv-rd-banner pv-rd-banner--warning" role="status">
              <IconAlertTriangle className="pv-rd-banner__icon" />
              <span>{t('detail.unknownStage', { name: nodeStates.unknownStageText })}</span>
            </div>
          ) : null}
          {graph.nodes.length === 0 ? (
            <div className="pv-rd-empty">{t('detail.graph.empty')}</div>
          ) : (
            <div className="pv-rd-flow__graph">
              <PipelineGraph
                graph={graph}
                layout={layout}
                mode="record"
                states={nodeStates.states}
                currentCategory={nodeStates.currentCategory}
                badges={badges}
                selectedNodeId={panelNodeId}
                optionColors={optionColors}
                onNodeClick={(id) => onSelectNode(id === current ? null : id)}
              />
            </div>
          )}
        </section>

        {panelNodeId ? (
          <div className="pv-rd-section pv-rd-panel">
            <NodePanel
              ctx={ctx}
              actions={actions}
              record={record}
              nodeId={panelNodeId}
              states={nodeStates}
              onSelectNode={onSelectNode}
            />
          </div>
        ) : null}
      </article>
    </div>
  );
}
