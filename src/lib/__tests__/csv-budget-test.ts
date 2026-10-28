import { budgetStatus } from '../budget';
import { escapeCsvCell, parseCsv, toCsv } from '../csv';

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

  test('parseCsv reads back what toCsv writes', () => {
    const rows = [
      ['Ngày', 'Ghi chú'],
      ['01/10/2026', 'a,b "c"\nd'],
      ['02/10/2026', ''],
    ];
    expect(parseCsv(toCsv(rows[0], rows.slice(1)))).toEqual(rows);
  });

  test('parseCsv handles semicolons, LF and blank rows from Excel', () => {
    expect(parseCsv('a;b\n1;"x;y"\n;\n\n2;z')).toEqual([
      ['a', 'b'],
      ['1', 'x;y'],
      ['2', 'z'],
    ]);
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
