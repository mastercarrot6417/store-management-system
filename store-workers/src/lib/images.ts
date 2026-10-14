/**
 * Product photo uploads, stored in R2 under the same "uploads/pimg_..." names
 * the PHP site used, so the paths saved in product_images look the same.
 * routes/uploads.ts serves them back at /uploads/<name>.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Keeps one upload request well inside a Worker's memory (the whole form is read at once). */
export const MAX_IMAGES_PER_UPLOAD = 5;

type ImageType = { extension: string; contentType: string };

/**
 * Works out the image type from the file's first bytes. The file name and
 * the browser's stated type are ignored, so a renamed HTML or script file
 * can never be stored as an "image".
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return { extension: "jpg", contentType: "image/jpeg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { extension: "png", contentType: "image/png" };
  if (starts(0x47, 0x49, 0x46, 0x38)) return { extension: "gif", contentType: "image/gif" };
  const riff = starts(0x52, 0x49, 0x46, 0x46);
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return { extension: "webp", contentType: "image/webp" };
  return null;
}

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Stores one uploaded photo and returns its path ("uploads/pimg_5_12_ab12cd34ef56.jpg"),
 * or null if it isn't a JPEG, PNG, GIF or WebP image, is empty, or is over 5 MB.
 */
export async function storeProductImage(bucket: R2Bucket, productId: number, colourId: number, file: File): Promise<string | null> {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return null;

  const path = `uploads/pimg_${productId}_${colourId}_${randomHex(6)}.${type.extension}`;
  await bucket.put(path, bytes, { httpMetadata: { contentType: type.contentType } });
  return path;
}

/** Only files this app could have stored: a plain name directly under uploads/. */
const STORED_PATH = /^uploads\/[A-Za-z0-9._-]+$/;

/** Removes stored photos. Failures are logged, not thrown: the database change has already been made. */
export async function deleteStoredImages(bucket: R2Bucket, paths: string[]): Promise<void> {
  const keys = paths.filter((p) => STORED_PATH.test(p) && !p.includes(".."));
  if (keys.length === 0) return;
  try {
    await bucket.delete(keys);
  } catch (err) {
    console.error("Could not delete image(s) from R2:", keys, err);
  }
}

