export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxBytes?: number;
};

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_MAX_HEIGHT = 1280;
const DEFAULT_QUALITY = 0.7;
const DEFAULT_MAX_BYTES = 700_000; // ~700 KB

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}

function estimateByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // 4 base64 chars -> 3 bytes
  return Math.floor((base64.length * 3) / 4);
}

export async function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  try {
    const img = await dataUrlToImage(dataUrl);
    let { width, height } = img;
    if (!width || !height) {
      return dataUrl;
    }

    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let quality = options.quality ?? DEFAULT_QUALITY;
    let result = canvas.toDataURL("image/jpeg", quality);

    // Iteratively reduce quality if still above maxBytes
    while (estimateByteLength(result) > maxBytes && quality > 0.4) {
      quality = Math.max(0.4, quality - 0.15);
      result = canvas.toDataURL("image/jpeg", quality);
    }

    return result;
  } catch {
    // If anything goes wrong, fall back to original so we don't break flows
    return dataUrl;
  }
}

