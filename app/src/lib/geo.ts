const R = 6371000;
/** Radii are stored in metres but entered and shown in feet. */
export const FT_PER_M = 3.28084;
export const feetToM = (ft: number) => Math.round((ft / FT_PER_M) * 100) / 100;
export const mToFeet = (m: number) => Math.round(m * FT_PER_M);
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres between two lat/lng points. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Clock-in is allowed once the staff member is inside the client's radius.
 * `accuracyM` is added as slack so a noisy GPS fix indoors doesn't lock people out,
 * but it is capped (15 m, so the 25 ft default stays meaningful) so a very poor fix can't be used to clock in from far away.
 */
export function isWithinSite(
  posLat: number,
  posLng: number,
  accuracyM: number | null,
  siteLat: number,
  siteLng: number,
  radiusM: number,
): boolean {
  const slack = Math.min(accuracyM ?? 0, 15);
  return distanceM(posLat, posLng, siteLat, siteLng) <= radiusM + slack;
}
