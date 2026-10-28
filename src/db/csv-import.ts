import type { SQLiteDatabase } from 'expo-sqlite';

import { CATEGORY_COLORS } from '@/constants/palette';
import { parseCsv } from '@/lib/csv';
import { normalizeForSearch } from '@/lib/search';

import { createCategory, createWallet } from './repo';
import type { TransactionType } from './types';

/** One transaction read from a CSV row, before categories and wallets are resolved. */
export type CsvTransaction = {
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  wallet: string;
  amount: number;
  note: string;
};

export type CsvParseResult = {
  rows: CsvTransaction[];
  /** Spreadsheet line numbers (1-based, header = 1) that couldn't be read. */
  invalidLines: number[];
};

export type CsvImportResult = {
  added: number;
  /** Rows identical to a transaction already in the app, e.g. when importing the same file twice. */
  duplicates: number;
  createdWallets: string[];
  createdCategories: string[];
};

export class CsvImportError extends Error {}

// Column headers as written by the CSV export, compared without diacritics.
const COLUMNS = {
  date: ['ngay', 'date'],
  type: ['loai', 'type'],
  category: ['danh muc', 'category'],
  wallet: ['vi', 'wallet'],
  amount: ['so tien', 'amount'],
  note: ['ghi chu', 'note'],
};

/** Reads transactions from a CSV file in the format the app exports (Excel edits welcome). */
export function parseTransactionsCsv(text: string): CsvParseResult {
  const [header, ...lines] = parseCsv(text);
  const normalizedHeader = (header ?? []).map((h) => normalizeForSearch(h.trim()));
  const column = (names: string[]) => normalizedHeader.findIndex((h) => names.includes(h));
  const index = {
    date: column(COLUMNS.date),
    type: column(COLUMNS.type),
    category: column(COLUMNS.category),
    wallet: column(COLUMNS.wallet),
    amount: column(COLUMNS.amount),
    note: column(COLUMNS.note),
  };
  if (index.date < 0 || index.amount < 0) {
    throw new CsvImportError('File CSV cần có ít nhất cột "Ngày" và "Số tiền", như file xuất từ ứng dụng.');
  }

  const rows: CsvTransaction[] = [];
  const invalidLines: number[] = [];
  lines.forEach((cells, i) => {
    const cell = (at: number) => (at >= 0 ? (cells[at] ?? '').trim() : '');
    const date = parseCsvDate(cell(index.date));
    const rawAmount = cell(index.amount);
    const amount = parseCsvAmount(rawAmount);
    if (!date || !amount) {
      invalidLines.push(i + 2);
      return;
    }
    const typeText = normalizeForSearch(cell(index.type));
    const type: TransactionType = typeText.startsWith('thu') || typeText === 'income' ? 'income' : 'expense';
    rows.push({
      date,
      type,
      amount,
      category: cell(index.category) || (type === 'income' ? 'Thu nhập khác' : 'Khác'),
      wallet: cell(index.wallet),
      note: cell(index.note),
    });
  });
  return { rows, invalidLines };
}

/** dd/mm/yyyy (as exported, also with - or .), d/m/yyyy, or yyyy-mm-dd. */
function parseCsvDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (!iso && !dmy) return null;
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : [dmy![3], dmy![2], dmy![1]];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** "150000", "150.000", "150,000 ₫" or "-150000" → 150000. Decimal parts (Excel's ",00") are dropped. */
function parseCsvAmount(text: string): number | null {
  const whole = text.replace(/[.,]\d{1,2}\s*(₫|đ|vnd)?\s*$/i, '');
  const digits = whole.replace(/\D/g, '');
  const value = Number(digits);
  return digits && value > 0 && Number.isSafeInteger(value) ? value : null;
}

const key = (name: string) => normalizeForSearch(name.trim());

/**
 * Adds the rows as transactions, creating wallets and categories that don't
 * exist yet. Rows matching an existing transaction exactly are skipped, as
 * many times as that transaction already exists, so re-importing a file adds
 * nothing while genuine repeats (two coffees on one day) in a new file are kept.
 */
export async function importTransactions(db: SQLiteDatabase, rows: CsvTransaction[]): Promise<CsvImportResult> {
  const result: CsvImportResult = { added: 0, duplicates: 0, createdWallets: [], createdCategories: [] };

  await db.withTransactionAsync(async () => {
    const wallets = await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM wallets ORDER BY id');
    const walletIds = new Map(wallets.map((w) => [key(w.name), w.id]));
    // Active categories win over archived ones with the same name.
    const categories = await db.getAllAsync<{ id: number; name: string; type: string }>(
      'SELECT id, name, type FROM categories ORDER BY archived DESC, id DESC'
    );
    const categoryIds = new Map(categories.map((c) => [`${c.type}|${key(c.name)}`, c.id]));

    const existing = new Map<string, number>();
    const existingRows = await db.getAllAsync<{ k: string }>(
      `SELECT date || '|' || type || '|' || amount || '|' || category_id || '|' || wallet_id || '|' || note AS k
       FROM transactions`
    );
    for (const { k } of existingRows) existing.set(k, (existing.get(k) ?? 0) + 1);

    for (const row of rows) {
      let walletId = row.wallet ? walletIds.get(key(row.wallet)) : wallets[0]?.id;
      if (walletId == null) {
        const name = row.wallet || 'Ví';
        walletId = await createWallet(db, { name, icon: 'wallet', initialBalance: 0 });
        walletIds.set(key(name), walletId);
        result.createdWallets.push(name);
      }

      const categoryKey = `${row.type}|${key(row.category)}`;
      let categoryId = categoryIds.get(categoryKey);
      if (categoryId == null) {
        categoryId = await createCategory(db, {
          name: row.category,
          type: row.type,
          icon: 'pricetag',
          color: CATEGORY_COLORS[(categoryIds.size + result.createdCategories.length) % CATEGORY_COLORS.length],
        });
        categoryIds.set(categoryKey, categoryId);
        result.createdCategories.push(row.category);
      }

      const rowKey = [row.date, row.type, row.amount, categoryId, walletId, row.note].join('|');
      const remaining = existing.get(rowKey) ?? 0;
      if (remaining > 0) {
        existing.set(rowKey, remaining - 1);
        result.duplicates++;
        continue;
      }
      await db.runAsync(
        'INSERT INTO transactions (type, amount, category_id, wallet_id, date, note) VALUES (?, ?, ?, ?, ?, ?)',
        row.type,
        row.amount,
        categoryId,
        walletId,
        row.date,
        row.note
      );
      result.added++;
    }
  });
  return result;
}
