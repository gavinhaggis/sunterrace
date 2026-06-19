import * as SunCalc from 'suncalc';
import type { SolarPosition } from '../types';

export function getSolarPosition(lat: number, lon: number, date: Date): SolarPosition {
  const pos = SunCalc.getPosition(date, lat, lon);
  // suncalc@1.9.x returns degrees for azimuth (0=N, 90=E, 180=S, 270=W) and altitude above horizon
  return { azimuth: pos.azimuth, altitude: pos.altitude };
}
