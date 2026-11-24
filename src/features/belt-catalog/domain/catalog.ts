import { referenceWidthInLinks } from '../../belt-planner/domain/units';
import { BeltCatalogEntry, BeltFamily, FlightSpec, ModulePreset } from '../types';

export const CATALOG_FILE_FORMAT = 'calculadora-banda/catalogo';
/** v2 agrega los empujadores (flights) de cada banda; v3 agrega si la banda es bidireccional. */
export const CATALOG_FILE_VERSION = 3;

export const FAMILY_LABELS: Record<BeltFamily, string> = {
  recta: 'Recta',
  radio: 'De radio',
  espiral: 'Espiral'
};

const FAMILIES: readonly BeltFamily[] = ['recta', 'radio', 'espiral'];

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Id estable a partir de fabricante, serie y estilo (la misma banda siempre tiene el mismo id). */
export function createEntryId(manufacturer: string, series: string, style: string): string {
  return [manufacturer, series, style].map(slug).filter(Boolean).join('--');
}

/** Nombre corto para mostrar: "S800 Flat Top". */
export function entryLabel(entry: Pick<BeltCatalogEntry, 'series' | 'style'>): string {
  return `${entry.series} ${entry.style}`.trim();
}

/** Ancho mínimo/máximo convertido a links con el incremento de la banda. */
export function widthInLinks(widthInches: number | null, linkIncrementInches: number): number | null {
  if (widthInches === null || !(linkIncrementInches > 0)) return null;
  return referenceWidthInLinks(widthInches, linkIncrementInches);
}

function seriesNumber(series: string): number {
  const match = series.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

/** Orden: fabricante, número de serie, nombre de serie y estilo. */
export function compareEntries(a: BeltCatalogEntry, b: BeltCatalogEntry): number {
  return (
    a.manufacturer.localeCompare(b.manufacturer, 'es') ||
    seriesNumber(a.series) - seriesNumber(b.series) ||
    a.series.localeCompare(b.series, 'es') ||
    a.style.localeCompare(b.style, 'es')
  );
}

export function sortEntries(entries: readonly BeltCatalogEntry[]): BeltCatalogEntry[] {
  return [...entries].sort(compareEntries);
}

/**
 * Búsqueda por palabras: cada palabra buscada debe ser el inicio de alguna palabra de la banda
 * (fabricante, serie con y sin "S", estilo o notas). "800 flat" encuentra "S800 Flat Top"
 * pero no "S1800"; "80" encuentra S800, S850 y S888 mientras se escribe.
 */
export function filterEntries(
  entries: readonly BeltCatalogEntry[],
  query: string,
  family: BeltFamily | 'todas' = 'todas'
): BeltCatalogEntry[] {
  const terms = slug(query).split('-').filter(Boolean);
  return entries.filter((entry) => {
    if (family !== 'todas' && entry.family !== family) return false;
    const words = slug(`${entry.manufacturer} ${entry.series} ${entry.series.replace(/^s/i, '')} ${entry.style} ${entry.notes}`).split('-');
    return terms.every((term) => words.some((word) => word.startsWith(term)));
  });
}

/** Agrupa por fabricante y serie para el selector de la calculadora. */
export function groupBySeries(entries: readonly BeltCatalogEntry[]): { key: string; label: string; entries: BeltCatalogEntry[] }[] {
  const groups = new Map<string, { key: string; label: string; entries: BeltCatalogEntry[] }>();
  sortEntries(entries).forEach((entry) => {
    const key = `${entry.manufacturer}|${entry.series}`;
    if (!groups.has(key)) groups.set(key, { key, label: `${entry.manufacturer} ${entry.series}`, entries: [] });
    groups.get(key)!.entries.push(entry);
  });
  return [...groups.values()];
}

// ---------- Validación y lectura de datos externos (almacenamiento local, archivos importados) ----------

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function optionalPositive(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return isPositiveNumber(value) ? value : undefined;
}

function sizeList(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || !value.every((size) => Number.isInteger(size) && size > 0)) return undefined;
  return [...new Set(value as number[])].sort((a, b) => a - b);
}

function parseModules(value: unknown): ModulePreset | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const edgesNormal = sizeList(source.edgesNormal);
  const innerNormal = sizeList(source.innerNormal);
  const edgesPusher = sizeList(source.edgesPusher);
  const innerPusher = sizeList(source.innerPusher);
  if (!edgesNormal || !innerNormal || !edgesPusher || !innerPusher) return undefined;
  return { edgesNormal, innerNormal, edgesPusher, innerPusher };
}

function positiveList(value: unknown): number[] {
  return Array.isArray(value) ? [...new Set(value.filter(isPositiveNumber))].sort((a, b) => a - b) : [];
}

/** Empujador válido o null (necesita al menos un nombre). */
export function parseFlight(raw: unknown): FlightSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const name = text(source.name);
  if (!name) return null;
  return {
    id: text(source.id) || slug(name),
    name,
    heightsInches: positiveList(source.heightsInches),
    materials: text(source.materials),
    minIndentInches: isPositiveNumber(source.minIndentInches) ? source.minIndentInches : null,
    moldedIndentInches: positiveList(source.moldedIndentInches),
    notes: text(source.notes),
    source: text(source.source)
  };
}

function parseFlights(value: unknown): FlightSpec[] {
  if (!Array.isArray(value)) return [];
  const flights: FlightSpec[] = [];
  value.forEach((item) => {
    const flight = parseFlight(item);
    if (flight && !flights.some((existing) => existing.id === flight.id)) flights.push(flight);
  });
  return flights;
}

/** Convierte un objeto desconocido en una banda válida, o null si le falta algo esencial. */
export function parseCatalogEntry(raw: unknown): BeltCatalogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const manufacturer = text(source.manufacturer);
  const series = text(source.series);
  const style = text(source.style);
  const minWidthInches = optionalPositive(source.minWidthInches);
  const maxWidthInches = optionalPositive(source.maxWidthInches);
  const modules = parseModules(source.modules);

  if (!series || !style || !isPositiveNumber(source.pitchInches) || !isPositiveNumber(source.linkIncrementInches)) return null;
  if (minWidthInches === undefined || maxWidthInches === undefined || modules === undefined) return null;

  return {
    id: text(source.id) || createEntryId(manufacturer, series, style),
    manufacturer,
    series,
    style,
    family: FAMILIES.includes(source.family as BeltFamily) ? (source.family as BeltFamily) : 'recta',
    pitchInches: source.pitchInches,
    linkIncrementInches: source.linkIncrementInches,
    minWidthInches,
    maxWidthInches,
    modules,
    flights: parseFlights(source.flights),
    bidirectional: typeof source.bidirectional === 'boolean' ? source.bidirectional : true,
    notes: text(source.notes),
    source: text(source.source),
    origin: source.origin === 'base' ? 'base' : 'usuario'
  };
}

export interface ParsedCatalog {
  entries: BeltCatalogEntry[];
  rejected: number;
}

/**
 * Los catálogos guardados antes de la v2 no tienen empujadores: a las bandas base que
 * no tengan ninguno se les agregan los del catálogo de fábrica.
 */
export function addMissingBaseFlights(entries: BeltCatalogEntry[], base: readonly BeltCatalogEntry[]): BeltCatalogEntry[] {
  const baseById = new Map(base.map((entry) => [entry.id, entry]));
  return entries.map((entry) => {
    const original = baseById.get(entry.id);
    return entry.flights.length === 0 && original && original.flights.length > 0
      ? { ...entry, flights: original.flights.map((flight) => ({ ...flight })) }
      : entry;
  });
}

/** Los catálogos anteriores a la v3 no sabían si la banda es bidireccional: las bandas base toman el dato de fábrica. */
export function addBaseDirectionality(entries: BeltCatalogEntry[], base: readonly BeltCatalogEntry[]): BeltCatalogEntry[] {
  const baseById = new Map(base.map((entry) => [entry.id, entry]));
  return entries.map((entry) => {
    const original = baseById.get(entry.id);
    return original ? { ...entry, bidirectional: original.bidirectional } : entry;
  });
}

/**
 * Lee un catálogo exportado (o solo una lista de bandas). Las filas inválidas se cuentan y se omiten.
 * Con `base`, a los archivos de versiones anteriores se les completan los datos de fábrica que no tenían.
 */
export function parseCatalogDocument(raw: unknown, base: readonly BeltCatalogEntry[] = []): ParsedCatalog {
  const document = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const list = Array.isArray(raw) ? raw : document?.entries;
  if (!Array.isArray(list)) return { entries: [], rejected: 0 };
  const entries: BeltCatalogEntry[] = [];
  let rejected = 0;
  list.forEach((item) => {
    const entry = parseCatalogEntry(item);
    if (entry) entries.push(entry);
    else rejected += 1;
  });
  const version = typeof document?.version === 'number' ? document.version : 1;
  let upgraded = version < 2 ? addMissingBaseFlights(entries, base) : entries;
  if (version < 3) upgraded = addBaseDirectionality(upgraded, base);
  return { entries: upgraded, rejected };
}

export function serializeCatalog(entries: readonly BeltCatalogEntry[], exportedAt: Date = new Date()): string {
  return JSON.stringify(
    { format: CATALOG_FILE_FORMAT, version: CATALOG_FILE_VERSION, exportedAt: exportedAt.toISOString(), entries: sortEntries(entries) },
    null,
    2
  );
}

export interface MergeResult {
  entries: BeltCatalogEntry[];
  added: number;
  updated: number;
}

/** Combina bandas importadas con el catálogo actual: misma banda (mismo id) se reemplaza, las nuevas se agregan. */
export function mergeEntries(current: readonly BeltCatalogEntry[], incoming: readonly BeltCatalogEntry[]): MergeResult {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  let added = 0;
  let updated = 0;
  incoming.forEach((entry) => {
    if (byId.has(entry.id)) updated += 1;
    else added += 1;
    byId.set(entry.id, entry);
  });
  return { entries: sortEntries([...byId.values()]), added, updated };
}

/** Bandas base que ya no están en el catálogo (porque se eliminaron). */
export function missingBaseEntries(current: readonly BeltCatalogEntry[], base: readonly BeltCatalogEntry[]): BeltCatalogEntry[] {
  const ids = new Set(current.map((entry) => entry.id));
  return base.filter((entry) => !ids.has(entry.id));
}
