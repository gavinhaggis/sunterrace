import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Venue, SunlightStatus } from '../types';

const STATUS_COLOR: Record<SunlightStatus, string> = {
  sunny:         '#f59e0b',
  blocked:       '#6b7280',
  below_horizon: '#3b82f6',
  unknown:       '#d1d5db',
};

interface Props {
  terraces: Venue[];
  statusMap: Record<string, SunlightStatus>;
  selectedId: string | null;
  onTerraceSelect: (venue: Venue) => void;
  customPin: Venue | null;
  onMapClick: (lat: number, lon: number) => void;
}

function makePinMarker(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:28px;height:36px;cursor:crosshair';
  wrapper.innerHTML = `
    <svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C7.373 0 2 5.373 2 12c0 8 12 24 12 24s12-16 12-24C26 5.373 20.627 0 14 0z"
            fill="#ef4444" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="12" r="4" fill="white"/>
    </svg>`;
  return wrapper;
}

function buildGeoJSON(
  terraces: Venue[],
  statusMap: Record<string, SunlightStatus>,
  selectedId: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: terraces
      .filter(v => !v.isPin)
      .map(v => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [v.lon, v.lat] as [number, number] },
        properties: {
          id: v.id,
          name: v.name,
          label: v.address || v.city,
          color: STATUS_COLOR[statusMap[v.id] ?? 'unknown'],
          selected: v.id === selectedId,
        },
      })),
  };
}

const SOURCE_ID = 'venues';
const LAYER_ID  = 'venues-circles';

export function TerracesMap({
  terraces, statusMap, selectedId, onTerraceSelect, customPin, onMapClick,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const mapReadyRef   = useRef(false);
  const pinMarkerRef  = useRef<maplibregl.Marker | null>(null);

  // Stable refs so async callbacks never capture stale closures
  const onTerraceSelectRef = useRef(onTerraceSelect);
  useEffect(() => { onTerraceSelectRef.current = onTerraceSelect; }, [onTerraceSelect]);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // Venue lookup by id
  const venueByIdRef = useRef<Map<string, Venue>>(new Map());
  useEffect(() => {
    const m = new Map<string, Venue>();
    for (const v of terraces) m.set(v.id, v);
    venueByIdRef.current = m;
  }, [terraces]);

  // Snapshot refs used to seed the source on first map load
  const terracesRef  = useRef(terraces);
  const statusMapRef = useRef(statusMap);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { terracesRef.current  = terraces;  }, [terraces]);
  useEffect(() => { statusMapRef.current = statusMap; }, [statusMap]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Map initialisation (runs once)
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [24.945, 60.170],
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Single GeoJSON source + WebGL circle layer replaces 2805 DOM markers
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        generateId: true,
        data: buildGeoJSON(terracesRef.current, statusMapRef.current, selectedIdRef.current),
      });
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius':        ['case', ['get', 'selected'], 9, 7],
          'circle-color':         ['get', 'color'],
          'circle-stroke-width':  ['case', ['get', 'selected'], 3, 2],
          'circle-stroke-color':  'white',
        },
      });

      mapReadyRef.current = true;

      // Click a venue circle
      map.on('click', LAYER_ID, e => {
        if (!e.features?.[0]) return;
        (e.originalEvent as PointerEvent & { _markerHandled?: boolean })._markerHandled = true;
        const id = e.features[0].properties?.id as string;
        const venue = venueByIdRef.current.get(id);
        if (venue) onTerraceSelectRef.current(venue);
      });

      // Hover popup (desktop only — no touch penalty)
      const popup = new maplibregl.Popup({ offset: 12, closeButton: false, closeOnClick: false });
      map.on('mouseenter', LAYER_ID, e => {
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features?.[0]) return;
        const { name, label } = e.features[0].properties as { name: string; label: string };
        const [lng, lat] = (e.features[0].geometry as { coordinates: number[] }).coordinates;
        popup.setLngLat([lng, lat])
          .setHTML(`<strong>${name}</strong><br/><small>${label}</small>`)
          .addTo(map);
      });
      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
    });

    // Background tap → drop a custom pin
    map.on('click', e => {
      if ((e.originalEvent as PointerEvent & { _markerHandled?: boolean })._markerHandled) return;
      onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;
    return () => {
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update WebGL data whenever markers need recolouring (no DOM churn)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
      ?.setData(buildGeoJSON(terraces, statusMap, selectedId));
  }, [terraces, statusMap, selectedId]);

  // Custom pin — single DOM marker, negligible cost
  const updatePin = useCallback((map: maplibregl.Map) => {
    pinMarkerRef.current?.remove();
    pinMarkerRef.current = null;
    if (!customPin) return;
    const el = makePinMarker();
    el.addEventListener('click', e => {
      (e as PointerEvent & { _markerHandled?: boolean })._markerHandled = true;
      e.stopPropagation();
      onTerraceSelectRef.current(customPin);
    });
    pinMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([customPin.lon, customPin.lat])
      .addTo(map);
  }, [customPin]);

  useEffect(() => {
    if (mapRef.current) updatePin(mapRef.current);
  }, [updatePin]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
