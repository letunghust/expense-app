import { requireOptionalNativeModule } from 'expo';

import type { OcrLine } from '@/lib/receipt-parser';

/** Local native module in modules/chitieu-text-recognition (ML Kit, on device). */
type TextRecognitionModule = { recognizeLines(imageUri: string): Promise<OcrLine[]> };

// Missing in Expo Go, where scans then attach the image without reading it.
const TextRecognition = requireOptionalNativeModule<TextRecognitionModule>('ChiTieuTextRecognition');

/** On-device text recognition; the image never leaves the phone. */
export const OCR_SUPPORTED = true;

export async function readTextLines(imageUri: string): Promise<OcrLine[]> {
  if (!TextRecognition) throw new Error('Text recognition is not available in this build');
  return TextRecognition.recognizeLines(imageUri);
}
