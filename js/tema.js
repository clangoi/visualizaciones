/* Vista de tema: lee ?id=, arma la navegación y carga temas/<id>.js,
   que se registra con VIZ.registrarTema(id, definicion).

   definicion = {
     intro: html,                       // explicación intuitiva inicial
     visualizaciones: [{ titulo, descripcion, montar(cuerpo) }],
     teoria: html                       // fundamento matemático (usa \( \) y \[ \] para LaTeX)
   } */
(function () {
  'use strict';
  const { el } = VIZ;
  const raiz = document.getElementById('tema');
  const lateral = document.getElementById('lateral');
  const id = new URLSearchParams(location.search).get('id');
  const tema = CATALOGO.buscar(id);

  // Navegación lateral por secciones.
  for (const s of CATALOGO.secciones) {
    lateral.appendChild(el('h4', null, s.nombre));
    lateral.appendChild(el('ul', null, s.temas.map((t) =>
      el('li', null, el('a', { href: `tema.html?id=${t.id}`, 'aria-current': t === tema ? 'page' : null }, t.titulo)))));
  }

  if (!tema) {
    raiz.append(
      el('p', { class: 'migas' }, el('a', { href: 'index.html' }, 'Inicio')),
      el('div', { class: 'tema-cabecera' }, el('h1', null, 'Tema no encontrado'),
        el('p', null, 'El enlace no corresponde a ningún tema. Vuelva a la portada para elegir uno.')));
    return;
  }

  document.title = `${tema.titulo} — Visualizaciones de computación`;

  const renderizarMatematica = (nodo) => {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(nodo, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  };

  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function montar(def) {
    const s = tema.seccion;
    const indiceTema = el('nav', { class: 'indice-tema', 'aria-label': 'En esta página' });

    raiz.append(
      el('p', { class: 'migas' },
        el('a', { href: 'index.html' }, 'Inicio'), ' / ',
        el('a', { href: `index.html#${s.id}` }, s.nombre), ' / ', tema.titulo),
      el('header', { class: 'tema-cabecera' },
        el('h1', null, tema.titulo),
        el('p', null, tema.resumen),
        indiceTema));

    if (def.intro) raiz.appendChild(el('section', { class: 'prosa', html: def.intro }));

    (def.visualizaciones || []).forEach((v, i) => {
      const cuerpo = el('div', { class: 'viz-cuerpo' });
      const figura = el('figure', { class: 'viz', id: `viz-${i + 1}` },
        el('figcaption', { class: 'viz-cabecera' },
          el('h3', null, el('span', null, `Fig. ${i + 1}`), v.titulo),
          v.descripcion ? el('p', { html: v.descripcion }) : null),
        cuerpo);
      raiz.appendChild(figura);
      indiceTema.appendChild(el('a', { href: `#viz-${i + 1}` }, `Fig. ${i + 1} · ${v.titulo}`));
      try {
        v.montar(cuerpo);
      } catch (err) {
        console.error(err);
        cuerpo.appendChild(el('p', { class: 'nota-viz' }, 'No se pudo cargar esta visualización.'));
      }
    });

    if (def.teoria) {
      const teoria = el('section', { class: 'prosa', html: def.teoria });
      teoria.querySelectorAll('h2').forEach((h) => {
        h.id = h.id || slug(h.textContent);
        indiceTema.appendChild(el('a', { href: '#' + h.id }, h.textContent));
      });
      raiz.appendChild(teoria);
    }

    // Anterior / siguiente en el orden global del catálogo.
    const lista = CATALOGO.temas;
    const k = lista.indexOf(tema);
    const nav = el('nav', { class: 'navegacion-temas', 'aria-label': 'Temas contiguos' });
    if (k > 0) {
      const p = lista[k - 1];
      nav.appendChild(el('a', { href: `tema.html?id=${p.id}` }, el('small', null, '← Anterior'), p.titulo));
    }
    if (k < lista.length - 1) {
      const n = lista[k + 1];
      nav.appendChild(el('a', { class: 'siguiente', href: `tema.html?id=${n.id}` }, el('small', null, 'Siguiente →'), n.titulo));
    }
    raiz.appendChild(nav);

    renderizarMatematica(raiz);
    if (location.hash) {
      const destino = document.getElementById(location.hash.slice(1));
      if (destino) destino.scrollIntoView();
    }
  }

  VIZ.registrarTema = function (idTema, def) {
    if (idTema === id) montar(def);
  };
  VIZ.renderizarMatematica = renderizarMatematica;

  const script = document.createElement('script');
  script.src = `temas/${id}.js`;
  script.onerror = () => raiz.appendChild(el('p', { class: 'nota-viz' }, 'No se pudo cargar el contenido de este tema.'));
  document.body.appendChild(script);
})();
