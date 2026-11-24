import { describe, expect, it } from 'vitest';
import { createRowPattern } from '../features/belt-planner/domain/patterns';
import { availableModuleSizes } from '../features/belt-planner/domain/moduleSizes';
import {
  formatCompositionInches,
  formatInchPosition,
  formatModuleInches,
  formatModuleSize,
  formatModuleSizeExact,
  formatModuleSizes,
  formatSeamsInches,
  inchPosition,
  joinWithAnd,
  nominalModuleInches
} from '../features/belt-planner/utils/format';

/** Incrementos por link de las bandas del catálogo Intralox 2022. */
const CATALOG_INCREMENTS = [0.25, 0.33, 0.36, 0.5, 0.66, 0.98, 1, 2, 2.001, 3, 3.35];

describe('nombre de los módulos en pulgadas (redondeo al cuarto)', () => {
  it('S900 (0.33 in por link): cada tamaño se nombra por su ancho real redondeado al cuarto de pulgada', () => {
    const names = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 14, 18, 36].map((links) => [links, nominalModuleInches(links, 0.33)]));
    expect(names).toEqual({ 2: 0.75, 3: 1, 4: 1.25, 5: 1.75, 6: 2, 7: 2.25, 8: 2.75, 9: 3, 14: 4.5, 18: 6, 36: 12 });
  });

  it('con incrementos que ya son cuartos, el nombre es la medida exacta', () => {
    expect([2, 3, 5].map((links) => nominalModuleInches(links, 0.25))).toEqual([0.5, 0.75, 1.25]);
    expect([2, 3, 9].map((links) => nominalModuleInches(links, 0.5))).toEqual([1, 1.5, 4.5]);
  });

  it('el medio cuarto sube', () => {
    expect(nominalModuleInches(3, 0.125)).toBe(0.5); // 0.375 in
    expect(nominalModuleInches(5, 0.125)).toBe(0.75); // 0.625 in
  });

  it('nunca nombra un módulo como 0 in', () => {
    expect(nominalModuleInches(2, 0.05)).toBe(0.25);
  });

  it('el nombre nunca se aleja más de 1/8 in del ancho real', () => {
    CATALOG_INCREMENTS.forEach((increment) =>
      availableModuleSizes(increment).forEach((links) => {
        expect(Math.abs(nominalModuleInches(links, increment) - links * increment)).toBeLessThanOrEqual(0.125 + 1e-9);
      })
    );
  });

  it('en las bandas del catálogo dos tamaños nunca comparten nombre', () => {
    CATALOG_INCREMENTS.forEach((increment) => {
      const sizes = availableModuleSizes(increment);
      const names = new Set(sizes.map((links) => nominalModuleInches(links, increment)));
      expect(names.size, `incremento ${increment}`).toBe(sizes.length);
    });
  });
});

describe('textos en pulgadas con links de referencia', () => {
  it('nombre del módulo, con links y con la medida exacta', () => {
    expect(formatModuleInches(8, 0.33)).toBe('2.75 in');
    expect(formatModuleSize(9, 0.33)).toBe('3 in (9L)');
    expect(formatModuleSizes([3, 9], 0.33)).toBe('1 in (3L), 3 in (9L)');
    expect(formatModuleSizeExact(3, 0.33)).toBe('1 in (3L = 0.990 in)');
  });

  it('sin incremento válido muestra solo links', () => {
    expect(formatModuleSize(9, null)).toBe('9L');
    expect(formatModuleSize(9, 0)).toBe('9L');
  });

  it('juntas en pulgadas redondeadas al cuarto (caso reportado: S900, juntas en los links 3, 21 y 33)', () => {
    expect(formatSeamsInches([3, 21, 33], 0.33)).toBe('1 7 11'); // 0.99, 6.93 y 10.89 in
    expect(formatSeamsInches([12, 24], 0.33)).toBe('4 8'); // 3.96 y 7.92 in
    expect(formatSeamsInches([6, 18, 30], 0.33)).toBe('2 6 10'); // 1.98, 5.94 y 9.9 in
    expect(formatInchPosition(4, 0.33)).toBe('1.25'); // 1.32 in
    expect(formatInchPosition(4, 0.5)).toBe('2');
  });

  it('la posición de una junta se redondea desde la medida real, no sumando los nombres de los módulos', () => {
    // Nueve módulos de 2L (0.75 in de nombre cada uno) sumarían 6.75 in; la junta real está en 18 × 0.33 = 5.94 in.
    expect(inchPosition(18, 0.33)).toBe(6);
    // Así el error nunca pasa de 1/8 in, por ancha que sea la banda.
    for (let links = 1; links <= 2000; links += 1) {
      expect(Math.abs(inchPosition(links, 0.33) - links * 0.33)).toBeLessThanOrEqual(0.125 + 1e-9);
    }
  });

  it('en las bandas del catálogo, juntas en links distintos nunca se leen igual en pulgadas', () => {
    CATALOG_INCREMENTS.forEach((increment) => {
      const positions = Array.from({ length: 500 }, (_, index) => inchPosition(index + 1, increment));
      expect(new Set(positions).size, `incremento ${increment}`).toBe(positions.length);
    });
  });

  it('composición de la fila con el nombre de cada módulo', () => {
    const row = createRowPattern(3, [9, 8], 6, 'normal');
    expect(formatCompositionInches(row.segments, 0.33)).toBe('1 + 3 + 2.75 + 2');
    expect(formatCompositionInches(row.segments, 0.33, ' ')).toBe('1 3 2.75 2');
  });

  it('une listas en español', () => {
    expect(joinWithAnd([])).toBe('');
    expect(joinWithAnd(['a'])).toBe('a');
    expect(joinWithAnd(['a', 'b'])).toBe('a y b');
    expect(joinWithAnd(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
