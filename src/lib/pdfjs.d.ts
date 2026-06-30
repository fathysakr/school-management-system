declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module '*.worker.mjs' {
  const mod: { WorkerMessageHandler: any };
  export = mod;
}
