import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/** Transfer screenshots live in the app's private documents folder; transactions store only the file name. */
const receiptsDir = () => new Directory(Paths.document, 'receipts');

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
