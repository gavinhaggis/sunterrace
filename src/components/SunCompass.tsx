import * as SunCalc from 'suncalc';

interface Props {
  datetime: Date;
  lat: number;
  lon: number;
}

export function SunCompass({ datetime, lat, lon }: Props) {
  const pos = SunCalc.getPosition(datetime, lat, lon);
  const az  = pos.azimuth  as unknown as number; // degrees, 0=N
  const alt = pos.altitude as unknown as number; // degrees above horizon

  const below = alt <= 0;
  const SIZE = 68;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R  = 24;

  // Sun dot starts at the ring (alt=0) and moves toward center as sun rises
  const dotR  = below ? 0 : R * Math.max(0, 1 - alt / 90);
  const azRad = (az * Math.PI) / 180;
  const sunX  = cx + dotR * Math.sin(azRad);
  const sunY  = cy - dotR * Math.cos(azRad);

  return (
    <div className="sun-compass" aria-label={`Sun: azimuth ${az.toFixed(0)}°, altitude ${alt.toFixed(0)}°`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Compass ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d1d5db" strokeWidth="1.5" />

        {/* Cardinal ticks — N is bolder */}
        {([0, 90, 180, 270] as const).map(deg => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line key={deg}
              x1={cx + (R - 4) * Math.sin(rad)} y1={cy - (R - 4) * Math.cos(rad)}
              x2={cx + (R + 4) * Math.sin(rad)} y2={cy - (R + 4) * Math.cos(rad)}
              stroke={deg === 0 ? '#374151' : '#d1d5db'}
              strokeWidth={deg === 0 ? 2 : 1}
            />
          );
        })}

        {/* N label */}
        <text x={cx} y={5} textAnchor="middle" dominantBaseline="auto"
          fontSize="7" fontWeight="700" fill="#374151">N</text>

        {/* Sun dot or moon icon */}
        {below ? (
          <text x={cx} y={cy + 6} textAnchor="middle" fontSize="15">🌙</text>
        ) : (
          <circle cx={sunX} cy={sunY} r={5}
            fill="#fbbf24" stroke="white" strokeWidth="1.5" />
        )}
      </svg>

      <div className="sun-compass-alt">
        {below ? 'Below' : `${alt.toFixed(0)}°`}
      </div>
    </div>
  );
}
