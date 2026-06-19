import * as SunCalc from 'suncalc';
import type { SunlightWindow } from '../types';

interface Props {
  windows: SunlightWindow[];
  datetime: Date;
  lat: number;
  lon: number;
}

const W = 280;
const BAR_H = 32;
const LABEL_H = 16;
const SVG_H = BAR_H + LABEL_H + 2;

const CLR_NIGHT    = '#1e293b';
const CLR_DAY      = '#e2e8f0';
const CLR_SUNNY    = '#fbbf24';
const CLR_NOW      = '#ef4444';
const CLR_LABEL    = '#64748b';

function pct(d: Date): number {
  return (d.getHours() * 60 + d.getMinutes()) / (24 * 60);
}

function fmtLocal(d: Date): string {
  return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SunTimeline({ windows, datetime, lat, lon }: Props) {
  const date = new Date(Date.UTC(datetime.getFullYear(), datetime.getMonth(), datetime.getDate()));
  const times = SunCalc.getTimes(date, lat, lon);
  const sunrise = times.sunrise as Date | null;
  const sunset  = times.sunset  as Date | null;

  const risePct  = sunrise && !isNaN(sunrise.getTime()) ? pct(sunrise)  : 0;
  const setPct   = sunset  && !isNaN(sunset.getTime())  ? pct(sunset)   : 1;

  const nowPct = pct(datetime);
  const showNow = nowPct >= 0 && nowPct <= 1;

  const TICK_HOURS = [6, 12, 18];

  return (
    <div className="sun-timeline-wrap" aria-label="Daily sun timeline">
      <svg
        viewBox={`0 0 ${W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="sun-timeline-svg"
      >
        {/* Night background */}
        <rect x={0} y={0} width={W} height={BAR_H} fill={CLR_NIGHT} rx={4} />

        {/* Daylight band */}
        <rect
          x={risePct * W} y={0}
          width={(setPct - risePct) * W} height={BAR_H}
          fill={CLR_DAY}
        />

        {/* Sunny windows */}
        {windows.map((w, i) => {
          const x1 = pct(w.start) * W;
          const x2 = pct(w.end) * W;
          return (
            <rect
              key={i}
              x={x1} y={0}
              width={Math.max(x2 - x1, 2)} height={BAR_H}
              fill={CLR_SUNNY}
            />
          );
        })}

        {/* "Now" marker */}
        {showNow && (
          <>
            <line
              x1={nowPct * W} y1={0}
              x2={nowPct * W} y2={BAR_H}
              stroke={CLR_NOW} strokeWidth={2}
            />
            <circle cx={nowPct * W} cy={4} r={3} fill={CLR_NOW} />
          </>
        )}

        {/* Sunrise/sunset labels */}
        {sunrise && !isNaN(sunrise.getTime()) && (
          <text
            x={risePct * W} y={BAR_H + LABEL_H - 2}
            textAnchor="middle" fontSize={9} fill={CLR_LABEL}
          >
            {fmtLocal(sunrise)}
          </text>
        )}
        {sunset && !isNaN(sunset.getTime()) && (
          <text
            x={setPct * W} y={BAR_H + LABEL_H - 2}
            textAnchor="middle" fontSize={9} fill={CLR_LABEL}
          >
            {fmtLocal(sunset)}
          </text>
        )}

        {/* Fixed hour ticks */}
        {TICK_HOURS.map(h => {
          const x = (h / 24) * W;
          // Only draw if not too close to sunrise/sunset labels
          const tooClose = (
            (sunrise && !isNaN(sunrise.getTime()) && Math.abs(risePct * W - x) < 24) ||
            (sunset  && !isNaN(sunset.getTime())  && Math.abs(setPct  * W - x) < 24)
          );
          return (
            <g key={h}>
              <line x1={x} y1={BAR_H} x2={x} y2={BAR_H + 4} stroke={CLR_LABEL} strokeWidth={0.5} />
              {!tooClose && (
                <text x={x} y={BAR_H + LABEL_H - 2} textAnchor="middle" fontSize={9} fill={CLR_LABEL}>
                  {String(h).padStart(2, '0')}:00
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend row */}
      <div className="sun-timeline-legend">
        {windows.length > 0 ? (
          windows.map((w, i) => (
            <span key={i} className="sun-window-chip">
              {fmtLocal(w.start)} – {fmtLocal(w.end)}
            </span>
          ))
        ) : (
          <span className="sun-timeline-no-sun">No direct sun today</span>
        )}
      </div>
    </div>
  );
}
