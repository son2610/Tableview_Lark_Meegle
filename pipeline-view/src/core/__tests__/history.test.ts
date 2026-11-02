import { describe, expect, it } from 'vitest';
import type { TransitionKind } from '../../types';
import { appendHistory, formatHistoryLine, parseHistory } from '../history';

const at = new Date(2026, 10, 2, 14, 3).getTime(); // local 2026-11-02 14:03

describe('formatHistoryLine', () => {
  it('writes the documented format for every kind', () => {
    expect(formatHistoryLine({ at, kind: 'start', to: 'Detail Review' })).toBe('[2026-11-02 14:03] ▶ Detail Review');
    expect(formatHistoryLine({ at, kind: 'advance', from: 'Detail Review', to: 'Tech Design' })).toBe(
      '[2026-11-02 14:03] Detail Review → Tech Design',
    );
    expect(formatHistoryLine({ at, kind: 'rollback', from: 'Tech Design', to: 'Detail Review' })).toBe(
      '[2026-11-02 14:03] Tech Design ↩ Detail Review',
    );
    expect(formatHistoryLine({ at, kind: 'complete', to: 'Release' })).toBe('[2026-11-02 14:03] ✓ Release');
  });

  it('zero-pads the local timestamp', () => {
    const early = new Date(2026, 0, 5, 7, 4).getTime();
    expect(formatHistoryLine({ at: early, kind: 'start', to: 'A' })).toBe('[2026-01-05 07:04] ▶ A');
  });

  it('keeps one entry on one line and trims names', () => {
    expect(formatHistoryLine({ at, kind: 'advance', from: ' Multi\nline ', to: 'B\r\n2' })).toBe('[2026-11-02 14:03] Multi line → B 2');
  });

  it('writes empty brackets for an invalid timestamp', () => {
    expect(formatHistoryLine({ at: NaN, kind: 'complete', to: 'X' })).toBe('[] ✓ X');
  });
});

describe('parseHistory', () => {
  const names = [
    'Detail Review',
    'QA - Plan (v2)',
    'Front-end gray-box testing',
    'Thiết kế kỹ thuật (BE)',
    'Đánh giá – rủi ro',
    '技术方案评审',
    '阶段 2 – 测试',
    'Server Dev [phase 1]',
    'A->B',
    'x→y',
    'Done ✓',
  ];

  it('round-trips every kind for names with spaces, dashes, brackets, Vietnamese and CJK', () => {
    const kinds: TransitionKind[] = ['start', 'advance', 'rollback', 'complete'];
    for (const from of names) {
      for (const to of names) {
        for (const kind of kinds) {
          const entry = kind === 'advance' || kind === 'rollback' ? { at, kind, from, to } : { at, kind, to };
          const line = formatHistoryLine(entry);
          expect(parseHistory(line), line).toEqual([{ ...entry, raw: line }]);
        }
      }
    }
  });

  it('parses a multi-line log in text order, tolerating CRLF, blank lines and junk', () => {
    const text = [
      '[2026-11-02 09:00] ▶ Detail Review',
      '',
      'some note typed by hand',
      '[2026-11-02 10:30] Detail Review → Tech Design',
      '   ',
      '[2026-11-03 08:05] Tech Design ↩ Detail Review',
      '[not a date] Detail Review → Tech Design',
      '[2026-11-04 17:45] ✓ Release   ',
      '[2026-11-04 18:00] no separator here',
      '[2026-11-04 18:00] →',
    ].join('\r\n');
    const entries = parseHistory(text);
    expect(entries.map((x) => [x.kind, x.from, x.to])).toEqual([
      ['start', undefined, 'Detail Review'],
      ['advance', 'Detail Review', 'Tech Design'],
      ['rollback', 'Tech Design', 'Detail Review'],
      ['advance', 'Detail Review', 'Tech Design'],
      ['complete', undefined, 'Release'],
    ]);
    expect(entries[0].at).toBe(new Date(2026, 10, 2, 9, 0).getTime());
    expect(entries[2].at).toBe(new Date(2026, 10, 3, 8, 5).getTime());
    expect(entries[3].at).toBeNaN();
    expect(entries[4].raw).toBe('[2026-11-04 17:45] ✓ Release');
  });

  it('truncates timestamps to the minute', () => {
    const withSeconds = new Date(2026, 10, 2, 14, 3, 42, 500).getTime();
    const [entry] = parseHistory(formatHistoryLine({ at: withSeconds, kind: 'start', to: 'A' }));
    expect(entry.at).toBe(at);
  });

  it('rejects impossible dates instead of rolling them over', () => {
    expect(parseHistory('[2026-13-45 10:00] ▶ A')[0].at).toBeNaN();
    expect(parseHistory('[2026-02-30 10:00] ▶ A')[0].at).toBeNaN();
  });

  it('accepts a date-only stamp', () => {
    expect(parseHistory('[2026-11-02] ▶ A')[0].at).toBe(new Date(2026, 10, 2).getTime());
  });

  it('only treats arrows surrounded by single spaces as separators', () => {
    const [entry] = parseHistory('[2026-11-02 14:03] A→B → C↩D');
    expect(entry).toMatchObject({ kind: 'advance', from: 'A→B', to: 'C↩D' });
  });

  it('splits on the left-most separator when a line has several', () => {
    expect(parseHistory('[2026-11-02 14:03] A ↩ B → C')[0]).toMatchObject({ kind: 'rollback', from: 'A', to: 'B → C' });
    expect(parseHistory('[2026-11-02 14:03] A → B ↩ C')[0]).toMatchObject({ kind: 'advance', from: 'A', to: 'B ↩ C' });
  });

  it('returns [] for empty or non-string input', () => {
    expect(parseHistory('')).toEqual([]);
    expect(parseHistory(null as unknown as string)).toEqual([]);
    expect(parseHistory('just text\nmore text')).toEqual([]);
  });
});

describe('appendHistory', () => {
  it('starts a log from nothing', () => {
    expect(appendHistory('', 'L1')).toBe('L1');
  });

  it('appends with a newline and normalises CRLF / blank lines', () => {
    expect(appendHistory('L1\r\n\r\nL2\n', 'L3')).toBe('L1\nL2\nL3');
  });

  it('keeps only the last maxLines lines', () => {
    expect(appendHistory('L1\nL2\nL3', 'L4', 2)).toBe('L3\nL4');
    expect(appendHistory('L1\nL2', 'L3', 0)).toBe('L3');
  });

  it('defaults to 200 lines', () => {
    const existing = Array.from({ length: 250 }, (_, i) => `L${i}`).join('\n');
    const out = appendHistory(existing, 'NEW').split('\n');
    expect(out).toHaveLength(200);
    expect(out[0]).toBe('L51');
    expect(out[199]).toBe('NEW');
  });

  it('round-trips through parseHistory', () => {
    let log = '';
    log = appendHistory(log, formatHistoryLine({ at, kind: 'start', to: 'Phân tích' }));
    log = appendHistory(log, formatHistoryLine({ at, kind: 'advance', from: 'Phân tích', to: '开发' }));
    expect(parseHistory(log).map((x) => x.to)).toEqual(['Phân tích', '开发']);
  });
});
