import { describe, expect, it } from 'vitest';
import { planBelt } from '../features/belt-planner/domain/planner';
import {
  DEFAULT_FORM,
  normalizePlanTitle,
  parseDecimal,
  PLAN_TITLE_MAX_LENGTH,
  PlannerFormState,
  previewConversions,
  restoreForm,
  validatePlannerForm
} from '../features/belt-planner/form/plannerForm';

const form = (partial: Partial<PlannerFormState> = {}): PlannerFormState => ({ ...DEFAULT_FORM, ...partial });

describe('parseDecimal', () => {
  it('acepta punto o coma decimal', () => {
    expect(parseDecimal('24.5')).toBe(24.5);
    expect(parseDecimal('24,5')).toBe(24.5);
    expect(parseDecimal(' .5 ')).toBe(0.5);
  });

  it('rechaza texto incompleto o no numérico', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1.2.3')).toBeNaN();
  });
});

describe('validatePlannerForm', () => {
  it('el formulario por defecto es válido', () => {
    const { input, errors } = validatePlannerForm(DEFAULT_FORM);
    expect(errors).toEqual({});
    expect(input).toMatchObject({ pitchInches: 1, linkIncrementInches: 0.5, widthInches: 24, lengthInches: 60 });
    expect(input?.flightConfig).toEqual({
      enabled: true,
      mode: 'rows',
      stepRows: 4,
      offsetRows: 0,
      stepInches: 6,
      offsetInches: 0,
      edgeMode: 'pusher',
      edgeIndentInches: null,
      edgeIndentFit: 'minimum',
      flightLabel: null
    });
  });

  it('marca cada campo inválido con un mensaje propio', () => {
    const { input, errors } = validatePlannerForm(form({ pitchInches: '0', widthInches: 'x', edgesNormal: [] }));
    expect(input).toBeNull();
    expect(errors.pitchInches).toMatch(/pitch/);
    expect(errors.widthInches).toMatch(/ancho/);
    expect(errors.edgesNormal).toMatch(/orilla/);
  });

  it('rechaza un ancho que queda en 0 links', () => {
    const { errors } = validatePlannerForm(form({ widthInches: '0.2', roundingMode: 'floor' }));
    expect(errors.widthInches).toMatch(/0 links/);
  });

  it('valida solo los campos del modo de empujador activo', () => {
    const byRows = validatePlannerForm(form({ pusherStepRows: '2.5', pusherStepInches: 'x' }));
    expect(byRows.errors.pusherStepRows).toMatch(/entero/);
    expect(byRows.errors.pusherStepInches).toBeUndefined();

    const byDistance = validatePlannerForm(form({ pusherMode: 'distance', pusherStepRows: 'x', pusherStepInches: '0' }));
    expect(byDistance.errors.pusherStepInches).toBeDefined();
    expect(byDistance.errors.pusherStepRows).toBeUndefined();
  });

  it('con empujadores desactivados no exige sus campos', () => {
    const { input } = validatePlannerForm(form({ pusherEnabled: false, pusherStepRows: '', edgesPusher: [] }));
    expect(input?.flightConfig.enabled).toBe(false);
  });
});

describe('validatePlannerForm con banda del catálogo', () => {
  const s800 = { label: 'S800 Flat Top', pitchInches: 2, linkIncrementInches: 0.66, minWidthInches: 2, maxWidthInches: null };

  it('usa el pitch y el incremento de la banda, no los capturados', () => {
    const { input } = validatePlannerForm(form({ pitchInches: '999', linkIncrementInches: 'x' }), s800);
    expect(input).toMatchObject({ pitchInches: 2, linkIncrementInches: 0.66 });
  });

  it('acepta el ancho mínimo aunque en pulgadas exactas dé 1.98 (3 links)', () => {
    expect(validatePlannerForm(form({ widthInches: '1.98' }), s800).errors.widthInches).toBeUndefined();
  });

  it('rechaza un ancho menor al mínimo de la banda', () => {
    const { errors } = validatePlannerForm(form({ widthInches: '1.3' }), s800);
    expect(errors.widthInches).toBe('La S800 Flat Top tiene un ancho mínimo de 2 in (3 links); este ancho queda en 1.320 in (2 links).');
  });

  it('rechaza un ancho mayor al máximo de la banda', () => {
    const { errors } = validatePlannerForm(form({ widthInches: '70' }), { ...s800, maxWidthInches: 62 });
    expect(errors.widthInches).toContain('ancho máximo de 62 in');
  });

  it('la vista previa usa los datos de la banda', () => {
    expect(previewConversions(form({ widthInches: '24' }), s800)).toMatchObject({ widthLinks: 36, rowsCount: 30 });
  });

  it('el título del cálculo es opcional, se guarda y no entra al cálculo', () => {
    expect(DEFAULT_FORM.planTitle).toBe('');
    expect(restoreForm({ planTitle: 'OV 8926' }).planTitle).toBe('OV 8926');
    const withTitle = validatePlannerForm(form({ planTitle: 'OV 8926' })).input;
    expect(withTitle).toEqual(validatePlannerForm(form({ planTitle: '' })).input);
  });

  it('normaliza el título: sin espacios de sobra y con largo máximo', () => {
    expect(normalizePlanTitle('  Banda   para OV\n8926 ')).toBe('Banda para OV 8926');
    expect(normalizePlanTitle('a'.repeat(200))).toHaveLength(PLAN_TITLE_MAX_LENGTH);
  });

  it('recupera la banda elegida del almacenamiento', () => {
    expect(restoreForm({ catalogEntryId: 'intralox--s800--flat-top' }).catalogEntryId).toBe('intralox--s800--flat-top');
    expect(restoreForm({ catalogEntryId: 5 }).catalogEntryId).toBeNull();
  });
});

describe('validatePlannerForm: orillas e indent de empujador', () => {
  const s800 = {
    label: 'S800 Flat Top',
    pitchInches: 2,
    linkIncrementInches: 0.66,
    minWidthInches: 2,
    maxWidthInches: null,
    flights: [
      { id: 'streamline-flights', name: 'Streamline Flights', minIndentInches: 1.3 },
      { id: 'heavy-duty-edge-flights', name: 'Heavy-Duty Edge Flights', minIndentInches: null },
      { id: 'flight-prueba', name: 'Flight de prueba', minIndentInches: 2 }
    ]
  };

  it('con orillas de empujador pasa el indent escrito y el nombre del empujador al cálculo', () => {
    const { input } = validatePlannerForm(
      form({ pusherEdgeMode: 'pusher', pusherIndentInches: '2', flightId: 'streamline-flights', flightHeightInches: '4' }),
      s800
    );
    expect(input?.flightConfig).toMatchObject({ edgeMode: 'pusher', edgeIndentInches: 2, flightLabel: 'Streamline Flights, 4 in' });
  });

  it('con orillas normales e indent deseado vacío aplica el mínimo del empujador del catálogo', () => {
    // El indent de orillas de empujador no cuenta con orillas normales.
    // El mínimo del catálogo es solo un mínimo: sirve cualquier orilla que lo cubra.
    const withFlight = validatePlannerForm(form({ pusherEdgeMode: 'normal', pusherIndentInches: '2', flightId: 'streamline-flights' }), s800);
    expect(withFlight.input?.flightConfig).toMatchObject({ edgeMode: 'normal', edgeIndentInches: 1.3, edgeIndentFit: 'minimum' });
    // El catálogo no indica mínimo para este empujador: no se limitan las orillas.
    const noMinimum = validatePlannerForm(form({ pusherEdgeMode: 'normal', pusherIndentInches: '2', flightId: 'heavy-duty-edge-flights' }), s800);
    expect(noMinimum.input?.flightConfig.edgeIndentInches).toBeNull();
    // Sin empujador elegido tampoco; y un indent de orillas de empujador inválido no bloquea porque no se usa.
    const noFlight = validatePlannerForm(form({ pusherEdgeMode: 'normal', pusherIndentInches: '0' }), s800);
    expect(noFlight.errors).toEqual({});
    expect(noFlight.input?.flightConfig.edgeIndentInches).toBeNull();
  });

  it('con orillas normales aplica el indent deseado escrito, exacto, con o sin empujador del catálogo', () => {
    const typed = (partial: Partial<PlannerFormState>) =>
      validatePlannerForm(form({ pusherEdgeMode: 'normal', edgesNormal: [2, 3, 4, 6], ...partial }), s800).input?.flightConfig.edgeIndentInches;
    expect(
      validatePlannerForm(form({ pusherEdgeMode: 'normal', normalEdgeIndentInches: '1.5' }), s800).input?.flightConfig.edgeIndentFit
    ).toBe('exact');
    expect(typed({ normalEdgeIndentInches: '2,5', flightId: 'streamline-flights' })).toBe(2.5);
    expect(typed({ normalEdgeIndentInches: '1.5', flightId: 'heavy-duty-edge-flights' })).toBe(1.5);
    expect(typed({ normalEdgeIndentInches: '1.5' })).toBe(1.5);
    // Menor que el mínimo del catálogo: se respeta (la pantalla lo advierte, no lo bloquea).
    expect(typed({ normalEdgeIndentInches: '0.8', flightId: 'streamline-flights' })).toBe(0.8);
  });

  it('cada tipo de orilla valida solo su propio indent', () => {
    const normal = validatePlannerForm(form({ pusherEdgeMode: 'normal', normalEdgeIndentInches: '0' }), s800);
    expect(normal.errors.normalEdgeIndentInches).toMatch(/vacío para usar el mínimo del catálogo/);
    expect(validatePlannerForm(form({ pusherEdgeMode: 'normal', normalEdgeIndentInches: 'x' }), s800).errors.normalEdgeIndentInches).toBeDefined();
    const pusher = validatePlannerForm(form({ pusherEdgeMode: 'pusher', normalEdgeIndentInches: '0', pusherIndentInches: '1.3' }), s800);
    expect(pusher.errors).toEqual({});
    expect(pusher.input?.flightConfig.edgeIndentInches).toBe(1.3);
  });

  it('el indent deseado llega al plan: las filas de empujador solo usan la orilla normal que lo da', () => {
    // 2 in con incremento 0.66 pide 3 links: en las filas de empujador quedan fuera la de 2L y también la de 6L.
    const { input } = validatePlannerForm(
      form({ pusherEdgeMode: 'normal', normalEdgeIndentInches: '2', edgesNormal: [2, 3, 6], innerNormal: [6, 9], innerPusher: [6, 9] }),
      s800
    );
    const result = planBelt(input!);
    expect(result.pusherEdges).toMatchObject({
      mode: 'normal',
      fit: 'exact',
      indentInches: 2,
      minEdgeLinks: 3,
      usableSizes: [3],
      excludedSizes: [2, 6]
    });
    const pusherRows = result.rows.filter((row) => row.kind === 'pusher');
    expect(pusherRows.length).toBeGreaterThan(0);
    pusherRows.forEach((row) => {
      expect(row.segments[0]).toMatchObject({ kind: 'normal', size: 3 });
      expect(row.segments[row.segments.length - 1]).toMatchObject({ kind: 'normal', size: 3 });
    });
  });

  it('con orillas normales no exige orillas de empujador', () => {
    expect(validatePlannerForm(form({ pusherEdgeMode: 'normal', edgesPusher: [] }), s800).errors.edgesPusher).toBeUndefined();
    expect(validatePlannerForm(form({ pusherEdgeMode: 'pusher', edgesPusher: [] }), s800).errors.edgesPusher).toBeDefined();
  });

  it('rechaza un indent inválido y acepta dejarlo vacío', () => {
    expect(validatePlannerForm(form({ pusherIndentInches: '0' }), s800).errors.pusherIndentInches).toBeDefined();
    expect(validatePlannerForm(form({ pusherIndentInches: '' }), s800).input?.flightConfig.edgeIndentInches).toBeNull();
  });

  it('marca error si ninguna orilla cubre el indent', () => {
    // 2 in con incremento 0.66 pide 3 links; las orillas de empujador son 2L.
    const pusherEdges = validatePlannerForm(form({ edgesPusher: [2], pusherIndentInches: '2' }), s800);
    // 3L × 0.66 in = 1.98 in, que se nombra "2 in".
    expect(pusherEdges.errors.edgesPusher).toBe('Ninguna orilla de empujador cubre el indent de 2 in: se necesitan orillas de 2 in (3L) o más.');
    const normalEdges = validatePlannerForm(form({ pusherEdgeMode: 'normal', edgesNormal: [2], flightId: 'flight-prueba' }), s800);
    expect(normalEdges.errors.edgesNormal).toBe(
      'Flight de prueba pide un indent mínimo de 2 in: para las filas de empujador se necesita una orilla normal de 2 in (3L) o más.'
    );
    expect(normalEdges.errors.pusherIndentInches).toBeUndefined();
  });

  it('con el corte de módulos activo, la orilla exacta del indent puede salir de una orilla mayor', () => {
    const typedNormal = (edgesNormal: number[], allowCutModules: boolean) =>
      validatePlannerForm(form({ pusherEdgeMode: 'normal', edgesNormal, normalEdgeIndentInches: '2', allowCutModules }), s800).errors.edgesNormal;
    expect(typedNormal([2, 6], false)).toMatch(/elige ese tamaño en orillas normales\.$/);
    expect(typedNormal([2, 6], true)).toBeUndefined();
    // Ninguna orilla mayor que cortar: el mensaje lo dice.
    expect(typedNormal([2], true)).toMatch(/elige ese tamaño en orillas normales o uno mayor para cortarlo\.$/);
  });

  it('el corte de módulos está apagado por defecto, se guarda y llega al cálculo', () => {
    expect(DEFAULT_FORM.allowCutModules).toBe(false);
    expect(validatePlannerForm(DEFAULT_FORM).input?.allowCutModules).toBe(false);
    expect(validatePlannerForm(form({ allowCutModules: true })).input?.allowCutModules).toBe(true);
    expect(restoreForm({ allowCutModules: true }).allowCutModules).toBe(true);
    expect(restoreForm({ allowCutModules: 'sí' }).allowCutModules).toBe(false);
  });

  it('con indent deseado exige la orilla normal exacta, aunque haya otras más grandes', () => {
    const expected =
      'Con un indent deseado de 2 in, las filas de empujador llevan orillas normales de 2 in (3L = 1.980 in): elige ese tamaño en orillas normales.';
    const typedNormal = (edgesNormal: number[]) =>
      validatePlannerForm(form({ pusherEdgeMode: 'normal', edgesNormal, flightId: 'streamline-flights', normalEdgeIndentInches: '2' }), s800)
        .errors.edgesNormal;
    expect(typedNormal([2])).toBe(expected);
    expect(typedNormal([2, 6])).toBe(expected);
    expect(typedNormal([2, 3, 6])).toBeUndefined();
  });

  it('recupera el tipo de orilla, el empujador y los indents guardados', () => {
    const restored = restoreForm({ pusherEdgeMode: 'normal', flightId: 'tough-flights', pusherIndentInches: '2', normalEdgeIndentInches: '1.5' });
    expect(restored).toMatchObject({ pusherEdgeMode: 'normal', flightId: 'tough-flights', pusherIndentInches: '2', normalEdgeIndentInches: '1.5' });
    expect(restoreForm({ pusherEdgeMode: 'otro' }).pusherEdgeMode).toBe('pusher');
    // Formularios guardados antes de este campo: queda vacío y se sigue aplicando el mínimo del catálogo.
    expect(restoreForm({ pusherEdgeMode: 'normal' }).normalEdgeIndentInches).toBe('');
  });
});

describe('previewConversions', () => {
  it('muestra links y filas reales mientras se captura', () => {
    expect(previewConversions(form({ widthInches: '24.2' }))).toEqual({
      widthLinks: 48,
      realWidthInches: 24,
      rowsCount: 60,
      realLengthInches: 60
    });
    expect(previewConversions(form({ widthInches: '' })).widthLinks).toBeNull();
  });
});

describe('restoreForm', () => {
  it('recupera valores válidos y descarta los que tienen forma inesperada', () => {
    const restored = restoreForm({ widthInches: '30', edgesNormal: [3, 'x'], roundingMode: 'up', pusherEnabled: false });
    expect(restored.widthInches).toBe('30');
    expect(restored.edgesNormal).toEqual(DEFAULT_FORM.edgesNormal);
    expect(restored.roundingMode).toBe(DEFAULT_FORM.roundingMode);
    expect(restored.pusherEnabled).toBe(false);
    expect(restoreForm(null)).toEqual(DEFAULT_FORM);
  });
});
