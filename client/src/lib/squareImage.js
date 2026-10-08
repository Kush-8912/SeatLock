// Turns a photo the user picked into a small square image for upload: centre
// crop, 320x320, WebP (JPEG where the browser can't encode WebP). Phone photos
// of several megabytes become a few tens of kilobytes, so the server never has
// to resize anything. Rotation from the camera's EXIF data is applied.
const SIZE = 320;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function squareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPEG, PNG or WebP).');
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error('That image couldn’t be opened. Try a JPEG or PNG.');
  }
  const w = source.width;
  const h = source.height;
  const side = Math.min(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
  source.close?.();
  // Browsers that can't encode WebP silently return PNG; use JPEG there instead.
  const webp = await toBlob(canvas, 'image/webp', 0.85);
  if (webp?.type === 'image/webp') return webp;
  return toBlob(canvas, 'image/jpeg', 0.88);
}
