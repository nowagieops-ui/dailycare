export type Pattern = 'once' | 'weekly' | 'weekdays' | 'alternating';
/** For 'alternating': staff works week 1,3,5… ('odd') or week 2,4,6… ('even'), counted from the start date's week. */
export type WeekCycle = 'odd' | 'even';

export interface RecurrenceInput {
  startDate: string; // YYYY-MM-DD, interpreted in local time
  pattern: Pattern;
  weeks: number; // how many weeks to generate (ignored for 'once')
  daysOfWeek?: number[]; // 0=Sun..6=Sat, used by 'weekly' and 'alternating'
  cycle?: WeekCycle; // used by 'alternating'
}

export function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // reject overflow like 2026-02-31
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Week 1 begins on the Sunday of the week containing startDate. */
export function generateDates(input: RecurrenceInput): Date[] {
  const start = parseLocalDate(input.startDate);
  if (!start) return [];
  if (input.pattern === 'once') return [start];

  const weeks = Math.min(Math.max(input.weeks, 1), 52);
  const week1Sunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay());
  const out: Date[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekNumber = w + 1;
    if (input.pattern === 'alternating') {
      const odd = weekNumber % 2 === 1;
      if ((input.cycle ?? 'odd') === 'odd' ? !odd : odd) continue;
    }
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(week1Sunday.getFullYear(), week1Sunday.getMonth(), week1Sunday.getDate() + w * 7 + dow);
      if (d < start) continue;
      const allowed =
        input.pattern === 'weekdays' ? dow >= 1 && dow <= 5 : (input.daysOfWeek ?? [start.getDay()]).includes(dow);
      if (allowed) out.push(d);
    }
  }
  return out;
}

/** Combine a local date with "HH:MM"; an end earlier than the start rolls into the next day (overnight). */
export function atTime(date: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(m[1]), Number(m[2]));
}

export function shiftWindow(date: Date, startHHMM: string, endHHMM: string): { start: Date; end: Date } | null {
  const start = atTime(date, startHHMM);
  let end = atTime(date, endHHMM);
  if (!start || !end) return null;
  if (end <= start) end = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, end.getHours(), end.getMinutes());
  return { start, end };
}
