/** Tipo de banda según el catálogo: recta, de radio o espiral. */
export type BeltFamily = 'recta' | 'radio' | 'espiral';

/** Tamaños de módulo (en links) que se cargan al elegir la banda. */
export interface ModulePreset {
  edgesNormal: number[];
  innerNormal: number[];
  edgesPusher: number[];
  innerPusher: number[];
}

/**
 * Tipo de empujador (flight) disponible para una banda.
 * El indent es la franja sin flight desde la orilla de la banda; define el tamaño
 * mínimo de la orilla en las filas de empujador.
 */
export interface FlightSpec {
  id: string;
  name: string;
  heightsInches: number[];
  materials: string;
  /** "Minimum indent without sideguards" del catálogo; null si el catálogo no lo indica. */
  minIndentInches: number | null;
  /** Indents moldeados disponibles: el propio módulo de empujador trae la orilla. */
  moldedIndentInches: number[];
  notes: string;
  source: string;
}

/** Una banda del catálogo: serie + estilo con sus datos geométricos. */
export interface BeltCatalogEntry {
  id: string;
  manufacturer: string;
  /** Serie tal como se nombra en producción, p. ej. "S800". */
  series: string;
  /** Estilo dentro de la serie, p. ej. "Flat Top". */
  style: string;
  family: BeltFamily;
  pitchInches: number;
  /** Incremento de ancho del catálogo ("Width Increments") = incremento por link. */
  linkIncrementInches: number;
  minWidthInches: number | null;
  maxWidthInches: number | null;
  /** Tamaños de módulo predefinidos; null = no cambia la selección actual al elegir la banda. */
  modules: ModulePreset | null;
  /** Empujadores compatibles con esta banda. */
  flights: FlightSpec[];
  /**
   * true: la banda no tiene sentido de marcha y la orilla izquierda y la derecha son la misma pieza.
   * false: tiene sentido de marcha ("preferred run direction"); las orillas izquierda y derecha son piezas espejo distintas.
   */
  bidirectional: boolean;
  notes: string;
  /** De dónde salen los datos, p. ej. "Catálogo Intralox 2022, pág. 79". */
  source: string;
  /** "base" viene precargada con la app; "usuario" la creó o importó el usuario. */
  origin: 'base' | 'usuario';
}
