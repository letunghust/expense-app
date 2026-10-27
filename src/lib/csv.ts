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
