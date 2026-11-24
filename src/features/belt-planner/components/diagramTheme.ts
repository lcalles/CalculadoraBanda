import { Segment } from '../types';

/**
 * Colores del diagrama como hex (el SVG exportado no puede leer variables CSS).
 * Mantenerlos alineados con los tokens de src/styles.css.
 */
export const DIAGRAM_COLORS = {
  background: '#FFFFFF',
  ink: '#1A2530',
  inkMuted: '#4D5A67',
  dimension: '#4D5A67',
  edge: '#B0C0D0',
  inner: '#336EAD',
  pusherEdge: '#D6A014',
  pusher: '#F2C230',
  alert: '#BE2824',
  lightLabel: '#FFFFFF',
  darkLabel: '#1A2530'
} as const;

export const DIAGRAM_FONT = "'Barlow Semi Condensed', Barlow, 'Segoe UI', Arial, sans-serif";

export function segmentFill(segment: Segment): string {
  if (segment.kind === 'pusher') return segment.role === 'inner' ? DIAGRAM_COLORS.pusher : DIAGRAM_COLORS.pusherEdge;
  return segment.role === 'inner' ? DIAGRAM_COLORS.inner : DIAGRAM_COLORS.edge;
}

export function segmentLabelColor(segment: Segment): string {
  return segment.kind === 'normal' && segment.role === 'inner' ? DIAGRAM_COLORS.lightLabel : DIAGRAM_COLORS.darkLabel;
}
