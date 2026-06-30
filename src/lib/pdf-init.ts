let pdfjs: any = null;

export async function getPdfjs(): Promise<any> {
  if (pdfjs) return pdfjs;

  const [workerMod, pdfjsMod] = await Promise.all([
    import('./pdf.worker.mjs'),
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ]);

  pdfjsMod.PDFWorker._setupFakeWorkerGlobal = Promise.resolve(workerMod.WorkerMessageHandler);

  pdfjs = pdfjsMod;
  return pdfjs;
}
