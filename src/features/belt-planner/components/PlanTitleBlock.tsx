import { ReactNode } from 'react';
import { PlannerInput, PlanResult } from '../types';
import { formatCount, formatInches, formatLength, formatModuleSize, formatPlainNumber } from '../utils/format';

interface CellProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: 'default' | 'alert';
}

function Cell({ label, value, detail, tone = 'default' }: CellProps) {
  return (
    <div className={`min-w-0 px-3 py-2.5 ${tone === 'alert' ? 'bg-alert-soft' : 'bg-surface'}`}>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className={`tabular font-display text-2xl font-semibold leading-tight ${tone === 'alert' ? 'text-alert' : ''}`}>{value}</dd>
      <dd className="tabular text-[13px] leading-snug text-ink-muted">{detail}</dd>
    </div>
  );
}

interface PlanTitleBlockProps {
  input: PlannerInput;
  result: PlanResult;
}

/** Cajetín del plan: los datos que producción necesita de un vistazo. */
export function PlanTitleBlock({ input, result }: PlanTitleBlockProps) {
  const { stats, pusherSpacing } = result;
  const pushersEnabled = input.flightConfig.enabled;
  const aligned = stats.alignedSeamCount;

  return (
    <dl
      aria-label="Resumen del plan"
      className="grid grid-cols-2 gap-px border border-ink/70 bg-line sm:grid-cols-3 xl:grid-cols-6"
    >
      <Cell
        label="Ancho"
        value={formatInches(result.realWidthInches)}
        detail={`${formatCount(result.widthLinks, 'link', 'links')} de ${formatPlainNumber(input.linkIncrementInches, 4)} in`}
      />
      <Cell
        label="Largo"
        value={formatCount(result.rowsCount, 'fila', 'filas')}
        detail={`${formatLength(result.realLengthInches, input.lengthUnit)} con pitch de ${formatPlainNumber(input.pitchInches)} in`}
      />
      <Cell
        label="Piezas"
        value={stats.totalPieces.toLocaleString('es-MX')}
        detail={
          stats.pusherPieces > 0
            ? `${stats.normalPieces.toLocaleString('es-MX')} normales y ${stats.pusherPieces.toLocaleString('es-MX')} de empujador`
            : 'Todas normales'
        }
      />
      <Cell
        label="Empujadores"
        value={pushersEnabled ? formatCount(stats.pusherRowsBuilt, 'fila', 'filas') : 'No'}
        detail={
          pushersEnabled && pusherSpacing
            ? [
                `Desde la fila ${pusherSpacing.offsetRows + 1}, cada ${formatCount(pusherSpacing.stepRows, 'fila', 'filas')}.`,
                input.flightConfig.flightLabel ? `${input.flightConfig.flightLabel}.` : null,
                result.pusherEdges
                  ? `Orillas ${result.pusherEdges.mode === 'pusher' ? 'de empujador' : 'normales'}` +
                    (result.pusherEdges.minEdgeLinks
                      ? ` de ${formatModuleSize(result.pusherEdges.minEdgeLinks, input.linkIncrementInches)}${result.pusherEdges.fit === 'exact' ? '' : ' o más'}.`
                      : '.')
                  : null
              ]
                .filter(Boolean)
                .join(' ')
            : 'Desactivados'
        }
      />
      <Cell
        label="Juntas alineadas"
        tone={aligned > 0 ? 'alert' : 'default'}
        value={aligned.toLocaleString('es-MX')}
        detail={aligned > 0 ? `En ${formatCount(stats.rowsWithAlignment, 'fila', 'filas')}` : 'Ninguna entre filas adyacentes'}
      />
      <Cell
        label="Patrones en uso"
        value={stats.uniqueSeamSets.toLocaleString('es-MX')}
        detail={`De ${result.patternsNormal.length} normales${pushersEnabled ? ` y ${result.patternsPusher.length} de empujador` : ''} posibles`}
      />
    </dl>
  );
}
