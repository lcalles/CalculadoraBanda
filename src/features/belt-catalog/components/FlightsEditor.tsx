import { Plus, Trash2 } from 'lucide-react';
import { TextField } from '../../../components/TextField';
import { emptyFlightDraft, FlightDraft } from '../domain/entryDraft';

interface FlightsEditorProps {
  flights: readonly FlightDraft[];
  onChange: (flights: FlightDraft[]) => void;
  error?: string;
  showError: boolean;
}

/** Lista editable de empujadores de una banda. */
export function FlightsEditor({ flights, onChange, error, showError }: FlightsEditorProps) {
  const update = (key: string, patch: Partial<FlightDraft>) =>
    onChange(flights.map((flight) => (flight.key === key ? { ...flight, ...patch } : flight)));

  return (
    <div className="space-y-3">
      {flights.length === 0 && <p className="text-[13px] text-ink-muted">Sin empujadores. Agrégalos si esta banda lleva flights o friction top.</p>}
      {flights.map((flight, index) => (
        <div key={flight.key} className="space-y-3 border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Empujador {index + 1}</span>
            <button
              type="button"
              className="btn btn-quiet h-8 w-8 p-0 hover:text-alert"
              onClick={() => onChange(flights.filter((item) => item.key !== flight.key))}
              aria-label={`Quitar empujador ${index + 1}${flight.name ? `, ${flight.name}` : ''}`}
              title="Quitar"
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id={`${flight.key}-nombre`} label="Nombre" value={flight.name} placeholder="Streamline Flights" onChange={(name) => update(flight.key, { name })} />
            <TextField
              id={`${flight.key}-alturas`}
              label="Alturas (in)"
              value={flight.heights}
              placeholder="1, 2, 4"
              hint="Separadas por comas."
              onChange={(heights) => update(flight.key, { heights })}
            />
            <TextField
              id={`${flight.key}-indent`}
              label="Indent mínimo (in)"
              value={flight.minIndent}
              placeholder="1.3"
              hint="Con orillas normales. Vacío si el catálogo no lo indica."
              onChange={(minIndent) => update(flight.key, { minIndent })}
            />
            <TextField
              id={`${flight.key}-moldeado`}
              label="Indents moldeados (in)"
              value={flight.molded}
              placeholder="1.3, 2"
              hint="Con orillas de empujador. Separados por comas."
              onChange={(molded) => update(flight.key, { molded })}
            />
            <TextField id={`${flight.key}-materiales`} label="Materiales" value={flight.materials} onChange={(materials) => update(flight.key, { materials })} />
            <TextField id={`${flight.key}-fuente`} label="Fuente" value={flight.source} onChange={(source) => update(flight.key, { source })} />
          </div>
          <TextField id={`${flight.key}-notas`} label="Notas" value={flight.notes} onChange={(notes) => update(flight.key, { notes })} />
        </div>
      ))}
      {showError && error && <p className="text-[13px] text-alert">{error}</p>}
      <button type="button" className="btn btn-secondary h-8 px-2 text-[13px]" onClick={() => onChange([...flights, emptyFlightDraft()])}>
        <Plus aria-hidden="true" size={15} />
        Agregar empujador
      </button>
    </div>
  );
}
