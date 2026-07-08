const fs = require('fs');
const content = fs.readFileSync('node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
const lines = content.split('\n');
// Read getDocument function at line 3358
for (let i = 3357; i < 3530 && i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
