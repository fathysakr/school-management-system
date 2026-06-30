let cachedPdfjs: Promise<any> | null = null;

function createLoopbackPort(): any {
  const listeners = new Set<Function>();
  return {
    postMessage(obj: any, transfers?: any[]) {
      const event = {
        data: typeof structuredClone === 'function'
          ? structuredClone(obj, transfers ? { transfer: transfers } : undefined) as any
          : obj,
      };
      Promise.resolve().then(() => {
        for (const listener of listeners) {
          listener.call(this, event);
        }
      });
    },
    addEventListener(_name: string, listener: Function) {
      listeners.add(listener);
    },
    removeEventListener(_name: string, listener: Function) {
      listeners.delete(listener);
    },
    terminate() {
      listeners.clear();
    },
  };
}

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const [workerMod, pdfjsMod] = await Promise.all([
      import('./pdf.worker.mjs'),
      import('pdfjs-dist/legacy/build/pdf.mjs'),
    ]);

    const port = createLoopbackPort();
    workerMod.WorkerMessageHandler.initializeFromPort(port);
    pdfjsMod.__worker = new pdfjsMod.PDFWorker({ port });

    const origGetDocument = pdfjsMod.getDocument.bind(pdfjsMod);
    pdfjsMod.getDocument = function (src: any) {
      if (typeof src === 'string' || src instanceof URL || src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        src = typeof src === 'string' || src instanceof URL ? { url: src } : { data: src };
      }
      if (typeof src !== 'object') {
        throw new Error('Invalid parameter in getDocument, need parameter object.');
      }
      return origGetDocument({ ...src, worker: pdfjsMod.__worker });
    };

    return pdfjsMod;
  })();

  return cachedPdfjs;
}
