import { ModuleKind, RowPattern } from '../types';
import type { LayoutParams } from './layout';

/**
 * Juntas alineadas = combinación inválida: dos filas vecinas no pueden compartir ninguna junta.
 *
 * Este módulo decide con exactitud (no por heurística) si existe un armado así para todas las filas
 * y, si existe, qué patrones permiten terminar la banda sin coincidencias desde cada fila.
 *
 * Los conjuntos de patrones se guardan como bitsets y se reutilizan: el tipo de cada fila se repite
 * con el paso de los empujadores, así que tras pocas filas los conjuntos se repiten y el costo por fila
 * es constante. Construir la compatibilidad cuesta (patrones normales + de empujador)² comparaciones.
 */

/** Conjunto de índices de patrones (dentro de los de un tipo), como bitset. */
export type PatternSet = Uint32Array;

export function hasPattern(set: PatternSet, index: number): boolean {
  return (set[index >>> 5] & (1 << (index & 31))) !== 0;
}

function isEmptySet(set: PatternSet): boolean {
  return set.every((word) => word === 0);
}

function intersects(a: PatternSet, b: PatternSet): boolean {
  for (let word = 0; word < a.length; word += 1) if ((a[word] & b[word]) !== 0) return true;
  return false;
}

function addPattern(set: PatternSet, index: number): void {
  set[index >>> 5] |= 1 << (index & 31);
}

/** Tipo con el que realmente se arma cada fila: de empujador solo si hay patrones de empujador. */
export function rowKindOf({ pusherPatterns, pusherRowNumbers }: LayoutParams): (rowNumber: number) => ModuleKind {
  const canBuildPusherRows = pusherPatterns.length > 0;
  return (rowNumber) => (canBuildPusherRows && pusherRowNumbers.has(rowNumber) ? 'pusher' : 'normal');
}

function createSeamCompatibility({ widthLinks, normalPatterns, pusherPatterns }: LayoutParams) {
  const patternsOf = (kind: ModuleKind): readonly RowPattern[] => (kind === 'pusher' ? pusherPatterns : normalPatterns);
  const emptySet = (kind: ModuleKind): PatternSet => new Uint32Array(Math.ceil(patternsOf(kind).length / 32));

  const masks = new Map<RowPattern, Uint8Array>();
  const maskOf = (pattern: RowPattern): Uint8Array => {
    let mask = masks.get(pattern);
    if (!mask) {
      mask = new Uint8Array(widthLinks + 1);
      for (const seam of pattern.seams) if (seam >= 0 && seam <= widthLinks) mask[seam] = 1;
      masks.set(pattern, mask);
    }
    return mask;
  };
  const shareSeam = (a: RowPattern, b: RowPattern): boolean => {
    const mask = maskOf(a);
    return b.seams.some((seam) => mask[seam] === 1);
  };

  // compatible(from, to)[i]: patrones de tipo `to` que no comparten juntas con el patrón i de tipo `from`.
  const compatibleCache = new Map<string, PatternSet[]>();
  const compatible = (from: ModuleKind, to: ModuleKind): PatternSet[] => {
    const key = `${from}>${to}`;
    let table = compatibleCache.get(key);
    if (!table) {
      const targets = patternsOf(to);
      table = patternsOf(from).map((pattern) => {
        const set = emptySet(to);
        targets.forEach((target, index) => {
          if (!shareSeam(pattern, target)) addPattern(set, index);
        });
        return set;
      });
      compatibleCache.set(key, table);
    }
    return table;
  };

  /** Patrones de tipo `kind` con al menos un vecino de tipo `neighborKind` dentro de `neighbors` sin juntas en común. */
  const withCleanNeighbor = (kind: ModuleKind, neighborKind: ModuleKind, neighbors: PatternSet): PatternSet => {
    const result = emptySet(kind);
    compatible(kind, neighborKind).forEach((cleanNeighbors, index) => {
      if (intersects(cleanNeighbors, neighbors)) addPattern(result, index);
    });
    return result;
  };

  const allPatterns = (kind: ModuleKind): PatternSet => {
    const set = emptySet(kind);
    patternsOf(kind).forEach((_, index) => addPattern(set, index));
    return set;
  };

  // Conjuntos únicos: filas con el mismo conjunto comparten id, y las transiciones se memorizan por id.
  const sets: PatternSet[] = [];
  const setIds = new Map<string, number>();
  const intern = (kind: ModuleKind, set: PatternSet): number => {
    const key = `${kind}:${set.join(',')}`;
    let id = setIds.get(key);
    if (id === undefined) {
      id = sets.length;
      sets.push(set);
      setIds.set(key, id);
    }
    return id;
  };

  return { withCleanNeighbor, allPatterns, sets, intern };
}

/** Patrones desde los que se puede terminar la banda sin juntas alineadas, fila por fila. */
export interface CleanContinuations {
  /** Índices (dentro de los patrones del tipo de la fila) que dejan terminar la banda sin coincidencias. */
  setOfRow(rowNumber: number): PatternSet;
  /** Filas con el mismo id tienen el mismo conjunto. */
  setIdOfRow(rowNumber: number): number;
}

/**
 * Calcula, desde la última fila hacia la primera, qué patrones permiten terminar la banda sin juntas
 * alineadas. Devuelve null si no existe ningún armado así: la combinación de tamaños es inválida.
 */
export function findCleanContinuations(params: LayoutParams): CleanContinuations | null {
  const { rowsCount } = params;
  if (rowsCount <= 0 || params.normalPatterns.length === 0) return null;
  const kindOfRow = rowKindOf(params);
  const compatibility = createSeamCompatibility(params);
  const ids = new Int32Array(rowsCount + 1);
  const transitions = new Map<string, number>();

  ids[rowsCount] = compatibility.intern(kindOfRow(rowsCount), compatibility.allPatterns(kindOfRow(rowsCount)));
  for (let rowNumber = rowsCount - 1; rowNumber >= 1; rowNumber -= 1) {
    const kind = kindOfRow(rowNumber);
    const key = `${kind}>${ids[rowNumber + 1]}`;
    let id = transitions.get(key);
    if (id === undefined) {
      const following = compatibility.sets[ids[rowNumber + 1]];
      id = compatibility.intern(kind, compatibility.withCleanNeighbor(kind, kindOfRow(rowNumber + 1), following));
      transitions.set(key, id);
    }
    if (isEmptySet(compatibility.sets[id])) return null;
    ids[rowNumber] = id;
  }

  return {
    setOfRow: (rowNumber) => compatibility.sets[ids[rowNumber]],
    setIdOfRow: (rowNumber) => ids[rowNumber]
  };
}

/**
 * Primera fila a la que no se puede llegar desde la fila 1 sin que alguna fila comparta juntas con la anterior.
 * null si se puede armar toda la banda sin coincidencias. Sirve para explicar por qué una combinación es inválida.
 */
export function firstBlockedRow(params: LayoutParams): number | null {
  const { rowsCount } = params;
  if (rowsCount <= 0 || params.normalPatterns.length === 0) return null;
  const kindOfRow = rowKindOf(params);
  const compatibility = createSeamCompatibility(params);
  const transitions = new Map<string, number>();

  let reachableId = compatibility.intern(kindOfRow(1), compatibility.allPatterns(kindOfRow(1)));
  for (let rowNumber = 2; rowNumber <= rowsCount; rowNumber += 1) {
    const kind = kindOfRow(rowNumber);
    const key = `${kind}<${reachableId}`;
    let id = transitions.get(key);
    if (id === undefined) {
      const previous = compatibility.sets[reachableId];
      id = compatibility.intern(kind, compatibility.withCleanNeighbor(kind, kindOfRow(rowNumber - 1), previous));
      transitions.set(key, id);
    }
    if (isEmptySet(compatibility.sets[id])) return rowNumber;
    reachableId = id;
  }
  return null;
}
