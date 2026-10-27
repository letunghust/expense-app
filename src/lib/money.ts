/**
 * Money is stored as an integer number of đồng — VND has no minor unit,
 * so integers avoid every floating point rounding issue.
 */

/** Groups digits with dots, Vietnamese style: 1250000 -> "1.250.000". */
export function groupDigits(value: number): string {
  const digits = Math.abs(Math.trunc(value)).toString();
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 1250000 -> "1.250.000 ₫", -5000 -> "-5.000 ₫". */
export function formatVND(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${groupDigits(value)} ₫`;
}

/** Like formatVND but always shows a sign, for income (+) and expense (-) rows. */
export function formatSignedVND(value: number, type: 'income' | 'expense'): string {
  return `${type === 'income' ? '+' : '-'}${groupDigits(value)} ₫`;
}

/** Short form for chart labels: 1250000 -> "1,3tr", 45000 -> "45k". */
export function formatCompactVND(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${trimDecimal(abs / 1_000_000_000)}tỷ`;
  if (abs >= 1_000_000) return `${sign}${trimDecimal(abs / 1_000_000)}tr`;
  if (abs >= 1_000) return `${sign}${trimDecimal(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

function trimDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

/** Parses user input such as "1.250.000" or "1250000đ" into đồng; null when empty or zero. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return value > 0 && Number.isSafeInteger(value) ? value : null;
}

/** Re-formats the amount field while the user types: "1250000" -> "1.250.000". */
export function formatAmountInput(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, 15);
  return digits ? groupDigits(Number(digits)) : '';
}
