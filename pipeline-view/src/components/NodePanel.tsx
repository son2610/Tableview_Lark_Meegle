import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Dropdown, Select, Toast } from '@douyinfe/semi-ui';
import {
  IconArrowRight,
  IconChevronDown,
  IconExternalOpen,
  IconInfoCircle,
  IconPlay,
  IconTickCircle,
  IconUndo,
  IconUserAdd,
} from '@douyinfe/semi-icons';
import { getSelectId, getUsers, isCellEmpty } from '../core/cell';
import { getDoneStatusId } from '../core/config';
import { getStatusCategory } from '../core/state';
import { nextTargets, requiredProgress, rollbackTargets } from '../core/transitions';
import type { TransitionContext } from '../core/transitions';
import type {
  ActionResult,
  CellValue,
  NodeState,
  PipelineActions,
  PipelineContextValue,
  RecordData,
  RecordNodeStates,
  ValidationIssue,
} from '../types';
import { useI18n } from '../i18n';
import { FieldEditor, UserChips } from './FieldEditor';
import { OptionDot, OptionTag } from './OptionTag';
import './NodePanel.css';

export interface NodePanelProps {
  ctx: PipelineContextValue;
  actions: PipelineActions;
  record: RecordData;
  /** Node shown in the panel (a node of ctx.graph). */
  nodeId: string;
  /** computeNodeStates() of the record. */
  states: RecordNodeStates;
  /** Called with null after a successful transition so the panel follows the new current node. */
  onSelectNode: (nodeId: string | null) => void;
}

type MissingMap = Map<string, ValidationIssue['reason']>;

interface MenuItem {
  key: string;
  label: ReactNode;
  onClick: () => void;
}

function cls(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** Transition context for the core helpers, built from the UI context. */
export function makeTransitionContext(ctx: PipelineContextValue, now = Date.now()): TransitionContext {
  return { config: ctx.config, fieldById: ctx.fieldById, graph: ctx.graph, now };
}

function MenuButton(props: {
  label: ReactNode;
  items: MenuItem[];
  type?: 'primary' | 'tertiary';
  theme?: 'solid' | 'light';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}): JSX.Element {
  const { label, items, type = 'primary', theme = 'solid', icon, loading, disabled } = props;
  return (
    <Dropdown
      trigger="click"
      position="bottomRight"
      clickToHide
      render={
        <Dropdown.Menu>
          {items.map((item) => (
            <Dropdown.Item key={item.key} onClick={item.onClick}>
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      }
    >
      <Button type={type} theme={theme} icon={icon} loading={loading} disabled={disabled}>
        <span className="pv-np-menu-btn">
          {label}
          <IconChevronDown size="small" />
        </span>
      </Button>
    </Dropdown>
  );
}

function StateTag(props: { state: NodeState }): JSX.Element {
  const { t } = useI18n();
  return <span className={`pv-state-tag pv-state-tag--${props.state}`}>{t(`detail.state.${props.state}`)}</span>;
}

/**
 * The selected node of a record: owner, guidance, the node's fields as a form and,
 * for the current node, the transition actions (complete / route / rollback / start).
 */
export function NodePanel(props: NodePanelProps): JSX.Element | null {
  const { ctx, actions, record, nodeId, states, onSelectNode } = props;
  const { t } = useI18n();
  const { config, fieldById, graph, statusField, editable, optionColors } = ctx;

  const [missing, setMissing] = useState<MissingMap>(() => new Map());
  const [statusNotDone, setStatusNotDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editorResets, setEditorResets] = useState<Record<string, number>>({});
  const [scrollTarget, setScrollTarget] = useState<{ fieldId: string; seq: number } | null>(null);
  const fieldRefs = useRef(new Map<string, HTMLDivElement>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Validation marks belong to one record + node.
  useEffect(() => {
    setMissing(new Map());
    setStatusNotDone(false);
  }, [record.id, nodeId]);

  useEffect(() => {
    if (!scrollTarget) return;
    const el = fieldRefs.current.get(scrollTarget.fieldId);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [scrollTarget]);

  const tctx = useMemo(() => makeTransitionContext(ctx), [ctx]);

  const node = graph.nodeById.get(nodeId);
  if (!node) return null;

  const nodeConfig = config.nodes[nodeId] ?? { fields: [] };
  const rules = nodeConfig.fields.filter((r) => fieldById.has(r.fieldId));
  const nodeFieldIds = rules.map((r) => r.fieldId);
  const state: NodeState = states.states.get(nodeId) ?? 'pending';
  const isCurrent = states.current === nodeId;
  const notStarted = states.current === null;
  const isTerminal = (graph.successors.get(nodeId) ?? []).length === 0;
  // Fields of the current step and of steps not reached yet can be filled in; completed or
  // skipped steps are read-only so a step that passed its gate cannot lose its required data.
  const fieldsEditable = editable && (isCurrent || state === 'pending');

  const progress = isCurrent ? requiredProgress(tctx, record, nodeId) : null;
  const successors = isCurrent ? nextTargets(tctx, record) : [];
  const rollbacks = isCurrent ? rollbackTargets(tctx, record) : [];

  const statusId = statusField ? getSelectId(record.fields[statusField.id]) : null;
  const statusCategory = getStatusCategory(config, statusId);
  const showStatusHint = statusNotDone && statusCategory !== 'done';

  const ownerField = nodeConfig.ownerFieldId ? fieldById.get(nodeConfig.ownerFieldId) : undefined;
  const owners = ownerField ? getUsers(record.fields[ownerField.id]) : [];

  const nodeName = (id: string) => graph.nodeById.get(id)?.name ?? id;
  const nodeLabel = (id: string) => {
    const n = graph.nodeById.get(id);
    return (
      <span className="pv-np-menu-item">
        {n ? <OptionDot color={n.color} colors={optionColors} size={8} /> : null}
        <span>{nodeName(id)}</span>
      </span>
    );
  };

  async function run(
    key: string,
    fn: () => Promise<ActionResult>,
    opts: { success?: string; follow?: boolean } = {},
  ): Promise<void> {
    if (busy) return;
    setBusy(key);
    let result: ActionResult;
    try {
      result = await fn();
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (result.ok) {
      if (opts.success) Toast.success(opts.success);
      if (mounted.current) {
        setBusy(null);
        setMissing(new Map());
        setStatusNotDone(false);
      }
      if (opts.follow) onSelectNode(null);
      return;
    }
    Toast.error(result.error || t('detail.action.failed'));
    if (!mounted.current) return;
    setBusy(null);
    const nextMissing: MissingMap = new Map((result.missing ?? []).map((m) => [m.fieldId, m.reason]));
    setMissing(nextMissing);
    setStatusNotDone(!!result.statusNotDone);
    const first = nodeFieldIds.find((id) => nextMissing.has(id));
    if (first) setScrollTarget((prev) => ({ fieldId: first, seq: (prev?.seq ?? 0) + 1 }));
  }

  async function commitField(fieldId: string, value: CellValue): Promise<void> {
    let result: ActionResult;
    try {
      result = await actions.setCell(record.id, fieldId, value);
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (result.ok) return;
    Toast.error(result.error || t('detail.field.saveFailed'));
    // Remount the editor so it shows the stored value again instead of the rejected draft.
    if (mounted.current) setEditorResets((prev) => ({ ...prev, [fieldId]: (prev[fieldId] ?? 0) + 1 }));
  }

  const advance = (to: string) =>
    run(`advance:${to}`, () => actions.advance(record.id, to), {
      success: t('detail.toast.moved', { name: nodeName(to) }),
      follow: true,
    });
  const rollback = (to: string) =>
    run(`rollback:${to}`, () => actions.rollback(record.id, to), {
      success: t('detail.toast.rolledBack', { name: nodeName(to) }),
      follow: true,
    });
  const start = (to: string) =>
    run(`start:${to}`, () => actions.start(record.id, to), {
      success: t('detail.toast.started', { name: nodeName(to) }),
      follow: true,
    });
  const complete = () =>
    run('complete', () => actions.complete(record.id), { success: t('detail.toast.completed'), follow: true });

  /* ---------------------------------------------------------------- */

  const header = (
    <div className="pv-np-head">
      <div className="pv-np-title-row">
        <h3 className="pv-np-title" title={node.name}>
          {node.name}
        </h3>
        <StateTag state={state} />
        {progress && progress.total > 0 ? (
          <span className={cls('pv-np-progress', progress.filled >= progress.total && 'is-complete')}>
            <span className="pv-np-progress__bar" aria-hidden>
              <span style={{ width: `${Math.round((progress.filled / progress.total) * 100)}%` }} />
            </span>
            {t('detail.node.requiredProgress', { filled: progress.filled, total: progress.total })}
          </span>
        ) : null}
      </div>
      {ownerField ? (
        <div className="pv-np-owner">
          <span className="pv-np-owner__label">{ownerField.name}</span>
          {owners.length > 0 ? (
            <UserChips users={owners} />
          ) : editable ? (
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              icon={<IconUserAdd />}
              onClick={() => void actions.editField(record.id, ownerField.id)}
            >
              {t('detail.node.assignOwner')}
            </Button>
          ) : (
            <span className="pv-np-muted">{t('detail.node.noOwner')}</span>
          )}
        </div>
      ) : null}
    </div>
  );

  const guidance = nodeConfig.description?.trim() ? (
    <div className="pv-np-guide">
      <IconInfoCircle className="pv-np-guide__icon" />
      <div className="pv-np-guide__text">{nodeConfig.description.trim()}</div>
    </div>
  ) : null;

  let notice: ReactNode = null;
  if (!isCurrent) {
    const key = notStarted ? 'notStarted' : state;
    notice = (
      <div className={`pv-np-notice pv-np-notice--${key}`}>
        <span>{t(`detail.node.notice.${key}`)}</span>
        {fieldsEditable && rules.length > 0 ? (
          <span className="pv-np-muted">{t('detail.node.notice.editAhead')}</span>
        ) : null}
      </div>
    );
  }

  const fields = (
    <section className="pv-np-section" aria-label={t('detail.node.fieldsTitle')}>
      <div className="pv-np-section-head">
        <span className="pv-np-section-title">{t('detail.node.fieldsTitle')}</span>
        <Button
          size="small"
          theme="borderless"
          type="tertiary"
          icon={<IconExternalOpen />}
          onClick={() => void actions.openRecord(record.id, nodeFieldIds.length ? nodeFieldIds : undefined)}
        >
          {editable ? t('detail.node.openForm') : t('detail.node.viewInLark')}
        </Button>
      </div>
      {rules.length === 0 ? (
        <div className="pv-np-empty">
          <div>{t('detail.node.noFields')}</div>
          <div className="pv-np-muted">{t('detail.node.noFieldsHint')}</div>
        </div>
      ) : (
        <div className="pv-np-fields">
          {rules.map((rule) => {
            const field = fieldById.get(rule.fieldId);
            if (!field) return null;
            const value = record.fields[field.id];
            const reason = missing.get(field.id);
            const invalid = reason !== undefined && isCellEmpty(field, value);
            return (
              <div
                key={field.id}
                className={cls('pv-np-field', invalid && 'is-invalid')}
                role="group"
                aria-label={field.name}
                ref={(el) => {
                  if (el) fieldRefs.current.set(field.id, el);
                  else fieldRefs.current.delete(field.id);
                }}
              >
                <div className="pv-np-field__label">
                  <span className="pv-np-field__name" title={field.name}>
                    {field.name}
                  </span>
                  {rule.required ? (
                    <span className="pv-np-req" title={t('detail.validation.requiredTitle')}>
                      *
                    </span>
                  ) : null}
                </div>
                <FieldEditor
                  key={`${field.id}:${editorResets[field.id] ?? 0}`}
                  field={field}
                  value={value}
                  editable={fieldsEditable}
                  invalid={invalid}
                  optionColors={optionColors}
                  onCommit={(v) => void commitField(field.id, v)}
                  onOpenHostEditor={() => void actions.editField(record.id, field.id)}
                />
                {invalid ? (
                  <div className="pv-np-field__error" role="alert">
                    {reason === 'unchecked' ? t('detail.validation.unchecked') : t('detail.validation.required')}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  /* ---------------------------------------------------------------- */
  /* Action bar                                                        */
  /* ---------------------------------------------------------------- */

  let actionBar: ReactNode = null;
  if (editable && notStarted) {
    const roots = graph.roots.length ? graph.roots : graph.nodes.slice(0, 1).map((n) => n.id);
    // The selected node goes first when it is itself a root.
    const ordered = roots.includes(nodeId) ? [nodeId, ...roots.filter((r) => r !== nodeId)] : roots;
    actionBar = (
      <div className="pv-np-actions">
        <div className="pv-np-actions__left" />
        <div className="pv-np-actions__right">
          {ordered.length === 1 ? (
            <Button
              type="primary"
              theme="solid"
              icon={<IconPlay />}
              loading={busy === `start:${ordered[0]}`}
              disabled={!!busy}
              onClick={() => void start(ordered[0])}
            >
              {t('detail.action.startAt', { name: nodeName(ordered[0]) })}
            </Button>
          ) : ordered.length > 1 ? (
            <MenuButton
              label={t('detail.action.startAtMenu')}
              icon={<IconPlay />}
              loading={!!busy && busy.startsWith('start:')}
              disabled={!!busy}
              items={ordered.map((id) => ({ key: id, label: nodeLabel(id), onClick: () => void start(id) }))}
            />
          ) : null}
        </div>
      </div>
    );
  } else if (editable && isCurrent) {
    const statusOptions = statusField?.options ?? [];
    const primary: ReactNode = isTerminal ? (
      states.finished ? (
        <span className="pv-np-finished">
          <IconTickCircle />
          {t('detail.action.finished')}
        </span>
      ) : !getDoneStatusId(config, statusField) ? (
        // Finishing sets a "Done" status: without one, completing could only fail.
        <span className="pv-np-muted pv-np-no-done">{t('detail.action.noDoneStatus')}</span>
      ) : (
        <Button
          type="primary"
          theme="solid"
          icon={<IconTickCircle />}
          loading={busy === 'complete'}
          disabled={!!busy}
          onClick={() => void complete()}
        >
          {t('detail.action.complete')}
        </Button>
      )
    ) : successors.length === 1 ? (
      <Button
        type="primary"
        theme="solid"
        icon={<IconArrowRight />}
        iconPosition="right"
        loading={busy === `advance:${successors[0]}`}
        disabled={!!busy}
        onClick={() => void advance(successors[0])}
      >
        {t('detail.action.advanceTo', { name: nodeName(successors[0]) })}
      </Button>
    ) : successors.length > 1 ? (
      <MenuButton
        label={t('detail.action.advanceMenu')}
        loading={!!busy && busy.startsWith('advance:')}
        disabled={!!busy}
        items={successors.map((id) => ({ key: id, label: nodeLabel(id), onClick: () => void advance(id) }))}
      />
    ) : null;

    actionBar = (
      <div className="pv-np-actions">
        <div className="pv-np-actions__left">
          {statusField ? (
            <div className={cls('pv-np-status', showStatusHint && 'is-invalid')}>
              <span className="pv-np-status__label">{statusField.name}</span>
              <Select
                value={statusId ?? undefined}
                placeholder={t('detail.status.none')}
                style={{ minWidth: 168 }}
                disabled={!!busy}
                validateStatus={showStatusHint ? 'warning' : 'default'}
                optionList={statusOptions.map((o) => ({
                  value: o.id,
                  label: <OptionTag option={o} colors={optionColors} size="small" />,
                }))}
                onChange={(v) => {
                  const id = typeof v === 'string' ? v : null;
                  if (id === statusId) return;
                  void run('status', () => actions.setStatus(record.id, id));
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="pv-np-actions__right">
          {rollbacks.length > 0 ? (
            <MenuButton
              label={t('detail.action.rollbackMenu')}
              type="tertiary"
              theme="light"
              icon={<IconUndo />}
              loading={!!busy && busy.startsWith('rollback:')}
              disabled={!!busy}
              items={rollbacks.map((id) => ({ key: id, label: nodeLabel(id), onClick: () => void rollback(id) }))}
            />
          ) : null}
          {primary}
        </div>
        {showStatusHint ? (
          <div className="pv-np-actions__hint" role="alert">
            {t('detail.action.statusNotDone')}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cls('pv-node-panel', isCurrent && 'is-current')}>
      {header}
      {guidance}
      {notice}
      {fields}
      {actionBar}
    </div>
  );
}
