import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { AUTO_LOCK_AFTER_MS, shouldLockOnResume, SYSTEM_UI_AUTO_LOCK_AFTER_MS } from '@/lib/app-lock';

import { LockScreen } from './lock-screen';
import { loadLockSettings, type LockSettings } from './lock-store';

type AppLockValue = { settings: LockSettings; reload: () => Promise<void> };

const AppLockContext = createContext<AppLockValue | null>(null);

export function useAppLock(): AppLockValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock must be used inside <AppLockGate>');
  return value;
}

// The photo picker and share sheet put the app in the background too. Locking
// after the usual 30s there would unmount the screen and lose what the user
// was doing, so leaving for those gets longer.
let systemUiOpen = 0;

/** Runs a task that shows a system screen over the app, such as the photo picker. */
export async function withAutoLockPaused<T>(task: () => Promise<T>): Promise<T> {
  systemUiOpen++;
  try {
    return await task();
  } finally {
    systemUiOpen--;
  }
}

async function readSettings(): Promise<LockSettings> {
  try {
    return await loadLockSettings();
  } catch (error) {
    // Keystore entries can become unreadable (e.g. restored from a backup);
    // rather than leaving the user stuck on a blank screen, treat it as no lock.
    console.error('Could not read app lock settings', error);
    return { pinEnabled: false, pinLength: 6, biometricsEnabled: false };
  }
}

/**
 * Shows the lock screen instead of the app while a PIN is set and the app is
 * locked: on launch, and when returning after more than 30s in the background.
 * The app tree is unmounted while locked, so nothing behind the lock can render.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<LockSettings>();
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    readSettings().then((s) => {
      setSettings(s);
      // Locked on launch only if a PIN exists; turning the PIN on later must not lock immediately.
      setLocked(s.pinEnabled);
    });
  }, []);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    let lockAfterMs = AUTO_LOCK_AFTER_MS;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
        lockAfterMs = systemUiOpen > 0 ? SYSTEM_UI_AUTO_LOCK_AFTER_MS : AUTO_LOCK_AFTER_MS;
      } else if (state === 'active') {
        if (shouldLockOnResume(backgroundedAt, Date.now(), lockAfterMs)) {
          readSettings().then((s) => {
            setSettings(s);
            if (s.pinEnabled) setLocked(true);
          });
        }
        backgroundedAt = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const reload = useCallback(async () => setSettings(await readSettings()), []);

  if (!settings) return <ThemedView style={{ flex: 1 }} />;

  if (settings.pinEnabled && locked) {
    return <LockScreen settings={settings} onUnlock={() => setLocked(false)} />;
  }

  return <AppLockContext.Provider value={{ settings, reload }}>{children}</AppLockContext.Provider>;
}
