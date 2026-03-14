interface SizeSelectorProps {
  label: string;
  selected: number[];
  onChange: (sizes: number[]) => void;
}

const ALL_SIZES = [2, 3, 4, 5, 6, 8, 10, 12, 16, 20];

export function SizeSelector({ label, selected, onChange }: SizeSelectorProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{label}</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALL_SIZES.map((size) => {
          const isOn = selected.includes(size);
          return (
            <button
              key={size}
              className={`rounded border px-2 py-1 text-xs ${isOn ? 'bg-slate-900 text-white' : 'bg-white'}`}
              onClick={() =>
                onChange(isOn ? selected.filter((value) => value !== size) : [...selected, size].sort((a, b) => a - b))
              }
              type="button"
            >
              {size}L
            </button>
          );
        })}
      </div>
    </div>
  );
}
