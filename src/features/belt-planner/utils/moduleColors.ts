import { bomRoleOf } from '../domain/bom';
import { BomRole, ModuleKind, Segment } from '../types';

/**
 * Colores por módulo: cada módulo distinto (inventario + rol + tamaño) tiene su propio color,
 * dentro de la familia de su tipo. El mismo módulo siempre tiene el mismo color en todo el plan.
 * Los colores se asignan automáticamente en cada plan: dentro de una familia, los tamaños se
 * reparten los tonos más separados (más chico = más claro).
 */

export type ModuleFamily = 'edge' | 'inner' | 'pusher-edge' | 'pusher-inner';

export const FAMILY_ORDER: readonly ModuleFamily[] = ['edge', 'inner', 'pusher-edge', 'pusher-inner'];

export const FAMILY_NAMES: Record<ModuleFamily, string> = {
  edge: 'Orillas',
  inner: 'Internos',
  'pusher-edge': 'Orillas de empujador',
  'pusher-inner': 'Internos de empujador'
};

/**
 * Tonos por familia, de claro a oscuro. Se dividen en claros (texto oscuro) y oscuros (texto blanco)
 * y se evitan los tonos medios, donde ningún color de texto alcanza contraste 4.5:1.
 */
const FAMILY_SHADES: Record<ModuleFamily, { light: string[]; dark: string[] }> = {
  inner: { light: ['#D6E8FA', '#B4D2F3', '#93BCEB', '#74A6E2'], dark: ['#2D63A6', '#24528C', '#1B4273', '#13335B'] },
  edge: { light: ['#E4E9EF', '#CDD6DF', '#B6C3CF', '#A0B0C0'], dark: ['#586B7D', '#495A6A', '#3B4957', '#2D3944'] },
  'pusher-inner': { light: ['#FFF4B8', '#FCE98C', '#F8DC5E', '#F3CC36', '#EEBB1F', '#E6A817'], dark: [] },
  'pusher-edge': { light: ['#E9CFA2', '#DDB778', '#C99D58', '#B98845'], dark: ['#7C5222', '#6A451B', '#583914', '#462D0F'] }
};

/** Tono que se usa cuando una familia tiene un solo módulo en el plan (el color de siempre de esa familia). */
const SINGLE_SHADE: Record<ModuleFamily, string> = {
  inner: '#2D63A6',
  edge: '#B6C3CF',
  'pusher-inner': '#F3CC36',
  'pusher-edge': '#C99D58'
};

const INK = '#1A2530';
const WHITE = '#FFFFFF';

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Texto oscuro o blanco, el que tenga más contraste sobre el fondo. */
export function labelColorFor(fill: string): string {
  return contrastRatio(fill, INK) >= contrastRatio(fill, WHITE) ? INK : WHITE;
}

function midpoint(a: string, b: string): string {
  const [ca, cb] = [channels(a), channels(b)];
  return toHex([0, 1, 2].map((index) => (ca[index] + cb[index]) / 2) as [number, number, number]);
}

/** Inserta tonos intermedios dentro de una misma banda (claros con claros, oscuros con oscuros) hasta tener `count`. */
function densify(shades: readonly string[], count: number): string[] {
  let result = [...shades];
  while (result.length < count && result.length >= 2) {
    const next = [result[0]];
    for (let index = 1; index < result.length; index += 1) {
      // Solo se inserta un intermedio si, contando los tonos que faltan por copiar, no se pasa de `count`.
      if (next.length + (result.length - index) < count) next.push(midpoint(result[index - 1], result[index]));
      next.push(result[index]);
    }
    result = next;
  }
  return result;
}

/** Tonos para `count` módulos de una familia: lo más separados posible, de claro a oscuro. */
export function familyShades(family: ModuleFamily, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [SINGLE_SHADE[family]];
  const { light, dark } = FAMILY_SHADES[family];
  let palette = [...light, ...dark];
  // Con pocos módulos se evitan los extremos (casi blanco / casi negro) para que el diagrama no se vea pesado.
  if (count <= palette.length - 2) palette = palette.slice(1, -1);
  if (count > palette.length) {
    const extra = count - palette.length;
    const darkExtra = dark.length > 0 ? Math.floor(extra / 2) : 0;
    palette = [...densify(light, light.length + extra - darkExtra), ...densify(dark, dark.length + darkExtra)];
  }
  return Array.from({ length: count }, (_, index) => palette[Math.round((index * (palette.length - 1)) / (count - 1))]);
}

export interface ModuleIdentity {
  kind: ModuleKind;
  role: BomRole;
  size: number;
}

export interface ModuleColor extends ModuleIdentity {
  key: string;
  family: ModuleFamily;
  fill: string;
  label: string;
}

export function moduleKey(identity: ModuleIdentity): string {
  return `${identity.kind}|${identity.role}|${identity.size}`;
}

export function familyOf(identity: Pick<ModuleIdentity, 'kind' | 'role'>): ModuleFamily {
  const isEdge = identity.role !== 'inner';
  if (identity.kind === 'pusher') return isEdge ? 'pusher-edge' : 'pusher-inner';
  return isEdge ? 'edge' : 'inner';
}

/** Identidad del módulo de un segmento: en bandas bidireccionales, orilla izquierda y derecha son la misma pieza. */
export function segmentIdentity(segment: Pick<Segment, 'kind' | 'role' | 'size'>, bidirectional: boolean): ModuleIdentity {
  return { kind: segment.kind, role: bomRoleOf(segment, bidirectional), size: segment.size };
}

const ROLE_SORT: Record<BomRole, number> = { edge: 0, 'edge-left': 0, 'edge-right': 1, inner: 0 };

/** Paleta del plan: un color por módulo distinto, por familia, ordenado por tamaño. */
export function assignModuleColors(
  rows: readonly { segments: readonly Segment[] }[],
  bidirectional: boolean
): Map<string, ModuleColor> {
  const byFamily = new Map<ModuleFamily, ModuleIdentity[]>();
  const seen = new Set<string>();
  rows.forEach((row) =>
    row.segments.forEach((segment) => {
      const identity = segmentIdentity(segment, bidirectional);
      const key = moduleKey(identity);
      if (seen.has(key)) return;
      seen.add(key);
      const family = familyOf(identity);
      byFamily.set(family, [...(byFamily.get(family) ?? []), identity]);
    })
  );

  const colors = new Map<string, ModuleColor>();
  FAMILY_ORDER.forEach((family) => {
    const modules = (byFamily.get(family) ?? []).sort((a, b) => a.size - b.size || ROLE_SORT[a.role] - ROLE_SORT[b.role]);
    const shades = familyShades(family, modules.length);
    modules.forEach((identity, index) => {
      const fill = shades[index];
      colors.set(moduleKey(identity), { ...identity, key: moduleKey(identity), family, fill, label: labelColorFor(fill) });
    });
  });
  return colors;
}

/** Color de un segmento según la paleta del plan. */
export function colorOfSegment(
  colors: ReadonlyMap<string, ModuleColor>,
  segment: Pick<Segment, 'kind' | 'role' | 'size'>,
  bidirectional: boolean
): ModuleColor | undefined {
  return colors.get(moduleKey(segmentIdentity(segment, bidirectional)));
}
