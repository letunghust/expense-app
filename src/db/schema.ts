import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'expenses.db';

const DATABASE_VERSION = 2;

const DEFAULT_CATEGORIES: [name: string, type: 'income' | 'expense', icon: string, color: string][] = [
  ['Ăn uống', 'expense', 'restaurant', '#F97316'],
  ['Đi lại', 'expense', 'car', '#3B82F6'],
  ['Mua sắm', 'expense', 'bag-handle', '#EC4899'],
  ['Hóa đơn', 'expense', 'receipt', '#EAB308'],
  ['Nhà cửa', 'expense', 'home', '#8B5CF6'],
  ['Giải trí', 'expense', 'game-controller', '#14B8A6'],
  ['Sức khỏe', 'expense', 'medkit', '#EF4444'],
  ['Giáo dục', 'expense', 'school', '#6366F1'],
  ['Gia đình', 'expense', 'people', '#F43F5E'],
  ['Khác', 'expense', 'ellipsis-horizontal', '#6B7280'],
  ['Lương', 'income', 'cash', '#22C55E'],
  ['Thưởng', 'income', 'gift', '#10B981'],
  ['Đầu tư', 'income', 'trending-up', '#0EA5E9'],
  ['Thu nhập khác', 'income', 'wallet', '#84CC16'],
];

/**
 * Runs from SQLiteProvider's onInit before any screen renders. Each schema
 * change gets a new `if (version === n)` step so existing installs upgrade in place.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = result?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE wallets (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'wallet',
        initial_balance INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        category_id INTEGER NOT NULL REFERENCES categories(id),
        wallet_id INTEGER NOT NULL REFERENCES wallets(id),
        date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_transactions_date ON transactions(date);
      CREATE INDEX idx_transactions_category ON transactions(category_id);
      CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);

      -- One monthly spending limit per expense category.
      CREATE TABLE budgets (
        category_id INTEGER PRIMARY KEY NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount > 0)
      );
    `);

    await db.withTransactionAsync(async () => {
      await db.runAsync("INSERT INTO wallets (name, icon) VALUES ('Tiền mặt', 'cash')");
      await db.runAsync("INSERT INTO wallets (name, icon) VALUES ('Tài khoản ngân hàng', 'card')");
      for (const [name, type, icon, color] of DEFAULT_CATEGORIES) {
        await db.runAsync(
          'INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)',
          name,
          type,
          icon,
          color
        );
      }
    });
    version = 1;
  }

  if (version === 1) {
    // File name of the transfer screenshot attached to a transaction (see lib/receipt-files).
    await db.execAsync('ALTER TABLE transactions ADD COLUMN receipt TEXT');
    version = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
