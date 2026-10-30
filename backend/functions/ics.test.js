const test = require('node:test');
const assert = require('node:assert');
const { buildCalendar, fold, esc } = require('./ics');

test('feed has an event per shift, UTC times, and no client details', () => {
  const ics = buildCalendar(
    [{ id: 'abc', start: new Date('2026-11-02T14:00:00Z'), end: new Date('2026-11-02T22:00:00Z') }],
    new Date('2026-10-30T00:00:00Z'),
  );
  assert.match(ics, /DTSTART:20261102T140000Z/);
  assert.match(ics, /DTEND:20261102T220000Z/);
  assert.match(ics, /UID:abc@dailycare/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(!/client|address/i.test(ics.replace('Open the Daily Care Support app for details.', '')));
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
});
test('escaping and folding', () => {
  assert.strictEqual(esc('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
  const long = 'X-TEST:' + 'é'.repeat(80);
  const folded = fold(long).split('\r\n');
  assert.ok(folded.length > 1 && folded.every((l) => Buffer.byteLength(l) <= 75));
  assert.strictEqual(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), long);
});
test('empty feed is still valid', () => {
  assert.match(buildCalendar([]), /BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/);
});
