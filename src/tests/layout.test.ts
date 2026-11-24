import { describe, expect, it } from 'vitest';
import { layoutRows } from '../features/belt-planner/domain/layout';
import { buildPatterns, createRowPattern } from '../features/belt-planner/domain/patterns';
import { computePusherRows } from '../features/belt-planner/domain/pushers';
import { countSharedSeams } from '../features/belt-planner/domain/seams';
import { FlightConfig, PlannedRow, RowPattern } from '../features/belt-planner/types';
import { legacyLayoutRows, legacyMakeRowPatterns } from './fixtures/legacyPlanner';

const sizesOf = (row: { segments: { size: number }[] }) => row.segments.map((segment) => segment.size);

function flights(stepRows: number, offsetRows = 0): FlightConfig {
  return { enabled: true, mode: 'rows', stepRows, offsetRows, stepInches: 0, offsetInches: 0 };
}

function layout(width: number, normal: RowPattern[], pusher: RowPattern[], rowsCount: number, pusherRows: Set<number> = new Set()) {
  return layoutRows({ rowsCount, widthLinks: width, normalPatterns: normal, pusherPatterns: pusher, pusherRowNumbers: pusherRows });
}

/** Cada fila debe tener la menor coincidencia posible contra la fila que realmente quedó antes. */
function expectLocallyMinimalAlignment(rows: PlannedRow[], normal: RowPattern[], pusher: RowPattern[]) {
  for (let index = 1; index < rows.length; index += 1) {
    const candidates = rows[index].kind === 'pusher' ? pusher : normal;
    const bestPossible = Math.min(...candidates.map((candidate) => countSharedSeams(candidate.seams, rows[index - 1].seams)));
    expect(rows[index].alignedSeams.length).toBe(bestPossible);
    expect(rows[index].alignedSeams.length).toBe(countSharedSeams(rows[index].seams, rows[index - 1].seams));
  }
}

describe('layoutRows', () => {
  it('evita juntas alineadas entre filas adyacentes cuando hay patrones que lo permiten', () => {
    const patterns = buildPatterns(20, [12, 8, 6, 4, 2], [12, 8, 6, 4, 2], 'normal');
    const rows = layout(20, patterns, [], 6);
    expect(rows).toHaveLength(6);
    rows.forEach((row) => expect(row.alignedSeams).toEqual([]));
    expect(new Set(rows.map((row) => row.seams.join(','))).size).toBeGreaterThanOrEqual(2);
  });

  it('si no hay armado sin coincidencias, la combinación es inválida y no arma filas', () => {
    // Con una sola orilla de 2L, las juntas 2 y W-2 coinciden siempre entre dos filas normales.
    const patterns = buildPatterns(20, [2], [8, 6, 4], 'normal');
    expect(layout(20, patterns, [], 8)).toEqual([]);
    // Una sola fila no tiene vecinas: es válida.
    expect(layout(20, patterns, [], 1)).toHaveLength(1);
  });

  it('arma sin coincidencias siempre que exista un armado así, y si no existe no arma nada', () => {
    // Oráculo: mínimo exacto de juntas alineadas por programación dinámica sobre todas las filas.
    const optimalAligned = (rowsCount: number, normal: RowPattern[], pusher: RowPattern[], pusherRows: Set<number>) => {
      const patternsOf = (row: number) => (pusher.length > 0 && pusherRows.has(row) ? pusher : normal);
      let previous = patternsOf(1);
      let cost = previous.map(() => 0);
      for (let row = 2; row <= rowsCount; row += 1) {
        const current = patternsOf(row);
        cost = current.map((pattern) => Math.min(...previous.map((before, index) => cost[index] + countSharedSeams(pattern.seams, before.seams))));
        previous = current;
      }
      return Math.min(...cost);
    };
    const cases: Array<[number, number[], number[], number, number[], number, number]> = [
      // ancho, orillas, internos, orilla exacta de empujador, internos de empujador, paso, offset
      [36, [3, 6, 9], [9], 3, [6, 8, 9], 7, 0],
      [36, [3, 6, 9], [6, 9], 3, [6, 8, 9], 7, 0],
      [30, [3, 9], [6, 9], 3, [6, 9], 3, 0], // inválida: dos filas normales seguidas obligadas a 9·6·6·9
      [30, [3, 9], [6, 9], 3, [6, 9], 5, 1],
      [30, [3, 6], [8, 9], 3, [8, 9, 12], 3, 0],
      [42, [3, 6, 9], [6, 8, 9], 3, [6, 8, 9], 4, 1],
      [48, [3, 6], [9, 12], 6, [6, 9], 2, 0]
    ];
    cases.forEach(([width, edges, inner, exactEdge, pusherInner, step, offset]) => {
      const normal = buildPatterns(width, edges, inner, 'normal');
      const pusher = buildPatterns(width, [exactEdge], pusherInner, 'pusher', { edgeKind: 'normal' });
      const pusherRows = computePusherRows(flights(step, offset), 40, 1);
      const rows = layout(width, normal, pusher, 40, pusherRows);
      if (optimalAligned(40, normal, pusher, pusherRows) === 0) {
        expect(rows).toHaveLength(40);
        rows.forEach((row) => expect(row.alignedSeams).toEqual([]));
      } else {
        expect(rows).toEqual([]);
      }
    });
  });

  it('compara cada fila de empujador contra la fila normal que realmente queda antes', () => {
    const normal = buildPatterns(48, [2, 3], [4, 6, 8], 'normal');
    const pusher = buildPatterns(48, [3, 4], [6, 10], 'pusher');
    const pusherRows = computePusherRows(flights(3, 1), 30, 1);
    const rows = layout(48, normal, pusher, 30, pusherRows);

    rows.forEach((row) => {
      expect(row.kind).toBe(pusherRows.has(row.rowNumber) ? 'pusher' : 'normal');
      row.segments.forEach((segment) => expect(segment.kind).toBe(row.kind));
    });
    expectLocallyMinimalAlignment(rows, normal, pusher);
    expect(rows.every((row) => row.alignedSeams.length === 0)).toBe(true);
  });

  it('mira una fila adelante para no dejar sin opción limpia a la fila siguiente', () => {
    // N1 tiene más prioridad, pero su junta (5) coincide con el único patrón de empujador.
    const n1 = createRowPattern(5, [], 5, 'normal');
    const n2 = createRowPattern(3, [], 7, 'normal');
    const p1 = createRowPattern(5, [], 5, 'pusher');
    const rows = layout(10, [n1, n2], [p1], 2, new Set([2]));
    expect(sizesOf(rows[0])).toEqual([3, 7]);
    expect(rows[1].kind).toBe('pusher');
    expect(rows[1].alignedSeams).toEqual([]);
  });

  it('encuentra el armado sin coincidencias aunque haya que decidirlo varias filas antes del empujador', () => {
    // Caso S900 con indent deseado de 1 in: la fila de empujador lleva orillas fijas de 3L (juntas en 3 y 33),
    // así que la fila normal de antes debe ser 9·9·9·9. Con una fila adelante, alternar 9·9·9·9 / 6·9·9·9·3
    // dejaba 6·9·9·9·3 justo antes del empujador (junta 33 alineada). Hay que decidirlo varias filas antes.
    const a = createRowPattern(9, [9, 9], 9, 'normal');
    const b = createRowPattern(6, [9, 9, 9], 3, 'normal');
    const c = createRowPattern(3, [9, 9, 9], 6, 'normal');
    const p = createRowPattern(3, [8, 8, 6, 8], 3, 'pusher');
    const pusherRows = new Set([1, 8, 15, 22]);
    const rows = layout(36, [a, b, c], [p], 25, pusherRows);
    expect(rows.map((row) => row.kind)).toEqual(rows.map((row) => (pusherRows.has(row.rowNumber) ? 'pusher' : 'normal')));
    rows.forEach((row) => expect(row.alignedSeams).toEqual([]));
    rows.filter((row) => pusherRows.has(row.rowNumber + 1)).forEach((row) => expect(sizesOf(row)).toEqual([9, 9, 9, 9]));
  });

  it('arma las filas de empujador con módulos normales si no hay patrón de empujador', () => {
    const normal = buildPatterns(20, [2, 3], [8, 4, 6], 'normal');
    const rows = layout(20, normal, [], 4, new Set([2, 4]));
    rows.forEach((row) => expect(row.alignedSeams).toEqual([]));
    expect(rows.map((row) => row.kind)).toEqual(['normal', 'normal', 'normal', 'normal']);
    expect(rows.map((row) => row.pusherRequested)).toEqual([false, true, false, true]);
  });

  it('no arma filas sin patrones normales', () => {
    expect(layout(20, [], [createRowPattern(10, [], 10, 'pusher')], 3)).toEqual([]);
  });

  it('elige el par de filas con menos piezas aunque un patrón aislado tenga piezas más grandes', () => {
    // 23 links, orillas 6L/9L, internos 2L..9L. 9·5·9 gana aislado (regla 9), pero choca con los otros
    // patrones de 3 piezas y obliga a la fila siguiente a usar 4 (6·9·2·6). 9·8·6 / 6·8·9 no se alinean y usan 3 + 3.
    const patterns = buildPatterns(23, [6, 9], [2, 3, 4, 5, 6, 7, 8, 9], 'normal');
    const rows = layout(23, patterns, [], 234);
    rows.forEach((row) => {
      expect(row.alignedSeams).toEqual([]);
      expect(row.pieceCount).toBe(3);
    });
    expect(new Set(rows.map((row) => sizesOf(row).join('-')))).toEqual(new Set(['9-8-6', '6-8-9']));
  });

  it('en filas normales nunca usa más piezas que alternar el mejor par de patrones compatibles', () => {
    const cases: Array<[number, number[], number[]]> = [
      [23, [6, 9], [2, 3, 4, 5, 6, 7, 8, 9]],
      [20, [12, 8, 6, 4, 2], [12, 8, 6, 4, 2]],
      [48, [2, 3], [4, 6, 8]],
      [30, [3, 5], [4, 6, 10]],
      [37, [4, 7, 9], [2, 3, 5, 8, 11]],
      [52, [5, 8, 10], [3, 4, 6, 9, 12, 14]]
    ];
    const rowsCount = 40; // par: alternar un par A/B da exactamente rowsCount/2 * (A + B)
    cases.forEach(([width, edges, inners]) => {
      const patterns = buildPatterns(width, edges, inners, 'normal');
      let bestPair = { overlap: Number.POSITIVE_INFINITY, pieces: Number.POSITIVE_INFINITY };
      patterns.forEach((a) =>
        patterns.forEach((b) => {
          const overlap = countSharedSeams(a.seams, b.seams);
          const pieces = a.pieceCount + b.pieceCount;
          if (overlap < bestPair.overlap || (overlap === bestPair.overlap && pieces < bestPair.pieces)) {
            bestPair = { overlap, pieces };
          }
        })
      );

      const rows = layout(width, patterns, [], rowsCount);
      const aligned = rows.reduce((total, row) => total + row.alignedSeams.length, 0);
      const pieces = rows.reduce((total, row) => total + row.pieceCount, 0);
      expect(aligned).toBeLessThanOrEqual((rowsCount - 1) * bestPair.overlap);
      if (aligned === (rowsCount - 1) * bestPair.overlap) {
        expect(pieces).toBeLessThanOrEqual((rowsCount / 2) * bestPair.pieces);
      }
    });
  });

  it('cuando la versión validada armaba sin coincidencias, también arma; y nunca entrega coincidencias', () => {
    const cases: Array<[number, number[], number[], number]> = [
      [20, [12, 8, 6, 4, 2], [12, 8, 6, 4, 2], 40],
      [48, [2, 3], [4, 6, 8], 60],
      [20, [2], [8, 6, 4], 30],
      [36, [3], [6, 9, 12], 25],
      [30, [3, 5], [4, 6, 10], 50]
    ];
    cases.forEach(([width, edges, inners, rowsCount]) => {
      const legacyPatterns = legacyMakeRowPatterns(width, edges, inners, 500);
      const legacyRows = legacyLayoutRows(rowsCount, legacyPatterns) as Array<{ seams: number[] }>;
      const legacyAligned = legacyRows.reduce(
        (total, row, index) => total + (index === 0 ? 0 : countSharedSeams(row.seams, legacyRows[index - 1].seams)),
        0
      );
      const rows = layout(width, buildPatterns(width, edges, inners, 'normal'), [], rowsCount);
      rows.forEach((row) => expect(row.alignedSeams).toEqual([]));
      if (legacyAligned === 0) expect(rows).toHaveLength(rowsCount);
    });
  });
});
