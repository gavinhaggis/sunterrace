import type { Building } from '../types';

const UA = 'TerraceSun/1.0 (https://github.com/terracesun)';
const buildingCache = new Map<string, Building[]>();

export async function fetchNearbyBuildings(lat: number, lon: number, radiusM = 250): Promise<Building[]> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (buildingCache.has(key)) return buildingCache.get(key)!;

  const query = `
[out:json][timeout:30];
(
  way["building"](around:${radiusM},${lat},${lon});
);
out body;
>;
out skel qt;
`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    headers: { 'User-Agent': UA },
  });

  if (!res.ok) throw new Error(`Overpass API returned ${res.status}`);

  const data = await res.json();
  const buildings = parseOverpassResponse(data);
  buildingCache.set(key, buildings);
  return buildings;
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) return fallbackLabel(lat, lon);
    const data = await res.json() as { address?: Record<string, string>; display_name?: string };
    const a = data.address ?? {};
    const label = [a.road, a.house_number].filter(Boolean).join(' ')
      || a.neighbourhood || a.suburb
      || data.display_name?.split(',')[0]
      || fallbackLabel(lat, lon);
    return label;
  } catch {
    return fallbackLabel(lat, lon);
  }
}

function fallbackLabel(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
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

function parseOverpassResponse(data: { elements: OverpassElement[] }): Building[] {
  const nodes: Record<number, [number, number]> = {};
  for (const el of data.elements) {
    if (el.type === 'node') nodes[el.id] = [el.lon!, el.lat!];
  }

  const buildings: Building[] = [];
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const coords = el.nodes.map(id => nodes[id]).filter(Boolean) as [number, number][];
    if (coords.length < 3) continue;
    buildings.push({
      id: `way/${el.id}`,
      height: parseHeight(el.tags),
      polygon: coords,
    });
  }
  return buildings;
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}
