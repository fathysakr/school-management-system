async function main() {
  const pdfMod = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  pdfMod.disableWorker = true;

  const createPdf = () => {
    const b = []; const w = (s) => b.push(s);
    w('%PDF-1.4\n'); w('1 0 obj<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
    w('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n');
    w('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n');
    w('4 0 obj<</Length 48>>stream\nBT /F1 12 Tf 100 700 Td (Hello) Tj ET\nendstream\nendobj\n');
    w('5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n');
    w('xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000358 00000 n \n');
    w('trailer\n<</Size 6/Root 1 0 R>>\n%%EOF\n');
    return Uint8Array.from(Buffer.from(b.join('')));
  };

  const result = pdfMod.getDocument({data: createPdf()});
  console.log('keys:', Object.keys(result).join(','));
  console.log('has promise:', typeof result.promise);
  console.log('has then:', typeof result.then);
  
  const doc = await result.promise;
  console.log('doc pages:', doc.numPages);
  console.log('SUCCESS');
}
main().catch(e => console.error('FAIL:', e.message));
