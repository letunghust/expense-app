import { openTestDb } from '@/db/__testutils__/test-db';
import { importTransactions, parseTransactionsCsv } from '@/db/csv-import';
import { listAllTransactions, listCategories } from '@/db/repo';
import { migrateDbIfNeeded } from '@/db/schema';
import { formatDate, formatDayHeader, formatMonth } from '@/lib/dates';
import { toCsv } from '@/lib/csv';
import { formatCompactVND, formatVND, parseAmount } from '@/lib/money';

import { LANGUAGES, setStringsLanguage, strings, stringsFor } from '../index';
import { categoryLabel, nameToStore, storedCategoryName, walletLabel } from '../defaults';
import { vi } from '../vi';

afterEach(() => setStringsLanguage('vi'));

/** Every string leaf (functions are called with sample values). */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') return [[path, String(value(1, 2, 3))]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return Object.entries(value as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

describe('translations', () => {
  test.each(LANGUAGES)('%s has every string, none empty', (language) => {
    const strings = leaves(stringsFor(language));
    expect(strings.map(([path]) => path)).toEqual(leaves(vi).map(([path]) => path));
    expect(strings.filter(([, text]) => text.trim() === '').map(([path]) => path)).toEqual([]);
  });

  test('non-Vietnamese languages are actually translated', () => {
    for (const language of LANGUAGES.filter((l) => l !== 'vi')) {
      expect(stringsFor(language).transaction.save).not.toBe(vi.transaction.save);
      expect(stringsFor(language).defaults.categories.food).not.toBe(vi.defaults.categories.food);
    }
  });
});

describe('formatting follows the language', () => {
  test('Vietnamese', () => {
    expect(formatVND(1_250_000)).toBe('1.250.000 ₫');
    expect(formatCompactVND(1_250_000)).toBe('1,3tr');
    expect(formatMonth({ year: 2026, month: 10 })).toBe('Tháng 10/2026');
    expect(formatDayHeader('2026-10-26', '2026-10-31')).toBe('Thứ hai, 26/10/2026');
  });

  test('English', () => {
    setStringsLanguage('en');
    expect(formatVND(1_250_000)).toBe('1,250,000 ₫');
    expect(formatCompactVND(1_250_000)).toBe('1.3M');
    expect(formatMonth({ year: 2026, month: 10 })).toBe('October 2026');
    expect(formatDayHeader('2026-10-31', '2026-10-31')).toBe('Today');
    expect(formatDayHeader('2026-10-26', '2026-10-31')).toBe('Monday, 26/10/2026');
    expect(parseAmount('1,250,000')).toBe(1_250_000);
  });

  test('Japanese, Korean and Chinese', () => {
    setStringsLanguage('ja');
    expect(formatMonth({ year: 2026, month: 10 })).toBe('2026年10月');
    expect(formatDate('2026-10-26')).toBe('2026/10/26');
    expect(formatDayHeader('2026-10-26', '2026-10-31')).toBe('2026/10/26（月曜日）');
    setStringsLanguage('ko');
    expect(formatMonth({ year: 2026, month: 10 })).toBe('2026년 10월');
    setStringsLanguage('zh');
    expect(formatDayHeader('2026-10-30', '2026-10-31')).toBe('昨天');
  });
});

describe('built-in category and wallet names', () => {
  test('are shown in the current language; names the user typed are not', () => {
    setStringsLanguage('en');
    expect(categoryLabel('Ăn uống')).toBe('Food & drinks');
    expect(walletLabel('Tiền mặt')).toBe('Cash');
    expect(categoryLabel('Cà phê')).toBe('Cà phê');
  });

  test('saving an edited built-in name unchanged keeps it translatable', () => {
    setStringsLanguage('ko');
    expect(nameToStore('식비', 'Ăn uống', categoryLabel)).toBe('Ăn uống');
    expect(nameToStore('외식', 'Ăn uống', categoryLabel)).toBe('외식');
  });

  test('a CSV exported in Korean reads back into the same categories', async () => {
    setStringsLanguage('ko');
    const t = strings();
    const csv = toCsv(t.files.csvHeaders, [
      ['24/10/2026', t.common.expense, categoryLabel('Ăn uống'), walletLabel('Tiền mặt'), 37000, '커피'],
      ['25/10/2026', t.common.income, categoryLabel('Lương'), walletLabel('Tài khoản ngân hàng'), 15_000_000, ''],
    ]);
    const { rows, invalidLines } = parseTransactionsCsv(csv);
    expect(invalidLines).toEqual([]);
    expect(rows.map((r) => [r.type, r.category, r.wallet])).toEqual([
      ['expense', 'Ăn uống', 'Tiền mặt'],
      ['income', 'Lương', 'Tài khoản ngân hàng'],
    ]);

    const db = openTestDb();
    await migrateDbIfNeeded(db);
    const before = (await listCategories(db)).length;
    const result = await importTransactions(db, rows);
    expect(result).toMatchObject({ added: 2, createdWallets: [], createdCategories: [] });
    expect((await listCategories(db)).length).toBe(before);
    expect((await listAllTransactions(db)).map((r) => r.categoryName).sort()).toEqual(['Lương', 'Ăn uống']);
  });

  test('storedCategoryName maps every language back to the stored name', () => {
    for (const language of LANGUAGES) {
      expect(storedCategoryName(stringsFor(language).defaults.categories.otherIncome)).toBe('Thu nhập khác');
    }
  });
});
