import * as SunCalc from 'suncalc';
import type { Building, SunlightWindow } from '../types';
import { getSolarPosition } from './solar';
import { checkSunlight } from './obstruction';

const STEP_MS = 15 * 60 * 1000; // 15 minutes

export function getSunlightWindows(
  lat: number,
  lon: number,
  date: Date,
  buildings: Building[],
): SunlightWindow[] {
  const times = SunCalc.getTimes(date, lat, lon);
  const sunrise = times.sunrise as Date | null;
  const sunset = times.sunset as Date | null;
  const nadir = times.nadir;

  // Polar night — sun never rises
  if (!sunrise || isNaN(sunrise.getTime())) {
    const noonPos = getSolarPosition(lat, lon, nadir);
    if (noonPos.altitude < 0) return [];
  }

  // Polar day — sun never sets; scan the full 24 hours
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0);
  const start = (sunrise && !isNaN(sunrise.getTime())) ? sunrise : dayStart;
  const end   = (sunset  && !isNaN(sunset.getTime()))  ? sunset  : dayEnd;

  const windows: SunlightWindow[] = [];
  let windowStart: Date | null = null;

  for (let t = start.getTime(); t <= end.getTime(); t += STEP_MS) {
    const dt = new Date(t);
    const solar = getSolarPosition(lat, lon, dt);
    const res = checkSunlight(lat, lon, solar, buildings);

    if (res.sunny && windowStart === null) {
      windowStart = dt;
    } else if (!res.sunny && windowStart !== null) {
      windows.push({ start: windowStart, end: dt });
      windowStart = null;
    }
  }

  if (windowStart !== null) {
    windows.push({ start: windowStart, end });
  }

  return windows;
}

export function formatWindow(w: SunlightWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(w.start)} – ${fmt(w.end)}`;
}
