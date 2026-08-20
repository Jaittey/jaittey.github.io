const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_DATA_URL_SIZE = 760_000;

const fileToImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected image could not be opened.'));
    image.src = reader.result;
  };
  reader.onerror = () => reject(new Error('The selected image could not be read.'));
  reader.readAsDataURL(file);
});

export async function compressImageFile(file, options = {}) {
  if (!file) throw new Error('Select an image file.');
  if (!file.type.startsWith('image/')) throw new Error('Only image files are supported.');
  if (file.size > MAX_SOURCE_SIZE) throw new Error('The image is too large. Use a file smaller than 8 MB.');

  const image = await fileToImage(file);
  const maxWidth = Number(options.maxWidth || 1100);
  const maxHeight = Number(options.maxHeight || 700);
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length > MAX_DATA_URL_SIZE) {
    dataUrl = canvas.toDataURL('image/webp', 0.86);
  }
  if (dataUrl.length > MAX_DATA_URL_SIZE) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  }
  if (dataUrl.length > MAX_DATA_URL_SIZE) {
    throw new Error('The optimized image is still too large. Choose a smaller or simpler image.');
  }

  return {
    dataUrl,
    fileName: file.name,
    contentType: dataUrl.slice(5, dataUrl.indexOf(';')),
    width,
    height,
    originalSize: file.size,
    storedSize: Math.round(dataUrl.length * 0.75),
  };
}
