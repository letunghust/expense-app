/**
 * expo-secure-store has no web implementation. The web build is only a
 * preview, so localStorage stands in for it there.
 */
export const secureStorage = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  deleteItem: async (key: string) => localStorage.removeItem(key),
};
