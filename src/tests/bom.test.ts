import { describe, expect, it } from 'vitest';
import { buildBom, totalBomQuantity } from '../features/belt-planner/domain/bom';
import { createRowPattern } from '../features/belt-planner/domain/patterns';

describe('buildBom', () => {
  const rows = [
    createRowPattern(3, [8, 6], 2, 'normal'),
    createRowPattern(2, [6, 8], 3, 'normal'),
    createRowPattern(3, [8, 6], 2, 'pusher')
  ];

  it('cuenta módulos por tipo, rol y tamaño', () => {
    const bom = buildBom(rows, 0.5);
    expect(bom).toEqual([
      { kind: 'normal', role: 'edge-left', sizeLinks: 3, widthInches: 1.5, quantity: 1 },
      { kind: 'normal', role: 'edge-left', sizeLinks: 2, widthInches: 1, quantity: 1 },
      { kind: 'normal', role: 'inner', sizeLinks: 8, widthInches: 4, quantity: 2 },
      { kind: 'normal', role: 'inner', sizeLinks: 6, widthInches: 3, quantity: 2 },
      { kind: 'normal', role: 'edge-right', sizeLinks: 3, widthInches: 1.5, quantity: 1 },
      { kind: 'normal', role: 'edge-right', sizeLinks: 2, widthInches: 1, quantity: 1 },
      { kind: 'pusher', role: 'edge-left', sizeLinks: 3, widthInches: 1.5, quantity: 1 },
      { kind: 'pusher', role: 'inner', sizeLinks: 8, widthInches: 4, quantity: 1 },
      { kind: 'pusher', role: 'inner', sizeLinks: 6, widthInches: 3, quantity: 1 },
      { kind: 'pusher', role: 'edge-right', sizeLinks: 2, widthInches: 1, quantity: 1 }
    ]);
  });

  it('el total de la BOM es igual al total de piezas de las filas', () => {
    const bom = buildBom(rows);
    expect(totalBomQuantity(bom)).toBe(rows.reduce((sum, row) => sum + row.segments.length, 0));
    expect(totalBomQuantity(bom, 'pusher')).toBe(4);
    expect(totalBomQuantity(bom, 'normal')).toBe(8);
  });
});
