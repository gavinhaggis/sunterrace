/**
 * Fetches Helsinki restaurant/bar/cafe nodes with outdoor_seating=yes from
 * OpenStreetMap and writes them to src/data/terraces.json.
 *
 * Usage:  npx tsx scripts/fetchTerraces.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helsinki city centre, ~5km radius
const BBOX = '60.13,24.85,60.22,25.05';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface Terrace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
}

async function main() {
  const query = `
[out:json][timeout:60];
(
  node[amenity~"^(restaurant|bar|cafe)$"][outdoor_seating=yes](${BBOX});
  way[amenity~"^(restaurant|bar|cafe)$"][outdoor_seating=yes](${BBOX});
);
out center tags;
`;

  console.log('Querying Overpass API for Helsinki terraces…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    headers: { 'User-Agent': 'TerraceSun/1.0 (https://github.com/terracesun)' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { elements: OverpassElement[] };

  const terraces: Terrace[] = [];
  const seen = new Set<string>();

  for (const el of data.elements) {
    const lat = el.type === 'node' ? el.lat! : el.center?.lat;
    const lon = el.type === 'node' ? el.lon! : el.center?.lon;

    if (!lat || !lon) continue;

    const name = el.tags?.name ?? el.tags?.['name:en'] ?? el.tags?.brand ?? null;
    if (!name) continue; // Skip unnamed venues

    // Deduplicate by rounded coordinates (some venues appear as both node and way)
    const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (seen.has(coordKey)) continue;
    seen.add(coordKey);

    const street = el.tags?.['addr:street'] ?? '';
    const housenumber = el.tags?.['addr:housenumber'] ?? '';
    const address = [street, housenumber].filter(Boolean).join(' ') || 'Helsinki';

    terraces.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      address,
      lat,
      lon,
    });
  }

  terraces.sort((a, b) => a.name.localeCompare(b.name));

  const outPath = path.resolve(__dirname, '../src/data/terraces.json');
  fs.writeFileSync(outPath, JSON.stringify(terraces, null, 2));
  console.log(`Saved ${terraces.length} terraces → ${outPath}`);
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

main().catch(err => { console.error(err); process.exit(1); });
