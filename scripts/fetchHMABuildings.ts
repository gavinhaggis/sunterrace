/**
 * Fetches all buildings with height data in the HMA bbox from Overpass.
 * Output is used only by the precompute script — NOT bundled in the app.
 *
 * Usage:  npx tsx scripts/fetchHMABuildings.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BBOX = '60.10,24.70,60.40,25.20';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface BuildingOut {
  id: string;
  height: number;
  polygon: [number, number][]; // [lon, lat]
}

interface OverpassNode { id: number; lat: number; lon: number; }
interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

function parseHeight(tags: Record<string, string>): number | null {
  const raw = tags['height'] ?? tags['building:height'] ?? tags['building:levels'];
  if (!raw) return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  // building:levels → approximate 3m per floor
  if (!tags['height'] && !tags['building:height']) return n * 3;
  return n;
}

async function main() {
  // Fetch ways (buildings) + their nodes in one query
  const query = `
[out:json][timeout:180];
(
  way[building][height](${BBOX});
  way[building]["building:height"](${BBOX});
  way[building]["building:levels"](${BBOX});
);
out geom tags;
`;

  console.log('Querying Overpass for HMA buildings with height data…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    headers: { 'User-Agent': 'TerraceSun/1.0 (https://github.com/terracesun)' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  interface GeomElement {
    type: 'way';
    id: number;
    geometry: { lat: number; lon: number }[];
    tags?: Record<string, string>;
  }

  const data = await res.json() as { elements: GeomElement[] };
  console.log(`  Got ${data.elements.length} raw building elements`);

  const buildings: BuildingOut[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const tags = el.tags ?? {};
    const height = parseHeight(tags);
    if (!height || height < 3) continue; // ignore flat/tiny structures

    const polygon: [number, number][] = el.geometry.map(g => [g.lon, g.lat]);
    buildings.push({ id: `w${el.id}`, height, polygon });
  }

  const outPath = path.resolve(__dirname, 'hmaBuildings.json');
  fs.writeFileSync(outPath, JSON.stringify(buildings));
  console.log(`Saved ${buildings.length} buildings → ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
