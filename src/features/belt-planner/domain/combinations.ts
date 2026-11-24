import { DEFAULT_COMBINATION_LIMIT } from './constants';

/** Tamaños únicos, enteros positivos, ordenados de mayor a menor. */
export function normalizeSizes(sizes: readonly number[]): number[] {
  return [...new Set(sizes)].filter((size) => Number.isInteger(size) && size > 0).sort((a, b) => b - a);
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/** Máximo común divisor de los tamaños: si el objetivo no es múltiplo, no hay combinación posible. */
export function sizesDivisor(sizesDesc: readonly number[]): number {
  return sizesDesc.reduce((divisor, size) => greatestCommonDivisor(size, divisor), 0);
}

/**
 * Combinaciones (multiconjuntos) de exactamente `pieceCount` módulos que suman `target`.
 * Cada combinación sale ordenada de mayor a menor y las combinaciones salen en orden
 * lexicográfico descendente (primero las que usan piezas más grandes).
 * `sizesDesc` debe venir de `normalizeSizes`.
 */
export function combinationsOfPieceCount(
  target: number,
  sizesDesc: readonly number[],
  pieceCount: number,
  limit = DEFAULT_COMBINATION_LIMIT
): number[][] {
  if (pieceCount === 0) return target === 0 ? [[]] : [];
  if (target <= 0 || pieceCount < 0 || sizesDesc.length === 0 || limit <= 0) return [];

  const smallest = sizesDesc[sizesDesc.length - 1];
  const largest = sizesDesc[0];
  if (smallest * pieceCount > target || largest * pieceCount < target) return [];

  const result: number[][] = [];
  const current: number[] = [];
  // Estados (restante, piezas, índice) que ya se sabe que no producen ninguna combinación.
  const deadStates = new Set<string>();

  function search(remaining: number, piecesLeft: number, startIndex: number): void {
    if (piecesLeft === 0) {
      if (remaining === 0) result.push([...current]);
      return;
    }
    if (smallest * piecesLeft > remaining) return;

    const stateKey = `${remaining}:${piecesLeft}:${startIndex}`;
    if (deadStates.has(stateKey)) return;
    const foundBefore = result.length;

    for (let index = startIndex; index < sizesDesc.length; index += 1) {
      const size = sizesDesc[index];
      // Las piezas siguientes son <= size: si ni así se alcanza el restante, tampoco con tamaños menores.
      if (size * piecesLeft < remaining) break;
      if (size > remaining) continue;
      current.push(size);
      search(remaining - size, piecesLeft - 1, index);
      current.pop();
      if (result.length >= limit) return;
    }

    if (result.length === foundBefore) deadStates.add(stateKey);
  }

  search(target, pieceCount, 0);
  return result;
}

/**
 * Todas las combinaciones de módulos que suman exactamente `target` (regla 6),
 * ordenadas por menor cantidad de piezas (regla 8) y, a igual cantidad,
 * favoreciendo piezas más grandes (regla 9).
 *
 * Se enumera por número de piezas ascendente, así que el límite nunca descarta
 * una combinación con menos piezas que otra que sí se incluyó.
 */
export function combinationsForTarget(
  target: number,
  sizes: readonly number[],
  limit = DEFAULT_COMBINATION_LIMIT
): number[][] {
  if (target === 0) return [[]];
  const sizesDesc = normalizeSizes(sizes);
  if (target < 0 || sizesDesc.length === 0) return [];
  if (target % sizesDivisor(sizesDesc) !== 0) return [];

  const minPieces = Math.ceil(target / sizesDesc[0]);
  const maxPieces = Math.floor(target / sizesDesc[sizesDesc.length - 1]);
  const result: number[][] = [];

  for (let pieces = minPieces; pieces <= maxPieces && result.length < limit; pieces += 1) {
    result.push(...combinationsOfPieceCount(target, sizesDesc, pieces, limit - result.length));
  }
  return result;
}
