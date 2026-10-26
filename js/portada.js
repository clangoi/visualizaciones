/* Portada: genera el índice de secciones y las tarjetas de cada tema. */
(function () {
  'use strict';
  const { el } = VIZ;
  const { secciones, temas } = CATALOGO;

  const indice = document.getElementById('indice-secciones');
  const lista = document.getElementById('lista-secciones');

  for (const s of secciones) {
    indice.appendChild(el('li', null, el('a', { href: '#' + s.id }, s.nombre)));

    const rejilla = el('div', { class: 'rejilla-tarjetas' });
    for (const t of s.temas) {
      const a = el('a', { class: 'tarjeta', href: `tema.html?id=${t.id}`, 'data-busqueda': `${t.titulo} ${t.resumen} ${s.nombre}`.toLowerCase() },
        el('div', { class: 'tarjeta-cabeza' }, el('span', { class: 'tarjeta-codigo' }, t.codigo), el('span', { html: t.glifo })),
        el('h3', null, t.titulo),
        el('p', { class: 'tarjeta-resumen' }, t.resumen),
        el('div', { class: 'tarjeta-pie' },
          el('span', null, `${t.visualizaciones} ${t.visualizaciones === 1 ? 'visualización' : 'visualizaciones'}`),
          el('span', { 'aria-hidden': 'true' }, '→')));
      rejilla.appendChild(a);
    }

    lista.appendChild(el('section', { class: 'seccion', id: s.id },
      el('div', { class: 'seccion-cabecera' },
        el('span', { class: 'seccion-numero' }, s.numero),
        el('h2', null, s.nombre),
        el('p', null, s.descripcion)),
      rejilla));
  }

  document.getElementById('pie').textContent =
    `${secciones.length} secciones · ${temas.length} temas · ${temas.reduce((n, t) => n + t.visualizaciones, 0)} visualizaciones`;

  // Filtro por texto: oculta tarjetas y secciones vacías.
  const buscador = document.getElementById('buscador');
  const sinResultados = document.getElementById('sin-resultados');
  const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  buscador.addEventListener('input', () => {
    const q = normalizar(buscador.value.trim());
    let visibles = 0;
    for (const sec of lista.children) {
      let n = 0;
      for (const tarjeta of sec.querySelectorAll('.tarjeta')) {
        const ok = !q || normalizar(tarjeta.dataset.busqueda).includes(q);
        tarjeta.hidden = !ok;
        if (ok) n++;
      }
      sec.hidden = n === 0;
      visibles += n;
    }
    sinResultados.hidden = visibles > 0;
  });

  // Resalta la sección visible en el índice.
  const enlaces = [...indice.querySelectorAll('a')];
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        enlaces.forEach((a) => a.classList.toggle('activa', a.getAttribute('href') === '#' + e.target.id));
      }
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  lista.querySelectorAll('.seccion').forEach((s) => obs.observe(s));
})();
