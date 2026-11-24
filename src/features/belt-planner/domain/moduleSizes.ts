import { BASE_MAX_MODULE_LINKS, MAX_MODULE_WIDTH_INCHES, MIN_MODULE_LINKS } from './constants';
import { snapNearInteger } from './units';

/**
 * Tamaño de módulo más grande (links) que se ofrece para elegir con un incremento por link.
 * Entre más chico el incremento, más links caben en un módulo de hasta `MAX_MODULE_WIDTH_INCHES`;
 * nunca baja de `BASE_MAX_MODULE_LINKS` (20L). Sin incremento válido se ofrece el rango base.
 */
export function maxModuleLinks(linkIncrementInches: number | null): number {
  if (linkIncrementInches === null || !(linkIncrementInches > 0) || !Number.isFinite(linkIncrementInches)) {
    return BASE_MAX_MODULE_LINKS;
  }
  const fitting = Math.floor(snapNearInteger(MAX_MODULE_WIDTH_INCHES / linkIncrementInches));
  return Math.max(BASE_MAX_MODULE_LINKS, fitting);
}

/** Tamaños de módulo que se ofrecen para elegir con un incremento por link: del 2L a `maxModuleLinks`. */
export function availableModuleSizes(linkIncrementInches: number | null): number[] {
  const max = maxModuleLinks(linkIncrementInches);
  return Array.from({ length: max - MIN_MODULE_LINKS + 1 }, (_, index) => index + MIN_MODULE_LINKS);
}
