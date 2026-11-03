const test = require('node:test');
const assert = require('node:assert');
const { newCode, validateSignup, CODE_RE } = require('./onboarding');

test('generated codes match the format and are not repeated', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const c = newCode(); assert.match(c, CODE_RE); seen.add(c); }
  assert.strictEqual(seen.size, 500);
});
test('signup validation', () => {
  const ok = { code: 'DCS-7F3K-9Q2L', name: 'Jordan Myers', email: 'j@x.com', password: 'longenough1' };
  assert.strictEqual(validateSignup(ok), null);
  assert.ok(validateSignup({ ...ok, code: 'nope' }));
  assert.ok(validateSignup({ ...ok, password: 'short' }));
  assert.ok(validateSignup({ ...ok, email: 'bad' }));
  assert.ok(validateSignup({ ...ok, name: ' ' }));
  assert.ok(validateSignup({ ...ok, code: { $ne: 1 } }));
});
