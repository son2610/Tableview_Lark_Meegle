import { Select, Switch } from '@douyinfe/semi-ui';
import type { SelectOption, StatusCategory } from '../../types';
import { guessStatusCategory } from '../../core/config';
import { useI18n } from '../../i18n';
import { OptionTag, StatusDot } from '../OptionTag';
import { Notice, SettingRow, fieldOf } from './shared';
import type { TabProps } from './shared';

const CATEGORIES: StatusCategory[] = ['todo', 'doing', 'done', 'blocked'];

function isCategory(value: unknown): value is StatusCategory {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value);
}

function SwitchRow(props: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange(checked: boolean): void }) {
  return (
    <label className={`pv-set-switch${props.disabled ? ' is-disabled' : ''}`}>
      <span className="pv-set-switch__text">
        <span className="pv-set-switch__label">{props.label}</span>
        <span className="pv-set-row__hint">{props.hint}</span>
      </span>
      <Switch checked={props.checked} disabled={props.disabled} onChange={(checked) => props.onChange(checked)} />
    </label>
  );
}

export function StatusesTab({ ctx, draft, update }: TabProps) {
  const { t } = useI18n();
  const statusField = fieldOf(ctx, draft.statusFieldId);
  const options = statusField?.options ?? [];
  const categoryOf = (o: SelectOption): StatusCategory => draft.statusCategories[o.id] ?? guessStatusCategory(o.name);
  const effectiveDefault =
    options.find((o) => o.id === draft.defaultEntryStatusId) ?? options.find((o) => categoryOf(o) === 'todo') ?? options[0];

  const categoryOptions = CATEGORIES.map((category) => ({
    value: category,
    label: (
      <span className="pv-set-category">
        <StatusDot category={category} size={8} />
        {t(`settings.statuses.cat.${category}`)}
      </span>
    ),
  }));

  return (
    <div className="pv-set-tab">
      {!statusField ? (
        <Notice tone="info">{t('settings.statuses.noField')}</Notice>
      ) : (
        <>
          <p className="pv-set-intro">{t('settings.statuses.intro')}</p>
          {options.length === 0 ? (
            <Notice tone="warning">{t('settings.statuses.noOptions')}</Notice>
          ) : (
            <div className="pv-set-table" role="table">
              <div className="pv-set-table__row pv-set-table__row--head" role="row">
                <span role="columnheader">{t('settings.statuses.option')}</span>
                <span role="columnheader">{t('settings.statuses.category')}</span>
              </div>
              {options.map((option) => (
                <div key={option.id} className="pv-set-table__row" role="row">
                  <span role="cell" className="pv-set-table__cell">
                    <OptionTag option={option} colors={ctx.optionColors} />
                  </span>
                  <span role="cell" className="pv-set-table__cell">
                    <Select
                      className="pv-set-select"
                      value={categoryOf(option)}
                      optionList={categoryOptions}
                      onChange={(value) => {
                        if (!isCategory(value)) return;
                        update((d) => ({ ...d, statusCategories: { ...d.statusCategories, [option.id]: value } }));
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}

          <SettingRow label={t('settings.statuses.defaultEntry.label')} hint={t('settings.statuses.defaultEntry.hint')}>
            <Select
              className="pv-set-select"
              value={effectiveDefault?.id}
              disabled={options.length === 0}
              optionList={options.map((o) => ({ value: o.id, label: <OptionTag option={o} colors={ctx.optionColors} size="small" /> }))}
              onChange={(value) => update((d) => ({ ...d, defaultEntryStatusId: typeof value === 'string' ? value : undefined }))}
            />
          </SettingRow>
        </>
      )}

      <div className="pv-set-switches">
        <SwitchRow
          label={t('settings.statuses.requireDone.label')}
          hint={t('settings.statuses.requireDone.hint')}
          checked={draft.requireDoneToAdvance}
          disabled={!statusField}
          onChange={(checked) => update((d) => ({ ...d, requireDoneToAdvance: checked }))}
        />
        <SwitchRow
          label={t('settings.statuses.allowRollback.label')}
          hint={t('settings.statuses.allowRollback.hint')}
          checked={draft.allowRollback}
          onChange={(checked) => update((d) => ({ ...d, allowRollback: checked }))}
        />
      </div>
    </div>
  );
}
