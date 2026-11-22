// Photos are shrunk in the browser before upload: a phone picture of 4–8 MB becomes a few hundred KB,
// which uploads fast on mobile data and stays readable for the model.
const MAX_SIDE = 1600;
export const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 6 * 1024 * 1024;

async function decode(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
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

export async function prepareFile(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw Object.assign(new Error('file_too_large'), { code: 'file_too_large' });
    return file;
  }
  if (!file.type.startsWith('image/')) throw Object.assign(new Error('unsupported_file'), { code: 'unsupported_file' });

  let image;
  try {
    image = await decode(file);
  } catch {
    throw Object.assign(new Error('unsupported_file'), { code: 'unsupported_file' });
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw Object.assign(new Error('unsupported_file'), { code: 'unsupported_file' });
  const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
