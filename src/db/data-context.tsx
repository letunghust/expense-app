import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

type DataVersion = { version: number; notifyChanged: () => void };

const DataVersionContext = createContext<DataVersion>({ version: 0, notifyChanged: () => {} });

/**
 * Every write calls notifyChanged(), which bumps a counter that all useDbQuery
 * hooks depend on, so every visible screen re-reads after any change.
 */
export function DataVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const notifyChanged = useCallback(() => setVersion((v) => v + 1), []);
  return <DataVersionContext.Provider value={{ version, notifyChanged }}>{children}</DataVersionContext.Provider>;
}

export function useNotifyDataChanged() {
  return useContext(DataVersionContext).notifyChanged;
}

/**
 * Runs `query` against the database and re-runs it whenever data changes or
 * one of `deps` changes. `data` is undefined until the first result arrives.
 */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: unknown[]): T | undefined {
  const db = useSQLiteContext();
  const { version } = useContext(DataVersionContext);
  const [data, setData] = useState<T>();

  useEffect(() => {
    let cancelled = false;
    query(db)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => console.error('Database query failed', error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `query` is a fresh closure each render; deps lists what it reads
  }, [db, version, ...deps]);

  return data;
}
