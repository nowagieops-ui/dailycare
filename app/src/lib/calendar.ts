import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const BASE = process.env.EXPO_PUBLIC_CALENDAR_URL ?? '';

/** Asks the server for a fresh private link. Any earlier link stops working. */
export async function createFeedUrl(): Promise<string> {
  const { data } = await httpsCallable<unknown, { token: string }>(functions, 'createCalendarFeed')();
  return `${BASE}?token=${data.token}`;
}

export const toWebcal = (url: string) => url.replace(/^https:/, 'webcal:');
