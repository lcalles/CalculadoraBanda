import { ReactNode, useState } from 'react';

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Unidad que se muestra dentro del campo, p. ej. "in" o "filas". */
  unit?: string;
  hint?: ReactNode;
  error?: string;
  /** Muestra el error aunque el campo no se haya visitado (después de intentar calcular). */
  forceShowError?: boolean;
  inputMode?: 'decimal' | 'numeric';
  /** Valor fijo que viene de otra fuente (p. ej. el catálogo); se ve distinto a un campo deshabilitado. */
  readOnly?: boolean;
  /** Control junto a la etiqueta, p. ej. el selector de unidad. */
  labelAside?: ReactNode;
  /** Valor que se aplica si el campo queda vacío (p. ej. el del catálogo). */
  placeholder?: string;
}

/**
 * Campo numérico como texto: acepta coma o punto decimal y capturas a medias.
 * El error aparece al salir del campo o después de intentar calcular, nunca mientras se escribe.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  forceShowError = false,
  inputMode = 'decimal',
  readOnly = false,
  labelAside,
  placeholder
}: NumberFieldProps) {
  const [touched, setTouched] = useState(false);
  const visibleError = touched || forceShowError ? error : undefined;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, visibleError ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {unit && <span className="sr-only"> ({unit})</span>}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          className={`field-input ${unit ? 'pr-12' : ''}`}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-invalid={visibleError ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        {unit && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="tabular text-[13px] leading-snug text-ink-muted">
          {hint}
        </p>
      )}
      {visibleError && (
        <p id={errorId} className="text-[13px] leading-snug text-alert">
          {visibleError}
        </p>
      )}
    </div>
  );
}
