import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { listReceipts } from '@/db/repo';
import { strings } from '@/i18n';
import { todayISO } from '@/lib/dates';
import { showMessage } from '@/lib/dialog';
import { shrinkToFit } from '@/lib/image-size';
import { parseTransferReceipt, type ReceiptData } from '@/lib/receipt-parser';
import { withAutoLockPaused } from '@/lock/app-lock-context';

import { OCR_SUPPORTED, readTextLines } from './ocr';
import { pruneReceipts, receiptUri, saveReceipt } from './receipt-files';

export type ScanSource = 'camera' | 'library';

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

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };

/**
 * Photos from a camera are many megapixels but are kept and backed up for good
 * (on web, inside the database). This is still plenty for text recognition.
 */
const MAX_IMAGE_SIDE = 2400;

/**
 * Lets the user take a photo or pick an image, keeps a copy and reads the
 * details from it. Resolves to null if the user cancels.
 */
export async function scanTransferReceipt(source: ScanSource): Promise<ScanResult | null> {
  const picked = await withAutoLockPaused(() => openPicker(source));
  if (!picked || picked.canceled) return null;
  return readPickedImage(picked.assets[0]);
}

function openPicker(source: ScanSource): Promise<ImagePicker.ImagePickerResult | null> {
  if (source === 'library') return ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  return openCamera();
}

async function openCamera(): Promise<ImagePicker.ImagePickerResult | null> {
  // Web: the browser asks by itself, and only opens the camera straight from a tap, so nothing may be awaited first.
  if (Platform.OS !== 'web') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      showMessage(strings().receipt.cameraDenied, strings().receipt.cameraDeniedMessage);
      return null;
    }
  }
  return ImagePicker.launchCameraAsync({ ...PICKER_OPTIONS, cameraType: ImagePicker.CameraType.back });
}

let checkedForInterruptedScan = false;

/**
 * Android can kill the app while the camera is open (it needs the memory), so
 * the photo comes back to a fresh start of the app instead of the waiting scan.
 * Resolves to that scan once per app start, or null when there is none.
 */
export async function recoverInterruptedScan(): Promise<ScanResult | null> {
  if (checkedForInterruptedScan) return null;
  checkedForInterruptedScan = true;
  const pending = await ImagePicker.getPendingResultAsync();
  if (!pending || !('canceled' in pending) || pending.canceled) return null;
  return readPickedImage(pending.assets[0]);
}

async function readPickedImage(asset: ImagePicker.ImagePickerAsset): Promise<ScanResult> {
  const receipt = await saveReceipt(await shrunkenImage(asset));
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

async function shrunkenImage({ uri, width, height }: ImagePicker.ImagePickerAsset): Promise<string> {
  const size = shrinkToFit(width, height, MAX_IMAGE_SIDE);
  if (!size) return uri;
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize(size);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return saved.uri;
  } catch (error) {
    // A larger file is better than losing the photo.
    console.warn('Could not shrink the image', error);
    return uri;
  }
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
