import { BookOpen, BookmarkPlus } from 'lucide-react';
import { NumberField } from '../../../components/NumberField';
import { entryLabel, groupBySeries, widthInLinks } from '../../belt-catalog/domain/catalog';
import { BeltCatalogEntry } from '../../belt-catalog/types';
import { FormErrors, PlannerFormState, seriesValues } from '../form/plannerForm';
import { formatPlainNumber } from '../utils/format';

interface BeltSeriesSectionProps {
  form: PlannerFormState;
  errors: FormErrors;
  showErrors: boolean;
  catalogEntries: readonly BeltCatalogEntry[];
  selectedEntry: BeltCatalogEntry | null;
  selectedEntryMissing: boolean;
  onSelect: (entry: BeltCatalogEntry | null) => void;
  onChange: (patch: Partial<PlannerFormState>) => void;
  onShowInCatalog: (entryId: string) => void;
  onSaveToCatalog: () => void;
  pitchFieldId: string;
  incrementFieldId: string;
}

function widthLimits(entry: BeltCatalogEntry): string | null {
  const parts: string[] = [];
  const minLinks = widthInLinks(entry.minWidthInches, entry.linkIncrementInches);
  const maxLinks = widthInLinks(entry.maxWidthInches, entry.linkIncrementInches);
  if (entry.minWidthInches !== null) parts.push(`mínimo ${formatPlainNumber(entry.minWidthInches)} in (${minLinks} links)`);
  if (entry.maxWidthInches !== null) parts.push(`máximo ${formatPlainNumber(entry.maxWidthInches)} in (${maxLinks} links)`);
  return parts.length > 0 ? `Ancho ${parts.join(', ')}.` : null;
}

/** Selección de la banda del catálogo y, si es personalizada, captura de pitch e incremento. */
export function BeltSeriesSection({
  form,
  errors,
  showErrors,
  catalogEntries,
  selectedEntry,
  selectedEntryMissing,
  onSelect,
  onChange,
  onShowInCatalog,
  onSaveToCatalog,
  pitchFieldId,
  incrementFieldId
}: BeltSeriesSectionProps) {
  const groups = groupBySeries(catalogEntries);
  const values = seriesValues(form, selectedEntry ? { ...selectedEntry, label: entryLabel(selectedEntry) } : null);
  const fromCatalog = selectedEntry !== null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="campo-banda" className="text-sm font-medium">
          Banda del catálogo
        </label>
        <select
          id="campo-banda"
          className="field-select"
          value={selectedEntry?.id ?? ''}
          onChange={(event) => onSelect(catalogEntries.find((entry) => entry.id === event.target.value) ?? null)}
          aria-describedby="campo-banda-ayuda"
        >
          <option value="">Personalizada (capturar pitch e incremento)</option>
          {groups.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entryLabel(entry)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p id="campo-banda-ayuda" className="text-[13px] leading-snug text-ink-muted">
          {selectedEntryMissing
            ? 'La banda elegida ya no está en el catálogo; se usan el pitch y el incremento capturados.'
            : fromCatalog
              ? [
                  widthLimits(selectedEntry),
                  selectedEntry.bidirectional
                    ? 'Bidireccional: la orilla izquierda y la derecha son la misma pieza.'
                    : 'Con sentido de marcha: la orilla izquierda y la derecha son piezas distintas.',
                  selectedEntry.source
                ]
                  .filter(Boolean)
                  .join(' ')
              : `${catalogEntries.length} bandas en el catálogo. Una banda personalizada cuenta la orilla izquierda y la derecha por separado.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id={pitchFieldId}
          label="Pitch"
          unit="in"
          value={values.pitch}
          readOnly={fromCatalog}
          onChange={(value) => onChange({ pitchInches: value })}
          error={errors.pitchInches}
          forceShowError={showErrors}
          hint={fromCatalog ? 'De la banda elegida.' : 'Largo de cada fila.'}
        />
        <NumberField
          id={incrementFieldId}
          label="Incremento por link"
          unit="in"
          value={values.increment}
          readOnly={fromCatalog}
          onChange={(value) => onChange({ linkIncrementInches: value })}
          error={errors.linkIncrementInches}
          forceShowError={showErrors}
          hint={fromCatalog ? 'De la banda elegida.' : 'Ancho de 1 link.'}
        />
      </div>

      {fromCatalog ? (
        <button type="button" className="btn btn-quiet -ml-2 text-[13px]" onClick={() => onShowInCatalog(selectedEntry.id)}>
          <BookOpen aria-hidden="true" size={15} />
          Ver o editar {entryLabel(selectedEntry)} en el catálogo
        </button>
      ) : (
        <button type="button" className="btn btn-quiet -ml-2 text-[13px]" onClick={onSaveToCatalog}>
          <BookmarkPlus aria-hidden="true" size={15} />
          Guardar esta banda en el catálogo
        </button>
      )}
    </>
  );
}
