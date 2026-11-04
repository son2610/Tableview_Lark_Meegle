import { useState } from 'react';
import { Button, Select, Toast } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import type { AddFieldConfig } from '../../sdk/adapter';
import { FieldType } from '../../types';
import type { FieldMeta, PipelineConfig, SelectOption, ViewInfo } from '../../types';
import { normalizeConfig } from '../../core/config';
import { pathKey } from '../../core/path';
import { useI18n } from '../../i18n';
import type { TFunc } from '../../i18n';
import { FieldSelect, Notice, SettingRow, uniqueFieldName } from './shared';
import type { TabProps } from './shared';

type CreatableRole = 'stage' | 'status' | 'enteredAt' | 'history' | 'path';

const GRID_VIEW = 1;
const ALL_RECORDS = '__all__';

/**
 * Colour ids follow Lark's palette order (0 blue, 1 cyan, 2 green, 3 yellow, 4 orange,
 * 5 red, 6 pink, 7 purple, 8 indigo, 9 grey).
 */
const COLOR = { blue: 0, cyan: 1, green: 2, orange: 4, red: 5, purple: 7, grey: 9 } as const;

/**
 * Field to create for a role. The "Steps passed" field gets one option per stage option
 * (`stageOptions`, same names and colours, in option order).
 */
export function newFieldConfig(
  role: CreatableRole,
  t: TFunc,
  fields: FieldMeta[],
  stageOptions: SelectOption[] = [],
): AddFieldConfig {
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
    case 'path':
      return {
        name: uniqueFieldName(t('settings.fields.new.path'), fields),
        type: FieldType.MultiSelect,
        options: uniqueByName(stageOptions).map((o) => ({ name: o.name.trim(), color: o.color })),
      };
  }
}

/** Options with a non-empty name, first one per name key (option names must be unique in a field). */
function uniqueByName(options: SelectOption[]): SelectOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = pathKey(o.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Stage options that have no option of the same name (trimmed, NFC) in the path field. */
export function missingPathOptions(stageOptions: SelectOption[], pathField: FieldMeta | undefined): SelectOption[] {
  if (!pathField) return [];
  const have = new Set((pathField.options ?? []).map((o) => pathKey(o.name)));
  return uniqueByName(stageOptions).filter((o) => !have.has(pathKey(o.name)));
}

/**
 * Draft after picking a (possibly just created) field for a role. `saved` is the stored
 * config: switching the stage field back to the saved one restores its node rules and edges.
 */
function assignRole(draft: PipelineConfig, role: CreatableRole, id: string | undefined, saved: PipelineConfig): PipelineConfig {
  switch (role) {
    case 'stage': {
      if (id === draft.stageFieldId) return draft;
      // Nodes and edges belong to the stage field's options.
      const restore = id !== undefined && id === saved.stageFieldId;
      return {
        ...draft,
        stageFieldId: id,
        statusFieldId: draft.statusFieldId === id ? undefined : draft.statusFieldId,
        edges: restore ? saved.edges : null,
        nodes: restore ? saved.nodes : {},
      };
    }
    case 'status':
      return { ...draft, statusFieldId: id };
    case 'enteredAt':
      return { ...draft, enteredAtFieldId: id };
    case 'history':
      return { ...draft, historyFieldId: id };
    case 'path':
      return { ...draft, pathFieldId: id };
  }
}

export interface FieldsTabProps extends TabProps {
  views: ViewInfo[];
  createField(cfg: AddFieldConfig): Promise<string | null>;
  /** New option ids in input order, null where adding failed. */
  addSelectOptions(fieldId: string, options: { name: string; color?: number }[]): Promise<(string | null)[]>;
}

export function FieldsTab({ ctx, draft, update, views, createField, addSelectOptions }: FieldsTabProps) {
  const { t } = useI18n();
  const [creating, setCreating] = useState<CreatableRole | null>(null);
  const [addingOptions, setAddingOptions] = useState(false);

  const ofType = (type: FieldType, exclude?: string) => ctx.fields.filter((f) => f.type === type && f.id !== exclude);
  const primaryId = ctx.fields.find((f) => f.isPrimary)?.id;
  const gridViews = views.filter((v) => v.type === GRID_VIEW);
  const stageChanged = Boolean(ctx.config.stageFieldId) && draft.stageFieldId !== ctx.config.stageFieldId;
  const stageOptions = (draft.stageFieldId ? ctx.fieldById.get(draft.stageFieldId)?.options : undefined) ?? [];
  const pathField = draft.pathFieldId ? ctx.fieldById.get(draft.pathFieldId) : undefined;
  const missingSteps = pathField?.type === FieldType.MultiSelect ? missingPathOptions(stageOptions, pathField) : [];

  /** Existing fields: normalize so status categories / entry statuses follow the new field. */
  const pick = (role: CreatableRole, id: string | undefined) =>
    update((d) => normalizeConfig(assignRole(d, role, id, ctx.config), ctx.fields));

  const create = async (role: CreatableRole) => {
    const cfg = newFieldConfig(role, t, ctx.fields, stageOptions);
    setCreating(role);
    const id = await createField(cfg);
    setCreating(null);
    if (!id) {
      Toast.error(t('settings.fields.createFailed'));
      return;
    }
    Toast.success(t('settings.fields.created', { name: cfg.name }));
    // Not normalized here: this render's field list does not contain the new field yet.
    update((d) => assignRole(d, role, id, ctx.config));
  };

  const addMissingSteps = async () => {
    if (!pathField || missingSteps.length === 0 || addingOptions) return;
    setAddingOptions(true);
    const ids = await addSelectOptions(
      pathField.id,
      missingSteps.map((o) => ({ name: o.name.trim(), color: o.color })),
    );
    setAddingOptions(false);
    const added = ids.filter((id) => id !== null).length;
    if (added === 0) Toast.error(t('settings.fields.path.addFailed'));
    else if (added < ids.length) Toast.warning(t('settings.fields.path.added', { count: added }));
    else Toast.success(t('settings.fields.path.added', { count: added }));
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

      <SettingRow
        label={t('settings.fields.path.label')}
        hint={t('settings.fields.path.hint')}
        extra={createButton('path', draft.pathFieldId)}
      >
        <FieldSelect
          fields={ofType(FieldType.MultiSelect)}
          value={draft.pathFieldId}
          clearable
          placeholder={t('settings.none')}
          onChange={(id) => pick('path', id)}
        />
        {missingSteps.length > 0 && (
          <Notice tone="warning">
            <div className="pv-set-notice__row">
              <span>
                {t('settings.fields.path.missing', {
                  count: missingSteps.length,
                  names: missingSteps.map((o) => o.name.trim()).join(', '),
                })}
              </span>
              <Button size="small" theme="light" loading={addingOptions} onClick={() => void addMissingSteps()}>
                {t('settings.fields.path.addMissing')}
              </Button>
            </div>
          </Notice>
        )}
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
