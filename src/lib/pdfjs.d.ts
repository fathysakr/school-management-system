declare module 'pdfjs-dist/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module '*.worker.mjs' {
  const mod: { WorkerMessageHandler: any };
  export = mod;
}
