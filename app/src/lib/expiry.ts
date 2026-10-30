const DAY = 86400000;

export type Stage = 'expired' | 'week' | 'month' | 'two_months' | 'three_months' | 'ok';

export const daysLeft = (expiresMs: number, now = Date.now()) => Math.ceil((expiresMs - now) / DAY);

export function stageOf(days: number): Stage {
  if (days < 0) return 'expired';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  if (days <= 60) return 'two_months';
  if (days <= 90) return 'three_months';
  return 'ok';
}

/**
 * Should a reminder go out today? (Run once a day by the scheduled function.)
 *  - milestones: 90, 60, 30 and 7 days before expiry
 *  - then every day through the last week, including the expiry day
 *  - once expired, a weekly reminder until it is renewed
 */
export function shouldRemind(days: number): boolean {
  if (days === 90 || days === 60 || days === 30) return true;
  if (days >= 0 && days <= 7) return true;
  return days < 0 && -days % 7 === 0;
}

export const stageLabel: Record<Stage, string> = {
  expired: 'Expired', week: 'Expires within a week', month: 'Expires within a month',
  two_months: 'Expires within 2 months', three_months: 'Expires within 3 months', ok: 'Valid',
};
