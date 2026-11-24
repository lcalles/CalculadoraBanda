import { MAX_ROWS, MAX_WIDTH_LINKS } from '../domain/constants';
import { moduleSupply } from '../domain/cuts';
import { calculateRows, inchesToLength, lengthToInches, minimumLinksFor, referenceWidthInLinks, roundLinks } from '../domain/units';
import { IndentFit, LengthUnit, PlannerInput, PusherEdgeMode, PusherMode, RoundingMode } from '../types';
import { formatInches, formatPlainNumber, LENGTH_UNIT_NAMES } from '../utils/format';

/**
 * Datos de serie que impone una banda del catálogo. Cuando hay una banda elegida,
 * pitch e incremento salen de aquí y el ancho se valida contra su mínimo y máximo.
 */
export interface SeriesSpec {
  label: string;
  pitchInches: number;
  linkIncrementInches: number;
  minWidthInches: number | null;
  maxWidthInches: number | null;
  /**
   * Empujadores de la banda: dan nombre al empujador elegido y, con orillas normales en las filas
   * de empujador y sin indent escrito, su indent mínimo sin sideguards limita esas orillas.
   */
  flights?: readonly { id: string; name: string; minIndentInches?: number | null }[];
  /** Orilla izquierda y derecha son la misma pieza. */
  bidirectional?: boolean;
}

/**
 * Estado editable del formulario. Los campos numéricos se guardan como texto para
 * permitir capturas intermedias ("0.", "24,5") sin perder lo que el usuario escribe.
 */
export interface PlannerFormState {
  /**
   * Título libre del cálculo ("Banda para orden de venta 8926"). Solo identifica el plan:
   * no entra al cálculo, así que cambiarlo no obliga a recalcular.
   */
  planTitle: string;
  /** Banda del catálogo elegida; null = pitch e incremento capturados a mano. */
  catalogEntryId: string | null;
  pitchInches: string;
  linkIncrementInches: string;
  widthInches: string;
  /** Largo en la unidad elegida (pies o metros). */
  lengthValue: string;
  lengthUnit: LengthUnit;
  roundingMode: RoundingMode;
  edgesNormal: number[];
  innerNormal: number[];
  edgesPusher: number[];
  innerPusher: number[];
  /** Los módulos elegidos se pueden cortar a cualquier tamaño menor (orillas e internos, normales y de empujador). */
  allowCutModules: boolean;
  pusherEnabled: boolean;
  pusherMode: PusherMode;
  pusherStepRows: string;
  pusherOffsetRows: string;
  pusherStepInches: string;
  pusherOffsetInches: string;
  /** 'pusher': la orilla de la fila es el propio módulo de empujador. 'normal': orillas normales en esas filas. */
  pusherEdgeMode: PusherEdgeMode;
  /** Empujador elegido de la banda del catálogo (null = sin especificar). */
  flightId: string | null;
  /** Altura del empujador en pulgadas ('' = sin especificar). */
  flightHeightInches: string;
  /**
   * Indent de referencia de las orillas de empujador, en pulgadas ('' = sin restricción).
   * Solo se aplica con orillas de empujador.
   */
  pusherIndentInches: string;
  /**
   * Indent deseado cuando las filas de empujador llevan orillas normales, en pulgadas.
   * '' = se aplica el indent mínimo sin sideguards del empujador elegido (sin restricción si no hay uno).
   * Solo se aplica con orillas normales.
   */
  normalEdgeIndentInches: string;
}

export type FormField = keyof PlannerFormState;
export type FormErrors = Partial<Record<FormField, string>>;

export const PLAN_TITLE_MAX_LENGTH = 120;

/** Título listo para mostrar y exportar: sin espacios de sobra y con el largo máximo. */
export function normalizePlanTitle(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, PLAN_TITLE_MAX_LENGTH).trim();
}

export const DEFAULT_FORM: PlannerFormState = {
  planTitle: '',
  catalogEntryId: null,
  pitchInches: '1',
  linkIncrementInches: '0.5',
  widthInches: '24',
  lengthValue: '5',
  lengthUnit: 'ft',
  roundingMode: 'round',
  edgesNormal: [2, 3],
  innerNormal: [4, 6, 8],
  edgesPusher: [2, 3],
  innerPusher: [4, 6],
  allowCutModules: false,
  pusherEnabled: true,
  pusherMode: 'rows',
  pusherStepRows: '4',
  pusherOffsetRows: '0',
  pusherStepInches: '6',
  pusherOffsetInches: '0',
  pusherEdgeMode: 'pusher',
  flightId: null,
  flightHeightInches: '',
  pusherIndentInches: '',
  normalEdgeIndentInches: ''
};

const DECIMAL_PATTERN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

/** Acepta punto o coma decimal. Devuelve NaN si el texto no es un número completo. */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(',', '.'));
}

function positiveNumber(text: string, errors: FormErrors, field: FormField, message: string): number {
  const value = parseDecimal(text);
  if (!(value > 0) || !Number.isFinite(value)) errors[field] = message;
  return value;
}

function nonNegativeNumber(text: string, errors: FormErrors, field: FormField, message: string): number {
  const value = parseDecimal(text);
  if (!(value >= 0) || !Number.isFinite(value)) errors[field] = message;
  return value;
}

function integerAtLeast(text: string, minimum: number, errors: FormErrors, field: FormField, message: string): number {
  const value = parseDecimal(text);
  if (!Number.isInteger(value) || value < minimum) errors[field] = message;
  return value;
}

export interface ConversionPreview {
  widthLinks: number | null;
  realWidthInches: number | null;
  rowsCount: number | null;
  realLengthInches: number | null;
}

/** Texto de pitch e incremento efectivos: los de la banda del catálogo si hay una elegida. */
export function seriesValues(form: PlannerFormState, series: SeriesSpec | null): { pitch: string; increment: string } {
  return series
    ? { pitch: formatPlainNumber(series.pitchInches, 4), increment: formatPlainNumber(series.linkIncrementInches, 4) }
    : { pitch: form.pitchInches, increment: form.linkIncrementInches };
}

/** Conversión en vivo de ancho → links y largo → filas, para mostrarla junto a los campos. */
export function previewConversions(form: PlannerFormState, series: SeriesSpec | null = null): ConversionPreview {
  const values = seriesValues(form, series);
  const increment = parseDecimal(values.increment);
  const width = parseDecimal(form.widthInches);
  const pitch = parseDecimal(values.pitch);
  const lengthValue = parseDecimal(form.lengthValue);
  const length = lengthValue > 0 ? lengthToInches(lengthValue, form.lengthUnit) : Number.NaN;
  const widthLinks = increment > 0 && width > 0 ? roundLinks(width, increment, form.roundingMode) : null;
  const rowsCount = pitch > 0 && length > 0 ? calculateRows(length, pitch) : null;
  return {
    widthLinks,
    realWidthInches: widthLinks !== null ? widthLinks * increment : null,
    rowsCount,
    realLengthInches: rowsCount !== null ? rowsCount * pitch : null
  };
}

export interface FormValidation {
  input: PlannerInput | null;
  errors: FormErrors;
}

/**
 * Valida el formulario y, si todo es correcto, produce la entrada del planificador.
 * Con una banda del catálogo, pitch e incremento salen de la banda y el ancho debe
 * quedar entre su mínimo y su máximo (comparados en links).
 */
export function validatePlannerForm(form: PlannerFormState, series: SeriesSpec | null = null): FormValidation {
  const errors: FormErrors = {};
  const values = seriesValues(form, series);

  const pitchInches = positiveNumber(values.pitch, errors, 'pitchInches', 'Escribe el pitch en pulgadas, mayor que 0.');
  const linkIncrementInches = positiveNumber(
    values.increment,
    errors,
    'linkIncrementInches',
    'Escribe el incremento por link en pulgadas, mayor que 0.'
  );
  const widthInches = positiveNumber(form.widthInches, errors, 'widthInches', 'Escribe el ancho en pulgadas, mayor que 0.');
  const lengthValue = positiveNumber(
    form.lengthValue,
    errors,
    'lengthValue',
    `Escribe el largo en ${LENGTH_UNIT_NAMES[form.lengthUnit].long}, mayor que 0.`
  );
  const lengthInches = lengthToInches(lengthValue, form.lengthUnit);

  if (!errors.widthInches && !errors.linkIncrementInches) {
    const links = roundLinks(widthInches, linkIncrementInches, form.roundingMode);
    const minLinks = series?.minWidthInches ? referenceWidthInLinks(series.minWidthInches, linkIncrementInches) : null;
    const maxLinks = series?.maxWidthInches ? referenceWidthInLinks(series.maxWidthInches, linkIncrementInches) : null;
    if (links < 1) errors.widthInches = 'Con este incremento y redondeo el ancho queda en 0 links. Aumenta el ancho o usa redondeo hacia arriba.';
    else if (links > MAX_WIDTH_LINKS) errors.widthInches = `El ancho equivale a ${links} links; el máximo que se calcula es ${MAX_WIDTH_LINKS}.`;
    else if (series && minLinks !== null && links < minLinks) {
      errors.widthInches = `La ${series.label} tiene un ancho mínimo de ${formatPlainNumber(series.minWidthInches!)} in (${minLinks} links); este ancho queda en ${links} links.`;
    } else if (series && maxLinks !== null && links > maxLinks) {
      errors.widthInches = `La ${series.label} tiene un ancho máximo de ${formatPlainNumber(series.maxWidthInches!)} in (${maxLinks} links); este ancho queda en ${links} links.`;
    }
  }
  if (!errors.lengthValue && !errors.pitchInches) {
    const rows = calculateRows(lengthInches, pitchInches);
    if (rows > MAX_ROWS) errors.lengthValue = `El largo equivale a ${rows} filas; el máximo que se calcula es ${MAX_ROWS}.`;
  }

  if (form.edgesNormal.length === 0) errors.edgesNormal = 'Elige al menos un tamaño de orilla.';

  const flight = series?.flights?.find((item) => item.id === form.flightId) ?? null;
  let edgeIndentInches: number | null = null;
  let edgeIndentFit: IndentFit = 'minimum';
  let stepRows = parseDecimal(form.pusherStepRows);
  let offsetRows = parseDecimal(form.pusherOffsetRows);
  let stepInches = parseDecimal(form.pusherStepInches);
  let offsetInches = parseDecimal(form.pusherOffsetInches);

  if (form.pusherEnabled) {
    if (form.pusherMode === 'rows') {
      stepRows = integerAtLeast(form.pusherStepRows, 1, errors, 'pusherStepRows', 'El paso debe ser un número entero de filas, 1 o más.');
      offsetRows = integerAtLeast(form.pusherOffsetRows, 0, errors, 'pusherOffsetRows', 'El offset debe ser un número entero de filas, 0 o más.');
    } else {
      stepInches = positiveNumber(form.pusherStepInches, errors, 'pusherStepInches', 'Escribe el paso en pulgadas, mayor que 0.');
      offsetInches = nonNegativeNumber(form.pusherOffsetInches, errors, 'pusherOffsetInches', 'Escribe el offset en pulgadas, 0 o más.');
    }
    const usesPusherEdges = form.pusherEdgeMode === 'pusher';
    if (usesPusherEdges && form.edgesPusher.length === 0) errors.edgesPusher = 'Elige al menos un tamaño de orilla de empujador.';

    const normalIndent = resolveNormalEdgeIndent(form.normalEdgeIndentInches, flight);
    if (usesPusherEdges) {
      edgeIndentInches = optionalIndent(form.pusherIndentInches, errors);
    } else {
      edgeIndentInches = normalIndent.inches;
      // El indent deseado se cumple exacto: con orillas normales la orilla es la franja sin flight.
      if (normalIndent.source === 'typed') edgeIndentFit = 'exact';
      if (form.normalEdgeIndentInches.trim() && normalIndent.source !== 'typed') {
        errors.normalEdgeIndentInches = 'Escribe el indent en pulgadas, mayor que 0, o déjalo vacío para usar el mínimo del catálogo.';
      }
    }
    if (edgeIndentInches !== null && !errors.linkIncrementInches) {
      const minLinks = minimumLinksFor(edgeIndentInches, linkIncrementInches);
      const candidates = usesPusherEdges ? form.edgesPusher : form.edgesNormal;
      const indent = formatPlainNumber(edgeIndentInches);
      // Con el corte activo, la orilla exacta también puede salir de cortar una orilla mayor.
      const available = moduleSupply(candidates, form.allowCutModules).sizes;
      if (candidates.length > 0 && edgeIndentFit === 'exact' && !available.includes(minLinks)) {
        errors.edgesNormal =
          `Con un indent deseado de ${indent} in, las filas de empujador llevan orillas normales de ${minLinks}L ` +
          `(${formatInches(minLinks * linkIncrementInches)}): elige ese tamaño en orillas normales` +
          `${form.allowCutModules ? ' o uno mayor para cortarlo' : ''}.`;
      } else if (candidates.length > 0 && !candidates.some((size) => size >= minLinks)) {
        if (usesPusherEdges) {
          errors.edgesPusher = `Ninguna orilla de empujador cubre el indent de ${indent} in: se necesitan orillas de ${minLinks}L o más.`;
        } else {
          errors.edgesNormal =
            `${flight!.name} pide un indent mínimo de ${indent} in: para las filas de empujador ` +
            `se necesita una orilla normal de ${minLinks}L o más.`;
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) return { input: null, errors };

  const height = parseDecimal(form.flightHeightInches);
  const heightInches = height > 0 ? height : null;
  const flightLabel = flight ? (heightInches ? `${flight.name}, ${formatPlainNumber(heightInches)} in` : flight.name) : null;

  const orZero = (value: number) => (Number.isFinite(value) ? value : 0);
  return {
    errors,
    input: {
      pitchInches,
      linkIncrementInches,
      widthInches,
      lengthInches,
      lengthUnit: form.lengthUnit,
      roundingMode: form.roundingMode,
      edgesNormal: [...form.edgesNormal],
      innerNormal: [...form.innerNormal],
      edgesPusher: [...form.edgesPusher],
      innerPusher: [...form.innerPusher],
      // Banda personalizada: se asume que las orillas pueden ser distintas (comportamiento validado).
      bidirectional: series?.bidirectional ?? false,
      allowCutModules: form.allowCutModules,
      flightConfig: {
        enabled: form.pusherEnabled,
        mode: form.pusherMode,
        stepRows: orZero(stepRows),
        offsetRows: orZero(offsetRows),
        stepInches: orZero(stepInches),
        offsetInches: orZero(offsetInches),
        edgeMode: form.pusherEdgeMode,
        edgeIndentInches: form.pusherEnabled ? edgeIndentInches : null,
        edgeIndentFit,
        flightLabel: form.pusherEnabled ? flightLabel : null
      }
    }
  };
}

/** Indent mínimo sin sideguards que el catálogo da para el empujador; null si no hay empujador o no lo indica. */
export function catalogMinimumIndent(flight: { minIndentInches?: number | null } | null): number | null {
  const inches = flight?.minIndentInches;
  return typeof inches === 'number' && inches > 0 ? inches : null;
}

export interface ResolvedIndent {
  inches: number | null;
  /** 'typed': lo escribió el usuario. 'catalog': mínimo del empujador elegido. null: no se limita (o el texto es inválido). */
  source: 'typed' | 'catalog' | null;
}

/**
 * Indent que limita las orillas normales en las filas de empujador (la orilla normal es la franja sin flight):
 * - el indent deseado que se escribió: se cumple exacto, con la orilla más chica que lo cubre;
 * - con el campo vacío, el mínimo sin sideguards del empujador elegido (comportamiento anterior, sirve cualquier orilla que lo cubra);
 * - sin empujador elegido, o si el catálogo no indica ese mínimo, no se limitan las orillas.
 * Un texto inválido no limita: la validación del formulario marca el error.
 */
export function resolveNormalEdgeIndent(text: string, flight: { minIndentInches?: number | null } | null): ResolvedIndent {
  if (text.trim()) {
    const typed = parseDecimal(text);
    return typed > 0 && Number.isFinite(typed) ? { inches: typed, source: 'typed' } : { inches: null, source: null };
  }
  const catalog = catalogMinimumIndent(flight);
  return catalog !== null ? { inches: catalog, source: 'catalog' } : { inches: null, source: null };
}

function optionalIndent(text: string, errors: FormErrors): number | null {
  if (!text.trim()) return null;
  const value = parseDecimal(text);
  if (!(value > 0) || !Number.isFinite(value)) {
    errors.pusherIndentInches = 'Escribe el indent en pulgadas, mayor que 0, o déjalo vacío para no limitar las orillas.';
    return null;
  }
  return value;
}

const ROUNDING_MODES: readonly RoundingMode[] = ['round', 'floor', 'ceil'];
const PUSHER_MODES: readonly PusherMode[] = ['rows', 'distance'];

function isSizeList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((size) => Number.isInteger(size) && size > 0);
}

/** Recupera un formulario guardado; descarta campos con forma inesperada y usa los valores por defecto. */
export function restoreForm(raw: unknown): PlannerFormState {
  if (!raw || typeof raw !== 'object') return DEFAULT_FORM;
  const source = raw as Record<string, unknown>;
  const restored: PlannerFormState = { ...DEFAULT_FORM };
  const textFields: FormField[] = [
    'planTitle',
    'pitchInches',
    'linkIncrementInches',
    'widthInches',
    'lengthValue',
    'pusherStepRows',
    'pusherOffsetRows',
    'pusherStepInches',
    'pusherOffsetInches',
    'flightHeightInches',
    'pusherIndentInches',
    'normalEdgeIndentInches'
  ];
  textFields.forEach((field) => {
    if (typeof source[field] === 'string') (restored[field] as string) = source[field] as string;
  });
  (['edgesNormal', 'innerNormal', 'edgesPusher', 'innerPusher'] as const).forEach((field) => {
    if (isSizeList(source[field])) restored[field] = [...(source[field] as number[])];
  });
  if (ROUNDING_MODES.includes(source.roundingMode as RoundingMode)) restored.roundingMode = source.roundingMode as RoundingMode;
  if (PUSHER_MODES.includes(source.pusherMode as PusherMode)) restored.pusherMode = source.pusherMode as PusherMode;
  if (typeof source.pusherEnabled === 'boolean') restored.pusherEnabled = source.pusherEnabled;
  if (typeof source.allowCutModules === 'boolean') restored.allowCutModules = source.allowCutModules;
  if (typeof source.catalogEntryId === 'string' && source.catalogEntryId) restored.catalogEntryId = source.catalogEntryId;
  if (source.lengthUnit === 'ft' || source.lengthUnit === 'm') restored.lengthUnit = source.lengthUnit;
  // Formularios guardados cuando el largo se capturaba en pulgadas: se pasan a pies.
  if (typeof source.lengthValue !== 'string' && typeof source.lengthInches === 'string') {
    const inches = parseDecimal(source.lengthInches);
    if (inches > 0) {
      restored.lengthUnit = 'ft';
      restored.lengthValue = formatPlainNumber(inchesToLength(inches, 'ft'), 4);
    }
  }
  if (source.pusherEdgeMode === 'pusher' || source.pusherEdgeMode === 'normal') restored.pusherEdgeMode = source.pusherEdgeMode;
  if (typeof source.flightId === 'string' && source.flightId) restored.flightId = source.flightId;
  return restored;
}
