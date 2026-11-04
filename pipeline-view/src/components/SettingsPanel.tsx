import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, SideSheet, TabPane, Tabs, Toast } from '@douyinfe/semi-ui';
import { IconAlertCircle } from '@douyinfe/semi-icons';
import type { AddFieldConfig } from '../sdk/adapter';
import { FieldType } from '../types';
import type { ActionResult, PipelineConfig, PipelineContextValue, ViewInfo } from '../types';
import { isConfigured } from '../core/config';
import { findCycle } from '../core/graph';
import { useI18n } from '../i18n';
import { FieldsTab } from './settings/FieldsTab';
import { PipelineTab } from './settings/PipelineTab';
import { StatusesTab } from './settings/StatusesTab';
import { DisplayTab } from './settings/DisplayTab';
import type { DraftUpdater } from './settings/shared';
import './SettingsPanel.css';

export interface SettingsPanelProps {
  visible: boolean;
  ctx: PipelineContextValue;
  views: ViewInfo[];
  onClose(): void;
  saveConfig(next: PipelineConfig): Promise<ActionResult>;
  createField(cfg: AddFieldConfig): Promise<string | null>;
  addStageOption(name: string, fieldId?: string): Promise<string | null>;
  addSelectOptions(fieldId: string, options: { name: string; color?: number }[]): Promise<(string | null)[]>;
}

type TabKey = 'fields' | 'pipeline' | 'statuses' | 'display';

const SHEET_WIDTH = 760;

/** Config is plain JSON, so a JSON round-trip is a faithful deep copy. */
function cloneConfig(config: PipelineConfig): PipelineConfig {
  return JSON.parse(JSON.stringify(config)) as PipelineConfig;
}

function sheetWidth(): number {
  return typeof window === 'undefined' ? SHEET_WIDTH : Math.min(SHEET_WIDTH, window.innerWidth);
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { visible, ctx, onClose } = props;
  const { t } = useI18n();
  const [draft, setDraft] = useState<PipelineConfig>(() => cloneConfig(ctx.config));
  const [tab, setTab] = useState<TabKey>('fields');
  const [saving, setSaving] = useState(false);

  // Each opening starts from the config in effect; later config changes do not clobber the draft.
  useEffect(() => {
    if (!visible) return;
    setDraft(cloneConfig(ctx.config));
    setTab(isConfigured(ctx.config, ctx.fields) ? 'pipeline' : 'fields');
  }, [visible]);

  const update = useCallback<DraftUpdater>((fn) => setDraft((d) => fn(d)), []);

  const stageField = draft.stageFieldId ? ctx.fieldById.get(draft.stageFieldId) : undefined;
  const stageOk = stageField?.type === FieldType.SingleSelect;
  const cycle = useMemo(
    () => (stageField && draft.edges ? findCycle((stageField.options ?? []).map((o) => o.id), draft.edges) : null),
    [stageField, draft.edges],
  );

  let error: string | null = null;
  if (!stageOk) error = t('settings.error.noStage');
  else if (cycle) {
    const names = cycle.concat(cycle.slice(0, 1)).map((id) => stageField?.options?.find((o) => o.id === id)?.name ?? id);
    error = t('settings.error.cycle', { path: names.join(' → ') });
  }

  const save = async () => {
    if (error || saving) return;
    setSaving(true);
    const result = await props.saveConfig(draft);
    setSaving(false);
    if (result.ok) {
      Toast.success(t('settings.saved'));
      onClose();
    } else {
      Toast.error(result.error ?? t('common.error.unknown'));
    }
  };

  const tabLabel = (key: TabKey, hasError: boolean) => (
    <span className="pv-settings__tab">
      {t(`settings.tab.${key}`)}
      {hasError && <span className="pv-settings__tab-dot" aria-hidden />}
    </span>
  );

  const footer = (
    <div className="pv-settings__footer">
      <span className="pv-settings__error" role={error ? 'alert' : undefined}>
        {error && (
          <>
            <IconAlertCircle size="small" />
            <span>{error}</span>
          </>
        )}
      </span>
      <Button theme="light" type="tertiary" onClick={onClose} disabled={saving}>
        {t('common.cancel')}
      </Button>
      <Button theme="solid" type="primary" onClick={() => void save()} loading={saving} disabled={Boolean(error)}>
        {t('common.save')}
      </Button>
    </div>
  );

  return (
    <SideSheet
      visible={visible}
      onCancel={onClose}
      title={t('settings.title')}
      width={sheetWidth()}
      footer={footer}
      className="pv-settings"
      bodyStyle={{ padding: 0 }}
      maskClosable={!saving}
      closeOnEsc={!saving}
    >
      <Tabs type="line" activeKey={tab} onChange={(key) => setTab(key as TabKey)} className="pv-settings__tabs" lazyRender>
        <TabPane itemKey="fields" tab={tabLabel('fields', !stageOk)}>
          <FieldsTab
            ctx={ctx}
            draft={draft}
            update={update}
            views={props.views}
            createField={props.createField}
            addSelectOptions={props.addSelectOptions}
          />
        </TabPane>
        <TabPane itemKey="pipeline" tab={tabLabel('pipeline', Boolean(cycle))}>
          <PipelineTab ctx={ctx} draft={draft} update={update} addStageOption={props.addStageOption} cycle={cycle} />
        </TabPane>
        <TabPane itemKey="statuses" tab={tabLabel('statuses', false)}>
          <StatusesTab ctx={ctx} draft={draft} update={update} />
        </TabPane>
        <TabPane itemKey="display" tab={tabLabel('display', false)}>
          <DisplayTab ctx={ctx} draft={draft} update={update} />
        </TabPane>
      </Tabs>
    </SideSheet>
  );
}
