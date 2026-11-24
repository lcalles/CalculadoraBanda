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
  /** Posición desde la orilla izquierda, en la unidad de la regla. */
  position: number;
  major: boolean;
}

/** Pasos de la regla en links. */
export const LINK_RULER_STEPS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** Pasos de la regla en pulgadas: el menor es el cuarto con que se nombran los módulos. */
export const INCH_RULER_STEPS: readonly number[] = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

function niceStep(steps: readonly number[], pxPerUnit: number, minimumPx: number): number {
  return steps.find((step) => step * pxPerUnit >= minimumPx) ?? steps[steps.length - 1];
}

const isMultipleOf = (value: number, step: number) => Math.abs(value / step - Math.round(value / step)) < 1e-9;

/**
 * Marcas de la regla: las mayores (con número) quedan al menos a 40 px entre sí
 * y las menores a 6 px. El cero y el extremo derecho siempre se numeran.
 * Sirve para cualquier unidad; el diagrama la usa en pulgadas (`INCH_RULER_STEPS`).
 */
export function rulerTicks(width: number, pxPerUnit: number, steps: readonly number[] = LINK_RULER_STEPS): RulerTick[] {
  const majorStep = niceStep(steps, pxPerUnit, 40);
  const minorStep = Math.min(niceStep(steps, pxPerUnit, 6), majorStep);
  const ticks: RulerTick[] = [];
  // Por índice y no sumando, para que el ruido de punto flotante no se acumule.
  for (let index = 0; index * minorStep <= width + 1e-9; index += 1) {
    const position = index * minorStep;
    ticks.push({ position, major: isMultipleOf(position, majorStep) });
  }
  const last = ticks[ticks.length - 1];
  if (!last || Math.abs(last.position - width) > 1e-9) ticks.push({ position: width, major: true });
  // El extremo derecho siempre lleva número; se quita el de la marca mayor anterior si se enciman.
  const end = ticks[ticks.length - 1];
  end.major = true;
  const previousMajor = [...ticks].reverse().find((tick) => tick.major && tick !== end);
  if (previousMajor && (end.position - previousMajor.position) * pxPerUnit < 28) previousMajor.major = false;
  return ticks;
}

/** Escala que hace caber la banda en el ancho disponible, dentro de los límites legibles. */
export function fitPxPerLink(availableWidth: number, widthLinks: number): number {
  if (widthLinks <= 0 || availableWidth <= 0) return 14;
  const usable = availableWidth - DIAGRAM_METRICS.gutter - DIAGRAM_METRICS.rightPadding;
  return Math.min(MAX_PX_PER_LINK, Math.max(MIN_PX_PER_LINK, Math.floor(usable / widthLinks)));
}
