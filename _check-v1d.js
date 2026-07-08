const fs = require('fs');
const content = fs.readFileSync('node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('disableWorker') || l.includes('isWorkerDisabled') || l.includes('fakeWorker')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 150));
  }
});
