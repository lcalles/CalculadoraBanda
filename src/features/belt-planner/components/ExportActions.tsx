import { RefObject } from 'react';
import { FileJson, FileSpreadsheet, Image, Printer } from 'lucide-react';
import { downloadTextFile, planFilePrefix, serializeSvg, toBomCsv, toPlanJson, toSeamsCsv } from '../exporters';
import { PlanBelt } from '../hooks/useBeltPlanner';
import { PlannerInput, PlanResult } from '../types';

interface ExportActionsProps {
  input: PlannerInput;
  result: PlanResult;
  belt: PlanBelt | null;
  /** Título del cálculo ('' si no hay). */
  title: string;
  diagramRef: RefObject<SVGSVGElement>;
}

/** Descargas para producción. Los nombres de archivo llevan el título, la banda, el ancho y las filas del plan. */
export function ExportActions({ input, result, belt, title, diagramRef }: ExportActionsProps) {
  const prefix = planFilePrefix(result.widthLinks, result.rowsCount, belt?.label, title);
  const hasRows = result.rows.length > 0;

  const exportDiagram = () => {
    if (diagramRef.current) downloadTextFile(`${prefix}-diagrama.svg`, serializeSvg(diagramRef.current), 'image/svg+xml');
  };

  return (
    <div role="group" aria-label="Exportar" className="flex flex-wrap gap-1.5 print:hidden">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!hasRows}
        onClick={() =>
          downloadTextFile(
            `${prefix}-bom.csv`,
            toBomCsv(result.bom, input.linkIncrementInches, input.flightConfig.flightLabel ?? null),
            'text/csv',
            true
          )
        }
      >
        <FileSpreadsheet aria-hidden="true" size={16} />
        BOM (CSV)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!hasRows}
        onClick={() => downloadTextFile(`${prefix}-juntas.csv`, toSeamsCsv(result.rows, input.linkIncrementInches), 'text/csv', true)}
      >
        <FileSpreadsheet aria-hidden="true" size={16} />
        Juntas (CSV)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => downloadTextFile(`${prefix}-plan.json`, toPlanJson(input, result, new Date(), belt, title), 'application/json')}
      >
        <FileJson aria-hidden="true" size={16} />
        Plan (JSON)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!hasRows}
        onClick={exportDiagram}
        title="Descarga las filas dibujadas en el diagrama"
      >
        <Image aria-hidden="true" size={16} />
        Diagrama (SVG)
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
        <Printer aria-hidden="true" size={16} />
        Imprimir
      </button>
    </div>
  );
}
