import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativeApp } from './platform';

export interface NativeImageOptions {
  source?: 'camera' | 'photos' | 'prompt';
  quality?: number;
  width?: number;
  height?: number;
}

function sourceFor(value: NativeImageOptions['source']): CameraSource {
  if (value === 'camera') return CameraSource.Camera;
  if (value === 'photos') return CameraSource.Photos;
  return CameraSource.Prompt;
}

function isCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /cancel|canceled|cancelled|annul/i.test(message);
}

export async function pickNativeImageAsDataUrl(options: NativeImageOptions = {}): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const result = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: sourceFor(options.source),
      quality: options.quality ?? 85,
      width: options.width,
      height: options.height,
      correctOrientation: true,
      allowEditing: false,
      saveToGallery: false,
      promptLabelHeader: 'Photo Omnia',
      promptLabelPhoto: 'Choisir dans les photos',
      promptLabelPicture: 'Prendre une photo',
      promptLabelCancel: 'Annuler',
    });
    return result.dataUrl || null;
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
}

export function approximateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((data.length * 3) / 4);
}
