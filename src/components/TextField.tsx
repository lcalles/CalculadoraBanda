interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  showError?: boolean;
  placeholder?: string;
  multiline?: boolean;
  /** Recibe el foco al abrir el diálogo que lo contiene. */
  autoFocus?: boolean;
  maxLength?: number;
}

/** Campo de texto con etiqueta visible, ayuda y error conectados por aria-describedby. */
export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  showError = false,
  placeholder,
  multiline = false,
  autoFocus = false,
  maxLength
}: TextFieldProps) {
  const visibleError = showError ? error : undefined;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, visibleError ? errorId : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    placeholder,
    autoFocus,
    maxLength,
    'aria-invalid': visibleError ? true : undefined,
    'aria-describedby': describedBy,
    className: `field-input ${multiline ? 'h-auto min-h-[4.5rem] py-2' : ''}`
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} type="text" autoComplete="off" onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <p id={hintId} className="text-[13px] leading-snug text-ink-muted">
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
