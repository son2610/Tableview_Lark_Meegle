import { Button, Input, Select, Tooltip } from '@douyinfe/semi-ui';
import { IconFlowChartStroked, IconHistogram, IconSearch, IconSetting } from '@douyinfe/semi-icons';
import type { PipelineContextValue } from '../types';
import { useI18n } from '../i18n';
import { OptionTag } from './OptionTag';
import './Toolbar.css';

/** Stage filter: null = all, a node id, or one of the special buckets below. */
export type StageFilter = string | null;
export const STAGE_NONE = '__none__';
export const STAGE_FINISHED = '__finished__';
const ALL = '__all__';

export interface ToolbarProps {
  ctx: PipelineContextValue;
  /** Records currently in the list (after all filters). */
  shownCount: number;
  search: string;
  onSearchChange(value: string): void;
  stageFilter: StageFilter;
  onStageFilterChange(value: StageFilter): void;
  statusFilter: string | null;
  onStatusFilterChange(value: string | null): void;
  overviewActive: boolean;
  onOverview(): void;
  onOpenSettings(): void;
}

export function Toolbar(props: ToolbarProps) {
  const { ctx } = props;
  const { t } = useI18n();
  const total = ctx.records.length;
  const filtered = props.shownCount !== total;

  const stageOptions = [
    { value: ALL, label: t('common.filter.allStages') },
    { value: STAGE_NONE, label: <span className="pv-toolbar__bucket pv-toolbar__bucket--none">{t('common.filter.notStarted')}</span> },
    ...ctx.graph.nodes.map((node) => ({
      value: node.id,
      label: <OptionTag option={node} colors={ctx.optionColors} size="small" />,
    })),
    { value: STAGE_FINISHED, label: <span className="pv-toolbar__bucket pv-toolbar__bucket--done">{t('common.filter.finished')}</span> },
  ];

  const statusOptions = ctx.statusField
    ? [
        { value: ALL, label: t('common.filter.allStatuses') },
        ...(ctx.statusField.options ?? []).map((option) => ({
          value: option.id,
          label: <OptionTag option={option} colors={ctx.optionColors} size="small" />,
        })),
      ]
    : null;

  const settingsButton = (
    <Button
      icon={<IconSetting />}
      theme="borderless"
      type="tertiary"
      disabled={!ctx.editable}
      onClick={props.onOpenSettings}
      aria-label={t('common.settings')}
    >
      <span className="pv-toolbar__label">{t('common.settings')}</span>
    </Button>
  );

  return (
    <header className="pv-toolbar">
      <div className="pv-toolbar__title">
        <span className="pv-toolbar__icon" aria-hidden>
          <IconFlowChartStroked size="small" />
        </span>
        <span className="pv-toolbar__name" title={ctx.table.name}>
          {ctx.table.name || t('common.appName')}
        </span>
        <span className="pv-toolbar__count">
          {filtered ? t('common.recordsFiltered', { shown: props.shownCount, total }) : t('common.records', { count: total })}
        </span>
      </div>

      <div className="pv-toolbar__filters">
        <Input
          className="pv-toolbar__search"
          prefix={<IconSearch />}
          showClear
          value={props.search}
          placeholder={t('common.search.placeholder')}
          onChange={(value) => props.onSearchChange(value)}
        />
        <Select
          className="pv-toolbar__select"
          value={props.stageFilter ?? ALL}
          optionList={stageOptions}
          onChange={(value) => props.onStageFilterChange(value === ALL || typeof value !== 'string' ? null : value)}
          insetLabel={t('common.filter.stage')}
          dropdownMatchSelectWidth={false}
          maxHeight={360}
        />
        {statusOptions && (
          <Select
            className="pv-toolbar__select"
            value={props.statusFilter ?? ALL}
            optionList={statusOptions}
            onChange={(value) => props.onStatusFilterChange(value === ALL || typeof value !== 'string' ? null : value)}
            insetLabel={t('common.filter.status')}
            dropdownMatchSelectWidth={false}
            maxHeight={360}
          />
        )}
      </div>

      <div className="pv-toolbar__actions">
        <Button
          icon={<IconHistogram />}
          theme={props.overviewActive ? 'light' : 'borderless'}
          type={props.overviewActive ? 'primary' : 'tertiary'}
          onClick={props.onOverview}
          aria-label={t('common.overview')}
        >
          <span className="pv-toolbar__label">{t('common.overview')}</span>
        </Button>
        {ctx.editable ? (
          settingsButton
        ) : (
          <Tooltip content={t('common.settings.readonly')} position="bottomRight">
            <span className="pv-toolbar__disabled-wrap">{settingsButton}</span>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
