export class SharingUnavailableError extends Error {}

/** No share sheet in the browser: download the file instead. */
export async function shareTextFile({
  fileName,
  content,
  mimeType,
}: {
  fileName: string;
  content: string;
  mimeType: string;
  dialogTitle: string;
}): Promise<void> {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function pickTextFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,application/json,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
