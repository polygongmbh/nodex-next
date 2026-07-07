// Downscale a picked image to a small square-ish avatar before uploading to
// noas (≤2 MB decoded, 4 MB JSON body cap). Mirrors nodex-talk's picker limits
// (512 px, quality ~0.85). Browser-only (canvas); avatars don't need alpha, so
// JPEG keeps the payload small.

export interface ResizedImage {
  /** `data:image/jpeg;base64,…` — accepted verbatim by noas as picture data. */
  dataUrl: string;
  contentType: string;
}

export async function resizeImage(
  file: File,
  maxSize = 512,
  quality = 0.85
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    context.drawImage(bitmap, 0, 0, width, height);
    const contentType = "image/jpeg";
    return { dataUrl: canvas.toDataURL(contentType, quality), contentType };
  } finally {
    bitmap.close();
  }
}
