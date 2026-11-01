import { LANGUAGES, strings, stringsFor } from './index';
import { vi } from './vi';

/**
 * The categories and wallets created on first launch are stored under their
 * Vietnamese names. They are shown in the current language; anything the
 * user named themselves is shown as typed.
 */
type CategoryKey = keyof typeof vi.defaults.categories;
type WalletKey = keyof typeof vi.defaults.wallets;

const categoryKeys = new Map(Object.entries(vi.defaults.categories).map(([key, name]) => [name, key as CategoryKey]));
const walletKeys = new Map(Object.entries(vi.defaults.wallets).map(([key, name]) => [name, key as WalletKey]));

export function categoryLabel(name: string): string {
  const key = categoryKeys.get(name);
  return key ? strings().defaults.categories[key] : name;
}

export function walletLabel(name: string): string {
  const key = walletKeys.get(name);
  return key ? strings().defaults.wallets[key] : name;
}

/**
 * The name to store after editing: a built-in name left as shown keeps its
 * stored Vietnamese name, so it stays translated.
 */
export function nameToStore(typed: string, stored: string, label: (name: string) => string): string {
  return typed === label(stored) ? stored : typed;
}

/** "Food & drinks", "食費"… → "Ăn uống", for CSV files exported in another language. */
export function storedCategoryName(name: string): string {
  return storedName(name, (language) => stringsFor(language).defaults.categories, vi.defaults.categories);
}

export function storedWalletName(name: string): string {
  return storedName(name, (language) => stringsFor(language).defaults.wallets, vi.defaults.wallets);
}

function storedName<T extends Record<string, string>>(name: string, names: (language: (typeof LANGUAGES)[number]) => T, stored: T): string {
  for (const language of LANGUAGES) {
    const key = Object.keys(stored).find((k) => names(language)[k] === name);
    if (key) return stored[key];
  }
  return name;
}
