# Calculadora de Banda Modular

Aplicación web en **React + TypeScript + Vite + Tailwind** para calcular y diagramar el armado de bandas modulares.

## Qué incluye

- Conversión de ancho (in) a links con `round | floor | ceil`.
- Conversión de largo (in) a filas usando pitch.
- Generación de combinaciones internas exactas por fila.
- Soporte de patrones con módulos normales y módulos de empujador.
- Priorización de patrones por menor cantidad de piezas y piezas más grandes.
- Cálculo de juntas internas y selección de filas minimizando solape vertical.
- BOM por tipo/rol/tamaño.
- Exportación de BOM CSV, plan JSON y juntas CSV.
- Diagrama SVG técnico por filas.
- Pruebas unitarias de la lógica central.

## Estructura

```txt
src/
  components/
  features/
    belt-planner/
      domain/
      exporters/
      hooks/
      types/
  tests/
```

## Ejecución local

```bash
npm install
npm run dev
npm run test
```

## Supuestos tomados

1. El cálculo de filas usa `Math.round(largo/pitch)` con mínimo 1.
2. En modo empujador por distancia, paso y offset se convierten a filas por `round(valor/pitch)`.
3. La anti-alineación se optimiza localmente por fila adyacente, minimizando juntas coincidentes.
4. Se generan variantes tipo ladrillo rotando módulos internos del patrón base.

## Mejoras futuras sugeridas

- Mejorar heurística global de anti-alineación (optimización multi-fila).
- Permitir restricciones de inventario por SKU real.
- Agregar importación/exportación de configuración de parámetros.
- Añadir vista de comparación entre múltiples planes candidatos.
