import { LengthUnit } from '../types';
import { LENGTH_UNIT_NAMES } from '../utils/format';

const UNITS: LengthUnit[] = ['ft', 'm'];

interface LengthUnitToggleProps {
  id: string;
  value: LengthUnit;
  onChange: (unit: LengthUnit) => void;
}

/** Selector compacto de unidad del largo (pies o metros). */
export function LengthUnitToggle({ id, value, onChange }: LengthUnitToggleProps) {
  return (
    <div id={id} role="group" aria-label="Unidad del largo" className="inline-flex rounded border border-line-strong bg-surface p-0.5">
      {UNITS.map((unit) => {
        const active = unit === value;
        return (
          <button
            key={unit}
            type="button"
            aria-pressed={active}
            title={LENGTH_UNIT_NAMES[unit].long}
            onClick={() => onChange(unit)}
            className={`h-6 min-w-[2.25rem] cursor-pointer rounded-[3px] px-2 text-[13px] transition-colors duration-150 ${
              active ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-sunken hover:text-ink'
            }`}
          >
            {LENGTH_UNIT_NAMES[unit].short}
          </button>
        );
      })}
    </div>
  );
}
