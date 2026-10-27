/** Lowercases and strips Vietnamese diacritics so "an sang" matches "Ăn sáng". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** True when any of the fields contains the query, ignoring case and diacritics. */
export function matchesSearch(fields: string[], query: string): boolean {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return true;
  return fields.some((field) => normalizeForSearch(field).includes(needle));
}
