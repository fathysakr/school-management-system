import { MessageChannel } from 'worker_threads';

let initialized = false;

export async function getPdfjs(): Promise<any> {
  if (initialized) {
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  }

  const [workerMod, pdfjsMod] = await Promise.all([
    import('./pdf.worker.mjs'),
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ]);

  const { port1, port2 } = new MessageChannel();
  workerMod.WorkerMessageHandler.initializeFromPort(port1);
  pdfjsMod.GlobalWorkerOptions.workerPort = port2;

  initialized = true;
  return pdfjsMod;
}
