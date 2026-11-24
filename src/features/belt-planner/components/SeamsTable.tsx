import { useMemo, useState } from 'react';
import { PlannedRow } from '../types';
import { formatComposition } from '../utils/format';

/** Filas por página de la tabla (el diagrama solo dibuja las primeras; aquí están todas). */
const ROWS_PER_PAGE = 200;

/** Juntas por fila, con filtro de filas que comparten juntas con la anterior. */
export function SeamsTable({ rows }: { rows: readonly PlannedRow[] }) {
  const [onlyAligned, setOnlyAligned] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_PAGE);
  const alignedRows = useMemo(() => rows.filter((row) => row.alignedSeams.length > 0), [rows]);
  const source = onlyAligned ? alignedRows : rows;
  const visible = source.slice(0, visibleCount);
  const hidden = source.length - visible.length;

  return (
    <section aria-labelledby="titulo-juntas" className="flex min-w-0 flex-col border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-3 py-2">
        <h3 id="titulo-juntas" className="font-display text-lg font-semibold">
          Juntas por fila
        </h3>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-muted print:hidden">
          <input
            type="checkbox"
            checked={onlyAligned}
            disabled={alignedRows.length === 0}
            onChange={(event) => {
              setOnlyAligned(event.target.checked);
              setVisibleCount(ROWS_PER_PAGE);
            }}
            className="h-4 w-4 cursor-pointer accent-[rgb(var(--ink))] disabled:cursor-not-allowed"
          />
          Solo filas con juntas alineadas ({alignedRows.length.toLocaleString('es-MX')})
        </label>
      </div>
      <p className="border-b border-line px-3 py-1.5 text-[13px] text-ink-muted">
        Posición de cada junta en links, medida desde la orilla izquierda.
      </p>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-ink-muted">Sin filas armadas.</p>
      ) : (
        <div className="max-h-[30rem] overflow-auto print:max-h-none">
          <table className="tabular w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_rgb(var(--line))]">
              <tr className="text-left text-[13px] text-ink-muted">
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Fila
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Composición
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Juntas
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Alineadas
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const aligned = new Set(row.alignedSeams);
                return (
                  <tr key={row.rowNumber} className={`border-b border-line/60 ${aligned.size > 0 ? 'bg-alert-soft/70' : ''}`}>
                    <th scope="row" className="whitespace-nowrap px-3 py-1 text-right font-medium">
                      {row.kind === 'pusher' && (
                        <span className="mr-1.5 inline-block rounded-sm border border-ink bg-pusher px-1 text-[11px] font-bold leading-4">
                          <span aria-hidden="true">E</span>
                          <span className="sr-only">Empujador, fila</span>
                        </span>
                      )}
                      {row.rowNumber}
                    </th>
                    <td className="px-3 py-1">{formatComposition(row.segments)}</td>
                    <td className="px-3 py-1 text-ink-muted">
                      {row.seams.map((seam, index) => (
                        <span key={seam} className={aligned.has(seam) ? 'font-semibold text-alert' : undefined}>
                          {index > 0 ? ' ' : ''}
                          {seam}
                        </span>
                      ))}
                    </td>
                    <td className={`px-3 py-1 ${aligned.size > 0 ? 'font-semibold text-alert' : 'text-ink-muted'}`}>
                      {aligned.size > 0 ? row.alignedSeams.join(' ') : 'Ninguna'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {hidden > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-[13px] text-ink-muted print:hidden">
          <span className="tabular">
            {visible.length.toLocaleString('es-MX')} de {source.length.toLocaleString('es-MX')} filas
          </span>
          <button type="button" className="btn btn-secondary h-8 px-2 text-[13px]" onClick={() => setVisibleCount((count) => count + ROWS_PER_PAGE)}>
            Mostrar {Math.min(ROWS_PER_PAGE, hidden)} filas más
          </button>
        </div>
      )}
    </section>
  );
}
