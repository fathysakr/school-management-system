import { NextRequest } from 'next/server';

export async function GET(_request: NextRequest) {
  const results: Record<string, any> = { test: 'GET' };
  results.nodeVersion = process.version;
  results.platform = process.platform;
  
  try {
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
    results.pdfLoad = 'ok';
    results.hasGetDocument = typeof mod.getDocument === 'function';
  } catch (e: any) {
    results.pdfLoad = 'failed';
    results.pdfError = e.message;
  }

  return Response.json(results);
}

export async function POST(request: NextRequest) {
  const results: Record<string, any> = { test: 'POST' };
  results.nodeVersion = process.version;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    results.hasFile = !!file;
    results.fileName = file?.name;
    results.fileSize = file?.size;

    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
    results.pdfLoad = 'ok';
    results.hasGetDocument = typeof mod.getDocument === 'function';

    if (file) {
      const buffer = new Uint8Array(await file.arrayBuffer());
      results.bufferSize = buffer.length;

      const doc = await mod.getDocument({ data: buffer }).promise;
      results.numPages = doc.numPages;

      const page = await doc.getPage(1);
      const content = await page.getTextContent();
      results.itemsCount = content.items.length;
      await doc.destroy();
    }
  } catch (e: any) {
    results.error = e.message;
    results.stack = e.stack?.split('\n').slice(0, 8).join('\n');
  }

  return Response.json(results);
}
