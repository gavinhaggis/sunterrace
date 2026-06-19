import { useState } from 'react';
import type { Building, SunlightResult, SunlightWindow, Venue } from '../types';
import { SunDiagram } from './SunDiagram';
import { SunTimeline } from './SunTimeline';

interface Props {
  venue: Venue;
  result: SunlightResult | null;
  buildings: Building[];
  windows: SunlightWindow[];
  datetime: Date;
  loading: boolean;
  error: string | null;
}

const LABELS: Record<string, { icon: string; text: string }> = {
  sunny:         { icon: '☀️', text: 'In direct sunlight' },
  blocked:       { icon: '🏢', text: 'Blocked by building' },
  below_horizon: { icon: '🌙', text: 'Sun below horizon' },
};

export function SunPanel({ venue, result, buildings, windows, datetime, loading, error }: Props) {
  const [showDiagram, setShowDiagram] = useState(false);

  if (loading) {
    return (
      <div className="sun-panel loading">
        <div className="sun-panel-name">{venue.name}</div>
        <div className="sun-panel-status">Checking…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="sun-panel error">
        <div className="sun-panel-name">{venue.name}</div>
        <div className="sun-panel-status">⚠️ {error}</div>
      </div>
    );
  }
  if (!result) return null;

  const { icon, text } = LABELS[result.reason] ?? { icon: '?', text: result.reason };

  return (
    <div className={`sun-panel ${result.reason}`}>
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
        <span>Alt {result.sunAltitude.toFixed(1)}°</span>
        <span>Az {result.sunAzimuth.toFixed(1)}°</span>
      </div>

      {/* Primary: timeline */}
      <div className="sun-timeline-section">
        <SunTimeline
          windows={windows}
          datetime={datetime}
          lat={venue.lat}
          lon={venue.lon}
        />
      </div>

      {/* Secondary: geometric cross-section (accordion) */}
      <button
        className="details-toggle"
        onClick={() => setShowDiagram(v => !v)}
        aria-expanded={showDiagram}
      >
        {showDiagram ? '▲ Hide diagram' : '▼ Show obstruction diagram'}
      </button>

      {showDiagram && (
        <div className="sun-diagram-wrap">
          <SunDiagram
            solar={{ azimuth: result.sunAzimuth, altitude: result.sunAltitude }}
            buildings={buildings}
            lat={venue.lat}
            lon={venue.lon}
          />
        </div>
      )}
    </div>
  );
}
