import { describe, expect, it } from 'vitest';
import { FieldType } from '../../types';
import type { FieldMeta } from '../../types';
import {
  cellToText,
  formatDateTime,
  formatDuration,
  getMultiSelectIds,
  getSelectId,
  getUsers,
  isCellEmpty,
  isComputedField,
  isEditableInline,
  makeSelectValue,
  makeUrlValue,
  segmentsToText,
  textToSegments,
} from '../cell';

const f = (type: FieldType, property?: unknown): FieldMeta => ({ id: `f${type}`, name: `Field ${type}`, type, isPrimary: false, property });

const ts = new Date(2026, 10, 2, 14, 3, 59).getTime(); // local 2026-11-02 14:03:59
const seg = (text: string) => ({ type: 'text', text });
const users = [
  { id: 'ou_1', name: 'An Nguyễn', enName: 'An', email: 'an@x.com' },
  { id: 'ou_2', enName: 'Bob' },
  { id: 'ou_3', email: 'carol@x.com' },
  { id: 'ou_4' },
];
const attachment = (name: string) => ({ name, size: 10, type: 'image/png', token: `tok_${name}`, timeStamp: 1 });
const link = { text: 'Record A,Record B', type: 'text', recordIds: ['rec1', 'rec2'], tableId: 'tbl1' };
const location = {
  address: '1 Đường Lê Lợi',
  adname: 'Quận 1',
  cityname: 'Hồ Chí Minh',
  name: 'Chợ Bến Thành',
  pname: 'HCM',
  fullAddress: 'Chợ Bến Thành, 1 Đường Lê Lợi, Quận 1',
  location: '106.69,10.77',
};

describe('cellToText', () => {
  it.each<[string, FieldMeta | undefined, unknown, string]>([
    ['null', f(FieldType.Text), null, ''],
    ['undefined', undefined, undefined, ''],
    ['text segments joined', f(FieldType.Text), [seg('Hello '), seg('world')], 'Hello world'],
    ['mention segment', f(FieldType.Text), [seg('Ping '), { type: 'mention', mentionType: 'User', text: '@An', token: 't', id: 'ou_1', name: 'An' }], 'Ping @An'],
    ['url segments', f(FieldType.Url), [{ type: 'url', text: 'Spec', link: 'https://x.dev' }], 'Spec'],
    ['email', f(FieldType.Email), [seg('a@b.c')], 'a@b.c'],
    ['barcode', f(FieldType.Barcode), [seg('8935')], '8935'],
    ['plain string', f(FieldType.Phone), '+84 90 000', '+84 90 000'],
    ['single select', f(FieldType.SingleSelect), { id: 'o1', text: 'Tech Design' }, 'Tech Design'],
    ['multi select', f(FieldType.MultiSelect), [{ id: 'o1', text: 'FE' }, { id: 'o2', text: 'BE' }], 'FE, BE'],
    ['users with name fallbacks', f(FieldType.User), users, 'An Nguyễn, Bob, carol@x.com, ou_4'],
    ['created user', f(FieldType.CreatedUser), [users[0]], 'An Nguyễn'],
    ['date time', f(FieldType.DateTime), ts, '2026-11-02 14:03'],
    ['date only format', f(FieldType.DateTime, { dateFormat: 'yyyy/MM/dd' }), ts, '2026-11-02'],
    ['date with time format', f(FieldType.DateTime, { dateFormat: 'yyyy-MM-dd HH:mm' }), ts, '2026-11-02 14:03'],
    ['created time', f(FieldType.CreatedTime), ts, '2026-11-02 14:03'],
    ['modified time', f(FieldType.ModifiedTime), ts, '2026-11-02 14:03'],
    ['checkbox checked', f(FieldType.Checkbox), true, '✓'],
    ['checkbox unchecked', f(FieldType.Checkbox), false, ''],
    ['integer', f(FieldType.Number), 42, '42'],
    ['zero', f(FieldType.Number), 0, '0'],
    ['float noise trimmed', f(FieldType.Number), 0.1 + 0.2, '0.3'],
    ['negative', f(FieldType.Currency), -12.5, '-12.5'],
    ['rating', f(FieldType.Rating), 4, '4'],
    ['progress as percent', f(FieldType.Progress), 0.07, '7%'],
    ['NaN', f(FieldType.Number), NaN, ''],
    ['attachments', f(FieldType.Attachment), [attachment('a.png'), attachment('b.pdf')], 'a.png, b.pdf'],
    ['link', f(FieldType.DuplexLink), link, 'Record A,Record B'],
    ['link without text', f(FieldType.SingleLink), { recordIds: ['r1'], tableId: 't', type: 'text' }, ''],
    ['autonumber', f(FieldType.AutoNumber), { value: '000123', status: 'completed' }, '000123'],
    ['location full address', f(FieldType.Location), location, location.fullAddress],
    ['location name fallback', f(FieldType.Location), { ...location, fullAddress: '' }, 'Chợ Bến Thành'],
    ['location deprecated key', f(FieldType.Location), { full_address: 'Old addr', location: '1,2' }, 'Old addr'],
    ['group chat', f(FieldType.GroupChat), [{ id: 'oc_1', name: 'Team A', avatarUrl: 'u' }, { id: 'oc_2', name: 'Team B', avatarUrl: 'u' }], 'Team A, Team B'],
    ['formula number', f(FieldType.Formula), 3.5, '3.5'],
    ['formula string', f(FieldType.Formula), 'OK', 'OK'],
    ['formula segments', f(FieldType.Formula), [seg('a'), seg('b')], 'ab'],
    ['formula number array', f(FieldType.Formula), [1, 2, 3], '1, 2, 3'],
    [
      'formula mixed array',
      f(FieldType.Formula),
      [[seg('x'), seg('y')], 7, 'z', null, { id: 'o1', text: 'Opt' }, users[1], attachment('c.txt')],
      'xy, 7, z, Opt, Bob, c.txt',
    ],
    ['lookup of links', f(FieldType.Lookup), [link, { ...link, text: 'Record C' }], 'Record A,Record B, Record C'],
    ['lookup nested arrays', f(FieldType.Lookup), [[{ id: 'o', text: 'A' }], [], [[seg('B')]]], 'A, B'],
    ['empty array', f(FieldType.MultiSelect), [], ''],
    ['unknown object', f(FieldType.NotSupport), { foo: 1 }, ''],
    ['unknown type value', f(FieldType.Text), Symbol.for('x'), ''],
  ])('%s', (_label, field, value, expected) => {
    expect(cellToText(field, value)).toBe(expected);
  });

  it('sniffs the shape when the field is unknown', () => {
    expect(cellToText(undefined, [seg('A'), seg('B')])).toBe('AB');
    expect(cellToText(undefined, { id: 'o1', text: 'Opt' })).toBe('Opt');
    expect(cellToText(undefined, users.slice(0, 2))).toBe('An Nguyễn, Bob');
    expect(cellToText(undefined, link)).toBe('Record A,Record B');
    expect(cellToText(undefined, { value: '7', status: 'completed' })).toBe('7');
    expect(cellToText(undefined, location)).toBe(location.fullAddress);
    expect(cellToText(undefined, 12)).toBe('12');
    expect(cellToText(undefined, true)).toBe('✓');
  });

  it('accepts a language argument', () => {
    expect(cellToText(f(FieldType.Text), [seg('x')], 'vi')).toBe('x');
    expect(cellToText(f(FieldType.Text), [seg('x')], 'en')).toBe('x');
  });
});

describe('isCellEmpty', () => {
  it.each<[string, FieldType, unknown, boolean]>([
    ['null', FieldType.Text, null, true],
    ['undefined', FieldType.Text, undefined, true],
    ['empty segment array', FieldType.Text, [], true],
    ['whitespace segments', FieldType.Text, [seg('  '), seg('\n')], true],
    ['text segments', FieldType.Text, [seg(' a ')], false],
    ['empty string', FieldType.Phone, '', true],
    ['whitespace string', FieldType.Phone, '   ', true],
    ['phone', FieldType.Phone, '0900', false],
    ['zero', FieldType.Number, 0, false],
    ['negative number', FieldType.Number, -1, false],
    ['NaN', FieldType.Number, NaN, true],
    ['date', FieldType.DateTime, ts, false],
    ['checkbox true', FieldType.Checkbox, true, false],
    ['checkbox false', FieldType.Checkbox, false, true],
    ['checkbox null', FieldType.Checkbox, null, true],
    ['checkbox truthy non-boolean', FieldType.Checkbox, 1, true],
    ['single select', FieldType.SingleSelect, { id: 'o1', text: 'A' }, false],
    ['multi select empty', FieldType.MultiSelect, [], true],
    ['users', FieldType.User, [{ id: 'ou_1' }], false],
    ['users empty', FieldType.User, [], true],
    ['url with text', FieldType.Url, [{ type: 'url', text: 'x', link: 'https://x' }], false],
    ['url with link only', FieldType.Url, [{ type: 'url', text: '', link: 'https://x' }], false],
    ['url blank', FieldType.Url, [{ type: 'url', text: ' ', link: '' }], true],
    ['attachments', FieldType.Attachment, [attachment('a.png')], false],
    ['link with records', FieldType.DuplexLink, link, false],
    ['link without records', FieldType.SingleLink, { text: '', type: 'text', recordIds: [], tableId: 't' }, true],
    ['link deprecated record_ids', FieldType.SingleLink, { text: 'x', type: 'text', record_ids: ['r1'], table_id: 't' }, false],
    ['link deprecated record_ids empty', FieldType.SingleLink, { text: '', record_ids: [] }, true],
    ['autonumber', FieldType.AutoNumber, { value: '12', status: 'completed' }, false],
    ['autonumber empty', FieldType.AutoNumber, { value: '', status: 'calculating' }, true],
    ['location', FieldType.Location, location, false],
    ['location blank', FieldType.Location, { address: '', name: '', fullAddress: '', location: '' }, true],
    ['group chat', FieldType.GroupChat, [{ id: 'oc_1', name: 'Team', avatarUrl: '' }], false],
    ['formula false', FieldType.Formula, false, false],
    ['formula [null]', FieldType.Formula, [null], true],
    ['formula nested empties', FieldType.Lookup, [[], [seg(' ')], null], true],
    ['formula mixed with a value', FieldType.Lookup, [null, 0], false],
    ['empty object', FieldType.NotSupport, {}, true],
  ])('%s -> %s', (_label, type, value, expected) => {
    expect(isCellEmpty(f(type), value)).toBe(expected);
  });
});

describe('select helpers', () => {
  it('getSelectId reads {id,text}, tolerates arrays and garbage', () => {
    expect(getSelectId({ id: 'o1', text: 'A' })).toBe('o1');
    expect(getSelectId([{ id: 'o2', text: 'B' }, { id: 'o3', text: 'C' }])).toBe('o2');
    expect(getSelectId(null)).toBeNull();
    expect(getSelectId(undefined)).toBeNull();
    expect(getSelectId([])).toBeNull();
    expect(getSelectId('o1')).toBeNull();
    expect(getSelectId({ text: 'no id' })).toBeNull();
    expect(getSelectId({ id: '', text: 'x' })).toBeNull();
  });

  it('getMultiSelectIds returns unique ids in order', () => {
    expect(getMultiSelectIds([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'a', text: 'A' }])).toEqual(['a', 'b']);
    expect(getMultiSelectIds({ id: 'a', text: 'A' })).toEqual(['a']);
    expect(getMultiSelectIds(null)).toEqual([]);
    expect(getMultiSelectIds([null, 'x', { text: 'y' }])).toEqual([]);
  });

  it('makeSelectValue maps option name to text', () => {
    expect(makeSelectValue({ id: 'o1', name: 'Tech Design' })).toEqual({ id: 'o1', text: 'Tech Design' });
  });
});

describe('getUsers', () => {
  it('falls back from name to enName, email, then id', () => {
    expect(getUsers(users)).toEqual([
      { id: 'ou_1', name: 'An Nguyễn' },
      { id: 'ou_2', name: 'Bob' },
      { id: 'ou_3', name: 'carol@x.com' },
      { id: 'ou_4', name: 'ou_4' },
    ]);
  });

  it('accepts the deprecated en_name, a single object and garbage', () => {
    expect(getUsers([{ id: 'ou_5', en_name: 'Old' }])).toEqual([{ id: 'ou_5', name: 'Old' }]);
    expect(getUsers({ id: 'ou_6', name: 'Solo' })).toEqual([{ id: 'ou_6', name: 'Solo' }]);
    expect(getUsers(null)).toEqual([]);
    expect(getUsers([null, 3, {}])).toEqual([]);
  });
});

describe('text helpers', () => {
  it('segmentsToText joins segments and passes strings through', () => {
    expect(segmentsToText([seg('a'), { type: 'url', text: 'b', link: 'l' }, 'c', 5, null])).toBe('abc');
    expect(segmentsToText('plain')).toBe('plain');
    expect(segmentsToText(seg('one'))).toBe('one');
    expect(segmentsToText(null)).toBe('');
    expect(segmentsToText(12)).toBe('');
  });

  it('textToSegments wraps text and returns null for an empty string', () => {
    expect(textToSegments('Hello')).toEqual([{ type: 'text', text: 'Hello' }]);
    expect(textToSegments('')).toBeNull();
    expect(segmentsToText(textToSegments('line1\nline2'))).toBe('line1\nline2');
  });

  it('makeUrlValue defaults the text to the link and rejects blank links', () => {
    expect(makeUrlValue('https://x.dev')).toEqual([{ type: 'url', text: 'https://x.dev', link: 'https://x.dev' }]);
    expect(makeUrlValue(' https://x.dev ', 'Docs')).toEqual([{ type: 'url', text: 'Docs', link: 'https://x.dev' }]);
    expect(makeUrlValue('https://x.dev', '')).toEqual([{ type: 'url', text: 'https://x.dev', link: 'https://x.dev' }]);
    expect(makeUrlValue('')).toBeNull();
    expect(makeUrlValue('   ')).toBeNull();
  });
});

describe('field capabilities', () => {
  it('isComputedField lists exactly the read-only computed types', () => {
    const computed = [
      FieldType.Formula,
      FieldType.Lookup,
      FieldType.CreatedTime,
      FieldType.ModifiedTime,
      FieldType.CreatedUser,
      FieldType.ModifiedUser,
      FieldType.AutoNumber,
    ];
    for (const t of computed) expect(isComputedField(t)).toBe(true);
    for (const t of [FieldType.Text, FieldType.Number, FieldType.User, FieldType.DuplexLink, FieldType.Attachment]) {
      expect(isComputedField(t)).toBe(false);
    }
  });

  it('isEditableInline covers the inline editor types only', () => {
    const inline = [
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
    ];
    for (const t of inline) expect(isEditableInline(f(t))).toBe(true);
    for (const t of [FieldType.User, FieldType.Attachment, FieldType.DuplexLink, FieldType.Location, FieldType.Formula, FieldType.GroupChat]) {
      expect(isEditableInline(f(t))).toBe(false);
    }
  });
});

describe('formatDuration', () => {
  const S = 1000;
  const M = 60 * S;
  const H = 60 * M;
  const D = 24 * H;

  it.each<[number, string, string]>([
    [0, '0 giây', '0 sec'],
    [999, '0 giây', '0 sec'],
    [45 * S, '45 giây', '45 sec'],
    [59 * S, '59 giây', '59 sec'],
    [60 * S, '1 phút', '1 min'],
    [89 * S, '1 phút', '1 min'],
    [5 * M, '5 phút', '5 min'],
    [H, '1 giờ', '1 hour'],
    [3 * H, '3 giờ', '3 hours'],
    [D, '1 ngày', '1 day'],
    [2 * D, '2 ngày', '2 days'],
    [6 * D + 23 * H, '6 ngày', '6 days'],
    [7 * D, '1 tuần', '1 week'],
    [3 * 7 * D, '3 tuần', '3 weeks'],
    [29 * D, '4 tuần', '4 weeks'],
    [30 * D, '1 tháng', '1 month'],
    [11 * 30 * D, '11 tháng', '11 months'],
    [364 * D, '12 tháng', '12 months'],
    [365 * D, '1 năm', '1 year'],
    [2 * 365 * D, '2 năm', '2 years'],
    [-5000, '0 giây', '0 sec'],
    [NaN, '0 giây', '0 sec'],
  ])('%d ms -> "%s" / "%s"', (ms, vi, en) => {
    expect(formatDuration(ms, 'vi')).toBe(vi);
    expect(formatDuration(ms, 'en')).toBe(en);
  });
});

describe('formatDateTime', () => {
  it('formats local time zero-padded', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 7, 3).getTime())).toBe('2026-01-05 07:03');
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59, 59).getTime())).toBe('2026-12-31 23:59');
    expect(formatDateTime(ts)).toBe('2026-11-02 14:03');
  });

  it('supports date-only output', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 7, 3).getTime(), true)).toBe('2026-01-05');
  });

  it('returns "" for invalid timestamps', () => {
    expect(formatDateTime(NaN)).toBe('');
    expect(formatDateTime(Infinity)).toBe('');
    expect(formatDateTime(8.64e15 + 1)).toBe('');
    expect(formatDateTime('2026' as unknown as number)).toBe('');
  });
});
