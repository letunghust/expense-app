import * as ImagePicker from 'expo-image-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listReceipts } from '@/db/repo';
import { todayISO } from '@/lib/dates';
import { parseTransferReceipt, type ReceiptData } from '@/lib/receipt-parser';
import { withAutoLockPaused } from '@/lock/app-lock-context';

import { OCR_SUPPORTED, readTextLines } from './ocr';
import { pruneReceipts, receiptUri, saveReceipt } from './receipt-files';

export type ScanResult = ReceiptData & {
  /** Stored image name, to save on the transaction. */
  receipt: string;
  /** False where text can't be read (web preview); the image is attached anyway. */
  ocrAvailable: boolean;
  /** Text recognition threw; the user types the details instead. */
  ocrFailed: boolean;
  /** Everything OCR read, top to bottom, so misreads can be checked and reported. */
  ocrText: string;
};

/**
 * Lets the user pick a transfer screenshot, keeps a copy and reads the
 * transfer details from it. Resolves to null if the user cancels.
 */
export async function scanTransferReceipt(): Promise<ScanResult | null> {
  const picked = await withAutoLockPaused(() =>
    ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
  );
  if (picked.canceled) return null;

  const { uri } = picked.assets[0];
  const receipt = await saveReceipt(uri);
  let data: ReceiptData = {};
  let ocrText = '';
  let ocrFailed = false;
  if (OCR_SUPPORTED) {
    try {
      // Read the copy kept in app storage: the picker's cache file may already be gone.
      const lines = await readTextLines(receiptUri(receipt));
      ocrText = [...lines]
        .sort((a, b) => a.top - b.top || a.left - b.left)
        .map((line) => line.text)
        .join('\n');
      data = parseTransferReceipt(lines, todayISO());
    } catch (error) {
      // Still attach the image; the user types the details instead.
      console.warn('Text recognition failed', error);
      ocrText = String(error);
      ocrFailed = true;
    }
  }
  return { ...data, receipt, ocrAvailable: OCR_SUPPORTED, ocrFailed, ocrText };
}

/** Removes images left behind by deleted transactions, replaced images and abandoned scans. */
export async function cleanUpReceipts(db: SQLiteDatabase): Promise<void> {
  try {
    pruneReceipts(await listReceipts(db));
  } catch (error) {
    console.warn('Could not clean up receipt images', error);
  }
}

// A scan started outside the form (the scan button on the main screens) is
// handed to the new-transaction form here, since the image can be too large
// for a route param on web.
let pendingScan: { key: string; result: ScanResult } | undefined;

export function stashScan(result: ScanResult): string {
  const key = String(Date.now());
  pendingScan = { key, result };
  return key;
}

export function getStashedScan(key: string | undefined): ScanResult | undefined {
  return key != null && pendingScan?.key === key ? pendingScan.result : undefined;
}
