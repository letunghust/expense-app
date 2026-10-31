/**
 * Pulls the amount, date, recipient and message out of the text that OCR
 * reads from a bank-transfer / e-wallet confirmation screenshot.
 *
 * Bank apps lay these screens out as "label  value" rows (label on the left,
 * value right-aligned) or with the value under its label, so values are found
 * by position relative to their label rather than by reading order alone.
 */
import { toISODate } from './dates';
import { normalizeForSearch } from './search';

/** One line of recognised text and its bounding box in image pixels. */
export type OcrLine = { text: string; left: number; top: number; right: number; bottom: number };

export type ReceiptData = {
  amount?: number;
  date?: string; // YYYY-MM-DD
  recipient?: string;
  content?: string;
  /** Name of the default expense category the message suggests, e.g. "Ăn uống". */
  categoryHint?: string;
};

// Labels are compared after normalizeForSearch (lowercase, no diacritics).
const AMOUNT_LABELS = ['so tien', 'tong tien', 'tong cong', 'thanh toan', 'amount', 'total'];
const NOT_AMOUNT_LABELS = ['phi', 'so du', 'han muc', 'fee', 'balance', 'vat'];
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
      'lotte mart', 'emart', 'quan ao', 'sieu thi', 'mua sam', 'uniqlo', 'the gioi di dong', 'dien may xanh',
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
  const lines = ocrLines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }))
    .filter((line) => line.text)
    .sort((a, b) => a.top - b.top || a.left - b.left);

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

/** A short note for the transaction built from what the receipt says. */
export function receiptNote({ recipient, content }: ReceiptData): string {
  const note = content && recipient ? `${content} · ${recipient}` : content || (recipient ? `Chuyển khoản cho ${recipient}` : '');
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
    MONEY.lastIndex = 0;
    for (let match = MONEY.exec(line.text); match; match = MONEY.exec(line.text)) {
      const [, sign = '', number, separator, strayDigit, unit, strayLetter] = match;
      // A digit glued to an ungrouped number is just part of a longer code.
      if (strayDigit && !separator) continue;
      const value = Number(number.replace(/[.,]/g, ''));
      const before = line.text.slice(0, match.index);
      const hasCurrency = Boolean(unit || strayLetter || strayDigit) || CURRENCY_BEFORE.test(before);
      // Ungrouped digit runs are usually account numbers, codes or years.
      if (!separator && !hasCurrency) continue;
      if (value < MIN_AMOUNT || value > MAX_AMOUNT) continue;

      const context = ` ${normalizeWords(`${labelFor(line, lines)?.text ?? ''} ${before}`)} `;
      let score = 0;
      if (hasCurrency) score += 3;
      if (/[-−–]/.test(sign) || MINUS_BEFORE.test(before)) score += 2;
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

// ---------- Date ----------

function findDate(lines: OcrLine[], today: string): string | undefined {
  const latest = new Date(`${today}T00:00:00`);
  latest.setDate(latest.getDate() + 1);
  for (const { text } of lines) {
    const normalized = normalizeForSearch(text);
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
