const fs = require('fs');
const content = fs.readFileSync('node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
// Search for sendWithPromise in the v1 code
const lines = content.split('\n');
let found = false;
lines.forEach((l, i) => {
  if (l.includes('sendWithPromise')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 150));
    found = true;
  }
});
if (!found) console.log('sendWithPromise NOT FOUND in pdfjs v1');
