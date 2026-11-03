import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, Button, LocaleProvider, Select, Spin } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import viVN from '@douyinfe/semi-ui/lib/es/locale/source/vi_VN';
import enUS from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import type { BaseAdapter } from '../sdk/adapter';
import type { PipelineContextValue, RecordData, RecordNodeStates } from '../types';
import { usePipelineData } from '../hooks/usePipelineData';
import type { PipelineData } from '../hooks/usePipelineData';
import { I18nProvider, useI18n } from '../i18n';
import { applyTheme } from '../theme';
import { cellToText, getSelectId } from '../core/cell';
import { computeNodeStates } from '../core/state';
import { Toolbar, STAGE_FINISHED, STAGE_NONE } from './Toolbar';
import type { StageFilter } from './Toolbar';
import { EmptyState } from './EmptyState';
import { SettingsPanel } from './SettingsPanel';
import { Overview } from './Overview';
import { RecordList } from './RecordList';
import { RecordDetail } from './RecordDetail';
import './App.css';

export interface AppProps {
  adapter: BaseAdapter;
}

const NARROW_QUERY = '(max-width: 719px)';
const PICKER_OVERVIEW = '__overview__';

/** Lower-case, strip diacritics (incl. Vietnamese đ) so "tiến độ" matches "tien do". */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Display title of a record: configured title field, else the primary field. */
export function recordTitle(ctx: PipelineContextValue, record: RecordData): string {
  const fieldId = ctx.config.titleFieldId ?? ctx.fields.find((f) => f.isPrimary)?.id;
  if (!fieldId) return '';
  return cellToText(ctx.fieldById.get(fieldId), record.fields[fieldId], ctx.lang).trim();
}

export function matchesStage(states: RecordNodeStates | undefined, filter: StageFilter): boolean {
  if (filter === null) return true;
  if (!states) return false;
  if (filter === STAGE_NONE) return states.current === null;
  if (filter === STAGE_FINISHED) return states.finished;
  // A node lists every record at it, finished ones included (so each outcome of a branch can be listed).
  return states.current === filter;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode, sandboxed iframe); selection memory is a nicety.
  }
}

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => {
    try {
      return window.matchMedia(NARROW_QUERY).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(NARROW_QUERY);
    } catch {
      return;
    }
    const onChange = () => setNarrow(mql.matches);
    onChange();
    if ('addEventListener' in mql) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    (mql as MediaQueryList).addListener(onChange);
    return () => (mql as MediaQueryList).removeListener(onChange);
  }, []);
  return narrow;
}

export function App({ adapter }: AppProps) {
  const data = usePipelineData(adapter);
  const lang = data.ctx?.lang ?? data.lang;
  const theme = data.ctx?.theme;

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  return (
    <I18nProvider lang={lang}>
      <LocaleProvider locale={lang === 'vi' ? viVN : enUS}>
        <AppBody data={data} />
      </LocaleProvider>
    </I18nProvider>
  );
}

export default App;

function AppBody({ data }: { data: PipelineData }) {
  const { t } = useI18n();

  if (data.phase === 'loading') {
    return (
      <div className="pv-app pv-app--center">
        {/* The tip sits outside Spin: Semi sizes the tip to the 32px spinner and wraps every word. */}
        <div className="pv-app__loading" role="status">
          <Spin size="large" />
          <span className="pv-app__loading-tip">
            {data.loadedCount > 0 ? t('common.loadingRecords', { count: data.loadedCount }) : t('common.loading')}
          </span>
        </div>
      </div>
    );
  }

  if (data.phase === 'error' || !data.ctx) {
    return (
      <div className="pv-app pv-app--center">
        <div className="pv-app__error">
          <Banner
            type="danger"
            fullMode={false}
            bordered
            closeIcon={null}
            title={t('common.loadFailedTitle')}
            description={data.error ?? t('common.error.unknown')}
          />
          <Button theme="solid" type="primary" icon={<IconRefresh />} onClick={data.reload}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return <ReadyView data={data} ctx={data.ctx} />;
}

function ReadyView({ data, ctx }: { data: PipelineData; ctx: PipelineContextValue }) {
  const { t } = useI18n();
  const narrow = useIsNarrow();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<StageFilter>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const storageKey = `pv-selected-${ctx.viewId ?? ctx.table.id}`;
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(() => readStored(storageKey));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectRecord = useCallback((recordId: string | null) => {
    setSelectedRecordId(recordId);
    setSelectedNodeId(null);
  }, []);

  useEffect(() => writeStored(storageKey, selectedRecordId), [storageKey, selectedRecordId]);

  // Drop selections / filters that point at things that no longer exist.
  useEffect(() => {
    if (selectedRecordId && !ctx.recordById.has(selectedRecordId)) selectRecord(null);
  }, [ctx.recordById, selectedRecordId, selectRecord]);
  useEffect(() => {
    if (stageFilter && stageFilter !== STAGE_NONE && stageFilter !== STAGE_FINISHED && !ctx.graph.nodeById.has(stageFilter)) {
      setStageFilter(null);
    }
  }, [ctx.graph, stageFilter]);
  useEffect(() => {
    if (statusFilter && !ctx.statusField?.options?.some((o) => o.id === statusFilter)) setStatusFilter(null);
  }, [ctx.statusField, statusFilter]);

  const statesById = useMemo(() => {
    const map = new Map<string, RecordNodeStates>();
    for (const record of ctx.records) map.set(record.id, computeNodeStates(ctx.graph, record, ctx.config, ctx.fieldById));
    return map;
  }, [ctx.records, ctx.graph, ctx.config, ctx.fieldById]);

  const searchIndex = useMemo(() => {
    const listFields = ctx.config.listFieldIds.map((id) => ctx.fieldById.get(id)).filter((f) => f !== undefined);
    const index = new Map<string, string>();
    for (const record of ctx.records) {
      const parts = [recordTitle(ctx, record)];
      for (const field of listFields) {
        if (field) parts.push(cellToText(field, record.fields[field.id], ctx.lang));
      }
      index.set(record.id, foldText(parts.join(' \n ')));
    }
    return index;
    // recordTitle reads config/fields/lang through ctx; those are listed explicitly.
  }, [ctx.records, ctx.config, ctx.fields, ctx.fieldById, ctx.lang]);

  const terms = useMemo(() => foldText(search).split(/\s+/).filter(Boolean), [search]);
  const statusFieldId = ctx.statusField?.id;

  /** Records after search + status filter (what the overview counts). */
  const baseRecords = useMemo(() => {
    if (terms.length === 0 && !statusFilter) return ctx.records;
    return ctx.records.filter((record) => {
      if (statusFilter && (!statusFieldId || getSelectId(record.fields[statusFieldId]) !== statusFilter)) return false;
      if (terms.length === 0) return true;
      const text = searchIndex.get(record.id) ?? '';
      return terms.every((term) => text.includes(term));
    });
  }, [ctx.records, terms, statusFilter, statusFieldId, searchIndex]);

  const listRecords = useMemo(
    () => (stageFilter === null ? baseRecords : baseRecords.filter((r) => matchesStage(statesById.get(r.id), stageFilter))),
    [baseRecords, stageFilter, statesById],
  );

  const selectedRecord = selectedRecordId ? ctx.recordById.get(selectedRecordId) : undefined;
  const ready = data.configured && data.hasSavedConfig;
  // The narrow picker must always contain the open record, even when the filters hide it.
  const pickerRecords =
    selectedRecord && !listRecords.includes(selectedRecord) ? [selectedRecord, ...listRecords] : listRecords;

  const settings = ctx.editable ? (
    <SettingsPanel
      visible={settingsOpen}
      ctx={ctx}
      views={data.views}
      onClose={() => setSettingsOpen(false)}
      saveConfig={data.saveConfig}
      createField={data.createField}
      addStageOption={data.addStageOption}
    />
  ) : null;

  if (!ready) {
    return (
      <div className="pv-app pv-app--onboarding">
        <EmptyState editable={ctx.editable} onSetup={() => setSettingsOpen(true)} />
        {settings}
      </div>
    );
  }

  const detail = selectedRecord ? (
    <RecordDetail
      key={selectedRecord.id}
      ctx={ctx}
      actions={data.actions}
      record={selectedRecord}
      selectedNodeId={selectedNodeId}
      onSelectNode={setSelectedNodeId}
    />
  ) : (
    <Overview
      ctx={ctx}
      records={baseRecords}
      statesById={statesById}
      filtered={terms.length > 0 || statusFilter !== null}
      stageFilter={stageFilter}
      onStageFilter={setStageFilter}
    />
  );

  return (
    <div className={`pv-app${narrow ? ' pv-app--narrow' : ''}`}>
      <Toolbar
        ctx={ctx}
        shownCount={listRecords.length}
        search={search}
        onSearchChange={setSearch}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        overviewActive={!selectedRecord}
        onOverview={() => selectRecord(null)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {narrow ? (
        <div className="pv-app__stack">
          <div className="pv-app__picker">
            <Select
              value={selectedRecord ? selectedRecord.id : PICKER_OVERVIEW}
              onChange={(value) => selectRecord(value === PICKER_OVERVIEW || typeof value !== 'string' ? null : value)}
              filter
              style={{ width: '100%' }}
              placeholder={t('common.selectRecord')}
              emptyContent={t('common.noMatch')}
              virtualize={pickerRecords.length > 200 ? { height: 320, width: '100%', itemSize: 36 } : undefined}
              optionList={[
                { value: PICKER_OVERVIEW, label: t('common.overview') },
                ...pickerRecords.map((record) => ({ value: record.id, label: recordTitle(ctx, record) || t('common.untitled') })),
              ]}
            />
          </div>
          <div className="pv-app__main">{detail}</div>
        </div>
      ) : (
        <div className="pv-app__body">
          <aside className="pv-app__list">
            <RecordList ctx={ctx} records={listRecords} selectedRecordId={selectedRecord?.id ?? null} onSelect={selectRecord} />
          </aside>
          <main className="pv-app__main">{detail}</main>
        </div>
      )}
      {settings}
    </div>
  );
}
