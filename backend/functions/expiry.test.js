const test = require('node:test');
const assert = require('node:assert');
const { shouldRemind, daysLeft, reminderText } = require('./expiry');

test('reminder schedule', () => {
  const fire = [];
  for (let d = 100; d >= -15; d--) if (shouldRemind(d)) fire.push(d);
  assert.deepStrictEqual(fire, [90, 60, 30, 7, 6, 5, 4, 3, 2, 1, 0, -7, -14]);
});
test('daysLeft rounds up so the expiry day counts as 0', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  assert.strictEqual(daysLeft(Date.parse('2026-11-01T20:00:00Z'), now), 1);
  assert.strictEqual(daysLeft(now, now), 0);
});
test('text', () => {
  assert.match(reminderText('CPR', 1), /1 day\./);
  assert.match(reminderText('CPR', -7), /expired 7 days ago/);
});
