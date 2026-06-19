/**
 * Fetches OSM building data for a bounding box around Helsinki and writes
 * it to public/data/buildings.geojson.
 *
 * Usage:  npx tsx scripts/fetchBuildings.ts
 *
 * The output is used offline. For live queries, the app uses the Overpass
 * API at runtime via src/lib/buildings.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helsinki city centre bounding box: south,west,north,east
const BBOX = '60.150,24.910,60.200,24.990';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function main() {
  const query = `
[out:json][timeout:90];
(
  way["building"](${BBOX});
);
out body;
>;
out skel qt;
`;

  console.log('Querying Overpass API for Helsinki buildings…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { elements: OverpassElement[] };

  const nodes: Record<number, [number, number]> = {};
  for (const el of data.elements) {
    if (el.type === 'node') nodes[el.id] = [el.lon!, el.lat!];
  }

  const features = [];
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const coords = el.nodes.map(id => nodes[id]).filter(Boolean) as [number, number][];
    if (coords.length < 3) continue;
    if (coords[0][0] !== coords[coords.length - 1][0]) coords.push(coords[0]);

    features.push({
      type: 'Feature',
      properties: { id: `way/${el.id}`, height: parseHeight(el.tags) },
      geometry: { type: 'Polygon', coordinates: [coords] },
    });
  }

  const geojson = { type: 'FeatureCollection', features };
  const outPath = path.resolve(__dirname, '../public/data/buildings.geojson');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`Saved ${features.length} buildings → ${outPath}`);
}

function parseHeight(tags: Record<string, string> = {}): number {
  if (tags['height']) {
    const h = parseFloat(tags['height']);
    if (!isNaN(h)) return h;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (!isNaN(levels)) return levels * 3.2;
  }
  return 10;
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

main().catch(err => { console.error(err); process.exit(1); });
