/**
 * @param {File} file
 * @param {number} [maxEdge]
 */
export async function fileToThumb(file, maxEdge = 512) {
  const bitmap = await bitmapFromFile(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) resolve(out);
      else reject(new Error("thumb"));
    }, "image/jpeg", 0.72);
  });
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return {
    name: file.name,
    mime: "image/jpeg",
    data: btoa(bin),
  };
}

/** @param {File} file */
async function bitmapFromFile(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    /* iOS 갤러리·HEIC는 Image 폴백이 되는 경우가 있다 */
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("thumb"));
      el.src = url;
    });
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(img);
    }
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
