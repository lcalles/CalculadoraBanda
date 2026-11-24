import { describe, expect, it } from 'vitest';
import { buildBom } from '../features/belt-planner/domain/bom';
import { moduleSupply } from '../features/belt-planner/domain/cuts';
import { buildPatterns, createRowPattern } from '../features/belt-planner/domain/patterns';
import { planBelt } from '../features/belt-planner/domain/planner';
import { PlannerInput } from '../features/belt-planner/types';

const sizesOf = (pattern: { segments: { size: number }[] }) => pattern.segments.map((segment) => segment.size);

describe('moduleSupply', () => {
  it('sin corte solo ofrece los tamaños elegidos', () => {
    expect(moduleSupply([9, 6], false)).toEqual({ sizes: [9, 6], cutFrom: new Map() });
  });

  it('con corte ofrece todo tamaño menor al más grande, cortado del módulo elegido que menos desperdicia', () => {
    const supply = moduleSupply([6, 9], true);
    expect(supply.sizes).toEqual([9, 8, 7, 6, 5, 4, 3, 2]);
    expect([...supply.cutFrom.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [2, 6],
      [3, 6],
      [4, 6],
      [5, 6],
      [7, 9],
      [8, 9]
    ]);
    // Los tamaños elegidos nunca se cortan.
    expect(supply.cutFrom.has(6)).toBe(false);
    expect(supply.cutFrom.has(9)).toBe(false);
  });

  it('sin tamaños elegidos no hay nada que cortar', () => {
    expect(moduleSupply([], true).sizes).toEqual([]);
  });
});

describe('patrones con módulos cortados', () => {
  it('marca cada pieza cortada con el módulo del que sale', () => {
    const pattern = createRowPattern(3, [9, 7], 3, 'normal', 'normal', { edges: new Map([[3, 6]]), inner: new Map([[7, 9]]) });
    expect(pattern.segments).toEqual([
      { size: 3, role: 'edge-left', kind: 'normal', cutFrom: 6 },
      { size: 9, role: 'inner', kind: 'normal' },
      { size: 7, role: 'inner', kind: 'normal', cutFrom: 9 },
      { size: 3, role: 'edge-right', kind: 'normal', cutFrom: 6 }
    ]);
    expect(pattern.cutCount).toBe(3);
  });

  it('menos piezas manda: corta un módulo grande si así ahorra piezas', () => {
    // 20 links, orillas 2L, internos 4L y 9L: 16 links de internos = 9 + 7 cortado (2 piezas) en vez de 4·4·4·4.
    const inner = moduleSupply([4, 9], true);
    const patterns = buildPatterns(20, [2], inner.sizes, 'normal', { cutFrom: { inner: inner.cutFrom } });
    expect(patterns[0].pieceCount).toBe(4);
    expect([...sizesOf(patterns[0])].sort((a, b) => b - a)).toEqual([9, 7, 2, 2]);
    expect(patterns[0].segments.find((segment) => segment.size === 7)?.cutFrom).toBe(9);
  });

  it('a igual número de piezas prefiere no cortar, aunque la pieza cortada sea más grande', () => {
    // 16 links de internos con 8L y 9L: 8 + 8 (sin cortes) antes que 9 + 7 cortado (mismas piezas, un corte).
    const inner = moduleSupply([8, 9], true);
    const patterns = buildPatterns(20, [2], inner.sizes, 'normal', { cutFrom: { inner: inner.cutFrom } });
    expect(sizesOf(patterns[0])).toEqual([2, 8, 8, 2]);
    expect(patterns[0].cutCount).toBe(0);
    const firstCut = patterns.findIndex((pattern) => pattern.cutCount > 0);
    expect(patterns.slice(firstCut).every((pattern) => pattern.pieceCount >= patterns[0].pieceCount)).toBe(true);
  });

  it('sin cortes el orden de los patrones es el de siempre', () => {
    const plain = buildPatterns(30, [3, 5], [4, 6, 10], 'normal');
    const withEmptyCuts = buildPatterns(30, [3, 5], [4, 6, 10], 'normal', { cutFrom: { edges: new Map(), inner: new Map() } });
    expect(withEmptyCuts).toEqual(plain);
    plain.forEach((pattern) => expect(pattern.cutCount).toBe(0));
  });
});

describe('BOM con módulos cortados', () => {
  it('cuenta aparte las piezas cortadas y dice de qué módulo salen', () => {
    const cuts = { inner: new Map([[7, 9]]) };
    const rows = [createRowPattern(2, [9, 7], 2, 'normal', 'normal', cuts), createRowPattern(2, [7, 9], 2, 'normal', 'normal', cuts)];
    expect(buildBom(rows, 0.5)).toEqual([
      { kind: 'normal', role: 'edge-left', sizeLinks: 2, widthInches: 1, quantity: 2 },
      { kind: 'normal', role: 'inner', sizeLinks: 9, widthInches: 4.5, quantity: 2 },
      { kind: 'normal', role: 'inner', sizeLinks: 7, widthInches: 3.5, cutFromLinks: 9, quantity: 2 },
      { kind: 'normal', role: 'edge-right', sizeLinks: 2, widthInches: 1, quantity: 2 }
    ]);
  });
});

describe('planBelt con corte de módulos', () => {
  const base: PlannerInput = {
    pitchInches: 1,
    linkIncrementInches: 1,
    widthInches: 25,
    lengthInches: 30,
    roundingMode: 'round',
    edgesNormal: [3, 6],
    innerNormal: [9],
    edgesPusher: [3, 6],
    innerPusher: [9],
    flightConfig: { enabled: false, mode: 'rows', stepRows: 4, offsetRows: 0, stepInches: 0, offsetInches: 0 }
  };

  it('apagado (por defecto) da exactamente el mismo plan que antes', () => {
    const input: PlannerInput = { ...base, widthInches: 24, innerNormal: [6, 9, 12] };
    expect(planBelt({ ...input, allowCutModules: false })).toEqual(planBelt(input));
    expect(planBelt(input).stats.cutPieces).toBe(0);
  });

  it('con 25 links y solo internos de 9L no hay armado; cortando, sí, y la BOM dice qué se corta', () => {
    expect(planBelt(base).patternsNormal).toEqual([]);
    const result = planBelt({ ...base, allowCutModules: true });
    expect(result.rows).toHaveLength(30);
    expect(result.stats.alignedSeamCount).toBe(0);
    const cutLines = result.bom.filter((line) => line.cutFromLinks !== undefined);
    expect(cutLines.length).toBeGreaterThan(0);
    expect(result.stats.cutPieces).toBe(cutLines.reduce((sum, line) => sum + line.quantity, 0));
    // Cada pieza cortada sale del módulo elegido más chico que la cubre.
    cutLines.forEach((line) => {
      const chosen = line.role === 'inner' ? [9] : [3, 6];
      expect(line.cutFromLinks).toBe(chosen.find((size) => size > line.sizeLinks));
    });
    expect(result.notices.find((notice) => notice.message.startsWith('Se cortan'))?.message).toContain('La lista de materiales indica');
  });

  it('el indent deseado exacto puede salir de cortar una orilla mayor', () => {
    // 36 links, 0.33 in por link, indent de 1 in → orillas de 3L; solo hay orillas de 6L y 9L elegidas.
    const result = planBelt({
      ...base,
      linkIncrementInches: 0.33,
      widthInches: 11.88,
      pitchInches: 1.07,
      lengthInches: 60,
      edgesNormal: [6, 9],
      innerNormal: [6, 9],
      innerPusher: [6, 8, 9],
      allowCutModules: true,
      flightConfig: { enabled: true, mode: 'rows', stepRows: 7, offsetRows: 0, stepInches: 0, offsetInches: 0, edgeMode: 'normal', edgeIndentInches: 1, edgeIndentFit: 'exact' }
    });
    expect(result.pusherEdges).toMatchObject({ usableSizes: [3], excludedSizes: [9] });
    const pusherRows = result.rows.filter((row) => row.kind === 'pusher');
    expect(pusherRows.length).toBeGreaterThan(0);
    pusherRows.forEach((row) => {
      expect(row.segments[0]).toMatchObject({ size: 3, kind: 'normal', cutFrom: 6 });
      expect(row.segments[row.segments.length - 1]).toMatchObject({ size: 3, kind: 'normal', cutFrom: 6 });
    });
    expect(result.bom).toContainEqual(expect.objectContaining({ role: 'edge-left', sizeLinks: 3, cutFromLinks: 6 }));
  });
});
