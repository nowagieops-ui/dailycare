const fs = require('fs');
const path = require('path');

const SRC_DIR = 'C:/PROGRA~1/KMSpico/temp/claude/c--Users-HP-250-G8-dailycare/bafa7c9f-2358-4722-a3af-5f21078f3133/scratchpad/artifact-files/b5d78009-60ed-47bf-a00d-20f5b3ee2f56/project';
const OUT_DIR = path.join(__dirname, 'export');

// Files handled by hand (interactive) — skip in the generic pass.
const SKIP = new Set(['DSP-ClockIn.dc.html', 'DSP-Tasks.dc.html', 'Admin-Reports.dc.html']);

const CSS_BLOB = '/_blob/6af08903e712a8f47c07c63f17550586';
const LOGO_BLOB = '/_blob/5e047de09f87e3c47d64557eaa6f4f5d';

function convert(raw) {
  // Title
  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? titleMatch[1] : 'Daily Care Support';

  // Helmet inner content (fonts + <style>)
  const helmetMatch = raw.match(/<helmet>([\s\S]*?)<\/helmet>/);
  let helmetInner = helmetMatch ? helmetMatch[1].trim() : '';

  // Body content: between <x-dc> and </x-dc>
  const bodyMatch = raw.match(/<x-dc>\s*<helmet>[\s\S]*?<\/helmet>([\s\S]*?)<\/x-dc>/);
  let bodyInner = bodyMatch ? bodyMatch[1].trim() : '';

  // Strip blob refs
  bodyInner = bodyInner.split(LOGO_BLOB).join('assets/dsc-logo.png');
  helmetInner = helmetInner.split(LOGO_BLOB).join('assets/dsc-logo.png');

  // Fix internal links: Main.dc.html -> index.html, X.dc.html -> X.html
  const fixLinks = (s) =>
    s.replace(/Main\.dc\.html/g, 'index.html').replace(/([A-Za-z0-9_-]+)\.dc\.html/g, '$1.html');
  bodyInner = fixLinks(bodyInner);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — Daily Care Support</title>
<link rel="stylesheet" href="shared.css">
${helmetInner}
</head>
<body>
${bodyInner}
</body>
</html>
`;
  return html;
}

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.dc.html'));
let count = 0;
for (const f of files) {
  if (SKIP.has(f)) continue;
  const raw = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  const html = convert(raw);
  const outName = f === 'Main.dc.html' ? 'index.html' : f.replace(/\.dc\.html$/, '.html');
  fs.writeFileSync(path.join(OUT_DIR, outName), html, 'utf8');
  count++;
}
console.log('Converted', count, 'static files.');
