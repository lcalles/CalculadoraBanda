import { describe, expect, it } from 'vitest';
import { INTRALOX_2022_CATALOG } from '../features/belt-catalog/data/intralox2022';
import { parseCatalogDocument } from '../features/belt-catalog/domain/catalog';
import { buildBom } from '../features/belt-planner/domain/bom';
import { createRowPattern } from '../features/belt-planner/domain/patterns';
import { planBelt } from '../features/belt-planner/domain/planner';
import { PlannerInput } from '../features/belt-planner/types';
import {
  assignModuleColors,
  colorOfSegment,
  contrastRatio,
  FAMILY_ORDER,
  familyShades,
  relativeLuminance
} from '../features/belt-planner/utils/moduleColors';

const rows = [
  createRowPattern(3, [12, 9], 6, 'normal'),
  createRowPattern(6, [9, 12], 3, 'normal'),
  createRowPattern(3, [9, 6, 6], 6, 'pusher', 'pusher'),
  createRowPattern(6, [6, 9, 6], 3, 'pusher', 'normal')
];

describe('colores por módulo', () => {
  it('cada módulo distinto tiene un color distinto y el mismo módulo siempre el mismo', () => {
    const colors = assignModuleColors(rows, true);
    // Normales: orillas 3 y 6, internos 9 y 12. Empujador: orillas 3 y 6, internos 6 y 9.
    expect(colors.size).toBe(8);
    const fills = [...colors.values()].map((color) => color.fill);
    expect(new Set(fills).size).toBe(fills.length);
    const nine = rows.flatMap((row) => row.segments).filter((segment) => segment.kind === 'normal' && segment.role === 'inner' && segment.size === 9);
    expect(new Set(nine.map((segment) => colorOfSegment(colors, segment, true)?.fill)).size).toBe(1);
  });

  it('agrupa por familia: orillas, internos, orillas de empujador e internos de empujador', () => {
    const colors = [...assignModuleColors(rows, true).values()];
    expect(colors.filter((color) => color.family === 'edge').map((color) => color.size)).toEqual([3, 6]);
    expect(colors.filter((color) => color.family === 'inner').map((color) => color.size)).toEqual([9, 12]);
    expect(colors.filter((color) => color.family === 'pusher-edge').map((color) => color.size)).toEqual([3, 6]);
    expect(colors.filter((color) => color.family === 'pusher-inner').map((color) => color.size)).toEqual([6, 9]);
  });

  it('una orilla normal en fila de empujador es el mismo módulo que en una fila normal', () => {
    const colors = assignModuleColors(rows, true);
    const normalEdgeInPusherRow = rows[3].segments[0];
    expect(normalEdgeInPusherRow).toMatchObject({ kind: 'normal', role: 'edge-left', size: 6 });
    expect(colorOfSegment(colors, normalEdgeInPusherRow, true)).toBe(colorOfSegment(colors, rows[1].segments[0], true));
  });

  it('en bandas con sentido de marcha la orilla izquierda y la derecha del mismo tamaño tienen colores distintos', () => {
    const bidirectional = assignModuleColors(rows, true);
    const directional = assignModuleColors(rows, false);
    const left3 = rows[0].segments[0];
    const right3 = rows[1].segments[rows[1].segments.length - 1];
    expect(colorOfSegment(bidirectional, left3, true)?.fill).toBe(colorOfSegment(bidirectional, right3, true)?.fill);
    expect(colorOfSegment(directional, left3, false)?.fill).not.toBe(colorOfSegment(directional, right3, false)?.fill);
  });

  it('el número del módulo siempre se lee (contraste 4.5:1) y los tonos no se repiten, aun con 19 tamaños', () => {
    FAMILY_ORDER.forEach((family) => {
      for (let count = 1; count <= 19; count += 1) {
        const shades = familyShades(family, count);
        expect(new Set(shades).size).toBe(count);
        shades.forEach((shade) => {
          const best = Math.max(contrastRatio(shade, '#1A2530'), contrastRatio(shade, '#FFFFFF'));
          expect(best).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  });

  it('dentro de una familia el más chico es el más claro', () => {
    const inner = [...assignModuleColors(rows, true).values()].filter((color) => color.family === 'inner');
    expect(relativeLuminance(inner[0].fill)).toBeGreaterThan(relativeLuminance(inner[1].fill));
  });
});

describe('orillas en bandas bidireccionales', () => {
  it('la BOM suma orilla izquierda y derecha como una sola pieza si la banda es bidireccional', () => {
    const normalRows = rows.slice(0, 2);
    expect(buildBom(normalRows, 0.66, true).filter((line) => line.role !== 'inner')).toEqual([
      { kind: 'normal', role: 'edge', sizeLinks: 6, widthInches: 3.96, quantity: 2 },
      { kind: 'normal', role: 'edge', sizeLinks: 3, widthInches: 1.98, quantity: 2 }
    ]);
    expect(buildBom(normalRows, 0.66, false).filter((line) => line.role !== 'inner').map((line) => line.role)).toEqual([
      'edge-left',
      'edge-left',
      'edge-right',
      'edge-right'
    ]);
  });

  it('planBelt usa el dato de la banda para la BOM', () => {
    const input: PlannerInput = {
      pitchInches: 2,
      linkIncrementInches: 0.66,
      widthInches: 24,
      lengthInches: 40,
      roundingMode: 'round',
      edgesNormal: [3, 6],
      innerNormal: [6, 9, 12],
      edgesPusher: [3],
      innerPusher: [6],
      flightConfig: { enabled: false, mode: 'rows', stepRows: 4, offsetRows: 0, stepInches: 0, offsetInches: 0 }
    };
    expect(planBelt({ ...input, bidirectional: true }).bom.some((line) => line.role === 'edge')).toBe(true);
    expect(planBelt(input).bom.some((line) => line.role === 'edge')).toBe(false);
  });

  it('el catálogo marca como no bidireccionales los 43 estilos con sentido de marcha', () => {
    const directional = INTRALOX_2022_CATALOG.filter((entry) => !entry.bidirectional);
    expect(directional).toHaveLength(43);
    const find = (series: string, style: string) => INTRALOX_2022_CATALOG.find((entry) => entry.series === series && entry.style === style)!;
    expect(find('S1200', 'Flat Top').bidirectional).toBe(false);
    expect(find('S9000', 'Flush Grid').bidirectional).toBe(false);
    expect(find('S800', 'Flat Top').bidirectional).toBe(true);
    expect(find('S800', 'Flush Grid').bidirectional).toBe(true);
    expect(find('S2700', 'Side Drive V2').bidirectional).toBe(false);
  });

  it('un catálogo guardado antes de este dato toma el sentido de marcha de fábrica', () => {
    const v2 = { version: 2, entries: INTRALOX_2022_CATALOG.map(({ bidirectional: _bidirectional, ...rest }) => rest) };
    const { entries } = parseCatalogDocument(JSON.parse(JSON.stringify(v2)), INTRALOX_2022_CATALOG);
    expect(entries.filter((entry) => !entry.bidirectional)).toHaveLength(43);
  });
});
