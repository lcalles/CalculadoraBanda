import { forwardRef, memo } from 'react';
import { PlannedRow } from '../types';
import { DIAGRAM_METRICS, diagramSize, INCH_RULER_STEPS, rowTop, rulerTicks, segmentSpans } from '../utils/diagramGeometry';
import { formatInches, formatInchPosition, formatModuleNumber, formatModuleSize, formatPlainNumber, KIND_LABELS, ROLE_LABELS } from '../utils/format';
import { colorOfSegment, ModuleColor } from '../utils/moduleColors';
import { DIAGRAM_COLORS, DIAGRAM_FONT, segmentFill, segmentLabelColor } from './diagramTheme';

interface BeltDiagramProps {
  rows: readonly PlannedRow[];
  totalRows: number;
  widthLinks: number;
  linkIncrementInches: number;
  pxPerLink: number;
  /** Paleta del plan: un color por módulo distinto. */
  moduleColors: ReadonlyMap<string, ModuleColor>;
  bidirectional: boolean;
  /** Título del cálculo ('' si no hay). */
  title: string;
}

const { gutter, rowHeight } = DIAGRAM_METRICS;
/** Ancho aproximado de un carácter de 11 px en negritas, para saber si el nombre cabe en el módulo. */
const LABEL_CHAR_WIDTH = 6.5;
const LABEL_PADDING = 4;

/** Cota de ancho estilo plano: línea con remates oblicuos y el valor al centro. */
function WidthDimension({ x0, x1, label }: { x0: number; x1: number; label: string }) {
  const y = 16;
  const center = (x0 + x1) / 2;
  const labelWidth = label.length * 6.4 + 16;
  return (
    <g stroke={DIAGRAM_COLORS.dimension} strokeWidth={1} fill="none">
      <line x1={x0} y1={y - 8} x2={x0} y2={DIAGRAM_METRICS.top - 4} />
      <line x1={x1} y1={y - 8} x2={x1} y2={DIAGRAM_METRICS.top - 4} />
      <line x1={x0} y1={y} x2={x1} y2={y} />
      <line x1={x0 - 4} y1={y + 4} x2={x0 + 4} y2={y - 4} strokeWidth={1.5} />
      <line x1={x1 - 4} y1={y + 4} x2={x1 + 4} y2={y - 4} strokeWidth={1.5} />
      <rect x={center - labelWidth / 2} y={y - 8} width={labelWidth} height={16} fill={DIAGRAM_COLORS.background} stroke="none" />
      <text x={center} y={y + 4} textAnchor="middle" fill={DIAGRAM_COLORS.ink} stroke="none" fontSize={12} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

/** Regla en pulgadas desde la orilla izquierda. */
function Ruler({ widthLinks, pxPerLink, linkIncrementInches }: { widthLinks: number; pxPerLink: number; linkIncrementInches: number }) {
  const baseline = DIAGRAM_METRICS.top - 8;
  const widthInches = Number((widthLinks * linkIncrementInches).toFixed(6));
  const pxPerInch = pxPerLink / linkIncrementInches;
  return (
    <g>
      <line x1={gutter} y1={baseline} x2={gutter + widthLinks * pxPerLink} y2={baseline} stroke={DIAGRAM_COLORS.inkMuted} strokeWidth={1} />
      {rulerTicks(widthInches, pxPerInch, INCH_RULER_STEPS).map((tick) => {
        const x = gutter + tick.position * pxPerInch;
        return (
          <g key={tick.position}>
            <line x1={x} y1={baseline} x2={x} y2={baseline - (tick.major ? 6 : 3)} stroke={DIAGRAM_COLORS.inkMuted} strokeWidth={1} />
            {tick.major && (
              <text x={x} y={baseline - 9} textAnchor="middle" fontSize={10} fill={DIAGRAM_COLORS.inkMuted}>
                {formatPlainNumber(tick.position, 2)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

interface DiagramRowProps {
  row: PlannedRow;
  index: number;
  pxPerLink: number;
  linkIncrementInches: number;
  moduleColors: ReadonlyMap<string, ModuleColor>;
  bidirectional: boolean;
}

const DiagramRow = memo(function DiagramRow({ row, index, pxPerLink, linkIncrementInches, moduleColors, bidirectional }: DiagramRowProps) {
  const y = rowTop(index);
  const centerY = y + rowHeight / 2;
  const previousY = index > 0 ? rowTop(index - 1) : null;
  const isPusher = row.kind === 'pusher';

  return (
    <g>
      {isPusher && (
        <g>
          <rect x={6} y={y + 4} width={16} height={rowHeight - 8} rx={2} fill={DIAGRAM_COLORS.pusher} stroke={DIAGRAM_COLORS.ink} strokeWidth={1} />
          <text x={14} y={centerY + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={DIAGRAM_COLORS.ink}>
            E
          </text>
        </g>
      )}
      <text x={gutter - 8} y={centerY + 4} textAnchor="end" fontSize={11} fill={DIAGRAM_COLORS.inkMuted}>
        {row.rowNumber}
      </text>
      {segmentSpans(row.segments, pxPerLink).map((span) => {
        const color = colorOfSegment(moduleColors, span.segment, bidirectional);
        const name = formatModuleNumber(span.segment.size, linkIncrementInches);
        return (
        <g key={span.startLink}>
          <rect x={span.x} y={y} width={span.width} height={rowHeight} fill={color?.fill ?? segmentFill(span.segment)} stroke={DIAGRAM_COLORS.ink} strokeWidth={1}>
            <title>
              {`Fila ${row.rowNumber}, ${ROLE_LABELS[span.segment.role].toLowerCase()} ${KIND_LABELS[span.segment.kind].toLowerCase()} ` +
                `de ${formatModuleSize(span.segment.size, linkIncrementInches)}, ${formatInches(span.segment.size * linkIncrementInches)} reales` +
                (span.segment.cutFrom !== undefined ? `, cortado de ${formatModuleSize(span.segment.cutFrom, linkIncrementInches)}` : '') +
                `, de ${formatInchPosition(span.startLink, linkIncrementInches)} a ${formatInchPosition(span.endLink, linkIncrementInches)} in` +
                ` (links ${span.startLink} a ${span.endLink})`}
            </title>
          </rect>
          {span.width >= name.length * LABEL_CHAR_WIDTH + LABEL_PADDING && (
            <text
              x={span.x + span.width / 2}
              y={centerY + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={color?.label ?? segmentLabelColor(span.segment)}
              pointerEvents="none"
            >
              {name}
            </text>
          )}
        </g>
        );
      })}
      {previousY !== null &&
        row.alignedSeams.map((seam) => {
          const x = gutter + seam * pxPerLink;
          return (
            <line
              key={seam}
              x1={x}
              y1={previousY + rowHeight * 0.3}
              x2={x}
              y2={y + rowHeight * 0.7}
              stroke={DIAGRAM_COLORS.alert}
              strokeWidth={3}
              strokeLinecap="round"
            >
              <title>{`Junta alineada a ${formatInchPosition(seam, linkIncrementInches)} in (link ${seam}) entre las filas ${row.rowNumber - 1} y ${row.rowNumber}`}</title>
            </line>
          );
        })}
    </g>
  );
});

/**
 * Dibujo técnico del armado: cota de ancho, regla en pulgadas y una franja por fila.
 * Cada módulo lleva su nombre en pulgadas; los links están en la cota y en el texto de cada módulo.
 */
export const BeltDiagram = forwardRef<SVGSVGElement, BeltDiagramProps>(function BeltDiagram(
  { rows, totalRows, widthLinks, linkIncrementInches, pxPerLink, moduleColors, bidirectional, title },
  ref
) {
  const { width, height } = diagramSize(widthLinks, rows.length, pxPerLink);
  const aligned = rows.reduce((sum, row) => sum + row.alignedSeams.length, 0);
  const description =
    `${totalRows} filas de ${formatInches(widthLinks * linkIncrementInches)} (${widthLinks} links). Módulos nombrados en pulgadas.` +
    (rows.length < totalRows ? ` Se muestran las primeras ${rows.length}.` : '') +
    ` ${aligned === 0 ? 'Sin juntas alineadas entre filas adyacentes.' : `${aligned} juntas alineadas marcadas en rojo.`}`;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby="diagrama-svg-titulo diagrama-svg-descripcion"
      fontFamily={DIAGRAM_FONT}
      className="block"
    >
      <title id="diagrama-svg-titulo">{title ? `Diagrama de armado: ${title}` : 'Diagrama de armado de la banda'}</title>
      <desc id="diagrama-svg-descripcion">{description}</desc>
      <rect width={width} height={height} fill={DIAGRAM_COLORS.background} />
      <WidthDimension
        x0={gutter}
        x1={gutter + widthLinks * pxPerLink}
        label={`${formatInches(widthLinks * linkIncrementInches)} = ${widthLinks} links`}
      />
      <Ruler widthLinks={widthLinks} pxPerLink={pxPerLink} linkIncrementInches={linkIncrementInches} />
      {rows.map((row, index) => (
        <DiagramRow
          key={row.rowNumber}
          row={row}
          index={index}
          pxPerLink={pxPerLink}
          linkIncrementInches={linkIncrementInches}
          moduleColors={moduleColors}
          bidirectional={bidirectional}
        />
      ))}
    </svg>
  );
});
