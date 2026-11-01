import type { SQLiteDatabase } from 'expo-sqlite';

import { categoryLabel, walletLabel } from '@/i18n/defaults';
import { matchesSearch } from '@/lib/search';

import type {
  BudgetRow,
  Category,
  CategoryTotal,
  Transaction,
  TransactionInput,
  TransactionRow,
  TransactionType,
  Wallet,
  WalletWithBalance,
} from './types';

type DateRange = { start: string; end: string };

// ---------- Categories ----------

const CATEGORY_COLUMNS = 'id, name, type, icon, color';

export function listCategories(db: SQLiteDatabase, type?: TransactionType): Promise<Category[]> {
  return type
    ? db.getAllAsync<Category>(
        `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE archived = 0 AND type = ? ORDER BY id`,
        type
      )
    : db.getAllAsync<Category>(
        `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE archived = 0 ORDER BY type DESC, id`
      );
}

export function getCategory(db: SQLiteDatabase, id: number): Promise<Category | null> {
  return db.getFirstAsync<Category>(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`, id);
}

export async function createCategory(db: SQLiteDatabase, input: Omit<Category, 'id'>): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)',
    input.name,
    input.type,
    input.icon,
    input.color
  );
  return result.lastInsertRowId;
}

export async function updateCategory(db: SQLiteDatabase, category: Category): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?',
    category.name,
    category.icon,
    category.color,
    category.id
  );
}

/**
 * Categories that already have transactions are archived instead of deleted,
 * so old transactions keep their name and colour in history and reports.
 */
export async function removeCategory(db: SQLiteDatabase, id: number): Promise<void> {
  const used = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?',
    id
  );
  if (used && used.n > 0) {
    await db.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', id);
    await db.runAsync('DELETE FROM budgets WHERE category_id = ?', id);
  } else {
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  }
}

// ---------- Wallets ----------

export function listWallets(db: SQLiteDatabase): Promise<WalletWithBalance[]> {
  return db.getAllAsync<WalletWithBalance>(`
    SELECT w.id, w.name, w.icon, w.initial_balance AS initialBalance,
      w.initial_balance
        + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS balance,
      COUNT(t.id) AS transactionCount
    FROM wallets w
    LEFT JOIN transactions t ON t.wallet_id = w.id
    GROUP BY w.id
    ORDER BY w.id
  `);
}

export async function createWallet(db: SQLiteDatabase, input: Omit<Wallet, 'id'>): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO wallets (name, icon, initial_balance) VALUES (?, ?, ?)',
    input.name,
    input.icon,
    input.initialBalance
  );
  return result.lastInsertRowId;
}

export async function updateWallet(db: SQLiteDatabase, wallet: Wallet): Promise<void> {
  await db.runAsync(
    'UPDATE wallets SET name = ?, icon = ?, initial_balance = ? WHERE id = ?',
    wallet.name,
    wallet.icon,
    wallet.initialBalance,
    wallet.id
  );
}

/** Deletes a wallet together with its transactions. Callers must confirm with the user first. */
export async function deleteWallet(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions WHERE wallet_id = ?', id);
    await db.runAsync('DELETE FROM wallets WHERE id = ?', id);
  });
}

// ---------- Transactions ----------

export type TransactionFilter = DateRange & {
  type?: TransactionType;
  categoryId?: number;
  walletId?: number;
  search?: string;
};

const TRANSACTION_ROW_SELECT = `
  SELECT t.id, t.type, t.amount, t.category_id AS categoryId, t.wallet_id AS walletId,
    t.date, t.note, t.receipt,
    c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor,
    w.name AS walletName
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  JOIN wallets w ON w.id = t.wallet_id
`;

export async function listTransactions(db: SQLiteDatabase, filter: TransactionFilter): Promise<TransactionRow[]> {
  const where = ['t.date >= $start', 't.date < $end'];
  const params: Record<string, string | number> = { $start: filter.start, $end: filter.end };
  if (filter.type) {
    where.push('t.type = $type');
    params.$type = filter.type;
  }
  if (filter.categoryId) {
    where.push('t.category_id = $categoryId');
    params.$categoryId = filter.categoryId;
  }
  if (filter.walletId) {
    where.push('t.wallet_id = $walletId');
    params.$walletId = filter.walletId;
  }
  const rows = await db.getAllAsync<TransactionRow>(
    `${TRANSACTION_ROW_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.id DESC`,
    params
  );
  // Searched in JS: SQLite's LIKE/lower() only fold ASCII, which breaks on Vietnamese diacritics.
  const search = filter.search?.trim();
  // Built-in names match both as stored and as shown in the current language.
  const fields = (row: TransactionRow) => [row.note, row.categoryName, row.walletName, categoryLabel(row.categoryName), walletLabel(row.walletName)];
  return search ? rows.filter((row) => matchesSearch(fields(row), search)) : rows;
}

export function listRecentTransactions(db: SQLiteDatabase, limit: number): Promise<TransactionRow[]> {
  return db.getAllAsync<TransactionRow>(
    `${TRANSACTION_ROW_SELECT} ORDER BY t.date DESC, t.id DESC LIMIT ?`,
    limit
  );
}

export function listAllTransactions(db: SQLiteDatabase): Promise<TransactionRow[]> {
  return db.getAllAsync<TransactionRow>(`${TRANSACTION_ROW_SELECT} ORDER BY t.date DESC, t.id DESC`);
}

export function getTransaction(db: SQLiteDatabase, id: number): Promise<Transaction | null> {
  return db.getFirstAsync<Transaction>(
    `SELECT id, type, amount, category_id AS categoryId, wallet_id AS walletId, date, note, receipt
     FROM transactions WHERE id = ?`,
    id
  );
}

export async function createTransaction(db: SQLiteDatabase, input: TransactionInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO transactions (type, amount, category_id, wallet_id, date, note, receipt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    input.type,
    input.amount,
    input.categoryId,
    input.walletId,
    input.date,
    input.note,
    input.receipt ?? null
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(db: SQLiteDatabase, id: number, input: TransactionInput): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET type = ?, amount = ?, category_id = ?, wallet_id = ?, date = ?, note = ?, receipt = ?
     WHERE id = ?`,
    input.type,
    input.amount,
    input.categoryId,
    input.walletId,
    input.date,
    input.note,
    input.receipt ?? null,
    id
  );
}

export async function deleteTransaction(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

// ---------- Reports ----------

export async function getSummary(db: SQLiteDatabase, range: DateRange): Promise<{ income: number; expense: number }> {
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
    `SELECT
       SUM(CASE WHEN type = 'income' THEN amount END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount END) AS expense
     FROM transactions WHERE date >= ? AND date < ?`,
    range.start,
    range.end
  );
  return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
}

export function getTotalsByCategory(
  db: SQLiteDatabase,
  range: DateRange,
  type: TransactionType
): Promise<CategoryTotal[]> {
  return db.getAllAsync<CategoryTotal>(
    `SELECT c.id AS categoryId, c.name, c.icon, c.color, SUM(t.amount) AS total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.type = ? AND t.date >= ? AND t.date < ?
     GROUP BY c.id ORDER BY total DESC`,
    type,
    range.start,
    range.end
  );
}

/** Expense total per day of the range; days without spending are omitted. */
export function getDailyExpenses(db: SQLiteDatabase, range: DateRange): Promise<{ date: string; total: number }[]> {
  return db.getAllAsync<{ date: string; total: number }>(
    `SELECT date, SUM(amount) AS total FROM transactions
     WHERE type = 'expense' AND date >= ? AND date < ?
     GROUP BY date ORDER BY date`,
    range.start,
    range.end
  );
}

export async function getTotalBalance(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(`
    SELECT (SELECT COALESCE(SUM(initial_balance), 0) FROM wallets)
      + (SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) FROM transactions)
      AS total
  `);
  return row?.total ?? 0;
}

// ---------- Budgets ----------

/** Every active expense category with its monthly limit (if any) and how much was spent in the range. */
export function listBudgets(db: SQLiteDatabase, range: DateRange): Promise<BudgetRow[]> {
  return db.getAllAsync<BudgetRow>(
    `SELECT c.id AS categoryId, c.name, c.icon, c.color, b.amount AS "limit",
       COALESCE((SELECT SUM(t.amount) FROM transactions t
                 WHERE t.category_id = c.id AND t.type = 'expense' AND t.date >= ? AND t.date < ?), 0) AS spent
     FROM categories c
     LEFT JOIN budgets b ON b.category_id = c.id
     WHERE c.type = 'expense' AND c.archived = 0
     ORDER BY b.amount IS NULL, c.id`,
    range.start,
    range.end
  );
}

/** Sets the monthly limit for a category; null removes the budget. */
export async function setBudget(db: SQLiteDatabase, categoryId: number, amount: number | null): Promise<void> {
  if (amount == null) {
    await db.runAsync('DELETE FROM budgets WHERE category_id = ?', categoryId);
  } else {
    await db.runAsync(
      'INSERT INTO budgets (category_id, amount) VALUES (?, ?) ON CONFLICT(category_id) DO UPDATE SET amount = excluded.amount',
      categoryId,
      amount
    );
  }
}

// ---------- Maintenance ----------

/** Every receipt file name still referenced by a transaction. */
export async function listReceipts(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ receipt: string }>('SELECT receipt FROM transactions WHERE receipt IS NOT NULL');
  return rows.map((row) => row.receipt);
}

export async function deleteAllTransactions(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM transactions');
}
