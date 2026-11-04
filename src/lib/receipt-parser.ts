/**
 * Pulls the amount, date, recipient and message out of the text that OCR
 * reads from a bank-transfer / e-wallet confirmation screenshot, or the
 * total, store and items from a photo of a printed shop receipt.
 *
 * Bank apps lay these screens out as "label  value" rows (label on the left,
 * value right-aligned) or with the value under its label, so values are found
 * by position relative to their label rather than by reading order alone.
 */
import { toISODate } from './dates';
import { normalizeForSearch } from './search';

/** One line of recognised text and its bounding box in image pixels. */
export type OcrLine = { text: string; left: number; top: number; right: number; bottom: number };

/** One product on a shop receipt. */
export type ReceiptItem = {
  name: string;
  /** Price the customer pays for it (after its discount); missing when OCR couldn't read it. */
  amount?: number;
  /** Name of the default expense category it most likely belongs to. */
  categoryHint?: string;
};

export type ReceiptData = {
  amount?: number;
  date?: string; // YYYY-MM-DD
  recipient?: string;
  content?: string;
  /** Shop that printed the receipt, e.g. "WinMart". */
  store?: string;
  /** Products on a shop receipt, top to bottom. */
  items?: ReceiptItem[];
  /** Name of the default expense category the message suggests, e.g. "Ăn uống". */
  categoryHint?: string;
};

// Labels are compared after normalizeForSearch (lowercase, no diacritics).
const AMOUNT_LABELS = ['so tien', 'tong tien', 'tong cong', 'thanh toan', 'amount', 'total'];
const NOT_AMOUNT_LABELS = [
  'phi', 'so du', 'han muc', 'fee', 'balance', 'vat',
  'diem', 'tich luy', 'giam gia', 'chiet khau', 'khuyen mai', 'uu dai', 'khau tru', 'tien thua', 'khach dua',
];
const RECIPIENT_LABELS = [
  'ten nguoi thu huong',
  'nguoi thu huong',
  'ten nguoi huong',
  'nguoi huong',
  'ten nguoi nhan',
  'nguoi nhan',
  'ten tai khoan nhan',
  'ten tai khoan',
  'tai khoan nhan',
  'don vi thu huong',
  'nha cung cap',
  'chuyen den',
  'chuyen toi',
  'den',
  'toi',
  'beneficiary name',
  'beneficiary',
  'recipient',
  'to',
];
const SENDER_LABELS = ['ten nguoi chuyen', 'nguoi chuyen', 'ten nguoi gui', 'nguoi gui'];
const CONTENT_LABELS = [
  'noi dung chuyen khoan',
  'noi dung chuyen tien',
  'noi dung giao dich',
  'noi dung',
  'loi nhan',
  'dien giai',
  'mo ta',
  'ghi chu',
  'description',
  'message',
  'content',
  'remarks',
  'remark',
];
// Labels whose values must never be taken for another field's value.
const OTHER_LABELS = [
  'so tai khoan',
  'tai khoan nguon',
  'tai khoan chuyen',
  'tu tai khoan',
  'so dien thoai',
  'ngan hang',
  'ngan hang nhan',
  'ngan hang huong',
  'ma giao dich',
  'ma tham chieu',
  'so tham chieu',
  'thoi gian',
  'ngay giao dich',
  'trang thai',
];
const ALL_LABELS = [
  ...AMOUNT_LABELS,
  ...NOT_AMOUNT_LABELS,
  ...RECIPIENT_LABELS,
  ...SENDER_LABELS,
  ...CONTENT_LABELS,
  ...OTHER_LABELS,
];

/** What apps fill the message with when the user types nothing ("NGUYEN VAN A chuyen khoan"). */
const DEFAULT_MESSAGES = ['chuyen khoan', 'chuyen tien', 'ck', 'chuyen'];

/**
 * Keywords that suggest a default category. Matched as whole words against the
 * message and recipient; the first category with a hit wins, so food comes
 * before transport ("grabfood" vs "grab").
 */
const CATEGORY_KEYWORDS: [category: string, keywords: string[]][] = [
  [
    'Ăn uống',
    [
      'an sang', 'an trua', 'an toi', 'an vat', 'do an', 'an com', 'com tam', 'com trua', 'pho bo', 'pho ga',
      'bun', 'banh mi', 'cafe', 'ca phe', 'caphe', 'coffee', 'tra sua', 'highlands', 'starbucks', 'phuc long',
      'kfc', 'lotteria', 'jollibee', 'pizza', 'grabfood', 'shopeefood', 'baemin', 'nha hang', 'quan an', 'tra chanh',
    ],
  ],
  [
    'Đi lại',
    [
      'grab', 'gojek', 'xanh sm', 'taxi', 'xang', 'do xang', 'petrolimex', 'gui xe', 've xe', 'vetc', 'epass',
      'vexere', 've may bay', 'vietjet', 'vietnam airlines', 'bamboo airways',
    ],
  ],
  [
    'Hóa đơn',
    [
      'tien dien', 'tien nuoc', 'dien luc', 'evn', 'internet', 'wifi', 'cuoc dien thoai', 'cuoc internet',
      'fpt telecom', 'viettel', 'vnpt', 'mobifone', 'vinaphone', 'nap tien dien thoai', 'hoa don', 'truyen hinh',
    ],
  ],
  ['Nhà cửa', ['tien nha', 'tien phong', 'thue nha', 'tien tro', 'phi quan ly', 'chung cu']],
  [
    'Mua sắm',
    [
      'shopee', 'lazada', 'tiki', 'tiktok shop', 'sendo', 'winmart', 'coopmart', 'bach hoa xanh', 'aeon',
      'lotte mart', 'emart', 'vinmart', 'co opmart', 'co op food', 'big c', 'mega market', 'kingfoodmart', 'circle k',
      'gs25', 'familymart', '7 eleven', 'ministop', 'quan ao', 'sieu thi', 'mua sam', 'uniqlo', 'the gioi di dong', 'dien may xanh',
      'cellphones',
    ],
  ],
  ['Giải trí', ['cgv', 'lotte cinema', 'netflix', 'spotify', 'youtube premium', 'steam', 'game', 'karaoke', 'xem phim', 'du lich']],
  [
    'Sức khỏe',
    ['mua thuoc', 'tien thuoc', 'nha thuoc', 'pharmacity', 'long chau', 'benh vien', 'phong kham', 'kham benh', 'nha khoa', 'gym', 'fitness'],
  ],
  ['Giáo dục', ['hoc phi', 'tien hoc', 'khoa hoc', 'mua sach', 'fahasa', 'udemy', 'coursera']],
];

/**
 * An amount such as "1.250.000", "500,000.00 VND", "-50.000đ" or "VND 1,250,000".
 * Apps often print a small "đ" glued to the number, which OCR reads as a
 * stray letter ("66.000s") or digit ("37.0004"); both count as the currency sign.
 */
// Numbered groups only: Hermes on the phone returned no `groups` for named ones.
// 1 sign, 2 number, 3 thousands separator, 4 stray digit, 5 unit, 6 stray letter.
const MONEY =
  /(?<![\d.,])([-−–+]?)\s?(\d{1,3}(?:([.,])\d{3})(?:\3\d{3})*|\d{4,12})(?:(\d)(?!\d))?(?!\d)(?:[.,]\d{1,2}(?!\d))?(?:\s*(vnđ|vnd|đồng|dong|đ|₫|d)(?!\p{L})|(\p{L})(?!\p{L}))?/giu;
const CURRENCY_BEFORE = /(vnđ|vnd|₫)\s*$/iu;
const MINUS_BEFORE = /[-−–]\s*(vnđ|vnd|₫)?\s*$/iu;

const MIN_AMOUNT = 1_000;
const MAX_AMOUNT = 100_000_000_000;

export function parseTransferReceipt(ocrLines: OcrLine[], today: string): ReceiptData {
  const lines = straighten(
    ocrLines.map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() })).filter((line) => line.text)
  ).sort((a, b) => a.top - b.top || a.left - b.left);

  if (isShopReceipt(lines)) return parseShopReceipt(lines, today);
  const recipient = findLabeledValue(lines, RECIPIENT_LABELS, isName, isNameContinuation);
  const sender = findLabeledValue(lines, SENDER_LABELS, isName, isNameContinuation);
  const message = findLabeledValue(lines, CONTENT_LABELS, (text) => /\p{L}/u.test(text), () => true);
  const content = message && meaningfulMessage(message, sender);
  return {
    amount: findAmount(lines),
    date: findDate(lines, today),
    recipient: recipient && cleanRecipient(recipient),
    content,
    categoryHint: guessCategory([content, recipient].filter(Boolean).join(' ')),
  };
}

/**
 * A short note for the transaction built from what the receipt says.
 * `transferTo` words a recipient-only note in the app language.
 */
export function receiptNote(
  { recipient, content, store }: ReceiptData,
  transferTo = (name: string) => `Chuyển khoản cho ${name}`
): string {
  const note = store
    ? [store, content].filter(Boolean).join(': ')
    : content && recipient
      ? `${content} · ${recipient}`
      : content || (recipient ? transferTo(recipient) : '');
  return note.slice(0, 200);
}

export function guessCategory(text: string): string | undefined {
  const haystack = ` ${normalizeWords(text)} `;
  return CATEGORY_KEYWORDS.find(([, keywords]) => keywords.some((k) => haystack.includes(` ${k} `)))?.[0];
}

// ---------- Amount ----------

function findAmount(lines: OcrLine[]): number | undefined {
  const candidates: { value: number; score: number; line: OcrLine }[] = [];
  for (const line of lines) {
    for (const { value, negative, hasCurrency, before } of amountsIn(line.text)) {
      const context = ` ${normalizeWords(`${labelFor(line, lines)?.text ?? ''} ${before}`)} `;
      let score = 0;
      if (hasCurrency) score += 3;
      if (negative) score += 2;
      if (AMOUNT_LABELS.some((label) => context.includes(` ${label} `))) score += 4;
      if (NOT_AMOUNT_LABELS.some((label) => context.includes(` ${label} `))) score -= 8;
      candidates.push({ value, score, line });
    }
  }
  if (candidates.length === 0) return undefined;

  // The transferred amount is normally the biggest text on the screen.
  const tallest = Math.max(...candidates.map((c) => height(c.line)));
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const score = c.score + (3 * height(c.line)) / tallest;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best.value : undefined;
}

type Amount = { value: number; negative: boolean; hasCurrency: boolean; before: string };

/** The amounts of money written in one line of text, skipping codes, years and phone numbers. */
function amountsIn(text: string): Amount[] {
  const amounts: Amount[] = [];
  MONEY.lastIndex = 0;
  for (let match = MONEY.exec(text); match; match = MONEY.exec(text)) {
    const [, sign = '', number, separator, strayDigit, unit, strayLetter] = match;
    // A digit glued to an ungrouped number is just part of a longer code.
    if (strayDigit && !separator) continue;
    const value = Number(number.replace(/[.,]/g, ''));
    const before = text.slice(0, match.index);
    const hasCurrency = Boolean(unit || strayLetter || strayDigit) || CURRENCY_BEFORE.test(before);
    // Ungrouped digit runs are usually account numbers, codes or years.
    if (!separator && !hasCurrency) continue;
    if (value < MIN_AMOUNT || value > MAX_AMOUNT) continue;
    amounts.push({ value, negative: /[-−–]/.test(sign) || MINUS_BEFORE.test(before), hasCurrency, before });
  }
  return amounts;
}

// ---------- Shop receipts ----------

/** Words only printed on shop receipts, never on transfer screens. */
const SHOP_RECEIPT_WORDS = [
  'phieu tinh tien', 'hoa don ban hang', 'hoa don ban le', 'phieu thanh toan', 'tong tien hang', 'mat hang',
  'ten hang', 'don gia', 'tien khach dua', 'tien thua', 'tien tra lai',
];
/**
 * Labels of the receipt total, best first: what the customer pays (after
 * discounts) before the total of the goods. A paid amount of 0 (all paid with
 * points or vouchers) has no amount, so the total of the goods is used instead.
 */
const TOTAL_LABELS = [
  'tien can thanh toan', 'khach can thanh toan', 'khach can tra', 'khach phai tra', 'can thanh toan',
  'phai thanh toan', 'tong thanh toan', 'tong tien thanh toan', 'tong cong', 'tong tien hang', 'tong tien',
  'tong', 'grand total', 'total', 'thanh toan',
];
/**
 * Column headings above the items; the first row of them starts the item list.
 * OCR reads them one per line ("Mặt hàng", "KM", "T.Tiền") or as one line.
 */
const ITEM_HEADING = /^(m*at hang|ten hang|ten san pham|san pham|hang hoa|ma hang|t ?tien|thanh tien|don gia|gia|sl|so luong|km|dvt)$/;
const ITEM_HEADINGS_LINE = /^(m*at hang|ten hang|ten san pham|san pham|hang hoa|ma hang)( (sl|so luong|don gia|gia|km|t ?tien|thanh tien|dvt))+$/;
const isItemHeading = (line: OcrLine) => {
  const words = normalizeWords(line.text);
  return ITEM_HEADING.test(words) || ITEM_HEADINGS_LINE.test(words);
};
/** Shop names as printed on the receipt (compared without spaces or diacritics), longest first where one contains another. */
const STORES: [name: string, ...keys: string[]][] = [
  ['WinMart', 'winmart', 'vinmart'],
  ['Co.opmart', 'coopmart'],
  ['Co.op Food', 'coopfood'],
  ['Bách hóa Xanh', 'bachhoaxanh'],
  ['Lotte Mart', 'lottemart'],
  ['AEON', 'aeon'],
  ['Emart', 'emart'],
  ['Big C', 'bigc'],
  ['MM Mega Market', 'megamarket'],
  ['Kingfoodmart', 'kingfoodmart'],
  ['Circle K', 'circlek'],
  ['GS25', 'gs25'],
  ['FamilyMart', 'familymart'],
  ['7-Eleven', '7eleven'],
  ['Ministop', 'ministop'],
  ['Pharmacity', 'pharmacity'],
  ['Long Châu', 'longchau'],
  ['Highlands Coffee', 'highlands'],
  ['Phúc Long', 'phuclong'],
  ['Starbucks', 'starbucks'],
  ['The Coffee House', 'thecoffeehouse'],
  ['KFC', 'kfc'],
  ['Lotteria', 'lotteria'],
  ['Jollibee', 'jollibee'],
  ['Thế Giới Di Động', 'thegioididong'],
  ['Điện Máy Xanh', 'dienmayxanh'],
  ['Uniqlo', 'uniqlo'],
];
/** How many item names go into the note when a receipt is saved as one transaction. */
const MAX_ITEMS_IN_NOTE = 5;
/** Discount rows some shops print between the items. */
const NOT_ITEM = /^(giam gia|khuyen mai|chiet khau|uu dai|khau tru|km|ck)( |$)/;
/**
 * What supermarket items are, compared as whole words without diacritics. Sold
 * next to food but not food comes first ("sữa rửa mặt"). Words that are
 * ambiguous without their diacritics ("cá" and "ca", "bò" and "bộ") are left out.
 */
const NOT_FOOD_WORDS = [
  'sua rua mat', 'sua tam', 'sua duong', 'dau goi', 'dau xa', 'kem danh rang', 'ban chai', 'nuoc rua', 'nuoc giat',
  'nuoc lau', 'nuoc xa', 'bot giat', 'giay ve sinh', 'khan giay', 'bang ve sinh', 'dao cao', 'xa phong', 'sensodyne',
  'colgate',
];
const FOOD_WORDS = [
  'sua', 'tiet trung', 'vnm', 'vinamilk', 'yaourt', 'yogurt', 'pho mai', 'banh', 'keo', 'socola', 'chocolate', 'snack',
  'ngu coc', 'thit', 'phi le', 'uc ga', 'dui ga', 'canh ga', 'xuc xich', 'lap xuong', 'pate', 'tom', 'muc', 'hai san',
  'trung ga', 'trung vit', 'rau', 'trai cay', 'gao', 'mi tom', 'mi goi', 'mi an lien', 'nuoc mam', 'nuoc tuong',
  'tuong ot', 'dau an', 'hat nem', 'bot ngot', 'gia vi', 'nuoc ngot', 'nuoc suoi', 'nuoc khoang', 'tra', 'ca phe',
  'cafe', 'coffee', 'bia', 'ruou', 'coca', 'pepsi',
];
const FOOD_CATEGORY = 'Ăn uống';

function isShopReceipt(lines: OcrLine[]): boolean {
  return lines.some((line) => {
    const words = ` ${normalizeWords(line.text)} `;
    return SHOP_RECEIPT_WORDS.some((w) => words.includes(` ${w} `));
  });
}

function parseShopReceipt(lines: OcrLine[], today: string): ReceiptData {
  const store = findStore(lines);
  const items = findItems(lines);
  const content = items.length > 0 ? items.slice(0, MAX_ITEMS_IN_NOTE).map((item) => item.name).join(', ') : undefined;
  const storeCategory = guessCategory(store ?? '');
  return {
    amount: findTotal(lines) ?? findAmount(lines),
    date: findDate(lines, today),
    store,
    content,
    items: items.map((item) => ({ ...item, categoryHint: guessItemCategory(item.name) ?? storeCategory })),
    categoryHint: storeCategory ?? guessCategory(content ?? ''),
  };
}

function guessItemCategory(name: string): string | undefined {
  const words = ` ${normalizeWords(name)} `;
  const has = (word: string) => words.includes(` ${word} `);
  if (NOT_FOOD_WORDS.some(has)) return undefined;
  return FOOD_WORDS.some(has) ? FOOD_CATEGORY : guessCategory(name);
}

/** The receipt total: the right-most amount on the row of the best total label. */
function findTotal(lines: OcrLine[]): number | undefined {
  for (const label of TOTAL_LABELS) {
    for (const line of lines) {
      const rest = matchLabel(line.text, [label]);
      if (rest == null) continue;
      // "Tổng tiền KM", "Tổng giảm giá": a total of discounts, not of the bill.
      const restWords = ` ${normalizeWords(rest)} `;
      if ([...NOT_AMOUNT_LABELS, 'km'].some((w) => restWords.includes(` ${w} `))) continue;
      const h = height(line);
      const cells = [
        { left: line.left, text: rest },
        ...lines.filter((o) => o !== line && o.left >= line.right - h && Math.abs(centerY(o) - centerY(line)) <= h * 0.6),
      ].sort((a, b) => b.left - a.left);
      // Nothing on the row: some receipts print the amount under its label.
      const under = below(line, lines, 1);
      if (under) cells.push({ left: under.left, text: under.text });
      for (const cell of cells) {
        const amount = priceIn(cell.text);
        if (amount != null) return amount;
      }
    }
  }
  return undefined;
}

function findStore(lines: OcrLine[]): string | undefined {
  for (const line of lines) {
    const compact = normalizeWords(line.text).replace(/ /g, '');
    const store = STORES.find(([, ...keys]) => keys.some((key) => compact.includes(key)));
    if (store) return store[0];
  }
  return undefined;
}

/** The last positive amount in a table cell, where OCR may read the separator as a space ("36 200"). */
function priceIn(text: string): number | undefined {
  const amounts = amountsIn(text.replace(/^(\d{1,3}) (\d{3})$/, '$1,$2')).filter((a) => !a.negative);
  return amounts[amounts.length - 1]?.value;
}

/** The products between the column headings and the total: lines with words, each with its price. */
function findItems(lines: OcrLine[]): { name: string; amount?: number }[] {
  const heading = lines.find(isItemHeading);
  if (!heading) return [];
  const headingRow = lines.filter((o) => isItemHeading(o) && Math.abs(centerY(o) - centerY(heading)) <= height(heading));
  const start = Math.max(...headingRow.map((o) => o.bottom));
  const total = lines.find((o) => o.top >= start && matchLabel(o.text, TOTAL_LABELS) != null);
  const end = total ? centerY(total) : Infinity;
  const body = lines.filter((o) => centerY(o) > start && centerY(o) < end && !isItemHeading(o));
  const names = body.filter((o) => isItemName(cleanItem(o.text)) && !NOT_ITEM.test(normalizeWords(o.text)));
  const priceColumn = Math.max(...body.filter((o) => priceIn(o.text) != null).map((o) => o.right));
  const items = names.map((line, i) => ({
    name: cleanItem(line.text),
    amount: itemPrice(line, names[i + 1], body, priceColumn),
  }));
  if (total) return items;
  // No total to stop at: the wording under the items would read as more items.
  let last = items.length;
  while (last > 0 && items[last - 1].amount == null) last--;
  return items.slice(0, last);
}

/**
 * An item's price is in the right-most column, on its own row or, when a
 * receipt prints the name above "2 x 10.000  20.000", on the rows before the
 * next item. The unit price in the middle of those rows is not the price.
 */
function itemPrice(line: OcrLine, next: OcrLine | undefined, body: OcrLine[], priceColumn: number): number | undefined {
  const h = height(line);
  const sameRow = (o: OcrLine) => Math.abs(centerY(o) - centerY(line)) <= h * 0.6;
  const beforeNext = (o: OcrLine) => !next || centerY(o) < centerY(next) - height(next) * 0.6;
  const inColumn = body.filter((o) => o.right >= priceColumn - h * 2).sort((a, b) => b.right - a.right);
  const cells = [
    ...inColumn.filter((o) => sameRow(o) && (o === line || o.left >= line.right - h)),
    ...inColumn.filter((o) => centerY(o) > centerY(line) && !sameRow(o) && beforeNext(o)),
  ];
  for (const cell of cells) {
    const amount = priceIn(cell.text);
    if (amount != null) return amount;
  }
  return undefined;
}

function isItemName(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const digits = text.match(/\d/g)?.length ?? 0;
  // "2 x 10.000", "0.501 x 112,900": quantity and unit price.
  return letters >= 3 && letters > digits && !/^[\d.,]+\s*[x×*]\s*[\d.,]*$/i.test(text);
}

/** Drops the prices OCR kept on the item's line and the "..." of a cut-off name. */
function cleanItem(text: string): string {
  return text
    .replace(/(\s+[-−–]?\d[\d.,]*)+\s*$/u, '')
    .replace(/\s*(\.+|…)\s*$/u, '')
    .trim();
}

// ---------- Skew ----------

/**
 * Photos of paper receipts are rarely straight, so the amounts at the right of
 * a row sit higher or lower than its label. Finds the slope that lines up the
 * most pairs of lines into rows and straightens the boxes by it. Screenshots
 * are straight and stay untouched.
 */
function straighten(lines: OcrLine[]): OcrLine[] {
  const boxes = lines.map((l) => ({ x: (l.left + l.right) / 2, y: centerY(l), h: height(l) }));
  const alignedPairs = (slope: number) => {
    let count = 0;
    for (const a of boxes) {
      for (const b of boxes) {
        const dx = b.x - a.x;
        if (dx > a.h && Math.abs(b.y - a.y - slope * dx) <= Math.min(a.h, b.h) * 0.25) count++;
      }
    }
    return count;
  };
  let best = 0;
  let bestCount = alignedPairs(0);
  for (let step = 1; step <= 30; step++) {
    for (const slope of [step * 0.005, -step * 0.005]) {
      const count = alignedPairs(slope);
      if (count > bestCount) {
        best = slope;
        bestCount = count;
      }
    }
  }
  if (best === 0) return lines;
  return lines.map((line) => {
    const shift = (best * (line.left + line.right)) / 2;
    return { ...line, top: line.top - shift, bottom: line.bottom - shift };
  });
}

// ---------- Date ----------

function findDate(lines: OcrLine[], today: string): string | undefined {
  const latest = new Date(`${today}T00:00:00`);
  latest.setDate(latest.getDate() + 1);
  for (const { text } of lines) {
    // OCR reads a printed 0 as the letter O ("O1/11/2026").
    const normalized = normalizeForSearch(text).replace(/[\dOo]{1,4}(?:[/.-][\dOo]{1,4}){2}/g, (date) =>
      date.replace(/[Oo]/g, '0')
    );
    const found =
      matchDayMonthYear(normalized.match(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/)) ??
      matchIsoDate(normalized.match(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/)) ??
      matchDayMonthYear(normalized.match(/(?<!\d)(\d{1,2})\s*(?:thang|thg|th)\s*(\d{1,2}),?\s*(?:nam\s*)?(\d{4})/));
    if (found && found.getTime() <= latest.getTime()) return toISODate(found);
  }
  return undefined;
}

function matchDayMonthYear(match: RegExpMatchArray | null): Date | undefined {
  if (!match) return undefined;
  let day = Number(match[1]);
  let month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  // English-language apps write month first; only detectable when the day is > 12.
  if (month > 12 && day <= 12) [day, month] = [month, day];
  return makeDate(year, month, day);
}

function matchIsoDate(match: RegExpMatchArray | null): Date | undefined {
  return match ? makeDate(Number(match[1]), Number(match[2]), Number(match[3])) : undefined;
}

function makeDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(year, month - 1, day);
  const valid = year >= 2000 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : undefined;
}

// ---------- Labelled values ----------

/**
 * Value of the first line labelled with one of `labels`: the text after the
 * label on the same line, else the line to its right, else the line below.
 * Lines the value wrapped onto are joined to it while `wraps` accepts them.
 */
function findLabeledValue(
  lines: OcrLine[],
  labels: string[],
  accept: (text: string) => boolean,
  wraps: (text: string) => boolean
): string | undefined {
  for (const line of lines) {
    const rest = matchLabel(line.text, labels);
    if (rest == null) continue;
    if (rest) {
      if (accept(rest)) return rest;
      continue;
    }
    const value = valueFor(line, lines);
    if (!value) continue;
    const parts = [value, ...continuationsOf(value, lines)].map((l) => l.text);
    if (accept(parts[0])) {
      const end = parts.findIndex((part, i) => i > 0 && !wraps(part));
      return parts.slice(0, end === -1 ? undefined : end).join(' ');
    }
    // Some apps put the account number first and the name under it.
    const name = parts.slice(1).find(accept);
    if (name) return name;
  }
  return undefined;
}

/**
 * If `text` starts with one of the labels, returns what follows it ('' when
 * the label stands alone), otherwise null. Single-word labels such as "Đến"
 * only count with a colon or alone, so ordinary text isn't taken for a label.
 */
function matchLabel(text: string, labels: string[]): string | null {
  const words = text.replace(/(\p{L})[:：]\s*/gu, '$1: ').split(' ');
  const normalized = words.map((w) => normalizeForSearch(w));
  for (const label of labels) {
    const labelWords = label.split(' ');
    if (labelWords.length > words.length) continue;
    let colon = false;
    const matches = labelWords.every((labelWord, i) => {
      const word = normalized[i].replace(/[:：]$/, () => {
        colon = i === labelWords.length - 1;
        return '';
      });
      return word === labelWord;
    });
    if (!matches) continue;
    let rest = words.slice(labelWords.length).join(' ');
    if (/^[:：]/.test(rest)) {
      colon = true;
      rest = rest.replace(/^[:：]\s*/, '');
    }
    if (rest && !colon && labelWords.length < 2) continue;
    return rest.trim();
  }
  return null;
}

/** A label on its own, or "label: value"; not text that merely starts like one ("Thanh toán tiền điện"). */
function isLabel(line: OcrLine): boolean {
  const rest = matchLabel(line.text, ALL_LABELS);
  return rest === '' || (rest != null && /[:：]/.test(line.text));
}

const height = (line: OcrLine) => Math.max(1, line.bottom - line.top);
const centerY = (line: OcrLine) => (line.top + line.bottom) / 2;

/** The value belonging to a label line: on the same row to its right, else directly below. */
function valueFor(label: OcrLine, lines: OcrLine[]): OcrLine | undefined {
  const h = height(label);
  const right = lines
    .filter((o) => o !== label && o.left >= label.right - h * 0.5 && Math.abs(centerY(o) - centerY(label)) <= h * 0.6)
    .sort((a, b) => a.left - b.left)[0];
  const value = right ?? below(label, lines, 1.5);
  return value && !isLabel(value) ? value : undefined;
}

/** The label that describes a value line: on the same row to its left, else directly above. */
function labelFor(value: OcrLine, lines: OcrLine[]): OcrLine | undefined {
  const h = height(value);
  return (
    lines
      .filter((o) => o !== value && o.right <= value.left + h * 0.5 && Math.abs(centerY(o) - centerY(value)) <= h * 0.6)
      .sort((a, b) => b.right - a.right)[0] ??
    lines
      .filter((o) => o.bottom <= value.top + h * 0.3 && value.top - o.bottom <= h * 1.5 && overlaps(o, value, h))
      .sort((a, b) => b.bottom - a.bottom)[0]
  );
}

function below(line: OcrLine, lines: OcrLine[], maxGap: number): OcrLine | undefined {
  const h = height(line);
  return lines
    .filter((o) => o !== line && o.top >= line.bottom - h * 0.3 && o.top - line.bottom <= h * maxGap && overlaps(o, line, h))
    .sort((a, b) => a.top - b.top)[0];
}

function overlaps(a: OcrLine, b: OcrLine, tolerance: number): boolean {
  return a.left <= b.right + tolerance && a.right >= b.left - tolerance;
}

/**
 * Lines a long value wrapped onto: close below it and not the start of the
 * next row, which would have its label to the left.
 */
function continuationsOf(value: OcrLine, lines: OcrLine[]): OcrLine[] {
  const result: OcrLine[] = [];
  let last = value;
  for (let i = 0; i < 2; i++) {
    const next = below(last, lines, 1);
    if (!next || isLabel(next) || hasTextOnLeft(next, lines)) break;
    result.push(next);
    last = next;
  }
  return result;
}

function hasTextOnLeft(line: OcrLine, lines: OcrLine[]): boolean {
  const h = height(line);
  return lines.some((o) => o !== line && o.right <= line.left && Math.abs(centerY(o) - centerY(line)) <= h * 0.6);
}

// ---------- Text helpers ----------

function isName(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const digits = text.match(/\d/g)?.length ?? 0;
  return letters >= 2 && letters > digits;
}

/** The rest of a person's or company's name that wrapped onto the next line ("HUONG"). */
function isNameContinuation(text: string): boolean {
  return /^[\p{L} .'&-]+$/u.test(text);
}

/**
 * The message without the sender's name, or undefined when it is only the
 * app's default text such as "LE VAN A chuyen khoan".
 */
function meaningfulMessage(message: string, sender: string | undefined): string | undefined {
  let words = message.split(' ');
  const senderWords = sender ? normalizeWords(sender).split(' ') : [];
  const startsWithSender =
    senderWords.length > 0 && senderWords.every((word, i) => normalizeWords(words[i] ?? '') === word);
  if (startsWithSender) words = words.slice(senderWords.length);

  const rest = normalizeWords(words.join(' '));
  if (!rest || DEFAULT_MESSAGES.includes(rest)) return undefined;
  // Unknown sender: a capitalised name followed by the default text.
  const ending = DEFAULT_MESSAGES.find((d) => rest.endsWith(` ${d}`));
  if (ending && !startsWithSender) {
    const nameWords = words.slice(0, words.length - ending.split(' ').length);
    if (nameWords.length <= 5 && nameWords.every((w) => /^\p{Lu}\p{L}*$/u.test(w))) return undefined;
  }
  return words.join(' ');
}

/** Drops account numbers and separators that OCR keeps next to the name. */
function cleanRecipient(text: string): string {
  return text
    .replace(/\d{6,}/g, ' ')
    .replace(/\s*[-–|·]\s*$/g, '')
    .replace(/^\s*[-–|·]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWords(text: string): string {
  return normalizeForSearch(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
