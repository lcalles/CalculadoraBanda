import { describe, expect, it } from 'vitest';
import { calculateRows, roundLinks, snapNearInteger } from '../features/belt-planner/domain/units';

describe('roundLinks', () => {
  it('aplica round, floor y ceil al convertir pulgadas a links', () => {
    expect(roundLinks(10.2, 0.5, 'round')).toBe(20);
    expect(roundLinks(10.2, 0.5, 'floor')).toBe(20);
    expect(roundLinks(10.2, 0.5, 'ceil')).toBe(21);
    expect(roundLinks(10.3, 0.5, 'round')).toBe(21);
  });

  it('no pierde ni gana un link por ruido de punto flotante', () => {
    // En JavaScript 0.3 / 0.1 = 2.9999999999999996 y 0.7 / 0.1 = 6.999999999999999
    expect(roundLinks(0.3, 0.1, 'floor')).toBe(3);
    expect(roundLinks(0.3, 0.1, 'ceil')).toBe(3);
    expect(roundLinks(0.7, 0.1, 'floor')).toBe(7);
    expect(roundLinks(24, 0.5, 'ceil')).toBe(48);
  });

  it('devuelve 0 con un incremento inválido', () => {
    expect(roundLinks(10, 0, 'round')).toBe(0);
    expect(roundLinks(10, -1, 'round')).toBe(0);
  });
});

describe('calculateRows', () => {
  it('convierte el largo a filas con el pitch, redondeando al más cercano', () => {
    expect(calculateRows(60, 1)).toBe(60);
    expect(calculateRows(10.4, 0.5)).toBe(21);
  });

  it('nunca devuelve menos de una fila', () => {
    expect(calculateRows(0.2, 1)).toBe(1);
  });
});

describe('snapNearInteger', () => {
  it('solo corrige valores pegados a un entero', () => {
    expect(snapNearInteger(2.9999999999999996)).toBe(3);
    expect(snapNearInteger(2.5)).toBe(2.5);
    expect(snapNearInteger(2.999)).toBe(2.999);
  });
});
