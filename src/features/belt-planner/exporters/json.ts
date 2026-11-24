import { PlannerInput, PlanResult } from '../types';

export const PLAN_JSON_FORMAT = 'calculadora-banda/plan';
export const PLAN_JSON_VERSION = 2;

/**
 * Documento JSON del plan: parámetros de entrada + resultado.
 * No incluye la lista completa de patrones candidatos (solo cuántos hubo) para mantener el archivo manejable.
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
  return {
    format: PLAN_JSON_FORMAT,
    version: PLAN_JSON_VERSION,
    generatedAt: generatedAt.toISOString(),
    /** Título libre del cálculo; null si no se escribió. */
    title: title.trim() || null,
    belt,
    input,
    summary: {
      widthLinks: result.widthLinks,
      realWidthInches: result.realWidthInches,
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
    bom: result.bom,
    rows: result.rows.map((row) => ({
      rowNumber: row.rowNumber,
      kind: row.kind,
      pusherRequested: row.pusherRequested,
      modules: row.segments.map((segment) =>
        segment.cutFrom !== undefined
          ? { role: segment.role, size: segment.size, cutFrom: segment.cutFrom }
          : { role: segment.role, size: segment.size }
      ),
      seams: row.seams,
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
