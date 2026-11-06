(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldImageResize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_MAX_SIZE = 1280;
  const DEFAULT_QUALITY = 0.82;
  // Files this small and already JPEG are stored as they are.
  const KEEP_AS_IS_BYTES = 250 * 1024;

  function fitWithin(width, height, maxSize) {
    if (!(width > 0) || !(height > 0) || !(maxSize > 0)) return { width: 0, height: 0 };
    const scale = Math.min(1, maxSize / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function readAsDataUrl(file, FileReaderImpl) {
    return new Promise((resolve, reject) => {
      const reader = new FileReaderImpl();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }

  async function decode(file, { createImageBitmapImpl, ImageImpl, urlApi }) {
    if (typeof createImageBitmapImpl === 'function') {
      try {
        const bitmap = await createImageBitmapImpl(file);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close && bitmap.close() };
      } catch (_error) {
        // Fall back to an <img> element below.
      }
    }
    if (typeof ImageImpl !== 'function' || !urlApi?.createObjectURL) throw new Error('Image decoding is unavailable');
    const url = urlApi.createObjectURL(file);
    try {
      const image = new ImageImpl();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Could not decode image'));
        image.src = url;
      });
      return { source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, release: () => {} };
    } finally {
      urlApi.revokeObjectURL?.(url);
    }
  }

  // Returns a JPEG data URL no larger than maxSize on its longest side.
  // Falls back to the original file's data URL if the image cannot be decoded.
  async function resizeImageFile(file, {
    maxSize = DEFAULT_MAX_SIZE,
    quality = DEFAULT_QUALITY,
    document: doc = typeof document !== 'undefined' ? document : null,
    createImageBitmapImpl = typeof createImageBitmap === 'function' ? createImageBitmap : null,
    ImageImpl = typeof Image === 'function' ? Image : null,
    urlApi = typeof URL !== 'undefined' ? URL : null,
    FileReaderImpl = typeof FileReader === 'function' ? FileReader : null,
  } = {}) {
    try {
      if (!doc) throw new Error('Document is required');
      const decoded = await decode(file, { createImageBitmapImpl, ImageImpl, urlApi });
      try {
        const target = fitWithin(decoded.width, decoded.height, maxSize);
        if (!target.width) throw new Error('Image has no size');

        const alreadySmall = target.width === decoded.width && target.height === decoded.height;
        if (alreadySmall && file.type === 'image/jpeg' && file.size <= KEEP_AS_IS_BYTES) {
          return await readAsDataUrl(file, FileReaderImpl);
        }

        const canvas = doc.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, target.width, target.height);
        context.drawImage(decoded.source, 0, 0, target.width, target.height);
        return canvas.toDataURL('image/jpeg', quality);
      } finally {
        decoded.release();
      }
    } catch (_error) {
      return readAsDataUrl(file, FileReaderImpl);
    }
  }

  return { fitWithin, resizeImageFile, DEFAULT_MAX_SIZE, DEFAULT_QUALITY };
});
