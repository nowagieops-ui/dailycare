const crypto = require('node:crypto');

// No 0/O/1/I so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^DCS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const DAYS = 7;

function newCode() {
  const pick = () => Array.from(crypto.randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `DCS-${pick()}-${pick()}`;
}

/** Returns an error string, or null if the sign-up details are acceptable. */
function validateSignup({ code, name, email, password }) {
  if (typeof code !== 'string' || !CODE_RE.test(code.trim().toUpperCase())) return 'Invalid or expired code.';
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) return 'Enter your full name.';
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return 'Enter a valid email.';
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) return 'Password must be at least 10 characters.';
  return null;
}

module.exports = { newCode, validateSignup, DAYS, CODE_RE };
