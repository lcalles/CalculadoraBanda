import { describe, expect, it } from 'vitest';
import { INTRALOX_2022_CATALOG } from '../features/belt-catalog/data/intralox2022';
import {
  createEntryId,
  entryLabel,
  filterEntries,
  groupBySeries,
  mergeEntries,
  missingBaseEntries,
  parseCatalogDocument,
  serializeCatalog,
  sortEntries,
  widthInLinks
} from '../features/belt-catalog/domain/catalog';
import { draftFromEntry, duplicateDraft, emptyDraft, validateDraft } from '../features/belt-catalog/domain/entryDraft';
import { BeltCatalogEntry } from '../features/belt-catalog/types';

const s800FlatTop = INTRALOX_2022_CATALOG.find((entry) => entry.series === 'S800' && entry.style === 'Flat Top')!;

function entry(partial: Partial<BeltCatalogEntry>): BeltCatalogEntry {
  return {
    id: createEntryId(partial.manufacturer ?? 'Intralox', partial.series ?? 'S1', partial.style ?? 'Prueba'),
    manufacturer: 'Intralox',
    series: 'S1',
    style: 'Prueba',
    family: 'recta',
    pitchInches: 1,
    linkIncrementInches: 0.5,
    minWidthInches: null,
    maxWidthInches: null,
    modules: null,
    flights: [],
    bidirectional: true,
    notes: '',
    source: '',
    origin: 'usuario',
    ...partial
  };
}

describe('catálogo Intralox precargado', () => {
  it('trae las bandas con datos completos y sin ids repetidos', () => {
    expect(INTRALOX_2022_CATALOG.length).toBe(157);
    const ids = INTRALOX_2022_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    INTRALOX_2022_CATALOG.forEach((item) => {
      expect(item.pitchInches).toBeGreaterThan(0);
      expect(item.linkIncrementInches).toBeGreaterThan(0);
      expect(item.source).toMatch(/^Catálogo Intralox 2022, pág\. \d+$/);
      if (item.minWidthInches !== null && item.maxWidthInches !== null) {
        expect(item.maxWidthInches).toBeGreaterThanOrEqual(item.minWidthInches);
      }
    });
  });

  it('S800 Flat Top coincide con la ficha del catálogo (pág. 79)', () => {
    expect(s800FlatTop).toMatchObject({
      manufacturer: 'Intralox',
      pitchInches: 2,
      linkIncrementInches: 0.66,
      minWidthInches: 2,
      maxWidthInches: null,
      source: 'Catálogo Intralox 2022, pág. 79'
    });
    expect(entryLabel(s800FlatTop)).toBe('S800 Flat Top');
  });

  it('el ancho mínimo del catálogo se compara en links (2 in = 3 links de 0.66 in)', () => {
    expect(widthInLinks(2, 0.66)).toBe(3);
    expect(widthInLinks(4.6, 0.66)).toBe(7);
    expect(widthInLinks(null, 0.66)).toBeNull();
  });
});

describe('búsqueda y orden', () => {
  it('encuentra por número de serie y palabras del estilo', () => {
    const results = filterEntries(INTRALOX_2022_CATALOG, '800 flat top');
    expect(results.map(entryLabel)).toContain('S800 Flat Top');
    expect(results.every((item) => item.series === 'S800')).toBe(true);
    expect(filterEntries(INTRALOX_2022_CATALOG, 's800').length).toBe(filterEntries(INTRALOX_2022_CATALOG, '800').length);
    // "800" no debe traer S1800 ni S2800.
    expect(filterEntries(INTRALOX_2022_CATALOG, '800').every((item) => item.series === 'S800')).toBe(true);
    // Mientras se escribe, "8" ya muestra las series que empiezan así.
    const typing = new Set(filterEntries(INTRALOX_2022_CATALOG, '8').map((item) => item.series));
    expect([...typing]).toEqual(expect.arrayContaining(['S800', 'S850', 'S888']));
    expect(typing.has('S1800') || typing.has('S2800')).toBe(false);
  });

  it('filtra por tipo de banda', () => {
    const spiral = filterEntries(INTRALOX_2022_CATALOG, '', 'espiral');
    expect(spiral.length).toBeGreaterThan(0);
    expect(spiral.every((item) => item.family === 'espiral')).toBe(true);
  });

  it('ordena por número de serie y agrupa por serie', () => {
    const sorted = sortEntries([entry({ series: 'S1100' }), entry({ series: 'S800' }), entry({ series: 'S100' })]);
    expect(sorted.map((item) => item.series)).toEqual(['S100', 'S800', 'S1100']);
    const groups = groupBySeries(INTRALOX_2022_CATALOG);
    expect(groups[0].label).toBe('Intralox S100');
    expect(groups.find((group) => group.label === 'Intralox S800')?.entries.length).toBeGreaterThan(5);
  });
});

describe('importar y exportar', () => {
  it('lo exportado se vuelve a importar igual', () => {
    const sample = INTRALOX_2022_CATALOG.slice(0, 5);
    const parsed = parseCatalogDocument(JSON.parse(serializeCatalog(sample)));
    expect(parsed.rejected).toBe(0);
    expect(sortEntries(parsed.entries)).toEqual(sortEntries(sample));
  });

  it('omite las filas incompletas y cuenta cuántas', () => {
    const parsed = parseCatalogDocument({
      entries: [{ series: 'S9', style: 'X', pitchInches: 1, linkIncrementInches: 0.5 }, { series: 'S9', style: 'Sin pitch' }, 'basura']
    });
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]).toMatchObject({ origin: 'usuario', family: 'recta', modules: null });
    expect(parsed.rejected).toBe(2);
  });

  it('combina: la misma banda se actualiza y las nuevas se agregan', () => {
    const current = [entry({ series: 'S1', style: 'A' }), entry({ series: 'S1', style: 'B' })];
    const incoming = [entry({ series: 'S1', style: 'B', pitchInches: 2 }), entry({ series: 'S2', style: 'C' })];
    const result = mergeEntries(current, incoming);
    expect(result).toMatchObject({ added: 1, updated: 1 });
    expect(result.entries).toHaveLength(3);
    expect(result.entries.find((item) => item.style === 'B')?.pitchInches).toBe(2);
  });

  it('detecta las bandas base que se eliminaron', () => {
    const remaining = INTRALOX_2022_CATALOG.filter((item) => item.id !== s800FlatTop.id);
    expect(missingBaseEntries(remaining, INTRALOX_2022_CATALOG)).toEqual([s800FlatTop]);
  });
});

describe('editar bandas', () => {
  it('valida campos obligatorios y rangos', () => {
    const { entry: saved, errors } = validateDraft(
      emptyDraft({ series: '', pitchInches: '0', linkIncrementInches: 'x', minWidthInches: '10', maxWidthInches: '5' }),
      []
    );
    expect(saved).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['linkIncrementInches', 'maxWidthInches', 'pitchInches', 'series', 'style']);
  });

  it('no permite dos bandas con el mismo fabricante, serie y estilo', () => {
    const { errors } = validateDraft(emptyDraft({ series: 'S800', style: 'Flat Top', pitchInches: '2', linkIncrementInches: '0.66' }), INTRALOX_2022_CATALOG);
    expect(errors.style).toContain('Ya existe la banda S800 Flat Top');
  });

  it('editar una banda conserva sus datos y permite guardarla sobre sí misma', () => {
    const draft = { ...draftFromEntry(s800FlatTop), notes: 'Acetal blanco' };
    const { entry: saved } = validateDraft(draft, INTRALOX_2022_CATALOG);
    expect(saved).toMatchObject({ id: s800FlatTop.id, pitchInches: 2, linkIncrementInches: 0.66, notes: 'Acetal blanco', origin: 'base' });
  });

  it('guarda tamaños de módulo predefinidos solo si se activan', () => {
    const base = emptyDraft({ series: 'S9', style: 'Prueba', pitchInches: '1', linkIncrementInches: '0.5' });
    expect(validateDraft(base, []).entry?.modules).toBeNull();
    const withModules = { ...base, hasModules: true, modules: { edgesNormal: [2, 3], innerNormal: [6], edgesPusher: [], innerPusher: [] } };
    expect(validateDraft(withModules, []).entry?.modules?.edgesNormal).toEqual([2, 3]);
    const missingEdges = { ...withModules, modules: { ...withModules.modules, edgesNormal: [] } };
    expect(validateDraft(missingEdges, []).errors.modules).toBeDefined();
  });

  it('duplicar crea una banda nueva de usuario', () => {
    const copy = duplicateDraft(s800FlatTop);
    expect(copy).toMatchObject({ editingId: null, style: 'Flat Top (copia)', origin: 'usuario' });
    expect(validateDraft(copy, INTRALOX_2022_CATALOG).entry?.id).not.toBe(s800FlatTop.id);
  });
});
