// Уменьшение изображений в браузере до загрузки в хранилище.
//
// Снимок с телефона — это 3–5 МБ и ~4000px по стороне. В карточку места он
// показывается размером с ладонь, поэтому грузить и хранить оригинал незачем:
// это медленная загрузка для пользователя и лишний объём в бакете. Ужимаем на
// клиенте, до presigned-PUT, чтобы в S3 уже уходил лёгкий файл.
//
// Формат вывода — WebP: он заметно легче JPEG при том же качестве и понимается
// всеми браузерами, где работает само приложение.

const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.82;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      element.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToFile(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Не удалось подготовить изображение"));
          return;
        }
        resolve(new File([blob], `${baseName}-${Date.now()}.webp`, { type: blob.type }));
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    );
  });
}

/**
 * Ужимает фотографию с сохранением пропорций так, чтобы длинная сторона не
 * превышала `maxSize`. Меньшие изображения не увеличиваются. Результат — WebP.
 */
export async function downscaleImage(
  file: File,
  maxSize: number,
  baseName = "photo",
): Promise<File> {
  const image = await loadImage(file);

  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > maxSize ? maxSize / longest : 1;
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось обработать изображение");
  context.drawImage(image, 0, 0, width, height);

  return canvasToFile(canvas, baseName);
}

/**
 * Приводит фотографию к квадрату `size`×`size` центральной обрезкой. Для
 * аватаров: форма всегда одинаковая, вес предсказуемый. Результат — WebP.
 */
export async function cropSquareImage(
  file: File,
  size: number,
  baseName = "avatar",
): Promise<File> {
  const image = await loadImage(file);

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось обработать изображение");
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  return canvasToFile(canvas, baseName);
}
