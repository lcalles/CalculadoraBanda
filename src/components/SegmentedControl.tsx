export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  name: string;
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Grupo de radios con aspecto de control segmentado: navegable con flechas y con foco visible. */
export function SegmentedControl<T extends string>({ name, legend, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded border border-line-strong bg-surface p-0.5">
        {options.map((option) => (
          <label key={option.value} className="min-w-0">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex h-8 cursor-pointer items-center justify-center rounded-[3px] px-2 text-center text-sm leading-tight text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-primary">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
