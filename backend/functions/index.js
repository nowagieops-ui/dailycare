const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const crypto = require('node:crypto');
const { buildCalendar } = require('./ics');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { daysLeft, shouldRemind, reminderText } = require('./expiry');

initializeApp();
setGlobalOptions({ maxInstances: 5 });
const db = getFirestore();
const { sendPush, adminUids } = require('./push');

// TODO(owner): set to the organisation's local timezone before deploying.
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
