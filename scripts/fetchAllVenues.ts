/**
 * Fetches all pubs, bars, cafes and restaurants in the Helsinki Metropolitan Area
 * (Helsinki, Vantaa, Espoo) from OpenStreetMap and writes src/data/venues.json.
 *
 * Usage:  npx tsx scripts/fetchAllVenues.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bounding box covering Helsinki + Vantaa + Espoo
const BBOX = '60.10,24.70,60.40,25.20';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

type Amenity = 'pub' | 'bar' | 'cafe' | 'restaurant';
type City = 'Helsinki' | 'Vantaa' | 'Espoo' | 'Other';

interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  amenity: Amenity;
  outdoor_seating: boolean | null;
  city: City;
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function deriveCity(tags: Record<string, string>, lat: number, lon: number): City {
  const raw = (tags['addr:city'] ?? tags['is_in:city'] ?? '').toLowerCase();
  if (raw.includes('helsinki')) return 'Helsinki';
  if (raw.includes('vantaa')) return 'Vantaa';
  if (raw.includes('espoo')) return 'Espoo';

  // Fallback: rough coordinate-based assignment
  // Espoo is west of ~24.94, Vantaa is north of ~60.28
  if (lat > 60.28) return 'Vantaa';
  if (lon < 24.94) return 'Espoo';
  return 'Helsinki';
}

async function main() {
  const query = `
[out:json][timeout:120];
(
  node[amenity~"^(pub|bar|cafe|restaurant)$"](${BBOX});
  way[amenity~"^(pub|bar|cafe|restaurant)$"](${BBOX});
);
out center tags;
`;

  console.log('Querying Overpass API for HMA venues…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    headers: { 'User-Agent': 'TerraceSun/1.0 (https://github.com/terracesun)' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json() as { elements: OverpassElement[] };
  console.log(`  Got ${data.elements.length} raw elements`);

  const venues: Venue[] = [];
  const seen = new Set<string>();

  for (const el of data.elements) {
    const lat = el.type === 'node' ? el.lat! : el.center?.lat;
    const lon = el.type === 'node' ? el.lon! : el.center?.lon;
    if (!lat || !lon) continue;

    const tags = el.tags ?? {};
    const name = tags['name'] ?? tags['name:en'] ?? tags['brand'] ?? null;
    if (!name) continue;

    const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (seen.has(coordKey)) continue;
    seen.add(coordKey);

    const amenity = tags['amenity'] as Amenity;
    const street = tags['addr:street'] ?? '';
    const housenumber = tags['addr:housenumber'] ?? '';
    const address = [street, housenumber].filter(Boolean).join(' ') || '';

    const outdoorRaw = tags['outdoor_seating'];
    const outdoor_seating: boolean | null =
      outdoorRaw === 'yes' ? true :
      outdoorRaw === 'no'  ? false :
      null;

    const city = deriveCity(tags, lat, lon);

    venues.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      address,
      lat,
      lon,
      amenity,
      outdoor_seating,
      city,
    });
  }

  venues.sort((a, b) => a.name.localeCompare(b.name, 'fi'));

  const outPath = path.resolve(__dirname, '../src/data/venues.json');
  fs.writeFileSync(outPath, JSON.stringify(venues, null, 2));
  console.log(`Saved ${venues.length} venues → ${outPath}`);

  const byCity = venues.reduce((acc, v) => {
    acc[v.city] = (acc[v.city] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byType = venues.reduce((acc, v) => {
    acc[v.amenity] = (acc[v.amenity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const withSeating = venues.filter(v => v.outdoor_seating === true).length;
  console.log('  By city:', byCity);
  console.log('  By type:', byType);
  console.log(`  With outdoor_seating=yes: ${withSeating}`);
}

main().catch(err => { console.error(err); process.exit(1); });
