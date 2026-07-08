async function main() {
  const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  console.log('workerSrc:', PDFJS.workerSrc);
  console.log('disableWorker before:', PDFJS.disableWorker);
  
  PDFJS.disableWorker = true;
  console.log('disableWorker after:', PDFJS.disableWorker);
  
  try {
    const worker = new PDFJS.PDFWorker('test');
    console.log('worker created');
    console.log('mh before:', worker.messageHandler !== null);
    await worker.promise;
    console.log('promise resolved');
    console.log('mh after:', worker.messageHandler !== null);
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log('stack:', e.stack.split('\n').slice(0,3).join('\n'));
  }
}
main();
