/** Minimal RFC-4180-style CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export const SHIFT_TEMPLATE_HEADERS = ['staff_email', 'client_name', 'date', 'start', 'end', 'tasks'];

export const SHIFT_TEMPLATE =
  SHIFT_TEMPLATE_HEADERS.join(',') +
  '\njordan@example.com,Maria S.,2026-11-02,09:00,17:00,"Medication reminder; Meal prep; Community outing"\n';

/** Defuse spreadsheet formula injection if a value is ever exported back to CSV. */
export const csvSafe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
