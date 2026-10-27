/// <reference types="node" />
/**
 * Runs the real migrations and queries against an in-memory SQLite database
 * through node:sqlite, wrapped to look like expo-sqlite's async API.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';

import {
  createCategory,
  createTransaction,
  deleteWallet,
  getDailyExpenses,
  getSummary,
  getTotalBalance,
  getTotalsByCategory,
  listBudgets,
  listCategories,
  listTransactions,
  listWallets,
  removeCategory,
  setBudget,
  updateTransaction,
} from '../repo';
import { migrateDbIfNeeded } from '../schema';

type Params = unknown[];

function bind(params: Params): any[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function openTestDb(): SQLiteDatabase {
  const raw = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: Params) => {
      const result = raw.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql: string, ...params: Params) => raw.prepare(sql).all(...bind(params)),
    getFirstAsync: async (sql: string, ...params: Params) => raw.prepare(sql).get(...bind(params)) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}

const OCT = { start: '2026-10-01', end: '2026-11-01' };

async function setup() {
  const db = openTestDb();
  await migrateDbIfNeeded(db);
  const categories = await listCategories(db);
  const byName = (name: string) => categories.find((c) => c.name === name)!.id;
  const [cash, bank] = await listWallets(db);
  return { db, byName, cash: cash.id, bank: bank.id };
}

describe('schema', () => {
  test('seeds default wallets and categories and is idempotent', async () => {
    const db = openTestDb();
    await migrateDbIfNeeded(db);
    await migrateDbIfNeeded(db);
    expect((await listWallets(db)).map((w) => w.name)).toEqual(['Tiền mặt', 'Tài khoản ngân hàng']);
    expect(await listCategories(db, 'expense')).toHaveLength(10);
    expect(await listCategories(db, 'income')).toHaveLength(4);
  });
});

describe('repo', () => {
  test('reports, balances and filters', async () => {
    const { db, byName, cash, bank } = await setup();
    const food = byName('Ăn uống');
    const transport = byName('Đi lại');
    const salary = byName('Lương');

    await createTransaction(db, { type: 'income', amount: 15_000_000, categoryId: salary, walletId: bank, date: '2026-10-05', note: 'Lương tháng 10' });
    await createTransaction(db, { type: 'expense', amount: 50_000, categoryId: food, walletId: cash, date: '2026-10-05', note: 'Ăn sáng' });
    await createTransaction(db, { type: 'expense', amount: 120_000, categoryId: food, walletId: cash, date: '2026-10-20', note: '' });
    await createTransaction(db, { type: 'expense', amount: 30_000, categoryId: transport, walletId: cash, date: '2026-10-20', note: 'Grab' });
    // Outside October: must not appear in month reports, but counts toward balances.
    await createTransaction(db, { type: 'expense', amount: 999, categoryId: food, walletId: cash, date: '2026-09-30', note: '' });
    await createTransaction(db, { type: 'expense', amount: 888, categoryId: food, walletId: cash, date: '2026-11-01', note: '' });

    expect(await getSummary(db, OCT)).toEqual({ income: 15_000_000, expense: 200_000 });

    const byCategory = await getTotalsByCategory(db, OCT, 'expense');
    expect(byCategory.map((c) => [c.name, c.total])).toEqual([
      ['Ăn uống', 170_000],
      ['Đi lại', 30_000],
    ]);

    expect(await getDailyExpenses(db, OCT)).toEqual([
      { date: '2026-10-05', total: 50_000 },
      { date: '2026-10-20', total: 150_000 },
    ]);

    const wallets = await listWallets(db);
    expect(wallets.find((w) => w.id === cash)!.balance).toBe(-(50_000 + 120_000 + 30_000 + 999 + 888));
    expect(wallets.find((w) => w.id === bank)!.balance).toBe(15_000_000);
    expect(await getTotalBalance(db)).toBe(15_000_000 - 201_887);

    const all = await listTransactions(db, OCT);
    expect(all.map((t) => t.date)).toEqual(['2026-10-20', '2026-10-20', '2026-10-05', '2026-10-05']);
    expect(all[0].categoryName).toBeDefined();

    expect(await listTransactions(db, { ...OCT, type: 'income' })).toHaveLength(1);
    expect(await listTransactions(db, { ...OCT, categoryId: food })).toHaveLength(2);
    expect(await listTransactions(db, { ...OCT, walletId: bank })).toHaveLength(1);
    expect((await listTransactions(db, { ...OCT, search: 'an sang' })).map((t) => t.note)).toEqual(['Ăn sáng']);
    // Matches the category name too, case- and accent-insensitively.
    expect(await listTransactions(db, { ...OCT, search: 'ĐI LẠI' })).toHaveLength(1);
  });

  test('updateTransaction changes the row', async () => {
    const { db, byName, cash, bank } = await setup();
    const id = await createTransaction(db, { type: 'expense', amount: 10_000, categoryId: byName('Ăn uống'), walletId: cash, date: '2026-10-01', note: '' });
    await updateTransaction(db, id, { type: 'income', amount: 20_000, categoryId: byName('Thưởng'), walletId: bank, date: '2026-10-02', note: 'x' });
    const [row] = await listTransactions(db, OCT);
    expect(row).toMatchObject({ id, type: 'income', amount: 20_000, categoryName: 'Thưởng', walletName: 'Tài khoản ngân hàng', date: '2026-10-02', note: 'x' });
  });

  test('budgets: upsert, spent and removal', async () => {
    const { db, byName, cash } = await setup();
    const food = byName('Ăn uống');
    await createTransaction(db, { type: 'expense', amount: 400_000, categoryId: food, walletId: cash, date: '2026-10-10', note: '' });
    await setBudget(db, food, 1_000_000);
    await setBudget(db, food, 500_000);

    const budgets = await listBudgets(db, OCT);
    expect(budgets[0]).toMatchObject({ categoryId: food, limit: 500_000, spent: 400_000 });
    expect(budgets.filter((b) => b.limit == null)).toHaveLength(9);

    await setBudget(db, food, null);
    expect((await listBudgets(db, OCT)).every((b) => b.limit == null)).toBe(true);
  });

  test('removeCategory deletes unused categories and archives used ones', async () => {
    const { db, cash } = await setup();
    const unused = await createCategory(db, { name: 'Tạm', type: 'expense', icon: 'cafe', color: '#000000' });
    const used = await createCategory(db, { name: 'Cà phê', type: 'expense', icon: 'cafe', color: '#000000' });
    await createTransaction(db, { type: 'expense', amount: 25_000, categoryId: used, walletId: cash, date: '2026-10-03', note: '' });
    await setBudget(db, used, 300_000);

    await removeCategory(db, unused);
    await removeCategory(db, used);

    const names = (await listCategories(db, 'expense')).map((c) => c.name);
    expect(names).not.toContain('Tạm');
    expect(names).not.toContain('Cà phê');
    expect((await listBudgets(db, OCT)).some((b) => b.categoryId === used)).toBe(false);
    // History keeps the archived category's name.
    expect((await listTransactions(db, OCT))[0].categoryName).toBe('Cà phê');
  });

  test('deleteWallet removes its transactions', async () => {
    const { db, byName, cash, bank } = await setup();
    await createTransaction(db, { type: 'expense', amount: 1_000, categoryId: byName('Khác'), walletId: cash, date: '2026-10-03', note: '' });
    await createTransaction(db, { type: 'expense', amount: 2_000, categoryId: byName('Khác'), walletId: bank, date: '2026-10-03', note: '' });
    await deleteWallet(db, cash);
    expect((await listWallets(db)).map((w) => w.id)).toEqual([bank]);
    expect((await listTransactions(db, OCT)).map((t) => t.amount)).toEqual([2_000]);
  });
});
