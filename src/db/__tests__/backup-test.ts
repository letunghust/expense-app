import { toCsv } from '@/lib/csv';

import { openTestDb } from '../__testutils__/test-db';
import { type Backup, BackupError, createBackup, parseBackup, type ReceiptIO, restoreBackup } from '../backup';
import { CsvImportError, importTransactions, parseTransactionsCsv } from '../csv-import';
import {
  createTransaction,
  createWallet,
  listAllTransactions,
  listBudgets,
  listCategories,
  listWallets,
  removeCategory,
  setBudget,
} from '../repo';
import { migrateDbIfNeeded } from '../schema';

const OCT = { start: '2026-10-01', end: '2026-11-01' };

async function freshDb() {
  const db = openTestDb();
  await migrateDbIfNeeded(db);
  return db;
}

/** Image storage in memory: files by name. */
function memoryReceipts(files: Record<string, string> = {}): ReceiptIO & { files: Record<string, string> } {
  return {
    files,
    read: async (name) => files[name] ?? null,
    write: async (name, base64) => {
      files[name] = base64;
      return name;
    },
  };
}

describe('backup', () => {
  test('restoring on another phone gives back the same data, archived categories and images included', async () => {
    const source = await freshDb();
    const categories = await listCategories(source, 'expense');
    const food = categories.find((c) => c.name === 'Ăn uống')!.id;
    const games = categories.find((c) => c.name === 'Giải trí')!.id;
    const savings = await createWallet(source, { name: 'Tiết kiệm', icon: 'wallet', initialBalance: 5_000_000 });
    await createTransaction(source, { type: 'expense', amount: 37_000, categoryId: food, walletId: savings, date: '2026-10-24', note: 'Trà sữa', receipt: 'a.jpg' });
    await createTransaction(source, { type: 'expense', amount: 90_000, categoryId: games, walletId: savings, date: '2026-10-19', note: '' });
    await removeCategory(source, games); // used, so archived
    await setBudget(source, food, 2_000_000);

    const backup = await createBackup(source, memoryReceipts({ 'a.jpg': 'QUJD' }), new Date('2026-10-28T10:00:00Z'));
    expect(backup.receipts).toEqual({ 'a.jpg': 'QUJD' });

    // Through JSON, like the file sent to the new phone.
    const target = await freshDb();
    await createTransaction(target, { type: 'expense', amount: 1, categoryId: 1, walletId: 1, date: '2026-10-01', note: 'will be replaced' });
    const targetReceipts = memoryReceipts();
    await restoreBackup(target, parseBackup(JSON.stringify(backup)), targetReceipts);

    expect(await listAllTransactions(target)).toEqual(await listAllTransactions(source));
    expect(await listWallets(target)).toEqual(await listWallets(source));
    expect(await listCategories(target)).toEqual(await listCategories(source));
    expect(await listBudgets(target, OCT)).toEqual(await listBudgets(source, OCT));
    expect(targetReceipts.files).toEqual({ 'a.jpg': 'QUJD' });
    // The archived category still names its old transaction.
    expect((await listAllTransactions(target)).find((t) => t.amount === 90_000)?.categoryName).toBe('Giải trí');
  });

  test('images that can no longer be read are dropped from the backup', async () => {
    const db = await freshDb();
    await createTransaction(db, { type: 'expense', amount: 1000, categoryId: 1, walletId: 1, date: '2026-10-01', note: '', receipt: 'missing.jpg' });
    const backup = await createBackup(db, memoryReceipts());
    expect(backup.transactions[0].receipt).toBeNull();
    expect(backup.receipts).toEqual({});
  });

  test('parseBackup explains what is wrong with a file', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"other"}')).toThrow('không phải file sao lưu');
    const future: Partial<Backup> = { format: 'chi-tieu-backup', version: 99 };
    expect(() => parseBackup(JSON.stringify(future))).toThrow('phiên bản mới hơn');
  });
});

describe('CSV import', () => {
  const header = ['Ngày', 'Loại', 'Danh mục', 'Ví', 'Số tiền', 'Ghi chú'];

  test('reads the exported format and Excel-edited variants', () => {
    const csv = toCsv(header, [
      ['24/10/2026', 'Chi tiêu', 'Ăn uống', 'Tiền mặt', 37000, 'Trà sữa, size L'],
      ['2026-10-25', 'Thu nhập', 'Lương', 'Tài khoản ngân hàng', '15.000.000', ''],
      ['5/9/2026', 'chi tieu', '', '', '150,000.00', ''],
      ['31/02/2026', 'Chi tiêu', 'Ăn uống', 'Tiền mặt', 1000, 'bad date'],
      ['26/10/2026', 'Chi tiêu', 'Ăn uống', 'Tiền mặt', '', 'no amount'],
    ]);
    const { rows, invalidLines } = parseTransactionsCsv(csv);
    expect(rows).toEqual([
      { date: '2026-10-24', type: 'expense', category: 'Ăn uống', wallet: 'Tiền mặt', amount: 37_000, note: 'Trà sữa, size L' },
      { date: '2026-10-25', type: 'income', category: 'Lương', wallet: 'Tài khoản ngân hàng', amount: 15_000_000, note: '' },
      { date: '2026-09-05', type: 'expense', category: 'Khác', wallet: '', amount: 150_000, note: '' },
    ]);
    expect(invalidLines).toEqual([5, 6]);
  });

  test('rejects files without date and amount columns', () => {
    expect(() => parseTransactionsCsv('a,b\n1,2')).toThrow(CsvImportError);
  });

  test('adds rows, creates missing wallets and categories, and skips re-imported rows', async () => {
    const db = await freshDb();
    const csv = toCsv(header, [
      ['24/10/2026', 'Chi tiêu', 'ăn uống', 'Tiền mặt', 37000, 'Cà phê'],
      ['24/10/2026', 'Chi tiêu', 'Ăn uống', 'Tiền mặt', 37000, 'Cà phê'], // a second coffee, kept
      ['25/10/2026', 'Chi tiêu', 'Thú cưng', 'Ví MoMo', 120000, ''],
    ]);
    const { rows } = parseTransactionsCsv(csv);

    expect(await importTransactions(db, rows)).toEqual({
      added: 3,
      duplicates: 0,
      createdWallets: ['Ví MoMo'],
      createdCategories: ['Thú cưng'],
    });
    const all = await listAllTransactions(db);
    expect(all.filter((t) => t.categoryName === 'Ăn uống')).toHaveLength(2);
    expect(all.find((t) => t.amount === 120_000)).toMatchObject({ categoryName: 'Thú cưng', walletName: 'Ví MoMo' });

    // Same file again: nothing new.
    expect(await importTransactions(db, rows)).toEqual({ added: 0, duplicates: 3, createdWallets: [], createdCategories: [] });
    expect(await listAllTransactions(db)).toHaveLength(3);
  });
});
