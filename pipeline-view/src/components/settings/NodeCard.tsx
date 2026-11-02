import type { Ref } from 'react';
import { Button, Checkbox, Select, TextArea, Tooltip } from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconChevronDown, IconChevronRight, IconClose } from '@douyinfe/semi-icons';
import type { FieldMeta, NodeConfig, PipelineContextValue, PipelineGraph, PipelineNode } from '../../types';
import { useI18n } from '../../i18n';
import { OptionDot, OptionTag } from '../OptionTag';
import { FieldMultiSelect, FieldSelect, SettingRow, toStringArray } from './shared';

export type NodeWarning = 'unreachable' | 'isolated' | null;

export interface NodeCardProps {
  ctx: PipelineContextValue;
  graph: PipelineGraph;
  node: PipelineNode;
  config: NodeConfig;
  expanded: boolean;
  focused: boolean;
  warning: NodeWarning;
  /** Fields that may be filled at a node (everything except the pipeline's own fields). */
  candidateFields: FieldMeta[];
  userFields: FieldMeta[];
  statusField?: FieldMeta;
  /** Name of the status used when the node has no entry status of its own. */
  defaultStatusName?: string;
  cardRef?: Ref<HTMLDivElement>;
  onToggle(): void;
  onSuccessorsChange(ids: string[]): void;
  onChange(fn: (node: NodeConfig) => NodeConfig): void;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** One collapsible card of the pipeline designer. */
export function NodeCard(props: NodeCardProps) {
  const { ctx, graph, node, config, warning, statusField, onChange } = props;
  const { t } = useI18n();
  const successors = graph.successors.get(node.id) ?? [];
  const predecessors = graph.predecessors.get(node.id) ?? [];
  const isolated = warning === 'isolated';
  const isStart = predecessors.length === 0 && !isolated;
  const isEnd = successors.length === 0 && !isolated;
  const requiredCount = config.fields.filter((r) => r.required).length;
  const statusOptions = statusField?.options ?? [];
  const entryStatus = config.entryStatusId && statusOptions.some((o) => o.id === config.entryStatusId) ? config.entryStatusId : undefined;

  const setRules = (fieldIds: string[]) =>
    onChange((n) => {
      const byId = new Map(n.fields.map((r) => [r.fieldId, r] as const));
      return { ...n, fields: fieldIds.map((id) => byId.get(id) ?? { fieldId: id, required: false }) };
    });

  const setRequired = (fieldId: string, required: boolean) =>
    onChange((n) => ({ ...n, fields: n.fields.map((r) => (r.fieldId === fieldId ? { ...r, required } : r)) }));

  const moveRule = (index: number, delta: number) => onChange((n) => ({ ...n, fields: move(n.fields, index, index + delta) }));

  const removeRule = (fieldId: string) => onChange((n) => ({ ...n, fields: n.fields.filter((r) => r.fieldId !== fieldId) }));

  const visibleRules = config.fields.filter((r) => ctx.fieldById.has(r.fieldId));

  return (
    <div ref={props.cardRef} className={`pv-node-card${props.expanded ? ' is-expanded' : ''}${props.focused ? ' is-focused' : ''}`}>
      <button type="button" className="pv-node-card__head" onClick={props.onToggle} aria-expanded={props.expanded}>
        <span className="pv-node-card__chevron">{props.expanded ? <IconChevronDown size="small" /> : <IconChevronRight size="small" />}</span>
        <OptionDot color={node.color} colors={ctx.optionColors} size={10} />
        <span className="pv-node-card__name">{node.name}</span>
        {isStart && <span className="pv-node-card__tag pv-node-card__tag--start">{t('settings.pipeline.tag.start')}</span>}
        {isEnd && <span className="pv-node-card__tag pv-node-card__tag--end">{t('settings.pipeline.tag.end')}</span>}
        {warning && (
          <Tooltip content={t(`settings.pipeline.warn.${warning}.tip`)}>
            <span className="pv-node-card__warn">
              <IconAlertTriangle size="small" />
              {t(`settings.pipeline.warn.${warning}`)}
            </span>
          </Tooltip>
        )}
        <span className="pv-node-card__summary">
          {visibleRules.length > 0 && t('settings.pipeline.summary.fields', { count: visibleRules.length })}
          {requiredCount > 0 && ` · ${t('settings.pipeline.summary.required', { count: requiredCount })}`}
        </span>
      </button>

      {props.expanded && (
        <div className="pv-node-card__body">
          <SettingRow label={t('settings.pipeline.next.label')} hint={t('settings.pipeline.next.hint')}>
            <Select
              className="pv-set-select"
              multiple
              filter
              maxTagCount={6}
              value={successors}
              placeholder={t('settings.pipeline.next.placeholder')}
              optionList={graph.nodes.filter((n) => n.id !== node.id).map((n) => ({ value: n.id, label: n.name }))}
              onChange={(value) => props.onSuccessorsChange(toStringArray(value))}
            />
          </SettingRow>

          <div className="pv-node-card__grid">
            <SettingRow label={t('settings.pipeline.owner.label')}>
              <FieldSelect
                fields={props.userFields}
                value={config.ownerFieldId}
                clearable
                placeholder={t('settings.pipeline.owner.placeholder')}
                onChange={(id) => onChange((n) => ({ ...n, ownerFieldId: id }))}
              />
            </SettingRow>
            <SettingRow label={t('settings.pipeline.entryStatus.label')}>
              <Select
                className="pv-set-select"
                value={entryStatus}
                disabled={!statusField}
                showClear
                placeholder={
                  !statusField
                    ? t('settings.pipeline.entryStatus.noStatus')
                    : props.defaultStatusName
                      ? t('settings.pipeline.entryStatus.defaultNamed', { name: props.defaultStatusName })
                      : t('settings.pipeline.entryStatus.default')
                }
                optionList={statusOptions.map((o) => ({
                  value: o.id,
                  label: <OptionTag option={o} colors={ctx.optionColors} size="small" />,
                }))}
                onChange={(value) => onChange((n) => ({ ...n, entryStatusId: typeof value === 'string' ? value : undefined }))}
                onClear={() => onChange((n) => ({ ...n, entryStatusId: undefined }))}
              />
            </SettingRow>
          </div>

          <SettingRow label={t('settings.pipeline.fields.label')} hint={t('settings.pipeline.fields.hint')}>
            <FieldMultiSelect
              fields={props.candidateFields}
              value={config.fields.map((r) => r.fieldId)}
              placeholder={t('settings.pipeline.fields.placeholder')}
              onChange={setRules}
            />
            {visibleRules.length > 0 && (
              <ul className="pv-node-card__rules">
                {config.fields.map((rule, index) => {
                  const field = ctx.fieldById.get(rule.fieldId);
                  if (!field) return null;
                  return (
                    <li key={rule.fieldId} className="pv-node-card__rule">
                      <span className="pv-node-card__rule-index">{index + 1}</span>
                      <span className="pv-node-card__rule-name" title={field.name}>
                        {field.name}
                        {rule.required && <span className="pv-set-row__required">*</span>}
                      </span>
                      <Checkbox checked={rule.required} onChange={(e) => setRequired(rule.fieldId, Boolean(e.target.checked))}>
                        {t('settings.pipeline.fields.required')}
                      </Checkbox>
                      <span className="pv-node-card__rule-actions">
                        <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<IconArrowUp />}
                          disabled={index === 0}
                          aria-label={t('settings.pipeline.fields.up')}
                          onClick={() => moveRule(index, -1)}
                        />
                        <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<IconArrowDown />}
                          disabled={index === config.fields.length - 1}
                          aria-label={t('settings.pipeline.fields.down')}
                          onClick={() => moveRule(index, 1)}
                        />
                        <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<IconClose />}
                          aria-label={t('settings.pipeline.fields.remove')}
                          onClick={() => removeRule(rule.fieldId)}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingRow>

          <SettingRow label={t('settings.pipeline.guidance.label')}>
            <TextArea
              value={config.description ?? ''}
              autosize={{ minRows: 2, maxRows: 8 }}
              placeholder={t('settings.pipeline.guidance.placeholder')}
              onChange={(value) => onChange((n) => ({ ...n, description: value ? value : undefined }))}
            />
          </SettingRow>
        </div>
      )}
    </div>
  );
}
