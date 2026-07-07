let cachedPdfjs: Promise<any> | null = null;

export async function getPdfjs(): Promise<any> {
  if (cachedPdfjs) {
    return cachedPdfjs;
  }

  cachedPdfjs = (async () => {
    const pdfjsMod = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
    pdfjsMod.disableWorker = true;
    return pdfjsMod;
  })();

  return cachedPdfjs;
}
