import { guessCategory, type OcrLine, parseTransferReceipt, receiptNote } from '../receipt-parser';

/**
 * Builds OCR lines for one visual row. Each cell is [left, text]; the width is
 * estimated from the text length, like a proportional font of the row height.
 */
function row(top: number, height: number, ...cells: [left: number, text: string][]): OcrLine[] {
  return cells.map(([left, text]) => ({
    text,
    left,
    top,
    right: left + text.length * height * 0.5,
    bottom: top + height,
  }));
}

const TODAY = '2026-10-28';

describe('parseTransferReceipt', () => {
  test('bank app with label/value columns and a big amount header', () => {
    const lines = [
      ...row(200, 40, [300, 'Chuyển khoản thành công']),
      ...row(280, 70, [250, '500,000 VND']),
      ...row(370, 30, [260, '14:35 Thứ Ba 28/10/2026']),
      ...row(500, 30, [60, 'Tên người hưởng'], [600, 'NGUYEN VAN AN']),
      ...row(560, 30, [60, 'Tài khoản người hưởng'], [640, '0123456789']),
      ...row(620, 30, [60, 'Ngân hàng hưởng'], [560, 'Ngân hàng TMCP Ngoại thương']),
      ...row(652, 30, [620, 'Việt Nam']),
      ...row(700, 30, [60, 'Mã giao dịch'], [640, '5123456789']),
      ...row(760, 30, [60, 'Nội dung'], [480, 'NGUYEN VAN B chuyen tien tra sua']),
      ...row(792, 30, [600, 'tran chau']),
      ...row(860, 30, [60, 'Phí'], [700, 'Miễn phí']),
    ];
    expect(parseTransferReceipt(lines, TODAY)).toEqual({
      amount: 500_000,
      date: '2026-10-28',
      recipient: 'NGUYEN VAN AN',
      content: 'NGUYEN VAN B chuyen tien tra sua tran chau',
      categoryHint: 'Ăn uống',
    });
  });

  test('e-wallet with a negative amount in đ and Vietnamese labels', () => {
    const lines = [
      ...row(150, 36, [220, 'Chuyển tiền thành công']),
      ...row(220, 64, [300, '-50.000đ']),
      ...row(400, 28, [40, 'Người nhận'], [560, 'Trần Thị Bình']),
      ...row(460, 28, [40, 'Số điện thoại'], [600, '0912 345 678']),
      ...row(520, 28, [40, 'Lời nhắn'], [560, 'Tiền cơm trưa']),
      ...row(580, 28, [40, 'Thời gian'], [520, '12:05 - 27/10/2026']),
      ...row(640, 28, [40, 'Phí giao dịch'], [620, 'Miễn phí']),
      ...row(700, 28, [40, 'Mã giao dịch'], [580, '41234567890']),
    ];
    expect(parseTransferReceipt(lines, TODAY)).toEqual({
      amount: 50_000,
      date: '2026-10-27',
      recipient: 'Trần Thị Bình',
      content: 'Tiền cơm trưa',
      categoryHint: 'Ăn uống',
    });
  });

  test('values under their labels, currency first, and a larger balance that must be ignored', () => {
    const lines = [
      ...row(120, 34, [80, 'Bạn đã chuyển thành công']),
      ...row(180, 60, [80, 'VND 1,250,000']),
      ...row(320, 26, [80, 'Đến']),
      ...row(352, 30, [80, 'CONG TY TNHH DIEN LUC']),
      ...row(386, 26, [80, '19001234 - Vietinbank']),
      ...row(450, 26, [80, 'Lời nhắn']),
      ...row(482, 30, [80, 'Thanh toan tien dien thang 10']),
      ...row(550, 26, [80, 'Ngày thực hiện']),
      ...row(582, 30, [80, '28 tháng 10, 2026']),
      ...row(650, 26, [80, 'Số dư khả dụng']),
      ...row(682, 30, [80, 'VND 10,500,000']),
    ];
    expect(parseTransferReceipt(lines, TODAY)).toEqual({
      amount: 1_250_000,
      date: '2026-10-28',
      recipient: 'CONG TY TNHH DIEN LUC',
      content: 'Thanh toan tien dien thang 10',
      categoryHint: 'Hóa đơn',
    });
  });

  test('"label: value" on one line', () => {
    const lines = [
      ...row(100, 30, [40, 'Giao dịch thành công']),
      ...row(160, 30, [40, 'Số tiền:2.000.000 VND']),
      ...row(200, 30, [40, 'Phí: 0 VND']),
      ...row(240, 30, [40, 'Tên người nhận: LE THI HOA']),
      ...row(280, 30, [40, 'Nội dung: Hoc phi thang 11']),
      ...row(320, 30, [40, 'Thời gian: 01/11/2026 09:12:45']),
    ];
    expect(parseTransferReceipt(lines, '2026-11-01')).toEqual({
      amount: 2_000_000,
      date: '2026-11-01',
      recipient: 'LE THI HOA',
      content: 'Hoc phi thang 11',
      categoryHint: 'Giáo dục',
    });
  });

  test('account number above the name, decimals and month-first dates', () => {
    const lines = [
      ...row(100, 60, [100, '-300,000.00 VND']),
      ...row(200, 26, [40, 'To'], [500, '9704 1234 5678']),
      ...row(228, 26, [500, 'PHAM MINH KHOA']),
      ...row(300, 26, [40, 'Date'], [500, '10/27/2026 08:15']),
    ];
    const result = parseTransferReceipt(lines, TODAY);
    expect(result.amount).toBe(300_000);
    expect(result.recipient).toBe('PHAM MINH KHOA');
    expect(result.date).toBe('2026-10-27');
  });

  test('ignores codes, phone numbers, times and dates in the future', () => {
    const lines = [
      ...row(100, 30, [40, 'Mã GD: FT26301123456']),
      ...row(140, 30, [40, 'SĐT 0912.345.678 lúc 14:35:20']),
      ...row(180, 30, [40, 'Hiệu lực đến 15/12/2026']),
    ];
    expect(parseTransferReceipt(lines, TODAY)).toEqual({
      amount: undefined,
      date: undefined,
      recipient: undefined,
      content: undefined,
      categoryHint: undefined,
    });
  });

  test('ordinary words are not taken for single-word labels', () => {
    const lines = [...row(100, 30, [40, 'Đến hạn thanh toán'])];
    expect(parseTransferReceipt(lines, TODAY).recipient).toBeUndefined();
  });
});

describe('guessCategory', () => {
  test('matches whole words and prefers earlier categories', () => {
    expect(guessCategory('GRABFOOD 123')).toBe('Ăn uống');
    expect(guessCategory('Thanh toan Grab')).toBe('Đi lại');
    expect(guessCategory('Đổ xăng')).toBe('Đi lại');
    expect(guessCategory('Mua hàng Shopee')).toBe('Mua sắm');
    expect(guessCategory('MBVCB.123 vietcombank.com')).toBeUndefined();
    expect(guessCategory('')).toBeUndefined();
  });
});

describe('receiptNote', () => {
  test('combines message and recipient', () => {
    expect(receiptNote({ content: 'Tra sua', recipient: 'NGUYEN VAN A' })).toBe('Tra sua · NGUYEN VAN A');
    expect(receiptNote({ recipient: 'NGUYEN VAN A' })).toBe('Chuyển khoản cho NGUYEN VAN A');
    expect(receiptNote({ content: 'Tra sua' })).toBe('Tra sua');
    expect(receiptNote({})).toBe('');
    expect(receiptNote({ content: 'x'.repeat(300) })).toHaveLength(200);
  });
});
