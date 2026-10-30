// Keep in sync with app/src/lib/expiry.js logic (app/src/lib/expiry.ts).
const DAY = 86400000;

const daysLeft = (expiresMs, now = Date.now()) => Math.ceil((expiresMs - now) / DAY);

/** Reminder days: 90, 60, 30, 7, then daily to expiry, then weekly once lapsed. */
function shouldRemind(days) {
  if (days === 90 || days === 60 || days === 30) return true;
  if (days >= 0 && days <= 7) return true;
  return days < 0 && -days % 7 === 0;
}

function reminderText(title, days) {
  if (days < 0) return `${title} expired ${-days} day${-days === 1 ? '' : 's'} ago. Please renew it.`;
  if (days === 0) return `${title} expires today.`;
  return `${title} expires in ${days} day${days === 1 ? '' : 's'}.`;
}

module.exports = { daysLeft, shouldRemind, reminderText };
