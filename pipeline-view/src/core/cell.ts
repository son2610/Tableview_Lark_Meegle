import { FieldType } from '../types';
import type { CellValue, FieldMeta, Lang } from '../types';

type Obj = Record<string, unknown>;

/**
 * Human readable text for any cell value (see CellValue docs in types.ts).
 * Text segments joined; select -> option text; users -> names joined ", ";
 * dates -> formatDateTime; checkbox -> "✓" / ""; attachments -> file names;
 * links -> `text`; autonumber -> value; location -> fullAddress || name;
 * formula/lookup arrays -> items flattened and joined ", ". Unknown -> "".
 * `field` may be undefined (falls back to shape sniffing).
 * Field-type specifics: DateTime/CreatedTime/ModifiedTime numbers are dates (date only
 * when the field's `property.dateFormat` has no hours); Progress numbers are fractions
 * shown as percent ("50%"); other numbers are printed with at most 6 decimals.
 * `lang` is accepted for API symmetry; the output is currently language independent.
 */
export function cellToText(field: FieldMeta | undefined, value: CellValue, lang?: Lang): string {
  void lang;
  return valueToText(field, value);
}

/**
 * Required-field check. Empty when: null/undefined; empty array; text segments whose
 * joined text is whitespace; empty/whitespace string; checkbox !== true; link with no
 * recordIds; autonumber with empty value. Numbers (incl. 0) are NOT empty.
 * Also: NaN is empty; an array is empty when every item is empty (covers Formula/Lookup
 * arrays like `[null]`); objects carrying an id / token are never empty; booleans in
 * non-checkbox fields (formula results) are not empty.
 */
export function isCellEmpty(field: FieldMeta, value: CellValue): boolean {
  if (field && field.type === FieldType.Checkbox) return value !== true;
  return isValueEmpty(value);
}

/** Option id of a SingleSelect value (`{id,text}`), or null. Tolerates arrays (first item). */
export function getSelectId(value: CellValue): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (isObj(item) && typeof item.id === 'string' && item.id !== '') return item.id;
  return null;
}

/** Option ids of a MultiSelect value. */
export function getMultiSelectIds(value: CellValue): string[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  const ids: string[] = [];
  for (const item of items) {
    if (isObj(item) && typeof item.id === 'string' && item.id !== '' && !ids.includes(item.id)) ids.push(item.id);
  }
  return ids;
}

/** SingleSelect cell value for writing. */
export function makeSelectValue(option: { id: string; name: string }): { id: string; text: string } {
  return { id: option.id, text: option.name };
}

/** Users of a User/CreatedUser/ModifiedUser value as {id, name}. name falls back to enName/email/id. */
export function getUsers(value: CellValue): { id: string; name: string }[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  const users: { id: string; name: string }[] = [];
  for (const item of items) {
    if (!isObj(item)) continue;
    const id = str(item.id);
    const name = str(item.name) || str(item.enName) || str(item.en_name) || str(item.email) || id;
    if (id || name) users.push({ id, name });
  }
  return users;
}

/** Plain text of a Text-like value (segments array or string). */
export function segmentsToText(value: CellValue): string {
  if (typeof value === 'string') return value;
  if (isObj(value) && typeof value.text === 'string') return value.text;
  if (!Array.isArray(value)) return '';
  let out = '';
  for (const item of value) {
    if (typeof item === 'string') out += item;
    else if (isObj(item) && typeof item.text === 'string') out += item.text;
  }
  return out;
}

/** Text cell value for writing: `[{type:'text', text}]`, or null for an empty string. */
export function textToSegments(text: string): CellValue {
  return text ? [{ type: 'text', text }] : null;
}

/** Url cell value for writing: `[{type:'url', text, link}]` (text defaults to link), or null. */
export function makeUrlValue(link: string, text?: string): CellValue {
  const href = (link ?? '').trim();
  if (!href) return null;
  return [{ type: 'url', text: text || href, link: href }];
}

/**
 * True when a Text/Barcode/Url value holds more than the plain-text inline editors can write
 * back: mention or link segments in text, a Url whose display text differs from its link, or
 * several links. Such cells are edited in the host instead, so an edit never flattens them.
 */
export function hasRichText(field: FieldMeta, value: CellValue): boolean {
  if (!field || !Array.isArray(value)) return false;
  if (field.type === FieldType.Text || field.type === FieldType.Barcode) {
    return value.some((item) => isObj(item) && typeof item.type === 'string' && item.type !== 'text');
  }
  if (field.type === FieldType.Url) {
    if (value.length > 1) return true;
    const seg = value[0];
    return isObj(seg) && str(seg.text) !== '' && str(seg.text) !== str(seg.link);
  }
  return false;
}

const COMPUTED_TYPES = new Set<FieldType>([
  FieldType.Formula,
  FieldType.Lookup,
  FieldType.CreatedTime,
  FieldType.ModifiedTime,
  FieldType.CreatedUser,
  FieldType.ModifiedUser,
  FieldType.AutoNumber,
]);

/** Fields the plugin can never write (formula, lookup, created/modified time/user, autonumber). */
export function isComputedField(type: FieldType): boolean {
  return COMPUTED_TYPES.has(type);
}

const INLINE_TYPES = new Set<FieldType>([
  FieldType.Text,
  FieldType.Email,
  FieldType.Barcode,
  FieldType.Number,
  FieldType.Currency,
  FieldType.Progress,
  FieldType.Rating,
  FieldType.SingleSelect,
  FieldType.MultiSelect,
  FieldType.DateTime,
  FieldType.Checkbox,
  FieldType.Url,
  FieldType.Phone,
]);

/**
 * Types with an in-plugin editor: Text, Email, Barcode, Number, Currency, Progress, Rating,
 * SingleSelect, MultiSelect, DateTime, Checkbox, Url, Phone. Others use the host editor.
 */
export function isEditableInline(field: FieldMeta): boolean {
  return !!field && INLINE_TYPES.has(field.type);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DURATION_UNITS: { ms: number; vi: string; en: [string, string] }[] = [
  { ms: 365 * DAY, vi: 'năm', en: ['year', 'years'] },
  { ms: 30 * DAY, vi: 'tháng', en: ['month', 'months'] },
  { ms: 7 * DAY, vi: 'tuần', en: ['week', 'weeks'] },
  { ms: DAY, vi: 'ngày', en: ['day', 'days'] },
  { ms: HOUR, vi: 'giờ', en: ['hour', 'hours'] },
  { ms: MINUTE, vi: 'phút', en: ['min', 'min'] },
  { ms: SECOND, vi: 'giây', en: ['sec', 'sec'] },
];

/**
 * Compact duration: "45 giây", "5 phút", "3 giờ", "2 ngày", "3 tuần", "1 tháng", "2 năm" (vi)
 * / "45 sec", "5 min", "3 hours", "2 days", "3 weeks", "1 month", "2 years" (en).
 * Picks the largest unit with value >= 1 (month = 30 days, year = 365 days). Negative -> 0.
 * Values are truncated (89 s -> "1 min"); below one second -> "0 sec" / "0 giây". NaN -> 0.
 */
export function formatDuration(ms: number, lang: Lang): string {
  const total = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const unit = DURATION_UNITS.find((u) => total >= u.ms) ?? DURATION_UNITS[DURATION_UNITS.length - 1];
  const count = Math.floor(total / unit.ms);
  if (lang === 'vi') return `${count} ${unit.vi}`;
  return `${count} ${count === 1 ? unit.en[0] : unit.en[1]}`;
}

/** Local "YYYY-MM-DD HH:mm" (or "YYYY-MM-DD" when dateOnly). Invalid -> "". */
export function formatDateTime(ts: number, dateOnly?: boolean): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return dateOnly ? date : `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */

const DATE_TYPES = new Set<FieldType>([FieldType.DateTime, FieldType.CreatedTime, FieldType.ModifiedTime]);
const USER_TYPES = new Set<FieldType>([FieldType.User, FieldType.CreatedUser, FieldType.ModifiedUser]);

function valueToText(field: FieldMeta | undefined, value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return numberToText(field, value);
  if (typeof value === 'boolean') return value ? '✓' : '';
  if (field && USER_TYPES.has(field.type)) return joinList(getUsers(value).map((u) => u.name));
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isSegment)) return segmentsToText(value);
    return joinList(value.map((item) => valueToText(field, item)));
  }
  if (isObj(value)) return objectToText(value);
  return '';
}

function objectToText(o: Obj): string {
  if (isLink(o)) return str(o.text);
  if (typeof o.text === 'string') return o.text; // segment, select option
  if ('fullAddress' in o || 'full_address' in o || 'location' in o) {
    return str(o.fullAddress) || str(o.full_address) || str(o.name) || str(o.address);
  }
  if ('value' in o && 'status' in o) return scalarText(o.value); // AutoNumber
  if (typeof o.name === 'string' || 'enName' in o || 'email' in o) {
    // user, attachment, group chat
    return str(o.name) || str(o.enName) || str(o.en_name) || str(o.email) || str(o.id);
  }
  if ('value' in o) return scalarText(o.value);
  return '';
}

function numberToText(field: FieldMeta | undefined, n: number): string {
  if (Number.isNaN(n)) return '';
  if (field && DATE_TYPES.has(field.type)) return formatDateTime(n, isDateOnly(field));
  if (field && field.type === FieldType.Progress) return `${formatNumber(n * 100)}%`;
  return formatNumber(n);
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6)));
}

function isDateOnly(field: FieldMeta): boolean {
  const prop = field.property;
  if (!isObj(prop) || typeof prop.dateFormat !== 'string') return false;
  return !/[Hh]/.test(prop.dateFormat);
}

function isValueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'boolean') return false;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isValueEmpty);
  if (!isObj(value)) return false;

  if (isLink(value)) {
    const ids = Array.isArray(value.recordIds) ? value.recordIds : value.record_ids;
    return !Array.isArray(ids) || ids.length === 0;
  }
  if (typeof value.id === 'string' && value.id !== '') return false; // select, user, group chat, mention
  if (typeof value.token === 'string' && value.token !== '') return false; // attachment
  if ('text' in value) return str(value.text).trim() === '' && str(value.link).trim() === '';
  if ('value' in value) return isValueEmpty(value.value); // AutoNumber
  const textual = ['fullAddress', 'full_address', 'address', 'name', 'location'].filter((k) => k in value);
  if (textual.length > 0) return textual.every((k) => str(value[k]).trim() === '');
  return Object.keys(value).length === 0;
}

function isLink(o: Obj): boolean {
  return 'recordIds' in o || 'record_ids' in o;
}

function isSegment(item: unknown): boolean {
  return (
    isObj(item) &&
    typeof item.text === 'string' &&
    !isLink(item) &&
    (item.type === 'text' || item.type === 'url' || item.type === 'mention')
  );
}

function scalarText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return formatNumber(v);
  return '';
}

function joinList(parts: string[]): string {
  return parts.filter((p) => p !== '').join(', ');
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
