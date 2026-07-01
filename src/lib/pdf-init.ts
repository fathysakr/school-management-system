let cachedPdfjs: Promise<any> | null = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const workerMod = await import('./pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = workerMod;
    const pdfjsMod = await import('pdfjs-dist/build/pdf.mjs');

    (globalThis as any).__pdfjsDiag = { traps: [] };

    const origWorkerDestroy = pdfjsMod.PDFWorker.prototype.destroy;
    pdfjsMod.PDFWorker.prototype.destroy = function () {
      (globalThis as any).__pdfjsDiag.traps.push({
        event: 'worker.destroy',
        name: this.name,
        time: Date.now(),
        hadMH: this._messageHandler !== null,
        destroyed: this.destroyed,
        stack: new Error().stack?.split('\n').slice(1, 6).join('; '),
      });
      return origWorkerDestroy.apply(this, arguments as any);
    };

    try {
      const tmpTask = pdfjsMod.getDocument({ data: new Uint8Array(1) });
      const TaskClass = tmpTask.constructor;
      tmpTask.destroy().catch(() => {});
      const origTaskDestroy = TaskClass.prototype.destroy;
      TaskClass.prototype.destroy = function () {
        (globalThis as any).__pdfjsDiag.traps.push({
          event: 'task.destroy',
          time: Date.now(),
          hasWorker: !!this._worker,
          workerName: this._worker?.name,
          workerDestroyed: this._worker?.destroyed,
          hasTransport: !!this._transport,
          stack: new Error().stack?.split('\n').slice(1, 6).join('; '),
        });
        return origTaskDestroy.apply(this, arguments as any);
      };
    } catch {}

    return pdfjsMod;
  })();

  return cachedPdfjs;
}
