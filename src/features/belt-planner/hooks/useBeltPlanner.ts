import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { entryLabel } from '../../belt-catalog/domain/catalog';
import { defaultIndent } from '../../belt-catalog/domain/flights';
import { BeltCatalogEntry, FlightSpec } from '../../belt-catalog/types';
import { planBelt } from '../domain/planner';
import {
  DEFAULT_FORM,
  normalizePlanTitle,
  PlannerFormState,
  previewConversions,
  restoreForm,
  SeriesSpec,
  validatePlannerForm
} from '../form/plannerForm';
import { PlannerInput, PlanResult, PusherEdgeMode } from '../types';
import { formatPlainNumber } from '../utils/format';

const STORAGE_KEY = 'calculadora-banda:formulario:v1';

/** Banda del catálogo con la que se calculó el plan (copia, por si luego se edita el catálogo). */
export interface PlanBelt {
  id: string;
  label: string;
  manufacturer: string;
  source: string;
}

export interface CalculatedPlan {
  input: PlannerInput;
  result: PlanResult;
  calculatedAt: Date;
  belt: PlanBelt | null;
}

export type FindCatalogEntry = (id: string | null) => BeltCatalogEntry | null;

function loadStoredForm(): PlannerFormState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? restoreForm(JSON.parse(stored)) : DEFAULT_FORM;
  } catch {
    return DEFAULT_FORM;
  }
}

function storeForm(form: PlannerFormState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    // Sin almacenamiento disponible (modo privado, bloqueado): el formulario sigue funcionando.
  }
}

function toSeriesSpec(entry: BeltCatalogEntry | null): SeriesSpec | null {
  return entry
    ? {
        label: entryLabel(entry),
        pitchInches: entry.pitchInches,
        linkIncrementInches: entry.linkIncrementInches,
        minWidthInches: entry.minWidthInches,
        maxWidthInches: entry.maxWidthInches,
        flights: entry.flights,
        bidirectional: entry.bidirectional
      }
    : null;
}

const indentText = (inches: number | null) => (inches === null ? '' : formatPlainNumber(inches, 4));

function toPlanBelt(entry: BeltCatalogEntry | null): PlanBelt | null {
  return entry ? { id: entry.id, label: entryLabel(entry), manufacturer: entry.manufacturer, source: entry.source } : null;
}

function calculate(input: PlannerInput, belt: PlanBelt | null): CalculatedPlan {
  return { input, result: planBelt(input), calculatedAt: new Date(), belt };
}

/**
 * Estado del planificador. El formulario se edita libremente y el plan solo se
 * recalcula al pedirlo (como en la versión validada), así las capturas a medias
 * no disparan cálculos pesados ni cambian el resultado mientras se escribe.
 */
export function useBeltPlanner(findCatalogEntry: FindCatalogEntry) {
  const [initial] = useState(() => {
    const form = loadStoredForm();
    const entry = findCatalogEntry(form.catalogEntryId);
    const { input } = validatePlannerForm(form, toSeriesSpec(entry));
    return { form, plan: input ? calculate(input, toPlanBelt(entry)) : null };
  });

  const [form, setForm] = useState<PlannerFormState>(initial.form);
  const [plan, setPlan] = useState<CalculatedPlan | null>(initial.plan);
  const [isCalculating, setIsCalculating] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const pendingTimer = useRef<number | null>(null);

  const selectedEntry = findCatalogEntry(form.catalogEntryId);
  const selectedFlight = selectedEntry?.flights.find((flight) => flight.id === form.flightId) ?? null;
  /** La banda elegida se eliminó del catálogo: se usan los valores que quedaron capturados. */
  const selectedEntryMissing = form.catalogEntryId !== null && selectedEntry === null;
  const series = useMemo(() => toSeriesSpec(selectedEntry), [selectedEntry]);
  const validation = useMemo(() => validatePlannerForm(form, series), [form, series]);
  const preview = useMemo(() => previewConversions(form, series), [form, series]);

  useEffect(() => storeForm(form), [form]);
  useEffect(() => () => {
    if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
  }, []);

  const updateForm = useCallback((patch: Partial<PlannerFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  /**
   * Elige una banda del catálogo (o null para captura manual). Copia pitch e incremento
   * a los campos y, si la banda tiene tamaños de módulo predefinidos, también los aplica.
   */
  const selectCatalogEntry = useCallback((entry: BeltCatalogEntry | null) => {
    setForm((current) => {
      // El empujador y sus indents son de la banda anterior: se limpian al cambiar de banda.
      const changed = (entry?.id ?? null) !== current.catalogEntryId;
      const flightReset = changed ? { flightId: null, flightHeightInches: '', pusherIndentInches: '', normalEdgeIndentInches: '' } : {};
      if (!entry) return { ...current, ...flightReset, catalogEntryId: null };
      return {
        ...current,
        ...flightReset,
        catalogEntryId: entry.id,
        pitchInches: formatPlainNumber(entry.pitchInches, 4),
        linkIncrementInches: formatPlainNumber(entry.linkIncrementInches, 4),
        ...(entry.modules
          ? {
              edgesNormal: [...entry.modules.edgesNormal],
              innerNormal: [...entry.modules.innerNormal],
              edgesPusher: [...entry.modules.edgesPusher],
              innerPusher: [...entry.modules.innerPusher]
            }
          : {})
      };
    });
  }, []);

  /**
   * Elige el empujador de la banda y propone su indent de orillas de empujador (el moldeado primero).
   * Se propone aunque la casilla esté desactivada, para que esté listo si se activa.
   * El indent deseado con orillas normales se conserva: es un requisito de la aplicación, no del empujador
   * (vacío, ya toma el mínimo del nuevo empujador).
   */
  const selectFlight = useCallback((flight: FlightSpec | null) => {
    setForm((current) => ({
      ...current,
      flightId: flight?.id ?? null,
      flightHeightInches: flight && flight.heightsInches.length === 1 ? formatPlainNumber(flight.heightsInches[0], 4) : '',
      pusherIndentInches: flight ? indentText(defaultIndent(flight, 'pusher')) : current.pusherIndentInches
    }));
  }, []);

  /**
   * Cambia entre orillas de empujador y orillas normales. Cada tipo de orilla tiene su propio indent y
   * ambos se conservan; si el de orillas de empujador está vacío y hay empujador elegido, se propone el del catálogo.
   */
  const setPusherEdgeMode = useCallback(
    (mode: PusherEdgeMode) => {
      setForm((current) => {
        const flight = selectedEntry?.flights.find((item) => item.id === current.flightId) ?? null;
        const proposeIndent = mode === 'pusher' && flight !== null && !current.pusherIndentInches.trim();
        return {
          ...current,
          pusherEdgeMode: mode,
          ...(proposeIndent ? { pusherIndentInches: indentText(defaultIndent(flight, 'pusher')) } : {})
        };
      });
    },
    [selectedEntry]
  );

  /** Devuelve false si el formulario tiene errores (y deja visibles los mensajes). */
  const runCalculation = useCallback((): boolean => {
    setSubmitAttempted(true);
    const input = validation.input;
    if (!input) return false;
    const belt = toPlanBelt(selectedEntry);
    setIsCalculating(true);
    // Se cede un cuadro al navegador para que pinte el estado "Calculando…" en planes grandes.
    pendingTimer.current = window.setTimeout(() => {
      pendingTimer.current = null;
      setPlan(calculate(input, belt));
      setIsCalculating(false);
    }, 0);
    return true;
  }, [validation.input, selectedEntry]);

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
    setSubmitAttempted(false);
  }, []);

  const isStale =
    plan !== null &&
    (JSON.stringify(validation.input) !== JSON.stringify(plan.input) || (selectedEntry?.id ?? null) !== (plan.belt?.id ?? null));

  return {
    form,
    /** Título del cálculo ya normalizado. Va en vivo: no forma parte del cálculo ni lo vuelve obsoleto. */
    planTitle: normalizePlanTitle(form.planTitle),
    updateForm,
    resetForm,
    selectedEntry,
    selectedEntryMissing,
    selectCatalogEntry,
    selectedFlight,
    selectFlight,
    setPusherEdgeMode,
    errors: validation.errors,
    preview,
    plan,
    runCalculation,
    isCalculating,
    isStale,
    submitAttempted
  };
}

export type BeltPlannerState = ReturnType<typeof useBeltPlanner>;
