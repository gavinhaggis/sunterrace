import { useState, useCallback, useRef } from 'react';
import type { Building, SunlightResult, SunlightWindow, Venue } from '../types';
import { getSolarPosition } from '../lib/solar';
import { fetchNearbyBuildings } from '../lib/buildings';
import { checkSunlight } from '../lib/obstruction';
import { getSunlightWindows } from '../lib/sunlightWindow';

export function useSunlight() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SunlightResult | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [windows, setWindows] = useState<SunlightWindow[]>([]);

  const lastWindowKeyRef = useRef('');

  const reset = useCallback(() => {
    setResult(null);
    setBuildings([]);
    setError(null);
    setLoading(false);
  }, []);

  const check = useCallback(async (venue: Venue, datetime: Date): Promise<SunlightResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const solar = getSolarPosition(venue.lat, venue.lon, datetime);
      const blds  = await fetchNearbyBuildings(venue.lat, venue.lon);
      setBuildings(blds);

      const res = checkSunlight(venue.lat, venue.lon, solar, blds);
      setResult(res);

      const windowKey = `${venue.id}|${datetime.toDateString()}`;
      if (windowKey !== lastWindowKeyRef.current) {
        lastWindowKeyRef.current = windowKey;
        setWindows(getSunlightWindows(venue.lat, venue.lon, datetime, blds));
      }

      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check sunlight');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { check, reset, loading, error, result, buildings, windows };
}
