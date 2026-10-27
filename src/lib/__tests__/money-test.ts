import { formatAmountInput, formatCompactVND, formatSignedVND, formatVND, groupDigits, parseAmount } from '../money';

describe('money', () => {
  test('groupDigits', () => {
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(999)).toBe('999');
    expect(groupDigits(1000)).toBe('1.000');
    expect(groupDigits(1250000)).toBe('1.250.000');
  });

  test('formatVND', () => {
    expect(formatVND(1250000)).toBe('1.250.000 ₫');
    expect(formatVND(-5000)).toBe('-5.000 ₫');
  });

  test('formatSignedVND', () => {
    expect(formatSignedVND(5000, 'income')).toBe('+5.000 ₫');
    expect(formatSignedVND(5000, 'expense')).toBe('-5.000 ₫');
  });

  test('formatCompactVND', () => {
    expect(formatCompactVND(500)).toBe('500');
    expect(formatCompactVND(45000)).toBe('45k');
    expect(formatCompactVND(1250000)).toBe('1,3tr');
    expect(formatCompactVND(2000000000)).toBe('2tỷ');
  });

  test('parseAmount', () => {
    expect(parseAmount('1.250.000')).toBe(1250000);
    expect(parseAmount('50000đ')).toBe(50000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  test('formatAmountInput', () => {
    expect(formatAmountInput('1250000')).toBe('1.250.000');
    expect(formatAmountInput('1.250.0001')).toBe('12.500.001');
    expect(formatAmountInput('000')).toBe('');
    expect(formatAmountInput('')).toBe('');
  });
});
