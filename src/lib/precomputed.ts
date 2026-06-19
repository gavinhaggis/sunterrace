import * as SunCalc from 'suncalc';
import type { PrecomputedData, SunlightWindowRaw, SunlightWindow, SunlightStatus } from '../types';

let cache: PrecomputedData | null = null;
let pending: Promise<PrecomputedData> | null = null;

export async function loadPrecomputed(): Promise<void> {
  if (cache) return;
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}precomputed.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { cache = d as PrecomputedData; return cache; });
  }
  await pending;
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  // Normalise to 2025 base year (covers all 52 seasonal patterns)
  const weekNum = Math.min(Math.max(week, 1), 52);
  return `2025-W${String(weekNum).padStart(2, '0')}`;
}

function rawToWindow(raw: SunlightWindowRaw, date: Date): SunlightWindow {
  const [sh, sm] = raw.s.split(':').map(Number);
  const [eh, em] = raw.e.split(':').map(Number);
  // Stored as UTC — create UTC Date objects so toLocaleTimeString shows correct local time
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm));
  const end   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), eh, em));
  return { start, end };
}

export function getPrecomputedWindows(venueId: string, date: Date): SunlightWindow[] {
  if (!cache) return [];
  const venueData = cache[venueId];
  if (!venueData) return [];
  const key = isoWeekKey(date);
  const raws = venueData[key] ?? [];
  return raws.map(r => rawToWindow(r, date));
}

/**
 * Derives sunlight status for a venue directly from precomputed windows.
 * Used to colour all map markers without any API calls.
 */
export function getStatusFromPrecomputed(
  venueId: string,
  lat: number,
  lon: number,
  datetime: Date,
): SunlightStatus {
  if (!cache) return 'unknown';
  const windows = getPrecomputedWindows(venueId, datetime);
  const nowMs = datetime.getTime();

  // Currently inside a sunny window
  for (const w of windows) {
    if (w.start.getTime() <= nowMs && nowMs <= w.end.getTime()) return 'sunny';
  }

  // Sun above horizon → blocked by buildings (or shadowed)
  const pos = SunCalc.getPosition(datetime, lat, lon);
  if ((pos.altitude as unknown as number) > 0) return 'blocked';

  return 'below_horizon';
}
