import { describe, expect, it } from 'vitest';
import {
  brickRotations,
  buildPatterns,
  comparePatterns,
  createRowPattern,
  rotateInnerModules
} from '../features/belt-planner/domain/patterns';
import { calculateSeams } from '../features/belt-planner/domain/seams';
import { RowPattern } from '../features/belt-planner/types';
import { legacyMakeRowPatterns, legacySeamPositions } from './fixtures/legacyPlanner';

const sizesOf = (pattern: { segments: { size: number }[] }) => pattern.segments.map((segment) => segment.size);

describe('calculateSeams', () => {
  it('marca la junta después de cada módulo excepto el último', () => {
    expect(calculateSeams([{ size: 2 }, { size: 4 }, { size: 2 }])).toEqual([2, 6]);
    expect(calculateSeams([{ size: 2 }, { size: 4 }, { size: 2 }])).toEqual([...legacySeamPositions([{ size: 2 }, { size: 4 }, { size: 2 }])]);
  });
});

describe('buildPatterns', () => {
  it('pone las orillas en los extremos y los internos en medio, sumando el ancho exacto', () => {
    const patterns = buildPatterns(24, [2, 3], [4, 6, 8], 'normal');
    expect(patterns.length).toBeGreaterThan(0);
    patterns.forEach((pattern) => {
      expect(pattern.segments[0].role).toBe('edge-left');
      expect(pattern.segments[pattern.segments.length - 1].role).toBe('edge-right');
      pattern.segments.slice(1, -1).forEach((segment) => expect(segment.role).toBe('inner'));
      expect(sizesOf(pattern).reduce((a, b) => a + b, 0)).toBe(24);
      expect(pattern.seams).toEqual(calculateSeams(pattern.segments));
    });
  });

  it('acepta una fila de solo orillas únicamente cuando suman el ancho total', () => {
    const exact = buildPatterns(10, [5], [2, 3], 'normal');
    expect(exact.some((pattern) => pattern.segments.length === 2)).toBe(true);

    const needsInner = buildPatterns(10, [4], [2], 'normal');
    expect(needsInner.map(sizesOf)).toEqual([[4, 2, 4]]);
    expect(needsInner.some((pattern) => pattern.segments.length === 2)).toBe(false);
  });

  it('no genera patrones cuando las orillas no caben', () => {
    expect(buildPatterns(6, [4], [2], 'normal')).toEqual([]);
    expect(buildPatterns(10, [], [2], 'normal')).toEqual([]);
  });

  it('ordena por menos piezas y, en empate, por piezas más grandes', () => {
    const patterns = buildPatterns(20, [2], [10, 8, 6, 4], 'normal');
    expect(sizesOf(patterns[0])).toEqual([2, 10, 6, 2]);
    expect(sizesOf(patterns[1])).toEqual([2, 6, 10, 2]); // su variante ladrillo
    expect(sizesOf(patterns[2])).toEqual([2, 8, 8, 2]);
    for (let index = 1; index < patterns.length; index += 1) {
      expect(comparePatterns(patterns[index - 1], patterns[index])).toBeLessThanOrEqual(0);
    }
  });

  it('agrega las variantes tipo ladrillo de cada combinación sin duplicados', () => {
    const patterns = buildPatterns(24, [2], [8, 4], 'normal');
    const keys = patterns.map((pattern) => sizesOf(pattern).join('-'));
    expect(keys).toEqual(expect.arrayContaining(['2-8-8-4-2', '2-8-4-8-2', '2-4-8-8-2']));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('respeta el máximo de patrones', () => {
    expect(buildPatterns(96, [2, 3, 4], [2, 3, 4, 5, 6, 8], 'normal', { maxPatterns: 25 })).toHaveLength(25);
  });

  it('marca el tipo de inventario en cada módulo', () => {
    const patterns = buildPatterns(20, [2], [8], 'pusher');
    patterns.forEach((pattern) => pattern.segments.forEach((segment) => expect(segment.kind).toBe('pusher')));
  });

  it('produce exactamente los mismos patrones, en el mismo orden, que la versión validada', () => {
    const cases: Array<[number, number[], number[]]> = [
      [20, [12, 8, 6, 4, 2], [12, 8, 6, 4, 2]],
      [48, [2, 3], [4, 6, 8]],
      [24, [12], [2]],
      [30, [3, 5], [4, 6, 10]],
      [17, [2, 3], [4, 6]]
    ];
    cases.forEach(([width, edges, inners]) => {
      const legacy = (legacyMakeRowPatterns(width, edges, inners, 500) as Array<{ segments: { size: number }[] }>).map(sizesOf);
      expect(buildPatterns(width, edges, inners, 'normal').map(sizesOf)).toEqual(legacy);
    });
  });
});

describe('rotaciones tipo ladrillo', () => {
  it('rota los internos hasta 3 desplazamientos como la versión validada', () => {
    expect(brickRotations([8, 6, 4])).toEqual([
      [6, 4, 8],
      [4, 8, 6]
    ]);
    expect(brickRotations([5, 4, 3, 2, 1])).toHaveLength(3);
    expect(brickRotations([8])).toEqual([]);
  });

  it('rotateInnerModules conserva las orillas y elimina rotaciones repetidas', () => {
    const variants: RowPattern[] = rotateInnerModules(createRowPattern(3, [8, 8, 8], 2, 'normal'));
    expect(variants.map(sizesOf)).toEqual([[3, 8, 8, 8, 2]]);
    const mixed = rotateInnerModules(createRowPattern(3, [8, 6], 2, 'normal'));
    expect(mixed.map(sizesOf)).toEqual([
      [3, 8, 6, 2],
      [3, 6, 8, 2]
    ]);
  });
});
