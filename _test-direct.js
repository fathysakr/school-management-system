async function main() {
  // Import the worker module directly
  const workerMod = await import('./node_modules/pdfjs-dist/build/pdf.worker.mjs');
  console.log('WorkerModule keys:', Object.keys(workerMod));
  
  // WorkerMessageHandler is what processes PDFs
  const WMH = workerMod.WorkerMessageHandler;
  console.log('Has WorkerMessageHandler:', typeof WMH);
  
  if (WMH && typeof WMH.setup === 'function') {
    console.log('WMH.setup exists');
  }
}
main().catch(e => console.error('FAIL:', e.message));
