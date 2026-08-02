import jsQR from 'jsqr';
import { pickNativeImageAsDataUrl } from './images';

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image illisible.'));
    image.src = dataUrl;
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Lecture de l’image impossible.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export async function decodeQrDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const maxSide = 1800;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Lecture QR indisponible sur cet appareil.');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
  if (!result?.data) throw new Error('Aucun QR code lisible n’a été détecté.');
  return result.data;
}

export async function decodeQrFile(file: File): Promise<string> {
  return decodeQrDataUrl(await fileToDataUrl(file));
}

export async function scanQrWithNativeCamera(): Promise<string | null> {
  const dataUrl = await pickNativeImageAsDataUrl({ source: 'camera', quality: 90, width: 1800 });
  if (!dataUrl) return null;
  return decodeQrDataUrl(dataUrl);
}
