import { describe, expect, it } from 'vitest';
import { planBelt } from '../features/belt-planner/domain/planner';
import { AVAILABLE_MODULE_SIZES } from '../features/belt-planner/domain/constants';
import { availableModuleSizes } from '../features/belt-planner/domain/moduleSizes';
import { PlannerInput } from '../features/belt-planner/types';

function input(partial: Partial<PlannerInput> = {}): PlannerInput {
  return {
    pitchInches: 1,
    linkIncrementInches: 0.5,
    widthInches: 24,
    lengthInches: 60,
    roundingMode: 'round',
    edgesNormal: [2, 3],
    innerNormal: [4, 6, 8],
    edgesPusher: [2, 3],
    innerPusher: [4, 6],
    flightConfig: { enabled: true, mode: 'rows', stepRows: 4, offsetRows: 0, stepInches: 6, offsetInches: 0 },
    ...partial
  };
}

describe('planBelt', () => {
  it('convierte medidas y arma todas las filas con el ancho exacto', () => {
    const result = planBelt(input());
    expect(result.widthLinks).toBe(48);
    expect(result.realWidthInches).toBe(24);
    expect(result.rowsCount).toBe(60);
    expect(result.rows).toHaveLength(60);
    result.rows.forEach((row, index) => {
      expect(row.rowNumber).toBe(index + 1);
      expect(row.segments.reduce((sum, segment) => sum + segment.size, 0)).toBe(48);
      expect(row.segments[0].role).toBe('edge-left');
      expect(row.segments[row.segments.length - 1].role).toBe('edge-right');
    });
  });

  it('coloca empujadores según la configuración y los arma con su inventario', () => {
    const result = planBelt(input());
    expect(result.pusherRows).toEqual(Array.from({ length: 15 }, (_, index) => 1 + index * 4));
    expect(result.stats.pusherRowsBuilt).toBe(15);
    result.rows.forEach((row) => {
      const expectedKind = result.pusherRows.includes(row.rowNumber) ? 'pusher' : 'normal';
      expect(row.kind).toBe(expectedKind);
    });
  });

  it('con la configuración por defecto no deja juntas alineadas', () => {
    const result = planBelt(input());
    expect(result.stats.alignedSeamCount).toBe(0);
    expect(result.notices.filter((notice) => notice.level === 'warning')).toEqual([]);
  });

  it('no usa más piezas de las necesarias al tener más tamaños internos disponibles', () => {
    // 15 in a 0.66 in/link = 23 links; 39 ft a pitch 2 in = 234 filas. Orillas 6L/9L.
    const measures = {
      pitchInches: 2,
      linkIncrementInches: 0.66,
      widthInches: 15,
      lengthInches: 39 * 12,
      edgesNormal: [6, 9],
      flightConfig: { ...input().flightConfig, enabled: false }
    };
    const fewInners = planBelt(input({ ...measures, innerNormal: [6, 8, 9] }));
    const allInners = planBelt(input({ ...measures, innerNormal: [2, 3, 4, 5, 6, 7, 8, 9] }));
    expect(fewInners.rowsCount).toBe(234);
    expect(fewInners.stats.totalPieces).toBe(702);
    expect(allInners.stats.totalPieces).toBe(702);
    expect(allInners.stats.alignedSeamCount).toBe(0);
  });

  it('la BOM cuadra con las filas', () => {
    const result = planBelt(input());
    const pieces = result.rows.reduce((sum, row) => sum + row.pieceCount, 0);
    expect(result.stats.totalPieces).toBe(pieces);
    expect(result.stats.normalPieces + result.stats.pusherPieces).toBe(pieces);
    expect(result.bom.some((line) => line.kind === 'pusher')).toBe(true);
  });

  it('avisa y arma con módulos normales cuando el inventario de empujador no completa el ancho', () => {
    const result = planBelt(input({ edgesPusher: [2], innerPusher: [5], widthInches: 24.5 }));
    // 49 links: 2 + 2 + 45 = múltiplo de 5 → sí hay patrón; forzamos uno imposible:
    const impossible = planBelt(input({ edgesPusher: [2], innerPusher: [4] , widthInches: 24.5 }));
    expect(result.patternsPusher.length).toBeGreaterThan(0);
    expect(impossible.patternsPusher).toEqual([]);
    expect(impossible.stats.pusherRowsBuilt).toBe(0);
    expect(impossible.rows.filter((row) => row.pusherRequested)).toHaveLength(impossible.pusherRows.length);
    expect(impossible.notices.some((notice) => notice.level === 'warning' && notice.message.includes('empujador'))).toBe(true);
  });

  it('sin patrón normal no arma filas y lo explica', () => {
    const result = planBelt(input({ edgesNormal: [2], innerNormal: [4], widthInches: 24.5 }));
    expect(result.rows).toEqual([]);
    expect(result.notices[0]).toMatchObject({ level: 'warning' });
    expect(result.notices[0].message).toContain('suma 24.500 in (49 links)');
  });

  it('informa cuando el ancho, el largo o el paso de empujadores se ajustan', () => {
    const result = planBelt(
      input({
        widthInches: 24.2,
        lengthInches: 60.4,
        flightConfig: { enabled: true, mode: 'distance', stepRows: 0, offsetRows: 0, stepInches: 6.3, offsetInches: 0 }
      })
    );
    const infos = result.notices.filter((notice) => notice.level === 'info').map((notice) => notice.message);
    expect(infos.some((message) => message.startsWith('El ancho quedó en 24.000 in = 48 links'))).toBe(true);
    expect(infos.some((message) => message.startsWith('El largo quedó en 60 filas'))).toBe(true);
    expect(infos.some((message) => message.includes('6.3 in se ajustó a 6 filas'))).toBe(true);
  });

  it('avisa cuando la configuración no coloca ningún empujador', () => {
    const result = planBelt(input({ lengthInches: 5, flightConfig: { ...input().flightConfig, offsetRows: 10 } }));
    expect(result.pusherRows).toEqual([]);
    expect(result.notices.some((notice) => notice.message.includes('no cae ningún empujador'))).toBe(true);
  });

  it('si las juntas alineadas no se pueden evitar, la combinación es inválida: sin filas, sin BOM y con la causa', () => {
    const result = planBelt(input({ edgesNormal: [2], innerNormal: [6, 8], widthInches: 10, flightConfig: { ...input().flightConfig, enabled: false } }));
    expect(result.patternsNormal.length).toBeGreaterThan(0);
    expect(result.rows).toEqual([]);
    expect(result.bom).toEqual([]);
    const warning = result.notices.find((notice) => notice.level === 'warning')!.message;
    expect(warning).toContain('Combinación inválida: con estos tamaños no hay forma de armar las 60 filas sin juntas alineadas');
    expect(warning).toContain('no se puede llegar a la fila 2');
    // Con un único patrón posible, todas sus juntas son inevitables y el aviso lo dice.
    expect(warning).toContain('Las juntas en 1, 5 y 9 in (links 2, 10 y 18) aparecen en todos los armados normales');
  });

  it('explica cuando las orillas fijas del indent deseado dejan juntas que las filas normales no pueden evitar', () => {
    // 30 links, orillas 3L/9L, internos 6L/9L, empujador cada 3 filas con orillas fijas de 3L (juntas en 3 y 27):
    // las dos filas normales entre empujadores tendrían que ser ambas 9·6·6·9.
    const result = planBelt(
      input({
        pitchInches: 1,
        linkIncrementInches: 0.33,
        widthInches: 9.9,
        lengthInches: 40,
        edgesNormal: [3, 9],
        innerNormal: [6, 9],
        innerPusher: [6, 9],
        flightConfig: { enabled: true, mode: 'rows', stepRows: 3, offsetRows: 0, stepInches: 0, offsetInches: 0, edgeMode: 'normal', edgeIndentInches: 1, edgeIndentFit: 'exact' }
      })
    );
    expect(result.widthLinks).toBe(30);
    expect(result.rows).toEqual([]);
    const warning = result.notices.find((notice) => notice.level === 'warning')!.message;
    expect(warning).toContain('Combinación inválida');
    expect(warning).toContain('(de empujador)');
    expect(warning).toContain(
      'Todas las filas de empujador tienen juntas en 1 y 9 in (links 3 y 27), porque el indent deseado de 1 in fija sus orillas en 1 in (3L);'
    );
    expect(warning).toContain('o cambia el paso de los empujadores');
  });

  it('resuelve un caso grande en poco tiempo', () => {
    const started = performance.now();
    const result = planBelt(
      input({
        widthInches: 100,
        lengthInches: 4000,
        edgesNormal: [...AVAILABLE_MODULE_SIZES],
        innerNormal: [...AVAILABLE_MODULE_SIZES],
        edgesPusher: [...AVAILABLE_MODULE_SIZES],
        innerPusher: [...AVAILABLE_MODULE_SIZES],
        flightConfig: { enabled: true, mode: 'rows', stepRows: 3, offsetRows: 0, stepInches: 0, offsetInches: 0 }
      })
    );
    const elapsed = performance.now() - started;
    expect(result.rows).toHaveLength(4000);
    expect(result.patternsNormal).toHaveLength(500);
    expect(result.stats.alignedSeamCount).toBe(0);
    expect(elapsed).toBeLessThan(4000);
  });

  it('resuelve un caso grande con el rango de tamaños más amplio (0.25 in por link → hasta 48L)', () => {
    const sizes = availableModuleSizes(0.25);
    expect(sizes[sizes.length - 1]).toBe(48);
    const started = performance.now();
    const result = planBelt(
      input({
        linkIncrementInches: 0.25,
        widthInches: 100,
        lengthInches: 4000,
        edgesNormal: sizes,
        innerNormal: sizes,
        edgesPusher: sizes,
        innerPusher: sizes,
        flightConfig: { enabled: true, mode: 'rows', stepRows: 3, offsetRows: 0, stepInches: 0, offsetInches: 0 }
      })
    );
    const elapsed = performance.now() - started;
    expect(result.widthLinks).toBe(400);
    expect(result.rows).toHaveLength(4000);
    // Con piezas de hasta 48L, la fila de menos piezas usa módulos grandes.
    expect(Math.max(...result.rows[0].segments.map((segment) => segment.size))).toBeGreaterThan(20);
    expect(result.stats.alignedSeamCount).toBe(0);
    expect(elapsed).toBeLessThan(4000);
  });

  it('acepta el módulo de 36 links de la S900 (0.33 in por link)', () => {
    const result = planBelt(
      input({
        pitchInches: 1.07,
        linkIncrementInches: 0.33,
        widthInches: 23.76, // 72 links: p. ej. 9·36·18·9 alternando con 3·36·18·9·6, sin juntas alineadas
        edgesNormal: [3, 6, 9],
        innerNormal: [9, 18, 36],
        flightConfig: { ...input().flightConfig, enabled: false }
      })
    );
    expect(result.widthLinks).toBe(72);
    expect(result.rows.some((row) => row.segments.some((segment) => segment.size === 36))).toBe(true);
    expect(result.bom).toContainEqual(expect.objectContaining({ role: 'inner', sizeLinks: 36 }));
  });
});
