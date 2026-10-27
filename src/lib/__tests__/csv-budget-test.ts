import { budgetStatus } from '../budget';
import { escapeCsvCell, toCsv } from '../csv';

describe('csv', () => {
  test('escapes only when needed', () => {
    expect(escapeCsvCell('Ăn uống')).toBe('Ăn uống');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(1000)).toBe('1000');
  });

  test('toCsv adds BOM and CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('﻿a,b\r\n1,"x,y"\r\n');
  });
});

describe('budgetStatus', () => {
  test('levels', () => {
    expect(budgetStatus(50, 100).level).toBe('ok');
    expect(budgetStatus(80, 100).level).toBe('warning');
    expect(budgetStatus(100, 100).level).toBe('warning');
    expect(budgetStatus(101, 100).level).toBe('over');
    expect(budgetStatus(30, 100).remaining).toBe(70);
    expect(budgetStatus(10, 0).ratio).toBe(0);
  });
});
