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
      const task = origGetDocument({ ...src, worker: cachedWorker });
      const origReject = task._capability.reject.bind(task._capability);
      task._capability.reject = (reason: any) => {
        reason.diag = {
          workerMH: cachedWorker?.messageHandler !== null,
          workerDestroyed: cachedWorker?.destroyed,
          workerPortType: typeof cachedWorker?._port,
          instanceofCheck: cachedWorker instanceof pdfjsMod.PDFWorker,
        };
        origReject(reason);
      };
      return task;
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
