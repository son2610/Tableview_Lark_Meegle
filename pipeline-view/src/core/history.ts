import type { HistoryEntry, TransitionKind } from '../types';
import { formatDateTime } from './cell';

const START = '▶ ';
const COMPLETE = '✓ ';
const ADVANCE_SEP = ' → ';
const ROLLBACK_SEP = ' ↩ ';
const DEFAULT_MAX_LINES = 200;

/**
 * One human readable, machine parseable log line. Timestamp is local time.
 *   start:    "[2026-11-02 14:03] ▶ Detail Review"
 *   advance:  "[2026-11-02 14:03] Detail Review → Tech Design"
 *   rollback: "[2026-11-02 14:03] Tech Design ↩ Detail Review"
 *   complete: "[2026-11-02 14:03] ✓ Release"
 * `from` / `to` are node NAMES. For complete, the node name goes in `to`.
 * Names are trimmed and line breaks inside them become spaces, so one entry is always
 * one line. An invalid timestamp gives "[]" (parsed back as NaN).
 */
export function formatHistoryLine(entry: { at: number; kind: TransitionKind; from?: string; to?: string }): string {
  const stamp = `[${formatDateTime(entry.at)}] `;
  const from = cleanName(entry.from);
  const to = cleanName(entry.to);
  switch (entry.kind) {
    case 'start':
      return `${stamp}${START}${to}`;
    case 'complete':
      return `${stamp}${COMPLETE}${to}`;
    case 'rollback':
      return `${stamp}${from}${ROLLBACK_SEP}${to}`;
    case 'advance':
    default:
      return `${stamp}${from}${ADVANCE_SEP}${to}`;
  }
}

/**
 * Parse every recognizable line of a history text (lines written by
 * formatHistoryLine). Unrecognized lines are skipped. Node names may contain
 * spaces and arrows-like characters are only treated as separators when surrounded
 * by single spaces (" → ", " ↩ "). Result is in text order.
 * Details: CRLF / blank lines tolerated; lines and names are trimmed. When a line holds
 * several separators the left-most one splits it (a name containing " → " is therefore
 * ambiguous). A body starting with "▶ " is a start, "✓ " a complete.
 */
export function parseHistory(text: string): HistoryEntry[] {
  if (typeof text !== 'string' || text === '') return [];
  const entries: HistoryEntry[] = [];
  for (const rawLine of text.split(/\r?\n|\r/)) {
    const line = rawLine.trim();
    const m = /^\[([^\]]*)\]\s*(.*)$/.exec(line);
    if (!m) continue;
    const entry = parseBody(m[2]);
    if (entry) entries.push({ at: parseStamp(m[1]), ...entry, raw: line });
  }
  return entries;
}

/**
 * Append `line` to `existing` (newline separated) keeping only the last `maxLines` lines.
 * Blank lines are dropped and CRLF is normalised to LF. maxLines defaults to 200
 * (values < 1 keep just the new line).
 */
export function appendHistory(existing: string, line: string, maxLines?: number): string {
  const limit =
    typeof maxLines === 'number' && Number.isFinite(maxLines) ? Math.max(1, Math.floor(maxLines)) : DEFAULT_MAX_LINES;
  const lines = (typeof existing === 'string' ? existing : '').split(/\r?\n|\r/).filter((l) => l.trim() !== '');
  if (line.trim() !== '') lines.push(line);
  return lines.slice(-limit).join('\n');
}

function parseBody(body: string): Omit<HistoryEntry, 'at' | 'raw'> | null {
  if (body.startsWith(START.trim())) {
    const to = body.slice(START.trim().length).trim();
    return to ? { kind: 'start', to } : null;
  }
  if (body.startsWith(COMPLETE.trim())) {
    const to = body.slice(COMPLETE.trim().length).trim();
    return to ? { kind: 'complete', to } : null;
  }
  const adv = body.indexOf(ADVANCE_SEP);
  const back = body.indexOf(ROLLBACK_SEP);
  if (adv < 0 && back < 0) return null;
  const isRollback = back >= 0 && (adv < 0 || back < adv);
  const at = isRollback ? back : adv;
  const from = body.slice(0, at).trim();
  const to = body.slice(at + (isRollback ? ROLLBACK_SEP : ADVANCE_SEP).length).trim();
  if (!from || !to) return null;
  return { kind: isRollback ? 'rollback' : 'advance', from, to };
}

function parseStamp(stamp: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(stamp.trim());
  if (!m) return NaN;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0'].map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  // Reject overflowing values such as month 13 instead of silently rolling over.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return NaN;
  return date.getTime();
}

function cleanName(name: string | undefined): string {
  return (name ?? '').replace(/[\r\n]+/g, ' ').trim();
}
