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

/*
 * Representación: las pulgadas son la medida principal y los links la secundaria.
 * El cálculo sigue en links (así se arman las filas); estas funciones solo cambian cómo se muestra.
 */

/**
 * Paso del redondeo de las pulgadas que identifican módulos y juntas: cuartos de pulgada, escritos
 * en decimal (0.75, 1.25, 3). Las medidas de ancho (de la banda y el ancho real de cada módulo) van exactas.
 */
export const INCH_ROUNDING_STEP = 0.25;

/** Redondea una medida al cuarto de pulgada más cercano; el medio cuarto sube. */
export function roundToQuarterInch(inches: number): number {
  return Math.round(inches / INCH_ROUNDING_STEP + 1e-9) * INCH_ROUNDING_STEP;
}

/**
 * Pulgadas con que se identifica un módulo: su ancho real redondeado al cuarto de pulgada más cercano.
 * S900, 0.33 in por link: 9L = 2.97 in → 3; 8L = 2.64 in → 2.75; 2L = 0.66 in → 0.75.
 * Nunca baja de 0.25 in. Con incrementos de 0.25 in o más, dos tamaños nunca comparten nombre;
 * con incrementos menores pueden coincidir, y los links (siempre al lado) los distinguen.
 */
export function nominalModuleInches(links: number, linkIncrementInches: number): number {
  return Math.max(INCH_ROUNDING_STEP, roundToQuarterInch(links * linkIncrementInches));
}

/**
 * Posición en pulgadas de un punto medido en links (una junta, el inicio de un módulo), redondeada al cuarto.
 * Se redondea la posición real y no la suma de los nombres de los módulos, para que el error no se acumule
 * a lo ancho: nunca pasa de 1/8 in. Link 3 × 0.33 = 0.99 → 1; link 33 × 0.33 = 10.89 → 11.
 */
export function inchPosition(links: number, linkIncrementInches: number): number {
  return roundToQuarterInch(links * linkIncrementInches);
}

/** Nombre de un módulo en pulgadas, sin unidad: "2.75". */
export function formatModuleNumber(links: number, linkIncrementInches: number): string {
  return formatPlainNumber(nominalModuleInches(links, linkIncrementInches));
}

/** Nombre de un módulo en pulgadas: "2.75 in". */
export function formatModuleInches(links: number, linkIncrementInches: number): string {
  return `${formatModuleNumber(links, linkIncrementInches)} in`;
}

/** Nombre en pulgadas con los links de referencia: "2.75 in (8L)". Sin incremento válido, solo "8L". */
export function formatModuleSize(links: number, linkIncrementInches: number | null): string {
  return linkIncrementInches && linkIncrementInches > 0 ? `${formatModuleInches(links, linkIncrementInches)} (${links}L)` : `${links}L`;
}

export function formatModuleSizes(sizes: readonly number[], linkIncrementInches: number | null): string {
  return sizes.map((size) => formatModuleSize(size, linkIncrementInches)).join(', ');
}

/** Nombre, links y medida exacta, donde la exacta importa (p. ej. el indent): "1 in (3L = 0.990 in)". */
export function formatModuleSizeExact(links: number, linkIncrementInches: number): string {
  return `${formatModuleInches(links, linkIncrementInches)} (${links}L = ${formatInches(links * linkIncrementInches)})`;
}

/** Posición en pulgadas redondeada al cuarto (ver `inchPosition`): link 3 × 0.33 → "1". */
export function formatInchPosition(links: number, linkIncrementInches: number): string {
  return formatPlainNumber(inchPosition(links, linkIncrementInches));
}

/** Composición de una fila, de izquierda a derecha, en links: "2 + 8 + 8 + 2". */
export function formatComposition(segments: readonly Segment[], separator = ' + '): string {
  return segments.map((segment) => segment.size).join(separator);
}

/** Composición de una fila con el nombre en pulgadas de cada módulo: "0.75 + 2.75 + 2.75 + 0.75". */
export function formatCompositionInches(segments: readonly Segment[], linkIncrementInches: number, separator = ' + '): string {
  return segments.map((segment) => formatModuleNumber(segment.size, linkIncrementInches)).join(separator);
}

/** Juntas en links desde la orilla izquierda: "2 10 18". */
export function formatSeams(seams: readonly number[], separator = ' '): string {
  return seams.join(separator);
}

/** Juntas en pulgadas desde la orilla izquierda, redondeadas al cuarto: links 3, 21 y 33 a 0.33 in → "1 7 11". */
export function formatSeamsInches(seams: readonly number[], linkIncrementInches: number, separator = ' '): string {
  return seams.map((seam) => formatInchPosition(seam, linkIncrementInches)).join(separator);
}

/** Lista legible: "a", "a y b", "a, b y c". */
export function joinWithAnd(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
