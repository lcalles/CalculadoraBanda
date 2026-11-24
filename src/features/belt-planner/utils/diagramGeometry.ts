import { Segment } from '../types';

/** Medidas fijas del dibujo, en px. */
export const DIAGRAM_METRICS = {
  /** Columna izquierda con número de fila y marca de empujador. */
  gutter: 56,
  /** Espacio superior para la cota de ancho y la regla. */
  top: 58,
  rowHeight: 22,
  rowGap: 4,
  rightPadding: 24,
  bottomPadding: 16
} as const;

export const MIN_PX_PER_LINK = 3;
export const MAX_PX_PER_LINK = 40;

/** Filas que se dibujan: las primeras 20 bastan para ver el patrón de armado. */
export const DIAGRAM_ROW_LIMIT = 20;

export interface DiagramRowSelection<T> {
  visible: T[];
  hiddenCount: number;
  /** Primera fila con empujador cuando ninguna de las dibujadas lo lleva; null si no aplica. */
  firstHiddenPusherRow: number | null;
}

/**
 * Elige las filas del dibujo. Las demás siguen en la tabla de juntas y en las exportaciones;
 * si todas las filas con empujador quedan fuera, se informa cuál es la primera.
 */
export function selectDiagramRows<T extends { rowNumber: number; pusherRequested: boolean }>(
  rows: readonly T[],
  limit: number = DIAGRAM_ROW_LIMIT
): DiagramRowSelection<T> {
  const visible = rows.slice(0, limit);
  const hidden = rows.slice(limit);
  const pusherVisible = visible.some((row) => row.pusherRequested);
  return {
    visible,
    hiddenCount: hidden.length,
    firstHiddenPusherRow: pusherVisible ? null : hidden.find((row) => row.pusherRequested)?.rowNumber ?? null
  };
}

export function rowTop(index: number): number {
  return DIAGRAM_METRICS.top + index * (DIAGRAM_METRICS.rowHeight + DIAGRAM_METRICS.rowGap);
}

export function diagramSize(widthLinks: number, rowCount: number, pxPerLink: number): { width: number; height: number } {
  const rowsHeight = rowCount > 0 ? rowCount * (DIAGRAM_METRICS.rowHeight + DIAGRAM_METRICS.rowGap) - DIAGRAM_METRICS.rowGap : 0;
  return {
    width: DIAGRAM_METRICS.gutter + widthLinks * pxPerLink + DIAGRAM_METRICS.rightPadding,
    height: DIAGRAM_METRICS.top + rowsHeight + DIAGRAM_METRICS.bottomPadding
  };
}

export interface SegmentSpan {
  segment: Segment;
  /** Posición en links desde la orilla izquierda. */
  startLink: number;
  endLink: number;
  x: number;
  width: number;
}

/** Posición horizontal de cada módulo de la fila. */
export function segmentSpans(segments: readonly Segment[], pxPerLink: number, originX: number = DIAGRAM_METRICS.gutter): SegmentSpan[] {
  let cursor = 0;
  return segments.map((segment) => {
    const span = {
      segment,
      startLink: cursor,
      endLink: cursor + segment.size,
      x: originX + cursor * pxPerLink,
      width: segment.size * pxPerLink
    };
    cursor += segment.size;
    return span;
  });
}

export interface RulerTick {
  link: number;
  major: boolean;
}

const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

function niceStep(pxPerLink: number, minimumPx: number): number {
  return NICE_STEPS.find((step) => step * pxPerLink >= minimumPx) ?? NICE_STEPS[NICE_STEPS.length - 1];
}

/**
 * Marcas de la regla en links: las mayores (con número) quedan al menos a 40 px entre sí
 * y las menores a 6 px. El extremo derecho siempre se marca.
 */
export function rulerTicks(widthLinks: number, pxPerLink: number): RulerTick[] {
  const majorStep = niceStep(pxPerLink, 40);
  const minorStep = Math.min(niceStep(pxPerLink, 6), majorStep);
  const ticks: RulerTick[] = [];
  for (let link = 0; link <= widthLinks; link += minorStep) {
    ticks.push({ link, major: link % majorStep === 0 });
  }
  if (ticks[ticks.length - 1]?.link !== widthLinks) ticks.push({ link: widthLinks, major: true });
  // El extremo derecho siempre lleva número; se quita el de la marca mayor anterior si se enciman.
  const end = ticks[ticks.length - 1];
  end.major = true;
  const previousMajor = [...ticks].reverse().find((tick) => tick.major && tick !== end);
  if (previousMajor && (end.link - previousMajor.link) * pxPerLink < 28) previousMajor.major = false;
  return ticks;
}

/** Escala que hace caber la banda en el ancho disponible, dentro de los límites legibles. */
export function fitPxPerLink(availableWidth: number, widthLinks: number): number {
  if (widthLinks <= 0 || availableWidth <= 0) return 14;
  const usable = availableWidth - DIAGRAM_METRICS.gutter - DIAGRAM_METRICS.rightPadding;
  return Math.min(MAX_PX_PER_LINK, Math.max(MIN_PX_PER_LINK, Math.floor(usable / widthLinks)));
}
