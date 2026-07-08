const fs = require('fs');
const content = fs.readFileSync('node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
const lines = content.split('\n');
for (let i = 4065; i < 4180 && i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
