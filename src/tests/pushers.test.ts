import { describe, expect, it } from 'vitest';
import { computePusherRows, resolvePusherSpacing } from '../features/belt-planner/domain/pushers';
import { FlightConfig } from '../features/belt-planner/types';
import { legacyCalcPusherRows } from './fixtures/legacyPlanner';

function config(partial: Partial<FlightConfig>): FlightConfig {
  return { enabled: true, mode: 'rows', stepRows: 1, offsetRows: 0, stepInches: 0, offsetInches: 0, ...partial };
}

const sorted = (rows: Set<number>) => [...rows].sort((a, b) => a - b);

describe('computePusherRows', () => {
  it('por filas: primera fila en 1 + offset y luego cada paso', () => {
    expect(sorted(computePusherRows(config({ stepRows: 3, offsetRows: 1 }), 10, 1))).toEqual([2, 5, 8]);
  });

  it('por distancia: convierte paso y offset a filas con el pitch', () => {
    expect(sorted(computePusherRows(config({ mode: 'distance', stepInches: 10 }), 25, 1))).toEqual([1, 11, 21]);
    // pitch 0.5: paso 2.2 in = 4.4 filas → 4; offset 0.6 in = 1.2 filas → 1
    expect(sorted(computePusherRows(config({ mode: 'distance', stepInches: 2.2, offsetInches: 0.6 }), 12, 0.5))).toEqual([2, 6, 10]);
  });

  it('desactivado no marca ninguna fila', () => {
    expect(computePusherRows(config({ enabled: false, stepRows: 2 }), 10, 1).size).toBe(0);
  });

  it('un paso menor a 1 se trata como 1', () => {
    expect(sorted(computePusherRows(config({ stepRows: 0 }), 3, 1))).toEqual([1, 2, 3]);
  });

  it('coincide con la versión validada', () => {
    const cases: Array<[FlightConfig, number, number]> = [
      [config({ stepRows: 4 }), 60, 1],
      [config({ stepRows: 7, offsetRows: 3 }), 50, 1],
      [config({ mode: 'distance', stepInches: 6, offsetInches: 2 }), 40, 1],
      [config({ mode: 'distance', stepInches: 5, offsetInches: 1.5 }), 80, 0.5]
    ];
    cases.forEach(([flight, rows, pitch]) => {
      const legacy = legacyCalcPusherRows(
        rows,
        flight.enabled,
        flight.mode,
        flight.stepRows,
        flight.offsetRows,
        flight.stepInches,
        flight.offsetInches,
        pitch
      ) as Set<number>;
      expect(sorted(computePusherRows(flight, rows, pitch))).toEqual(sorted(legacy));
    });
  });
});

describe('resolvePusherSpacing', () => {
  it('reporta el paso y offset efectivos en filas y pulgadas', () => {
    expect(resolvePusherSpacing(config({ mode: 'distance', stepInches: 10.3, offsetInches: 0 }), 1)).toEqual({
      stepRows: 10,
      offsetRows: 0,
      stepInches: 10,
      offsetInches: 0
    });
    expect(resolvePusherSpacing(config({ stepRows: 4, offsetRows: 2 }), 0.5)).toEqual({
      stepRows: 4,
      offsetRows: 2,
      stepInches: 2,
      offsetInches: 1
    });
  });
});
