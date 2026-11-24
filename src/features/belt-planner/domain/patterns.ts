import { ModuleKind, RowPattern, Segment } from '../types';
import { combinationsOfPieceCount, normalizeSizes, sizesDivisor } from './combinations';
import { DEFAULT_COMBINATION_LIMIT, DEFAULT_MAX_BRICK_ROTATIONS, DEFAULT_MAX_PATTERNS } from './constants';
import { calculateSeams } from './seams';

export interface PatternOptions {
  /** Máximo de patrones que se devuelven (los mejores según prioridad). */
  maxPatterns?: number;
  /** Máximo de combinaciones de internos por ancho restante y número de piezas. */
  combinationLimit?: number;
  /** Rotaciones tipo ladrillo por combinación (desplazamientos 1..n). */
  maxBrickRotations?: number;
  /** Inventario de las orillas si es distinto al de los internos (filas de empujador con orillas normales). */
  edgeKind?: ModuleKind;
  /** Tamaños que salen de cortar un módulo más grande (ver `moduleSupply`). */
  cutFrom?: PatternCuts;
}

/** Tamaño → módulo del que se corta, para las orillas y para los internos de un inventario. */
export interface PatternCuts {
  edges?: ReadonlyMap<number, number>;
  inner?: ReadonlyMap<number, number>;
}

function sumOfSquares(sizes: readonly number[]): number {
  return sizes.reduce((sum, size) => sum + size * size, 0);
}

function segmentOf(size: number, role: Segment['role'], kind: ModuleKind, cutFrom: ReadonlyMap<number, number> | undefined): Segment {
  const source = cutFrom?.get(size);
  return source === undefined ? { size, role, kind } : { size, role, kind, cutFrom: source };
}

/**
 * Arma un patrón de fila: orilla izquierda, internos en el orden dado y orilla derecha (reglas 4 y 5).
 * `edgeKind` permite orillas de otro inventario (p. ej. orillas normales en una fila de empujador).
 * `cutFrom` marca las piezas que salen de cortar un módulo más grande.
 */
export function createRowPattern(
  leftEdge: number,
  inner: readonly number[],
  rightEdge: number,
  kind: ModuleKind,
  edgeKind: ModuleKind = kind,
  cutFrom: PatternCuts = {}
): RowPattern {
  const segments: Segment[] = [
    segmentOf(leftEdge, 'edge-left', edgeKind, cutFrom.edges),
    ...inner.map((size) => segmentOf(size, 'inner', kind, cutFrom.inner)),
    segmentOf(rightEdge, 'edge-right', edgeKind, cutFrom.edges)
  ];
  return {
    segments,
    seams: calculateSeams(segments),
    pieceCount: segments.length,
    cutCount: segments.filter((segment) => segment.cutFrom !== undefined).length,
    sizeScore: sumOfSquares(segments.map((segment) => segment.size))
  };
}

/** Cortes de un patrón ya armado, para rearmarlo con otro orden de internos. */
function cutsOfPattern(pattern: RowPattern): PatternCuts {
  const edges = new Map<number, number>();
  const inner = new Map<number, number>();
  pattern.segments.forEach((segment) => {
    if (segment.cutFrom !== undefined) (segment.role === 'inner' ? inner : edges).set(segment.size, segment.cutFrom);
  });
  return { edges, inner };
}

/**
 * Prioridad entre patrones: menos piezas primero (regla 8); a igual cantidad, menos piezas cortadas;
 * después, mayor suma de cuadrados, es decir piezas más grandes (regla 9).
 */
export function comparePatterns(a: RowPattern, b: RowPattern): number {
  return a.pieceCount - b.pieceCount || a.cutCount - b.cutCount || b.sizeScore - a.sizeScore;
}

/** Identidad geométrica del patrón: la secuencia de tamaños (los roles dependen solo de la posición). */
export function patternKey(pattern: RowPattern): string {
  return pattern.segments.map((segment) => segment.size).join('-');
}

/**
 * Variantes tipo ladrillo: rotaciones de los módulos internos (desplazamientos 1..maxRotations).
 * Puede devolver variantes repetidas cuando hay internos iguales; quien las usa debe deduplicar.
 */
export function brickRotations(inner: readonly number[], maxRotations = DEFAULT_MAX_BRICK_ROTATIONS): number[][] {
  const variants: number[][] = [];
  const shifts = Math.min(maxRotations, inner.length - 1);
  for (let shift = 1; shift <= shifts; shift += 1) {
    variants.push([...inner.slice(shift), ...inner.slice(0, shift)]);
  }
  return variants;
}

/** El patrón original seguido de sus rotaciones tipo ladrillo distintas. */
export function rotateInnerModules(pattern: RowPattern, maxRotations = DEFAULT_MAX_BRICK_ROTATIONS): RowPattern[] {
  const left = pattern.segments[0];
  const right = pattern.segments[pattern.segments.length - 1];
  const inner = pattern.segments.slice(1, -1).map((segment) => segment.size);
  const innerKind = pattern.segments.find((segment) => segment.role === 'inner')?.kind ?? left.kind;
  const variants = [pattern];
  const seen = new Set([patternKey(pattern)]);
  const cuts = cutsOfPattern(pattern);
  brickRotations(inner, maxRotations).forEach((rotated) => {
    const variant = createRowPattern(left.size, rotated, right.size, innerKind, left.kind, cuts);
    const key = patternKey(variant);
    if (!seen.has(key)) {
      seen.add(key);
      variants.push(variant);
    }
  });
  return variants;
}

interface EdgePair {
  left: number;
  right: number;
  remaining: number;
}

interface InnerCombo {
  inner: number[];
  cutCount: number;
  sizeScore: number;
}

interface PatternCandidate {
  left: number;
  right: number;
  inner: number[];
  cutCount: number;
  sizeScore: number;
}

/** A igual número de piezas: menos cortadas y, después, piezas más grandes. Sin cortes es solo por tamaño. */
const byFewerCutsThenLarger = (a: { cutCount: number; sizeScore: number }, b: { cutCount: number; sizeScore: number }) =>
  a.cutCount - b.cutCount || b.sizeScore - a.sizeScore;

/**
 * Genera los patrones de fila válidos para un inventario, ya ordenados por prioridad.
 *
 * - Cada patrón es orilla izquierda + internos que suman exactamente el restante + orilla derecha.
 * - Una fila de solo dos orillas se acepta únicamente si ambas suman el ancho total (regla 7).
 * - Se agregan rotaciones de internos tipo ladrillo inmediatamente después de su combinación base (regla 13).
 * - Se recorre por número de piezas ascendente y se corta al llegar a `maxPatterns`, así que el
 *   resultado equivale a ordenar todos los patrones por prioridad y quedarse con los primeros.
 * - Con `cutFrom`, los tamaños cortados ya vienen en `edges`/`inners`; a igual número de piezas
 *   se prefieren los patrones con menos piezas cortadas.
 */
export function buildPatterns(
  widthLinks: number,
  edges: readonly number[],
  inners: readonly number[],
  kind: ModuleKind,
  options: PatternOptions = {}
): RowPattern[] {
  const maxPatterns = options.maxPatterns ?? DEFAULT_MAX_PATTERNS;
  const combinationLimit = options.combinationLimit ?? DEFAULT_COMBINATION_LIMIT;
  const maxBrickRotations = options.maxBrickRotations ?? DEFAULT_MAX_BRICK_ROTATIONS;
  const edgeKind = options.edgeKind ?? kind;
  const cutFrom = options.cutFrom ?? {};
  const isCutEdge = (size: number) => (cutFrom.edges?.has(size) ? 1 : 0);

  const edgeSizes = normalizeSizes(edges);
  const innerSizes = normalizeSizes(inners);
  if (!Number.isInteger(widthLinks) || widthLinks <= 0 || edgeSizes.length === 0 || maxPatterns <= 0) return [];

  const edgePairs: EdgePair[] = [];
  edgeSizes.forEach((left) => {
    edgeSizes.forEach((right) => {
      if (left + right <= widthLinks) edgePairs.push({ left, right, remaining: widthLinks - left - right });
    });
  });
  if (edgePairs.length === 0) return [];

  const innerDivisor = sizesDivisor(innerSizes);
  const largestRemaining = Math.max(...edgePairs.map((pair) => pair.remaining));
  const maxInnerPieces = innerSizes.length > 0 ? Math.floor(largestRemaining / innerSizes[innerSizes.length - 1]) : 0;

  const patterns: RowPattern[] = [];
  const seen = new Set<string>();

  for (let innerCount = 0; innerCount <= maxInnerPieces && patterns.length < maxPatterns; innerCount += 1) {
    const needed = maxPatterns - patterns.length;
    const combosByRemaining = new Map<number, InnerCombo[]>();

    const innerCombosFor = (remaining: number): InnerCombo[] => {
      const cached = combosByRemaining.get(remaining);
      if (cached) return cached;
      let combos: InnerCombo[] = [];
      if (innerCount === 0) {
        combos = remaining === 0 ? [{ inner: [], cutCount: 0, sizeScore: 0 }] : [];
      } else if (remaining > 0 && remaining % innerDivisor === 0) {
        combos = combinationsOfPieceCount(remaining, innerSizes, innerCount, combinationLimit)
          .map((inner) => ({
            inner,
            cutCount: inner.filter((size) => cutFrom.inner?.has(size)).length,
            sizeScore: sumOfSquares(inner)
          }))
          .sort(byFewerCutsThenLarger)
          .slice(0, needed);
      }
      combosByRemaining.set(remaining, combos);
      return combos;
    };

    const candidates: PatternCandidate[] = [];
    edgePairs.forEach((pair) => {
      innerCombosFor(pair.remaining).forEach((combo) => {
        candidates.push({
          left: pair.left,
          right: pair.right,
          inner: combo.inner,
          cutCount: isCutEdge(pair.left) + isCutEdge(pair.right) + combo.cutCount,
          sizeScore: pair.left * pair.left + pair.right * pair.right + combo.sizeScore
        });
      });
    });
    // Mismo número de piezas en todo el nivel: solo falta ordenar por menos cortes y piezas más grandes (orden estable).
    candidates.sort(byFewerCutsThenLarger);

    for (const candidate of candidates) {
      for (const inner of [candidate.inner, ...brickRotations(candidate.inner, maxBrickRotations)]) {
        const pattern = createRowPattern(candidate.left, inner, candidate.right, kind, edgeKind, cutFrom);
        const key = patternKey(pattern);
        if (seen.has(key)) continue;
        seen.add(key);
        patterns.push(pattern);
        if (patterns.length >= maxPatterns) return patterns;
      }
    }
  }

  return patterns;
}
