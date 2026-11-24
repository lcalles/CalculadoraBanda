import { describe, expect, it } from 'vitest';
import { planBelt } from '../features/belt-planner/domain/planner';
import { escapeCsvField, planFilePrefix, toBomCsv, toPlanJson, toSeamsCsv } from '../features/belt-planner/exporters';
import { PlannerInput } from '../features/belt-planner/types';

const input: PlannerInput = {
  pitchInches: 1,
  linkIncrementInches: 0.5,
  widthInches: 10,
  lengthInches: 4,
  roundingMode: 'round',
  // Con dos tamaños de orilla hay armado sin juntas alineadas (con uno solo, las juntas 2 y W-2 se alinean siempre).
  edgesNormal: [2, 3],
  innerNormal: [4, 6],
  edgesPusher: [2, 3],
  innerPusher: [4, 6],
  flightConfig: { enabled: true, mode: 'rows', stepRows: 2, offsetRows: 0, stepInches: 0, offsetInches: 0 }
};

describe('exportadores', () => {
  const result = planBelt(input);

  it('el plan de prueba es una combinación válida', () => {
    expect(result.rows).toHaveLength(4);
    expect(result.stats.alignedSeamCount).toBe(0);
  });

  it('escapa comas, comillas y saltos de línea en CSV', () => {
    expect(escapeCsvField('simple')).toBe('simple');
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('dice "hola"')).toBe('"dice ""hola"""');
    expect(escapeCsvField('dos\nlíneas')).toBe('"dos\nlíneas"');
  });

  it('BOM CSV: pulgadas primero, una línea por tipo/rol/tamaño', () => {
    const lines = toBomCsv(result.bom, 0.5).split('\r\n');
    // En cada par, la columna en pulgadas va antes que la de links; las de corte quedan vacías en piezas enteras.
    expect(lines[0]).toBe('Tipo,Rol,Tamaño (in),Tamaño (links),Ancho real (in),Cantidad,Cortado de (in),Cortado de (links)');
    expect(lines).toHaveLength(result.bom.length + 1);
    const leftEdge = result.bom.find((line) => line.kind === 'normal' && line.role === 'edge-left')!;
    const inches = leftEdge.sizeLinks * 0.5;
    expect(lines).toContain(`Normal,Orilla izquierda,${inches},${leftEdge.sizeLinks},${inches.toFixed(3)},${leftEdge.quantity},,`);
  });

  it('BOM CSV: el tamaño en pulgadas es el nombre redondeado al cuarto y el ancho real es exacto', () => {
    const bom = [{ kind: 'normal' as const, role: 'inner' as const, sizeLinks: 8, widthInches: 2.64, quantity: 5, cutFromLinks: 9 }];
    expect(toBomCsv(bom, 0.33).split('\r\n')[1]).toBe('Normal,Interno,2.75,8,2.640,5,3,9');
  });

  it('BOM CSV y JSON: las piezas cortadas dicen de qué módulo salen', () => {
    const cutInput: PlannerInput = { ...input, innerNormal: [6], innerPusher: [6], allowCutModules: true };
    const cutResult = planBelt(cutInput);
    const cutLine = cutResult.bom.find((line) => line.cutFromLinks !== undefined)!;
    expect(cutLine).toBeDefined();
    const csv = toBomCsv(cutResult.bom, 0.5).split('\r\n');
    expect(
      csv.some((line) => line.endsWith(`,${cutLine.quantity},${cutLine.cutFromLinks! * 0.5},${cutLine.cutFromLinks}`) && line.includes(`,${cutLine.sizeLinks},`))
    ).toBe(true);
    const document = JSON.parse(toPlanJson(cutInput, cutResult));
    const modules = document.rows.flatMap((row: { modules: Array<{ cutFrom?: number }> }) => row.modules);
    expect(modules).toContainEqual(expect.objectContaining({ cutFromInches: cutLine.cutFromLinks! * 0.5, cutFrom: cutLine.cutFromLinks }));
    const whole = modules.filter((module: { cutFrom?: number }) => module.cutFrom === undefined);
    expect(whole.every((module: object) => !('cutFrom' in module) && !('cutFromInches' in module))).toBe(true);
    expect(document.bom).toContainEqual(expect.objectContaining({ cutFromInches: cutLine.cutFromLinks! * 0.5, cutFromLinks: cutLine.cutFromLinks }));
  });

  it('juntas CSV: pulgadas primero, una línea por fila con composición y juntas alineadas', () => {
    const lines = toSeamsCsv(result.rows, 0.5).split('\r\n');
    expect(lines[0]).toBe(
      'Fila,Tipo,Composición (in),Composición (links),Piezas,Juntas (in),Juntas (links),' +
        'Juntas alineadas con fila anterior (in),Juntas alineadas con fila anterior (links)'
    );
    expect(lines).toHaveLength(result.rows.length + 1);
    const row = result.rows[0];
    expect(lines[1]).toBe(
      `1,Empujador,${row.segments.map((s) => s.size * 0.5).join(' ')},${row.segments.map((s) => s.size).join(' ')},${row.pieceCount},` +
        `${row.seams.map((seam) => seam * 0.5).join(' ')},${row.seams.join(' ')},,`
    );
  });

  it('juntas CSV: composición con el nombre de cada módulo y juntas en pulgadas redondeadas al cuarto', () => {
    // S900: 3L = 0.99 in (nombre 1), 9L = 2.97 in (nombre 3); juntas en los links 3 y 12 (0.99 y 3.96 in).
    const [row] = planBelt({
      ...input,
      linkIncrementInches: 0.33,
      widthInches: 4.95,
      lengthInches: 1,
      edgesNormal: [3],
      innerNormal: [9],
      flightConfig: { ...input.flightConfig, enabled: false }
    }).rows;
    expect(row.segments.map((segment) => segment.size)).toEqual([3, 9, 3]);
    expect(toSeamsCsv([row], 0.33).split('\r\n')[1]).toBe('1,Normal,1 3 1,3 9 3,3,1 4,3 12,,');
  });

  it('JSON: incluye parámetros, filas de empujador como lista y todas las filas', () => {
    const document = JSON.parse(toPlanJson(input, result, new Date('2026-01-01T00:00:00Z')));
    expect(document.version).toBe(3);
    expect(document.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(document.input).toEqual(input);
    expect(document.pushers.rows).toEqual([1, 3]);
    expect(document.rows).toHaveLength(4);
    expect(document.summary.widthLinks).toBe(20);
    expect(document.summary.realWidthInches).toBe(10);
    expect(document).not.toHaveProperty('patternsNormal');
  });

  it('JSON: pulgadas primero; las claves en links de la versión 2 se conservan', () => {
    const document = JSON.parse(toPlanJson(input, result));
    const firstSize = result.rows[0].segments[0].size;
    expect(document.inchRoundingStep).toBe(0.25);
    expect(document.rows[0].modules[0]).toEqual({ role: 'edge-left', sizeInches: firstSize * 0.5, size: firstSize });
    expect(Object.keys(document.rows[0].modules[0])).toEqual(['role', 'sizeInches', 'size']);
    expect(document.rows[0].seamsInches).toEqual(result.rows[0].seams.map((seam) => seam * 0.5));
    expect(document.rows[0].seams).toEqual(result.rows[0].seams);
    expect(Object.keys(document.rows[0])).toEqual(['rowNumber', 'kind', 'pusherRequested', 'modules', 'seamsInches', 'seams', 'alignedSeamsInches', 'alignedSeams']);
    const line = result.bom[0];
    expect(document.bom[0]).toEqual({
      kind: line.kind,
      role: line.role,
      sizeInches: line.sizeLinks * 0.5,
      sizeLinks: line.sizeLinks,
      widthInches: line.widthInches,
      quantity: line.quantity
    });
  });

  it('JSON: tamaños y juntas en pulgadas redondeados al cuarto; ancho exacto sin ruido de punto flotante', () => {
    const s900: PlannerInput = {
      ...input,
      linkIncrementInches: 0.33,
      widthInches: 4.95,
      lengthInches: 1,
      edgesNormal: [3],
      innerNormal: [9],
      flightConfig: { ...input.flightConfig, enabled: false }
    };
    const document = JSON.parse(toPlanJson(s900, planBelt(s900)));
    expect(document.rows[0].seamsInches).toEqual([1, 4]);
    expect(document.rows[0].modules.map((module: { sizeInches: number }) => module.sizeInches)).toEqual([1, 3, 1]);
    expect(document.summary.realWidthInches).toBe(4.95);
  });

  it('nombra los archivos con ancho y filas', () => {
    expect(planFilePrefix(48, 60)).toBe('banda-48L-60filas');
  });

  it('el título del cálculo encabeza el nombre de archivo y va en el JSON', () => {
    expect(planFilePrefix(36, 60, 'S800 Flat Top', 'Banda para orden de venta 8926')).toBe(
      'banda-para-orden-de-venta-8926-s800-flat-top-36L-60filas'
    );
    expect(planFilePrefix(36, 60, undefined, 'Línea 3: transportador ñ')).toBe('linea-3-transportador-n-banda-36L-60filas');
    // Un título largo se recorta para no hacer nombres de archivo enormes.
    expect(planFilePrefix(36, 60, undefined, 'x'.repeat(100))).toBe(`${'x'.repeat(40)}-banda-36L-60filas`);
    expect(planFilePrefix(36, 60, undefined, '   ')).toBe('banda-36L-60filas');

    const withTitle = JSON.parse(toPlanJson(input, result, new Date('2026-01-01T00:00:00Z'), null, 'OV 8926'));
    expect(withTitle.title).toBe('OV 8926');
    expect(JSON.parse(toPlanJson(input, result)).title).toBeNull();
  });
});
