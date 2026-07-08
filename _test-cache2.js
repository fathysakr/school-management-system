async function main() {
  // Don't pre-cache worker
  const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  PDFJS.disableWorker = true;
  
  // Just test worker creation
  const worker = new PDFJS.PDFWorker('test');
  console.log('worker created, destroyed:', worker.destroyed);
  console.log('mh before:', worker.messageHandler !== null);
  await worker.promise;
  console.log('promise resolved');
  console.log('mh after:', worker.messageHandler !== null);
  console.log('SUCCESS');
}
main().catch(e => console.log('ERROR:', e.message, e.stack?.split('\n').slice(0,3).join('\n')));
