const fs = require('fs');
const content = fs.readFileSync('node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
const lines = content.split('\n');

// Find the getDocument function  
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('getDocument') && lines[i].includes('function')) {
    console.log((i+1) + ': ' + lines[i].substring(0, 200));
    // Print next 30 lines
    for (let j = i+1; j < Math.min(i+30, lines.length); j++) {
      if (lines[j].includes('disableWorker') || lines[j].includes('Worker') || lines[j].includes('messageHandler')) {
        console.log((j+1) + ': ' + lines[j].substring(0, 200));
      }
    }
    break;
  }
}
