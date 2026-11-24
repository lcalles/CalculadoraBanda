# Calculadora de armado de banda modular

Aplicación web (React + TypeScript + Vite + Tailwind) que convierte las medidas reales de una banda modular en un plan de armado para producción: filas, juntas, filas con empujador, lista de materiales y diagrama técnico.

## Ejecución local

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev      # servidor de desarrollo
npm run test     # pruebas unitarias (Vitest)
npm run build    # verificación de tipos + build de producción
```

Las fuentes (Barlow y Barlow Semi Condensed) van incluidas en el build, así que la app funciona sin internet en planta.

## Qué hace

1. **Medidas → links y filas.** Ancho (in) ÷ incremento por link, con redondeo `round`, `floor` o `ceil`. El largo se captura en **pies o metros** (selector ft / m), se convierte a pulgadas (1 ft = 12 in, 1 in = 2.54 cm) y se divide entre el pitch, al entero más cercano y mínimo 1 fila. Junto a cada campo se muestra la conversión mientras se captura.
2. **Patrones de fila.** Por cada par de orillas (izquierda, derecha) se buscan las combinaciones de módulos internos que suman exactamente el ancho restante. Una fila de solo dos orillas es válida únicamente si suman el ancho total. Los patrones se ordenan por menos piezas y, en empate, por piezas más grandes (mayor suma de cuadrados de los tamaños).
3. **Variantes tipo ladrillo.** Cada combinación agrega hasta 3 rotaciones de sus internos, inmediatamente después de la combinación base.
4. **Colocación de filas.** Una sola pasada, fila por fila. Cada fila se compara contra la que realmente quedó antes, sea normal o de empujador, y elige:
   1. la menor cantidad de juntas coincidentes;
   2. que la fila siguiente pueda colocarse con la menor coincidencia posible (mira una fila adelante);
   3. menos piezas sumando la fila y su mejor fila siguiente;
   4. piezas más grandes sumando la fila y su mejor fila siguiente;
   5. la prioridad del patrón.

   Los criterios 3 y 4 evalúan el par de filas, no la fila sola: un patrón que aislado gana por piezas más grandes puede obligar a que la fila siguiente use más piezas para no alinear juntas. Como la coincidencia entre dos filas es simétrica, en un tramo largo lo óptimo es alternar el mejor par de patrones compatibles, y este criterio lo encuentra.

   **Juntas alineadas = combinación inválida.** El plan nunca lleva dos filas vecinas con una junta en común.
   - Si la pasada anterior deja alguna junta alineada, mirar una fila adelante no bastó. Pasa, por ejemplo, con orillas fijas en las filas de empujador por un indent deseado: la fila normal antes del empujador queda obligada a coincidir porque la decisión que lo evitaba era de varias filas atrás.
   - En ese caso se calcula con exactitud, no por heurística (`domain/cleanLayout.ts`), qué patrones permiten terminar la banda sin coincidencias desde cada fila. Luego se repite la colocación eligiendo solo entre ellos, con los criterios 3 a 5. Si existe un armado sin juntas alineadas, siempre se encuentra.
   - Si no existe, la combinación es **inválida**: no hay filas, BOM ni diagrama, y el aviso explica:
     - en qué fila se traba;
     - qué juntas lo obligan (por ejemplo, las orillas fijas de 3L del indent deseado);
     - que hay que agregar tamaños o cambiar el paso de los empujadores.
   - Un plan que la primera pasada deja sin coincidencias no cambia.
   - Caso que lo motivó: S900, 36 links, orillas 3L/6L/9L, internos 9L, indent deseado de 1 in. La primera pasada dejaba 31 juntas alineadas; ahora sale sin ninguna.
5. **Empujadores.** Por paso en filas o por distancia en pulgadas, con offset. Las filas de empujador usan su propio inventario (orillas e internos) con el mismo ancho en links.
6. **Resultados.**
   - Cajetín con el resumen y avisos con su causa.
   - Diagrama SVG de las **primeras 20 filas** (bastan para ver el patrón), con cota de ancho, regla en links, filas numeradas, marca **E** en las filas de empujador y juntas alineadas en rojo. Si ninguna fila con empujador entra en esas 20, se indica cuál es la primera. Todas las filas siguen en la tabla de juntas y en las exportaciones.
   - BOM por tipo/rol/tamaño con subtotales.
   - Tabla de juntas por fila con filtro de filas alineadas.
7. **Exportación.**
   - BOM y juntas en CSV (UTF-8 con BOM para Excel).
   - Plan completo en JSON, con parámetros, filas, filas de empujador y avisos.
   - Diagrama en SVG.
   - Impresión con hoja de estilos propia.

8. **Título del cálculo.** Campo libre opcional al inicio del formulario (por ejemplo, "Banda para orden de venta 8926").
   - Encabeza la hoja de armado y la impresión, y es el nombre que propone el navegador al guardar a PDF.
   - Va al inicio del nombre de los archivos exportados (`banda-para-orden-de-venta-8926-s800-flat-top-36L-180filas-bom.csv`), en el campo `title` del JSON y en el título del SVG.
   - No entra al cálculo: cambiarlo no obliga a recalcular.

El formulario se guarda en el navegador (`localStorage`) y el plan solo se recalcula al presionar **Calcular plan**, como en la versión validada.

## Catálogo de bandas

La página **Catálogo de bandas** (`#/catalogo`) guarda las bandas con las que se trabaja: fabricante, serie, estilo, pitch, incremento por link, ancho mínimo y máximo, y, opcionalmente, tamaños de módulo predefinidos.

- **Precargado:** 157 estilos del *Catálogo Intralox 2022* (Engineering Manual, Modular Plastic Conveyor Belts).
  - Los datos se extrajeron de las filas *Pitch*, *Minimum Width*, *Maximum Width* y *Width Increments* de cada ficha. Cada valor en pulgadas se validó contra su equivalente en mm de la misma fila.
  - Cada banda indica la página del catálogo de donde salió.
  - Se omitieron los estilos sin incremento de ancho (*Mold to Width*, anchos fijos o "See Product Notes"); se pueden agregar a mano.
- **En la calculadora:** al elegir una banda (por ejemplo, *S800 Flat Top*), el pitch y el incremento quedan fijos con los valores del catálogo.
  - El ancho se valida contra el mínimo y el máximo de la banda.
  - Si la banda tiene tamaños de módulo predefinidos, también se cargan.
  - La hoja de armado, los nombres de archivo y el JSON exportado indican la banda.
- **Altas y cambios:** agregar, editar, duplicar y eliminar bandas.
  - *Guardar esta banda en el catálogo* crea una banda con el pitch, el incremento y los tamaños que tengas en la calculadora.
  - *Recuperar bandas Intralox* devuelve las precargadas que se hayan eliminado.
- **Respaldo y equipo:** el catálogo vive en el navegador.
  - *Exportar* genera `catalogo-bandas.json`, que se puede guardar en una carpeta compartida.
  - *Importar* lo vuelve a cargar: la misma banda se actualiza y las nuevas se agregan.

Archivos: `src/features/belt-catalog/` (`types.ts`, `data/intralox2022.ts`, `data/intraloxFlights2022.ts`, `domain/catalog.ts`, `domain/entryDraft.ts`, `domain/flights.ts`, `hooks/useBeltCatalog.ts`, `components/`).

## Empujadores (flights) e indent

En el manual de Intralox cada flight sale de un módulo de soporte y no llega a la orilla de la banda: queda una franja sin flight, el **indent**. Esa franja define el tamaño mínimo de la orilla en las filas de empujador.

- **Datos:** 37 fichas de flights de 15 series, capturadas a mano a partir del manual (`data/intraloxFlights2022.ts`). Cada una tiene:
  - alturas y materiales;
  - indent mínimo sin sideguards;
  - indents moldeados;
  - notas y página.
- **Asignación a las bandas:** cada banda trae los flights de su serie, salvo las exclusiones del manual (por ejemplo, Flush Grid Base Flights no aplica a S800 Perforated Flat Top).
  - Si el indent depende del estilo, se usa el que corresponde. En la S1100 es de 2 in en Flat Top y de 1.5 in en Flush Grid.
  - Los flights se pueden editar en la ficha de cada banda.
- **En la calculadora**, con empujadores activos:
  - **Tipo de empujador** y **altura**: aparecen en la BOM, en el cajetín, en el CSV y en el JSON.
  - **Usar orillas de empujador** (casilla):
    - Activada (por defecto, igual que antes): la orilla de la fila es el propio módulo de empujador con el indent integrado y se toma de *Orillas de empujador*.
    - Desactivada: la fila lleva las orillas normales de la banda y el empujador solo en los internos. En la BOM esas orillas cuentan como normales.
  - **Indent de referencia**: solo aparece con la casilla activada (orillas de empujador). Se propone el indent moldeado del empujador elegido y se puede editar. Las orillas de empujador que no lo cubren se marcan, no se usan en las filas de empujador y se avisa.
  - **Indent deseado**: solo aparece con la casilla desactivada (orillas normales). Es un campo propio, separado del indent de referencia, porque el moldeado de las orillas de empujador no aplica a las orillas normales.
    - Escrito: se cumple **exacto**. Con orillas normales, la orilla es justo la franja sin flight, así que su tamaño es el indent. Ambas orillas de cada fila de empujador son la orilla más chica que lo cubre (por ejemplo, 1 in con incremento de 0.33 → 3L = 0.990 in; 2 in con incremento de 0.66 → 3L = 1.980 in). No se usan orillas más grandes aunque ahorren piezas. Ese tamaño debe estar entre las orillas normales elegidas (o, con el corte de módulos activo, una orilla mayor de la cual cortarlo); si no, el formulario lo marca. Las filas normales siguen usando todas las orillas elegidas.
    - Vacío: se aplica el **indent mínimo sin sideguards** del empujador elegido, que se muestra como sugerencia en el campo. Sin empujador elegido, o si el catálogo no indica ese mínimo, no se limitan.
    - Si es menor que el mínimo del catálogo, se advierte pero no se bloquea: ingeniería puede tener información del fabricante que el manual no trae.
    - Se conserva al cambiar de empujador (es un requisito de la aplicación, no del flight) y se limpia al cambiar de banda.
- **Fuera de alcance:** los sideguards.

## Corte de módulos

Un módulo más grande se puede cortar para obtener uno menor: con un 9L elegido, en realidad están disponibles todos los tamaños menores. Se activa con la casilla **Permitir cortar módulos** (sección *Módulos normales*). Viene apagada, así que los planes sin ella salen igual que antes.

- **Qué se corta:** orillas e internos, normales y de empujador. Cada inventario puede usar todos los tamaños por debajo de su módulo más grande elegido, desde 2L. En los selectores solo queda marcado lo que se eligió.
- **De qué módulo sale:** del módulo elegido más chico que cubre el tamaño, el que menos desperdicia. Con 6L y 9L elegidos, el 7L se corta de un 9L y el 5L de un 6L. Un tamaño elegido nunca se corta.
- **Prioridad:**
  1. Menos piezas (regla 8). Si cortar ahorra piezas, se corta. Por ejemplo, 9 + 7 cortado (2 piezas) gana a 4·4·4·4 (4 piezas), y por eso se tiende a usar los módulos más grandes.
  2. A igual número de piezas, menos cortes. Por ejemplo, 8 + 8 gana a 9 + 7 cortado: es el mismo número de piezas, pero el segundo requiere cortar y desperdicia 2 links.
  3. Piezas más grandes (regla 9).

  La colocación de filas aplica el mismo orden al par de filas.
- **Lista de materiales:**
  - Las piezas cortadas van en su propia línea, por ejemplo *10 × "9L cortado a 7L"*.
  - El CSV agrega la columna *Cortado de (links)* al final, sin mover las anteriores.
  - El JSON marca cada pieza cortada con `cutFrom`.
  - Un aviso resume los cortes, por ejemplo *"Se cortan 10 módulos a un tamaño menor: 10 de 9L a 7L"*.
  - En el diagrama, la descripción emergente de cada pieza dice de qué módulo sale.
- **Indent deseado:** con el corte activo, la orilla exacta (por ejemplo, 3L) también puede salir de cortar una orilla normal mayor. El texto bajo el campo lo indica: *"…serán de 3L (0.990 in), cortadas de 6L"*.

## Estructura

```txt
src/
  App.tsx                       composición de la página
  components/                   controles genéricos (NumberField, SegmentedControl, Switch)
  hooks/useElementWidth.ts
  features/belt-planner/
    domain/                     lógica pura y testeable
      units.ts                  pulgadas → links / filas (con corrección de punto flotante)
      combinations.ts           combinaciones exactas por número de piezas
      seams.ts                  juntas y coincidencias
      patterns.ts               patrones de fila, prioridad y rotaciones tipo ladrillo
      pushers.ts                filas con empujador (por filas o por distancia)
      cuts.ts                   tamaños disponibles por inventario, con o sin corte de módulos
      layout.ts                 colocación de filas con anti-alineación
      cleanLayout.ts            búsqueda exacta de un armado sin juntas alineadas (o por qué no existe)
      bom.ts                    lista de materiales
      planner.ts                orquestador planBelt + avisos + estadísticas
      constants.ts              tamaños disponibles y límites
    form/plannerForm.ts         estado del formulario, validación y vista previa
    hooks/useBeltPlanner.ts     estado de la app (borrador vs. plan calculado)
    exporters/                  CSV, JSON, SVG y descarga
    utils/                      formato de textos y geometría del diagrama
    components/                 panel de parámetros, hoja de armado, diagrama, tablas
    types/
  tests/                        pruebas por módulo + fixture con la lógica validada original
```

## Cambios de comportamiento y por qué

Respecto a la versión React anterior (commit `6423e76`) y a la versión validada del prompt (`Prompt CalBanda.txt`):

| Cambio | Antes | Ahora | Por qué |
| --- | --- | --- | --- |
| Filas de empujador | Se armaban dos secuencias independientes (normal y empujador) y luego se intercalaban; la fila de empujador no se comparaba con la fila normal vecina. | Una sola pasada que compara cada fila con la que realmente queda antes, como la versión validada. | Regla 11: podían quedar juntas alineadas junto a los empujadores. |
| Desempate por tamaño | Se sumaban los tamaños internos, que siempre dan el ancho restante: el desempate no distinguía `[10,6]` de `[8,8]`. | Suma de cuadrados de todas las piezas (igual que la versión validada). | Regla 9. |
| Variantes tipo ladrillo | Solo se rotaba el mejor patrón. | Hasta 3 rotaciones por combinación (igual que la versión validada). | Regla 13 y más opciones para evitar alineación. |
| Límite de patrones | Sin tope total (hasta 1500 combinaciones por par de orillas). | Máximo 500 patrones (igual que la validada), generados por número de piezas ascendente. | Rendimiento; el resultado equivale a ordenar todo y quedarse con los primeros 500. |
| Combinaciones | Enumeración con límite que podía truncar antes de llegar a la de menos piezas. | Enumeración por número de piezas: el límite nunca descarta una combinación con menos piezas que otra incluida. | Regla 8 garantizada. |
| Mirada adelante | No existía. | Al elegir una fila se prefiere la que deja a la siguiente su mejor opción. | Evita que una fila normal deje sin opción limpia al empujador que sigue. |
| Juntas alineadas inevitables | Regla 12: se entregaba el plan con el menor solape posible y un aviso. | Combinación inválida: si no hay armado sin juntas alineadas, no se entrega plan y el aviso dice la causa. Si existe un armado así, se encuentra siempre (búsqueda exacta, no heurística). | Lo pidió producción: una junta alineada entre filas vecinas no es aceptable. Los planes que ya salían sin coincidencias no cambian. |
| Desempate por piezas al colocar filas | Entre filas con igual coincidencia se tomaba la de mayor prioridad aislada. Ej.: 23 links, orillas 6L/9L, internos 2L–9L: la fila 1 tomaba 9·5·9 (piezas más grandes), que choca con los demás patrones de 3 piezas, y la siguiente quedaba en 6·9·2·6 (4 piezas): 819 piezas en 234 filas. La versión validada hace lo mismo. | Se comparan piezas y tamaños del par (fila + su mejor fila siguiente). El mismo caso alterna 9·8·6 / 6·8·9: 702 piezas, sin coincidencias. | Regla 8 a nivel banda: habilitar más tamaños ya no puede aumentar las piezas en este escenario. La anti-alineación (criterios 1 y 2) no cambia. |
| Redondeo | `0.3 / 0.1` daba `2.9999…` y `floor` perdía un link. | Se corrige el ruido de punto flotante antes de redondear. | Exactitud de la conversión. |
| Exportación JSON | `pusherRows` era un `Set` y salía como `{}`; no incluía parámetros y sí todos los patrones candidatos. | Incluye parámetros, resumen, filas de empujador como lista, avisos, BOM y filas. Los patrones solo se cuentan. | Archivo útil y manejable. |
| BOM | Claves de texto (`normal:edge-left:2L`). | Líneas estructuradas con tipo, rol, tamaño, ancho en pulgadas y cantidad. | Legible y exportable. |
| Cálculo | Se recalculaba en cada tecla; el botón Calcular casi no hacía nada. | Solo al presionar Calcular plan (como la versión validada), con aviso de cambios sin calcular. | Evita cálculos con capturas a medias. |
| Tamaños disponibles | `2,3,4,5,6,8,10,12,16,20`. | Del 2L al mayor entre 20L y lo que cabe en 12 in con el incremento: 0.33 in → 36L, 0.25 in → 48L, 0.5 in → 24L; de 0.66 in en adelante, 20L. | El 20L fijo no permitía el módulo de 36 links de la S900. El mínimo de 20L conserva la compatibilidad. |
| Configuración de empujadores | No había campos de paso ni offset. | Paso y offset por filas o por distancia, con la conversión real a la vista. | Requisito del prompt. |
| Unidad del largo | Pulgadas. | Pies o metros, a elección (por defecto pies). Internamente se sigue calculando en pulgadas. Los formularios guardados en pulgadas se pasan a pies. | Pedido de ingeniería: el largo de una banda se mide en pies o metros. |
| Colores del diagrama | Un color por tipo (orilla, interno, empujador). | Un color por módulo distinto (tipo + rol + tamaño), por familia, asignado automáticamente en cada plan. El mismo módulo siempre tiene el mismo color en el diagrama, la leyenda y la BOM. | Identificar cada pieza de un vistazo. |
| Orillas en la BOM | Siempre separadas en izquierda y derecha. | Si la banda es bidireccional, la orilla izquierda y la derecha del mismo tamaño son la misma pieza y se suman en una línea "Orilla". Con sentido de marcha o banda personalizada, siguen separadas. | Son la misma pieza de inventario. |
| Escala del diagrama | Fija en 14 px/link. | Control de escala y ajuste automático al ancho. | Requisito del prompt. |
| Filas del diagrama | Se dibujaban todas las filas. | Solo las primeras 20, en pantalla, al imprimir y en el SVG. La tabla de juntas, el CSV y el JSON siguen con todas. | Pedido de ingeniería: 20 filas bastan para ver el patrón y el dibujo queda manejable. |

Exportaciones de código reemplazadas:

- `chooseRows` → `layoutRows` (colocación en una sola pasada, con empujadores).
- `RowPattern.score` → `pieceCount` + `sizeScore`.
- `buildBom` ahora devuelve `BomLine[]`.
- `PlanResult.pusherRows` ahora es `number[]`.
- `PlanResult.warnings` → `notices` (con nivel `warning`/`info`).

Las autopruebas del botón "Ejecutar tests" de la versión validada se migraron a Vitest (`src/tests`).

## Colores y bandas bidireccionales

- **Colores:** cada módulo distinto tiene su color dentro de su familia: orillas en grises, internos en azules, orillas de empujador en cafés e internos de empujador en amarillos. Se asignan solos en cada plan; dentro de una familia, el tamaño más chico es el más claro. El número dentro del módulo siempre tiene contraste de 4.5:1 o más con su fondo (se evitan los tonos medios, donde ni el texto blanco ni el oscuro llegan a ese contraste).
- **Bidireccional:** campo de cada banda del catálogo.
  - Los 43 estilos cuya ficha del manual indica sentido de marcha ("preferred run direction") están marcados como no bidireccionales: S560, S1200, S1400 Flush Grid, S1500, S1750 y S9000, además de las bandas de radio y espirales. En ellos, la orilla izquierda y la derecha son piezas espejo distintas, con color y línea de BOM propios.
  - El resto se considera bidireccional porque el manual no les indica sentido de marcha. Se puede cambiar en la ficha de cada banda.

## Supuestos

1. Las juntas incluyen las uniones orilla/interno: se cuentan todas las posiciones entre módulos, sin el borde final.
2. Dos juntas están alineadas solo si caen exactamente en la misma posición en links. No hay tolerancia de cercanía.
3. Las orillas izquierda y derecha se cuentan por separado en la BOM porque pueden ser piezas distintas.
4. Paso y offset por distancia se redondean al número de filas más cercano. Si el valor real difiere del pedido, se avisa.
5. Si no hay patrón de empujador válido, las filas marcadas se arman con módulos normales y se avisa.
6. Sin patrón normal válido no se arma la banda: no se puede saber cómo llenar las filas normales.
7. Límites de seguridad: 2000 links de ancho y 50 000 filas. El peor caso tarda unos 2 s.
8. El diagrama muestra 200 filas a la vez (con botón para ver más). CSV y JSON siempre incluyen todas. El SVG exporta las filas visibles.
9. El *Width Increment* del catálogo Intralox es el incremento por link de esta calculadora.
10. El ancho mínimo y máximo del catálogo se comparan en links redondeados. El catálogo redondea las pulgadas: en la S800, 3 links × 0.66 in = 1.98 in aparece como "2 in" y debe aceptarse.
11. El catálogo se guarda por navegador (`localStorage`). Para compartirlo entre equipos se usa exportar/importar JSON.
12. El indent se convierte a links **hacia arriba**, porque es un mínimo, con 2 % de tolerancia para el redondeo nominal del catálogo:
    - 1.3 in → 2 links (1.32 in);
    - 2 in → 3 links (1.98 in);
    - 0.8 in con incremento de 0.33 → 3 links, porque 2 links (0.66 in) no alcanzan.
13. El indent también se aplica cuando la fila de empujador lleva orillas normales, porque el manual exige un mínimo entre la orilla de la banda y el flight. Cada tipo de orilla tiene su propio campo:
    - orillas de empujador: *Indent de referencia*; vacío = no se limitan;
    - orillas normales: *Indent deseado*; vacío = mínimo sin sideguards del empujador elegido.
    Antes, con orillas normales, el indent no era editable y siempre era el del catálogo. Un formulario guardado con esa versión carga el campo vacío, así que da el mismo resultado.
    El indent de referencia y el mínimo del catálogo son **mínimos**: el armado puede usar orillas más anchas si así reduce piezas o alineación de juntas. El indent deseado es **exacto** (`FlightConfig.edgeIndentFit = 'exact'`), porque con orillas normales el tamaño de la orilla es el indent que queda en la banda. Una primera versión lo trataba como mínimo, y el armado elegía orillas de 9L o 6L para un indent de 1 in.
14. Si el manual no indica indent para un flight (S1800 Impact Resistant, S900 Streamline Rubber, S1500 según el ancho), no se inventa un valor: se indica en las notas y el campo queda para captura manual.
15. Los catálogos guardados antes de esta versión (formato v1) recuperan automáticamente los flights de las bandas Intralox al cargarse o importarse.
16. Una banda personalizada (sin catálogo) cuenta la orilla izquierda y la derecha por separado, como en la versión validada.
17. El largo en pies se muestra con 3 decimales y en metros con 4, para que un ajuste de menos de 1 mm no se lea igual a lo pedido.
18. Los tamaños de módulo que se ofrecen dependen del incremento por link: se ofrecen módulos de hasta 12 in (`MAX_MODULE_WIDTH_INCHES`), y nunca menos de 20L. Es un supuesto, no un dato del catálogo: con la S900 (0.33 in) da justo el módulo de 36 links (11.88 in). Si un tamaño elegido queda fuera del rango (por ejemplo, un 36L que se quedó al cambiar a una banda de 0.66 in), se sigue mostrando con borde punteado y se avisa debajo, porque entra al cálculo.

19. Corte de módulos:
    - el sobrante del corte se considera desperdicio y no se reutiliza como otra pieza;
    - no se considera el ancho de la sierra ni una pérdida por corte;
    - el tamaño mínimo que se obtiene cortando es 2L, igual que el tamaño mínimo que se ofrece.

## Mejoras futuras sugeridas

- Corte de módulos: aprovechar el sobrante (un 9L cortado a 7L deja un 2L) y un resumen de "módulos a surtir" que sume, por tamaño de origen, los enteros y los que se cortan.

- En una combinación inválida, sugerir qué tamaño concreto agregar para que exista armado sin juntas alineadas (probando cada tamaño no elegido con la búsqueda exacta).
- Tolerancia configurable de alineación (p. ej. juntas a menos de 1 link).
- Inventario con existencias reales por SKU y preferencia por piezas en stock.
- Guardar el catálogo directamente en un archivo de la carpeta compartida (File System Access API de Edge/Chrome) en vez de exportar e importar a mano.
- Tamaños de módulo disponibles por serie cuando se tenga esa información de producción. Hoy el rango depende solo del incremento (módulos de hasta 12 in, mínimo 20L; `MAX_MODULE_WIDTH_INCHES` en `domain/constants.ts`); el catálogo podría guardar el ancho máximo real de módulo de cada serie.
- Sideguards: alturas, indent propio y conteo en la BOM (2 por fila).
- Indents de superficies especiales del manual (fricción, nubs, conos, rodillos, *indents* alternados de friction top) como referencia para filas especiales que no sean flights.
- Importar un plan JSON para volver a abrirlo.
- Indent de empujadores (flights que no llegan a la orilla) si producción lo requiere.
- Cálculo en un Web Worker para que bandas muy grandes no congelen la página.
