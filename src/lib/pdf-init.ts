let cachedPdfjs: Promise<any> | null = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const workerMod = await import('./pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = workerMod;
    const pdfjsMod = await import('pdfjs-dist/build/pdf.mjs');

    pdfjsMod.PDFWorker.prototype.destroy = function () {
      this.destroyed = true;
      if (this._webWorker) {
        this._webWorker.terminate();
        this._webWorker = null;
      }
      this._port = null;
    };

    return pdfjsMod;
  })();

  return cachedPdfjs;
}
