// Client-side photo prep: fix phone-camera rotation, shrink to <=1600px, save as JPEG.
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.85;

// Pure helper (unit-testable): the size a w x h image should be scaled to.
export function fitSize(w, h, max = MAX_EDGE) {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const s = max / long;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      // 'from-image' applies the EXIF orientation so portrait phone photos are not sideways.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {
      try {
        const bmp = await createImageBitmap(file);
        return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
      } catch {
        /* fall through to <img> */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode(); // modern browsers honour EXIF orientation for <img> by default
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function processImage(file, { max = MAX_EDGE, quality = JPEG_QUALITY } = {}) {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't a picture.");
  let img;
  try {
    img = await decode(file);
  } catch {
    throw new Error("Sorry, that photo couldn't be opened. Try a JPG or PNG picture.");
  }
  const { width, height } = fitSize(img.width, img.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // JPEG has no transparency; flatten onto white (pixel data, not a UI color)
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img.source, 0, 0, width, height);
  img.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not prepare that photo.");
  return { blob, width, height };
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function blobToBase64(blob) {
  const url = await blobToDataURL(blob);
  return url.slice(url.indexOf(",") + 1);
}
