import { NumberField } from '../../../components/NumberField';
import { indentOptions } from '../../belt-catalog/domain/flights';
import { BeltCatalogEntry, FlightSpec } from '../../belt-catalog/types';
import { moduleSupply } from '../domain/cuts';
import { minimumLinksFor } from '../domain/units';
import { catalogMinimumIndent, FormErrors, parseDecimal, PlannerFormState, resolveNormalEdgeIndent } from '../form/plannerForm';
import { PusherEdgeMode } from '../types';
import { formatModuleSize, formatModuleSizeExact, formatPlainNumber } from '../utils/format';
import { SizeSelector } from './SizeSelector';

interface PusherModulesSectionProps {
  form: PlannerFormState;
  errors: FormErrors;
  showErrors: boolean;
  selectedEntry: BeltCatalogEntry | null;
  selectedFlight: FlightSpec | null;
  linkIncrementInches: number | null;
  onChange: (patch: Partial<PlannerFormState>) => void;
  onSelectFlight: (flight: FlightSpec | null) => void;
  onEdgeModeChange: (mode: PusherEdgeMode) => void;
  fieldIds: {
    flight: string;
    height: string;
    edgeMode: string;
    indent: string;
    normalEdgeIndent: string;
    edgesPusher: string;
    innerPusher: string;
  };
}

function flightSummary(flight: FlightSpec): string {
  const parts = [
    flight.heightsInches.length > 0 ? `Alturas ${flight.heightsInches.map((height) => formatPlainNumber(height)).join(', ')} in.` : null,
    flight.materials ? `${flight.materials}.` : null,
    flight.notes || null,
    flight.source || null
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * Empujador de la banda, tipo de orilla de las filas de empujador e indent de esas orillas.
 * El indent fija el tamaño mínimo de las orillas que se usan en esas filas. Cada tipo de orilla tiene su campo:
 * - orillas de empujador: indent de referencia (el catálogo propone el moldeado; vacío = sin límite);
 * - orillas normales: indent deseado, que se cumple exacto (vacío = mínimo sin sideguards del empujador elegido).
 */
export function PusherModulesSection({
  form,
  errors,
  showErrors,
  selectedEntry,
  selectedFlight,
  linkIncrementInches,
  onChange,
  onSelectFlight,
  onEdgeModeChange,
  fieldIds
}: PusherModulesSectionProps) {
  const flights = selectedEntry?.flights ?? [];
  const usesPusherEdges = form.pusherEdgeMode === 'pusher';
  const typedIndent = parseDecimal(form.pusherIndentInches);
  const catalogMinimum = catalogMinimumIndent(selectedFlight);
  const normalIndent = resolveNormalEdgeIndent(form.normalEdgeIndentInches, selectedFlight);
  const indent = usesPusherEdges ? (typedIndent > 0 ? typedIndent : null) : normalIndent.inches;
  const minEdgeLinks = indent !== null && linkIncrementInches ? minimumLinksFor(indent, linkIncrementInches) : null;
  const options = selectedFlight && usesPusherEdges ? indentOptions(selectedFlight, 'pusher') : [];
  const edgesFromIndent = minEdgeLinks !== null && linkIncrementInches ? `${formatModuleSizeExact(minEdgeLinks, linkIncrementInches)} o más` : null;

  const indentHint = (() => {
    if (edgesFromIndent) return `Las orillas de empujador serán de ${edgesFromIndent}.`;
    if (selectedFlight && options.length === 0) return 'El catálogo no indica indent para este empujador; consulta a Intralox o escríbelo.';
    return 'Vacío: no se limita el tamaño de las orillas.';
  })();

  const normalIndentHint = (() => {
    const edges = edgesFromIndent ? `en las filas de empujador, las orillas normales serán de ${edgesFromIndent}` : null;
    if (normalIndent.source === 'typed') {
      // El indent deseado se cumple exacto: ambas orillas de la fila de empujador son del tamaño que lo da.
      const belowCatalog = catalogMinimum !== null && normalIndent.inches! < catalogMinimum - 1e-9;
      // Con el corte activo, la orilla exacta también puede salir de cortar una orilla normal mayor.
      const edgeSupply = moduleSupply(form.edgesNormal, form.allowCutModules);
      const cutSource = minEdgeLinks !== null ? edgeSupply.cutFrom.get(minEdgeLinks) : undefined;
      const exactEdge =
        minEdgeLinks !== null && linkIncrementInches
          ? `${formatModuleSizeExact(minEdgeLinks, linkIncrementInches)}` +
            (cutSource !== undefined ? `, cortadas de ${formatModuleSize(cutSource, linkIncrementInches)}` : '')
          : null;
      const edgeMissing = minEdgeLinks !== null && !edgeSupply.sizes.includes(minEdgeLinks);
      return (
        <>
          {exactEdge
            ? `En las filas de empujador, ambas orillas normales serán de ${exactEdge}.`
            : 'En las filas de empujador, ambas orillas normales serán del tamaño que da este indent.'}
          {edgeMissing && (
            <span className="block text-alert">
              Elige la orilla normal de {formatModuleSize(minEdgeLinks!, linkIncrementInches)}
              {form.allowCutModules ? ' o una mayor para cortarla' : ''}: con las orillas elegidas
              no se puede dar este indent.
            </span>
          )}
          {belowCatalog && (
            <span className="block text-alert">
              Es menor que el mínimo sin sideguards de {selectedFlight!.name} ({formatPlainNumber(catalogMinimum)} in) que indica el catálogo.
            </span>
          )}
        </>
      );
    }
    if (normalIndent.source === 'catalog') {
      return `Vacío: se aplica el mínimo sin sideguards de ${selectedFlight!.name}, ${formatPlainNumber(catalogMinimum!)} in${edges ? `; ${edges}` : ''}.`;
    }
    if (selectedFlight) return `El catálogo no indica indent mínimo para ${selectedFlight.name}. Vacío: no se limitan las orillas normales.`;
    return 'Vacío: no se limitan las orillas normales en las filas de empujador.';
  })();

  return (
    <>
      {flights.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldIds.flight} className="text-sm font-medium">
            Tipo de empujador
          </label>
          <select
            id={fieldIds.flight}
            className="field-select"
            value={selectedFlight?.id ?? ''}
            onChange={(event) => onSelectFlight(flights.find((flight) => flight.id === event.target.value) ?? null)}
            aria-describedby={`${fieldIds.flight}-ayuda`}
          >
            <option value="">Sin especificar</option>
            {flights.map((flight) => (
              <option key={flight.id} value={flight.id}>
                {flight.name}
              </option>
            ))}
          </select>
          <p id={`${fieldIds.flight}-ayuda`} className="text-[13px] leading-snug text-ink-muted">
            {selectedFlight ? flightSummary(selectedFlight) : `${flights.length} empujadores en el catálogo para esta banda.`}
          </p>
        </div>
      ) : selectedEntry ? (
        <p className="text-[13px] leading-snug text-ink-muted">
          El catálogo no tiene empujadores para {selectedEntry.series} {selectedEntry.style}. Puedes agregarlos desde el catálogo o
          escribir el indent abajo.
        </p>
      ) : null}

      {selectedFlight && selectedFlight.heightsInches.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldIds.height} className="text-sm font-medium">
            Altura del empujador
          </label>
          <select
            id={fieldIds.height}
            className="field-select"
            value={form.flightHeightInches}
            onChange={(event) => onChange({ flightHeightInches: event.target.value })}
          >
            <option value="">Sin especificar</option>
            {selectedFlight.heightsInches.map((height) => (
              <option key={height} value={formatPlainNumber(height, 4)}>
                {formatPlainNumber(height)} in
              </option>
            ))}
          </select>
        </div>
      )}

      <div id={fieldIds.edgeMode} className="flex items-start gap-2.5">
        <input
          id={`${fieldIds.edgeMode}-casilla`}
          type="checkbox"
          checked={usesPusherEdges}
          onChange={(event) => onEdgeModeChange(event.target.checked ? 'pusher' : 'normal')}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--ink))]"
          aria-describedby={`${fieldIds.edgeMode}-ayuda`}
        />
        <label htmlFor={`${fieldIds.edgeMode}-casilla`} className="cursor-pointer">
          <span className="block text-sm font-medium">Usar orillas de empujador</span>
          <span id={`${fieldIds.edgeMode}-ayuda`} className="block text-[13px] leading-snug text-ink-muted">
            {usesPusherEdges
              ? 'La orilla de la fila es el propio módulo de empujador, con el indent integrado.'
              : 'La fila lleva las orillas normales de la banda y el empujador solo en los internos.'}
          </span>
        </label>
      </div>

      {usesPusherEdges ? (
        <>
          <div>
            <NumberField
              id={fieldIds.indent}
              label="Indent de referencia"
              unit="in"
              value={form.pusherIndentInches}
              onChange={(value) => onChange({ pusherIndentInches: value })}
              error={errors.pusherIndentInches}
              forceShowError={showErrors}
              hint={indentHint}
            />
            {options.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Indents del catálogo">
                {options.map((option) => {
                  const active = indent !== null && Math.abs(indent - option.inches) < 1e-9;
                  return (
                    <button
                      key={`${option.kind}-${option.inches}`}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ pusherIndentInches: formatPlainNumber(option.inches, 4) })}
                      className={`tabular h-7 cursor-pointer rounded border px-2 text-[13px] transition-colors duration-150 ${
                        active ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <SizeSelector
            id={fieldIds.edgesPusher}
            label="Orillas de empujador"
            selected={form.edgesPusher}
            onChange={(edgesPusher) => onChange({ edgesPusher })}
            linkIncrementInches={linkIncrementInches}
            minSize={minEdgeLinks}
            error={errors.edgesPusher}
            showError={showErrors}
          />
        </>
      ) : (
        <NumberField
          id={fieldIds.normalEdgeIndent}
          label="Indent deseado"
          unit="in"
          value={form.normalEdgeIndentInches}
          onChange={(value) => onChange({ normalEdgeIndentInches: value })}
          error={errors.normalEdgeIndentInches}
          forceShowError={showErrors}
          placeholder={catalogMinimum !== null ? formatPlainNumber(catalogMinimum) : undefined}
          hint={normalIndentHint}
        />
      )}
      <SizeSelector
        id={fieldIds.innerPusher}
        label="Internos de empujador"
        selected={form.innerPusher}
        onChange={(innerPusher) => onChange({ innerPusher })}
        linkIncrementInches={linkIncrementInches}
      />
      <button
        type="button"
        className="btn btn-quiet -ml-2 text-[13px]"
        onClick={() => onChange({ edgesPusher: [...form.edgesNormal], innerPusher: [...form.innerNormal] })}
      >
        Usar los mismos tamaños que los módulos normales
      </button>
    </>
  );
}
