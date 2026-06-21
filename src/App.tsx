import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TerracesMap, type TerracesMapHandle } from './components/TerracesMap';
import { SunPanel } from './components/SunPanel';
import { SunCompass } from './components/SunCompass';
import { SunForecast } from './components/SunForecast';
import { DateTimePicker } from './components/DateTimePicker';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { useSunlight } from './hooks/useSunlight';
import { reverseGeocode } from './lib/buildings';
import { loadPrecomputed, getPrecomputedWindows, getStatusFromPrecomputed } from './lib/precomputed';
import { distanceMeters } from './lib/geo';
import type { Venue, Amenity, City, SunlightWindow, SunlightStatus } from './types';
import venuesJson from './data/venues.json';
import './App.css';

const ALL_VENUES = venuesJson as Venue[];

function formatWalk(m: number): string {
  if (m < 50) return 'here';
  const mins = Math.round(m / 80);
  return mins < 2 ? '< 2 min walk' : `${mins} min walk`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function sunEndsIn(windows: SunlightWindow[], datetime: Date): string | null {
  const nowMs = datetime.getTime();
  for (const w of windows) {
    if (w.start.getTime() <= nowMs && nowMs < w.end.getTime()) {
      const minsLeft = Math.round((w.end.getTime() - nowMs) / 60_000);
      if (minsLeft <= 60) return formatTime(w.end);
    }
  }
  return null;
}

function nextSunFrom(windows: SunlightWindow[], datetime: Date): string | null {
  const nowMs = datetime.getTime();
  const next = windows.find(w => w.start.getTime() > nowMs);
  return next ? formatTime(next.start) : null;
}

export default function App() {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [datetime, setDatetime] = useState(() => new Date());
  const [statusMap, setStatusMap] = useState<Record<string, SunlightStatus>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [amenityFilter, setAmenityFilter] = useState<'' | Amenity>('');
  const [cityFilter, setCityFilter] = useState<City[]>([]);
  const [sunnyOnly, setSunnyOnly] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [customPin, setCustomPin] = useState<Venue | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // 'drop' = place a sunlight-check pin; 'locate' = place the user's own position
  const [pinMode, setPinMode] = useState<'drop' | 'locate' | null>(null);
  const [precomputedReady, setPrecomputedReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth > 768);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [favourites, setFavourites] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem('st-favourites') ?? '[]') as string[]),
  );
  const mapHandle = useRef<TerracesMapHandle>(null);
  const { check, reset, loading: diagramLoading, error: diagramError, result, buildings } = useSunlight();

  // Restore state from share URL on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const venueId = params.get('v');
    const time    = params.get('t');
    const sunny   = params.get('s');
    const amenity = params.get('a');
    if (time) {
      const [h, m] = time.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        setDatetime(prev => { const d = new Date(prev); d.setHours(h, m, 0, 0); return d; });
      }
    }
    if (sunny === '1') setSunnyOnly(true);
    if (amenity) setAmenityFilter(amenity as Amenity);
    if (venueId) {
      const venue = ALL_VENUES.find(v => v.id === venueId);
      if (venue) {
        setSelectedVenue(venue);
        setSheetOpen(true);
        const paddingBottom = window.innerWidth <= 768 ? window.innerHeight * 0.6 : 0;
        mapHandle.current?.flyTo(venue.lat, venue.lon, paddingBottom);
      }
    }
  }, []);

  // Load precomputed data on mount
  useEffect(() => {
    loadPrecomputed().then(() => setPrecomputedReady(true)).catch(console.error);
  }, []);

  // Default sunny filter on for mobile — checked after mount so viewport width is settled
  useEffect(() => {
    if (window.innerWidth <= 768) setSunnyOnly(true);
  }, []);

  // Open the sheet whenever a venue is selected (covers URL restore and all selection paths)
  useEffect(() => {
    if (selectedVenue) setSheetOpen(true);
  }, [selectedVenue]);

  // Recolour markers — debounced 150ms
  useEffect(() => {
    if (!precomputedReady) return;
    const id = setTimeout(() => {
      const next: Record<string, SunlightStatus> = {};
      for (const venue of ALL_VENUES) {
        next[venue.id] = getStatusFromPrecomputed(venue.id, venue.lat, venue.lon, datetime);
      }
      setStatusMap(next);
    }, 150);
    return () => clearTimeout(id);
  }, [precomputedReady, datetime]);

  const filteredVenues = useMemo(() => {
    return ALL_VENUES.filter(v => {
      if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (amenityFilter && v.amenity !== amenityFilter) return false;
      if (cityFilter.length > 0 && !cityFilter.includes(v.city)) return false;
      if (sunnyOnly && statusMap[v.id] !== 'sunny') return false;
      if (confirmedOnly && v.outdoor_seating !== true) return false;
      return true;
    });
  }, [searchQuery, amenityFilter, cityFilter, sunnyOnly, confirmedOnly, statusMap]);

  const handleNearMeChange = useCallback((v: boolean) => {
    if (!v) { setNearMe(false); return; }
    if (userLocation) { setNearMe(true); return; }
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setNearMe(true);
        setLocationPending(false);
      },
      () => setLocationPending(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [userLocation]);

  const [sortedVenues, distanceMap] = useMemo<[Venue[], Map<string, number> | null]>(() => {
    if (!nearMe || !userLocation) return [filteredVenues, null];
    const { lat, lon } = userLocation;
    const pairs = filteredVenues.map(v => ({ v, d: distanceMeters(lat, lon, v.lat, v.lon) }));
    pairs.sort((a, b) => a.d - b.d);
    return [pairs.map(p => p.v), new Map(pairs.map(p => [p.v.id, p.d]))];
  }, [filteredVenues, nearMe, userLocation]);

  const mapVenues = useMemo(
    () => customPin ? [customPin, ...filteredVenues] : filteredVenues,
    [customPin, filteredVenues],
  );

  const panelWindows = useMemo(
    () => (precomputedReady && selectedVenue ? getPrecomputedWindows(selectedVenue.id, datetime) : []),
    [precomputedReady, selectedVenue, datetime],
  );

  const shareUrl = useMemo(() => {
    if (!selectedVenue) return '';
    const h = String(datetime.getHours()).padStart(2, '0');
    const m = String(datetime.getMinutes()).padStart(2, '0');
    const p = new URLSearchParams({ v: selectedVenue.id, t: `${h}:${m}` });
    if (sunnyOnly) p.set('s', '1');
    if (amenityFilter) p.set('a', amenityFilter);
    return `${window.location.origin}${window.location.pathname}?${p}`;
  }, [selectedVenue, datetime, sunnyOnly, amenityFilter]);

  const sunnyCount = useMemo(
    () => filteredVenues.filter(v => statusMap[v.id] === 'sunny').length,
    [filteredVenues, statusMap],
  );

  const totalSunny = useMemo(
    () => ALL_VENUES.filter(v => statusMap[v.id] === 'sunny').length,
    [statusMap],
  );

  const toggleFavourite = useCallback((id: string) => {
    setFavourites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('st-favourites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleVenueSelect = useCallback((venue: Venue) => {
    reset();
    setSelectedVenue(venue);
    setSheetOpen(true);
    // On mobile the sheet covers 60dvh; pass that as bottom padding so the
    // flyTo centers the venue in the visible area above the sheet.
    const paddingBottom = window.innerWidth <= 768 ? window.innerHeight * 0.6 : 0;
    mapHandle.current?.flyTo(venue.lat, venue.lon, paddingBottom);
  }, [reset]);

  const handlePanelClose = useCallback(() => {
    setSelectedVenue(null);
  }, []);

  const handleMapClick = useCallback(async (lat: number, lon: number) => {
    if (pinMode === 'locate') {
      setPinMode(null);
      setUserLocation({ lat, lon });
      setNearMe(true);
      return;
    }
    if (pinMode === 'drop') {
      setPinMode(null);
      reset();
      const name = await reverseGeocode(lat, lon);
      const pin: Venue = {
        id: 'custom-pin',
        name,
        address: 'Custom location',
        lat,
        lon,
        amenity: 'bar',
        outdoor_seating: null,
        city: 'Helsinki',
        isPin: true,
      };
      setCustomPin(pin);
      setSelectedVenue(pin);
      setSheetOpen(true);
    }
  }, [pinMode, reset]);

  const handleRequestDiagram = useCallback(() => {
    if (!selectedVenue) return;
    check(selectedVenue, datetime);
  }, [selectedVenue, datetime, check]);

  const venueList = useMemo(() => {
    let ordered = sortedVenues;
    if (!nearMe && favourites.size > 0) {
      ordered = [
        ...sortedVenues.filter(v => favourites.has(v.id)),
        ...sortedVenues.filter(v => !favourites.has(v.id)),
      ];
    }
    return customPin ? [customPin, ...ordered] : ordered;
  }, [sortedVenues, favourites, nearMe, customPin]);

  const MAX_LIST = 200;
  const displayList = venueList.slice(0, MAX_LIST);

  const compassLat = selectedVenue?.lat ?? 60.17;
  const compassLon = selectedVenue?.lon ?? 24.94;
  const filterCount = (amenityFilter !== '' ? 1 : 0) + cityFilter.length + (confirmedOnly ? 1 : 0);

  return (
    <div className="app">
      <aside className={`sidebar${sheetOpen ? ' sheet-open' : ''}`}>
        <div className="sheet-handle" onClick={() => setSheetOpen(o => !o)} />

        <div className="top-bar">
          <h1 className="app-title">SunTerrace</h1>
          <DateTimePicker value={datetime} onChange={setDatetime} />
        </div>

        <div className="search-row">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            count={filteredVenues.length}
            total={ALL_VENUES.length}
          />
          <button
            className={`qbtn${sunnyOnly ? ' on-sun' : ''}`}
            onClick={() => setSunnyOnly(v => !v)}
            title="Sunny now"
            aria-pressed={sunnyOnly}
          >☀</button>
          <button
            className={`qbtn${nearMe ? ' on-near' : ''}`}
            onClick={() => handleNearMeChange(!nearMe)}
            title="Near me"
            aria-pressed={nearMe}
            disabled={locationPending}
          >{locationPending ? '…' : '⊙'}</button>
          <button
            className={`qbtn${filtersOpen ? ' on-filter' : ''}`}
            onClick={() => setFiltersOpen(v => !v)}
            title="Filters"
            aria-pressed={filtersOpen}
          >
            ≡{filterCount > 0 && <span className="qbtn-badge">{filterCount}</span>}
          </button>
        </div>

        {filtersOpen && (
          <FilterBar
            amenity={amenityFilter}
            cities={cityFilter}
            confirmedOnly={confirmedOnly}
            onAmenityChange={setAmenityFilter}
            onCitiesChange={setCityFilter}
            onConfirmedOnlyChange={setConfirmedOnly}
          />
        )}

        {selectedVenue ? (
          <SunPanel
            key={selectedVenue.id}
            venue={selectedVenue}
            status={statusMap[selectedVenue.id] ?? 'unknown'}
            windows={panelWindows}
            datetime={datetime}
            shareUrl={shareUrl}
            isFavourite={favourites.has(selectedVenue.id)}
            onToggleFavourite={() => toggleFavourite(selectedVenue.id)}
            onClose={handlePanelClose}
            onRequestDiagram={handleRequestDiagram}
            result={result}
            buildings={buildings}
            diagramLoading={diagramLoading}
            diagramError={diagramError}
          />
        ) : (
          <div className="sidebar-hint">
            {precomputedReady
              ? 'Tap a venue or drop a pin on the map.'
              : 'Loading sunlight data…'}
          </div>
        )}

        {selectedVenue && <div className="panel-list-sep">All venues</div>}

        <div className="list-headline">
          <span className="headline-sunny">☀ {totalSunny} sunny now</span>
          <span className="headline-total">{filteredVenues.length} / {ALL_VENUES.length} shown</span>
        </div>

        <ul className="terrace-list">
          {displayList.map(venue => {
            const status: SunlightStatus = statusMap[venue.id] ?? 'unknown';
            const preWindows = precomputedReady ? getPrecomputedWindows(venue.id, datetime) : [];
            const endsAt  = sunEndsIn(preWindows, datetime);
            const nextSun = status !== 'sunny' ? nextSunFrom(preWindows, datetime) : null;
            const noSeating = venue.outdoor_seating === false;
            const dist = distanceMap?.get(venue.id);
            const isFav = favourites.has(venue.id);

            return (
              <li
                key={venue.id}
                className={[
                  'terrace-item',
                  selectedVenue?.id === venue.id ? 'selected' : '',
                  noSeating ? 'no-seating' : '',
                  isFav ? 'is-fav' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleVenueSelect(venue)}
              >
                <span className={`status-dot status-${status}`} />
                <div className="terrace-info">
                  <div className="terrace-name-row">
                    <span className="terrace-name">
                      {venue.isPin ? '📍 ' : ''}{venue.name}
                    </span>
                    {precomputedReady && !venue.isPin && (
                      <SunForecast windows={preWindows} datetime={datetime} />
                    )}
                  </div>
                  <div className="terrace-address">
                    {dist != null && <span className="terrace-dist">{formatWalk(dist)} · </span>}
                    {venue.address || venue.city}
                  </div>
                  <div className="terrace-chips">
                    {noSeating && <span className="chip chip-no-seating">No terrace registered</span>}
                    {endsAt  && <span className="chip chip-sun-ending">☁ Sun ends {endsAt}</span>}
                    {nextSun && <span className="chip chip-next-sun">☀ from {nextSun}</span>}
                  </div>
                </div>
                <button
                  className={`star-btn${isFav ? ' on' : ''}`}
                  onClick={e => { e.stopPropagation(); toggleFavourite(venue.id); }}
                  title={isFav ? 'Remove favourite' : 'Save favourite'}
                  aria-pressed={isFav}
                >
                  {isFav ? '★' : '☆'}
                </button>
              </li>
            );
          })}
          {venueList.length > MAX_LIST && (
            <li className="terrace-list-overflow">
              Showing {MAX_LIST} of {venueList.length} — use filters or search to narrow results.
            </li>
          )}
        </ul>
      </aside>

      <main className={`map-container${pinMode ? ` pin-mode-${pinMode}` : ''}`}>
        <TerracesMap
          ref={mapHandle}
          terraces={mapVenues}
          statusMap={statusMap}
          selectedId={selectedVenue?.id ?? null}
          onTerraceSelect={handleVenueSelect}
          customPin={customPin}
          onMapClick={handleMapClick}
        />
        <SunCompass datetime={datetime} lat={compassLat} lon={compassLon} />
        <div className="map-btns">
          <button
            className={`map-pin-btn${pinMode === 'locate' ? ' active-locate' : ''}`}
            onClick={() => setPinMode(v => v === 'locate' ? null : 'locate')}
            title={pinMode === 'locate' ? 'Cancel' : 'Tap map to set your location'}
          >
            {pinMode === 'locate' ? '✕ Cancel' : '⊙ Set location'}
          </button>
          <button
            className={`map-pin-btn${pinMode === 'drop' ? ' active-drop' : ''}`}
            onClick={() => setPinMode(v => v === 'drop' ? null : 'drop')}
            title={pinMode === 'drop' ? 'Cancel' : 'Tap map to check sun at any point'}
          >
            {pinMode === 'drop' ? '✕ Cancel' : '＋ Drop pin'}
          </button>
        </div>
      </main>
    </div>
  );
}
