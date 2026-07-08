const PDFParser = require('pdf2json');
const fs = require('fs');

const createPdf = () => {
  const b = []; const w = (s) => b.push(s);
  w('%PDF-1.4\n');
  w('1 0 obj<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
  w('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n');
  w('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n');
  w('4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 100 700 Td (Hello World) Tj ET\nendstream\nendobj\n');
  w('5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n');
  w('xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000358 00000 n \n');
  w('trailer\n<</Size 6/Root 1 0 R>>\n%%EOF\n');
  return Buffer.from(b.join(''));
};

const pdfParser = new PDFParser();
pdfParser.on('pdfParser_dataReady', (pdfData) => {
  console.log('Pages:', Object.keys(pdfData.Pages || {}).length);
  console.log('Data keys:', Object.keys(pdfData).join(', '));
  console.log('Text:', pdfData.Pages?.[0]?.Texts?.map(t => t.R?.map(r => r.T).join('')).join(' '));
  console.log('SUCCESS');
});
pdfParser.on('pdfParser_dataError', (err) => {
  console.error('FAIL:', err);
});
pdfParser.parseBuffer(createPdf());
