import type { SQLiteDatabase } from 'expo-sqlite';

import { strings } from '@/i18n';

/**
 * Full backup of everything the user entered: wallets, categories (archived
 * ones too, since old transactions use them), transactions, budgets and the
 * attached transfer screenshots. Restoring it on another phone gives back the
 * exact same app, unlike the CSV export.
 */
export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  wallets: { id: number; name: string; icon: string; initialBalance: number }[];
  categories: { id: number; name: string; type: string; icon: string; color: string; archived: number }[];
  transactions: {
    id: number;
    type: string;
    amount: number;
    categoryId: number;
    walletId: number;
    date: string;
    note: string;
    createdAt: string;
    receipt: string | null;
  }[];
  budgets: { categoryId: number; amount: number }[];
  /** Receipt key (as stored on the transaction) → image as base64. */
  receipts: Record<string, string>;
};

const BACKUP_FORMAT = 'chi-tieu-backup';
const BACKUP_VERSION = 1;

/** Reads / writes attached images; injected so this module stays free of file-system code. */
export type ReceiptIO = {
  /** The image as base64, or null if it can't be read. */
  read: (receipt: string) => Promise<string | null>;
  /** Stores a restored image and returns the value to save on the transaction. */
  write: (key: string, base64: string) => Promise<string>;
};

export async function createBackup(db: SQLiteDatabase, receiptIO: ReceiptIO, now = new Date()): Promise<Backup> {
  const transactions = await db.getAllAsync<Backup['transactions'][number]>(
    `SELECT id, type, amount, category_id AS categoryId, wallet_id AS walletId, date, note,
       created_at AS createdAt, receipt
     FROM transactions ORDER BY id`
  );
  const receipts: Record<string, string> = {};
  for (const tx of transactions) {
    if (!tx.receipt) continue;
    const base64 = await receiptIO.read(tx.receipt);
    // Web keeps the image itself in the column; give it a short key instead.
    const key = tx.receipt.startsWith('data:') ? `receipt-${tx.id}.jpg` : tx.receipt;
    if (base64) receipts[key] = base64;
    tx.receipt = base64 ? key : null;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    wallets: await db.getAllAsync(
      'SELECT id, name, icon, initial_balance AS initialBalance FROM wallets ORDER BY id'
    ),
    categories: await db.getAllAsync('SELECT id, name, type, icon, color, archived FROM categories ORDER BY id'),
    transactions,
    budgets: await db.getAllAsync('SELECT category_id AS categoryId, amount FROM budgets ORDER BY category_id'),
    receipts,
  };
}

export class BackupError extends Error {}

/** Reads a backup file, with an error message for the user when it isn't one. */
export function parseBackup(text: string): Backup {
  let data: Partial<Backup>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError(strings().files.backupInvalid);
  }
  if (data?.format !== BACKUP_FORMAT) throw new BackupError(strings().files.notBackup);
  if ((data.version ?? 0) > BACKUP_VERSION) {
    throw new BackupError(strings().files.backupTooNew);
  }
  for (const key of ['wallets', 'categories', 'transactions', 'budgets'] as const) {
    if (!Array.isArray(data[key])) throw new BackupError(strings().files.backupIncomplete);
  }
  return { receipts: {}, ...data } as Backup;
}

/** Replaces all data with the backup's. Callers must confirm with the user first. */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup, receiptIO: ReceiptIO): Promise<void> {
  // Images first, outside the transaction: they are just files, and a failure
  // here should leave the current data untouched.
  const storedReceipts = new Map<string, string>();
  for (const [key, base64] of Object.entries(backup.receipts)) {
    storedReceipts.set(key, await receiptIO.write(key, base64));
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM budgets');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM wallets');
    for (const w of backup.wallets) {
      await db.runAsync(
        'INSERT INTO wallets (id, name, icon, initial_balance) VALUES (?, ?, ?, ?)',
        w.id,
        w.name,
        w.icon,
        w.initialBalance
      );
    }
    for (const c of backup.categories) {
      await db.runAsync(
        'INSERT INTO categories (id, name, type, icon, color, archived) VALUES (?, ?, ?, ?, ?, ?)',
        c.id,
        c.name,
        c.type,
        c.icon,
        c.color,
        c.archived ? 1 : 0
      );
    }
    for (const t of backup.transactions) {
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, category_id, wallet_id, date, note, created_at, receipt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id,
        t.type,
        t.amount,
        t.categoryId,
        t.walletId,
        t.date,
        t.note ?? '',
        t.createdAt ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
        (t.receipt && storedReceipts.get(t.receipt)) ?? null
      );
    }
    for (const b of backup.budgets) {
      await db.runAsync('INSERT INTO budgets (category_id, amount) VALUES (?, ?)', b.categoryId, b.amount);
    }
  });
}
