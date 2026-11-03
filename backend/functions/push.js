// Sends via Expo's push service. Message text must never contain client names or health details:
// it is shown on lock screens and passes through a third party.
const CHUNK = 100;

async function tokensFor(db, uids) {
  if (!uids.length) return [];
  const refs = uids.map((u) => db.collection('pushTokens').doc(u));
  const snaps = await db.getAll(...refs);
  return snaps.filter((s) => s.exists && s.data().token).map((s) => ({ uid: s.id, token: s.data().token }));
}

async function sendPush(db, uids, title, body) {
  // In-app inbox entry for everyone, whether or not they have a device token.
  const batch = db.batch();
  for (const uid of new Set(uids)) {
    batch.set(db.collection('notifications').doc(), { userId: uid, title, body, read: false, createdAt: require('firebase-admin/firestore').Timestamp.now() });
  }
  if (uids.length) await batch.commit();
  const targets = await tokensFor(db, [...new Set(uids)]);
  for (let i = 0; i < targets.length; i += CHUNK) {
    const part = targets.slice(i, i + CHUNK);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(part.map((t) => ({ to: t.token, title, body, sound: 'default', priority: 'high' }))),
    });
    if (!res.ok) { console.error('push failed', res.status); continue; }
    const { data } = await res.json();
    // Drop tokens for uninstalled apps so we stop sending to them.
    await Promise.all((data ?? []).map((tk, n) =>
      tk.status === 'error' && tk.details?.error === 'DeviceNotRegistered'
        ? db.collection('pushTokens').doc(part[n].uid).delete()
        : null));
  }
}

async function adminUids(db) {
  const snap = await db.collection('users').where('role', 'in', ['admin', 'super_admin']).where('active', '==', true).get();
  return snap.docs.map((d) => d.id);
}

module.exports = { sendPush, adminUids };
