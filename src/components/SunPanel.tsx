import { useState } from 'react';
import * as SunCalc from 'suncalc';
import type { Building, SunlightResult, SunlightWindow, Venue, SunlightStatus } from '../types';
import { SunDiagram } from './SunDiagram';
import { SunTimeline } from './SunTimeline';

interface Props {
  venue: Venue;
  status: SunlightStatus;       // precomputed — instant, always available
  windows: SunlightWindow[];    // precomputed windows for the timeline
  datetime: Date;
  // Diagram section — lazy, only populated after user opens the accordion
  onRequestDiagram: () => void;
  result: SunlightResult | null;
  buildings: Building[];
  diagramLoading: boolean;
  diagramError: string | null;
}

const LABELS: Record<SunlightStatus, { icon: string; text: string }> = {
  sunny:         { icon: '☀️', text: 'In direct sunlight' },
  blocked:       { icon: '🏢', text: 'Blocked by building' },
  below_horizon: { icon: '🌙', text: 'Sun below horizon' },
  unknown:       { icon: '?',  text: 'Unknown' },
};

export function SunPanel({
  venue, status, windows, datetime,
  onRequestDiagram, result, buildings, diagramLoading, diagramError,
}: Props) {
  const [showDiagram, setShowDiagram] = useState(false);

  // Solar position computed locally — no network call needed for alt/az display
  const pos    = SunCalc.getPosition(datetime, venue.lat, venue.lon);
  const altDeg = (pos.altitude as unknown as number).toFixed(1);
  const azDeg  = (pos.azimuth  as unknown as number).toFixed(1);

  // After Overpass loads, upgrade status to accurate result
  const displayStatus = (result?.reason as SunlightStatus | undefined) ?? status;
  const { icon, text } = LABELS[displayStatus];

  function handleToggleDiagram() {
    const next = !showDiagram;
    setShowDiagram(next);
    // Trigger Overpass fetch the first time the accordion is opened
    if (next && !result && !diagramLoading) onRequestDiagram();
  }

  return (
    <div className={`sun-panel ${displayStatus}`}>
      <div className="sun-panel-name">
        {venue.isPin ? '📍 ' : ''}{venue.name}
      </div>

      <div className="sun-panel-meta">
        {venue.outdoor_seating === true  && <span className="badge badge-terrace">Terrace</span>}
        {venue.outdoor_seating === false && <span className="badge badge-no-terrace">No terrace registered</span>}
        {venue.outdoor_seating === null  && <span className="badge badge-unknown">Terrace unknown</span>}
        <span className="badge badge-type">{venue.amenity}</span>
      </div>

      <div className="sun-panel-status">
        <span className="sun-icon">{icon}</span> {text}
      </div>

      <div className="sun-details">
        <span>Alt {altDeg}°</span>
        <span>Az {azDeg}°</span>
      </div>

      {/* Primary: timeline bar */}
      <div className="sun-timeline-section">
        <SunTimeline
          windows={windows}
          datetime={datetime}
          lat={venue.lat}
          lon={venue.lon}
        />
      </div>

      {/* Secondary: building cross-section — fetched on demand */}
      <button
        className="details-toggle"
        onClick={handleToggleDiagram}
        aria-expanded={showDiagram}
      >
        {showDiagram ? '▲ Hide diagram' : '▼ Show obstruction diagram'}
      </button>

      {showDiagram && (
        <div className="sun-diagram-wrap">
          {diagramLoading && (
            <div className="diagram-loading">Checking nearby buildings…</div>
          )}
          {diagramError && (
            <div className="diagram-error">⚠️ {diagramError}</div>
          )}
          {result && buildings.length > 0 && (
            <SunDiagram
              solar={{ azimuth: result.sunAzimuth, altitude: result.sunAltitude }}
              buildings={buildings}
              lat={venue.lat}
              lon={venue.lon}
            />
          )}
          {!diagramLoading && !diagramError && !result && (
            <div className="diagram-loading">No result yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
