export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function readCustomPhoto(file) {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("La imagen supera el máximo de 5 MB.");
  if (file.type && !file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("El navegador no puede leer esta imagen. Prueba con JPG, PNG o WebP."));
      img.src = url;
    });
    const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
