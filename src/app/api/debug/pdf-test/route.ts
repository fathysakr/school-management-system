import { NextRequest } from 'next/server';
import { getPdfjs } from '@/lib/pdf-init';

export async function GET() {
  const results: Record<string, any> = {};
  results.nodeVersion = process.version;
  results.platform = process.platform;

  try {
    const mod = await getPdfjs();
    results.pdfLoad = 'ok';
    results.version = mod.version;
    results.hasGetDocument = typeof mod.getDocument === 'function';
    results.disableWorker = mod.disableWorker;
    results.defaultSetting = mod.getDefaultSetting ? mod.getDefaultSetting('disableWorker') : 'N/A';

    // Manually create a worker and check its messageHandler
    try {
      const worker = new mod.PDFWorker('test-worker');
      results.workerDestroyed = worker.destroyed;
      results.mhBeforePromise = worker.messageHandler !== null;
      await worker.promise;
      results.mhAfterPromise = worker.messageHandler !== null;
      results.mhType = typeof worker.messageHandler;
    } catch (e2: any) {
      results.workerError = e2.message;
    }
  } catch (e: any) {
    results.error = e.message;
    results.stack = (e.stack || '').split('\n').slice(0, 8).join('\n');
  }

  return Response.json(results);
}

export async function POST(request: NextRequest) {
  const results: Record<string, any> = {};

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      results.error = 'no file';
      return Response.json(results);
    }

    const mod = await getPdfjs();
    results.pdfLoad = 'ok';
    results.version = mod.version;

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Step-by-step test
    const task = mod.getDocument({ data: buffer });
    results.taskType = typeof task;
    results.hasPromise = typeof task.promise;
    results.hasThen = typeof task.then;
    results.taskDestroyed = task.destroyed;
    results.hasWorker = task._worker !== null;
    if (task._worker) {
      results.workerDestroyed = task._worker.destroyed;
      results.mhBeforePromise = task._worker.messageHandler !== null;
    }

    const doc = await task.promise;
    results.numpages = doc.numPages;

    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    results.itemsCount = content.items.length;
    results.first5Items = content.items.slice(0, 5).map((item: any) => ({
      str: (item.str || '').substring(0, 100),
      x: item.transform?.[4]?.toFixed(1),
      y: item.transform?.[5]?.toFixed(1),
    }));
    results.allText = content.items.map((item: any) => item.str || '').join(' ').substring(0, 500);
    await doc.destroy();
    results.success = true;
  } catch (e: any) {
    results.error = e.message;
    results.stack = e.stack?.split('\n').slice(0, 8).join('\n');
  }

  return Response.json(results);
}
