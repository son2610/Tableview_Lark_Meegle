import type { HistoryEntry, TransitionKind } from '../types';

/**
 * One human readable, machine parseable log line. Timestamp is local time.
 *   start:    "[2026-11-02 14:03] ▶ Detail Review"
 *   advance:  "[2026-11-02 14:03] Detail Review → Tech Design"
 *   rollback: "[2026-11-02 14:03] Tech Design ↩ Detail Review"
 *   complete: "[2026-11-02 14:03] ✓ Release"
 * `from` / `to` are node NAMES. For complete, the node name goes in `to`.
 */
export function formatHistoryLine(entry: { at: number; kind: TransitionKind; from?: string; to?: string }): string {
  void entry;
  throw new Error('TODO: implement formatHistoryLine');
}

/**
 * Parse every recognizable line of a history text (lines written by
 * formatHistoryLine). Unrecognized lines are skipped. Node names may contain
 * spaces and arrows-like characters are only treated as separators when surrounded
 * by single spaces (" → ", " ↩ "). Result is in text order.
 */
export function parseHistory(text: string): HistoryEntry[] {
  void text;
  throw new Error('TODO: implement parseHistory');
}

/** Append `line` to `existing` (newline separated) keeping only the last `maxLines` lines. */
export function appendHistory(existing: string, line: string, maxLines?: number): string {
  void existing;
  void line;
  void maxLines;
  throw new Error('TODO: implement appendHistory');
}
