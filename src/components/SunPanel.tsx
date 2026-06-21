import { useState } from 'react';
import * as SunCalc from 'suncalc';
import type { Building, SunlightResult, SunlightWindow, Venue, SunlightStatus } from '../types';
import { SunDiagram } from './SunDiagram';
import { SunTimeline } from './SunTimeline';

interface Props {
  venue: Venue;
  status: SunlightStatus;
  windows: SunlightWindow[];
  datetime: Date;
  shareUrl: string;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onClose: () => void;
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

function longestWindow(windows: SunlightWindow[]): SunlightWindow | null {
  if (!windows.length) return null;
  return windows.reduce((best, w) =>
    (w.end.getTime() - w.start.getTime()) > (best.end.getTime() - best.start.getTime()) ? w : best,
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDur(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return m === 0 ? `${h} h` : h === 0 ? `${m} min` : `${h} h ${m} min`;
}

export function SunPanel({
  venue, status, windows, datetime, shareUrl, isFavourite, onToggleFavourite,
  onClose, onRequestDiagram, result, buildings, diagramLoading, diagramError,
}: Props) {
  const [showDiagram, setShowDiagram] = useState(false);
  const [copied, setCopied] = useState(false);

  const pos    = SunCalc.getPosition(datetime, venue.lat, venue.lon);
  const altDeg = (pos.altitude as unknown as number).toFixed(1);
  const azDeg  = (pos.azimuth  as unknown as number).toFixed(1);

  const displayStatus = (result?.reason as SunlightStatus | undefined) ?? status;
  const { icon, text } = LABELS[displayStatus];

  const best    = longestWindow(windows);
  const bestDur = best ? fmtDur(best.end.getTime() - best.start.getTime()) : null;

  function handleToggleDiagram() {
    const next = !showDiagram;
    setShowDiagram(next);
    if (next && !result && !diagramLoading) onRequestDiagram();
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${venue.name} — SunTerrace`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* user cancelled */ }
  }

  return (
    <div className={`sun-panel ${displayStatus}`}>
      <div className="sun-panel-titlebar">
        <div className="sun-panel-name">
          {venue.isPin ? '📍 ' : ''}{venue.name}
        </div>
        <div className="sun-panel-actions">
          <button
            className={`sun-panel-btn${isFavourite ? ' fav-on' : ''}`}
            onClick={onToggleFavourite}
            title={isFavourite ? 'Remove favourite' : 'Save as favourite'}
            aria-pressed={isFavourite}
          >
            {isFavourite ? '★' : '☆'}
          </button>
          <button className="sun-panel-btn" onClick={handleShare} title="Share">
            {copied ? '✓' : '⬆'}
          </button>
          <button className="sun-panel-btn" onClick={onClose} title="Close" aria-label="Close panel">
            ✕
          </button>
        </div>
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
      {best && (
        <div className="best-window-row">
          ☀ Best sun: {fmtTime(best.start)}–{fmtTime(best.end)}
          <span className="best-window-dur">{bestDur}</span>
        </div>
      )}

      <div className="sun-timeline-section">
        <SunTimeline windows={windows} datetime={datetime} lat={venue.lat} lon={venue.lon} />
      </div>

      <button className="details-toggle" onClick={handleToggleDiagram} aria-expanded={showDiagram}>
        {showDiagram ? '▲ Hide diagram' : '▼ Show obstruction diagram'}
      </button>

      {showDiagram && (
        <div className="sun-diagram-wrap">
          {diagramLoading && <div className="diagram-loading">Checking nearby buildings…</div>}
          {diagramError  && <div className="diagram-error">⚠️ {diagramError}</div>}
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
