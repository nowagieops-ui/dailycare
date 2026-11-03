// Turns a PDF template + a staff member's answers into a finished PDF.
// Two kinds of PDF are supported:
//  - fillable (AcroForm): fields are found automatically and filled by name
//  - flat (scan / print-to-PDF): each field is a box the admin placed on the page; text is drawn into it
const { PDFDocument, StandardFonts, rgb, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList, PDFSignature } = require('pdf-lib');

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_VALUE_CHARS = 5000;

/** Standard PDF fonts only encode Latin-1ish text; swap anything else so one odd character can't fail a submission. */
const safe = (v) => String(v ?? '').replace(/[\r\t]/g, ' ').replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?').slice(0, MAX_VALUE_CHARS);

function kindOf(field) {
  if (field instanceof PDFTextField) return field.isMultiline() ? 'multiline' : 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup) return 'select';
  if (field instanceof PDFSignature) return 'signature';
  return null; // push buttons etc. are not answerable
}

/** Read what a PDF contains: page sizes and any fillable fields. */
async function detectFields(bytes) {
  if (bytes.length > MAX_PDF_BYTES) throw new Error('PDF too large');
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  const pages = pdf.getPages().map((p) => ({ width: p.getWidth(), height: p.getHeight() }));
  const fields = [];
  for (const f of pdf.getForm().getFields()) {
    const type = kindOf(f);
    if (!type) continue;
    const options = f instanceof PDFDropdown || f instanceof PDFOptionList || f instanceof PDFRadioGroup ? f.getOptions() : undefined;
    fields.push({ name: f.getName(), type, ...(options ? { options } : {}) });
  }
  return { pages, fields, fillable: fields.length > 0 };
}

const pngFromDataUrl = (u) => {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(u || '');
  return m && m[1].length < 400000 ? Buffer.from(m[1], 'base64') : null;
};

/** Greedy word wrap using real font metrics. */
function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) <= maxWidth || !line) line = t; else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * template.fields[]: { key, type, target: {kind:'acro', name} | {kind:'box', page, x, y, w, h, fontSize?} }
 * values: { [key]: string | boolean | { typed, drawn? } }  (box coordinates are in PDF points, origin bottom-left)
 * ctx: { signedBy, signedAt (string), submissionId }
 */
async function fillPdf(bytes, template, values, ctx = {}) {
  if (bytes.length > MAX_PDF_BYTES) throw new Error('PDF too large');
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const script = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const pages = pdf.getPages();

  for (const f of template.fields) {
    const v = values[f.key];
    const t = f.target;
    if (!t || v === undefined || v === '' || v === null) continue;

    if (t.kind === 'acro') {
      let field;
      try { field = form.getField(t.name); } catch { continue; }
      if (field instanceof PDFTextField) field.setText(safe(typeof v === 'object' ? v.typed : v));
      else if (field instanceof PDFCheckBox) { if (v === true || v === 'true') field.check(); else field.uncheck(); }
      else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList) {
        const opts = field.getOptions();
        const pick = opts.includes(String(v)) ? String(v) : null; // only values the PDF itself offers
        if (pick) { if (field instanceof PDFOptionList) field.select(pick); else field.select(pick); }
      }
      continue;
    }

    const page = pages[t.page];
    if (!page) continue;
    const size = t.fontSize || 10;
    if (f.type === 'checkbox') {
      if (v === true || v === 'true') page.drawText('X', { x: t.x + 1, y: t.y + 1, size: Math.min(t.h, t.w) - 2, font, color: rgb(0, 0, 0) });
    } else if (f.type === 'signature') {
      const png = typeof v === 'object' && v.drawn ? pngFromDataUrl(v.drawn) : null;
      if (png) {
        const img = await pdf.embedPng(png);
        const s = Math.min(t.w / img.width, t.h / img.height);
        page.drawImage(img, { x: t.x, y: t.y, width: img.width * s, height: img.height * s });
      } else {
        const name = safe(typeof v === 'object' ? v.typed : v);
        page.drawText(name, { x: t.x + 2, y: t.y + Math.max(2, (t.h - 14) / 2), size: Math.min(14, t.h - 2), font: script, color: rgb(0.1, 0.1, 0.4), maxWidth: t.w });
      }
    } else {
      const text = safe(typeof v === 'object' ? v.typed : v);
      const lines = f.type === 'multiline' ? wrap(text, font, size, t.w) : [text];
      const lead = size * 1.2;
      lines.forEach((line, i) => {
        const y = t.y + t.h - size - i * lead;
        if (y < t.y - 1) return; // never draw outside the box
        page.drawText(line, { x: t.x + 2, y, size, font, color: rgb(0, 0, 0), maxWidth: f.type === 'multiline' ? undefined : t.w });
      });
    }
  }

  form.flatten();
  pdf.setTitle(safe(template.title || 'Completed form'));
  pdf.setSubject(`Completed in the Daily Care Support app by ${safe(ctx.signedBy || 'staff')} on ${safe(ctx.signedAt || '')}`);
  pdf.setKeywords([safe(ctx.submissionId || '')]);
  pdf.setProducer('Daily Care Support');
  return pdf.save();
}

module.exports = { detectFields, fillPdf, safe, MAX_PDF_BYTES };
