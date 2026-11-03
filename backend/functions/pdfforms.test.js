const test = require('node:test');
const assert = require('node:assert');
const { PDFDocument, StandardFonts, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const { detectFields, fillPdf, safe } = require('./pdfforms');

async function fillableSample() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const name = form.createTextField('employee_name'); name.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
  const notes = form.createTextField('notes'); notes.enableMultiline(); notes.addToPage(page, { x: 50, y: 600, width: 300, height: 80 });
  const ok = form.createCheckBox('agrees'); ok.addToPage(page, { x: 50, y: 560, width: 15, height: 15 });
  const dd = form.createDropdown('mood'); dd.addOptions(['Good', 'Fair', 'Poor']); dd.addToPage(page, { x: 50, y: 520, width: 100, height: 20 });
  return pdf.save();
}
async function flatSample() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText('Daily Visit Form', { x: 50, y: 740, size: 18, font: await pdf.embedFont(StandardFonts.Helvetica) });
  return pdf.save();
}
const has = (raw, text) => raw.includes(text) || raw.toUpperCase().includes(Buffer.from(text, 'latin1').toString('hex').toUpperCase());
const textOf = async (bytes) => {
  // flattened text is drawn into the content stream; check it round-trips through load + field-free form
  const pdf = await PDFDocument.load(bytes);
  // Decode every content stream so the assertions can see the text that was drawn.
  let raw = Buffer.from(bytes).toString('latin1');
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) raw += '\n' + Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1');
  }
  return { fields: pdf.getForm().getFields().length, pages: pdf.getPageCount(), subject: pdf.getSubject(), raw };
};

test('detects fillable fields and their types', async () => {
  const d = await detectFields(await fillableSample());
  assert.equal(d.fillable, true);
  const by = Object.fromEntries(d.fields.map((f) => [f.name, f]));
  assert.equal(by.employee_name.type, 'text');
  assert.equal(by.notes.type, 'multiline');
  assert.equal(by.agrees.type, 'checkbox');
  assert.deepEqual(by.mood.options, ['Good', 'Fair', 'Poor']);
});

test('a flat PDF reports pages and no fields', async () => {
  const d = await detectFields(await flatSample());
  assert.equal(d.fillable, false);
  assert.deepEqual(d.pages[0], { width: 612, height: 792 });
});

test('fills a fillable PDF and flattens it', async () => {
  const template = { title: 'Visit', fields: [
    { key: 'n', type: 'text', target: { kind: 'acro', name: 'employee_name' } },
    { key: 'c', type: 'checkbox', target: { kind: 'acro', name: 'agrees' } },
    { key: 'm', type: 'select', target: { kind: 'acro', name: 'mood' } },
    { key: 'x', type: 'text', target: { kind: 'acro', name: 'does_not_exist' } },
  ] };
  const out = await fillPdf(await fillableSample(), template, { n: 'Jordan Myers', c: true, m: 'Fair', x: 'ignored' }, { signedBy: 'Jordan', signedAt: 'Oct 24', submissionId: 'abc' });
  const t = await textOf(out);
  assert.equal(t.fields, 0, 'form is flattened, so the answers are part of the page');
  assert.match(t.subject, /Jordan/);
  assert.ok(has(t.raw, 'Jordan Myers'), 'typed answer is in the page content');
});

test('a select value the PDF does not offer is ignored, not written', async () => {
  const template = { title: 'v', fields: [{ key: 'm', type: 'select', target: { kind: 'acro', name: 'mood' } }] };
  const out = await fillPdf(await fillableSample(), template, { m: 'Hacked' });
  assert.ok(!has((await textOf(out)).raw, 'Hacked'));
});

test('draws text into boxes on a flat PDF, wraps and stays inside the box', async () => {
  const template = { title: 'Flat', fields: [
    { key: 'a', type: 'text', target: { kind: 'box', page: 0, x: 50, y: 650, w: 200, h: 18, fontSize: 10 } },
    { key: 'b', type: 'multiline', target: { kind: 'box', page: 0, x: 50, y: 500, w: 200, h: 40, fontSize: 10 } },
    { key: 'c', type: 'checkbox', target: { kind: 'box', page: 0, x: 50, y: 470, w: 14, h: 14 } },
    { key: 's', type: 'signature', target: { kind: 'box', page: 0, x: 300, y: 650, w: 150, h: 30 } },
  ] };
  const long = 'word '.repeat(200);
  const out = await fillPdf(await flatSample(), template, { a: 'Maria S.', b: long, c: true, s: { typed: 'Jordan Myers' } });
  const t = await textOf(out);
  assert.equal(t.pages, 1);
  assert.ok(has(t.raw, 'Maria S.'), 'single-line text drawn');
  assert.ok(has(t.raw, 'Jordan Myers'), 'typed signature drawn');
  const hexWord = Buffer.from('word', 'latin1').toString('hex').toUpperCase();
  const drawn = (t.raw.toUpperCase().match(new RegExp(hexWord, 'g')) || []).length;
  assert.ok(drawn > 0 && drawn < 40, `multiline text is clipped to its 40pt-high box (drew ${drawn} words, not 200)`);
});

test('unicode and control characters cannot break rendering', async () => {
  assert.equal(safe('Zoë ✓ 日本'), 'Zoë ? ??');
  const template = { title: 'T', fields: [{ key: 'a', type: 'text', target: { kind: 'box', page: 0, x: 50, y: 650, w: 200, h: 18 } }] };
  await fillPdf(await flatSample(), template, { a: 'café ✓ \u0000 日本語' });
});

test('rejects oversized input', async () => {
  await assert.rejects(() => detectFields(Buffer.alloc(26 * 1024 * 1024)), /too large/);
});
