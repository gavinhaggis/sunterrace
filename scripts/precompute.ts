/**
 * Precomputes sunlight windows for all venues across 52 Wednesdays (2025-01-01 → 2025-12-24).
 * Uses hmaBuildings.json (build-time only) for obstruction data.
 *
 * Usage:  npx tsx scripts/precompute.ts
 * Output: src/data/precomputed.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as SunCalc from 'suncalc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const SEARCH_RADIUS_M   = 250;
const BEARING_TOL_DEG   = 10;
const STEP_MS           = 15 * 60 * 1000;

// Jan 1 2025 is a Wednesday — generate 52 consecutive Wednesdays.
// Re-run annually: update the base date to the first Wednesday of the new year,
// then run: npm run fetch-hma-buildings && npm run precompute
// The runtime isoWeekKey() normalises any year to 2025-W01…2025-W52, so the
// app silently reuses last year's patterns if you forget — close but not exact.
function getWednesdays(count = 52): Date[] {
  const dates: Date[] = [];
  const base = new Date(Date.UTC(2025, 0, 1)); // 2025-01-01 UTC
  for (let i = 0; i < count; i++) {
    dates.push(new Date(base.getTime() + i * 7 * 86_400_000));
  }
  return dates;
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Geo helpers ───────────────────────────────────────────────────────────────
function toRad(d: number) { return d * Math.PI / 180; }

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Venue { id: string; lat: number; lon: number; }
interface Building { id: string; height: number; polygon: [number, number][]; }
interface WindowRaw { s: string; e: string; }

// ── Obstruction check ─────────────────────────────────────────────────────────
function isSunny(lat: number, lon: number, azimuth: number, altitude: number, buildings: Building[]): boolean {
  if (altitude <= 0) return false;
  for (const b of buildings) {
    let minDist = Infinity;
    let inBeam = false;
    for (const [bLon, bLat] of b.polygon) {
      const dist = distanceMeters(lat, lon, bLat, bLon);
      if (dist < minDist) minDist = dist;
      if (angularDiff(bearingDeg(lat, lon, bLat, bLon), azimuth) < BEARING_TOL_DEG) inBeam = true;
    }
    if (!inBeam || minDist < 1 || minDist > SEARCH_RADIUS_M) continue;
    if ((Math.atan(b.height / minDist) * 180 / Math.PI) > altitude) return false;
  }
  return true;
}

// ── Window calculation for one venue+date ────────────────────────────────────
function computeWindows(lat: number, lon: number, date: Date, buildings: Building[]): WindowRaw[] {
  const times = SunCalc.getTimes(date, lat, lon);
  const sunrise = times.sunrise as Date | null;
  const sunset  = times.sunset  as Date | null;

  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 0));
  const start = (sunrise && !isNaN(sunrise.getTime())) ? sunrise : dayStart;
  const end   = (sunset  && !isNaN(sunset.getTime()))  ? sunset  : dayEnd;

  const fmt = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;

  const windows: WindowRaw[] = [];
  let wStart: Date | null = null;

  for (let t = start.getTime(); t <= end.getTime(); t += STEP_MS) {
    const dt = new Date(t);
    const pos = SunCalc.getPosition(dt, lat, lon);
    const altDeg = pos.altitude as unknown as number; // SunCalc v2 returns degrees

    const sunny = isSunny(lat, lon, pos.azimuth as unknown as number, altDeg, buildings);
    if (sunny && wStart === null) {
      wStart = dt;
    } else if (!sunny && wStart !== null) {
      windows.push({ s: fmt(wStart), e: fmt(dt) });
      wStart = null;
    }
  }
  if (wStart !== null) windows.push({ s: fmt(wStart), e: fmt(end) });

  return windows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const venuesPath   = path.resolve(__dirname, '../src/data/venues.json');
  const buildingsPath = path.resolve(__dirname, 'hmaBuildings.json');
  const outPath      = path.resolve(__dirname, '../src/data/precomputed.json');

  const venues: Venue[]     = JSON.parse(fs.readFileSync(venuesPath, 'utf8'));
  const allBuildings: Building[] = JSON.parse(fs.readFileSync(buildingsPath, 'utf8'));
  const wednesdays = getWednesdays(52);

  console.log(`Venues: ${venues.length}  Buildings: ${allBuildings.length}  Weeks: ${wednesdays.length}`);

  // ── Step 1: precompute nearby buildings per venue (O(N×M)) ──────────────────
  console.log('Building proximity cache…');
  const t0 = Date.now();
  const nearbyMap = new Map<string, Building[]>();
  for (const venue of venues) {
    const nearby: Building[] = [];
    for (const b of allBuildings) {
      // Quick bbox pre-filter before full haversine
      const centerLat = b.polygon[0][1];
      const centerLon = b.polygon[0][0];
      if (Math.abs(centerLat - venue.lat) > 0.003 || Math.abs(centerLon - venue.lon) > 0.005) continue;
      // Check closest vertex
      let minDist = Infinity;
      for (const [lon, lat] of b.polygon) {
        const d = distanceMeters(venue.lat, venue.lon, lat, lon);
        if (d < minDist) minDist = d;
      }
      if (minDist <= SEARCH_RADIUS_M) nearby.push(b);
    }
    nearbyMap.set(venue.id, nearby);
  }
  console.log(`  Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // ── Step 2: compute windows for each venue × each Wednesday ─────────────────
  console.log('Computing sunlight windows…');
  const t1 = Date.now();
  const out: Record<string, Record<string, WindowRaw[]>> = {};

  for (let vi = 0; vi < venues.length; vi++) {
    const venue = venues[vi];
    const buildings = nearbyMap.get(venue.id) ?? [];
    const venueWindows: Record<string, WindowRaw[]> = {};

    for (const wed of wednesdays) {
      const key = isoWeekKey(wed);
      venueWindows[key] = computeWindows(venue.lat, venue.lon, wed, buildings);
    }

    out[venue.id] = venueWindows;

    if ((vi + 1) % 500 === 0) {
      const elapsed = (Date.now() - t1) / 1000;
      const pct = ((vi + 1) / venues.length * 100).toFixed(0);
      console.log(`  ${vi + 1}/${venues.length} (${pct}%) — ${elapsed.toFixed(1)}s elapsed`);
    }
  }

  const totalSec = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`  Done in ${totalSec}s`);

  fs.writeFileSync(outPath, JSON.stringify(out));
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(`Saved precomputed.json → ${outPath} (${sizeKB} KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
