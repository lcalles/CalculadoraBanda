import { FormEvent, ReactNode, useRef } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { NumberField } from '../../../components/NumberField';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { Switch } from '../../../components/Switch';
import { TextField } from '../../../components/TextField';
import { useFitToViewport } from '../../../hooks/useFitToViewport';
import { FormField, parseDecimal, PLAN_TITLE_MAX_LENGTH } from '../form/plannerForm';
import { BeltPlannerState } from '../hooks/useBeltPlanner';
import { resolvePusherSpacing } from '../domain/pushers';
import { inchesToLength, lengthToInches } from '../domain/units';
import { LengthUnit, PusherMode, RoundingMode } from '../types';
import { formatCount, formatInches, formatLength, formatPlainNumber, LENGTH_UNIT_NAMES } from '../utils/format';
import { BeltCatalogEntry } from '../../belt-catalog/types';
import { BeltSeriesSection } from './BeltSeriesSection';
import { LengthUnitToggle } from './LengthUnitToggle';
import { PARAMETERS_FORM_ID } from './formIds';
import { PusherModulesSection } from './PusherModulesSection';
import { SizeSelector } from './SizeSelector';

const ROUNDING_OPTIONS: { value: RoundingMode; label: string }[] = [
  { value: 'round', label: 'Más cercano' },
  { value: 'floor', label: 'Hacia abajo' },
  { value: 'ceil', label: 'Hacia arriba' }
];

const PUSHER_MODE_OPTIONS: { value: PusherMode; label: string }[] = [
  { value: 'rows', label: 'Por filas' },
  { value: 'distance', label: 'Por distancia' }
];

/** Id del elemento al que lleva cada error del resumen. */
const FIELD_IDS: Record<FormField, string> = {
  planTitle: 'campo-titulo',
  catalogEntryId: 'campo-banda',
  pitchInches: 'campo-pitch',
  linkIncrementInches: 'campo-incremento',
  widthInches: 'campo-ancho',
  lengthValue: 'campo-largo',
  lengthUnit: 'campo-unidad-largo',
  roundingMode: 'campo-redondeo',
  edgesNormal: 'campo-orillas-normales',
  innerNormal: 'campo-internos-normales',
  edgesPusher: 'campo-orillas-empujador',
  innerPusher: 'campo-internos-empujador',
  allowCutModules: 'campo-cortar-modulos',
  pusherEnabled: 'campo-empujadores',
  pusherMode: 'campo-modo-empujador',
  pusherStepRows: 'campo-paso-filas',
  pusherOffsetRows: 'campo-offset-filas',
  pusherStepInches: 'campo-paso-in',
  pusherOffsetInches: 'campo-offset-in',
  pusherEdgeMode: 'campo-tipo-orilla-empujador',
  flightId: 'campo-tipo-empujador',
  flightHeightInches: 'campo-altura-empujador',
  pusherIndentInches: 'campo-indent',
  normalEdgeIndentInches: 'campo-indent-orillas-normales'
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line px-4 py-4 first:border-t-0">
      <h2 className="font-display text-[17px] font-semibold leading-none">{title}</h2>
      {children}
    </section>
  );
}

interface ParametersPanelProps {
  planner: BeltPlannerState;
  catalogEntries: readonly BeltCatalogEntry[];
  onShowInCatalog: (entryId: string) => void;
  onSaveToCatalog: () => void;
}

export function ParametersPanel({ planner, catalogEntries, onShowInCatalog, onSaveToCatalog }: ParametersPanelProps) {
  const { form, updateForm, errors, preview, submitAttempted, isStale, isCalculating, plan } = planner;
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  // El panel es sticky en pantallas anchas: su alto se ajusta para que los botones de abajo siempre se vean.
  const formRef = useRef<HTMLFormElement>(null);
  useFitToViewport(formRef);
  const errorEntries = Object.entries(errors) as [FormField, string][];
  const showErrors = submitAttempted;
  const increment = planner.selectedEntry?.linkIncrementInches ?? parseDecimal(form.linkIncrementInches);
  const pitch = planner.selectedEntry?.pitchInches ?? parseDecimal(form.pitchInches);
  const incrementForLabels = increment > 0 ? increment : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const accepted = planner.runCalculation();
    if (!accepted) window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
  };

  const widthHint =
    preview.widthLinks !== null && preview.realWidthInches !== null
      ? `${formatInches(preview.realWidthInches)} reales (${formatCount(preview.widthLinks, 'link', 'links')})`
      : 'Se convierte a links con el incremento.';
  const lengthHint =
    preview.rowsCount !== null && preview.realLengthInches !== null
      ? `${formatCount(preview.rowsCount, 'fila', 'filas')}, ${formatLength(preview.realLengthInches, form.lengthUnit)} reales (${formatInches(preview.realLengthInches)})`
      : 'Se convierte a filas con el pitch.';

  /** Cambia la unidad del largo convirtiendo el valor, para que el largo físico no cambie. */
  const changeLengthUnit = (unit: LengthUnit) => {
    if (unit === form.lengthUnit) return;
    const value = parseDecimal(form.lengthValue);
    const converted = value > 0 ? formatPlainNumber(inchesToLength(lengthToInches(value, form.lengthUnit), unit), 4) : form.lengthValue;
    updateForm({ lengthUnit: unit, lengthValue: converted });
  };

  const pusherSpacingHint = (() => {
    const activeFieldsInvalid =
      form.pusherMode === 'rows'
        ? errors.pusherStepRows || errors.pusherOffsetRows
        : errors.pusherStepInches || errors.pusherOffsetInches;
    if (!(pitch > 0) || activeFieldsInvalid) return undefined;
    const spacing = resolvePusherSpacing(
      {
        enabled: true,
        mode: form.pusherMode,
        stepRows: parseDecimal(form.pusherStepRows),
        offsetRows: parseDecimal(form.pusherOffsetRows),
        stepInches: parseDecimal(form.pusherStepInches),
        offsetInches: parseDecimal(form.pusherOffsetInches)
      },
      pitch
    );
    return `Empujador en la fila ${spacing.offsetRows + 1} y luego cada ${formatCount(spacing.stepRows, 'fila', 'filas')} (${formatInches(spacing.stepInches)}).`;
  })();

  return (
    <form
      id={PARAMETERS_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      aria-label="Parámetros de la banda"
      ref={formRef}
      className="fit-viewport flex flex-col border border-line bg-surface"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showErrors && errorEntries.length > 0 && (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="resumen-errores"
            className="m-4 mb-0 border-l-4 border-alert bg-alert-soft px-3 py-2 text-sm"
          >
            <p id="resumen-errores" className="font-semibold">
              Corrige {errorEntries.length === 1 ? 'este dato' : `estos ${errorEntries.length} datos`} para calcular:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <a className="underline underline-offset-2" href={`#${FIELD_IDS[field]}`}>
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-4 pb-4 pt-4">
          <TextField
            id={FIELD_IDS.planTitle}
            label="Título del cálculo"
            value={form.planTitle}
            onChange={(planTitle) => updateForm({ planTitle })}
            placeholder="Ej. Banda para orden de venta 8926"
            maxLength={PLAN_TITLE_MAX_LENGTH}
            hint="Opcional. Sale en la hoja de armado, al imprimir y en los archivos exportados."
          />
        </div>

        <Section title="Banda">
          <BeltSeriesSection
            form={form}
            errors={errors}
            showErrors={showErrors}
            catalogEntries={catalogEntries}
            selectedEntry={planner.selectedEntry}
            selectedEntryMissing={planner.selectedEntryMissing}
            onSelect={planner.selectCatalogEntry}
            onChange={updateForm}
            onShowInCatalog={onShowInCatalog}
            onSaveToCatalog={onSaveToCatalog}
            pitchFieldId={FIELD_IDS.pitchInches}
            incrementFieldId={FIELD_IDS.linkIncrementInches}
          />
        </Section>

        <Section title="Medidas">
          <NumberField
            id={FIELD_IDS.widthInches}
            label="Ancho"
            unit="in"
            value={form.widthInches}
            onChange={(value) => updateForm({ widthInches: value })}
            error={errors.widthInches}
            forceShowError={showErrors}
            hint={widthHint}
          />
          <div id={FIELD_IDS.roundingMode}>
            <SegmentedControl
              name="redondeo"
              legend="Redondeo del ancho a links"
              options={ROUNDING_OPTIONS}
              value={form.roundingMode}
              onChange={(roundingMode) => updateForm({ roundingMode })}
            />
          </div>
          <NumberField
            id={FIELD_IDS.lengthValue}
            label="Largo"
            unit={LENGTH_UNIT_NAMES[form.lengthUnit].short}
            value={form.lengthValue}
            onChange={(value) => updateForm({ lengthValue: value })}
            error={errors.lengthValue}
            labelAside={<LengthUnitToggle id={FIELD_IDS.lengthUnit} value={form.lengthUnit} onChange={changeLengthUnit} />}
            forceShowError={showErrors}
            hint={lengthHint}
          />
        </Section>

        <Section title="Módulos normales">
          <SizeSelector
            id={FIELD_IDS.edgesNormal}
            label="Orillas"
            selected={form.edgesNormal}
            onChange={(edgesNormal) => updateForm({ edgesNormal })}
            linkIncrementInches={incrementForLabels}
            error={errors.edgesNormal}
            showError={showErrors}
          />
          <SizeSelector
            id={FIELD_IDS.innerNormal}
            label="Internos"
            selected={form.innerNormal}
            onChange={(innerNormal) => updateForm({ innerNormal })}
            linkIncrementInches={incrementForLabels}
          />
          <Switch
            id={FIELD_IDS.allowCutModules}
            checked={form.allowCutModules}
            onChange={(allowCutModules) => updateForm({ allowCutModules })}
            description="Un módulo elegido se corta a cualquier tamaño menor cuando hace falta. Aplica a orillas e internos, normales y de empujador; la lista de materiales dice de qué módulo sale cada pieza cortada."
          >
            Permitir cortar módulos
          </Switch>
        </Section>

        <Section title="Empujadores">
          <Switch
            id={FIELD_IDS.pusherEnabled}
            checked={form.pusherEnabled}
            onChange={(pusherEnabled) => updateForm({ pusherEnabled })}
            description="Flights o friction top, con su propio inventario de módulos."
          >
            Agregar filas con empujador
          </Switch>

          {form.pusherEnabled && (
            <>
              <div id={FIELD_IDS.pusherMode}>
                <SegmentedControl
                  name="modo-empujador"
                  legend="Separación"
                  options={PUSHER_MODE_OPTIONS}
                  value={form.pusherMode}
                  onChange={(pusherMode) => updateForm({ pusherMode })}
                />
              </div>
              {form.pusherMode === 'rows' ? (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id={FIELD_IDS.pusherStepRows}
                    label="Paso"
                    unit="filas"
                    inputMode="numeric"
                    value={form.pusherStepRows}
                    onChange={(value) => updateForm({ pusherStepRows: value })}
                    error={errors.pusherStepRows}
                    forceShowError={showErrors}
                  />
                  <NumberField
                    id={FIELD_IDS.pusherOffsetRows}
                    label="Offset"
                    unit="filas"
                    inputMode="numeric"
                    value={form.pusherOffsetRows}
                    onChange={(value) => updateForm({ pusherOffsetRows: value })}
                    error={errors.pusherOffsetRows}
                    forceShowError={showErrors}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id={FIELD_IDS.pusherStepInches}
                    label="Paso"
                    unit="in"
                    value={form.pusherStepInches}
                    onChange={(value) => updateForm({ pusherStepInches: value })}
                    error={errors.pusherStepInches}
                    forceShowError={showErrors}
                  />
                  <NumberField
                    id={FIELD_IDS.pusherOffsetInches}
                    label="Offset"
                    unit="in"
                    value={form.pusherOffsetInches}
                    onChange={(value) => updateForm({ pusherOffsetInches: value })}
                    error={errors.pusherOffsetInches}
                    forceShowError={showErrors}
                  />
                </div>
              )}
              {pusherSpacingHint && <p className="tabular text-[13px] text-ink-muted">{pusherSpacingHint}</p>}

              <PusherModulesSection
                form={form}
                errors={errors}
                showErrors={showErrors}
                selectedEntry={planner.selectedEntry}
                selectedFlight={planner.selectedFlight}
                linkIncrementInches={incrementForLabels}
                onChange={updateForm}
                onSelectFlight={planner.selectFlight}
                onEdgeModeChange={planner.setPusherEdgeMode}
                fieldIds={{
                  flight: FIELD_IDS.flightId,
                  height: FIELD_IDS.flightHeightInches,
                  edgeMode: FIELD_IDS.pusherEdgeMode,
                  indent: FIELD_IDS.pusherIndentInches,
                  normalEdgeIndent: FIELD_IDS.normalEdgeIndentInches,
                  edgesPusher: FIELD_IDS.edgesPusher,
                  innerPusher: FIELD_IDS.innerPusher
                }}
              />
            </>
          )}
        </Section>
      </div>

      <div className="space-y-2 border-t border-line bg-surface px-4 py-3">
        <p aria-live="polite" className="min-h-[1.25rem] text-[13px] text-ink-muted">
          {isCalculating ? 'Calculando…' : isStale ? 'Hay cambios sin calcular.' : plan ? 'El plan corresponde a estos parámetros.' : ''}
        </p>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary h-10 flex-1 text-[15px]" disabled={isCalculating}>
            <Calculator aria-hidden="true" size={18} />
            {isCalculating ? 'Calculando…' : 'Calcular plan'}
          </button>
          <button type="button" className="btn btn-secondary h-10" onClick={planner.resetForm} title="Volver a los valores iniciales">
            <RotateCcw aria-hidden="true" size={16} />
            <span className="sr-only sm:not-sr-only">Restablecer</span>
          </button>
        </div>
      </div>
    </form>
  );
}
