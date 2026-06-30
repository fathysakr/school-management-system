import { NextRequest } from 'next/server';
import { getPdfjs } from '@/lib/pdf-init';

export async function GET(_request: NextRequest) {
  const results: Record<string, any> = {};
  results.nodeVersion = process.version;
  results.platform = process.platform;
  results.hasDOMMatrix = typeof globalThis.DOMMatrix !== 'undefined';
  results.hasPdfjsWorker = typeof (globalThis as any).pdfjsWorker !== 'undefined';

  try {
    const mod = await getPdfjs();
    results.pdfLoad = 'ok';
    results.hasGetDocument = typeof mod.getDocument === 'function';
    results.hasGlobalWorkerOptions = typeof mod.GlobalWorkerOptions !== 'undefined';
    results.hasWorker = !!mod.__worker;
    if (mod.__worker) {
      results.workerMessageHandler = mod.__worker.messageHandler !== null;
      results.workerPort = mod.__worker._port !== null;
      results.workerWebWorker = mod.__worker._webWorker;
      await mod.__worker.promise;
      results.workerPromiseResolved = true;
      results.workerMessageHandlerAfter = mod.__worker.messageHandler !== null;
    }
  } catch (e: any) {
    results.error = e.message;
    results.stack = (e.stack || '').split('\n').slice(0, 8).join('\n');
  }

  return Response.json(results);
}

export async function POST(request: NextRequest) {
  const results: Record<string, any> = {};
  results.nodeVersion = process.version;
  results.hasDOMMatrix = typeof globalThis.DOMMatrix !== 'undefined';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    results.hasFile = !!file;
    results.fileName = file?.name;
    results.fileSize = file?.size;

    if (!file) {
      results.error = 'no file';
      return Response.json(results);
    }

    const mod = await getPdfjs();
    results.pdfLoad = 'ok';

    const buffer = new Uint8Array(await file.arrayBuffer());
    results.bufferSize = buffer.length;

    const doc = await mod.getDocument({ data: buffer }).promise;
    results.numPages = doc.numPages;

    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    results.itemsCount = content.items.length;
    results.first20Items = content.items.slice(0, 20).map((item: any) => ({
      str: (item.str || '').slice(0, 100),
      x: item.transform?.[4]?.toFixed(1),
      y: item.transform?.[5]?.toFixed(1),
      width: item.width?.toFixed(1),
      height: item.height?.toFixed(1),
    }));
    results.allText = content.items.map((item: any) => item.str || '').join(' ').slice(0, 500);
    await doc.destroy();
  } catch (e: any) {
    results.error = e.message;
    results.stack = e.stack?.split('\n').slice(0, 8).join('\n');
  }

  return Response.json(results);
}
