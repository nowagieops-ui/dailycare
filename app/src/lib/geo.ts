const R = 6371000;
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
 * but it is capped so a very poor fix can't be used to clock in from far away.
 */
export function isWithinSite(
  posLat: number,
  posLng: number,
  accuracyM: number | null,
  siteLat: number,
  siteLng: number,
  radiusM: number,
): boolean {
  const slack = Math.min(accuracyM ?? 0, 50);
  return distanceM(posLat, posLng, siteLat, siteLng) <= radiusM + slack;
}
