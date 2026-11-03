import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button, Checkbox, DatePicker, Input, InputNumber, Select, TextArea } from '@douyinfe/semi-ui';
import { IconCheckboxTick, IconEdit2Stroked, IconFile, IconLink, IconSetting } from '@douyinfe/semi-icons';
import {
  cellToText,
  getMultiSelectIds,
  getSelectId,
  getUsers,
  hasRichText,
  isComputedField,
  isEditableInline,
  makeSelectValue,
  makeUrlValue,
  segmentsToText,
  textToSegments,
} from '../core/cell';
import { FieldType } from '../types';
import type { CellValue, FieldMeta, OptionColor, SelectOption } from '../types';
import { useI18n } from '../i18n';
import { OptionTag } from './OptionTag';
import './FieldEditor.css';

export interface FieldEditorProps {
  field: FieldMeta;
  value: CellValue;
  editable: boolean;
  invalid?: boolean;
  optionColors: OptionColor[];
  /** Called on blur / select / toggle, only when the value changed. */
  onCommit: (value: CellValue) => void;
  /** For types without an inline editor. */
  onOpenHostEditor: () => void;
}

function cls(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface UserLike {
  id: string;
  name: string;
}

/** "Nguyễn Văn An" -> "NA", "Alice" -> "A", "" -> "?". */
export function userInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const initial = (w: string) => Array.from(w)[0] ?? '';
  const first = initial(words[0]);
  const last = words.length > 1 ? initial(words[words.length - 1]) : '';
  return (first + last).toUpperCase();
}

const AVATAR_TONES = 5;

function avatarTone(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % AVATAR_TONES;
}

export function UserAvatar(props: { user: UserLike; size?: number }): JSX.Element {
  const { user, size = 20 } = props;
  return (
    <span
      className={`pv-avatar pv-avatar--t${avatarTone(user.id || user.name)}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      aria-hidden
    >
      {userInitials(user.name)}
    </span>
  );
}

/** Overlapping avatars (initials), "+n" when there are more than `max`. */
export function AvatarStack(props: { users: UserLike[]; max?: number; size?: number }): JSX.Element {
  const { users, max = 3, size = 20 } = props;
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="pv-avatar-stack">
      {shown.map((u) => (
        <UserAvatar key={u.id || u.name} user={u} size={size} />
      ))}
      {rest > 0 ? (
        <span className="pv-avatar pv-avatar--more" style={{ height: size, minWidth: size, fontSize: 10 }} aria-hidden>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** Avatar + name chips. */
export function UserChips(props: { users: UserLike[] }): JSX.Element {
  return (
    <span className="pv-user-chips">
      {props.users.map((u) => (
        <span key={u.id || u.name} className="pv-user-chip" title={u.name}>
          <UserAvatar user={u} size={18} />
          <span className="pv-user-chip__name">{u.name}</span>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only rendering                                                 */
/* ------------------------------------------------------------------ */

const USER_TYPES = new Set<FieldType>([FieldType.User, FieldType.CreatedUser, FieldType.ModifiedUser]);

function rawSelectItems(value: CellValue): { id: string; text: string }[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const out: { id: string; text: string }[] = [];
  for (const item of items) {
    if (item && typeof item === 'object' && 'id' in item) {
      const { id, text } = item as { id?: unknown; text?: unknown };
      if (typeof id === 'string') out.push({ id, text: typeof text === 'string' ? text : id });
    }
  }
  return out;
}

function attachmentNames(value: CellValue): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a) => (a && typeof a === 'object' && 'name' in a ? String((a as { name: unknown }).name ?? '') : ''))
    .filter(Boolean);
}

/** Link of a Url cell (first segment's link, else its text). */
function urlOf(value: CellValue): string {
  if (Array.isArray(value) && value.length > 0) {
    const seg = value[0] as { link?: unknown; text?: unknown } | null;
    if (seg && typeof seg.link === 'string' && seg.link) return seg.link;
  }
  return segmentsToText(value);
}

const SAFE_LINK = /^(https?:|mailto:)/i;

function Empty(): JSX.Element {
  return <span className="pv-fe-empty">—</span>;
}

/** Read-only rendering of any cell value in a style that suits its type. */
export function CellDisplay(props: { field: FieldMeta; value: CellValue; optionColors: OptionColor[] }): JSX.Element {
  const { field, value, optionColors } = props;
  const { t, lang } = useI18n();
  const options = field.options ?? [];

  if (field.type === FieldType.SingleSelect || field.type === FieldType.MultiSelect) {
    const items = rawSelectItems(value);
    if (items.length === 0) return <Empty />;
    return (
      <span className="pv-fe-tags">
        {items.map((it) => {
          const opt = options.find((o) => o.id === it.id);
          return opt ? (
            <OptionTag key={it.id} option={opt} colors={optionColors} size="small" />
          ) : (
            <OptionTag key={it.id} option={null} placeholder={it.text} colors={optionColors} size="small" />
          );
        })}
      </span>
    );
  }
  if (USER_TYPES.has(field.type)) {
    const users = getUsers(value);
    return users.length ? <UserChips users={users} /> : <Empty />;
  }
  if (field.type === FieldType.Attachment) {
    const names = attachmentNames(value);
    if (names.length === 0) return <Empty />;
    return (
      <span className="pv-fe-tags">
        {names.map((n, i) => (
          <span key={`${n}-${i}`} className="pv-file-chip" title={n}>
            <IconFile size="small" />
            <span className="pv-file-chip__name">{n}</span>
          </span>
        ))}
      </span>
    );
  }
  if (field.type === FieldType.Checkbox) {
    const checked = value === true;
    return (
      <span className={cls('pv-fe-checkmark', checked && 'is-checked')}>
        {checked ? <IconCheckboxTick /> : <span className="pv-fe-checkmark__box" aria-hidden />}
        <span>{checked ? t('detail.field.checked') : t('detail.field.unchecked')}</span>
      </span>
    );
  }
  if (field.type === FieldType.Url) {
    const link = urlOf(value);
    if (!link) return <Empty />;
    const text = segmentsToText(value) || link;
    return SAFE_LINK.test(link) ? (
      <a className="pv-fe-link" href={link} target="_blank" rel="noopener noreferrer" title={link}>
        {text}
      </a>
    ) : (
      <span className="pv-fe-text">{text}</span>
    );
  }
  const text = cellToText(field, value, lang);
  return text ? <span className="pv-fe-text">{text}</span> : <Empty />;
}

/* ------------------------------------------------------------------ */
/* Inline editors                                                      */
/* ------------------------------------------------------------------ */

/**
 * Local draft mirrored from the host value. While the input is focused the draft
 * is left alone so collaborator updates don't clobber what the user is typing.
 * An edit is judged against the value at focus time: leaving the input without a
 * change (or with Escape) writes nothing and picks up the current host value, so
 * a collaborator's newer value is never overwritten with the stale one.
 */
function useDraft<T>(external: T, syncKey: string) {
  const [draft, setDraftState] = useState<T>(external);
  /** Latest draft, readable from handlers that run before the next render (blur after a change). */
  const draftRef = useRef(draft);
  const latest = useRef(external);
  latest.current = external;
  /** Set between focus and blur: the host value when editing started. */
  const session = useRef<{ base: T; cancelled: boolean } | null>(null);
  const setDraft = (value: T) => {
    draftRef.current = value;
    setDraftState(value);
  };
  useEffect(() => {
    if (!session.current) setDraft(latest.current);
  }, [syncKey]);
  return {
    draft,
    setDraft,
    begin() {
      session.current = { base: latest.current, cancelled: false };
    },
    /** Escape: the blur that follows commits nothing. */
    cancel() {
      if (session.current) session.current.cancelled = true;
    },
    /**
     * End the edit. Returns the draft when `changed(draft, base)` says the user changed the
     * value since focus; otherwise null, and the draft follows the host value again.
     */
    finish(changed: (draft: T, base: T) => boolean): { value: T } | null {
      const current = session.current;
      session.current = null;
      if (current && !current.cancelled && changed(draftRef.current, current.base)) return { value: draftRef.current };
      setDraft(latest.current);
      return null;
    },
  };
}

interface EditorProps {
  field: FieldMeta;
  value: CellValue;
  invalid?: boolean;
  optionColors: OptionColor[];
  onCommit: (value: CellValue) => void;
}

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  (e.target as HTMLInputElement).blur();
}

function statusOf(invalid: boolean | undefined): 'error' | 'default' {
  return invalid ? 'error' : 'default';
}

function TextEditor({ value, invalid, onCommit }: EditorProps): JSX.Element {
  const { t } = useI18n();
  const external = segmentsToText(value);
  const { draft, setDraft, begin, cancel, finish } = useDraft(external, external);
  return (
    <TextArea
      value={draft}
      rows={1}
      autosize={{ minRows: 1, maxRows: 8 }}
      placeholder={t('detail.field.textPlaceholder')}
      validateStatus={statusOf(invalid)}
      onChange={(v) => setDraft(v)}
      onFocus={begin}
      onBlur={() => {
        const edit = finish((next, base) => next !== base);
        if (edit) onCommit(textToSegments(edit.value));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          cancel();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}

function parseNumber(v: number | string | null | undefined): number | null {
  return v === '' || v === null || v === undefined ? null : Number(v);
}

/** Rating bounds from the field property (`{min: 0|1, max}`), when present. */
function ratingRange(field: FieldMeta): { min?: number; max?: number } {
  const prop = field.property as { min?: unknown; max?: unknown } | null | undefined;
  return {
    min: typeof prop?.min === 'number' ? prop.min : undefined,
    max: typeof prop?.max === 'number' ? prop.max : undefined,
  };
}

/**
 * Numbers as typed. Progress cells hold a fraction (0.5) that the rest of the UI shows
 * as a percentage, so the editor shows and accepts percent too.
 */
function NumberEditor({ field, value, invalid, onCommit }: EditorProps): JSX.Element {
  const { t } = useI18n();
  const percent = field.type === FieldType.Progress;
  const rating = field.type === FieldType.Rating ? ratingRange(field) : null;
  const shown = (n: number) => (percent ? Number((n * 100).toFixed(4)) : n);
  const stored = (n: number) => (percent ? Number((n / 100).toFixed(6)) : n);
  const external = typeof value === 'number' && Number.isFinite(value) ? shown(value) : null;
  const { draft, setDraft, begin, finish } = useDraft<number | string>(external ?? '', String(external));
  const commit = () => {
    const edit = finish((next, base) => {
      const parsed = parseNumber(next);
      return (parsed === null || Number.isFinite(parsed)) && parsed !== parseNumber(base);
    });
    if (!edit) return;
    let parsed = parseNumber(edit.value);
    if (parsed !== null && rating) {
      parsed = Math.round(parsed);
      if (rating.min !== undefined) parsed = Math.max(rating.min, parsed);
      if (rating.max !== undefined) parsed = Math.min(rating.max, parsed);
    }
    onCommit(parsed === null ? null : stored(parsed));
  };
  return (
    <InputNumber
      value={draft}
      style={{ width: '100%' }}
      placeholder={t('detail.field.numberPlaceholder')}
      validateStatus={statusOf(invalid)}
      suffix={percent ? '%' : undefined}
      min={rating?.min}
      max={rating?.max}
      precision={rating ? 0 : undefined}
      onChange={(v) => setDraft(v)}
      onFocus={begin}
      onBlur={commit}
      onEnterPress={blurOnEnter}
    />
  );
}

function selectOptionList(options: SelectOption[], optionColors: OptionColor[]) {
  return options.map((o) => ({
    value: o.id,
    name: o.name,
    label: <OptionTag option={o} colors={optionColors} size="small" />,
  }));
}

function filterByName(input: string, option: { [key: string]: unknown }): boolean {
  return String(option.name ?? '')
    .toLowerCase()
    .includes(input.trim().toLowerCase());
}

function SingleSelectEditor({ field, value, invalid, optionColors, onCommit }: EditorProps): JSX.Element {
  const { t } = useI18n();
  const options = field.options ?? [];
  const externalId = getSelectId(value);
  const { draft, setDraft } = useDraft<string | null>(externalId, externalId ?? '');
  const optionList = selectOptionList(options, optionColors);
  const stale = rawSelectItems(value).find((it) => it.id === draft && !options.some((o) => o.id === it.id));
  if (stale) {
    optionList.push({
      value: stale.id,
      name: stale.text,
      label: <OptionTag option={null} placeholder={stale.text} colors={optionColors} size="small" />,
    });
  }
  return (
    <Select
      value={draft ?? undefined}
      optionList={optionList}
      filter={filterByName}
      showClear
      style={{ width: '100%' }}
      placeholder={t('detail.field.selectPlaceholder')}
      emptyContent={t('detail.field.noOptions')}
      validateStatus={statusOf(invalid)}
      onChange={(v) => {
        const id = typeof v === 'string' ? v : null;
        setDraft(id);
        if (id === externalId) return;
        const opt = options.find((o) => o.id === id);
        onCommit(opt ? makeSelectValue(opt) : null);
      }}
    />
  );
}

function MultiSelectEditor({ field, value, invalid, optionColors, onCommit }: EditorProps): JSX.Element {
  const { t } = useI18n();
  const options = field.options ?? [];
  const externalIds = getMultiSelectIds(value);
  const externalKey = externalIds.join('\u0001');
  const { draft, setDraft } = useDraft<string[]>(externalIds, externalKey);
  const rawText = new Map(rawSelectItems(value).map((it) => [it.id, it.text]));
  const tagFor = (id: string) => {
    const opt = options.find((o) => o.id === id);
    return opt ? (
      <OptionTag option={opt} colors={optionColors} size="small" />
    ) : (
      <OptionTag option={null} placeholder={rawText.get(id) ?? id} colors={optionColors} size="small" />
    );
  };
  return (
    <Select
      multiple
      value={draft}
      optionList={selectOptionList(options, optionColors)}
      filter={filterByName}
      showClear
      style={{ width: '100%' }}
      placeholder={t('detail.field.selectPlaceholder')}
      emptyContent={t('detail.field.noOptions')}
      validateStatus={statusOf(invalid)}
      renderSelectedItem={(node: Record<string, unknown>) => ({
        isRenderInTag: false,
        content: <span className="pv-fe-multi-item">{tagFor(String(node.value))}</span>,
      })}
      onChange={(v) => {
        const ids = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
        setDraft(ids);
        if (ids.join('\u0001') === externalKey) return;
        if (ids.length === 0) {
          onCommit(null);
          return;
        }
        onCommit(
          ids.map((id) => {
            const opt = options.find((o) => o.id === id);
            return opt ? makeSelectValue(opt) : { id, text: rawText.get(id) ?? id };
          }),
        );
      }}
    />
  );
}

function hasTimePart(field: FieldMeta): boolean {
  const format = (field.property as { dateFormat?: unknown } | null | undefined)?.dateFormat;
  return typeof format === 'string' && format.includes('HH');
}

function DateEditor({ field, value, invalid, onCommit }: EditorProps): JSX.Element {
  const { t } = useI18n();
  const external = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const { draft, setDraft } = useDraft<number | null>(external, String(external));
  const withTime = hasTimePart(field);
  return (
    <DatePicker
      type={withTime ? 'dateTime' : 'date'}
      format={withTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'}
      value={draft ?? undefined}
      showClear
      style={{ width: '100%' }}
      placeholder={t('detail.field.datePlaceholder')}
      validateStatus={statusOf(invalid)}
      onChange={(d) => {
        const ts = d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
        setDraft(ts);
        if (ts !== external) onCommit(ts);
      }}
    />
  );
}

function CheckboxEditor({ value, invalid, onCommit }: EditorProps): JSX.Element {
  const { t } = useI18n();
  const external = value === true;
  const { draft, setDraft } = useDraft<boolean>(external, String(external));
  return (
    <div className={cls('pv-fe-check', invalid && 'is-invalid')}>
      <Checkbox
        checked={draft}
        onChange={(e) => {
          const next = e.target.checked === true;
          setDraft(next);
          if (next !== external) onCommit(next);
        }}
      >
        {draft ? t('detail.field.checked') : t('detail.field.unchecked')}
      </Checkbox>
    </div>
  );
}

/** One-line editors. Url writes a url segment; Phone and Email write a plain string (SDK 0.4.0 shapes). */
function LineEditor(props: EditorProps & { kind: 'url' | 'phone' | 'email' }): JSX.Element {
  const { value, invalid, onCommit, kind } = props;
  const { t } = useI18n();
  const external = kind === 'url' ? urlOf(value) : typeof value === 'string' ? value : segmentsToText(value);
  const { draft, setDraft, begin, finish } = useDraft(external, external);
  const safeLink = kind === 'url' && SAFE_LINK.test(draft.trim()) ? draft.trim() : null;
  let suffix: ReactNode = null;
  if (safeLink) {
    suffix = (
      <a className="pv-fe-open-link" href={safeLink} target="_blank" rel="noopener noreferrer" title={safeLink}>
        <IconLink />
      </a>
    );
  }
  return (
    <Input
      value={draft}
      placeholder={
        kind === 'url' ? 'https://' : kind === 'email' ? t('detail.field.emailPlaceholder') : t('detail.field.phonePlaceholder')
      }
      validateStatus={statusOf(invalid)}
      suffix={suffix}
      onChange={(v) => setDraft(v)}
      onFocus={begin}
      onBlur={() => {
        const edit = finish((next, base) => next.trim() !== base);
        if (!edit) return;
        const next = edit.value.trim();
        onCommit(kind === 'url' ? makeUrlValue(next) : next || null);
      }}
      onEnterPress={blurOnEnter}
    />
  );
}

function renderInlineEditor(p: EditorProps): JSX.Element | null {
  switch (p.field.type) {
    case FieldType.Text:
    case FieldType.Barcode:
      return <TextEditor {...p} />;
    case FieldType.Email:
      return <LineEditor {...p} kind="email" />;
    case FieldType.Number:
    case FieldType.Currency:
    case FieldType.Progress:
    case FieldType.Rating:
      return <NumberEditor {...p} />;
    case FieldType.SingleSelect:
      return <SingleSelectEditor {...p} />;
    case FieldType.MultiSelect:
      return <MultiSelectEditor {...p} />;
    case FieldType.DateTime:
      return <DateEditor {...p} />;
    case FieldType.Checkbox:
      return <CheckboxEditor {...p} />;
    case FieldType.Url:
      return <LineEditor {...p} kind="url" />;
    case FieldType.Phone:
      return <LineEditor {...p} kind="phone" />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* FieldEditor                                                         */
/* ------------------------------------------------------------------ */

/**
 * Inline editor for one cell. Types without an inline editor (users, attachments,
 * links, location…) and rich text (mentions, links) render read-only with an
 * "Edit in Lark" shortcut; computed fields are always read-only.
 */
export function FieldEditor(props: FieldEditorProps): JSX.Element {
  const { field, value, editable, invalid, optionColors, onCommit, onOpenHostEditor } = props;
  const { t } = useI18n();

  if (isComputedField(field.type)) {
    return (
      <div className={cls('pv-fe-box', 'is-readonly', invalid && 'is-invalid')}>
        <div className="pv-fe-box__value">
          <CellDisplay field={field} value={value} optionColors={optionColors} />
        </div>
        <span className="pv-fe-hint">
          <IconSetting size="small" />
          {t('detail.field.computed')}
        </span>
      </div>
    );
  }

  // Mentions, links and link text cannot round-trip through the plain-text editors: edit those in Lark.
  const inline =
    editable && isEditableInline(field) && !hasRichText(field, value)
      ? renderInlineEditor({ field, value, invalid, optionColors, onCommit })
      : null;
  if (inline) return inline;

  return (
    <div className={cls('pv-fe-box', !editable && 'is-readonly', invalid && 'is-invalid')}>
      <div className="pv-fe-box__value">
        <CellDisplay field={field} value={value} optionColors={optionColors} />
      </div>
      {editable ? (
        <Button
          size="small"
          theme="borderless"
          type="primary"
          icon={<IconEdit2Stroked />}
          className="pv-fe-host-btn"
          onClick={onOpenHostEditor}
        >
          {t('detail.field.editInLark')}
        </Button>
      ) : null}
    </div>
  );
}
