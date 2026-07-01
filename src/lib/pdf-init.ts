let cachedPdfjs: Promise<any> | null = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const workerMod = await import('./pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = workerMod;
    const pdfjsMod = await import('pdfjs-dist/legacy/build/pdf.mjs');

    (globalThis as any).__pdfjsDiag = { traps: [] };

    const origDestroy = pdfjsMod.PDFWorker.prototype.destroy;
    pdfjsMod.PDFWorker.prototype.destroy = function () {
      (globalThis as any).__pdfjsDiag.traps.push({
        event: 'destroy',
        name: this.name,
        time: Date.now(),
        hadMH: this._messageHandler !== null,
        stack: new Error().stack?.split('\n').slice(1, 4).join('; '),
      });
      return origDestroy.apply(this, arguments as any);
    };

    return pdfjsMod;
  })();

  return cachedPdfjs;
}
