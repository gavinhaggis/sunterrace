import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Venue } from '../types';

type SunlightStatus = 'sunny' | 'blocked' | 'below_horizon' | 'unknown';

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

function makeDotMarker(color: string, size: number, selected: boolean): HTMLElement {
  // Outer wrapper: MapLibre anchors this element — never apply transform here
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `width:${size + 6}px;height:${size + 6}px;display:flex;align-items:center;justify-content:center;cursor:pointer`;

  // Inner dot: safe to scale on hover
  const dot = document.createElement('div');
  dot.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `background:${color}`,
    `border:${selected ? '3px' : '2px'} solid white`,
    'box-shadow:0 1px 5px rgba(0,0,0,0.35)',
    'transition:transform 0.15s',
  ].join(';');

  wrapper.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.3)'; });
  wrapper.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; });
  wrapper.appendChild(dot);
  return wrapper;
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

export function TerracesMap({
  terraces, statusMap, selectedId, onTerraceSelect, customPin, onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Stable ref so the click handler never goes stale
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [24.945, 60.170],
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('click', e => {
      if ((e.originalEvent as PointerEvent & { _markerHandled?: boolean })._markerHandled) return;
      onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Terrace markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    terraces.forEach(venue => {
      const status: SunlightStatus = statusMap[venue.id] ?? 'unknown';
      const isSelected = venue.id === selectedId;
      const el = makeDotMarker(STATUS_COLOR[status], isSelected ? 18 : 14, isSelected);

      el.addEventListener('click', e => {
        (e as PointerEvent & { _markerHandled?: boolean })._markerHandled = true;
        e.stopPropagation();
        onTerraceSelect(venue);
      });

      const popup = new maplibregl.Popup({ offset: 16, closeButton: false })
        .setHTML(`<strong>${venue.name}</strong><br/><small>${venue.address || venue.city}</small>`);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([venue.lon, venue.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [terraces, statusMap, selectedId, onTerraceSelect]);

  // Custom pin marker
  const updatePin = useCallback((map: maplibregl.Map) => {
    pinMarkerRef.current?.remove();
    pinMarkerRef.current = null;
    if (!customPin) return;
    const el = makePinMarker();
    pinMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([customPin.lon, customPin.lat])
      .addTo(map);
  }, [customPin]);

  useEffect(() => {
    if (mapRef.current) updatePin(mapRef.current);
  }, [updatePin]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
