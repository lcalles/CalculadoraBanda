import { forwardRef, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { PlannedRow } from '../types';
import { fitPxPerLink, MAX_PX_PER_LINK, MIN_PX_PER_LINK, selectDiagramRows } from '../utils/diagramGeometry';
import { formatModuleInches, formatPlainNumber } from '../utils/format';
import { FAMILY_NAMES, FAMILY_ORDER, ModuleColor } from '../utils/moduleColors';
import { BeltDiagram } from './BeltDiagram';

interface DrawingSheetProps {
  rows: readonly PlannedRow[];
  widthLinks: number;
  linkIncrementInches: number;
  hasPusherRows: boolean;
  moduleColors: ReadonlyMap<string, ModuleColor>;
  bidirectional: boolean;
  /** Título del cálculo ('' si no hay); va en el título del SVG exportado. */
  title: string;
}

const SIDE_SUFFIX: Partial<Record<ModuleColor['role'], string>> = { 'edge-left': ' izq.', 'edge-right': ' der.' };

interface LegendProps {
  moduleColors: ReadonlyMap<string, ModuleColor>;
  hasPusherRows: boolean;
  linkIncrementInches: number;
}

/** Leyenda por familia: cada módulo del plan con su color y su nombre en pulgadas (y sus links), igual que en el diagrama. */
function Legend({ moduleColors, hasPusherRows, linkIncrementInches }: LegendProps) {
  const modules = [...moduleColors.values()];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-3 py-2 text-[13px] text-ink-muted">
      {FAMILY_ORDER.map((family) => {
        const items = modules.filter((module) => module.family === family);
        if (items.length === 0) return null;
        return (
          <span key={family} className="inline-flex flex-wrap items-center gap-1.5">
            <span>{FAMILY_NAMES[family]}</span>
            {items.map((module) => (
              <span
                key={module.key}
                className="tabular inline-flex h-5 min-w-[2rem] items-center justify-center gap-1 border border-ink px-1 text-[12px] font-semibold"
                style={{ backgroundColor: module.fill, color: module.label }}
              >
                {formatModuleInches(module.size, linkIncrementInches)}
                <span className="font-normal opacity-80">{module.size}L</span>
                {SIDE_SUFFIX[module.role] ?? ''}
              </span>
            ))}
          </span>
        );
      })}
      {hasPusherRows && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-ink bg-pusher text-[10px] font-bold text-ink">
            E
          </span>
          Fila con empujador
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-3.5 w-[3px] rounded-full bg-alert" />
        Junta alineada con la fila anterior
      </span>
    </div>
  );
}

/**
 * Hoja del diagrama: leyenda, control de escala y el dibujo de las primeras filas
 * (bastan para ver el patrón; todas están en la tabla de juntas y en las exportaciones).
 */
export const DrawingSheet = forwardRef<SVGSVGElement, DrawingSheetProps>(function DrawingSheet(
  { rows, widthLinks, linkIncrementInches, hasPusherRows, moduleColors, bidirectional, title },
  diagramRef
) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasWidth = useElementWidth(canvasRef);
  const [manualScale, setManualScale] = useState<number | null>(null);

  const fittedScale = fitPxPerLink(canvasWidth, widthLinks);
  const pxPerLink = manualScale ?? fittedScale;
  // La escala se mueve por links (el dibujo se arma en links), pero se lee en píxeles por pulgada.
  const pxPerInch = formatPlainNumber(pxPerLink / linkIncrementInches, 1);
  const { visible: visibleRows, hiddenCount, firstHiddenPusherRow } = selectDiagramRows(rows);

  return (
    <section aria-labelledby="titulo-diagrama" className="border border-ink/70 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-3 py-2">
        <h3 id="titulo-diagrama" className="font-display text-lg font-semibold">
          Diagrama de armado
        </h3>
        <div className="flex items-center gap-2 print:hidden">
          <label htmlFor="escala-diagrama" className="text-[13px] text-ink-muted">
            Escala
          </label>
          <input
            id="escala-diagrama"
            type="range"
            min={MIN_PX_PER_LINK}
            max={MAX_PX_PER_LINK}
            step={1}
            value={pxPerLink}
            onChange={(event) => setManualScale(Number(event.target.value))}
            aria-valuetext={`${pxPerInch} píxeles por pulgada`}
            className="w-28 cursor-pointer accent-[rgb(var(--ink))]"
          />
          <span className="tabular w-[4.5rem] text-[13px] text-ink-muted">{pxPerInch} px/in</span>
          <button
            type="button"
            className="btn btn-secondary h-8 whitespace-nowrap px-2 text-[13px]"
            onClick={() => setManualScale(null)}
            disabled={manualScale === null}
            title="Ajustar la escala para que la banda quepa a lo ancho"
          >
            <MoveHorizontal aria-hidden="true" size={15} />
            Ajustar al ancho
          </button>
        </div>
      </div>
      <Legend moduleColors={moduleColors} hasPusherRows={hasPusherRows} linkIncrementInches={linkIncrementInches} />

      <div ref={canvasRef} className="max-h-[72vh] overflow-auto print:max-h-none print:overflow-visible">
        {rows.length > 0 ? (
          <BeltDiagram
            ref={diagramRef}
            rows={visibleRows}
            totalRows={rows.length}
            widthLinks={widthLinks}
            linkIncrementInches={linkIncrementInches}
            pxPerLink={pxPerLink}
            moduleColors={moduleColors}
            bidirectional={bidirectional}
            title={title}
          />
        ) : (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            No hay filas que dibujar con los módulos seleccionados. Los avisos de arriba explican qué ajustar.
          </p>
        )}
      </div>

      {hiddenCount > 0 && (
        <p className="tabular border-t border-line px-3 py-2 text-[13px] leading-snug text-ink-muted">
          Se dibujan las primeras {visibleRows.length} de {rows.length.toLocaleString('es-MX')} filas para ver el patrón. Las juntas de todas
          las filas están en la tabla de juntas y en las exportaciones CSV y JSON.
          {firstHiddenPusherRow !== null &&
            ` La primera fila con empujador es la ${firstHiddenPusherRow.toLocaleString('es-MX')} y queda fuera del dibujo.`}
        </p>
      )}
    </section>
  );
});
