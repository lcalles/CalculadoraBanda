import { normalizeSizes } from './combinations';
import { MIN_MODULE_LINKS } from './constants';

/** Tamaños con los que se puede armar un inventario y de qué módulo sale cada tamaño cortado. */
export interface ModuleSupply {
  /** Tamaños disponibles (links), de mayor a menor. */
  sizes: number[];
  /** Tamaño → módulo elegido del que se corta. Solo contiene los tamaños que salen cortados. */
  cutFrom: ReadonlyMap<number, number>;
}

/**
 * Tamaños disponibles de un inventario (orillas o internos, normales o de empujador).
 * - Sin corte: solo los tamaños elegidos.
 * - Con corte: además, cada tamaño menor al módulo más grande elegido, desde `MIN_MODULE_LINKS` (2L).
 *   Sale del módulo elegido más chico que lo cubre, el que menos desperdicia: con 6L y 9L elegidos,
 *   el 5L se corta de un 6L y el 7L de un 9L. Un tamaño elegido nunca se corta.
 * El sobrante del corte se considera desperdicio (no se reutiliza como otra pieza).
 */
export function moduleSupply(selected: readonly number[], allowCuts: boolean): ModuleSupply {
  const chosen = normalizeSizes(selected);
  const cutFrom = new Map<number, number>();
  if (!allowCuts || chosen.length === 0) return { sizes: chosen, cutFrom };

  const ascending = [...chosen].reverse();
  for (let size = MIN_MODULE_LINKS; size < chosen[0]; size += 1) {
    if (chosen.includes(size)) continue;
    cutFrom.set(size, ascending.find((candidate) => candidate > size)!);
  }
  return { sizes: normalizeSizes([...chosen, ...cutFrom.keys()]), cutFrom };
}
