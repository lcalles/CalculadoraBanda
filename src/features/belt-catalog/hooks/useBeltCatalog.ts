import { useCallback, useEffect, useMemo, useState } from 'react';
import { INTRALOX_2022_CATALOG } from '../data/intralox2022';
import {
  mergeEntries,
  MergeResult,
  missingBaseEntries,
  parseCatalogDocument,
  serializeCatalog,
  sortEntries
} from '../domain/catalog';
import { BeltCatalogEntry } from '../types';

const STORAGE_KEY = 'calculadora-banda:catalogo:v1';

/** Catálogo guardado en este navegador; la primera vez se carga el catálogo Intralox. */
function loadCatalog(): BeltCatalogEntry[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return sortEntries(parseCatalogDocument(JSON.parse(stored), INTRALOX_2022_CATALOG).entries);
  } catch {
    // Almacenamiento bloqueado o dañado: se usa el catálogo base.
  }
  return sortEntries(INTRALOX_2022_CATALOG);
}

function storeCatalog(entries: readonly BeltCatalogEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeCatalog(entries));
  } catch {
    // Sin almacenamiento: el catálogo funciona durante la sesión y se puede exportar.
  }
}

export function useBeltCatalog() {
  const [entries, setEntries] = useState<BeltCatalogEntry[]>(loadCatalog);

  useEffect(() => storeCatalog(entries), [entries]);

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const findById = useCallback((id: string | null) => (id ? byId.get(id) ?? null : null), [byId]);

  /** Guarda una banda nueva o editada. `replacingId` es el id anterior si se renombró. */
  const saveEntry = useCallback((entry: BeltCatalogEntry, replacingId: string | null) => {
    setEntries((current) => sortEntries([...current.filter((item) => item.id !== replacingId && item.id !== entry.id), entry]));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const importEntries = useCallback(
    (incoming: readonly BeltCatalogEntry[]): MergeResult => {
      const result = mergeEntries(entries, incoming);
      setEntries(result.entries);
      return result;
    },
    [entries]
  );

  const missingBase = useMemo(() => missingBaseEntries(entries, INTRALOX_2022_CATALOG), [entries]);

  const restoreBase = useCallback(() => {
    setEntries((current) => sortEntries([...current, ...missingBaseEntries(current, INTRALOX_2022_CATALOG)]));
  }, []);

  return { entries, findById, saveEntry, removeEntry, importEntries, missingBaseCount: missingBase.length, restoreBase };
}

export type BeltCatalogState = ReturnType<typeof useBeltCatalog>;
