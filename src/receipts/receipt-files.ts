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
