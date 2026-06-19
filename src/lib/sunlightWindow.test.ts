import { describe, it, expect } from 'vitest';
import { getSunlightWindows } from './sunlightWindow';

const HKI_LAT = 60.17;
const HKI_LON = 24.94;

describe('getSunlightWindows', () => {
  it('returns at least one window on a clear summer day (no buildings)', () => {
    const windows = getSunlightWindows(HKI_LAT, HKI_LON, new Date('2025-06-21'), []);
    expect(windows.length).toBeGreaterThanOrEqual(1);
  });

  it('summer window spans most of the day (Helsinki ~19h of daylight)', () => {
    const windows = getSunlightWindows(HKI_LAT, HKI_LON, new Date('2025-06-21'), []);
    const totalMs = windows.reduce((s, w) => s + (w.end.getTime() - w.start.getTime()), 0);
    const totalHours = totalMs / (1000 * 60 * 60);
    expect(totalHours).toBeGreaterThan(16);
  });

  it('winter day with no buildings has a short window (~6h)', () => {
    const windows = getSunlightWindows(HKI_LAT, HKI_LON, new Date('2025-12-21'), []);
    const totalMs = windows.reduce((s, w) => s + (w.end.getTime() - w.start.getTime()), 0);
    const totalHours = totalMs / (1000 * 60 * 60);
    expect(totalHours).toBeGreaterThan(3);
    expect(totalHours).toBeLessThan(9);
  });

  it('a ring of 999m-tall buildings eliminates all windows', () => {
    // Place buildings in a ring at every 15° around the terrace (~55m out), each with
    // a small polygon so at least one vertex falls within the ±10° bearing tolerance
    // for any sun azimuth during the summer day.
    const R_LAT = 0.0005; // ~55 m
    const R_LON = 0.001;  // ~55 m at lat 60
    const buildings = Array.from({ length: 24 }, (_, i) => {
      const angleDeg = i * 15;
      const rad = angleDeg * Math.PI / 180;
      const cLat = HKI_LAT + R_LAT * Math.cos(rad);
      const cLon = HKI_LON + R_LON * Math.sin(rad);
      const d = 0.00005;
      return {
        id: `ring-${i}`,
        height: 999,
        polygon: [
          [cLon - d, cLat - d],
          [cLon + d, cLat - d],
          [cLon + d, cLat + d],
          [cLon - d, cLat + d],
        ] as [number, number][],
      };
    });
    const windows = getSunlightWindows(HKI_LAT, HKI_LON, new Date('2025-06-21'), buildings);
    expect(windows.length).toBe(0);
  });

  it('window start is before window end', () => {
    const windows = getSunlightWindows(HKI_LAT, HKI_LON, new Date('2025-06-21'), []);
    for (const w of windows) {
      expect(w.start.getTime()).toBeLessThan(w.end.getTime());
    }
  });
});
