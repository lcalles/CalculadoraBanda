/** Tamaño de módulo más chico que se ofrece para elegir (links). */
export const MIN_MODULE_LINKS = 2;

/** Tamaño de módulo más grande que se ofrece con cualquier incremento (links), igual que la versión validada. */
export const BASE_MAX_MODULE_LINKS = 20;

/**
 * Ancho de módulo más grande que se ofrece (in). Con incrementos chicos da más de 20 links:
 * 0.33 in → 36L (11.88 in, el módulo de 36 links de la S900); 0.25 in → 48L; 0.5 in → 24L.
 * Supuesto: no se manejan módulos de más de 12 in salvo con incrementos de 0.66 in o más, donde se conserva el 20L.
 */
export const MAX_MODULE_WIDTH_INCHES = 12;

/** Tamaños de módulo ofrecidos sin incremento conocido (en links), del 2L al 20L. */
export const AVAILABLE_MODULE_SIZES: readonly number[] = Array.from(
  { length: BASE_MAX_MODULE_LINKS - MIN_MODULE_LINKS + 1 },
  (_, index) => index + MIN_MODULE_LINKS
);

/** Máximo de combinaciones de internos que se enumeran para un mismo ancho restante y número de piezas. */
export const DEFAULT_COMBINATION_LIMIT = 1200;

/** Máximo de patrones de fila que se conservan por inventario (igual que la versión validada). */
export const DEFAULT_MAX_PATTERNS = 500;

/**
 * Rotaciones tipo ladrillo que se agregan por cada combinación de internos.
 * La versión validada generaba los desplazamientos 1..3 (hasta 3 variantes extra).
 */
export const DEFAULT_MAX_BRICK_ROTATIONS = 3;

/** Límites de seguridad para no congelar el navegador con entradas fuera de escala. */
export const MAX_WIDTH_LINKS = 2000;
export const MAX_ROWS = 50000;
