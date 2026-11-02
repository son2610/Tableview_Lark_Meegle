import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { cellToText, getSelectId } from '../core/cell';
import { getStatusCategory } from '../core/state';
import type { FieldMeta, PipelineContextValue, RecordData } from '../types';
import { useI18n } from '../i18n';
import { OptionTag, StatusDot } from './OptionTag';
import './RecordList.css';

export interface RecordListProps {
  ctx: PipelineContextValue;
  /** Already filtered / sorted by App. */
  records: RecordData[];
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
}

const PAGE = 200;

function RecordRow(props: {
  ctx: PipelineContextValue;
  record: RecordData;
  listFields: FieldMeta[];
  selected: boolean;
  onSelect: (recordId: string) => void;
}): JSX.Element {
  const { ctx, record, listFields, selected, onSelect } = props;
  const { t, lang } = useI18n();
  const { config, fieldById, graph, stageField, statusField, optionColors } = ctx;

  const titleField = config.titleFieldId ? fieldById.get(config.titleFieldId) : undefined;
  const title = (titleField ? cellToText(titleField, record.fields[titleField.id], lang) : '').trim();

  let stage: JSX.Element;
  const stageValue = stageField ? record.fields[stageField.id] : undefined;
  const stageId = getSelectId(stageValue);
  const node = stageId ? graph.nodeById.get(stageId) : undefined;
  if (node) {
    stage = <OptionTag option={node} colors={optionColors} size="small" />;
  } else if (stageId || (stageField && cellToText(stageField, stageValue, lang).trim())) {
    // A value that is not a node any more (option deleted / renamed elsewhere).
    const text = (stageField ? cellToText(stageField, stageValue, lang).trim() : '') || stageId || '';
    stage = (
      <span className="pv-rl-tag pv-rl-tag--warning" title={t('detail.list.unknownStage', { name: text })}>
        {text}
      </span>
    );
  } else {
    stage = <span className="pv-rl-tag pv-rl-tag--muted">{t('detail.list.notStarted')}</span>;
  }

  const statusId = statusField ? getSelectId(record.fields[statusField.id]) : null;
  const statusOption = statusId ? statusField?.options?.find((o) => o.id === statusId) : undefined;
  const statusName =
    statusOption?.name ?? (statusField && statusId ? cellToText(statusField, record.fields[statusField.id], lang) : '');

  const extras = listFields
    .map((f) => ({ field: f, text: cellToText(f, record.fields[f.id], lang).trim() }))
    .filter((x) => x.text);

  return (
    <button
      type="button"
      className={selected ? 'pv-rl-row is-selected' : 'pv-rl-row'}
      aria-current={selected ? 'true' : undefined}
      data-record-id={record.id}
      onClick={() => onSelect(record.id)}
    >
      <span className={title ? 'pv-rl-title' : 'pv-rl-title is-untitled'} title={title || undefined}>
        {title || t('detail.untitled')}
      </span>
      <span className="pv-rl-meta">
        {stage}
        {statusName ? (
          <span className="pv-rl-status" title={statusName}>
            <StatusDot category={getStatusCategory(config, statusId)} />
            <span className="pv-rl-status__text">{statusName}</span>
          </span>
        ) : null}
      </span>
      {extras.length > 0 ? (
        <span className="pv-rl-extra" title={extras.map((x) => `${x.field.name}: ${x.text}`).join('\n')}>
          {extras.map((x) => x.text).join(' · ')}
        </span>
      ) : null}
    </button>
  );
}

/** Left-hand list of records with stage tag, status and configured extra fields. */
export function RecordList(props: RecordListProps): JSX.Element {
  const { ctx, records, selectedRecordId, onSelect } = props;
  const { t } = useI18n();
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLDivElement>(null);

  const listFields = ctx.config.listFieldIds.map((id) => ctx.fieldById.get(id)).filter((f): f is FieldMeta => !!f);

  // Make sure the selected record is rendered even when it is beyond the current page.
  const selectedIndex = selectedRecordId ? records.findIndex((r) => r.id === selectedRecordId) : -1;
  const shownCount = Math.max(limit, selectedIndex + 1);
  const shown = records.slice(0, shownCount);

  useEffect(() => {
    if (!selectedRecordId || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(selectedRecordId)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedRecordId]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.pv-rl-row') ?? []);
    const index = rows.findIndex((r) => r === document.activeElement);
    if (index < 0) return;
    const next = rows[index + (e.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
    const id = next.dataset.recordId;
    if (id) onSelect(id);
  };

  return (
    <div className="pv-record-list">
      <div className="pv-rl-header">
        <span className="pv-rl-header__title">{t('detail.list.title')}</span>
        <span className="pv-rl-header__count">{records.length}</span>
      </div>
      <div className="pv-rl-scroll" ref={listRef} onKeyDown={onKeyDown}>
        {records.length === 0 ? (
          <div className="pv-rl-empty">{t('detail.list.empty')}</div>
        ) : (
          shown.map((r) => (
            <RecordRow
              key={r.id}
              ctx={ctx}
              record={r}
              listFields={listFields}
              selected={r.id === selectedRecordId}
              onSelect={onSelect}
            />
          ))
        )}
        {records.length > shown.length ? (
          <div className="pv-rl-more">
            <Button theme="borderless" type="tertiary" size="small" onClick={() => setLimit(shownCount + PAGE)}>
              {t('detail.list.showMore', { count: records.length - shown.length })}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
