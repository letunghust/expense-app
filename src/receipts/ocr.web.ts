import type { OcrLine } from '@/lib/receipt-parser';

/** ML Kit is native-only; in the web preview a scanned image is attached without reading it. */
export const OCR_SUPPORTED = false;

export async function readTextLines(_imageUri: string): Promise<OcrLine[]> {
  return [];
}
