let pdfjs: any = null;

export async function getPdfjs(): Promise<any> {
  if (pdfjs) return pdfjs;

  if (!(globalThis as any).pdfjsWorker) {
    const workerMod: any = await import('./pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = { WorkerMessageHandler: workerMod.WorkerMessageHandler };
  }

  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}
