import { matchesSearch, normalizeForSearch } from '../search';

describe('search', () => {
  test('normalizeForSearch strips diacritics and đ', () => {
    expect(normalizeForSearch('Ăn sáng ĐƯỜNG phố')).toBe('an sang duong pho');
  });

  test('matchesSearch', () => {
    expect(matchesSearch(['Ăn sáng', 'Ăn uống'], 'ăn')).toBe(true);
    expect(matchesSearch(['Ăn sáng'], 'an sang')).toBe(true);
    expect(matchesSearch(['Đổ xăng'], 'do xang')).toBe(true);
    expect(matchesSearch(['Cà phê'], 'trà')).toBe(false);
    expect(matchesSearch(['anything'], '  ')).toBe(true);
  });
});
