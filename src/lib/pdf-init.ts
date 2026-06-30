let cachedPdfjs: Promise<any> | null = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const [workerMod, pdfjsMod] = await Promise.all([
      import('./pdf.worker.mjs'),
      import('pdfjs-dist/legacy/build/pdf.mjs'),
    ]);

    (globalThis as any).pdfjsWorker = workerMod;

    Object.defineProperty(pdfjsMod.PDFWorker, '_setupFakeWorkerGlobal', {
      value: Promise.resolve(workerMod.WorkerMessageHandler),
      configurable: true,
      writable: false,
    });

    return pdfjsMod;
  })();

  return cachedPdfjs;
}
