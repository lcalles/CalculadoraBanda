import { describe, expect, it } from 'vitest';
import { INTRALOX_2022_CATALOG } from '../features/belt-catalog/data/intralox2022';
import { INTRALOX_FLIGHT_COUNT } from '../features/belt-catalog/data/intraloxFlights2022';
import { addMissingBaseFlights, parseCatalogDocument, parseFlight } from '../features/belt-catalog/domain/catalog';
import { draftFromEntry, emptyDraft, emptyFlightDraft, parseNumberList, validateDraft } from '../features/belt-catalog/domain/entryDraft';
import { defaultIndent, indentOptions } from '../features/belt-catalog/domain/flights';

const find = (series: string, style: string) => INTRALOX_2022_CATALOG.find((entry) => entry.series === series && entry.style === style)!;
const flight = (series: string, style: string, name: string) => find(series, style).flights.find((item) => item.name === name)!;

describe('empujadores del catálogo Intralox', () => {
  it('trae las 37 fichas de flights del manual', () => {
    expect(INTRALOX_FLIGHT_COUNT).toBe(37);
  });

  it('S800 Flat Top tiene los 13 empujadores de la serie con su indent y página', () => {
    const flights = find('S800', 'Flat Top').flights;
    expect(flights).toHaveLength(13);
    expect(flight('S800', 'Flat Top', 'Streamline Flights')).toEqual({
      id: 'streamline-flights',
      name: 'Streamline Flights',
      heightsInches: [1, 2, 3, 4, 6],
      materials: 'Polypropylene, polyethylene, acetal, nylon',
      minIndentInches: 1.3,
      moldedIndentInches: [],
      notes: '',
      source: 'Catálogo Intralox 2022, pág. 101'
    });
    expect(flight('S800', 'Flat Top', 'Heavy-Duty Edge Flights')).toMatchObject({ minIndentInches: null, moldedIndentInches: [1.3, 2] });
    expect(flight('S800', 'Flat Top', 'Tough Flights').moldedIndentInches).toEqual([2]);
    expect(flight('S800', 'Flat Top', 'Bucket Flights').heightsInches).toEqual([2.25, 3, 4, 6]);
  });

  it('respeta las exclusiones del manual', () => {
    const perforated = find('S800', 'Perforated Flat Top').flights.map((item) => item.name);
    expect(perforated).not.toContain('Flush Grid Base Flights (No-Cling)');
    expect(perforated).toHaveLength(12);
    const s400FlushGrid = find('S400', 'Flush Grid').flights.map((item) => item.name);
    expect(s400FlushGrid).not.toContain('Flat Top Base Flights (Streamline)');
    expect(find('S400', 'Flat Top').flights.map((item) => item.name)).toContain('Flat Top Base Flights (Streamline)');
  });

  it('usa el indent que corresponde al estilo cuando el manual lo distingue (S1100)', () => {
    expect(flight('S1100', 'Flat Top', 'Flat Top Base Flights (Streamline)').minIndentInches).toBe(2);
    expect(flight('S1100', 'Flush Grid Friction Top', 'Flat Top Base Flights (Streamline)').minIndentInches).toBe(1.5);
  });

  it('las series sin flights en el manual no traen empujadores', () => {
    expect(find('S1200', 'Flat Top').flights).toEqual([]);
  });
});

describe('indent de referencia según el tipo de orilla', () => {
  const heavyDuty = flight('S800', 'Flat Top', 'Heavy-Duty Edge Flights');
  const openHinge = flight('S800', 'Flat Top', 'Open Hinge Impact Resistant Flights');
  const streamline = flight('S800', 'Flat Top', 'Streamline Flights');

  it('con orillas de empujador propone primero el indent moldeado', () => {
    expect(indentOptions(openHinge, 'pusher').map((option) => option.label)).toEqual(['1.3 in moldeado', '2 in moldeado', '1.3 in mínimo']);
    expect(defaultIndent(heavyDuty, 'pusher')).toBe(1.3);
    expect(defaultIndent(streamline, 'pusher')).toBe(1.3);
  });

  it('con orillas normales solo aplica el indent mínimo', () => {
    expect(indentOptions(openHinge, 'normal').map((option) => option.label)).toEqual(['1.3 in mínimo']);
    expect(defaultIndent(heavyDuty, 'normal')).toBeNull();
  });
});

describe('catálogos guardados antes de los empujadores', () => {
  it('un catálogo v1 recupera los empujadores de las bandas base', () => {
    const v1 = { version: 1, entries: INTRALOX_2022_CATALOG.slice(0, 40).map(({ flights: _flights, ...rest }) => rest) };
    const { entries } = parseCatalogDocument(JSON.parse(JSON.stringify(v1)), INTRALOX_2022_CATALOG);
    const s800 = entries.find((entry) => entry.series === 'S800' && entry.style === 'Flat Top');
    expect(s800?.flights).toHaveLength(13);
  });

  it('un catálogo v2 respeta los empujadores tal como se guardaron (aunque estén vacíos)', () => {
    const edited = INTRALOX_2022_CATALOG.map((entry) => ({ ...entry, flights: [] }));
    const { entries } = parseCatalogDocument({ version: 2, entries: edited }, INTRALOX_2022_CATALOG);
    expect(entries.every((entry) => entry.flights.length === 0)).toBe(true);
  });

  it('addMissingBaseFlights no toca bandas de usuario', () => {
    const custom = { ...find('S800', 'Flat Top'), id: 'mi-banda', origin: 'usuario' as const, flights: [] };
    expect(addMissingBaseFlights([custom], INTRALOX_2022_CATALOG)[0].flights).toEqual([]);
  });

  it('parseFlight descarta empujadores sin nombre y limpia listas', () => {
    expect(parseFlight({ heightsInches: [1] })).toBeNull();
    expect(parseFlight({ name: 'X', heightsInches: [4, 'a', 2, 2], moldedIndentInches: [-1, 1.3] })).toMatchObject({
      id: 'x',
      heightsInches: [2, 4],
      moldedIndentInches: [1.3],
      minIndentInches: null
    });
  });
});

describe('editar empujadores de una banda', () => {
  it('lee listas de números separadas por comas', () => {
    expect(parseNumberList('1, 2,4 ; 6')).toEqual([1, 2, 4, 6]);
    expect(parseNumberList('')).toEqual([]);
    expect(parseNumberList('1, a')).toBeNull();
  });

  it('guarda los empujadores editados y conserva los del catálogo al editar la banda', () => {
    const draft = draftFromEntry(find('S800', 'Flat Top'));
    expect(draft.flights).toHaveLength(13);
    const { entry } = validateDraft(draft, INTRALOX_2022_CATALOG);
    expect(entry?.flights).toEqual(find('S800', 'Flat Top').flights);
  });

  it('valida nombre, alturas e indents', () => {
    const base = emptyDraft({ series: 'S9', style: 'Prueba', pitchInches: '1', linkIncrementInches: '0.5' });
    const noName = validateDraft({ ...base, flights: [{ ...emptyFlightDraft(), heights: '2' }] }, []);
    expect(noName.errors.flights).toBe('Empujador 1: escribe el nombre.');
    const badHeights = validateDraft({ ...base, flights: [{ ...emptyFlightDraft(), name: 'X', heights: '2, a' }] }, []);
    expect(badHeights.errors.flights).toContain('las alturas deben ser números');
    const ok = validateDraft({ ...base, flights: [{ ...emptyFlightDraft(), name: 'Mi flight', heights: '3', minIndent: '1', molded: '1.5' }] }, []);
    expect(ok.entry?.flights[0]).toMatchObject({ id: 'mi-flight', heightsInches: [3], minIndentInches: 1, moldedIndentInches: [1.5] });
  });
});
