import type { Building, DiagramBuilding, SolarPosition, SunlightResult } from '../types';
import { bearingDeg, distanceMeters, angularDiff } from './geo';

const SEARCH_RADIUS_M = 250;
const BEARING_TOLERANCE_DEG = 10;

export function checkSunlight(
  terraceLat: number,
  terraceLon: number,
  solar: SolarPosition,
  buildings: Building[],
): SunlightResult {
  if (solar.altitude <= 0) {
    return { sunny: false, sunAltitude: solar.altitude, sunAzimuth: solar.azimuth, blockingBuildingId: null, reason: 'below_horizon' };
  }

  for (const building of buildings) {
    // Find the closest vertex to the terrace
    let minDist = Infinity;
    let inBeam = false;

    for (const [lon, lat] of building.polygon) {
      const dist = distanceMeters(terraceLat, terraceLon, lat, lon);
      if (dist < minDist) minDist = dist;

      const bearing = bearingDeg(terraceLat, terraceLon, lat, lon);
      if (angularDiff(bearing, solar.azimuth) < BEARING_TOLERANCE_DEG) inBeam = true;
    }

    if (!inBeam || minDist < 1 || minDist > SEARCH_RADIUS_M) continue;

    const apparentAngleDeg = Math.atan(building.height / minDist) * (180 / Math.PI);

    if (apparentAngleDeg > solar.altitude) {
      return { sunny: false, sunAltitude: solar.altitude, sunAzimuth: solar.azimuth, blockingBuildingId: building.id, reason: 'blocked' };
    }
  }

  return { sunny: true, sunAltitude: solar.altitude, sunAzimuth: solar.azimuth, blockingBuildingId: null, reason: 'sunny' };
}

// Returns building silhouette data for the SunDiagram component.
export function getObstructionData(
  terraceLat: number,
  terraceLon: number,
  solar: SolarPosition,
  buildings: Building[],
): DiagramBuilding[] {
  const DIAGRAM_RANGE_DEG = 50;
  const result: DiagramBuilding[] = [];

  for (const building of buildings) {
    let minDist = Infinity;
    const bearings: number[] = [];

    for (const [lon, lat] of building.polygon) {
      const dist = distanceMeters(terraceLat, terraceLon, lat, lon);
      if (dist < minDist) minDist = dist;
      bearings.push(bearingDeg(terraceLat, terraceLon, lat, lon));
    }

    if (minDist < 1 || minDist > SEARCH_RADIUS_M) continue;

    // Average bearing, handling wrap-around via unit vectors
    const sinSum = bearings.reduce((s, b) => s + Math.sin(b * Math.PI / 180), 0);
    const cosSum = bearings.reduce((s, b) => s + Math.cos(b * Math.PI / 180), 0);
    const avgBearing = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360;

    const relBearing = ((avgBearing - solar.azimuth + 180) % 360 + 360) % 360 - 180;
    if (Math.abs(relBearing) > DIAGRAM_RANGE_DEG) continue;

    const apparentAngleDeg = Math.atan(building.height / minDist) * (180 / Math.PI);
    const inBeam = bearings.some(b => angularDiff(b, solar.azimuth) < BEARING_TOLERANCE_DEG);
    const isBlocking = inBeam && solar.altitude > 0 && apparentAngleDeg > solar.altitude;

    result.push({ id: building.id, relBearing, apparentAngleDeg, isBlocking });
  }

  return result;
}
