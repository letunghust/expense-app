/**
 * Web preview: there is no app file storage, so the image itself is kept in
 * the database as a data: URI (the picker's blob: URLs die with the page).
 */
export async function saveReceipt(sourceUri: string): Promise<string> {
  const blob = await (await fetch(sourceUri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function receiptUri(name: string): string {
  return name;
}

export function pruneReceipts(_keep: string[]): void {}
