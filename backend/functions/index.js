const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
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
