const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const crypto = require('node:crypto');
const { buildCalendar } = require('./ics');
const { getAuth } = require('firebase-admin/auth');
const { newCode, validateSignup, DAYS } = require('./onboarding');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { detectFields, fillPdf } = require('./pdfforms');
const { daysLeft, shouldRemind, reminderText } = require('./expiry');

initializeApp();
setGlobalOptions({ maxInstances: 5 });
const db = getFirestore();
const { sendPush, adminUids } = require('./push');

// Agency is in Pikesville, MD (Eastern time).
const TIMEZONE = 'America/New_York';

/** A staff member left their client's location during a shift -> notify every admin. */
exports.onLeftSite = onDocumentCreated('alerts/{id}', async (event) => {
  const a = event.data?.data();
  if (!a || a.type !== 'left_site') return;
  await sendPush(db, await adminUids(db), 'Location alert', 'A team member left their client\'s location during a shift. Open the app to review.');
});

/** Daily 8am: remind staff (and summarise for admins) about expiring trainings/certifications/documents. */
exports.expiryReminders = onSchedule({ schedule: '0 8 * * *', timeZone: TIMEZONE }, async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const snap = await db.collection('credentials').get();
  let adminCount = 0;

  for (const doc of snap.docs) {
    const c = doc.data();
    const days = daysLeft(c.expiresOn.toMillis());
    if (!shouldRemind(days)) continue;
    // create() fails if it already exists, so a retried run never double-sends.
    try { await db.collection('reminderLog').doc(`${doc.id}_${today}`).create({ at: Timestamp.now() }); }
    catch { continue; }
    await sendPush(db, [c.staffId], 'Reminder', reminderText(c.title, days));
    adminCount++;
  }
  if (adminCount > 0) {
    await sendPush(db, await adminUids(db), 'Expiry reminders',
      `${adminCount} training${adminCount === 1 ? '' : 's'}/certification${adminCount === 1 ? '' : 's'} need attention. Open Trainings & certifications.`);
  }
});

/**
 * Signed-in staff ask for a private calendar link. The secret token is made here on the server
 * (never in the app). Calling again replaces the token, which switches the old link off.
 */
exports.createCalendarFeed = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = await db.collection('users').doc(req.auth.uid).get();
  if (!user.exists || user.data().active !== true) throw new HttpsError('permission-denied', 'Account not active.');
  const token = crypto.randomBytes(32).toString('hex');
  await db.collection('calendarFeeds').doc(req.auth.uid).set({ token, createdAt: Timestamp.now() });
  return { token };
});

/** Public calendar feed, protected only by the secret token in the URL. */
exports.calendar = onRequest({ invoker: 'public', cors: false }, async (req, res) => {
  const token = String(req.query.token ?? '');
  const notFound = () => res.status(404).type('text/plain').send('Not found');
  if (!/^[a-f0-9]{64}$/.test(token)) return notFound();

  const feed = await db.collection('calendarFeeds').where('token', '==', token).limit(1).get();
  if (feed.empty) return notFound();
  const uid = feed.docs[0].id;
  const user = await db.collection('users').doc(uid).get();
  if (!user.exists || user.data().active !== true) return notFound(); // deactivated staff lose the feed

  const from = Timestamp.fromMillis(Date.now() - 30 * 86400000);
  const to = Timestamp.fromMillis(Date.now() + 180 * 86400000);
  const snap = await db.collection('shifts')
    .where('staffId', '==', uid).where('start', '>=', from).where('start', '<=', to)
    .orderBy('start').get();
  const shifts = snap.docs.map((d) => ({ id: d.id, start: d.data().start.toDate(), end: d.data().end.toDate() }));

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Cache-Control', 'private, no-store');
  res.send(buildCalendar(shifts));
});

const ASSIGNABLE = ['staff', 'family_staff'];

/** Admin creates a single-use onboarding code (valid 7 days) for a new staff member. */
exports.createOnboardingCode = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const me = await db.collection('users').doc(req.auth.uid).get();
  const role = me.exists && me.data().active === true ? me.data().role : null;
  if (role !== 'admin' && role !== 'super_admin') throw new HttpsError('permission-denied', 'Admins only.');
  const asRole = req.data?.role;
  if (!ASSIGNABLE.includes(asRole)) throw new HttpsError('invalid-argument', 'Choose staff or family staff.');
  const code = newCode();
  const expiresAt = Timestamp.fromMillis(Date.now() + DAYS * 86400000);
  await db.collection('onboardingCodes').doc(code).create({ role: asRole, createdBy: req.auth.uid, createdAt: Timestamp.now(), expiresAt, used: false });
  return { code, expiresAt: expiresAt.toMillis() };
});

/**
 * New staff create their own account with a code. Runs on the server so the code is checked and
 * burned atomically; every failure returns the same message so codes can't be probed.
 */
exports.redeemOnboardingCode = onCall(async (req) => {
  const d = req.data ?? {};
  const bad = validateSignup(d);
  if (bad) throw new HttpsError('invalid-argument', bad);
  const code = d.code.trim().toUpperCase();
  const ref = db.collection('onboardingCodes').doc(code);
  const fail = () => new HttpsError('not-found', 'Invalid or expired code.');

  const role = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const c = snap.data();
    if (!snap.exists || c.used || c.expiresAt.toMillis() < Date.now()) throw fail();
    tx.update(ref, { used: true, usedAt: Timestamp.now() });
    return c.role;
  });

  try {
    const user = await getAuth().createUser({ email: d.email.trim(), password: d.password, displayName: d.name.trim() });
    await db.collection('users').doc(user.uid).set({ name: d.name.trim(), email: d.email.trim().toLowerCase(), phone: '', role, active: true });
    await ref.update({ usedBy: user.uid });
    return { ok: true };
  } catch (e) {
    await ref.update({ used: false, usedAt: null }); // account creation failed (e.g. email taken): give the code back
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'An account with that email already exists.');
    throw new HttpsError('internal', 'Could not create the account.');
  }
});

// ---- Audit log -------------------------------------------------------------
// Firestore triggers cannot see who made a change, so each entry records WHAT happened and to whom,
// not an authenticated actor. Only server code writes this collection (rules deny clients).
const audit = (event, text) =>
  db.collection('auditLog').add({ at: Timestamp.now(), event, text });

const who = (d) => d?.staffName || d?.name || 'a staff member';

exports.auditShifts = onDocumentWritten('shifts/{id}', async (e) => {
  const a = e.data?.before?.data(), b = e.data?.after?.data();
  if (!a && b) return audit('shift.created', `Shift created for ${b.staffId ? who(b) : 'an open slot'} (${b.serviceLine})`);
  if (a && !b) return audit('shift.deleted', `Shift deleted for ${a.staffId ? who(a) : 'an open slot'} (${a.serviceLine})`);
  if (!a || !b) return;
  if (!a.clockInAt && b.clockInAt) return audit('shift.clock_in', `${who(b)} clocked in (${b.serviceLine})`);
  if (!a.clockOutAt && b.clockOutAt) return audit('shift.clock_out', `${who(b)} clocked out (${b.serviceLine})`);
  if (!a.approved && b.approved) return audit('shift.approved', `Timesheet approved for ${who(b)}`);
  if (!a.staffId && b.staffId) return audit('shift.assigned', `Open shift assigned to ${who(b)}`);
});

exports.auditUsers = onDocumentWritten('users/{id}', async (e) => {
  const a = e.data?.before?.data(), b = e.data?.after?.data();
  if (!a && b) return audit('user.created', `Account created for ${b.name} (${b.role})`);
  if (a && b && a.active !== b.active) return audit('user.active', `${b.name} ${b.active ? 'reactivated' : 'deactivated'}`);
  if (a && b && a.role !== b.role) return audit('user.role', `${b.name} role changed to ${b.role}`);
});

exports.auditClients = onDocumentWritten('clients/{id}', async (e) => {
  const a = e.data?.before?.data(), b = e.data?.after?.data();
  if (!a && b) return audit('client.created', 'A client record was created');
  if (a && !b) return audit('client.deleted', 'A client record was deleted');
});

exports.auditMissed = onDocumentWritten('missedClockIns/{id}', async (e) => {
  const a = e.data?.before?.data(), b = e.data?.after?.data();
  if (!a && b) return audit('missed.reported', `${who(b)} reported a missed clock-in`);
  if (a && b && a.status !== b.status) return audit('missed.' + b.status, `Missed clock-in for ${who(b)} ${b.status}`);
});

exports.auditCredentials = onDocumentWritten('credentials/{id}', async (e) => {
  const a = e.data?.before?.data(), b = e.data?.after?.data();
  if (!a && b) return audit('credential.added', `${b.title} added for ${b.staffName}`);
  if (a && !b) return audit('credential.removed', `${a.title} removed for ${a.staffName}`);
});

/** New chat message -> push the other members. The text carries no message content (no PHI). */
exports.onChatMessage = onDocumentCreated('chats/{id}/messages/{mid}', async (e) => {
  const m = e.data?.data();
  if (!m) return;
  const chat = (await db.collection('chats').doc(e.params.id).get()).data();
  const others = (chat?.members || []).filter((u) => u !== m.senderId);
  if (others.length) await sendPush(db, others, 'New message', 'You have a new team chat message.');
});

/**
 * Permanently deletes an account (super admins only). Past shifts and signatures are kept with the person's name.
 */
exports.deleteAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const me = await db.collection('users').doc(req.auth.uid).get();
  if (!me.exists || me.data().active !== true || me.data().role !== 'super_admin') throw new HttpsError('permission-denied', 'Super admins only.');
  const uid = req.data?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Missing account.');
  if (uid === req.auth.uid) throw new HttpsError('failed-precondition', 'You cannot delete your own account.');
  const target = await db.collection('users').doc(uid).get();
  if (!target.exists) throw new HttpsError('not-found', 'Account not found.');
  // History stays: worked shifts and signatures keep the person's name. Only upcoming, unworked shifts are opened up.
  const theirShifts = await db.collection('shifts').where('staffId', '==', uid).get();
  for (const sh of theirShifts.docs) {
    if (sh.data().status === 'scheduled') await sh.ref.update({ staffId: '', staffName: '' });
  }
  try { await getAuth().deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Could not delete the login.'); }
  await db.collection('users').doc(uid).delete();
  return { ok: true };
});

/** Keep the names-only directory (used to start chats) in step with accounts. */
exports.syncDirectory = onDocumentWritten('users/{id}', async (e) => {
  const b = e.data?.after?.data();
  const ref = db.collection('directory').doc(e.params.id);
  if (!b) return ref.delete();
  return ref.set({ name: b.name, role: b.role, active: b.active === true });
});

// ---- PDF forms -------------------------------------------------------------
const OFFICE = ['admin', 'super_admin', 'case_manager'];
async function officeUser(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const me = await db.collection('users').doc(req.auth.uid).get();
  if (!me.exists || me.data().active !== true || !OFFICE.includes(me.data().role)) throw new HttpsError('permission-denied', 'Office staff only.');
  return me.data();
}

/** Office uploads a PDF template to Storage, then asks what is in it (fillable fields, page sizes). */
exports.inspectTemplate = onCall({ memory: '512MiB' }, async (req) => {
  await officeUser(req);
  const path = String(req.data?.path || '');
  if (!/^formTemplates\/[A-Za-z0-9]{10,40}\/template\.pdf$/.test(path)) throw new HttpsError('invalid-argument', 'Bad file path.');
  const [bytes] = await getStorage().bucket().file(path).download();
  try { return await detectFields(bytes); }
  catch { throw new HttpsError('invalid-argument', 'This PDF could not be read. It may be password-protected or damaged.'); }
});

const today = (d = new Date()) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: TIMEZONE });

/** A staff member submitted a form -> build the finished PDF. Trusted fields come from the server, not the app. */
exports.renderSubmission = onDocumentCreated({ document: 'formSubmissions/{id}', memory: '512MiB' }, async (e) => {
  const ref = e.data.ref;
  const sub = e.data.data();
  const fail = (why) => ref.update({ status: 'failed', error: why });
  try {
    const [tplSnap, userSnap, shiftSnap] = await Promise.all([
      db.collection('formTemplates').doc(sub.templateId).get(),
      db.collection('users').doc(sub.staffId).get(),
      db.collection('shifts').doc(sub.shiftId).get(),
    ]);
    if (!tplSnap.exists || !shiftSnap.exists || !userSnap.exists) return fail('Form, visit or user not found.');
    const tpl = tplSnap.data(), shift = shiftSnap.data(), user = userSnap.data();
    if (shift.staffId !== sub.staffId) return fail('Not your visit.');

    const trusted = {
      staff_name: user.name, client_name: shift.clientName, service_line: shift.serviceLine,
      visit_date: today(shift.start.toDate()), today: today(),
    };
    const values = {};
    const missing = [];
    for (const f of tpl.fields) {
      let v = f.prefill && trusted[f.prefill] !== undefined ? trusted[f.prefill] : sub.values?.[f.key];
      if (f.type === 'checkbox') v = v === true;
      if (f.type === 'signature') v = typeof v === 'object' && v ? { typed: String(v.typed || ''), drawn: typeof v.drawn === 'string' ? v.drawn : undefined } : { typed: '' };
      if (f.type === 'signature' && v.typed.trim().length < 2) v = '';
      if (f.type === 'select' && Array.isArray(f.options) && !f.options.includes(String(v))) v = '';
      if (f.required && (v === '' || v === undefined || v === null || (f.type === 'checkbox' && v !== true))) missing.push(f.label || f.key);
      values[f.key] = v;
    }
    if (missing.length) return fail(`Missing: ${missing.slice(0, 5).join(', ')}`);

    const [template] = await getStorage().bucket().file(tpl.pdfPath).download();
    const out = await fillPdf(template, tpl, values, { signedBy: user.name, signedAt: today(), submissionId: ref.id });
    const outPath = `submissions/${ref.id}.pdf`;
    await getStorage().bucket().file(outPath).save(Buffer.from(out), { contentType: 'application/pdf', resumable: false });
    await ref.update({ status: 'ready', pdfPath: outPath, renderedAt: Timestamp.now(), values });
  } catch (err) {
    console.error('renderSubmission failed', e.params.id, err?.message);
    await fail('Could not build the PDF.');
  }
});
