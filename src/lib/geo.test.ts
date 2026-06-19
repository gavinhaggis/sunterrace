import { describe, it, expect } from 'vitest';
import { bearingDeg, distanceMeters, angularDiff } from './geo';

describe('bearingDeg', () => {
  const HKI = { lat: 60.17, lon: 24.94 };

  it('returns ~0° heading due north', () => {
    // Point directly north of Helsinki
    const bearing = bearingDeg(HKI.lat, HKI.lon, HKI.lat + 0.1, HKI.lon);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('returns ~180° heading due south', () => {
    const bearing = bearingDeg(HKI.lat, HKI.lon, HKI.lat - 0.1, HKI.lon);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('returns ~90° heading due east', () => {
    const bearing = bearingDeg(HKI.lat, HKI.lon, HKI.lat, HKI.lon + 0.1);
    expect(bearing).toBeGreaterThan(88);
    expect(bearing).toBeLessThan(92);
  });

  it('returns ~270° heading due west', () => {
    const bearing = bearingDeg(HKI.lat, HKI.lon, HKI.lat, HKI.lon - 0.1);
    expect(bearing).toBeGreaterThan(268);
    expect(bearing).toBeLessThan(272);
  });
});

describe('distanceMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(distanceMeters(60.17, 24.94, 60.17, 24.94)).toBeCloseTo(0, 0);
  });

  it('1° latitude ≈ 111km at any longitude', () => {
    const d = distanceMeters(60.0, 24.94, 61.0, 24.94);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('100m displacement north is within 5m of 100m', () => {
    // 100m in latitude ≈ 0.0009°
    const d = distanceMeters(60.17, 24.94, 60.17 + 0.0009, 24.94);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });
});

describe('angularDiff', () => {
  it('same bearing → 0', () => {
    expect(angularDiff(90, 90)).toBe(0);
  });

  it('180° apart → 180', () => {
    expect(angularDiff(0, 180)).toBe(180);
  });

  it('handles wrap-around at 0°/360°', () => {
    expect(angularDiff(5, 355)).toBeCloseTo(10, 1);
  });

  it('north vs south-east is ~135°', () => {
    expect(angularDiff(0, 135)).toBeCloseTo(135, 1);
  });
});
