import { FormEvent, useState } from 'react';
import { Copy } from 'lucide-react';
import { Dialog } from '../../../components/Dialog';
import { NumberField } from '../../../components/NumberField';
import { Switch } from '../../../components/Switch';
import { TextField } from '../../../components/TextField';
import { SizeSelector } from '../../belt-planner/components/SizeSelector';
import { parseDecimal } from '../../belt-planner/form/plannerForm';
import { FAMILY_LABELS, widthInLinks } from '../domain/catalog';
import { DraftErrors, EntryDraft, validateDraft } from '../domain/entryDraft';
import { BeltCatalogEntry, BeltFamily, ModulePreset } from '../types';
import { FlightsEditor } from './FlightsEditor';

interface CatalogEntryDialogProps {
  initialDraft: EntryDraft;
  existing: readonly BeltCatalogEntry[];
  /** Tamaños elegidos en la calculadora, para copiarlos a la banda. */
  calculatorModules: ModulePreset;
  onSave: (entry: BeltCatalogEntry, replacingId: string | null) => void;
  onClose: () => void;
}

const FAMILIES: BeltFamily[] = ['recta', 'radio', 'espiral'];

function linksHint(widthText: string, incrementText: string): string | undefined {
  const width = parseDecimal(widthText);
  const increment = parseDecimal(incrementText);
  if (!(width > 0) || !(increment > 0)) return 'Opcional.';
  return `${widthInLinks(width, increment)} links con este incremento.`;
}

/** Alta o edición de una banda del catálogo. */
export function CatalogEntryDialog({ initialDraft, existing, calculatorModules, onSave, onClose }: CatalogEntryDialogProps) {
  const [draft, setDraft] = useState<EntryDraft>(initialDraft);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { errors } = validateDraft(draft, existing);
  const visibleErrors: DraftErrors = submitAttempted ? errors : {};
  const update = (patch: Partial<EntryDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateModules = (patch: Partial<ModulePreset>) => setDraft((current) => ({ ...current, modules: { ...current.modules, ...patch } }));
  const increment = parseDecimal(draft.linkIncrementInches);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const result = validateDraft(draft, existing);
    if (result.entry) onSave(result.entry, draft.editingId);
  };

  return (
    <Dialog open title={draft.editingId ? 'Editar banda' : 'Agregar banda'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Identificación</legend>
            <TextField id="banda-fabricante" label="Fabricante" value={draft.manufacturer} onChange={(manufacturer) => update({ manufacturer })} />
            <div className="flex flex-col gap-1">
              <label htmlFor="banda-familia" className="text-sm font-medium">
                Tipo de banda
              </label>
              <select
                id="banda-familia"
                className="field-select"
                value={draft.family}
                onChange={(event) => update({ family: event.target.value as BeltFamily })}
              >
                {FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {FAMILY_LABELS[family]}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="banda-serie"
              label="Serie"
              value={draft.series}
              placeholder="S800"
              autoFocus
              onChange={(series) => update({ series })}
              error={errors.series}
              showError={submitAttempted}
            />
            <TextField
              id="banda-estilo"
              label="Estilo"
              value={draft.style}
              placeholder="Flat Top"
              onChange={(style) => update({ style })}
              error={errors.style}
              showError={submitAttempted}
            />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 font-display text-[17px] font-semibold">Geometría</legend>
            <NumberField
              id="banda-pitch"
              label="Pitch"
              unit="in"
              value={draft.pitchInches}
              onChange={(pitchInches) => update({ pitchInches })}
              error={errors.pitchInches}
              forceShowError={submitAttempted}
              hint="Largo de cada fila."
            />
            <NumberField
              id="banda-incremento"
              label="Incremento por link"
              unit="in"
              value={draft.linkIncrementInches}
              onChange={(linkIncrementInches) => update({ linkIncrementInches })}
              error={errors.linkIncrementInches}
              forceShowError={submitAttempted}
              hint="En el catálogo Intralox: Width Increments."
            />
            <NumberField
              id="banda-minimo"
              label="Ancho mínimo"
              unit="in"
              value={draft.minWidthInches}
              onChange={(minWidthInches) => update({ minWidthInches })}
              error={visibleErrors.minWidthInches}
              forceShowError={submitAttempted}
              hint={linksHint(draft.minWidthInches, draft.linkIncrementInches)}
            />
            <NumberField
              id="banda-maximo"
              label="Ancho máximo"
              unit="in"
              value={draft.maxWidthInches}
              onChange={(maxWidthInches) => update({ maxWidthInches })}
              error={visibleErrors.maxWidthInches}
              forceShowError={submitAttempted}
              hint={linksHint(draft.maxWidthInches, draft.linkIncrementInches)}
            />
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <input
                id="banda-bidireccional"
                type="checkbox"
                checked={draft.bidirectional}
                onChange={(event) => update({ bidirectional: event.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--ink))]"
              />
              <label htmlFor="banda-bidireccional" className="cursor-pointer">
                <span className="block text-sm font-medium">Bidireccional</span>
                <span className="block text-[13px] leading-snug text-ink-muted">
                  {draft.bidirectional
                    ? 'Sin sentido de marcha: la orilla izquierda y la derecha son la misma pieza.'
                    : 'Con sentido de marcha: la orilla izquierda y la derecha son piezas espejo distintas.'}
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-display text-[17px] font-semibold">Tamaños de módulo</legend>
            <Switch
              id="banda-con-modulos"
              checked={draft.hasModules}
              onChange={(hasModules) => update({ hasModules })}
              description="Al elegir esta banda en la calculadora se cargan estos tamaños. Si está apagado, se conservan los que tengas elegidos."
            >
              Predefinir tamaños de módulo
            </Switch>
            {draft.hasModules && (
              <>
                <button
                  type="button"
                  className="btn btn-quiet -ml-2 text-[13px]"
                  onClick={() =>
                    updateModules({
                      edgesNormal: [...calculatorModules.edgesNormal],
                      innerNormal: [...calculatorModules.innerNormal],
                      edgesPusher: [...calculatorModules.edgesPusher],
                      innerPusher: [...calculatorModules.innerPusher]
                    })
                  }
                >
                  <Copy aria-hidden="true" size={15} />
                  Copiar los tamaños elegidos en la calculadora
                </button>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SizeSelector
                    id="banda-orillas"
                    label="Orillas"
                    selected={draft.modules.edgesNormal}
                    onChange={(edgesNormal) => updateModules({ edgesNormal })}
                    linkIncrementInches={increment > 0 ? increment : null}
                    error={errors.modules}
                    showError={submitAttempted}
                  />
                  <SizeSelector
                    id="banda-internos"
                    label="Internos"
                    selected={draft.modules.innerNormal}
                    onChange={(innerNormal) => updateModules({ innerNormal })}
                    linkIncrementInches={increment > 0 ? increment : null}
                  />
                  <SizeSelector
                    id="banda-orillas-empujador"
                    label="Orillas de empujador"
                    selected={draft.modules.edgesPusher}
                    onChange={(edgesPusher) => updateModules({ edgesPusher })}
                    linkIncrementInches={increment > 0 ? increment : null}
                  />
                  <SizeSelector
                    id="banda-internos-empujador"
                    label="Internos de empujador"
                    selected={draft.modules.innerPusher}
                    onChange={(innerPusher) => updateModules({ innerPusher })}
                    linkIncrementInches={increment > 0 ? increment : null}
                  />
                </div>
              </>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-display text-[17px] font-semibold">Empujadores ({draft.flights.length})</legend>
            <FlightsEditor
              flights={draft.flights}
              onChange={(flights) => update({ flights })}
              error={errors.flights}
              showError={submitAttempted}
            />
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 font-display text-[17px] font-semibold">Referencia</legend>
            <TextField
              id="banda-fuente"
              label="Fuente de los datos"
              value={draft.source}
              placeholder="Catálogo Intralox 2022, pág. 79"
              onChange={(source) => update({ source })}
            />
            <TextField
              id="banda-notas"
              label="Notas"
              value={draft.notes}
              multiline
              placeholder="Material, color, accesorios disponibles…"
              onChange={(notes) => update({ notes })}
            />
          </fieldset>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar banda
          </button>
        </div>
      </form>
    </Dialog>
  );
}
