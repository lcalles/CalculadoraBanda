import { inchesToLength } from '../domain/units';
import { BomRole, LengthUnit, ModuleKind, RoundingMode, Segment } from '../types';

/** 'edge' aparece en la BOM de bandas bidireccionales, donde izquierda y derecha son la misma pieza. */
export const ROLE_LABELS: Record<BomRole, string> = {
  edge: 'Orilla',
  'edge-left': 'Orilla izquierda',
  inner: 'Interno',
  'edge-right': 'Orilla derecha'
};

export const KIND_LABELS: Record<ModuleKind, string> = {
  normal: 'Normal',
  pusher: 'Empujador'
};

export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  round: 'al más cercano',
  floor: 'hacia abajo',
  ceil: 'hacia arriba'
};

/** Pulgadas con 3 decimales fijos, para medidas de producción. */
export function formatInches(value: number, digits = 3): string {
  return `${value.toFixed(digits)} in`;
}

export const LENGTH_UNIT_NAMES: Record<LengthUnit, { short: string; long: string }> = {
  ft: { short: 'ft', long: 'pies' },
  m: { short: 'm', long: 'metros' }
};

/**
 * Largo expresado en pulgadas mostrado en la unidad elegida: pies con 3 decimales ("10.000 ft")
 * y metros con 4 ("3.0480 m"), para que un ajuste de menos de 1 mm no se vea igual a lo pedido.
 */
export function formatLength(inches: number, unit: LengthUnit | undefined): string {
  if (!unit) return formatInches(inches);
  return `${inchesToLength(inches, unit).toFixed(unit === 'm' ? 4 : 3)} ${LENGTH_UNIT_NAMES[unit].short}`;
}

/** Número tal como lo capturó el usuario, sin ceros de relleno (máx. 3 decimales). */
export function formatPlainNumber(value: number, maxDigits = 3): string {
  return String(Number(value.toFixed(maxDigits)));
}

export function formatCount(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString('es-MX')} ${count === 1 ? singular : plural}`;
}

/** Composición de una fila, de izquierda a derecha, en links: "2 + 8 + 8 + 2". */
export function formatComposition(segments: readonly Segment[], separator = ' + '): string {
  return segments.map((segment) => segment.size).join(separator);
}

export function formatSeams(seams: readonly number[], separator = ' '): string {
  return seams.join(separator);
}
