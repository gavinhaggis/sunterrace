import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TerracesMap } from './components/TerracesMap';
import { SunPanel } from './components/SunPanel';
import { SunCompass } from './components/SunCompass';
import { DateTimePicker } from './components/DateTimePicker';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { useSunlight } from './hooks/useSunlight';
import { reverseGeocode } from './lib/buildings';
import { loadPrecomputed, getPrecomputedWindows, getStatusFromPrecomputed } from './lib/precomputed';
import type { Venue, Amenity, City, SunlightWindow, SunlightStatus } from './types';
import venuesJson from './data/venues.json';
import './App.css';

const ALL_VENUES = venuesJson as Venue[];

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

export default function App() {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [datetime, setDatetime] = useState(() => new Date());
  const [statusMap, setStatusMap] = useState<Record<string, SunlightStatus>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [amenityFilter, setAmenityFilter] = useState<'' | Amenity>('');
  const [cityFilter, setCityFilter] = useState<City[]>([]);
  const [sunnyOnly, setSunnyOnly] = useState(false);
  const [customPin, setCustomPin] = useState<Venue | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [precomputedReady, setPrecomputedReady] = useState(false);
  const { check, reset, loading: diagramLoading, error: diagramError, result, buildings } = useSunlight();

  // Load precomputed data on mount
  useEffect(() => {
    loadPrecomputed()
      .then(() => setPrecomputedReady(true))
      .catch(console.error);
  }, []);

  // Recolour all map markers whenever precomputed data arrives or datetime changes.
  // Debounced 150ms so rapid datetime scrubbing doesn't thrash the status loop.
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
      return true;
    });
  }, [searchQuery, amenityFilter, cityFilter, sunnyOnly, statusMap]);

  const mapVenues = useMemo(() => {
    if (!customPin) return ALL_VENUES;
    return [...ALL_VENUES, customPin];
  }, [customPin]);

  // Precomputed windows for the selected venue's timeline — instant, no network call
  const panelWindows = useMemo(
    () => (precomputedReady && selectedVenue
      ? getPrecomputedWindows(selectedVenue.id, datetime)
      : []),
    [precomputedReady, selectedVenue, datetime],
  );

  const handleVenueSelect = useCallback((venue: Venue) => {
    reset();
    setSelectedVenue(venue);
    setSheetOpen(true);
  }, [reset]);

  const handleMapClick = useCallback(async (lat: number, lon: number) => {
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
  }, [reset]);

  // Fired when user opens the SunDiagram accordion for the first time on a venue
  const handleRequestDiagram = useCallback(() => {
    if (!selectedVenue) return;
    check(selectedVenue, datetime);
  }, [selectedVenue, datetime, check]);

  const venueList = customPin
    ? [customPin, ...filteredVenues]
    : filteredVenues;

  const MAX_LIST = 200;
  const displayList = venueList.slice(0, MAX_LIST);

  // Compass uses selected venue coords when available, otherwise Helsinki centre
  const compassLat = selectedVenue?.lat ?? 60.17;
  const compassLon = selectedVenue?.lon ?? 24.94;

  return (
    <div className="app">
      <aside className={`sidebar${sheetOpen ? ' sheet-open' : ''}`}>
        <div className="sheet-handle" onClick={() => setSheetOpen(o => !o)} />

        <header className="sidebar-header">
          <h1 className="app-title">TerraceSun</h1>
          <p className="app-subtitle">Helsinki terrace sunlight finder</p>
        </header>

        <div className="sidebar-section">
          <DateTimePicker value={datetime} onChange={setDatetime} />
        </div>

        <div className="sidebar-section">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            count={filteredVenues.length}
            total={ALL_VENUES.length}
          />
        </div>

        <div className="sidebar-section">
          <FilterBar
            amenity={amenityFilter}
            cities={cityFilter}
            sunnyOnly={sunnyOnly}
            onAmenityChange={setAmenityFilter}
            onCitiesChange={setCityFilter}
            onSunnyOnlyChange={setSunnyOnly}
          />
        </div>

        {selectedVenue ? (
          <SunPanel
            key={selectedVenue.id}
            venue={selectedVenue}
            status={statusMap[selectedVenue.id] ?? 'unknown'}
            windows={panelWindows}
            datetime={datetime}
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

        <ul className="terrace-list">
          {displayList.map(venue => {
            const status: SunlightStatus = statusMap[venue.id] ?? 'unknown';
            const preWindows: SunlightWindow[] = precomputedReady
              ? getPrecomputedWindows(venue.id, datetime)
              : [];
            const endsAt = sunEndsIn(preWindows, datetime);
            const noSeating = venue.outdoor_seating === false;
            const unknownSeating = venue.outdoor_seating === null && !venue.isPin;

            return (
              <li
                key={venue.id}
                className={[
                  'terrace-item',
                  selectedVenue?.id === venue.id ? 'selected' : '',
                  noSeating ? 'no-seating' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleVenueSelect(venue)}
              >
                <span className={`status-dot status-${status}`} />
                <div className="terrace-info">
                  <div className="terrace-name">
                    {venue.isPin ? '📍 ' : ''}{venue.name}
                  </div>
                  <div className="terrace-address">{venue.address || venue.city}</div>
                  <div className="terrace-chips">
                    {noSeating && (
                      <span className="chip chip-no-seating">No terrace registered</span>
                    )}
                    {unknownSeating && !noSeating && (
                      <span className="chip chip-unknown-seating">Seating unknown</span>
                    )}
                    {endsAt && (
                      <span className="chip chip-sun-ending">☁ Sun ends {endsAt}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {venueList.length > MAX_LIST && (
            <li className="terrace-list-overflow">
              Showing {MAX_LIST} of {venueList.length} venues — use filters or search to narrow results.
            </li>
          )}
        </ul>
      </aside>

      <main className="map-container">
        <TerracesMap
          terraces={mapVenues}
          statusMap={statusMap}
          selectedId={selectedVenue?.id ?? null}
          onTerraceSelect={handleVenueSelect}
          customPin={customPin}
          onMapClick={handleMapClick}
        />
        <SunCompass datetime={datetime} lat={compassLat} lon={compassLon} />
      </main>
    </div>
  );
}
