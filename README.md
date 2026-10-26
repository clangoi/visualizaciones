# Visualizaciones de computación

Sitio estático con visualizaciones interactivas de conceptos de computación y su teoría matemática.

## Uso

Abra `index.html` en el navegador, o sirva la carpeta:

```bash
python3 -m http.server 8000
```

Las fórmulas usan KaTeX y la tipografía IBM Plex desde CDN; sin conexión el sitio funciona, pero las fórmulas se ven como LaTeX sin renderizar.

## Estructura

- `index.html` + `js/portada.js` — portada con secciones y tarjetas.
- `tema.html` + `js/tema.js` — vista de un tema (`tema.html?id=<id>`); carga `temas/<id>.js`.
- `js/catalogo.js` — secciones y temas (título, resumen, glifo).
- `js/comun.js` — utilidades compartidas (`VIZ`): paleta, lienzos, ejes, controles, leyendas, tooltips.
- `temas/*.js` — un archivo por tema.

## Añadir un tema

1. Agréguelo a una sección en `js/catalogo.js`.
2. Cree `temas/<id>.js`:

```js
VIZ.registrarTema('<id>', {
  intro: String.raw`<p>…</p>`,
  visualizaciones: [{ titulo: '…', descripcion: '…', montar(cuerpo) { /* controles + lienzo */ } }],
  teoria: String.raw`<h2>…</h2><p>\( … \)</p>`,
});
```

Use `\( … \)` y `\[ … \]` para las fórmulas.
