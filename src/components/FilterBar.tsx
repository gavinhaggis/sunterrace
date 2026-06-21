import type { Amenity, City } from '../types';

const AMENITY_OPTIONS: { value: '' | Amenity; label: string }[] = [
  { value: '',           label: 'All' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'pub',        label: 'Pub' },
  { value: 'bar',        label: 'Bar' },
  { value: 'cafe',       label: 'Café' },
];

const CITY_OPTIONS: City[] = ['Helsinki', 'Vantaa', 'Espoo'];

interface Props {
  amenity: '' | Amenity;
  cities: City[];
  sunnyOnly: boolean;
  onAmenityChange: (a: '' | Amenity) => void;
  onCitiesChange: (c: City[]) => void;
  onSunnyOnlyChange: (v: boolean) => void;
}

export function FilterBar({ amenity, cities, sunnyOnly, onAmenityChange, onCitiesChange, onSunnyOnlyChange }: Props) {
  function toggleCity(city: City) {
    onCitiesChange(
      cities.includes(city) ? cities.filter(c => c !== city) : [...cities, city],
    );
  }

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <button
          className={`filter-pill filter-pill-sun${sunnyOnly ? ' active' : ''}`}
          onClick={() => onSunnyOnlyChange(!sunnyOnly)}
        >
          ☀ Sunny now
        </button>
      </div>
      <div className="filter-row">
        {AMENITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`filter-pill${amenity === opt.value ? ' active' : ''}`}
            onClick={() => onAmenityChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="filter-row">
        {CITY_OPTIONS.map(city => (
          <button
            key={city}
            className={`filter-chip${cities.includes(city) ? ' active' : ''}`}
            onClick={() => toggleCity(city)}
          >
            {city}
          </button>
        ))}
      </div>
    </div>
  );
}
