import { useEffect, useMemo, useRef } from 'react';
import { CalculatedPlan } from '../hooks/useBeltPlanner';
import { formatCount } from '../utils/format';
import { assignModuleColors } from '../utils/moduleColors';
import { BomTable } from './BomTable';
import { DrawingSheet } from './DrawingSheet';
import { ExportActions } from './ExportActions';
import { PARAMETERS_FORM_ID } from './formIds';
import { NoticeList } from './NoticeList';
import { PlanTitleBlock } from './PlanTitleBlock';
import { SeamsTable } from './SeamsTable';

interface PlanViewProps {
  plan: CalculatedPlan;
  isStale: boolean;
  /** Título libre del cálculo ('' si no hay). Se muestra en vivo, sin recalcular. */
  title: string;
}

const DOCUMENT_TITLE = 'Armado de banda modular';

/** Hoja de armado: resumen, avisos, diagrama, BOM y juntas del último cálculo. */
export function PlanView({ plan, isStale, title }: PlanViewProps) {
  const diagramRef = useRef<SVGSVGElement>(null);
  const { input, result, calculatedAt, belt } = plan;
  const bidirectional = input.bidirectional ?? false;
  // Un color por módulo distinto; se asigna en cada plan.
  const moduleColors = useMemo(() => assignModuleColors(result.rows, bidirectional), [result.rows, bidirectional]);
  // Cambiar de plan reinicia la escala del diagrama y la paginación de la tabla de juntas.
  const planKey = calculatedAt.getTime();
  const sheetName = `Hoja de armado${belt ? `: ${belt.label}` : ''}`;

  // El título de la pestaña es el nombre que propone el navegador al imprimir a PDF.
  useEffect(() => {
    document.title = title ? `${title} | ${DOCUMENT_TITLE}` : DOCUMENT_TITLE;
    return () => {
      document.title = DOCUMENT_TITLE;
    };
  }, [title]);

  return (
    <article aria-labelledby="titulo-hoja" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="titulo-hoja" className="break-words font-display text-2xl font-semibold leading-tight">
            {title || sheetName}
          </h2>
          <p className="tabular text-sm text-ink-muted">
            {title ? `${sheetName}. ` : ''}
            {belt ? `Banda${belt.manufacturer ? ` ${belt.manufacturer}` : ''}` : 'Banda personalizada'} de {result.widthLinks} links por{' '}
            {formatCount(result.rowsCount, 'fila', 'filas')}. Calculada el{' '}
            {calculatedAt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <ExportActions input={input} result={result} belt={belt} title={title} diagramRef={diagramRef} />
      </header>

      {isStale && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 border border-ink/40 bg-sunken px-3 py-2 text-sm print:hidden">
          <span>Cambiaste parámetros. Lo que ves corresponde al cálculo anterior.</span>
          <button type="submit" form={PARAMETERS_FORM_ID} className="btn btn-primary h-8">
            Calcular plan
          </button>
        </div>
      )}

      <NoticeList notices={result.notices} />
      <PlanTitleBlock input={input} result={result} />
      <DrawingSheet
        key={planKey}
        ref={diagramRef}
        rows={result.rows}
        widthLinks={result.widthLinks}
        linkIncrementInches={input.linkIncrementInches}
        hasPusherRows={result.stats.pusherRowsBuilt > 0}
        moduleColors={moduleColors}
        bidirectional={bidirectional}
        title={title}
      />
      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <BomTable bom={result.bom} pusherLabel={input.flightConfig.flightLabel ?? null} moduleColors={moduleColors} />
        <SeamsTable key={planKey} rows={result.rows} />
      </div>
    </article>
  );
}
