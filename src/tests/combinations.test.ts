import { describe, expect, it } from 'vitest';
import { combinationsForTarget, combinationsOfPieceCount, normalizeSizes } from '../features/belt-planner/domain/combinations';
import { legacyCombosSumTarget } from './fixtures/legacyPlanner';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('combinationsForTarget', () => {
  it('solo devuelve combinaciones que suman exactamente el objetivo', () => {
    const combos = combinationsForTarget(10, [6, 4, 2]);
    expect(combos.length).toBeGreaterThan(0);
    combos.forEach((combo) => expect(sum(combo)).toBe(10));
    expect(combos.map((combo) => combo.join('-'))).toEqual(expect.arrayContaining(['6-4', '4-2-2-2']));
  });

  it('prioriza menos piezas y, a igual cantidad, piezas más grandes', () => {
    const combos = combinationsForTarget(20, [10, 8, 6, 4]);
    expect(combos[0]).toEqual([10, 10]);
    const firstThreePiece = combos.find((combo) => combo.length === 3);
    expect(firstThreePiece).toEqual([10, 6, 4]);
    for (let index = 1; index < combos.length; index += 1) {
      expect(combos[index].length).toBeGreaterThanOrEqual(combos[index - 1].length);
    }
  });

  it('no repite combinaciones', () => {
    const combos = combinationsForTarget(30, [2, 3, 4, 5, 6]);
    const keys = combos.map((combo) => combo.join('-'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('devuelve vacío cuando ningún múltiplo de los tamaños da el objetivo', () => {
    expect(combinationsForTarget(11, [4, 6, 8])).toEqual([]);
    expect(combinationsForTarget(5, [])).toEqual([]);
  });

  it('un objetivo de 0 es la combinación vacía', () => {
    expect(combinationsForTarget(0, [2, 4])).toEqual([[]]);
  });

  it('el límite nunca descarta una combinación con menos piezas que otra incluida', () => {
    const full = combinationsForTarget(40, [2, 3, 4, 5, 6, 8, 10]);
    const limited = combinationsForTarget(40, [2, 3, 4, 5, 6, 8, 10], 7);
    expect(limited).toEqual(full.slice(0, 7));
  });

  it('coincide con la versión validada (mismo conjunto y mismo orden) cuando no hay truncamiento', () => {
    const cases: Array<[number, number[]]> = [
      [10, [6, 4, 3, 2]],
      [24, [8, 6, 4, 3, 2]],
      [37, [12, 10, 7, 5]],
      [16, [16, 8, 4]]
    ];
    cases.forEach(([target, sizes]) => {
      expect(combinationsForTarget(target, sizes)).toEqual(legacyCombosSumTarget(target, sizes));
    });
  });
});

describe('combinationsOfPieceCount', () => {
  it('genera solo combinaciones con el número de piezas pedido', () => {
    const combos = combinationsOfPieceCount(24, normalizeSizes([10, 8, 6, 4, 2]), 3);
    expect(combos.length).toBeGreaterThan(0);
    combos.forEach((combo) => {
      expect(combo).toHaveLength(3);
      expect(sum(combo)).toBe(24);
    });
    expect(combos[0]).toEqual([10, 10, 4]);
  });

  it('descarta rápido los casos imposibles por cota', () => {
    expect(combinationsOfPieceCount(100, [10, 2], 3)).toEqual([]);
    expect(combinationsOfPieceCount(4, [10, 2], 3)).toEqual([]);
  });
});
