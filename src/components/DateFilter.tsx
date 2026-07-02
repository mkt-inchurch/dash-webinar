import { FC } from 'react';
import { Calendar, X } from 'lucide-react';
import { DateRange, isFullRange } from '../lib/dateFilter';

interface DateFilterProps {
  range: DateRange;
  full: DateRange;
  onChange: (r: DateRange) => void;
}

const inputCls =
  'bg-bg-card border border-bg-card-border rounded-lg px-3 py-1.5 text-sm text-white ' +
  '[color-scheme:dark] focus:outline-none focus:border-in-green';

export const DateFilter: FC<DateFilterProps> = ({ range, full, onChange }) => {
  const filtered = !isFullRange(range, full);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2 text-gray-400">
        <Calendar className="w-4 h-4 text-in-green" />
        <span className="text-sm font-medium hidden sm:inline">Período</span>
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

      {filtered && (
        <button
          onClick={() => onChange(full)}
          className="flex items-center gap-1 text-sm text-in-green hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-bg-card-hover"
        >
          <X className="w-3.5 h-3.5" />
          Todo o período
        </button>
      )}
    </div>
  );
};
