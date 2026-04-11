const MAX_DIM = 1200;
const JPEG_QUALITY = 0.72;

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  let targetW = width;
  let targetH = height;
  if (targetW > MAX_DIM || targetH > MAX_DIM) {
    const scale = MAX_DIM / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
}
