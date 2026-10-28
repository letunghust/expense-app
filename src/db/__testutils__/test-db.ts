/// <reference types="node" />
/**
 * An in-memory SQLite database through node:sqlite, wrapped to look like
 * expo-sqlite's async API, so tests run the real migrations and queries.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';

type Params = unknown[];

function bind(params: Params): any[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

export function openTestDb(): SQLiteDatabase {
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
