import type { OcrLine } from '@/lib/receipt-parser';

/** On-device text recognition (ML Kit on Android); the image never leaves the phone. */
export const OCR_SUPPORTED = true;

export async function readTextLines(imageUri: string): Promise<OcrLine[]> {
  // Loaded on first use: the native module is missing in Expo Go, where
  // importing it up front would crash the whole app instead of just this call.
  const { recognizeText } = await import('@infinitered/react-native-mlkit-text-recognition');
  const result = await recognizeText(imageUri);
  return result.blocks.flatMap((block) => block.lines.map((line) => ({ text: line.text, ...line.frame })));
}
