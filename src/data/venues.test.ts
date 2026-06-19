import { describe, it, expect } from 'vitest';
import * as SunCalc from 'suncalc';
import venues from './venues.json';
import { getSolarPosition } from '../lib/solar';
import type { Venue } from '../types';

// Full HMA bounding box (Helsinki + Vantaa + Espoo)
const HMA_BOUNDS = {
  latMin: 60.10,
  latMax: 60.40,
  lonMin: 24.70,
  lonMax: 25.20,
};

const VENUES = venues as Venue[];

describe('venues data – structural checks', () => {
  it('has at least 2500 venues', () => {
    expect(VENUES.length).toBeGreaterThanOrEqual(2500);
  });

  it('every venue has required fields', () => {
    for (const v of VENUES) {
      expect(v.id,     `${v.name} missing id`).toBeTruthy();
      expect(v.name,   `${v.id} missing name`).toBeTruthy();
      expect(typeof v.lat).toBe('number');
      expect(typeof v.lon).toBe('number');
      expect(['pub', 'bar', 'cafe', 'restaurant']).toContain(v.amenity);
      expect(['Helsinki', 'Vantaa', 'Espoo', 'Other']).toContain(v.city);
    }
  });

  it('outdoor_seating is boolean or null on every venue', () => {
    for (const v of VENUES) {
      expect(
        v.outdoor_seating === true || v.outdoor_seating === false || v.outdoor_seating === null,
        `${v.name} has invalid outdoor_seating: ${v.outdoor_seating}`,
      ).toBe(true);
    }
  });

  it('all venue IDs are unique', () => {
    const ids = VENUES.map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all venues are within the HMA bounding box', () => {
    for (const v of VENUES) {
      expect(v.lat, `${v.name} lat out of HMA bounds`).toBeGreaterThanOrEqual(HMA_BOUNDS.latMin);
      expect(v.lat, `${v.name} lat out of HMA bounds`).toBeLessThanOrEqual(HMA_BOUNDS.latMax);
      expect(v.lon, `${v.name} lon out of HMA bounds`).toBeGreaterThanOrEqual(HMA_BOUNDS.lonMin);
      expect(v.lon, `${v.name} lon out of HMA bounds`).toBeLessThanOrEqual(HMA_BOUNDS.lonMax);
    }
  });

  it('coordinates are not accidentally swapped (lat≈60, lon≈25)', () => {
    for (const v of VENUES) {
      expect(v.lat, `${v.name} lat looks wrong`).toBeGreaterThan(59);
      expect(v.lon, `${v.name} lon looks wrong`).toBeGreaterThan(20);
    }
  });

  it('at least 400 venues have confirmed outdoor seating', () => {
    const withSeating = VENUES.filter(v => v.outdoor_seating === true).length;
    expect(withSeating).toBeGreaterThanOrEqual(400);
  });

  it('has venues in each of the three cities', () => {
    const cities = new Set(VENUES.map(v => v.city));
    expect(cities.has('Helsinki')).toBe(true);
    expect(cities.has('Vantaa')).toBe(true);
    expect(cities.has('Espoo')).toBe(true);
  });

  it('has all four amenity types', () => {
    const amenities = new Set(VENUES.map(v => v.amenity));
    expect(amenities.has('pub')).toBe(true);
    expect(amenities.has('bar')).toBe(true);
    expect(amenities.has('cafe')).toBe(true);
    expect(amenities.has('restaurant')).toBe(true);
  });
});

describe('venues data – solar sanity checks (sample of 50)', () => {
  // Use every 56th venue to get a ~50-item sample spread across the full list
  const SAMPLE = VENUES.filter((_, i) => i % 56 === 0);

  it('sun is well above horizon at summer solstice noon for all sampled venues', () => {
    for (const v of SAMPLE) {
      const noon = SunCalc.getTimes(new Date('2025-06-21'), v.lat, v.lon).solarNoon;
      const pos = getSolarPosition(v.lat, v.lon, noon);
      expect(pos.altitude, `${v.name} has low altitude at summer noon`).toBeGreaterThan(50);
    }
  });

  it('sun is above horizon at winter solstice noon for all sampled venues', () => {
    for (const v of SAMPLE) {
      const noon = SunCalc.getTimes(new Date('2025-12-21'), v.lat, v.lon).solarNoon;
      const pos = getSolarPosition(v.lat, v.lon, noon);
      expect(pos.altitude, `${v.name} has negative altitude at winter noon`).toBeGreaterThan(0);
    }
  });

  it('sun is below horizon at 03:00 Helsinki time in January', () => {
    const winterNight = new Date('2025-01-15T01:00:00Z'); // 01:00 UTC = 03:00 EET
    for (const v of SAMPLE) {
      const pos = getSolarPosition(v.lat, v.lon, winterNight);
      expect(pos.altitude, `${v.name} has positive altitude at winter night`).toBeLessThan(0);
    }
  });

  it('sun is above horizon at 19:00 Helsinki time in June', () => {
    const summerEvening = new Date('2025-06-21T16:00:00Z'); // 16:00 UTC = 19:00 EEST
    for (const v of SAMPLE) {
      const pos = getSolarPosition(v.lat, v.lon, summerEvening);
      expect(pos.altitude, `${v.name} has negative altitude at 19:00 in summer`).toBeGreaterThan(0);
    }
  });
});
