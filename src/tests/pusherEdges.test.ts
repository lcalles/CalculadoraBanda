import { describe, expect, it } from 'vitest';
import { planBelt } from '../features/belt-planner/domain/planner';
import { resolvePusherEdges } from '../features/belt-planner/domain/pushers';
import { minimumLinksFor } from '../features/belt-planner/domain/units';
import { FlightConfig, PlannerInput } from '../features/belt-planner/types';

function input(flight: Partial<FlightConfig> = {}, partial: Partial<PlannerInput> = {}): PlannerInput {
  return {
    pitchInches: 2,
    linkIncrementInches: 0.66,
    widthInches: 24,
    lengthInches: 40,
    roundingMode: 'round',
    edgesNormal: [3, 6],
    innerNormal: [6, 9, 12],
    edgesPusher: [2, 3, 4],
    innerPusher: [6, 9],
    flightConfig: { enabled: true, mode: 'rows', stepRows: 4, offsetRows: 0, stepInches: 0, offsetInches: 0, ...flight },
    ...partial
  };
}

describe('minimumLinksFor (indent → links)', () => {
  it('redondea hacia arriba pero tolera el redondeo nominal del catálogo', () => {
    expect(minimumLinksFor(1.3, 0.66)).toBe(2); // 1.32 in
    expect(minimumLinksFor(2, 0.66)).toBe(3); // 1.98 in, el catálogo lo nombra "2 in"
    expect(minimumLinksFor(0.8, 0.33)).toBe(3); // 2 links = 0.66 in no alcanzan
    expect(minimumLinksFor(0.7, 0.33)).toBe(3);
    expect(minimumLinksFor(1.5, 1)).toBe(2);
    expect(minimumLinksFor(0.2, 1)).toBe(1);
  });
});

describe('resolvePusherEdges', () => {
  it('con orillas de empujador usa su propio inventario y aplica el indent', () => {
    expect(resolvePusherEdges(input({ edgeMode: 'pusher', edgeIndentInches: 2 }))).toEqual({
      mode: 'pusher',
      minEdgeLinks: 3,
      indentInches: 2,
      fit: 'minimum',
      usableSizes: [3, 4],
      excludedSizes: [2]
    });
  });

  it('con ajuste exacto solo usa la orilla que da el indent, ni más chica ni más grande', () => {
    const rule = resolvePusherEdges(input({ edgeMode: 'normal', edgeIndentInches: 2, edgeIndentFit: 'exact' }, { edgesNormal: [2, 3, 4, 6] }));
    expect(rule).toMatchObject({ mode: 'normal', fit: 'exact', minEdgeLinks: 3, usableSizes: [3], excludedSizes: [2, 4, 6] });
    // Sin indent el ajuste no limita nada.
    const noIndent = resolvePusherEdges(input({ edgeMode: 'normal', edgeIndentFit: 'exact' }, { edgesNormal: [2, 3, 4, 6] }));
    expect(noIndent).toMatchObject({ usableSizes: [2, 3, 4, 6], excludedSizes: [] });
  });

  it('con orillas normales toma las orillas de la banda', () => {
    const rule = resolvePusherEdges(input({ edgeMode: 'normal', edgeIndentInches: 1.3 }));
    expect(rule).toMatchObject({ mode: 'normal', minEdgeLinks: 2, usableSizes: [3, 6], excludedSizes: [] });
  });

  it('sin indent no limita y sin empujadores no aplica', () => {
    expect(resolvePusherEdges(input())).toMatchObject({ mode: 'pusher', minEdgeLinks: null, usableSizes: [2, 3, 4] });
    expect(resolvePusherEdges(input({ enabled: false }))).toBeNull();
  });
});

describe('planBelt con orillas de empujador', () => {
  it('modo "orillas de empujador": la fila completa sale del inventario de empujador', () => {
    const result = planBelt(input({ edgeMode: 'pusher' }));
    const pusherRows = result.rows.filter((row) => row.kind === 'pusher');
    expect(pusherRows.length).toBeGreaterThan(0);
    pusherRows.forEach((row) => row.segments.forEach((segment) => expect(segment.kind).toBe('pusher')));
  });

  it('modo "orillas normales": la fila de empujador lleva orillas normales y empujador solo en los internos', () => {
    const result = planBelt(input({ edgeMode: 'normal' }));
    const pusherRows = result.rows.filter((row) => row.kind === 'pusher');
    expect(pusherRows.length).toBeGreaterThan(0);
    pusherRows.forEach((row) => {
      expect(row.segments[0]).toMatchObject({ role: 'edge-left', kind: 'normal' });
      expect(row.segments[row.segments.length - 1]).toMatchObject({ role: 'edge-right', kind: 'normal' });
      expect([3, 6]).toContain(row.segments[0].size);
      row.segments.slice(1, -1).forEach((segment) => expect(segment.kind).toBe('pusher'));
    });
    // En la BOM las orillas de esas filas cuentan como orillas normales.
    expect(result.bom.some((line) => line.kind === 'pusher' && line.role !== 'inner')).toBe(false);
    expect(result.stats.alignedSeamCount).toBe(0);
  });

  it('el indent deja fuera las orillas que no lo cubren y lo explica', () => {
    const result = planBelt(input({ edgeMode: 'pusher', edgeIndentInches: 2 }));
    result.rows
      .filter((row) => row.kind === 'pusher')
      .forEach((row) => {
        expect(row.segments[0].size).toBeGreaterThanOrEqual(3);
        expect(row.segments[row.segments.length - 1].size).toBeGreaterThanOrEqual(3);
      });
    expect(result.notices).toContainEqual({
      level: 'info',
      // 0.66 in por link: 2L = 1.32 in, que se nombra 1.25 in; 3L = 1.98 in, que se nombra 2 in.
      message: 'En las filas de empujador no se usan las orillas de 1.25 in (2L): el indent de 2 in pide orillas de al menos 2 in (3L = 1.980 in).'
    });
  });

  it('si ninguna orilla cubre el indent, avisa y arma esas filas con módulos normales', () => {
    const result = planBelt(input({ edgeMode: 'pusher', edgeIndentInches: 2 }, { edgesPusher: [2] }));
    expect(result.patternsPusher).toEqual([]);
    expect(result.stats.pusherRowsBuilt).toBe(0);
    const warnings = result.notices.filter((notice) => notice.level === 'warning').map((notice) => notice.message);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Ninguna orilla de empujador elegida cubre el indent');
    expect(warnings[0]).toContain('elige orillas de 2 in (3L) o más');
  });
});

describe('planBelt con indent deseado exacto (orillas normales)', () => {
  // Caso reportado: S900 Flat Top, 36 links, orillas 3L/6L/9L, internos 9L, internos de empujador 6L/8L/9L, indent 1 in.
  // Con el indent como mínimo, las filas de empujador salían con orillas de 9L+9L o 6L+3L.
  const s900 = (flight: Partial<FlightConfig> = {}, partial: Partial<PlannerInput> = {}) =>
    input(
      { mode: 'distance', stepInches: 7.6, offsetInches: 0, edgeMode: 'normal', edgeIndentInches: 1, edgeIndentFit: 'exact', ...flight },
      {
        pitchInches: 1.07,
        linkIncrementInches: 0.33,
        widthInches: 11.88,
        lengthInches: 236.22,
        edgesNormal: [3, 6, 9],
        innerNormal: [9],
        innerPusher: [6, 8, 9],
        ...partial
      }
    );

  it('todas las filas de empujador llevan la orilla de 3L en ambos lados', () => {
    const result = planBelt(s900());
    const pusherRows = result.rows.filter((row) => row.kind === 'pusher');
    expect(pusherRows).toHaveLength(result.pusherRows.length);
    pusherRows.forEach((row) => {
      expect(row.segments[0]).toMatchObject({ role: 'edge-left', kind: 'normal', size: 3 });
      expect(row.segments[row.segments.length - 1]).toMatchObject({ role: 'edge-right', kind: 'normal', size: 3 });
      row.segments.slice(1, -1).forEach((segment) => expect(segment.kind).toBe('pusher'));
    });
    // Las filas normales siguen usando todas las orillas elegidas.
    expect(result.rows.some((row) => row.kind === 'normal' && row.segments[0].size !== 3)).toBe(true);
    // Con las orillas fijas no se pierde la anti-alineación: hay armado sin coincidencias y se encuentra.
    expect(result.stats.alignedSeamCount).toBe(0);
    expect(result.notices).toContainEqual({
      level: 'info',
      message:
        'En las filas de empujador no se usan las orillas de 2 in (6L), 3 in (9L): ' +
        'el indent deseado de 1 in pide orillas de exactamente 1 in (3L = 0.990 in).'
    });
  });

  it('si no está la orilla exacta, avisa y no la sustituye por otra', () => {
    const result = planBelt(s900({}, { edgesNormal: [6, 9] }));
    expect(result.patternsPusher).toEqual([]);
    const warnings = result.notices.filter((notice) => notice.level === 'warning').map((notice) => notice.message);
    expect(warnings).toContainEqual(expect.stringContaining('Ninguna orilla normal elegida da el indent'));
    expect(warnings).toContainEqual(expect.stringContaining('agrega la orilla de 1 in (3L)'));
  });

  it('el ajuste mínimo (comportamiento anterior) sigue permitiendo orillas más grandes', () => {
    const result = planBelt(s900({ edgeIndentFit: 'minimum' }));
    expect(result.pusherEdges).toMatchObject({ fit: 'minimum', usableSizes: [3, 6, 9] });
  });
});
