'use client';

import { supabase } from '@/lib/supabase';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { resolve(canvas.toDataURL(type, quality)); return; }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(canvas.toDataURL(type, quality));
        reader.readAsDataURL(blob);
      },
      type,
      quality,
    );
  });
}

async function canvasToUint8Array(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to create blob')); return; }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
      },
      type,
      quality,
    );
  });
}

async function downscaleAndConvert(
  dataUrl: string,
  originalType: string,
): Promise<{ dataUrl: string; uint8: Uint8Array; contentType: string }> {
  const img = await loadImageFromDataUrl(dataUrl);

  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);

  const outType = 'image/jpeg';
  const preview = await canvasToDataUrl(canvas, outType, JPEG_QUALITY);
  const uint8 = await canvasToUint8Array(canvas, outType, JPEG_QUALITY);

  return { dataUrl: preview, uint8, contentType: outType };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function pickFileFromWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    let settled = false;

    const cleanup = () => {
      document.body.removeChild(input);
    };

    input.onchange = () => {
      settled = true;
      const file = input.files && input.files.length > 0 ? input.files[0] : null;
      cleanup();
      resolve(file);
    };

    // Fallback: if user cancels and onchange never fires, resolve null after a delay
    setTimeout(() => {
      if (!settled && (!input.files || input.files.length === 0)) {
        settled = true;
        cleanup();
        resolve(null);
      }
    }, 120000);

    document.body.appendChild(input);
    input.click();
  });
}

export async function captureAndUpload(
  field: string,
  identifier: string,
): Promise<{ url: string | null; preview: string | null }> {
  let file: File | null = null;

  // Try Capacitor native camera first
  let isNative = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }

  if (isNative) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        quality: 90,
        allowEditing: false,
        correctOrientation: true,
        promptLabelPhoto: 'اختر من المعرض',
        promptLabelPicture: 'التقط صورة',
      });

      if (!photo.dataUrl) return { url: null, preview: null };

      // Convert the data URL to a File object so we go through the same pipeline
      const resp = await fetch(photo.dataUrl);
      const blob = await resp.blob();
      const ext = photo.format || 'jpeg';
      file = new File([blob], `${field}.${ext}`, { type: `image/${ext}` });
    } catch {
      // Native camera failed — fall through to web picker
    }
  }

  if (!file) {
    file = await pickFileFromWeb();
    if (!file) return { url: null, preview: null };
  }

  // Read the file to a data URL
  const rawDataUrl = await fileToDataUrl(file);

  // Downscale via canvas — this also normalizes HEIC/HEIF/WebP/etc to JPEG
  let processed: { dataUrl: string; uint8: Uint8Array; contentType: string };
  try {
    processed = await downscaleAndConvert(rawDataUrl, file.type || 'image/jpeg');
  } catch {
    // Canvas approach failed (e.g., HEIC on some browsers) — try heic2any
    try {
      const heic2any = (await import('heic2any')).default;
      const resp = await fetch(rawDataUrl);
      const blob = await resp.blob();
      const converted = await heic2any({ blob, toType: 'image/jpeg', quality: JPEG_QUALITY }) as Blob;
      const convertedDataUrl = await fileToDataUrl(new File([converted], 'converted.jpeg', { type: 'image/jpeg' }));
      processed = await downscaleAndConvert(convertedDataUrl, 'image/jpeg');
    } catch {
      // Last resort: upload the raw file as-is
      const uint8 = new Uint8Array(await file.arrayBuffer());
      processed = { dataUrl: rawDataUrl, uint8, contentType: file.type || 'image/jpeg' };
    }
  }

  const safeIdentifier = (identifier || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${field}-${safeIdentifier}-${Date.now()}.jpeg`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('driver-docs')
    .upload(fileName, processed.uint8, {
      contentType: processed.contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('UPLOAD ERROR:', uploadError);
    return { url: null, preview: null };
  }

  const { data: urlData } = supabase.storage.from('driver-docs').getPublicUrl(uploadData.path);
  return { url: urlData.publicUrl, preview: processed.dataUrl };
}