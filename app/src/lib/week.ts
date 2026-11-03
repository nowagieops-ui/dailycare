import type { Shift } from './types';

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Week starts Sunday, like the mockup's week strip. */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());
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
