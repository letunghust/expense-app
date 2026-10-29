import type { OcrLine } from '@/lib/receipt-parser';

/**
 * Web preview: Tesseract.js, loaded from a CDN on first use so the phone app
 * doesn't carry it. Slower than ML Kit and the first scan downloads the
 * Vietnamese language data (~10 MB), but it lets receipt scanning be tried
 * in the browser.
 */
export const OCR_SUPPORTED = true;

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

type Box = { x0: number; y0: number; x1: number; y1: number };
type TesseractWorker = {
  recognize(image: string): Promise<{ data: { lines: { bbox: Box; words: { text: string; bbox: Box }[] }[] } }>;
};
declare global {
  interface Window {
    Tesseract?: { createWorker(langs: string[]): Promise<TesseractWorker> };
  }
}

let worker: Promise<TesseractWorker> | undefined;

function loadWorker(): Promise<TesseractWorker> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_URL;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${TESSERACT_URL}`));
    document.head.appendChild(script);
  }).then(() => window.Tesseract!.createWorker(['vie', 'eng']));
}

export async function readTextLines(imageUri: string): Promise<OcrLine[]> {
  worker ??= loadWorker();
  try {
    const { data } = await (await worker).recognize(imageUri);
    return data.lines.flatMap(splitAtGaps);
  } catch (error) {
    worker = undefined; // retry loading next time
    throw error;
  }
}

/**
 * Tesseract joins a label and its right-aligned value into one line; ML Kit
 * keeps them apart, which is what the receipt parser expects. Split lines
 * where the gap between two words is wider than the text is tall.
 */
function splitAtGaps(line: { bbox: Box; words: { text: string; bbox: Box }[] }): OcrLine[] {
  const height = line.bbox.y1 - line.bbox.y0;
  const parts: { text: string; bbox: Box }[][] = [];
  for (const word of line.words) {
    const current = parts[parts.length - 1];
    const previous = current?.[current.length - 1];
    if (previous && word.bbox.x0 - previous.bbox.x1 <= height * 1.5) current.push(word);
    else parts.push([word]);
  }
  return parts.map((words) => ({
    text: words.map((w) => w.text).join(' '),
    left: Math.min(...words.map((w) => w.bbox.x0)),
    top: Math.min(...words.map((w) => w.bbox.y0)),
    right: Math.max(...words.map((w) => w.bbox.x1)),
    bottom: Math.max(...words.map((w) => w.bbox.y1)),
  }));
}
