async function main() {
  // Pre-cache worker module
  require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.worker.js');
  
  const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  PDFJS.disableWorker = true;
  
  const createPdf = () => {
    const b = []; const w = (s) => b.push(s);
    w('%PDF-1.4\n'); w('1 0 obj<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
    w('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n');
    w('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n');
    w('4 0 obj<</Length 48>>stream\nBT /F1 12 Tf 100 700 Td (Hello World) Tj ET\nendstream\nendobj\n');
    w('5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n');
    w('xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000358 00000 n \n');
    w('trailer\n<</Size 6/Root 1 0 R>>\n%%EOF\n');
    return Buffer.from(b.join(''));
  };

  const doc = await PDFJS.getDocument({data: createPdf()});
  console.log('pages:', doc.numPages);
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  console.log('items:', content.items.length);
  content.items.forEach(i => console.log(' -', i.str, 'x:', i.transform[4]));
  await doc.destroy();
  console.log('SUCCESS');
}
main().catch(e => console.log('ERROR:', e.message));
