import { FieldType } from '../../types';
import { useI18n } from '../../i18n';
import { FieldMultiSelect, SettingRow } from './shared';
import type { TabProps } from './shared';

export function DisplayTab({ ctx, draft, update }: TabProps) {
  const { t } = useI18n();
  const userFields = ctx.fields.filter((f) => f.type === FieldType.User);
  const checkboxFields = ctx.fields.filter((f) => f.type === FieldType.Checkbox);
  const titleId = draft.titleFieldId ?? ctx.fields.find((f) => f.isPrimary)?.id;
  const listCandidates = ctx.fields.filter((f) => f.id !== titleId);

  return (
    <div className="pv-set-tab">
      <p className="pv-set-intro">{t('settings.display.intro')}</p>

      <SettingRow label={t('settings.display.roles.label')} hint={t('settings.display.roles.hint')}>
        <FieldMultiSelect
          fields={userFields}
          value={draft.roleFieldIds}
          placeholder={t('settings.display.placeholder')}
          onChange={(ids) => update((d) => ({ ...d, roleFieldIds: ids }))}
        />
      </SettingRow>

      <SettingRow label={t('settings.display.checklist.label')} hint={t('settings.display.checklist.hint')}>
        <FieldMultiSelect
          fields={checkboxFields}
          value={draft.checklistFieldIds}
          placeholder={t('settings.display.placeholder')}
          onChange={(ids) => update((d) => ({ ...d, checklistFieldIds: ids }))}
        />
      </SettingRow>

      <SettingRow label={t('settings.display.list.label')} hint={t('settings.display.list.hint')}>
        <FieldMultiSelect
          fields={listCandidates}
          value={draft.listFieldIds}
          placeholder={t('settings.display.placeholder')}
          onChange={(ids) => update((d) => ({ ...d, listFieldIds: ids }))}
        />
      </SettingRow>
    </div>
  );
}
