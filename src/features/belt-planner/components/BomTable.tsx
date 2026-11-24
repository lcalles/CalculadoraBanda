import { BomLine, ModuleKind } from '../types';
import { KIND_LABELS, ROLE_LABELS } from '../utils/format';
import { moduleKey, ModuleColor } from '../utils/moduleColors';

const KINDS: ModuleKind[] = ['normal', 'pusher'];

/**
 * Lista de materiales por tipo de inventario, rol y tamaño, con subtotales.
 * Las piezas cortadas dicen de qué módulo salen: "9L cortado a 7L".
 */
interface BomTableProps {
  bom: readonly BomLine[];
  pusherLabel?: string | null;
  /** Paleta del plan, para que cada línea muestre el color de su módulo en el diagrama. */
  moduleColors: ReadonlyMap<string, ModuleColor>;
}

export function BomTable({ bom, pusherLabel = null, moduleColors }: BomTableProps) {
  const total = bom.reduce((sum, line) => sum + line.quantity, 0);
  const groups = KINDS.map((kind) => ({ kind, lines: bom.filter((line) => line.kind === kind) })).filter(
    (group) => group.lines.length > 0
  );

  return (
    <section aria-labelledby="titulo-bom" className="min-w-0 border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2">
        <h3 id="titulo-bom" className="font-display text-lg font-semibold">
          Lista de materiales
        </h3>
        <span className="tabular text-[13px] text-ink-muted">{total.toLocaleString('es-MX')} piezas</span>
      </div>
      {bom.length === 0 ? (
        <p className="px-3 py-6 text-sm text-ink-muted">Sin piezas: no se armó ninguna fila.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-ink-muted">
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Rol
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Tamaño
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Ancho
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Cantidad
                </th>
              </tr>
            </thead>
            {groups.map((group) => {
              const subtotal = group.lines.reduce((sum, line) => sum + line.quantity, 0);
              return (
                <tbody key={group.kind}>
                  <tr className="bg-sunken/60">
                    <th scope="colgroup" colSpan={4} className="px-3 py-1 text-left text-[13px] font-semibold">
                      Módulos {group.kind === 'normal' ? 'normales' : `de empujador${pusherLabel ? `: ${pusherLabel}` : ''}`}
                    </th>
                  </tr>
                  {group.lines.map((line) => (
                      <tr key={`${line.kind}-${line.role}-${line.sizeLinks}-${line.cutFromLinks ?? ''}`} className="border-b border-line/70">
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="inline-block h-3 w-4 border border-ink"
                              style={{ backgroundColor: moduleColors.get(moduleKey({ kind: line.kind, role: line.role, size: line.sizeLinks }))?.fill }}
                            />
                            {ROLE_LABELS[line.role]}
                            <span className="sr-only"> {KIND_LABELS[line.kind].toLowerCase()}</span>
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {line.cutFromLinks !== undefined ? (
                            <>
                              <span className="text-ink-muted">{line.cutFromLinks}L cortado a </span>
                              {line.sizeLinks}L
                            </>
                          ) : (
                            `${line.sizeLinks}L`
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink-muted">{line.widthInches.toFixed(3)} in</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{line.quantity.toLocaleString('es-MX')}</td>
                      </tr>
                  ))}
                  {groups.length > 1 && (
                    <tr className="border-b border-line">
                      <th scope="row" colSpan={3} className="px-3 py-1.5 text-right text-[13px] font-medium text-ink-muted">
                        Subtotal {KIND_LABELS[group.kind].toLowerCase()}
                      </th>
                      <td className="px-3 py-1.5 text-right font-semibold">{subtotal.toLocaleString('es-MX')}</td>
                    </tr>
                  )}
                </tbody>
              );
            })}
            <tfoot>
              <tr className="border-t-2 border-ink/70">
                <th scope="row" colSpan={3} className="px-3 py-2 text-right font-semibold">
                  Total
                </th>
                <td className="px-3 py-2 text-right font-display text-base font-semibold">{total.toLocaleString('es-MX')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
