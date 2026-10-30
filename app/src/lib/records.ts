import type { Shift } from './types';

/**
 * Visit record template. {{placeholders}} are filled from what staff entered during the shift:
 * the checklist, the daily note and the clock times. Admin-editable templates build on this.
 */
export const DEFAULT_TEMPLATE = `DAILY CARE SUPPORT — VISIT RECORD

Client:        {{client}}
Service line:  {{service_line}}
Location:      {{location}}
Staff:         {{staff}}
Date:          {{date}}
Scheduled:     {{scheduled}}
Clocked in:    {{clock_in}}
Clocked out:   {{clock_out}}

TASKS COMPLETED
{{tasks}}

DAILY NOTE
{{note}}
`;

const t = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—');

export function recordFields(s: Shift): Record<string, string> {
  return {
    client: s.clientName,
    service_line: s.serviceLine,
    location: s.address,
    staff: s.staffName ?? '',
    date: new Date(s.start.toMillis()).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    scheduled: `${t(s.start.toMillis())} – ${t(s.end.toMillis())}`,
    clock_in: t(s.clockInAt?.toMillis()),
    clock_out: t(s.clockOutAt?.toMillis()),
    tasks: s.tasks.length ? s.tasks.map((k) => `[${k.done ? 'x' : ' '}] ${k.label}`).join('\n') : '(none)',
    note: s.note.trim() || '(no note)',
  };
}

/** Plain-text fill. Unknown placeholders are left visible so template mistakes are obvious. */
export function renderRecord(s: Shift, template = DEFAULT_TEMPLATE): string {
  const f = recordFields(s);
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in f ? f[k] : m));
}

export const escapeHtml = (x: string) =>
  x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
