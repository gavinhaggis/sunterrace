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
    <input
      type="datetime-local"
      className="datetime-input"
      value={toLocalString(value)}
      onChange={e => onChange(new Date(e.target.value))}
      aria-label="Date and time"
    />
  );
}
