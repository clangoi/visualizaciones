# Guía de estilo

Reglas para que todas las páginas se vean y se comporten igual. Muchas se comprueban automáticamente con `npm run verificar` (ver [Verificación](#verificación)); las marcadas con ✓ fallan la verificación si no se cumplen.

## 1. Principios

1. **Página sobria en blanco y negro.** El color existe solo dentro de los gráficos, y siempre significa algo.
2. **Interactivo antes que decorativo.** Cada figura permite cambiar parámetros y ver qué pasa; si un algoritmo tiene pasos, se puede ejecutar paso a paso.
3. **Intuición, figura, teoría.** Cada tema explica la idea en palabras, la muestra en movimiento y luego la fundamenta con matemática.
4. **Nada fijo en píxeles de ancho.** Todo funciona desde 390 px (teléfono) hasta pantallas anchas.

## 2. Agregar un tema

1. Elija un `id`: minúsculas con guiones (`red-black`, `linear-sorting`). ✓ Es parte de la URL (`tema.html?id=…`): **no lo cambie después**.
2. Copie [plantillas/tema.js](plantillas/tema.js) a `temas/<id>.js` y cambie el id en `VIZ.registrarTema('<id>', …)`. ✓
3. Agréguelo a una sección en [js/catalogo.js](js/catalogo.js) (ver §3). ✓
4. Si necesita un módulo compartido (`ordenar.js`, `arboles.js`, `grafos.js`, `busqueda.js`, `ml.js`, `imagen.js`, `patrones.js`) ya está cargado en `tema.html`. Si crea uno nuevo, agréguelo a `tema.html` antes de `catalogo.js`.
5. Ejecute `npm run verificar -- <id>` y revise la página a 1300 px y a 390 px de ancho.

## 3. Catálogo

| Campo | Regla |
|---|---|
| `id` | minúsculas con guiones, igual al nombre del archivo ✓ |
| `titulo` | Nombre del concepto **en inglés**, con mayúscula en cada palabra principal (*Merge Sort*, *AVL Trees*, *Gradient Descent*). El resto de la página (resumen, textos, secciones) va en español. Use `’` (no `'`) en posesivos: *Kruskal’s Algorithm*. |
| `resumen` | Una frase de hasta 140 caracteres que diga qué se puede **hacer o ver** en la página. ✓ |
| `visualizaciones` | Número exacto de figuras del tema. ✓ |
| `glifo` | `g('…')` con trazos SVG en un cuadro de 44 × 44: grosor 1.5, `currentColor`, sin colores ✓, formas simples y reconocibles. |

**Secciones:** nombre en español, descripción de una frase. Una sección agrupa temas que se estudian juntos; cree una nueva solo si ninguna existente encaja.

## 4. Estructura de una página de tema

`tema.js` arma la página a partir de la definición; el tema solo aporta:

```js
VIZ.registrarTema('<id>', {
  intro: String.raw`<p>…</p>`,          // 1 o 2 párrafos: la idea, el problema que resuelve
  visualizaciones: [{ titulo, descripcion, montar(cuerpo) }],
  teoria: String.raw`<h2>…</h2> …`,     // fundamento matemático
});
```

- **Intro**: en palabras, sin fórmulas pesadas. Qué es, para qué sirve, cuál es la idea clave.
- **Título de figura**: corto, sin punto final (*Kruskal paso a paso*).
- **Descripción de figura**: una o dos frases que digan **qué mirar y qué probar** («Pruebe datos ya ordenados…»).
- **Teoría**: secciones `<h2>` (aparecen en el índice de la página) y `<h3>` si hace falta. Orden habitual: definición → algoritmo en pseudocódigo → corrección (invariante o demostración) → análisis de costo → variantes y conexiones con otros temas (enlaces `tema.html?id=…`).
- Use `<table>` para comparar costos, `<div class="recuadro">` para un teorema o advertencia, `<pre><code>` para pseudocódigo.

## 5. Escritura

- Español neutro y trato de **usted** en instrucciones: «Haga clic», «Pruebe», «Observe».
- Pseudocódigo en español con flechas de asignación: `x ← 0`, `para i ← 1 hasta n`, `mientras`, `si … :`, `devolver`.
- El signo menos de los valores mostrados es `−` (U+2212): `VIZ.fmt` y `VIZ.grafo.dist` ya lo hacen.
- Números: `VIZ.fmt(v)` para reales, `VIZ.entero(v)` para enteros grandes (separador de miles).
- Términos técnicos en cursiva la primera vez si están en inglés (*pivote*, *heapify*).

## 6. Matemática

- Fórmulas en línea con `\( … \)`, en bloque con `\[ … \]` ✓ (no `$…$`).
- `intro` y `teoria` siempre con `String.raw\`…\`` ✓, para que las barras invertidas lleguen intactas a KaTeX. Dentro, no escriba `${` salvo para interpolar a propósito.
- En la `descripcion` (cadena normal) las barras se duplican: `'\\(O(n \\log n)\\)'`.
- Escriba `<`, `>` y `&` como `&lt;`, `&gt;` y `&amp;` (también dentro de fórmulas y de `<pre>`), porque el texto pasa por `innerHTML`.
- Notación: `\Theta`, `O`, `\Omega`; `\log_2`; `\lfloor \rfloor`, `\lceil \rceil`; `\mathbb{E}`; palabras dentro de fórmulas con `\text{…}`.

## 7. Color

Todo color en el código de un tema sale de `VIZ.color` (`const { color: C } = VIZ;`). ✓ No escriba hexadecimales ni `rgba()`; para transparencia use `VIZ.alfa(C.s1, 0.2)`. Única excepción: un color propio del dominio, declarado como constante en MAYÚSCULAS con nombre y comentario (`const BARRO = '#d8cfbd'; // terreno costoso`).

La paleta está definida dos veces y debe coincidir ✓: `VIZ.color` en [js/comun.js](js/comun.js) (para canvas) y las variables de `:root` en [css/estilos.css](css/estilos.css) (para HTML).

### Neutros

| Token | Uso |
|---|---|
| `C.tinta` | texto principal; estado **terminado / definitivo / ordenado**; muros |
| `C.tinta2` | texto secundario |
| `C.apagado` | etiquetas de ejes, texto terciario, referencias punteadas |
| `C.inactivo` | marcas **pendientes o sin procesar** |
| `C.eje` | líneas base, ejes, aristas sin estado |
| `C.tenue` | aristas o marcas fuera de foco |
| `C.rejilla` | líneas de rejilla, bordes de celdas |
| `C.neutro` | fondo de la zona activa, celdas alternas |
| `C.fondo2` | paneles y registros |
| `C.superficie` | fondo del gráfico; relleno de nodos sin estado |
| `C.sobre` | texto sobre un relleno de color |

### Series y estados

Las series `C.s1` … `C.s8` se asignan **en este orden fijo** cuando representan categorías (algoritmos, distribuciones, grupos), sin repetir colores. Si son más de 3 categorías en un gráfico de dispersión, agregue una segunda codificación (forma, con `VIZ.forma`).

Cuando representan **estados de un algoritmo**, el significado es siempre el mismo:

| Token | Color | Significado de estado |
|---|---|---|
| `C.s1` | azul | elemento consultado o comparado; estructura que se va construyendo (árbol BFS, MST, camino recorrido) |
| `C.s2` | naranjo | acción del paso actual (escritura, arista que se examina); resultado destacado (camino final) |
| `C.s3` | aguamarina | relación secundaria (celdas de las que se depende, aristas de cruce) |
| `C.s4` | amarillo | frontera, en cola, en la pila |
| `C.s6` | verde | encontrado, solución, inicio |
| `C.s7` | violeta | pivote, nodos reestructurados |
| `C.s8` | rojo | conflicto, rechazo, peso o ciclo negativo |

Magnitudes continuas: rampa azul `VIZ.rampa` con `VIZ.enRampa(t)`. Bajo series de color (mapas de calor de fondo): `VIZ.rampaGris`. Nunca un arcoíris.

## 8. Tipografía

- Texto: IBM Plex Sans. Números, etiquetas, controles, código y todo texto dentro de canvas: IBM Plex Mono, con `VIZ.fuente(px, peso)`.
- Tamaños en canvas: 10–11 px etiquetas de ejes y anotaciones; 12 px nodos y celdas; 13–14 px valores destacados.
- El texto nunca va en un color de serie salvo para marcar un estado (por ejemplo, una distancia recién mejorada en `C.s2`).

## 9. Anatomía de una figura

Dentro de `montar(cuerpo)`, en este orden:

1. **Controles** — `VIZ.controles(cuerpo)`: primero `rango`, `selector`, `numero`, `texto`, `casilla(s)`; después el reproductor y los botones. El botón principal (la acción más frecuente) lleva `{ primario: true }`.
2. **Lienzo** — `VIZ.lienzo(cuerpo, { proporcion | altoFn | alto })`. Si la altura depende del contenido, use `altoFn` y llame a `lienzo.ajustar(true)` cuando cambie.
3. **Leyenda** — `VIZ.leyenda(cuerpo, items)`: obligatoria si hay color con significado. Si no hace falta (serie única nombrada en el eje, o todas las marcas con etiqueta directa), declárelo con `cuerpo.dataset.sinLeyenda = 'motivo'`. ✓ (aviso)
4. **Estructura auxiliar** (opcional) — `VIZ.grafo.estructura(cuerpo, 'Cola:')` para colas, pilas o listas; `VIZ.subtitulo` si hay un segundo lienzo.
5. **Registro** — `VIZ.registro(cuerpo)`: narra en una frase qué hizo el último paso y por qué.
6. **Lectura** — `VIZ.lectura(cuerpo).set([[etiqueta, valor], …])`: 3 a 6 números clave, idealmente comparando con la teoría (medido frente a \(n \log_2 n\)).
7. **Nota** — `VIZ.nota(cuerpo, '…')`: cómo interactuar («Haga clic en un vértice para…»).

## 10. Marcas en el canvas

- Gráficos con ejes: `VIZ.plano(lienzo, dominio, opciones)` y `plano.ejes()`; las líneas con `VIZ.trazar` (2 px); los puntos con `VIZ.marcador` (anillo blanco de 2 px).
- Barras: 2 px de separación, extremo superior redondeado de 4 px (`roundRect(..., [4, 4, 0, 0])`), línea base en `C.eje`.
- Grafos: `VIZ.grafo.dibujar`. Aristas de 1.5 px sin estado; 3–4 px resaltadas; discontinuas para rechazadas o candidatas.
- Árboles: `VIZ.arbol.dibujarBinario` o `dibujarMultiple`. Anillo de 3 px para resaltar un nodo: `C.s1` camino recorrido, `C.s7` reestructurado, `C.s6` resultado.
- Referencias teóricas (n log n, cotas): línea punteada `[3, 4]` en `C.apagado`, con etiqueta directa a la derecha.

## 11. Interacción

- **Tooltip** (`VIZ.tooltip`) al pasar el cursor por todo gráfico de datos: valores exactos de lo que hay bajo el cursor. En líneas, una guía vertical y un marcador por serie.
- **Algoritmos con pasos**: `VIZ.reproductor(ctl, { iniciar, dibujar, velocidad })`, que agrega Velocidad, Reproducir/Pausar, Un paso, Hasta el final y Reiniciar. `iniciar()` reinicia el estado y devuelve un **generador**: cada `yield` es un paso que se dibuja.
- **Datos aleatorios** reproducibles con `VIZ.semilla(n)`, y un botón «Nuevos datos» que cambia la semilla.
- El clic sobre el gráfico debe tener un efecto anunciado en la nota (elegir origen, agregar punto, alternar celda). Cursor `pointer` o `crosshair` donde se puede hacer clic.
- Las animaciones continuas (que no terminan solas) se detienen cuando la figura sale de la pantalla (`IntersectionObserver`).

## 12. CSS

- Los estilos viven en [css/estilos.css](css/estilos.css). Clases disponibles para figuras: `.registro`, `.subtitulo-viz`, `.fichas` / `.ficha`, `.tabla-datos`, `.caja-desplazable`, `.lista-mono`, `.dos-columnas`, `.nota-viz`.
- **Estilos en línea solo para valores que dependen de los datos**: colores de estado, tamaños calculados. Todo lo demás, una clase. (aviso)
- No hay modo oscuro: la paleta está validada sobre fondo blanco.

## Verificación

```bash
npm install                      # una vez: instala playwright-core
npx playwright install chromium  # una vez: descarga el navegador
npm run verificar                # todo el sitio
npm run verificar -- bst avl     # solo algunos temas
```

Revisa: catálogo ↔ archivos, ids, glifos, colores fuera de la paleta, `String.raw`, delimitadores de fórmulas, sincronía entre CSS y `VIZ.color`; y en el navegador, que cada tema cargue sin errores, tenga el número de figuras del catálogo, que sus fórmulas rendericen, que todos sus botones funcionen, que tenga leyendas y que no desborde a 390 px.

Lo que no se puede automatizar: **mire la página**. A 1300 px y a 390 px, sin etiquetas que choquen, con los textos legibles, y que lo que dice la descripción realmente se vea al probarlo.

## Publicar

El sitio se publica en GitHub Pages desde la rama `main` (raíz del repositorio). Tras `git push`, la nueva versión aparece en https://clangoi.github.io/visualizaciones/ en uno o dos minutos.
