const fs = require('fs');
const content = fs.readFileSync('node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('getDefaultSetting') || l.includes('setDefaultSetting') || l.includes('globalSettings')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 150));
  }
});
