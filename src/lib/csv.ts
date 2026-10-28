/** Quotes a CSV cell when it contains a separator, quote or newline (RFC 4180). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Builds a CSV document. Starts with a UTF-8 BOM so Excel shows Vietnamese
 * characters correctly instead of mojibake.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/**
 * Parses a CSV document into rows of cells (RFC 4180 quoting, CRLF or LF).
 * Accepts `;` as the separator too, which Excel uses in some locales.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Excel leaves rows of empty cells behind deleted lines.
  return rows.filter((r) => r.some((c) => c.trim()));
}
