import { describe, it, expect } from 'vitest';
import { checkSunlight } from './obstruction';
import type { Building, SolarPosition } from '../types';

// Test terrace at a round Helsinki coordinate
const LAT = 60.170;
const LON = 24.950;

// Helper: building polygon centred ~50m south of the test terrace, 10m wide × 10m deep
// Coordinates are [lon, lat] (GeoJSON order).
// 50m south ≈ lat - 0.00045°; 5m ≈ 0.000045° lat, ≈ 0.00009° lon at 60°N
function buildingAtBearing(bearingDeg: number, distanceM: number, height: number): Building {
  const dLat = (distanceM / 111_111) * Math.cos((bearingDeg * Math.PI) / 180);
  const dLon = (distanceM / (111_111 * Math.cos((LAT * Math.PI) / 180))) * Math.sin((bearingDeg * Math.PI) / 180);
  const cLat = LAT + dLat;
  const cLon = LON + dLon;
  const r = 0.00005; // tiny polygon radius
  return {
    id: `building-${bearingDeg}`,
    height,
    polygon: [
      [cLon - r, cLat - r],
      [cLon + r, cLat - r],
      [cLon + r, cLat + r],
      [cLon - r, cLat + r],
    ],
  };
}

const sunAtSouth30: SolarPosition = { azimuth: 180, altitude: 30 };
const sunAtSouth60: SolarPosition = { azimuth: 180, altitude: 60 };

describe('checkSunlight', () => {
  it('returns below_horizon when sun altitude ≤ 0', () => {
    const result = checkSunlight(LAT, LON, { azimuth: 180, altitude: -5 }, []);
    expect(result.reason).toBe('below_horizon');
    expect(result.sunny).toBe(false);
  });

  it('returns sunny when there are no buildings', () => {
    const result = checkSunlight(LAT, LON, sunAtSouth30, []);
    expect(result.reason).toBe('sunny');
    expect(result.sunny).toBe(true);
    expect(result.blockingBuildingId).toBeNull();
  });

  it('tall building directly in line with sun blocks the terrace', () => {
    // Building 50m south, height 50m → apparent angle atan(50/50) ≈ 45° > 30° sun altitude
    const result = checkSunlight(LAT, LON, sunAtSouth30, [buildingAtBearing(180, 50, 50)]);
    expect(result.reason).toBe('blocked');
    expect(result.sunny).toBe(false);
    expect(result.blockingBuildingId).toBe('building-180');
  });

  it('short building in sun direction does not block when sun is high', () => {
    // Building 50m south, height 5m → apparent angle atan(5/50) ≈ 5.7° < 60° sun altitude
    const result = checkSunlight(LAT, LON, sunAtSouth60, [buildingAtBearing(180, 50, 5)]);
    expect(result.reason).toBe('sunny');
    expect(result.sunny).toBe(true);
  });

  it('tall building perpendicular to sun direction does not block', () => {
    // Building 50m east (bearing 90°), sun at azimuth 180° → angular diff 90° >> 10° tolerance
    const result = checkSunlight(LAT, LON, sunAtSouth30, [buildingAtBearing(90, 50, 100)]);
    expect(result.reason).toBe('sunny');
  });

  it('building beyond search radius is ignored', () => {
    // Building 300m south (> 250m radius), very tall
    const result = checkSunlight(LAT, LON, sunAtSouth30, [buildingAtBearing(180, 300, 500)]);
    expect(result.reason).toBe('sunny');
  });

  it('result carries correct solar position values', () => {
    const result = checkSunlight(LAT, LON, sunAtSouth30, []);
    expect(result.sunAltitude).toBe(30);
    expect(result.sunAzimuth).toBe(180);
  });

  it('first blocking building id is returned, not all of them', () => {
    const buildings = [
      buildingAtBearing(180, 50, 50), // south, blocks
      buildingAtBearing(181, 60, 50), // slightly SE, also blocks
    ];
    const result = checkSunlight(LAT, LON, sunAtSouth30, buildings);
    expect(result.sunny).toBe(false);
    expect(result.blockingBuildingId).not.toBeNull();
  });
});
