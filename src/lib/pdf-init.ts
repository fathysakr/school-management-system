let pdfjs: any = null;

export async function getPdfjs(): Promise<any> {
  if (pdfjs) return pdfjs;

  const [workerMod, pdfjsMod] = await Promise.all([
    import('./pdf.worker.mjs'),
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ]);

  Object.defineProperty(pdfjsMod.PDFWorker, '_setupFakeWorkerGlobal', {
    value: Promise.resolve(workerMod.WorkerMessageHandler),
    writable: true,
    configurable: true,
  });

  pdfjs = pdfjsMod;
  return pdfjs;
}
