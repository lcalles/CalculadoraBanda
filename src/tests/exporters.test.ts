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

  it('BOM CSV: una línea por tipo/rol/tamaño con ancho en pulgadas', () => {
    const lines = toBomCsv(result.bom).split('\r\n');
    // "Cortado de (links)" va al final para no mover las columnas anteriores; vacío en piezas enteras.
    expect(lines[0]).toBe('Tipo,Rol,Tamaño (links),Ancho (in),Cantidad,Cortado de (links)');
    expect(lines).toHaveLength(result.bom.length + 1);
    const leftEdge = result.bom.find((line) => line.kind === 'normal' && line.role === 'edge-left')!;
    expect(lines).toContain(`Normal,Orilla izquierda,${leftEdge.sizeLinks},${(leftEdge.sizeLinks * 0.5).toFixed(3)},${leftEdge.quantity},`);
  });

  it('BOM CSV y JSON: las piezas cortadas dicen de qué módulo salen', () => {
    const cutInput: PlannerInput = { ...input, innerNormal: [6], innerPusher: [6], allowCutModules: true };
    const cutResult = planBelt(cutInput);
    const cutLine = cutResult.bom.find((line) => line.cutFromLinks !== undefined)!;
    expect(cutLine).toBeDefined();
    const csv = toBomCsv(cutResult.bom).split('\r\n');
    expect(csv.some((line) => line.endsWith(`,${cutLine.quantity},${cutLine.cutFromLinks}`) && line.includes(`,${cutLine.sizeLinks},`))).toBe(true);
    const document = JSON.parse(toPlanJson(cutInput, cutResult));
    const modules = document.rows.flatMap((row: { modules: Array<{ cutFrom?: number }> }) => row.modules);
    expect(modules.some((module: { cutFrom?: number }) => module.cutFrom === cutLine.cutFromLinks)).toBe(true);
    expect(modules.filter((module: { cutFrom?: number }) => module.cutFrom === undefined).every((module: object) => !('cutFrom' in module))).toBe(true);
  });

  it('juntas CSV: una línea por fila con composición y juntas alineadas', () => {
    const lines = toSeamsCsv(result.rows).split('\r\n');
    expect(lines[0]).toBe('Fila,Tipo,Composición (links),Piezas,Juntas (links),Juntas alineadas con fila anterior');
    expect(lines).toHaveLength(result.rows.length + 1);
    expect(lines[1]).toBe(`1,Empujador,${result.rows[0].segments.map((s) => s.size).join(' ')},${result.rows[0].pieceCount},${result.rows[0].seams.join(' ')},`);
  });

  it('JSON: incluye parámetros, filas de empujador como lista y todas las filas', () => {
    const document = JSON.parse(toPlanJson(input, result, new Date('2026-01-01T00:00:00Z')));
    expect(document.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(document.input).toEqual(input);
    expect(document.pushers.rows).toEqual([1, 3]);
    expect(document.rows).toHaveLength(4);
    expect(document.rows[0].modules[0]).toEqual({ role: 'edge-left', size: result.rows[0].segments[0].size });
    expect(document.summary.widthLinks).toBe(20);
    expect(document).not.toHaveProperty('patternsNormal');
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
