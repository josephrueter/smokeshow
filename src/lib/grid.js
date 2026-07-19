const KM_PER_DEG_LAT = 110.574;

// Snap a coordinate to a lattice so nearby users generate byte-identical
// API URLs and share the edge cache (see api/aq.js). 0.1° ≈ 11km — well
// under CAMS's ~40km resolution, so the forecast itself doesn't change.
export function snapCoord(value, stepDeg = 0.1) {
  return Number((Math.round(value / stepDeg) * stepDeg).toFixed(4));
}

function kmPerDegLon(latDeg) {
  return 111.32 * Math.cos((latDeg * Math.PI) / 180);
}

// ~9x9 grid at ~25km spacing centered on (centerLat, centerLon) -> ~200km square, 81 points.
export function buildGrid(centerLat, centerLon, { size = 9, spacingKm = 25 } = {}) {
  const half = Math.floor(size / 2);
  const latStep = spacingKm / KM_PER_DEG_LAT;
  const lonStep = spacingKm / kmPerDegLon(centerLat);
  const points = [];
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      points.push({
        i,
        j,
        lat: Number((centerLat + i * latStep).toFixed(4)),
        lon: Number((centerLon + j * lonStep).toFixed(4)),
        isCenter: i === 0 && j === 0,
      });
    }
  }
  return points;
}
