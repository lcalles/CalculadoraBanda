import { availableModuleSizes } from '../domain/moduleSizes';

interface SizeSelectorProps {
  id: string;
  label: string;
  selected: readonly number[];
  onChange: (sizes: number[]) => void;
  /** Para mostrar la equivalencia en pulgadas de cada tamaño y decidir hasta qué tamaño se ofrece. */
  linkIncrementInches: number | null;
  /** Tamaños que se ofrecen. Por defecto, del 2L al máximo que permite el incremento (ver `availableModuleSizes`). */
  sizes?: readonly number[];
  /** Tamaños menores no se usan (p. ej. por el indent): se marcan y no se pueden agregar. */
  minSize?: number | null;
  error?: string;
  showError?: boolean;
}

/**
 * Selección de tamaños de módulo (en links) con botones de alternar.
 * Los tamaños elegidos fuera del rango ofrecido (p. ej. un 36L que quedó al cambiar a una banda de
 * incremento mayor) se siguen mostrando y se avisan: entran al cálculo, así que no deben quedar ocultos.
 */
export function SizeSelector({
  id,
  label,
  selected,
  onChange,
  linkIncrementInches,
  sizes,
  minSize = null,
  error,
  showError = false
}: SizeSelectorProps) {
  const labelId = `${id}-label`;
  const summaryId = `${id}-summary`;
  const errorId = `${id}-error`;
  const visibleError = showError ? error : undefined;
  const offeredSizes = sizes ?? availableModuleSizes(linkIncrementInches);
  const outOfRangeSelected = selected.filter((size) => !offeredSizes.includes(size));
  const shownSizes = [...offeredSizes, ...outOfRangeSelected].sort((a, b) => a - b);
  const isBelowMin = (size: number) => minSize !== null && size < minSize;
  const usableSizes = offeredSizes.filter((size) => !isBelowMin(size));
  const excludedSelected = selected.filter(isBelowMin);

  const toggle = (size: number) => {
    const next = selected.includes(size) ? selected.filter((value) => value !== size) : [...selected, size];
    onChange(next.sort((a, b) => a - b));
  };

  const sizeList = (list: readonly number[]) => list.map((size) => `${size}L`).join(', ');
  const summary = [
    selected.length === 0
      ? 'Ningún tamaño seleccionado.'
      : `${selected.length === 1 ? '1 tamaño' : `${selected.length} tamaños`}: ${sizeList(selected)}.`,
    excludedSelected.length > 0
      ? `No se usan por ser menores a ${minSize}L: ${sizeList(excludedSelected)}.`
      : minSize !== null
        ? `Mínimo ${minSize}L por el indent.`
        : null,
    outOfRangeSelected.length > 0
      ? `Fuera del rango para este incremento (hasta ${offeredSizes[offeredSizes.length - 1]}L), pero se usan: ${sizeList(outOfRangeSelected)}.`
      : null
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={[summaryId, visibleError ? errorId : null].filter(Boolean).join(' ')}
      tabIndex={-1}
      className="min-w-0 outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-sm font-medium">
          {label}
        </span>
        <span className="flex">
          <button type="button" className="btn btn-quiet text-[13px]" onClick={() => onChange([...usableSizes])}>
            Todos
          </button>
          <button type="button" className="btn btn-quiet text-[13px]" onClick={() => onChange([])}>
            Ninguno
          </button>
        </span>
      </div>
      <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(2.6rem,1fr))] gap-1">
        {shownSizes.map((size) => {
          const isSelected = selected.includes(size);
          const belowMin = isBelowMin(size);
          const outOfRange = !offeredSizes.includes(size);
          const inches = linkIncrementInches ? ` = ${(size * linkIncrementInches).toFixed(3)} in` : '';
          const stateClass = belowMin
            ? isSelected
              ? 'border-dashed border-alert bg-alert-soft text-alert line-through'
              : 'cursor-not-allowed border-dashed border-line bg-sunken text-ink-muted/60'
            : isSelected
              ? `${outOfRange ? 'border-dashed border-alert' : 'border-ink'} bg-ink text-surface hover:bg-ink/85`
              : 'border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink';
          const title = belowMin
            ? `${size}L${inches}: menor al mínimo de ${minSize}L, no se usa`
            : outOfRange
              ? `${size}L${inches}: fuera del rango para este incremento; quítalo si no se usa`
              : `${size}L${inches}`;
          return (
            <button
              key={size}
              type="button"
              aria-pressed={isSelected}
              disabled={belowMin && !isSelected}
              title={title}
              onClick={() => toggle(size)}
              className={`tabular h-8 cursor-pointer rounded border text-sm font-medium transition-colors duration-150 ${stateClass}`}
            >
              {size}
              <span className="text-[11px] font-normal">L</span>
            </button>
          );
        })}
      </div>
      <p id={summaryId} className="mt-1 text-[13px] text-ink-muted">
        {summary}
      </p>
      {visibleError && (
        <p id={errorId} className="text-[13px] text-alert">
          {visibleError}
        </p>
      )}
    </div>
  );
}
