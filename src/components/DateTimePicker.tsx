interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

function toLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimePicker({ value, onChange }: Props) {
  return (
    <div className="datetime-picker">
      <label htmlFor="datetime">Date &amp; time</label>
      <input
        id="datetime"
        type="datetime-local"
        value={toLocalString(value)}
        onChange={e => onChange(new Date(e.target.value))}
      />
    </div>
  );
}
