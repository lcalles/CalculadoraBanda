# AGENTS.md

## Propósito del proyecto
Este proyecto es una aplicación web para cálculo y diagramación de armado de bandas modulares.

La aplicación debe ayudar a ingeniería o fabricación a:
- convertir dimensiones reales a una configuración de armado
- proponer patrones de filas válidos
- minimizar alineación de juntas
- manejar módulos normales y módulos con empujadores
- visualizar el armado
- exportar resultados útiles para producción

## Prioridades de este repositorio
Al trabajar en este proyecto, prioriza siempre en este orden:
1. exactitud de la lógica de armado
2. mantenibilidad del código
3. claridad de la UI
4. estética

Nunca sacrifiques reglas de negocio clave solo por simplificar la implementación.

## Reglas de negocio obligatorias
1. El ancho de la banda se ingresa en pulgadas y debe convertirse a links usando el incremento por link.
2. El largo se ingresa en pulgadas y debe convertirse a número de filas usando el pitch.
3. El redondeo a links puede ser:
   - round
   - floor
   - ceil
4. Cada fila debe quedar formada por:
   - orilla izquierda
   - módulos internos
   - orilla derecha
5. Las orillas siempre deben ir en los extremos.
6. Deben generarse combinaciones de módulos internos que sumen exactamente el ancho restante.
7. Una fila compuesta solo por dos orillas solo es válida cuando ambas orillas suman exactamente el ancho total.
8. Debe priorizarse la solución con menor cantidad de piezas.
9. En empate, deben favorecerse piezas más grandes.
10. Deben calcularse las juntas internas de cada fila.
11. Debe evitarse la alineación vertical de juntas entre filas adyacentes.
12. Si no hay solución sin coincidencias, debe elegirse la de menor solape.
13. Deben generarse variantes tipo patrón ladrillo mediante rotación de módulos internos cuando sirva para diversificar patrones.
14. Debe soportarse configuración de filas con empujadores / flights / friction top.
15. Las filas con empujador usan inventario propio de módulos de empujador, pero la geometría del armado debe mantenerse coherente.

## Alcance funcional esperado
La aplicación debe permitir:
- ingresar pitch
- ingresar incremento por link
- ingresar ancho y largo
- seleccionar redondeo
- seleccionar tamaños disponibles de módulos normales y de empujador
- configurar empujadores por filas o por distancia
- calcular el plan de armado
- mostrar resumen
- mostrar BOM
- mostrar juntas por fila
- mostrar diagrama visual
- exportar CSV y JSON

## Supuestos de dominio actuales
- Los tamaños por defecto manejados suelen estar entre 2L y 20L.
- La aplicación trabaja con módulos de orilla e internos por separado.
- El diagrama es una representación técnica del armado, no una ilustración comercial.
- La BOM debe distinguir tipos de módulo por rol y tamaño.

## Decisiones técnicas deseadas
1. Usar TypeScript.
2. Mantener separación clara entre:
   - lógica de dominio
   - componentes de UI
   - hooks
   - exportadores
   - tests
3. Evitar componentes monolíticos.
4. Evitar lógica de negocio compleja embebida directamente en JSX.
5. Escribir funciones puras y testeables para:
   - redondeo
   - generación de combinaciones
   - generación de patrones
   - cálculo de juntas
   - layout por filas
   - cálculo de BOM
   - cálculo de filas con empujadores

## Reglas de implementación
- No introducir cambios de comportamiento sin documentarlos.
- Si una mejora cambia la lógica, dejar claro qué cambió y por qué.
- Antes de refactorizar, entender la lógica existente.
- Mantener compatibilidad funcional con la versión validada del proyecto.
- Agregar tests cuando se cambie la lógica central.
- No eliminar exportaciones existentes sin reemplazo claro.
- No simplificar reglas anti-alineación sin justificación.

## Convenciones de trabajo
- Prefiere nombres explícitos.
- Prefiere funciones pequeñas.
- Documenta supuestos cuando haya ambigüedad.
- Si detectas una contradicción entre UX y lógica de negocio, prioriza la lógica y deja nota.
- Si encuentras una mejora futura interesante, documéntala en README o comentarios de arquitectura, pero no mezcles cambios grandes no solicitados en la misma tarea.

## Entregables esperados al completar tareas grandes
- código funcionando
- tests relevantes
- breve resumen técnico
- lista de supuestos tomados
- lista de mejoras futuras opcionales