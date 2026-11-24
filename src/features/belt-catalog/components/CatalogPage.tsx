import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { downloadTextFile } from '../../belt-planner/exporters';
import { INTRALOX_2022_CATALOG } from '../data/intralox2022';
import { formatModuleSizes, formatPlainNumber } from '../../belt-planner/utils/format';
import { entryLabel, FAMILY_LABELS, filterEntries, parseCatalogDocument, serializeCatalog, widthInLinks } from '../domain/catalog';
import { draftFromEntry, duplicateDraft, EntryDraft, emptyDraft } from '../domain/entryDraft';
import { BeltCatalogState } from '../hooks/useBeltCatalog';
import { BeltCatalogEntry, BeltFamily, ModulePreset } from '../types';
import { CatalogEntryDialog } from './CatalogEntryDialog';

/** Pedido que llega desde la calculadora: abrir una banda o crear una con datos prellenados. */
export type CatalogIntent = { kind: 'edit'; entryId: string } | { kind: 'new'; draft: Partial<EntryDraft> };

interface CatalogPageProps {
  catalog: BeltCatalogState;
  selectedEntryId: string | null;
  calculatorModules: ModulePreset;
  intent: CatalogIntent | null;
  onIntentHandled: () => void;
  onUseEntry: (entry: BeltCatalogEntry) => void;
}

const FAMILY_FILTERS: { value: BeltFamily | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'recta', label: FAMILY_LABELS.recta },
  { value: 'radio', label: FAMILY_LABELS.radio },
  { value: 'espiral', label: FAMILY_LABELS.espiral }
];

function widthCell(widthInches: number | null, increment: number) {
  if (widthInches === null) return <span className="text-ink-muted">—</span>;
  return (
    <>
      {formatPlainNumber(widthInches)} in <span className="text-ink-muted">({widthInLinks(widthInches, increment)} L)</span>
    </>
  );
}

/** Catálogo de bandas: buscar, agregar, editar, duplicar, eliminar, importar y exportar. */
export function CatalogPage({ catalog, selectedEntryId, calculatorModules, intent, onIntentHandled, onUseEntry }: CatalogPageProps) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<BeltFamily | 'todas'>('todas');
  const [editing, setEditing] = useState<EntryDraft | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => filterEntries(catalog.entries, query, family), [catalog.entries, query, family]);

  useEffect(() => {
    if (!intent) return;
    if (intent.kind === 'edit') {
      const entry = catalog.findById(intent.entryId);
      if (entry) setEditing(draftFromEntry(entry));
    } else {
      setEditing(emptyDraft(intent.draft));
    }
    onIntentHandled();
  }, [intent, catalog, onIntentHandled]);

  const handleSave = (entry: BeltCatalogEntry, replacingId: string | null) => {
    catalog.saveEntry(entry, replacingId);
    setEditing(null);
    setStatus({ tone: 'ok', message: `Se guardó ${entryLabel(entry)}.` });
  };

  const handleDelete = (entry: BeltCatalogEntry) => {
    const recoverable = entry.origin === 'base' ? ' Podrás recuperarla con "Recuperar bandas Intralox".' : '';
    if (!window.confirm(`¿Eliminar ${entryLabel(entry)} del catálogo?${recoverable}`)) return;
    catalog.removeEntry(entry.id);
    setStatus({ tone: 'ok', message: `Se eliminó ${entryLabel(entry)}.` });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { entries, rejected } = parseCatalogDocument(JSON.parse(await file.text()), INTRALOX_2022_CATALOG);
      if (entries.length === 0) {
        setStatus({ tone: 'error', message: `${file.name} no tiene bandas válidas. Usa un archivo exportado desde este catálogo.` });
        return;
      }
      const result = catalog.importEntries(entries);
      const skipped = rejected > 0 ? ` Se omitieron ${rejected} filas incompletas.` : '';
      setStatus({ tone: 'ok', message: `Se importaron ${entries.length} bandas: ${result.added} nuevas y ${result.updated} actualizadas.${skipped}` });
    } catch {
      setStatus({ tone: 'error', message: `No se pudo leer ${file.name}. Verifica que sea un archivo JSON.` });
    }
  };

  const handleRestore = () => {
    const count = catalog.missingBaseCount;
    catalog.restoreBase();
    setStatus({ tone: 'ok', message: `Se recuperaron ${count} bandas del catálogo Intralox.` });
  };

  return (
    <article aria-labelledby="titulo-catalogo" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="titulo-catalogo" className="font-display text-2xl font-semibold leading-tight">
            Catálogo de bandas
          </h2>
          <p className="text-sm text-ink-muted">
            Al elegir una banda en la calculadora se cargan su pitch, su incremento por link y, si los defines, sus tamaños de módulo. El
            catálogo se guarda en este navegador: expórtalo para respaldarlo o compartirlo con el equipo.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn btn-primary" onClick={() => setEditing(emptyDraft())}>
            <Plus aria-hidden="true" size={16} />
            Agregar banda
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload aria-hidden="true" size={16} />
            Importar
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={handleImport} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => downloadTextFile('catalogo-bandas.json', serializeCatalog(catalog.entries), 'application/json')}
          >
            <Download aria-hidden="true" size={16} />
            Exportar
          </button>
          {catalog.missingBaseCount > 0 && (
            <button type="button" className="btn btn-secondary" onClick={handleRestore}>
              <RotateCcw aria-hidden="true" size={16} />
              Recuperar bandas Intralox ({catalog.missingBaseCount})
            </button>
          )}
        </div>
      </header>

      <div aria-live="polite">
        {status && (
          <p className={`border-l-4 px-3 py-2 text-sm ${status.tone === 'ok' ? 'border-primary/60 bg-info-soft' : 'border-alert bg-alert-soft'}`}>
            {status.message}
          </p>
        )}
      </div>

      <section aria-label="Bandas" className="border border-ink/70 bg-surface">
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-3">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label htmlFor="buscar-banda" className="text-sm font-medium">
              Buscar
            </label>
            <input
              id="buscar-banda"
              type="search"
              className="field-input"
              placeholder="800 flat top"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filtro-familia" className="text-sm font-medium">
              Tipo
            </label>
            <select
              id="filtro-familia"
              className="field-select w-40"
              value={family}
              onChange={(event) => setFamily(event.target.value as BeltFamily | 'todas')}
            >
              {FAMILY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="tabular pb-2 text-[13px] text-ink-muted" aria-live="polite">
            {visible.length === catalog.entries.length
              ? `${catalog.entries.length} bandas`
              : `${visible.length} de ${catalog.entries.length} bandas`}
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-muted">
            {catalog.entries.length === 0 ? (
              <p>El catálogo está vacío. Agrega una banda o importa un catálogo.</p>
            ) : (
              <p>Ninguna banda coincide con la búsqueda. Prueba solo con el número de serie, por ejemplo 800.</p>
            )}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="tabular w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_rgb(var(--line))]">
                <tr className="text-left text-[13px] text-ink-muted">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Banda
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Pitch
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Incremento
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Ancho mín.
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Ancho máx.
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Módulos
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Empujadores
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Fuente
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => {
                  const label = entryLabel(entry);
                  const inUse = entry.id === selectedEntryId;
                  return (
                    <tr key={entry.id} className={`border-b border-line/60 ${inUse ? 'bg-info-soft' : 'hover:bg-sunken/50'}`}>
                      <th scope="row" className="px-3 py-1.5 text-left font-normal">
                        <span className="font-semibold">{label}</span>
                        {inUse && (
                          <span className="ml-2 rounded-sm border border-primary/50 px-1 text-[11px] font-semibold text-primary">En uso</span>
                        )}
                        <span className="block text-[12px] text-ink-muted">
                          {entry.manufacturer || 'Sin fabricante'}, {FAMILY_LABELS[entry.family].toLowerCase()}
                          {entry.bidirectional ? '' : ', con sentido de marcha'}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">{formatPlainNumber(entry.pitchInches, 4)} in</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">{formatPlainNumber(entry.linkIncrementInches, 4)} in</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">{widthCell(entry.minWidthInches, entry.linkIncrementInches)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">{widthCell(entry.maxWidthInches, entry.linkIncrementInches)}</td>
                      <td className="px-3 py-1.5 text-[13px]">
                        {entry.modules ? (
                          <span
                            title={
                              `Orillas ${formatModuleSizes(entry.modules.edgesNormal, entry.linkIncrementInches)}; ` +
                              `internos ${formatModuleSizes(entry.modules.innerNormal, entry.linkIncrementInches)}`
                            }
                          >
                            Predefinidos
                          </span>
                        ) : (
                          <span className="text-ink-muted">Sin definir</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-[13px]">
                        {entry.flights.length > 0 ? (
                          <span title={entry.flights.map((flight) => flight.name).join('\n')}>
                            {entry.flights.length === 1 ? '1 tipo' : `${entry.flights.length} tipos`}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-[13px] text-ink-muted">{entry.source || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">
                        <button type="button" className="btn btn-secondary h-8 px-2 text-[13px]" onClick={() => onUseEntry(entry)}>
                          Usar
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet ml-1 w-8 p-0"
                          onClick={() => setEditing(draftFromEntry(entry))}
                          aria-label={`Editar ${label}`}
                          title="Editar"
                        >
                          <Pencil aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet w-8 p-0"
                          onClick={() => setEditing(duplicateDraft(entry))}
                          aria-label={`Duplicar ${label}`}
                          title="Duplicar"
                        >
                          <Copy aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet w-8 p-0 hover:text-alert"
                          onClick={() => handleDelete(entry)}
                          aria-label={`Eliminar ${label}`}
                          title="Eliminar"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <CatalogEntryDialog
          initialDraft={editing}
          existing={catalog.entries}
          calculatorModules={calculatorModules}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </article>
  );
}
