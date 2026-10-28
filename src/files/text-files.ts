import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { withAutoLockPaused } from '@/lock/app-lock-context';

export class SharingUnavailableError extends Error {}

/** Writes a text file and opens the share sheet, so the user can save it to Drive, Zalo, email… */
export async function shareTextFile({
  fileName,
  content,
  mimeType,
  dialogTitle,
}: {
  fileName: string;
  content: string;
  mimeType: string;
  dialogTitle: string;
}): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);

  if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
  await withAutoLockPaused(() => Sharing.shareAsync(file.uri, { mimeType, dialogTitle }));
}

/** Lets the user pick a file (backup or CSV) and returns its text, or null if they cancel. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  // Android reports CSV under several MIME types, so don't filter.
  const picked = await withAutoLockPaused(() => File.pickFileAsync({ mimeTypes: '*/*' }));
  if (picked.canceled) return null;
  return { name: picked.result.name, text: await picked.result.text() };
}
