const EARTH_RADIUS_KM = 6371;

export function distanceKm(from, to) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestUtility(location, utilities) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const ranked = utilities
    .filter((utility) => Number.isFinite(utility.latitude) && Number.isFinite(utility.longitude))
    .map((utility) => ({ ...utility, distanceKm: distanceKm(location, utility) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return ranked[0] || null;
}
