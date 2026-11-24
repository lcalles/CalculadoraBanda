import { BomLine, PlannerInput, PlanResult, Segment } from '../types';
import { INCH_ROUNDING_STEP, inchPosition, nominalModuleInches } from '../utils/format';

export const PLAN_JSON_FORMAT = 'calculadora-banda/plan';
/**
 * 3: pulgadas primero. Cada tamaño y junta lleva su valor en pulgadas antes del de links
 * (`sizeInches`/`size`, `seamsInches`/`seams`…); las claves en links de la versión 2 no cambian.
 * Tamaños y juntas en pulgadas van redondeados al cuarto, como en pantalla; los anchos (`widthInches`,
 * `realWidthInches`) van exactos.
 */
export const PLAN_JSON_VERSION = 3;

/** Quita el ruido de punto flotante de una medida en pulgadas (3 × 0.33 = 0.9900000000000001 → 0.99). */
const cleanInches = (value: number) => Number(value.toFixed(6));

function bomLineDocument(line: BomLine, linkIncrementInches: number) {
  return {
    kind: line.kind,
    role: line.role,
    sizeInches: nominalModuleInches(line.sizeLinks, linkIncrementInches),
    sizeLinks: line.sizeLinks,
    widthInches: cleanInches(line.widthInches),
    quantity: line.quantity,
    ...(line.cutFromLinks !== undefined
      ? { cutFromInches: nominalModuleInches(line.cutFromLinks, linkIncrementInches), cutFromLinks: line.cutFromLinks }
      : {})
  };
}

/** `size` y `cutFrom` siguen en links, como en la versión 2. */
function moduleDocument(segment: Segment, linkIncrementInches: number) {
  return {
    role: segment.role,
    sizeInches: nominalModuleInches(segment.size, linkIncrementInches),
    size: segment.size,
    ...(segment.cutFrom !== undefined
      ? { cutFromInches: nominalModuleInches(segment.cutFrom, linkIncrementInches), cutFrom: segment.cutFrom }
      : {})
  };
}

/**
 * Documento JSON del plan: parámetros de entrada + resultado.
 * No incluye la lista completa de patrones candidatos (solo cuántos hubo) para mantener el archivo manejable.
 * `input` va tal como entró al cálculo (los tamaños elegidos, en links).
 */
export interface PlanDocumentBelt {
  id: string;
  label: string;
  manufacturer: string;
  source: string;
}

export function buildPlanDocument(
  input: PlannerInput,
  result: PlanResult,
  generatedAt: Date = new Date(),
  belt: PlanDocumentBelt | null = null,
  title = ''
) {
  const increment = input.linkIncrementInches;
  const seamsInInches = (seams: readonly number[]) => seams.map((seam) => inchPosition(seam, increment));
  return {
    format: PLAN_JSON_FORMAT,
    version: PLAN_JSON_VERSION,
    generatedAt: generatedAt.toISOString(),
    /** Título libre del cálculo; null si no se escribió. */
    title: title.trim() || null,
    /** Tamaños y juntas en pulgadas (`sizeInches`, `cutFromInches`, `seamsInches`…) van redondeados a este paso. */
    inchRoundingStep: INCH_ROUNDING_STEP,
    belt,
    input,
    summary: {
      realWidthInches: cleanInches(result.realWidthInches),
      widthLinks: result.widthLinks,
      requestedWidthInches: result.requestedWidthInches,
      rowsCount: result.rowsCount,
      realLengthInches: result.realLengthInches,
      requestedLengthInches: result.requestedLengthInches,
      normalPatternCount: result.patternsNormal.length,
      pusherPatternCount: result.patternsPusher.length,
      ...result.stats
    },
    pushers: {
      enabled: input.flightConfig.enabled,
      spacing: result.pusherSpacing,
      rows: result.pusherRows
    },
    notices: result.notices,
    bom: result.bom.map((line) => bomLineDocument(line, increment)),
    rows: result.rows.map((row) => ({
      rowNumber: row.rowNumber,
      kind: row.kind,
      pusherRequested: row.pusherRequested,
      modules: row.segments.map((segment) => moduleDocument(segment, increment)),
      seamsInches: seamsInInches(row.seams),
      seams: row.seams,
      alignedSeamsInches: seamsInInches(row.alignedSeams),
      alignedSeams: row.alignedSeams
    }))
  };
}

export function toPlanJson(
  input: PlannerInput,
  result: PlanResult,
  generatedAt?: Date,
  belt: PlanDocumentBelt | null = null,
  title = ''
): string {
  return JSON.stringify(buildPlanDocument(input, result, generatedAt, belt, title), null, 2);
}
