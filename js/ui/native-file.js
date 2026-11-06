(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldNativeFile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isCancel(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.name === 'AbortError' || message.includes('cancel');
  }

  function blobToBase64(blob, FileReaderImpl) {
    return new Promise((resolve, reject) => {
      const reader = new FileReaderImpl();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(blob);
    });
  }

  function getNativePlugins(capacitor) {
    if (!capacitor?.isNativePlatform?.()) return null;
    const { Filesystem, Share } = capacitor.Plugins || {};
    return Filesystem && Share ? { Filesystem, Share } : null;
  }

  // Saves a file the user can keep.
  // - Inside the Capacitor app: writes it to the app cache and opens the system share sheet
  //   (the WebView cannot download files).
  // - In a browser: triggers a normal download.
  // Pass either `text` or `blob`. Resolves to { method: 'native_share' | 'download' | 'unsupported', cancelled }.
  async function saveFile({
    filename,
    text,
    blob,
    mimeType = 'application/octet-stream',
    title = filename,
    document: doc = typeof document !== 'undefined' ? document : null,
    capacitor = typeof globalThis !== 'undefined' ? globalThis.Capacitor : null,
    FileReaderImpl = typeof FileReader === 'function' ? FileReader : null,
    urlApi = typeof URL !== 'undefined' ? URL : null,
  } = {}) {
    if (!filename || (text == null && !blob)) throw new Error('filename and content are required');

    const native = getNativePlugins(capacitor);
    if (native) {
      const written = await native.Filesystem.writeFile(
        text != null
          ? { path: filename, data: text, directory: 'CACHE', encoding: 'utf8' }
          : { path: filename, data: await blobToBase64(blob, FileReaderImpl), directory: 'CACHE' },
      );
      try {
        await native.Share.share({ title, dialogTitle: title, url: written.uri });
        return { method: 'native_share', cancelled: false };
      } catch (error) {
        if (isCancel(error)) return { method: 'native_share', cancelled: true };
        throw error;
      }
    }

    if (doc && doc.body && urlApi?.createObjectURL) {
      const payload = blob || new Blob([text], { type: mimeType });
      const url = urlApi.createObjectURL(payload);
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      doc.body.appendChild(anchor);
      anchor.click();
      doc.body.removeChild(anchor);
      setTimeout(() => urlApi.revokeObjectURL(url), 1000);
      return { method: 'download', cancelled: false };
    }

    return { method: 'unsupported', cancelled: false };
  }

  return { saveFile, getNativePlugins, isCancel };
});
