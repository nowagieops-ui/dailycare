// Builds an iCalendar (.ics) feed. Deliberately minimal: no client names or addresses,
// because staff subscribe from personal calendars that are outside the HIPAA BAA.

const pad = (n) => String(n).padStart(2, '0');
const utc = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545: lines are limited to 75 octets; continuation lines start with a single space. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let i = 0;
  let limit = 75;
  while (i < bytes.length) {
    let end = Math.min(i + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a multibyte char
    out.push(bytes.subarray(i, end).toString('utf8'));
    i = end;
    limit = 74;
  }
  return out.join('\r\n ');
}

/** shifts: [{ id, start: Date, end: Date, status }] */
function buildCalendar(shifts, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daily Care Support//Shifts//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:Daily Care shifts', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const s of shifts) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${esc(s.id)}@dailycare`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(s.start)}`,
      `DTEND:${utc(s.end)}`,
      'SUMMARY:Shift - Daily Care Support',
      'DESCRIPTION:Open the Daily Care Support app for details.',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { buildCalendar, fold, esc, utc };
