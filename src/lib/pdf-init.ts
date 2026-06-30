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
    const workerMod = await import('./pdf.worker.mjs');
    const pdfjsMod = await import('pdfjs-dist/legacy/build/pdf.mjs');

    pdfjsMod.PDFWorker.prototype._setupFakeWorker = function () {
      const port = createLoopbackPort();
      workerMod.WorkerMessageHandler.initializeFromPort(port);
      this._port = port;
      this._messageHandler = new pdfjsMod.MessageHandler('main', 'worker', port);
      this._messageHandler.on('ready', function () {});
      this._readyCapability.resolve();
      this._messageHandler.send('configure', { verbosity: this.verbosity });
    };

    const origGetDocument = pdfjsMod.getDocument.bind(pdfjsMod);
    const wrappedGetDocument = function (src: any) {
      if (typeof src === 'string' || src instanceof URL || src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        src = typeof src === 'string' || src instanceof URL ? { url: src } : { data: src };
      }
      if (typeof src !== 'object') {
        throw new Error('Invalid parameter in getDocument, need parameter object.');
      }
      return origGetDocument(src);
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
