import type { ReactNode } from 'react';
import { Select } from '@douyinfe/semi-ui';
import type { FieldMeta, NodeConfig, PipelineConfig, PipelineContextValue } from '../../types';
import { useI18n } from '../../i18n';
import './settings.css';

export type DraftUpdater = (fn: (draft: PipelineConfig) => PipelineConfig) => void;

/** Props shared by every settings tab: they all edit the same local draft. */
export interface TabProps {
  ctx: PipelineContextValue;
  draft: PipelineConfig;
  update: DraftUpdater;
}

export const EMPTY_NODE: NodeConfig = { fields: [] };

export function fieldOf(ctx: PipelineContextValue, id: string | undefined): FieldMeta | undefined {
  return id ? ctx.fieldById.get(id) : undefined;
}

/** `base`, or `base 2`, `base 3`… so a created field never collides with an existing name. */
export function uniqueFieldName(base: string, fields: FieldMeta[]): string {
  const taken = new Set(fields.map((f) => f.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * New multi-select value merged into an existing ordered list: kept ids stay in their current
 * order (the user may have reordered them), newly picked ids are appended.
 */
export function mergeOrdered(current: string[], picked: string[]): string[] {
  const pickedSet = new Set(picked);
  const kept = current.filter((id) => pickedSet.has(id));
  const keptSet = new Set(kept);
  return kept.concat(picked.filter((id) => !keptSet.has(id)));
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function SettingRow(props: { label: ReactNode; hint?: ReactNode; required?: boolean; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="pv-set-row">
      <div className="pv-set-row__head">
        <span className="pv-set-row__label">
          {props.label}
          {props.required && <span className="pv-set-row__required">*</span>}
        </span>
        {props.extra}
      </div>
      <div className="pv-set-row__control">{props.children}</div>
      {props.hint && <div className="pv-set-row__hint">{props.hint}</div>}
    </div>
  );
}

export function Notice(props: { children: ReactNode; tone?: 'info' | 'warning' | 'danger' }) {
  return <div className={`pv-set-notice pv-set-notice--${props.tone ?? 'info'}`}>{props.children}</div>;
}

/** Single field picker; the value is cleared to undefined. */
export function FieldSelect(props: {
  fields: FieldMeta[];
  value: string | undefined;
  onChange(id: string | undefined): void;
  clearable?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const known = props.value !== undefined && props.fields.some((f) => f.id === props.value);
  return (
    <Select
      className="pv-set-select"
      value={known ? props.value : undefined}
      optionList={props.fields.map((f) => ({ value: f.id, label: f.name }))}
      onChange={(value) => props.onChange(typeof value === 'string' ? value : undefined)}
      onClear={() => props.onChange(undefined)}
      showClear={props.clearable}
      filter
      disabled={props.disabled}
      placeholder={props.placeholder ?? t('settings.selectField')}
      emptyContent={t('settings.noFieldsOfType')}
    />
  );
}

/** Multi field picker that preserves the existing order of `value`. */
export function FieldMultiSelect(props: {
  fields: FieldMeta[];
  value: string[];
  onChange(ids: string[]): void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const ids = new Set(props.fields.map((f) => f.id));
  return (
    <Select
      className="pv-set-select"
      multiple
      filter
      maxTagCount={6}
      value={props.value.filter((id) => ids.has(id))}
      optionList={props.fields.map((f) => ({ value: f.id, label: f.name }))}
      onChange={(value) => props.onChange(mergeOrdered(props.value, toStringArray(value)))}
      placeholder={props.placeholder ?? t('settings.selectField')}
      emptyContent={t('settings.noFieldsOfType')}
    />
  );
}
