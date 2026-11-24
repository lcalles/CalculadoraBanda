import { describe, expect, it } from 'vitest';
import { createRowPattern } from '../features/belt-planner/domain/patterns';
import {
  DIAGRAM_METRICS,
  DIAGRAM_ROW_LIMIT,
  diagramSize,
  fitPxPerLink,
  MAX_PX_PER_LINK,
  MIN_PX_PER_LINK,
  rulerTicks,
  segmentSpans,
  selectDiagramRows
} from '../features/belt-planner/utils/diagramGeometry';

describe('geometría del diagrama', () => {
  it('coloca cada módulo a partir de la orilla izquierda', () => {
    const spans = segmentSpans(createRowPattern(2, [8, 6], 3, 'normal').segments, 10, 0);
    expect(spans.map(({ startLink, endLink, x, width }) => ({ startLink, endLink, x, width }))).toEqual([
      { startLink: 0, endLink: 2, x: 0, width: 20 },
      { startLink: 2, endLink: 10, x: 20, width: 80 },
      { startLink: 10, endLink: 16, x: 100, width: 60 },
      { startLink: 16, endLink: 19, x: 160, width: 30 }
    ]);
  });

  it('la regla siempre numera el cero y el extremo derecho', () => {
    const ticks = rulerTicks(48, 18);
    expect(ticks[0]).toEqual({ link: 0, major: true });
    expect(ticks[ticks.length - 1]).toEqual({ link: 48, major: true });
    const majors = ticks.filter((tick) => tick.major).map((tick) => tick.link);
    expect(majors).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 48]);
  });

  it('no encima la última etiqueta con la del extremo', () => {
    const majors = rulerTicks(41, 10).filter((tick) => tick.major).map((tick) => tick.link);
    expect(majors).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 41]);
  });

  it('ajusta la escala al ancho disponible dentro de los límites', () => {
    const usable = 1000 - DIAGRAM_METRICS.gutter - DIAGRAM_METRICS.rightPadding;
    expect(fitPxPerLink(1000, 48)).toBe(Math.floor(usable / 48));
    expect(fitPxPerLink(1000, 2000)).toBe(MIN_PX_PER_LINK);
    expect(fitPxPerLink(5000, 4)).toBe(MAX_PX_PER_LINK);
  });

  it('el alto crece con las filas', () => {
    const one = diagramSize(48, 1, 10).height;
    const two = diagramSize(48, 2, 10).height;
    expect(two - one).toBe(DIAGRAM_METRICS.rowHeight + DIAGRAM_METRICS.rowGap);
  });
});

describe('filas del diagrama', () => {
  const rowsWithPushersAt = (count: number, pusherRows: number[]) =>
    Array.from({ length: count }, (_, index) => ({ rowNumber: index + 1, pusherRequested: pusherRows.includes(index + 1) }));

  it('dibuja solo las primeras 20 filas', () => {
    const selection = selectDiagramRows(rowsWithPushersAt(300, [1, 5, 9]));
    expect(DIAGRAM_ROW_LIMIT).toBe(20);
    expect(selection.visible.map((row) => row.rowNumber)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(selection.hiddenCount).toBe(280);
    expect(selection.firstHiddenPusherRow).toBeNull();
  });

  it('con menos de 20 filas las dibuja todas', () => {
    expect(selectDiagramRows(rowsWithPushersAt(12, [])).visible).toHaveLength(12);
    expect(selectDiagramRows(rowsWithPushersAt(12, [])).hiddenCount).toBe(0);
  });

  it('avisa cuál es la primera fila con empujador si ninguna entra en el dibujo', () => {
    expect(selectDiagramRows(rowsWithPushersAt(100, [35, 70])).firstHiddenPusherRow).toBe(35);
    expect(selectDiagramRows(rowsWithPushersAt(100, [20, 45])).firstHiddenPusherRow).toBeNull();
    expect(selectDiagramRows(rowsWithPushersAt(100, [])).firstHiddenPusherRow).toBeNull();
  });
});
