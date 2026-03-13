import { describe, expect, it } from 'vitest';
import {
  buildPatterns,
  combinationsForTarget,
  computePusherRows,
  planBelt,
  roundLinks
} from '../features/belt-planner/domain/planner';

describe('planner domain', () => {
  it('aplica redondeos correctos de ancho', () => {
    expect(roundLinks(10.2, 0.5, 'round')).toBe(20);
    expect(roundLinks(10.2, 0.5, 'floor')).toBe(20);
    expect(roundLinks(10.2, 0.5, 'ceil')).toBe(21);
  });

  it('genera combinaciones exactas para objetivo', () => {
    const combos = combinationsForTarget(10, [6, 4, 2]);
    expect(combos.some((combo) => combo.join('-') === '6-4')).toBeTruthy();
    expect(combos.some((combo) => combo.join('-') === '4-2-2-2')).toBeTruthy();
  });

  it('permite fila solo con orillas cuando suman ancho total', () => {
    const patterns = buildPatterns(10, [5], [2, 3], 'normal');
    expect(patterns.some((pattern) => pattern.segments.length === 2)).toBeTruthy();
  });

  it('calcula filas de empujador por paso en filas', () => {
    const rows = computePusherRows(
      { enabled: true, mode: 'rows', stepRows: 3, offsetRows: 1, stepInches: 0, offsetInches: 0 },
      10,
      1
    );
    expect([...rows]).toEqual([2, 5, 8]);
  });

  it('construye plan con BOM y juntas', () => {
    const result = planBelt({
      pitchInches: 1,
      linkIncrementInches: 0.5,
      widthInches: 20,
      lengthInches: 5,
      roundingMode: 'round',
      edgesNormal: [2],
      innerNormal: [4, 6],
      edgesPusher: [2],
      innerPusher: [4, 6],
      flightConfig: { enabled: true, mode: 'rows', stepRows: 2, offsetRows: 0, stepInches: 0, offsetInches: 0 }
    });

    expect(result.rows.length).toBe(result.rowsCount);
    expect(Object.keys(result.bom).length).toBeGreaterThan(0);
    expect(result.uniqueSeamSets).toBeGreaterThan(0);
  });
});
