import { useState } from 'react';
import { Button, Select, Toast } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import type { AddFieldConfig } from '../../sdk/adapter';
import { FieldType } from '../../types';
import type { FieldMeta, PipelineConfig, ViewInfo } from '../../types';
import { normalizeConfig } from '../../core/config';
import { useI18n } from '../../i18n';
import type { TFunc } from '../../i18n';
import { FieldSelect, Notice, SettingRow, uniqueFieldName } from './shared';
import type { TabProps } from './shared';

type CreatableRole = 'stage' | 'status' | 'enteredAt' | 'history';

const GRID_VIEW = 1;
const ALL_RECORDS = '__all__';

/**
 * Colour ids follow Lark's palette order (0 blue, 1 cyan, 2 green, 3 yellow, 4 orange,
 * 5 red, 6 pink, 7 purple, 8 indigo, 9 grey).
 */
const COLOR = { blue: 0, cyan: 1, green: 2, orange: 4, red: 5, purple: 7, grey: 9 } as const;

export function newFieldConfig(role: CreatableRole, t: TFunc, fields: FieldMeta[]): AddFieldConfig {
  switch (role) {
    case 'stage':
      return {
        name: uniqueFieldName(t('settings.fields.new.stage'), fields),
        type: FieldType.SingleSelect,
        options: [
          { name: t('settings.fields.new.stage.1'), color: COLOR.blue },
          { name: t('settings.fields.new.stage.2'), color: COLOR.purple },
          { name: t('settings.fields.new.stage.3'), color: COLOR.cyan },
        ],
      };
    case 'status':
      return {
        name: uniqueFieldName(t('settings.fields.new.status'), fields),
        type: FieldType.SingleSelect,
        options: [
          { name: t('settings.fields.new.status.todo'), color: COLOR.grey },
          { name: t('settings.fields.new.status.doing'), color: COLOR.blue },
          { name: t('settings.fields.new.status.done'), color: COLOR.green },
          { name: t('settings.fields.new.status.blocked'), color: COLOR.red },
        ],
      };
    case 'enteredAt':
      return { name: uniqueFieldName(t('settings.fields.new.enteredAt'), fields), type: FieldType.DateTime };
    case 'history':
      return { name: uniqueFieldName(t('settings.fields.new.history'), fields), type: FieldType.Text };
  }
}

/** Draft after picking a (possibly just created) field for a role. */
function assignRole(draft: PipelineConfig, role: CreatableRole, id: string | undefined): PipelineConfig {
  switch (role) {
    case 'stage':
      // Nodes and edges belong to the old field's options.
      return {
        ...draft,
        stageFieldId: id,
        statusFieldId: draft.statusFieldId === id ? undefined : draft.statusFieldId,
        edges: null,
        nodes: {},
      };
    case 'status':
      return { ...draft, statusFieldId: id };
    case 'enteredAt':
      return { ...draft, enteredAtFieldId: id };
    case 'history':
      return { ...draft, historyFieldId: id };
  }
}

export interface FieldsTabProps extends TabProps {
  views: ViewInfo[];
  createField(cfg: AddFieldConfig): Promise<string | null>;
}

export function FieldsTab({ ctx, draft, update, views, createField }: FieldsTabProps) {
  const { t } = useI18n();
  const [creating, setCreating] = useState<CreatableRole | null>(null);

  const ofType = (type: FieldType, exclude?: string) => ctx.fields.filter((f) => f.type === type && f.id !== exclude);
  const primaryId = ctx.fields.find((f) => f.isPrimary)?.id;
  const gridViews = views.filter((v) => v.type === GRID_VIEW);
  const stageChanged = Boolean(ctx.config.stageFieldId) && draft.stageFieldId !== ctx.config.stageFieldId;

  /** Existing fields: normalize so status categories / entry statuses follow the new field. */
  const pick = (role: CreatableRole, id: string | undefined) =>
    update((d) => normalizeConfig(assignRole(d, role, id), ctx.fields));

  const create = async (role: CreatableRole) => {
    const cfg = newFieldConfig(role, t, ctx.fields);
    setCreating(role);
    const id = await createField(cfg);
    setCreating(null);
    if (!id) {
      Toast.error(t('settings.fields.createFailed'));
      return;
    }
    Toast.success(t('settings.fields.created', { name: cfg.name }));
    // Not normalized here: this render's field list does not contain the new field yet.
    update((d) => assignRole(d, role, id));
  };

  const createButton = (role: CreatableRole, value: string | undefined) =>
    !value || !ctx.fieldById.has(value) ? (
      <Button
        size="small"
        theme="borderless"
        icon={<IconPlus />}
        loading={creating === role}
        disabled={creating !== null && creating !== role}
        onClick={() => void create(role)}
      >
        {t('settings.fields.create')}
      </Button>
    ) : null;

  return (
    <div className="pv-set-tab">
      <p className="pv-set-intro">{t('settings.fields.intro')}</p>

      <SettingRow label={t('settings.fields.title.label')} hint={t('settings.fields.title.hint')}>
        <FieldSelect
          fields={ctx.fields}
          value={draft.titleFieldId ?? primaryId}
          onChange={(id) => update((d) => ({ ...d, titleFieldId: id }))}
        />
      </SettingRow>

      <SettingRow
        label={t('settings.fields.stage.label')}
        required
        hint={t('settings.fields.stage.hint')}
        extra={createButton('stage', draft.stageFieldId)}
      >
        <FieldSelect
          fields={ofType(FieldType.SingleSelect)}
          value={draft.stageFieldId}
          clearable
          onChange={(id) => pick('stage', id)}
        />
        {stageChanged && <Notice tone="warning">{t('settings.fields.stage.resetWarn')}</Notice>}
      </SettingRow>

      <SettingRow
        label={t('settings.fields.status.label')}
        hint={t('settings.fields.status.hint')}
        extra={createButton('status', draft.statusFieldId)}
      >
        <FieldSelect
          fields={ofType(FieldType.SingleSelect, draft.stageFieldId)}
          value={draft.statusFieldId}
          clearable
          placeholder={t('settings.none')}
          onChange={(id) => pick('status', id)}
        />
      </SettingRow>

      <SettingRow
        label={t('settings.fields.enteredAt.label')}
        hint={t('settings.fields.enteredAt.hint')}
        extra={createButton('enteredAt', draft.enteredAtFieldId)}
      >
        <FieldSelect
          fields={ofType(FieldType.DateTime)}
          value={draft.enteredAtFieldId}
          clearable
          placeholder={t('settings.none')}
          onChange={(id) => pick('enteredAt', id)}
        />
      </SettingRow>

      <SettingRow
        label={t('settings.fields.history.label')}
        hint={t('settings.fields.history.hint')}
        extra={createButton('history', draft.historyFieldId)}
      >
        <FieldSelect
          fields={ofType(FieldType.Text)}
          value={draft.historyFieldId}
          clearable
          placeholder={t('settings.none')}
          onChange={(id) => pick('history', id)}
        />
      </SettingRow>

      <SettingRow label={t('settings.fields.sourceView.label')} hint={t('settings.fields.sourceView.hint')}>
        <Select
          className="pv-set-select"
          value={draft.sourceViewId && gridViews.some((v) => v.id === draft.sourceViewId) ? draft.sourceViewId : ALL_RECORDS}
          optionList={[
            { value: ALL_RECORDS, label: t('settings.fields.sourceView.all') },
            ...gridViews.map((v) => ({ value: v.id, label: v.name })),
          ]}
          onChange={(value) =>
            update((d) => ({ ...d, sourceViewId: typeof value === 'string' && value !== ALL_RECORDS ? value : undefined }))
          }
        />
      </SettingRow>
    </div>
  );
}
