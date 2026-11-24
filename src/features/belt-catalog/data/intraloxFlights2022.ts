import { FlightSpec } from '../types';

/**
 * Empujadores (flights) del "Catálogo Intralox.pdf" (Engineering Manual 2022), capturados a mano
 * ficha por ficha a partir del texto del manual. Se capturaron a mano porque cada ficha
 * redacta distinto el indent ("Minimum indent without sideguards", "Minimum recommended
 * indent", "Molded 1.3 in indent available", "Standard indent"…).
 *
 * - minIndent: indent mínimo sin sideguards. null = el manual no lo indica (ver notas).
 * - molded: indents moldeados disponibles (el módulo de empujador trae la orilla integrada).
 * - Las alturas están en pulgadas, como en la columna "Available Flight Height".
 * Sideguards fuera de alcance por decisión de ingeniería.
 */
interface FlightRow {
  series: string;
  name: string;
  heights: number[];
  materials: string;
  minIndent: number | null;
  molded?: number[];
  notes?: string;
  page: number;
  /** El empujador no aplica a estos estilos (según el manual). */
  excludeStyles?: (style: string) => boolean;
  /** Indent que depende del estilo de banda (S1100). */
  minIndentForStyle?: (style: string) => number;
}

const FLIGHT_ROWS: readonly FlightRow[] = [
  { series: 'S100', name: 'Streamline/No-Cling Flights', heights: [1.5], materials: 'Polypropylene, polyethylene, acetal', minIndent: 0.5, page: 32 },
  { series: 'S200', name: 'Double No-Cling Flights', heights: [3], materials: 'Polypropylene, polyethylene', minIndent: 0.7, page: 40 },
  { series: 'S200', name: 'Ribbed Flights', heights: [1.25, 3], materials: 'Polypropylene, polyethylene', minIndent: 0.7, page: 40 },
  {
    series: 'S400',
    name: 'Flush Grid Base Flights (Streamline/No-Cling)',
    heights: [1, 2, 3],
    materials: 'Polypropylene, polyethylene',
    minIndent: 0.8,
    notes: 'Con orilla Slidelox el indent mínimo es 1.4 in.',
    page: 60
  },
  {
    series: 'S400',
    name: 'Flush Grid Base Flights (Double No-Cling)',
    heights: [6],
    materials: 'Polypropylene, polyethylene',
    minIndent: 0.8,
    notes: 'Con orilla Slidelox el indent mínimo es 1.4 in.',
    page: 60
  },
  { series: 'S400', name: 'Open Hinge Base Flights (Streamline/No-Cling)', heights: [1, 2, 3], materials: 'Polypropylene, polyethylene', minIndent: 0.6, page: 60 },
  {
    series: 'S400',
    name: 'Flat Top Base Flights (Streamline)',
    heights: [4, 6],
    materials: 'Polypropylene, polyethylene, acetal',
    minIndent: 0.8,
    notes: 'No se usa en bandas Flush Grid. Con orilla Slidelox el indent mínimo es 1.4 in.',
    page: 61,
    excludeStyles: (style) => style.includes('Flush Grid')
  },
  {
    series: 'S800',
    name: 'Streamline Flights',
    heights: [1, 2, 3, 4, 6],
    materials: 'Polypropylene, polyethylene, acetal, nylon',
    minIndent: 1.3,
    page: 101
  },
  { series: 'S800', name: 'Flat Top Base Flights (No-Cling)', heights: [4], materials: 'Polypropylene, polyethylene, acetal', minIndent: 1.3, page: 102 },
  { series: 'S800', name: 'Nub Top Base Flights (Double No-Cling)', heights: [4], materials: 'Polypropylene, polyethylene, acetal', minIndent: 1.3, page: 102 },
  {
    series: 'S800',
    name: 'Flush Grid Base Flights (No-Cling)',
    heights: [2, 4],
    materials: 'Polypropylene, polyethylene, acetal, ChemBlox, detectable polypropylene A22',
    minIndent: 1.3,
    molded: [1.3],
    notes: 'No se usa con S800 Perforated Flat Top (versión ranurada de 18 % de área abierta).',
    page: 103,
    excludeStyles: (style) => style === 'Perforated Flat Top'
  },
  {
    series: 'S800',
    name: 'No-Cling Impact Resistant Open Hinge Flights',
    heights: [4],
    materials: 'Acetal, polypropylene, polyethylene',
    minIndent: 1.3,
    molded: [1.3],
    page: 103
  },
  {
    series: 'S800',
    name: 'No-Cling Impact Resistant Open Hinge Nub Top Flights',
    heights: [4],
    materials: 'Acetal, polypropylene',
    minIndent: 1.3,
    molded: [1.3],
    page: 103
  },
  {
    series: 'S800',
    name: 'Heavy-Duty Edge Flights',
    heights: [4],
    materials: 'PK',
    minIndent: null,
    molded: [1.3, 2],
    notes: 'Se recortan a alturas desde 1.0 in. El manual solo indica indents moldeados.',
    page: 104
  },
  { series: 'S800', name: 'Impact Resistant Flights', heights: [1, 2, 3, 4], materials: 'Acetal, X-ray detectable acetal', minIndent: 1.3, page: 104 },
  {
    series: 'S800',
    name: 'Open Hinge Impact Resistant Flights',
    heights: [4, 6],
    materials: 'Polypropylene, polyethylene, acetal, X-ray detectable acetal, ChemBlox, PK',
    minIndent: 1.3,
    molded: [1.3, 2],
    page: 104
  },
  { series: 'S800', name: 'Tough Flights', heights: [4, 6], materials: 'Hi-Impact', minIndent: 1.3, molded: [2], page: 104 },
  { series: 'S800', name: 'Scoop Flights', heights: [3, 4, 6], materials: 'Polypropylene, polyethylene, acetal, nylon, ChemBlox', minIndent: 1.3, page: 105 },
  { series: 'S800', name: 'Bucket Flights', heights: [2.25, 3, 4, 6], materials: 'Polypropylene, polyethylene, acetal', minIndent: 1.3, page: 105 },
  {
    series: 'S800',
    name: '3-Piece Perforated Bucket and Scoop Flights',
    heights: [4],
    materials: 'Polypropylene, polyethylene, acetal',
    minIndent: 2,
    page: 105
  },
  {
    series: 'S850',
    name: 'Streamline Flights',
    heights: [4],
    materials: 'Acetal',
    minIndent: null,
    molded: [1.3],
    notes: 'Indent moldeado de 1.3 in en cada orilla. Sin costura (SeamFree) hasta 12 in de ancho.',
    page: 114
  },
  { series: 'S900', name: 'Flat Top Base Flights (Streamline)', heights: [1, 2, 3], materials: 'Polypropylene, polyethylene, acetal', minIndent: 0.7, page: 149 },
  { series: 'S900', name: 'Flush Grid Nub Top Base Flights (Double No-Cling)', heights: [4], materials: 'Polypropylene, acetal', minIndent: 0.7, page: 149 },
  {
    series: 'S900',
    name: 'Flush Grid Base Flights (Streamline/No-Cling)',
    heights: [1, 2],
    materials: 'Polypropylene, polyethylene, acetal, HR nylon, HHR nylon',
    minIndent: 0.7,
    page: 150
  },
  {
    series: 'S900',
    name: 'Open Flush Grid Flush Edge Base Flights (No-Cling)',
    heights: [2],
    materials: 'Polypropylene, heat resistant (HR) nylon',
    minIndent: null,
    molded: [1],
    notes: 'Moldeado con indent de 1 in; se puede maquinar a cualquier indent entre 1 y 3 in.',
    page: 150
  },
  {
    series: 'S900',
    name: 'Flat Top Base Flights (Streamline Rubber)',
    heights: [1, 2, 3],
    materials: 'Polypropylene',
    minIndent: null,
    notes: 'El manual no indica indent; consultar a Intralox.',
    page: 150
  },
  {
    series: 'S1100',
    name: 'Flat Top Base Flights (Streamline)',
    heights: [2],
    materials: 'Polypropylene, polyethylene, acetal, detectable polypropylene A22',
    minIndent: 2,
    notes: 'Se usa en bandas Flat Top y Flush Grid. Indent mínimo recomendado: 2 in en Flat Top, 1.5 in en Flush Grid.',
    page: 186,
    minIndentForStyle: (style) => (style.includes('Flush Grid') ? 1.5 : 2)
  },
  {
    series: 'S1100',
    name: 'Flush Grid Nub Top Base Flights (No-Cling)',
    heights: [2, 3],
    materials: 'Polypropylene, polyethylene, acetal (3 in: polypropylene, acetal)',
    minIndent: 1,
    notes: 'Indent mínimo recomendado.',
    page: 187
  },
  {
    series: 'S1500',
    name: 'Flush Grid Base Flights (Streamline)',
    heights: [1],
    materials: 'Acetal, HR nylon',
    minIndent: null,
    notes: 'El indent mínimo depende del ancho de la banda: de 3 a 3.75 in. Consultar a Intralox.',
    page: 230
  },
  {
    series: 'S1600',
    name: 'Open Hinge Flat Top Base Flight (No-Cling)',
    heights: [4],
    materials: 'Acetal, polyethylene, polypropylene, X-ray detectable acetal',
    minIndent: 1,
    notes: 'Se recortan a alturas desde 0.25 in.',
    page: 242
  },
  { series: 'S1600', name: 'Mesh Nub Top Base Flights (No-Cling)', heights: [4], materials: 'Acetal, polyethylene', minIndent: 1, page: 242 },
  {
    series: 'S1650',
    name: 'Minimum Hinge Flat Top Base Flights (Double No-Cling)',
    heights: [3],
    materials: 'Acetal',
    minIndent: null,
    molded: [1],
    notes: 'En anchos de pulgada par vienen con indent de 1 in; los anchos impares requieren indent maquinado. Se recortan desde 0.5 in.',
    page: 247
  },
  { series: 'S1700', name: 'Streamline Flights', heights: [4, 6], materials: 'Nylon (AR), detectable nylon', minIndent: 2, page: 254 },
  {
    series: 'S1800',
    name: 'Impact Resistant Flights',
    heights: [4],
    materials: 'Acetal, PK, polyethylene, polypropylene, X-ray detectable acetal',
    minIndent: null,
    notes: 'El manual no indica indent; consultar a Intralox.',
    page: 264
  },
  { series: 'S9000', name: 'Flat Top Base Flights (No-Cling)', heights: [3], materials: 'Polypropylene, nylon', minIndent: 2, page: 290 },
  {
    series: 'S2200',
    name: 'Streamline Flights',
    heights: [4],
    materials: 'Polypropylene, polyethylene, acetal',
    minIndent: 0.625,
    notes: 'El manual lo da como indent estándar. Flights en incrementos lineales de 1.5 in.',
    page: 313
  },
  {
    series: 'S2400',
    name: 'No-Cling Flights',
    heights: [3],
    materials: 'Polypropylene, polyethylene, acetal, X-ray detectable acetal',
    minIndent: 1.125,
    notes: 'Con estilo de sujeción inferior, separación mínima entre flights de 4 in.',
    page: 345
  }
];

function flightId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Empujadores del catálogo que aplican a un estilo de banda. */
export function intraloxFlightsFor(series: string, style: string, source: string): FlightSpec[] {
  return FLIGHT_ROWS.filter((row) => row.series === series && !row.excludeStyles?.(style)).map((row) => ({
    id: flightId(row.name),
    name: row.name,
    heightsInches: [...row.heights],
    materials: row.materials,
    minIndentInches: row.minIndentForStyle ? row.minIndentForStyle(style) : row.minIndent,
    moldedIndentInches: [...(row.molded ?? [])],
    notes: row.notes ?? '',
    source: `${source}, pág. ${row.page}`
  }));
}

export const INTRALOX_FLIGHT_COUNT = FLIGHT_ROWS.length;
