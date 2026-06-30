let cachedPdfjs: Promise<any> | null = null;
let cachedWorker: any = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const workerMod = await import('./pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = workerMod;
    const pdfjsMod = await import('pdfjs-dist/legacy/build/pdf.mjs');

    cachedWorker = new pdfjsMod.PDFWorker({ name: 'shared-worker' });
    await cachedWorker.promise;

    const origGetDocument = pdfjsMod.getDocument.bind(pdfjsMod);
    const wrappedGetDocument = function (src: any) {
      if (typeof src === 'string' || src instanceof URL || src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        src = typeof src === 'string' || src instanceof URL ? { url: src } : { data: src };
      }
      if (typeof src !== 'object') {
        throw new Error('Invalid parameter in getDocument, need parameter object.');
      }
      return origGetDocument({ ...src, worker: cachedWorker });
    };

    return new Proxy(pdfjsMod, {
      get(target, prop) {
        if (prop === 'getDocument') return wrappedGetDocument;
        return Reflect.get(target, prop);
      },
    });
  })();

  return cachedPdfjs;
}
