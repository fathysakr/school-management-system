let cachedPdfjs: Promise<any> | null = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    // Pre-load the worker module so PDFWorker._setupFakeWorker's require.ensure
    // will find it in the module cache
    require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.worker.js');

    const pdfjsMod = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
    pdfjsMod.disableWorker = true;
    pdfjsMod.PDFJS.disableWorker = true;
    return pdfjsMod;
  })();

  return cachedPdfjs;
}
