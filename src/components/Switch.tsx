import { ReactNode } from 'react';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  description?: string;
}

/** Interruptor accesible (checkbox con role="switch"). */
export function Switch({ id, checked, onChange, children, description }: SwitchProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{children}</span>
        {description && <span className="block text-[13px] text-ink-muted">{description}</span>}
      </label>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-line-strong bg-sunken transition-colors duration-150 checked:border-ink checked:bg-ink"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-surface shadow-sm ring-1 ring-line-strong transition-transform duration-150 peer-checked:translate-x-5 peer-checked:ring-ink"
        />
      </span>
    </div>
  );
}
