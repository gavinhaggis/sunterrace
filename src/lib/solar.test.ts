import { describe, it, expect } from 'vitest';
import * as SunCalc from 'suncalc';
import { getSolarPosition } from './solar';
import { angularDiff } from './geo';

// Helsinki city centre
const HKI_LAT = 60.17;
const HKI_LON = 24.94;

// Use SunCalc.getTimes to derive solar noon dynamically so the
// expected values stay correct regardless of DST or year.
function solarNoonOn(dateStr: string) {
  return SunCalc.getTimes(new Date(dateStr), HKI_LAT, HKI_LON).solarNoon;
}

describe('getSolarPosition – Helsinki sanity checks', () => {
  it('summer solstice solar noon: altitude ≈ 53°, azimuth ≈ south', () => {
    const noon = solarNoonOn('2025-06-21');
    const pos = getSolarPosition(HKI_LAT, HKI_LON, noon);
    // Max solar altitude at Helsinki on summer solstice = 90 - 60.17 + 23.45 ≈ 53.3°
    expect(pos.altitude).toBeGreaterThan(52);
    expect(pos.altitude).toBeLessThan(55);
    expect(angularDiff(pos.azimuth, 180)).toBeLessThan(3);
  });

  it('winter solstice solar noon: altitude ≈ 6°, azimuth ≈ south', () => {
    const noon = solarNoonOn('2025-12-21');
    const pos = getSolarPosition(HKI_LAT, HKI_LON, noon);
    // Max solar altitude = 90 - 60.17 - 23.45 ≈ 6.4°
    expect(pos.altitude).toBeGreaterThan(4);
    expect(pos.altitude).toBeLessThan(9);
    expect(angularDiff(pos.azimuth, 180)).toBeLessThan(3);
  });

  it('winter midnight: sun is below the horizon', () => {
    // 01:00 UTC = 03:00 Helsinki (UTC+2), well before dawn in January
    const midnight = new Date('2025-01-15T01:00:00Z');
    const pos = getSolarPosition(HKI_LAT, HKI_LON, midnight);
    expect(pos.altitude).toBeLessThan(0);
  });

  it('summer evening 20:00 Helsinki (EEST = UTC+3): sun still up', () => {
    // Sunset in Helsinki in June is ~23:00 local → 20:00 UTC
    const evening = new Date('2025-06-21T17:00:00Z'); // 20:00 EEST
    const pos = getSolarPosition(HKI_LAT, HKI_LON, evening);
    expect(pos.altitude).toBeGreaterThan(10);
  });

  it('azimuth is in [0, 360)', () => {
    const noon = solarNoonOn('2025-06-21');
    const pos = getSolarPosition(HKI_LAT, HKI_LON, noon);
    expect(pos.azimuth).toBeGreaterThanOrEqual(0);
    expect(pos.azimuth).toBeLessThan(360);
  });

  it('sun is in the southeast at 09:00 Helsinki time in summer', () => {
    // 09:00 EEST = 06:00 UTC
    const morning = new Date('2025-06-21T06:00:00Z');
    const pos = getSolarPosition(HKI_LAT, HKI_LON, morning);
    expect(pos.altitude).toBeGreaterThan(0);
    // Sun is in the east/southeast in the morning (azimuth 90–160°)
    expect(pos.azimuth).toBeGreaterThan(80);
    expect(pos.azimuth).toBeLessThan(170);
  });

  it('sun is in the southwest at 18:00 Helsinki time in summer', () => {
    // 18:00 EEST = 15:00 UTC
    const afternoon = new Date('2025-06-21T15:00:00Z');
    const pos = getSolarPosition(HKI_LAT, HKI_LON, afternoon);
    expect(pos.altitude).toBeGreaterThan(0);
    // Sun is in the west/southwest in the afternoon (azimuth 200–290°)
    expect(pos.azimuth).toBeGreaterThan(200);
    expect(pos.azimuth).toBeLessThan(290);
  });
});
