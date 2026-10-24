const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'export');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html'));

let count = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  let html = fs.readFileSync(p, 'utf8');
  if (html.includes('nav.js')) continue;
  html = html.replace('</body>', '<script src="nav.js"></script>\n</body>');
  fs.writeFileSync(p, html, 'utf8');
  count++;
}
console.log('Injected nav.js into', count, 'files.');
