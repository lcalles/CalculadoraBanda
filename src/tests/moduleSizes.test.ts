import { describe, expect, it } from 'vitest';
import { INTRALOX_2022_CATALOG } from '../features/belt-catalog/data/intralox2022';
import { AVAILABLE_MODULE_SIZES, BASE_MAX_MODULE_LINKS, MAX_MODULE_WIDTH_INCHES } from '../features/belt-planner/domain/constants';
import { availableModuleSizes, maxModuleLinks } from '../features/belt-planner/domain/moduleSizes';

describe('maxModuleLinks', () => {
  it('con incrementos chicos ofrece módulos de más links, hasta 12 in', () => {
    expect(maxModuleLinks(0.33)).toBe(36); // S900: módulo de 36 links = 11.88 in
    expect(maxModuleLinks(0.25)).toBe(48); // 12 in exactas, sin perder un link por punto flotante
    expect(maxModuleLinks(0.36)).toBe(33);
    expect(maxModuleLinks(0.5)).toBe(24);
  });

  it('nunca ofrece menos que el 20L de la versión validada', () => {
    expect(maxModuleLinks(0.66)).toBe(BASE_MAX_MODULE_LINKS);
    expect(maxModuleLinks(1)).toBe(20);
    expect(maxModuleLinks(3.35)).toBe(20);
  });

  it('sin incremento válido ofrece el rango base', () => {
    [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY].forEach((increment) => expect(maxModuleLinks(increment)).toBe(20));
    expect(availableModuleSizes(null)).toEqual([...AVAILABLE_MODULE_SIZES]);
  });

  it('el máximo nunca pasa de 12 in salvo cuando manda el 20L', () => {
    INTRALOX_2022_CATALOG.forEach(({ linkIncrementInches }) => {
      const max = maxModuleLinks(linkIncrementInches);
      if (max > BASE_MAX_MODULE_LINKS) {
        expect(max * linkIncrementInches).toBeLessThanOrEqual(MAX_MODULE_WIDTH_INCHES + 1e-9);
        expect((max + 1) * linkIncrementInches).toBeGreaterThan(MAX_MODULE_WIDTH_INCHES);
      }
    });
  });
});

describe('availableModuleSizes', () => {
  it('va del 2L al máximo, sin huecos', () => {
    const sizes = availableModuleSizes(0.33);
    expect(sizes[0]).toBe(2);
    expect(sizes[sizes.length - 1]).toBe(36);
    expect(sizes).toHaveLength(35);
    expect(availableModuleSizes(0.66)).toEqual([...AVAILABLE_MODULE_SIZES]);
  });
});
