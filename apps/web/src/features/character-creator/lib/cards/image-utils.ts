export async function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export async function convertImageBlobToPng(sourceBlob: Blob): Promise<Blob> {
  if (sourceBlob.type === 'image/png') {
    return sourceBlob;
  }

  const imageBitmap = await createImageBitmap(sourceBlob);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    context.drawImage(imageBitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('Failed to encode portrait as PNG.'));
      }, 'image/png');
    });
  } finally {
    imageBitmap.close();
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
