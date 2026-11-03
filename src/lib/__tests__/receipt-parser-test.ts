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

  // Layout and OCR output of real Viettel Money screenshots (names changed).
  const viettelMoney = (amount: string, name: string[], message: string[]) => [
    ...row(306, 40, [232, 'Chuyển tiền thành công']),
    ...row(388, 52, [308, amount]),
    ...row(503, 25, [36, 'Tên người nhận']),
    ...name.flatMap((part, i) => row(507 + i * 43, 25, [822 - part.length * 12.5, part])),
    ...row(611, 25, [36, 'Tài khoản nhận'], [606, '01410305001']),
    ...row(675, 25, [37, 'Ngân hàng nhận'], [668, '9TPBank']),
    ...row(738, 26, [37, 'Nội dung giao dịch']),
    ...message.flatMap((part, i) => row(741 + i * 43, 30, [822 - part.length * 15, part])),
    ...row(900, 27, [36, 'Tên người chuyển'], [608, 'TRAN VAN BINH']),
    ...row(963, 27, [36, 'Tài khoản chuyển'], [635, '¥ ViettelPay']),
    ...row(1025, 27, [37, 'Số điện thoại chuyển'], [602, '0865-940-198']),
    ...row(1090, 25, [37, 'Phí giao dịch'], [689, 'Miễn phí']),
    ...row(1209, 25, [36, 'Thời gian'], [471, '24/10/2026 - 13:30:42']),
    ...row(1271, 25, [37, 'Mã giao dịch'], [526, '261024594485803']),
    ...row(1426, 26, [102, '1'], [209, '2'], [319, '3']),
  ];

  test('Viettel Money: the small "đ" after the amount is misread as a digit or letter', () => {
    for (const [text, amount] of [
      ['37.0004', 37_000],
      ['66.000s', 66_000],
      ['194.000đ', 194_000],
    ] as const) {
      const result = parseTransferReceipt(viettelMoney(text, ['LE THI MAI'], ['Tran Van Binh chuyen', 'khoan']), TODAY);
      expect(result).toEqual({
        amount,
        date: '2026-10-24',
        recipient: 'LE THI MAI',
        content: undefined, // only the app's default message
        categoryHint: undefined,
      });
    }
  });

  test('Viettel Money: wrapped name, and a real message without the sender name', () => {
    const result = parseTransferReceipt(
      viettelMoney('165.0004', ['NGUYEN THI THANH', 'HUONG'], ['Tran Van Binh tien tra sua', 'thu 4 GP-TH']),
      TODAY
    );
    expect(result.amount).toBe(165_000);
    expect(result.recipient).toBe('NGUYEN THI THANH HUONG');
    expect(result.content).toBe('tien tra sua thu 4 GP-TH');
    expect(result.categoryHint).toBe('Ăn uống');
  });

  test('default messages from an unknown sender are dropped', () => {
    const lines = [...row(100, 30, [40, 'Nội dung: NGUYEN VAN B chuyen tien'])];
    expect(parseTransferReceipt(lines, TODAY).content).toBeUndefined();
    const kept = [...row(100, 30, [40, 'Nội dung: tien nha thang 10'])];
    expect(parseTransferReceipt(kept, TODAY).content).toBe('tien nha thang 10');
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

/** Rotates OCR boxes like a photo taken at a slant: each line moves up by `slope` × its x. */
function tilt(slope: number, lines: OcrLine[]): OcrLine[] {
  return lines.map((line) => {
    const shift = (slope * (line.left + line.right)) / 2;
    return { ...line, top: line.top - shift, bottom: line.bottom - shift };
  });
}

describe('shop receipts', () => {
  test('tilted supermarket photo: discounts column, quantities, total after discounts', () => {
    const lines = tilt(0.045, [
      ...row(100, 50, [90, 'WinMart*']),
      ...row(170, 26, [100, 'PHIẾU TÍNH TIỀN']),
      ...row(210, 20, [100, 'O1/11/2026 20:06| MSCH:1234|'], [440, 'PTT:123401261100999']),
      ...row(240, 20, [100, 'NV:01234567| Mã CQT: M1-26-ABC1-11000000999']),
      ...row(270, 22, [100, 'Mặt hàng'], [420, 'KM'], [530, 'T.Tiền']),
      ...row(305, 22, [100, "B'FAST Sữa hạt ngũ cốc ca.."], [410, '-11,600'], [525, '57,800']),
      ...row(340, 22, [100, 'VNM Sữa tươi tiệt trùng soc..'], [410, '-3,700'], [525, '36,300']),
      ...row(375, 22, [100, 'LOTTE Bánh Bouchee CHO...'], [410, '-7,900'], [525, '21,900']),
      ...row(410, 22, [100, 'OREO Bánh quy kem socola...'], [525, '20,000']),
      ...row(440, 22, [100, '2'], [200, 'x'], [270, '10,000']),
      ...row(475, 22, [100, 'BẢO NGỌC Bánh mỳ paket ...'], [525, '14,900']),
      ...row(520, 24, [100, 'TỔNG TIỀN HÀNG'], [395, '-23,200'], [520, '150,900']),
      ...row(550, 22, [100, 'Tiền cần thanh toán'], [520, '150,900']),
      ...row(590, 20, [100, 'Truy cập xuathoadon.winmart.vn trong 60 phút']),
    ]);
    expect(parseTransferReceipt(lines, '2026-11-03')).toEqual({
      amount: 150_900,
      date: '2026-11-01',
      store: 'WinMart',
      content:
        "B'FAST Sữa hạt ngũ cốc ca, VNM Sữa tươi tiệt trùng soc, LOTTE Bánh Bouchee CHO, OREO Bánh quy kem socola, " +
        'BẢO NGỌC Bánh mỳ paket',
      categoryHint: 'Mua sắm',
    });
  });

  test('paid entirely with points: the total of the goods, never the points balance', () => {
    const lines = [
      ...row(190, 60, [150, 'WinMart']),
      ...row(300, 36, [155, 'PHIEU TÍNH TIÊN']),
      ...row(370, 30, [155, '02/11/2026 21:28|MSCH:9Z99|PTT:9Z9901261100111']),
      ...row(460, 30, [155, 'Mặt hàng'], [735, 'KM'], [915, 'T.Tiền']),
      ...row(525, 30, [155, 'MEAT DELI Phi lê ức gà'], [695, '-20,363'], [920, '36,200']),
      ...row(570, 30, [155, '0.501 x 112,900']),
      ...row(640, 34, [155, 'TỔNG TIỀN HÀNG'], [665, '-20,363'], [920, '36,200']),
      ...row(680, 30, [150, 'Khấu trừ, ưu đãi khác'], [920, '36,200']),
      ...row(725, 30, [150, 'Tiền cần thanh toán'], [1015, '0']),
      ...row(800, 30, [145, 'SĐT Khách: ***123'], [530, 'Điểm tích lũy:'], [875, '3,676,480']),
    ];
    expect(parseTransferReceipt(lines, '2026-11-03')).toEqual({
      amount: 36_200,
      date: '2026-11-02',
      store: 'WinMart',
      content: 'MEAT DELI Phi lê ức gà',
      categoryHint: 'Mua sắm',
    });
  });

  test('whole rows read as one line, cash given and change ignored', () => {
    const lines = [
      ...row(50, 40, [100, 'Co.opmart Rạch Miễu']),
      ...row(110, 30, [100, 'HÓA ĐƠN BÁN HÀNG']),
      ...row(150, 24, [100, 'Ngày: 28/10/2026 18:02']),
      ...row(190, 24, [100, 'Tên hàng SL Đơn giá Thành tiền']),
      ...row(225, 24, [100, 'Cà phê sữa đá 2 25.000 50.000']),
      ...row(260, 24, [100, 'Bánh mì thịt 1 35.000 35.000']),
      ...row(300, 26, [100, 'Tổng cộng: 85.000']),
      ...row(335, 24, [100, 'Tiền khách đưa: 100.000']),
      ...row(370, 24, [100, 'Tiền thừa: 15.000']),
    ];
    const result = parseTransferReceipt(lines, TODAY);
    expect(result.amount).toBe(85_000);
    expect(result.store).toBe('Co.opmart');
    expect(result.content).toBe('Cà phê sữa đá, Bánh mì thịt');
    expect(result.categoryHint).toBe('Mua sắm');
  });

  test('unknown shop: items still give the category', () => {
    const lines = [
      ...row(50, 30, [100, 'PHIẾU THANH TOÁN']),
      ...row(90, 24, [100, 'Tên hàng'], [500, 'Thành tiền']),
      ...row(125, 24, [100, 'Trà sữa trân châu'], [500, '45,000']),
      ...row(165, 26, [100, 'Tổng tiền'], [500, '45,000']),
    ];
    expect(parseTransferReceipt(lines, TODAY)).toMatchObject({
      amount: 45_000,
      store: undefined,
      content: 'Trà sữa trân châu',
      categoryHint: 'Ăn uống',
    });
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

  test('shop receipts start with the shop', () => {
    expect(receiptNote({ store: 'WinMart', content: 'Sữa tươi, Bánh mì' })).toBe('WinMart: Sữa tươi, Bánh mì');
    expect(receiptNote({ store: 'WinMart' })).toBe('WinMart');
  });
});
