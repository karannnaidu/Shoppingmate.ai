// Customer Care PRD 2026-10-28: photo proof from the shopper (a damaged item,
// the wrong product). The photo is resized and re-encoded to JPEG in the
// browser first — smaller uploads on mobile data, and re-encoding drops EXIF
// (including GPS location) before anything leaves the phone.

export const MAX_PHOTOS = 3;
const MAX_EDGE = 1600;

/** Open the camera / gallery. Must be called from a click handler. */
export function pickPhotos(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []).slice(0, MAX_PHOTOS));
      input.remove();
    });
    // Closing the picker without choosing never fires "change"; the promise
    // simply stays pending, which is harmless.
    document.body.appendChild(input);
    input.click();
  });
}

/** Resize to ≤1600px on the long edge and re-encode as JPEG (strips EXIF). */
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('could not encode the photo');
  return blob;
}

export type UploadResult = { ok: true; attachedTo: number | null } | { ok: false; message: string };

export async function uploadPhoto(opts: {
  apiBase: string;
  merchantId: string;
  sessionId: string;
  photo: Blob;
}): Promise<UploadResult> {
  const url = `${opts.apiBase}/v1/care/upload?sessionId=${encodeURIComponent(opts.sessionId)}&merchantId=${encodeURIComponent(opts.merchantId)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: opts.photo });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; attachedTo?: number | null; message?: string };
    if (res.ok && body.ok) return { ok: true, attachedTo: body.attachedTo ?? null };
    return { ok: false, message: body.message ?? "Couldn't attach that photo. Please try again." };
  } catch {
    return { ok: false, message: "Couldn't attach that photo — check your connection and try again." };
  }
}
