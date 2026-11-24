import { describe, expect, it } from 'vitest';
import { planBelt } from '../features/belt-planner/domain/planner';
import { inchesToLength, lengthToInches } from '../features/belt-planner/domain/units';
import { DEFAULT_FORM, previewConversions, restoreForm, validatePlannerForm } from '../features/belt-planner/form/plannerForm';
import { PlannerInput } from '../features/belt-planner/types';
import { formatLength } from '../features/belt-planner/utils/format';

describe('largo en pies o metros', () => {
  it('convierte con 1 ft = 12 in y 1 in = 2.54 cm', () => {
    expect(lengthToInches(5, 'ft')).toBe(60);
    expect(lengthToInches(1, 'm')).toBeCloseTo(39.3700787, 6);
    expect(inchesToLength(60, 'ft')).toBe(5);
    expect(inchesToLength(39.37007874, 'm')).toBeCloseTo(1, 8);
    expect(formatLength(120, 'ft')).toBe('10.000 ft');
    expect(formatLength(120, 'm')).toBe('3.0480 m');
    expect(formatLength(59.04, 'm')).toBe('1.4996 m');
    expect(formatLength(120, undefined)).toBe('120.000 in');
  });

  it('el formulario por defecto es 5 ft (los mismos 60 in de antes)', () => {
    expect(DEFAULT_FORM).toMatchObject({ lengthValue: '5', lengthUnit: 'ft' });
    expect(validatePlannerForm(DEFAULT_FORM).input).toMatchObject({ lengthInches: 60, lengthUnit: 'ft' });
  });

  it('acepta el largo en metros y lo convierte a filas con el pitch', () => {
    const form = { ...DEFAULT_FORM, lengthValue: '3', lengthUnit: 'm' as const };
    const { input } = validatePlannerForm(form);
    expect(input?.lengthInches).toBeCloseTo(118.11, 2);
    expect(previewConversions(form).rowsCount).toBe(118);
  });

  it('el mensaje de error nombra la unidad elegida', () => {
    expect(validatePlannerForm({ ...DEFAULT_FORM, lengthValue: '0', lengthUnit: 'm' }).errors.lengthValue).toBe(
      'Escribe el largo en metros, mayor que 0.'
    );
  });

  it('un formulario guardado con el largo en pulgadas se pasa a pies', () => {
    expect(restoreForm({ lengthInches: '120' })).toMatchObject({ lengthValue: '10', lengthUnit: 'ft' });
    expect(restoreForm({ lengthValue: '2.5', lengthUnit: 'm' })).toMatchObject({ lengthValue: '2.5', lengthUnit: 'm' });
  });

  it('el aviso de ajuste de largo usa la unidad capturada', () => {
    const input: PlannerInput = {
      pitchInches: 2,
      linkIncrementInches: 0.66,
      widthInches: 23.76,
      lengthInches: lengthToInches(10.05, 'ft'),
      lengthUnit: 'ft',
      roundingMode: 'round',
      edgesNormal: [3, 6],
      innerNormal: [6, 9, 12],
      edgesPusher: [3],
      innerPusher: [6],
      flightConfig: { enabled: false, mode: 'rows', stepRows: 4, offsetRows: 0, stepInches: 0, offsetInches: 0 }
    };
    const messages = planBelt(input).notices.map((notice) => notice.message);
    expect(messages).toContain('El largo quedó en 60 filas = 10.000 ft (120.000 in) (se pidieron 10.05 ft).');
  });
});
