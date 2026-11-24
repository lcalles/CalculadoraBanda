import { LengthUnit, RoundingMode } from '../types';

/** Pulgadas por unidad de largo (1 in = 2.54 cm exactos). */
export const INCHES_PER_UNIT: Record<LengthUnit, number> = { ft: 12, m: 1 / 0.0254 };

export function lengthToInches(value: number, unit: LengthUnit): number {
  return value * INCHES_PER_UNIT[unit];
}

export function inchesToLength(inches: number, unit: LengthUnit): number {
  return inches / INCHES_PER_UNIT[unit];
}

const RELATIVE_INTEGER_TOLERANCE = 1e-9;

/**
 * Corrige el ruido de punto flotante cuando una división debería dar un entero exacto
 * (p. ej. 0.3 / 0.1 = 2.9999999999999996 en JavaScript).
 * Sin esto, `floor` y `ceil` podían desviarse un link completo.
 */
export function snapNearInteger(value: number): number {
  const nearest = Math.round(value);
  const tolerance = RELATIVE_INTEGER_TOLERANCE * Math.max(1, Math.abs(value));
  return Math.abs(value - nearest) <= tolerance ? nearest : value;
}

/** Convierte el ancho en pulgadas a links según el incremento por link y el modo de redondeo. */
export function roundLinks(widthInches: number, incrementInches: number, mode: RoundingMode): number {
  if (!(incrementInches > 0) || !Number.isFinite(widthInches)) return 0;
  const links = snapNearInteger(widthInches / incrementInches);
  if (mode === 'floor') return Math.floor(links);
  if (mode === 'ceil') return Math.ceil(links);
  return Math.round(links);
}

/**
 * Ancho de referencia (mínimo o máximo de un catálogo) expresado en links enteros.
 * Los catálogos redondean el ancho (3 links × 0.66 in = 1.98 in aparece como "2 in"),
 * así que se compara en links y no en pulgadas exactas.
 */
export function referenceWidthInLinks(widthInches: number, incrementInches: number): number {
  return Math.round(snapNearInteger(widthInches / incrementInches));
}

/** Margen para el redondeo nominal del catálogo (p. ej. 3 links × 0.66 in = 1.98 in aparece como "2 in"). */
const NOMINAL_TOLERANCE = 0.02;

/**
 * Links mínimos para cubrir una distancia mínima (p. ej. el indent de un empujador).
 * Redondea hacia arriba porque es un mínimo, pero tolera el redondeo nominal del catálogo:
 * 1.3 in / 0.66 → 2 links; 2 in / 0.66 → 3 links (1.98 in); 0.8 in / 0.33 → 3 links (2 no alcanzan).
 */
export function minimumLinksFor(widthInches: number, incrementInches: number): number {
  if (!(widthInches > 0) || !(incrementInches > 0)) return 0;
  return Math.max(1, Math.ceil(snapNearInteger((widthInches / incrementInches) * (1 - NOMINAL_TOLERANCE))));
}

/** Convierte el largo en pulgadas a filas usando el pitch (redondeo al más cercano, mínimo 1 fila). */
export function calculateRows(lengthInches: number, pitchInches: number): number {
  if (!(pitchInches > 0) || !Number.isFinite(lengthInches)) return 1;
  return Math.max(1, Math.round(snapNearInteger(lengthInches / pitchInches)));
}
