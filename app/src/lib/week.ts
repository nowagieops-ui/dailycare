import type { Shift } from './types';

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Pay weeks run Thursday to Wednesday. */
export const WEEK_START_DAY = 4; // Thursday
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() - WEEK_START_DAY + 7) % 7));
/** First Thursday of any pay period; periods are two weeks. Replace with Compliance DCS's real pay calendar. */
export const PAY_ANCHOR = new Date(2026, 10, 19);
export function payPeriodStart(d: Date): Date {
  const w = startOfWeek(d);
  const weeks = Math.round((w.getTime() - PAY_ANCHOR.getTime()) / (7 * 86400000));
  return addDays(w, weeks % 2 === 0 ? 0 : -7);
}
export const OVERTIME_AFTER_HOURS = 40;

/** Scheduled hours for shifts starting in [from, to). */
export function hoursScheduled(shifts: Shift[], from: Date, to: Date): number {
  let ms = 0;
  for (const s of shifts) {
    const a = s.start.toMillis();
    if (a >= from.getTime() && a < to.getTime()) ms += s.end.toMillis() - a;
  }
  return Math.round((ms / 3600000) * 10) / 10;
}
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Hours worked on shifts that have a clock-in; an open shift counts up to "now". */
export function hoursWorked(shifts: Shift[], from: Date, to: Date, now = Date.now()): number {
  let ms = 0;
  for (const s of shifts) {
    if (!s.clockInAt) continue;
    const a = s.clockInAt.toMillis();
    if (a < from.getTime() || a >= to.getTime()) continue;
    ms += (s.clockOutAt ? s.clockOutAt.toMillis() : Math.min(now, s.end.toMillis())) - a;
  }
  return Math.round((ms / 3600000) * 10) / 10;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
