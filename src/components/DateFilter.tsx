import { FC } from 'react';
import { Calendar } from 'lucide-react';
import { DateRange, isFullRange } from '../lib/dateFilter';

interface DateFilterProps {
  range: DateRange;
  full: DateRange;
  onChange: (r: DateRange) => void;
}

// Soma dias a uma data ISO (YYYY-MM-DD), sem fuso.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const clamp = (iso: string, lo: string, hi: string) => (iso < lo ? lo : iso > hi ? hi : iso);

const inputCls =
  'bg-bg-base border border-bg-card-border rounded-lg px-3 py-1.5 text-sm text-white ' +
  '[color-scheme:dark] focus:outline-none focus:border-in-green';

export const DateFilter: FC<DateFilterProps> = ({ range, full, onChange }) => {
  // Presets calculados a partir do fim do período (hoje).
  const end = full.end;
  const presets: { label: string; range: DateRange }[] = [
    { label: 'Hoje', range: { start: end, end } },
    { label: 'Ontem', range: { start: clamp(addDays(end, -1), full.start, end), end: clamp(addDays(end, -1), full.start, end) } },
    { label: '7 dias', range: { start: clamp(addDays(end, -6), full.start, end), end } },
    { label: '14 dias', range: { start: clamp(addDays(end, -13), full.start, end), end } },
    { label: 'Todo período', range: full },
  ];

  const eq = (a: DateRange, b: DateRange) => a.start === b.start && a.end === b.end;
  const custom = !presets.some((p) => eq(p.range, range));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const active = eq(p.range, range) || (p.label === 'Todo período' && isFullRange(range, full));
          return (
            <button
              key={p.label}
              onClick={() => onChange(p.range)}
              className={
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-in-green text-black'
                  : 'bg-bg-card border border-bg-card-border text-gray-300 hover:bg-bg-card-hover')
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar className={'w-4 h-4 ' + (custom ? 'text-in-green' : 'text-gray-500')} />
          <span className="text-sm font-medium hidden sm:inline">Personalizado</span>
        </div>
        <input
          type="date"
          value={range.start}
          min={full.start}
          max={range.end}
          onChange={(e) => onChange({ ...range, start: e.target.value })}
          className={inputCls}
        />
        <span className="text-gray-500 text-sm">até</span>
        <input
          type="date"
          value={range.end}
          min={range.start}
          max={full.end}
          onChange={(e) => onChange({ ...range, end: e.target.value })}
          className={inputCls}
        />
      </div>
    </div>
  );
};
