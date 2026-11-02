import type { CellValue, FieldMeta, FieldType, Lang } from '../types';

/**
 * Human readable text for any cell value (see CellValue docs in types.ts).
 * Text segments joined; select -> option text; users -> names joined ", ";
 * dates -> formatDateTime; checkbox -> "✓" / ""; attachments -> file names;
 * links -> `text`; autonumber -> value; location -> fullAddress || name;
 * formula/lookup arrays -> items flattened and joined ", ". Unknown -> "".
 * `field` may be undefined (falls back to shape sniffing).
 */
export function cellToText(field: FieldMeta | undefined, value: CellValue, lang?: Lang): string {
  void field;
  void value;
  void lang;
  throw new Error('TODO: implement cellToText');
}

/**
 * Required-field check. Empty when: null/undefined; empty array; text segments whose
 * joined text is whitespace; empty/whitespace string; checkbox !== true; link with no
 * recordIds; autonumber with empty value. Numbers (incl. 0) are NOT empty.
 */
export function isCellEmpty(field: FieldMeta, value: CellValue): boolean {
  void field;
  void value;
  throw new Error('TODO: implement isCellEmpty');
}

/** Option id of a SingleSelect value (`{id,text}`), or null. Tolerates arrays (first item). */
export function getSelectId(value: CellValue): string | null {
  void value;
  throw new Error('TODO: implement getSelectId');
}

/** Option ids of a MultiSelect value. */
export function getMultiSelectIds(value: CellValue): string[] {
  void value;
  throw new Error('TODO: implement getMultiSelectIds');
}

/** SingleSelect cell value for writing. */
export function makeSelectValue(option: { id: string; name: string }): { id: string; text: string } {
  void option;
  throw new Error('TODO: implement makeSelectValue');
}

/** Users of a User/CreatedUser/ModifiedUser value as {id, name}. name falls back to enName/email/id. */
export function getUsers(value: CellValue): { id: string; name: string }[] {
  void value;
  throw new Error('TODO: implement getUsers');
}

/** Plain text of a Text-like value (segments array or string). */
export function segmentsToText(value: CellValue): string {
  void value;
  throw new Error('TODO: implement segmentsToText');
}

/** Text cell value for writing: `[{type:'text', text}]`, or null for an empty string. */
export function textToSegments(text: string): CellValue {
  void text;
  throw new Error('TODO: implement textToSegments');
}

/** Url cell value for writing: `[{type:'url', text, link}]` (text defaults to link), or null. */
export function makeUrlValue(link: string, text?: string): CellValue {
  void link;
  void text;
  throw new Error('TODO: implement makeUrlValue');
}

/** Fields the plugin can never write (formula, lookup, created/modified time/user, autonumber). */
export function isComputedField(type: FieldType): boolean {
  void type;
  throw new Error('TODO: implement isComputedField');
}

/**
 * Types with an in-plugin editor: Text, Email, Barcode, Number, Currency, Progress, Rating,
 * SingleSelect, MultiSelect, DateTime, Checkbox, Url, Phone. Others use the host editor.
 */
export function isEditableInline(field: FieldMeta): boolean {
  void field;
  throw new Error('TODO: implement isEditableInline');
}

/**
 * Compact duration: "45 giây", "5 phút", "3 giờ", "2 ngày", "3 tuần", "1 tháng", "2 năm" (vi)
 * / "45 sec", "5 min", "3 hours", "2 days", "3 weeks", "1 month", "2 years" (en).
 * Picks the largest unit with value >= 1 (month = 30 days, year = 365 days). Negative -> 0.
 */
export function formatDuration(ms: number, lang: Lang): string {
  void ms;
  void lang;
  throw new Error('TODO: implement formatDuration');
}

/** Local "YYYY-MM-DD HH:mm" (or "YYYY-MM-DD" when dateOnly). Invalid -> "". */
export function formatDateTime(ts: number, dateOnly?: boolean): string {
  void ts;
  void dateOnly;
  throw new Error('TODO: implement formatDateTime');
}
