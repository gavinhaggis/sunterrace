export type Amenity = 'pub' | 'bar' | 'cafe' | 'restaurant';
export type City = 'Helsinki' | 'Vantaa' | 'Espoo' | 'Other';
export type SunlightStatus = 'sunny' | 'blocked' | 'below_horizon' | 'unknown';

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  amenity: Amenity;
  outdoor_seating: boolean | null;
  city: City;
  isPin?: boolean;
}

export interface SolarPosition {
  azimuth: number;  // degrees, 0=N, 90=E, 180=S, 270=W
  altitude: number; // degrees above horizon
}

export interface Building {
  id: string;
  height: number;
  polygon: [number, number][]; // [lon, lat] pairs (GeoJSON order)
}

export interface SunlightResult {
  sunny: boolean;
  sunAltitude: number;
  sunAzimuth: number;
  blockingBuildingId: string | null;
  reason: 'sunny' | 'blocked' | 'below_horizon';
}

export interface SunlightWindow {
  start: Date;
  end: Date;
}

// Serialisable form stored in precomputed.json (HH:MM strings to keep JSON compact)
export interface SunlightWindowRaw {
  s: string; // "HH:MM"
  e: string; // "HH:MM"
}

// precomputed.json shape: venueId → weekKey ("2025-W01") → windows
export type PrecomputedData = Record<string, Record<string, SunlightWindowRaw[]>>;

// Building silhouette data used by SunDiagram
export interface DiagramBuilding {
  id: string;
  relBearing: number;       // degrees relative to sun azimuth (negative = left of sun)
  apparentAngleDeg: number; // height in degrees above horizon
  isBlocking: boolean;
}
