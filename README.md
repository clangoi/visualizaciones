# Visualizaciones de computación

Sitio estático con visualizaciones interactivas de conceptos de computación y su teoría matemática.

## Uso

Abra `index.html` en el navegador, o sirva la carpeta:

```bash
python3 -m http.server 8000
```

Las fórmulas usan KaTeX y la tipografía IBM Plex desde CDN; sin conexión el sitio funciona, pero las fórmulas se ven como LaTeX sin renderizar.

## Guía de estilo

Las reglas de diseño, color, escritura y estructura de las páginas están en [GUIA_DE_ESTILO.md](GUIA_DE_ESTILO.md). Para crear un tema, copie [plantillas/tema.js](plantillas/tema.js). Antes de publicar:

```bash
npm install && npx playwright install chromium   # una vez
npm run verificar
```

## Estructura

- `index.html` + `js/portada.js` — portada con secciones y tarjetas.
- `tema.html` + `js/tema.js` — vista de un tema (`tema.html?id=<id>`); carga `temas/<id>.js`.
- `js/catalogo.js` — secciones y temas (título, resumen, glifo).
- `js/comun.js` — utilidades compartidas (`VIZ`): paleta, lienzos, ejes, controles, leyendas, tooltips y el reproductor paso a paso (`VIZ.reproductor`).
- `js/ordenar.js` — algoritmos de ordenamiento y sus figuras (`VIZ.orden`).
- `js/arboles.js` — dibujo de árboles y editor genérico de árboles de búsqueda (`VIZ.arbol`).
- `js/grafos.js` — generador, dibujo y utilidades de grafos (`VIZ.grafo`).
- `js/busqueda.js` — búsqueda heurística (`VIZ.busqueda`): 8-puzzle con heurísticas, A*, IDA* y distancias exactas, dibujo de árboles generales y la figura «primero el mejor» sobre un grafo.
- `temas/*.js` — un archivo por tema.

## Añadir un tema

Ver la sección 2 de [GUIA_DE_ESTILO.md](GUIA_DE_ESTILO.md).
