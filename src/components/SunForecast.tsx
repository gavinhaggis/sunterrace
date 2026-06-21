import type { SunlightWindow } from '../types';

interface Props {
  windows: SunlightWindow[];
  datetime: Date;
  hoursAhead?: number;
}

const W = 60;
const H = 6;

export function SunForecast({ windows, datetime, hoursAhead = 6 }: Props) {
  const startMs = datetime.getTime();
  const endMs   = startMs + hoursAhead * 3_600_000;

  const segments = windows
    .filter(w => w.end.getTime() > startMs && w.start.getTime() < endMs)
    .map(w => ({
      x1: Math.max(0, ((w.start.getTime() - startMs) / (endMs - startMs)) * W),
      x2: Math.min(W, ((w.end.getTime()   - startMs) / (endMs - startMs)) * W),
    }));

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-label={`Sun in next ${hoursAhead} hours`}
      style={{ display: 'block', borderRadius: 2, flexShrink: 0 }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#e2e8f0" rx={2} />
      {segments.map((s, i) => (
        <rect key={i} x={s.x1} y={0} width={Math.max(s.x2 - s.x1, 1)} height={H} fill="#fbbf24" rx={1} />
      ))}
    </svg>
  );
}
