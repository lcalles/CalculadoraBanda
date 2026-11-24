import { parseDecimal } from '../../belt-planner/form/plannerForm';
import { formatPlainNumber } from '../../belt-planner/utils/format';
import { BeltCatalogEntry, BeltFamily, FlightSpec, ModulePreset } from '../types';
import { createEntryId, entryLabel } from './catalog';

/** Empujador en edición; las listas de números van como texto ("1, 2, 4"). */
export interface FlightDraft {
  key: string;
  name: string;
  heights: string;
  materials: string;
  minIndent: string;
  molded: string;
  notes: string;
  source: string;
}

let flightKeyCounter = 0;
const nextFlightKey = () => `empujador-${(flightKeyCounter += 1)}`;

const listText = (values: readonly number[]) => values.map((value) => formatPlainNumber(value, 4)).join(', ');

export function flightDraftFrom(flight: FlightSpec): FlightDraft {
  return {
    key: nextFlightKey(),
    name: flight.name,
    heights: listText(flight.heightsInches),
    materials: flight.materials,
    minIndent: flight.minIndentInches === null ? '' : formatPlainNumber(flight.minIndentInches, 4),
    molded: listText(flight.moldedIndentInches),
    notes: flight.notes,
    source: flight.source
  };
}

export function emptyFlightDraft(): FlightDraft {
  return { key: nextFlightKey(), name: '', heights: '', materials: '', minIndent: '', molded: '', notes: '', source: '' };
}

/** Lista de números positivos separados por comas, punto y coma o espacios. null si algún valor no es válido. */
export function parseNumberList(text: string): number[] | null {
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  const values = parts.map((part) => Number(part));
  if (values.some((value) => !(value > 0) || !Number.isFinite(value))) return null;
  return [...new Set(values)].sort((a, b) => a - b);
}

function slugId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Estado editable de una banda en el formulario del catálogo (números como texto). */
export interface EntryDraft {
  /** Id de la banda que se está editando; null si es nueva. */
  editingId: string | null;
  manufacturer: string;
  series: string;
  style: string;
  family: BeltFamily;
  pitchInches: string;
  linkIncrementInches: string;
  minWidthInches: string;
  maxWidthInches: string;
  hasModules: boolean;
  modules: ModulePreset;
  flights: FlightDraft[];
  /** false si la banda tiene sentido de marcha (orillas izquierda y derecha distintas). */
  bidirectional: boolean;
  notes: string;
  source: string;
  origin: BeltCatalogEntry['origin'];
}

export type DraftField =
  | 'series'
  | 'style'
  | 'pitchInches'
  | 'linkIncrementInches'
  | 'minWidthInches'
  | 'maxWidthInches'
  | 'modules'
  | 'flights';
export type DraftErrors = Partial<Record<DraftField, string>>;

const EMPTY_MODULES: ModulePreset = { edgesNormal: [], innerNormal: [], edgesPusher: [], innerPusher: [] };

const textOf = (value: number | null) => (value === null ? '' : formatPlainNumber(value, 4));

export function emptyDraft(partial: Partial<EntryDraft> = {}): EntryDraft {
  return {
    editingId: null,
    manufacturer: 'Intralox',
    series: '',
    style: '',
    family: 'recta',
    pitchInches: '',
    linkIncrementInches: '',
    minWidthInches: '',
    maxWidthInches: '',
    hasModules: false,
    modules: EMPTY_MODULES,
    flights: [],
    bidirectional: true,
    notes: '',
    source: '',
    origin: 'usuario',
    ...partial
  };
}

export function draftFromEntry(entry: BeltCatalogEntry): EntryDraft {
  return {
    editingId: entry.id,
    manufacturer: entry.manufacturer,
    series: entry.series,
    style: entry.style,
    family: entry.family,
    pitchInches: textOf(entry.pitchInches),
    linkIncrementInches: textOf(entry.linkIncrementInches),
    minWidthInches: textOf(entry.minWidthInches),
    maxWidthInches: textOf(entry.maxWidthInches),
    hasModules: entry.modules !== null,
    modules: entry.modules ?? EMPTY_MODULES,
    flights: entry.flights.map(flightDraftFrom),
    bidirectional: entry.bidirectional,
    notes: entry.notes,
    source: entry.source,
    origin: entry.origin
  };
}

/** Copia de una banda existente para crear una variante (no reemplaza a la original). */
export function duplicateDraft(entry: BeltCatalogEntry): EntryDraft {
  return { ...draftFromEntry(entry), editingId: null, style: `${entry.style} (copia)`, origin: 'usuario' };
}

/** Valida los empujadores; el primer problema encontrado se reporta en `errors.flights`. */
function validateFlights(drafts: readonly FlightDraft[], errors: DraftErrors): FlightSpec[] {
  const flights: FlightSpec[] = [];
  drafts.forEach((draft, index) => {
    if (errors.flights) return;
    const position = `Empujador ${index + 1}`;
    const name = draft.name.trim();
    const heights = parseNumberList(draft.heights);
    const molded = parseNumberList(draft.molded);
    const minIndent = draft.minIndent.trim() ? parseDecimal(draft.minIndent) : null;
    const id = slugId(name);
    if (!name) errors.flights = `${position}: escribe el nombre.`;
    else if (heights === null) errors.flights = `${position}: las alturas deben ser números separados por comas, p. ej. 1, 2, 4.`;
    else if (minIndent !== null && !(minIndent > 0)) errors.flights = `${position}: el indent mínimo debe ser mayor que 0 o quedar vacío.`;
    else if (molded === null) errors.flights = `${position}: los indents moldeados deben ser números separados por comas.`;
    else if (flights.some((flight) => flight.id === id)) errors.flights = `${position}: ya hay otro empujador con el nombre ${name}.`;
    else {
      flights.push({
        id,
        name,
        heightsInches: heights,
        materials: draft.materials.trim(),
        minIndentInches: minIndent,
        moldedIndentInches: molded,
        notes: draft.notes.trim(),
        source: draft.source.trim()
      });
    }
  });
  return flights;
}

function optionalPositive(text: string, errors: DraftErrors, field: DraftField, message: string): number | null {
  if (!text.trim()) return null;
  const value = parseDecimal(text);
  if (!(value > 0) || !Number.isFinite(value)) errors[field] = message;
  return value;
}

/** Valida el borrador. Devuelve la banda lista para guardar o los errores por campo. */
export function validateDraft(
  draft: EntryDraft,
  existing: readonly BeltCatalogEntry[]
): { entry: BeltCatalogEntry | null; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const manufacturer = draft.manufacturer.trim();
  const series = draft.series.trim();
  const style = draft.style.trim();
  if (!series) errors.series = 'Escribe la serie, por ejemplo S800.';
  if (!style) errors.style = 'Escribe el estilo, por ejemplo Flat Top.';

  const pitch = parseDecimal(draft.pitchInches);
  if (!(pitch > 0)) errors.pitchInches = 'Escribe el pitch en pulgadas, mayor que 0.';
  const increment = parseDecimal(draft.linkIncrementInches);
  if (!(increment > 0)) errors.linkIncrementInches = 'Escribe el incremento por link en pulgadas, mayor que 0.';
  const minWidth = optionalPositive(draft.minWidthInches, errors, 'minWidthInches', 'Deja vacío o escribe un ancho mayor que 0.');
  const maxWidth = optionalPositive(draft.maxWidthInches, errors, 'maxWidthInches', 'Deja vacío o escribe un ancho mayor que 0.');
  if (!errors.minWidthInches && !errors.maxWidthInches && minWidth !== null && maxWidth !== null && maxWidth < minWidth) {
    errors.maxWidthInches = 'El ancho máximo no puede ser menor que el mínimo.';
  }
  if (draft.hasModules && draft.modules.edgesNormal.length === 0) {
    errors.modules = 'Elige al menos un tamaño de orilla normal o desactiva los tamaños predefinidos.';
  }

  const id = createEntryId(manufacturer, series, style);
  if (series && style && existing.some((entry) => entry.id === id && entry.id !== draft.editingId)) {
    errors.style = `Ya existe la banda ${entryLabel({ series, style })}${manufacturer ? ` de ${manufacturer}` : ''}.`;
  }

  const flights = validateFlights(draft.flights, errors);

  if (Object.keys(errors).length > 0) return { entry: null, errors };

  return {
    errors,
    entry: {
      id,
      manufacturer,
      series,
      style,
      family: draft.family,
      pitchInches: pitch,
      linkIncrementInches: increment,
      minWidthInches: minWidth,
      maxWidthInches: maxWidth,
      modules: draft.hasModules ? { ...draft.modules } : null,
      flights,
      bidirectional: draft.bidirectional,
      notes: draft.notes.trim(),
      source: draft.source.trim(),
      origin: draft.origin
    }
  };
}
