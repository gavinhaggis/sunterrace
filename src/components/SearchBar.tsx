interface Props {
  value: string;
  onChange: (value: string) => void;
  count: number;
  total: number;
}

export function SearchBar({ value, onChange, count, total }: Props) {
  return (
    <div className="search-bar">
      <div className="search-input-wrap">
        <span className="search-icon">🔍</span>
        <input
          type="search"
          placeholder="Search venues…"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="search-input"
        />
        {value && (
          <button className="search-clear" onClick={() => onChange('')} aria-label="Clear">✕</button>
        )}
      </div>
      {value && (
        <div className="search-count">
          {count === 0 ? 'No results' : `${count} of ${total}`}
        </div>
      )}
    </div>
  );
}
