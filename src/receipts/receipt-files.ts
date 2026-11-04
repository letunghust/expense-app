import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/** Transfer screenshots live in the app's private documents folder; transactions store only the file name. */
const receiptsDir = () => new Directory(Paths.document, 'receipts');

/** A stored name is cheap to repeat, so all the transactions of a split receipt can point to its image. */
export const RECEIPT_CAN_BE_SHARED = true;

/** Copies a picked image into app storage and returns the name to save on the transaction. */
export async function saveReceipt(sourceUri: string): Promise<string> {
  const dir = receiptsDir();
  dir.create({ idempotent: true, intermediates: true });
  const extension = /\.(jpe?g|png|webp|heic)$/i.exec(sourceUri)?.[1].toLowerCase() ?? 'jpg';
  const name = `${Crypto.randomUUID()}.${extension}`;
  await new File(sourceUri).copy(new File(dir, name));
  return name;
}

export function receiptUri(name: string): string {
  return new File(receiptsDir(), name).uri;
}

const cameraMark = () => new File(Paths.document, 'camera-open');
const MAX_INTERRUPTED_PHOTO_AGE = 60 * 60 * 1000;

/**
 * Android can kill the app while the camera is open, and the image picker then
 * has no result to give back (it only saves its state when the screen is closed
 * properly). So a mark is kept while the camera is open: if it is still there on
 * the next start, the photo the camera wrote to the picker's folder is recovered.
 */
export function markCameraOpen(): void {
  cameraMark().create({ overwrite: true });
}

export function clearCameraMark(): void {
  const mark = cameraMark();
  if (mark.exists) mark.delete();
}

/** The photo taken while the app was killed, once; null when there is none. */
export function takeInterruptedPhoto(): string | null {
  const mark = cameraMark();
  if (!mark.exists) return null;
  const openedAt = mark.modificationTime ?? 0;
  mark.delete();
  // The picker creates an empty file up front; the camera fills it only when the photo is confirmed.
  const pickerFolder = new Directory(Paths.cache, 'ImagePicker');
  if (Date.now() - openedAt > MAX_INTERRUPTED_PHOTO_AGE || !pickerFolder.exists) return null;
  const photos = pickerFolder
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.size > 0 && (entry.modificationTime ?? 0) >= openedAt)
    .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
  return photos[0]?.uri ?? null;
}

/** Deletes stored images that no transaction refers to any more. */
export function pruneReceipts(keep: string[]): void {
  const dir = receiptsDir();
  if (!dir.exists) return;
  const referenced = new Set(keep);
  for (const entry of dir.list()) {
    if (entry instanceof File && !referenced.has(entry.name)) entry.delete();
  }
}

/** The stored image as base64 for a backup, or null if the file is gone. */
export async function readReceiptBase64(name: string): Promise<string | null> {
  const file = new File(receiptsDir(), name);
  return file.exists ? file.base64() : null;
}

/** Stores an image restored from a backup and returns the name to save on the transaction. */
export async function writeReceiptBase64(name: string, base64: string): Promise<string> {
  const dir = receiptsDir();
  dir.create({ idempotent: true, intermediates: true });
  // Names come from a file the user picked; never let one point outside the folder.
  const safeName = /^[\w-]+\.\w+$/.test(name) ? name : `${Crypto.randomUUID()}.jpg`;
  const file = new File(dir, safeName);
  if (file.exists) file.delete();
  file.create();
  await file.write(base64, { encoding: 'base64' });
  return safeName;
}
