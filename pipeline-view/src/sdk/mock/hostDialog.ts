/**
 * Plain-DOM imitation of Lark's record card, used by the mock adapter for
 * `openRecord` / `editField`. No React and no src/core imports: in the real
 * host this UI belongs to Lark, not to the plugin.
 */
import { FieldType } from '../../types';
import type { CellValue, FieldMeta } from '../../types';

export interface HostDialogField {
  id: string;
  name: string;
  /** Display text of the current value. */
  text: string;
  /** Present when the dialog lets the user type a new value. */
  input?: 'text' | 'number';
}

export interface HostDialogLabels {
  close: string;
  save: string;
  empty: string;
  invalidNumber: string;
  /** Shown under a field the dialog cannot edit. */
  readOnlyHint?: string;
}

export interface HostDialogOptions {
  title: string;
  subtitle?: string;
  fields: HostDialogField[];
  labels: HostDialogLabels;
  /** Applies a typed value; rejecting keeps the dialog open and shows the message. */
  onSave?: (fieldId: string, raw: string) => Promise<void>;
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(ts: number, withTime: boolean): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

function hasTimeFormat(field: FieldMeta | undefined): boolean {
  const property = field?.property as { dateFormat?: unknown } | null | undefined;
  return typeof property?.dateFormat === 'string' ? property.dateFormat.includes('HH') : true;
}

function itemText(item: unknown): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  if (typeof item === 'boolean') return item ? '✓' : '';
  if (typeof item === 'object') {
    const o = item as Record<string, unknown>;
    for (const key of ['text', 'name', 'value', 'fullAddress', 'link']) {
      if (typeof o[key] === 'string' && o[key]) return o[key] as string;
    }
  }
  return '';
}

/** Readable text of a raw cell value for the mock record card. */
export function formatMockCell(field: FieldMeta | undefined, value: CellValue): string {
  if (value === null || value === undefined) return '';
  switch (field?.type) {
    case FieldType.Text:
    case FieldType.Email:
    case FieldType.Barcode:
      return Array.isArray(value) ? value.map(itemText).join('') : itemText(value);
    case FieldType.DateTime:
    case FieldType.CreatedTime:
    case FieldType.ModifiedTime:
      return typeof value === 'number' ? formatDate(value, hasTimeFormat(field)) : '';
    case FieldType.Checkbox:
      return value === true ? '✓' : '—';
    default:
      break;
  }
  if (Array.isArray(value)) return value.map(itemText).filter(Boolean).join(', ');
  return itemText(value);
}

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const STYLE_ID = 'pv-mock-host-dialog-style';

const CSS = `
.pvh-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(31,35,41,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--pv-font,-apple-system,'Segoe UI',Roboto,sans-serif)}
.pvh-card{width:min(560px,100%);max-height:min(80vh,720px);display:flex;flex-direction:column;background:var(--pv-surface,#fff);color:var(--pv-text,#1f2329);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden}
.pvh-head{display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:1px solid var(--pv-border,#dee0e3)}
.pvh-title{flex:1;min-width:0;font-size:16px;font-weight:600;line-height:24px;overflow-wrap:anywhere}
.pvh-sub{font-size:12px;font-weight:400;color:var(--pv-text-3,#8f959e);margin-top:2px}
.pvh-x{border:0;background:transparent;color:var(--pv-text-2,#646a73);font-size:20px;line-height:24px;cursor:pointer;padding:0 4px;border-radius:6px}
.pvh-x:hover{background:var(--pv-surface-2,#f2f3f5)}
.pvh-body{padding:8px 20px 16px;overflow:auto}
.pvh-row{padding:10px 0;border-bottom:1px solid var(--pv-border,#dee0e3)}
.pvh-row:last-child{border-bottom:0}
.pvh-label{font-size:12px;color:var(--pv-text-2,#646a73);margin-bottom:4px}
.pvh-value{font-size:14px;line-height:22px;white-space:pre-wrap;overflow-wrap:anywhere}
.pvh-empty{color:var(--pv-text-3,#8f959e)}
.pvh-hint{font-size:12px;color:var(--pv-text-3,#8f959e);margin-top:4px}
.pvh-input{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:6px 10px;border:1px solid var(--pv-border-strong,#c9cdd4);border-radius:6px;background:var(--pv-surface,#fff);color:inherit;resize:vertical}
.pvh-input:focus{outline:none;border-color:var(--pv-primary,#3370ff);box-shadow:0 0 0 2px var(--pv-primary-soft,#e1eaff)}
.pvh-error{font-size:12px;color:var(--pv-danger,#f54a45);margin-top:4px;min-height:0}
.pvh-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--pv-border,#dee0e3)}
.pvh-btn{font:inherit;font-size:14px;height:32px;padding:0 14px;border-radius:6px;cursor:pointer;border:1px solid var(--pv-border-strong,#c9cdd4);background:var(--pv-surface,#fff);color:var(--pv-text,#1f2329)}
.pvh-btn-primary{background:var(--pv-primary,#3370ff);border-color:var(--pv-primary,#3370ff);color:#fff}
.pvh-btn:disabled{opacity:.6;cursor:default}
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Show the card. Returns a function that closes it. Does nothing (returns a
 * no-op) when there is no DOM, e.g. in unit tests.
 */
export function openHostDialog(opts: HostDialogOptions): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const doc = document;
  ensureStyle(doc);
  const previousFocus = doc.activeElement as HTMLElement | null;

  const backdrop = el(doc, 'div', 'pvh-backdrop');
  const card = el(doc, 'div', 'pvh-card');
  const titleId = `pvh-title-${Date.now()}`;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', titleId);

  const head = el(doc, 'div', 'pvh-head');
  const title = el(doc, 'div', 'pvh-title', opts.title || '—');
  title.id = titleId;
  if (opts.subtitle) title.appendChild(el(doc, 'div', 'pvh-sub', opts.subtitle));
  const closeX = el(doc, 'button', 'pvh-x', '×');
  closeX.type = 'button';
  closeX.setAttribute('aria-label', opts.labels.close);
  head.append(title, closeX);

  const body = el(doc, 'div', 'pvh-body');
  const editors: { field: HostDialogField; input: HTMLInputElement | HTMLTextAreaElement; error: HTMLElement }[] = [];
  for (const field of opts.fields) {
    const row = el(doc, 'div', 'pvh-row');
    row.appendChild(el(doc, 'div', 'pvh-label', field.name));
    if (field.input && opts.onSave) {
      const input = field.input === 'number' ? el(doc, 'input', 'pvh-input') : el(doc, 'textarea', 'pvh-input');
      if (input instanceof HTMLInputElement) input.type = 'text';
      if (field.input === 'number') input.setAttribute('inputmode', 'decimal');
      else input.setAttribute('rows', '3');
      input.value = field.text;
      input.setAttribute('aria-label', field.name);
      const error = el(doc, 'div', 'pvh-error');
      row.append(input, error);
      editors.push({ field, input, error });
    } else {
      row.appendChild(el(doc, 'div', field.text ? 'pvh-value' : 'pvh-value pvh-empty', field.text || opts.labels.empty));
      if (opts.labels.readOnlyHint && opts.onSave) row.appendChild(el(doc, 'div', 'pvh-hint', opts.labels.readOnlyHint));
    }
    body.appendChild(row);
  }

  const foot = el(doc, 'div', 'pvh-foot');
  const closeBtn = el(doc, 'button', 'pvh-btn', opts.labels.close);
  closeBtn.type = 'button';
  foot.appendChild(closeBtn);
  let saveBtn: HTMLButtonElement | null = null;
  if (editors.length > 0) {
    saveBtn = el(doc, 'button', 'pvh-btn pvh-btn-primary', opts.labels.save);
    saveBtn.type = 'button';
    foot.appendChild(saveBtn);
  }

  card.append(head, body, foot);
  backdrop.appendChild(card);
  doc.body.appendChild(backdrop);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    previousFocus?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  const save = async () => {
    if (!saveBtn || !opts.onSave) return;
    for (const { field, input, error } of editors) {
      error.textContent = '';
      const raw = input.value.trim();
      if (field.input === 'number' && raw !== '' && !Number.isFinite(Number(raw))) {
        error.textContent = opts.labels.invalidNumber;
        input.focus();
        return;
      }
    }
    saveBtn.disabled = true;
    try {
      for (const { field, input } of editors) {
        if (input.value !== field.text) await opts.onSave(field.id, input.value);
      }
      close();
    } catch (err) {
      const target = editors[0];
      target.error.textContent = err instanceof Error ? err.message : String(err);
      saveBtn.disabled = false;
    }
  };

  closeX.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  saveBtn?.addEventListener('click', () => void save());
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  doc.addEventListener('keydown', onKey, true);

  (editors[0]?.input ?? closeBtn).focus();
  return close;
}
