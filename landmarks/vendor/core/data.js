
export function latLonToXZ(origin, lat, lon) {
  const d = Math.PI / 180, R = 6378137;
  return [(lon - origin.lon) * d * R * Math.cos(origin.lat * d), -(lat - origin.lat) * d * R];
}
