import { Platform } from 'react-native';

// Google Places API (New) over plain HTTPS: no Google script is loaded into the app.
// The key is public by design, so it must be locked down in Google Cloud (HTTP referrers for the website,
// the app's bundle id / package name for the phone apps, and only the Places API enabled).
export const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';
export const placesEnabled = MAPS_KEY.length > 0;

const BASE = 'https://places.googleapis.com/v1';
const APP_ID = 'com.dailycaresupport.app';

const headers = (mask: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': MAPS_KEY,
  'X-Goog-FieldMask': mask,
  // On phones there is no website address, so Google checks the app identity instead.
  ...(Platform.OS === 'android' ? { 'X-Android-Package': APP_ID } : {}),
  ...(Platform.OS === 'ios' ? { 'X-Ios-Bundle-Identifier': APP_ID } : {}),
});

export interface Suggestion { placeId: string; text: string }
export interface PickedPlace { address: string; lat: number; lng: number }

export const newSessionToken = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');

/** Only the text the person is typing is sent: never names or other record details. */
export async function suggest(input: string, sessionToken: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: 'POST', signal, headers: headers('suggestions.placePrediction.placeId,suggestions.placePrediction.text.text'),
    body: JSON.stringify({ input, sessionToken, includedRegionCodes: ['us'], includedPrimaryTypes: ['street_address', 'subpremise', 'premise'] }),
  });
  if (!res.ok) throw new Error(`places ${res.status}`);
  const json = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
  return (json.suggestions ?? []).flatMap((x) => (x.placePrediction ? [{ placeId: x.placePrediction.placeId, text: x.placePrediction.text.text }] : []));
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<PickedPlace> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`, { headers: headers('formattedAddress,location') });
  if (!res.ok) throw new Error(`places ${res.status}`);
  const j = (await res.json()) as { formattedAddress?: string; location?: { latitude: number; longitude: number } };
  if (!j.location || typeof j.location.latitude !== 'number') throw new Error('no location');
  return { address: j.formattedAddress ?? '', lat: j.location.latitude, lng: j.location.longitude };
}
