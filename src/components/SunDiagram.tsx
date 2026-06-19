import type { Building, SolarPosition } from '../types';
import { getObstructionData } from '../lib/obstruction';

interface Props {
  solar: SolarPosition;
  buildings: Building[];
  lat: number;
  lon: number;
}

const W = 260;
const H = 130;
const PAD_X = 16;
const HORIZON_Y = 110;
const SKY_H = HORIZON_Y - 8;           // pixels available above horizon
const MAX_ALT_DEG = 65;                 // max altitude shown
const DEG_TO_PX_Y = SKY_H / MAX_ALT_DEG;
const DEG_TO_PX_X = (W - PAD_X * 2) / 100; // ±50° range
const CENTER_X = W / 2;

function altToPx(alt: number) {
  return HORIZON_Y - Math.min(alt, MAX_ALT_DEG) * DEG_TO_PX_Y;
}
function bearingToPx(relBearing: number) {
  return CENTER_X + relBearing * DEG_TO_PX_X;
}

export function SunDiagram({ solar, buildings, lat, lon }: Props) {
  const diagramBuildings = getObstructionData(lat, lon, solar, buildings);
  const sunX = CENTER_X;
  const sunY = altToPx(solar.altitude);
  const aboveHorizon = solar.altitude > 0;

  // Altitude guide lines at 15°, 30°, 45°, 60°
  const guides = [15, 30, 45, 60].filter(a => a < MAX_ALT_DEG);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      aria-label="Sun position cross-section diagram"
      style={{ display: 'block' }}
    >
      {/* Sky */}
      <rect x={0} y={0} width={W} height={HORIZON_Y} fill={aboveHorizon ? '#e0f2fe' : '#1e293b'} />
      {/* Ground */}
      <rect x={0} y={HORIZON_Y} width={W} height={H - HORIZON_Y} fill="#d1fae5" />

      {/* Altitude guide lines */}
      {guides.map(a => (
        <g key={a}>
          <line
            x1={PAD_X} y1={altToPx(a)} x2={W - PAD_X} y2={altToPx(a)}
            stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3"
          />
          <text x={PAD_X + 2} y={altToPx(a) - 2} fontSize={8} fill="#94a3b8">{a}°</text>
        </g>
      ))}

      {/* Horizon line */}
      <line x1={0} y1={HORIZON_Y} x2={W} y2={HORIZON_Y} stroke="#64748b" strokeWidth={1} />

      {/* Buildings */}
      {diagramBuildings.map(b => {
        const bX = bearingToPx(b.relBearing);
        const bTopY = altToPx(b.apparentAngleDeg);
        const bW = 18;
        return (
          <rect
            key={b.id}
            x={bX - bW / 2}
            y={bTopY}
            width={bW}
            height={HORIZON_Y - bTopY}
            fill={b.isBlocking ? '#ef4444' : '#94a3b8'}
            opacity={0.75}
            rx={2}
          />
        );
      })}

      {/* Sun */}
      {aboveHorizon ? (
        <>
          <circle cx={sunX} cy={sunY} r={9} fill="#fde68a" />
          <circle cx={sunX} cy={sunY} r={6} fill="#fbbf24" />
          {/* Sun rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
            const rad = angle * Math.PI / 180;
            return (
              <line
                key={angle}
                x1={sunX + Math.cos(rad) * 10} y1={sunY + Math.sin(rad) * 10}
                x2={sunX + Math.cos(rad) * 14} y2={sunY + Math.sin(rad) * 14}
                stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round"
              />
            );
          })}
        </>
      ) : (
        // Moon / below-horizon indicator
        <text x={CENTER_X} y={HORIZON_Y - 8} textAnchor="middle" fontSize={16}>🌙</text>
      )}

      {/* Compass label showing the sun's azimuth direction */}
      <text x={CENTER_X} y={H - 2} textAnchor="middle" fontSize={9} fill="#475569">
        ↑ {compassLabel(solar.azimuth)} ({solar.azimuth.toFixed(0)}°)
      </text>

      {/* Legend */}
      {diagramBuildings.some(b => b.isBlocking) && (
        <g>
          <rect x={W - 70} y={4} width={8} height={8} fill="#ef4444" opacity={0.75} rx={1} />
          <text x={W - 58} y={12} fontSize={8} fill="#475569">blocking</text>
        </g>
      )}
    </svg>
  );
}

function compassLabel(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(az / 45) % 8];
}
