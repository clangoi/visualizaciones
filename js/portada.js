/* Portada: áreas como etiquetas (#), índice de secciones y tarjetas de cada tema. */
(function () {
  'use strict';
  const { el } = VIZ;
  const { materias, secciones, temas } = CATALOGO;
  const porId = new Map(materias.map((m) => [m.id, m]));

  const chips = document.getElementById('materias');
  const indice = document.getElementById('indice-secciones');
  const lista = document.getElementById('lista-secciones');
  const aviso = document.getElementById('materia-activa');
  const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let activa = null;

  for (const s of secciones) {
    indice.appendChild(el('li', null, el('a', { href: '#' + s.id }, s.nombre)));

    const rejilla = el('div', { class: 'rejilla-tarjetas' });
    for (const t of s.temas) {
      const nombres = t.etiquetas.map((id) => porId.get(id).nombre).join(' ');
      const a = el('a', {
        class: 'tarjeta',
        href: `tema.html?id=${t.id}`,
        'data-materias': t.etiquetas.join(' '),
        'data-busqueda': `${t.titulo} ${t.resumen} ${s.nombre} ${nombres}`.toLowerCase(),
      },
        el('div', { class: 'tarjeta-cabeza' }, el('span', { class: 'tarjeta-codigo' }, t.codigo), el('span', { html: t.glifo })),
        el('h3', null, t.titulo),
        el('p', { class: 'tarjeta-resumen' }, t.resumen),
        el('ul', { class: 'etiquetas', 'aria-label': 'Áreas' },
          ...t.etiquetas.map((id) => el('li', null, el('span', { class: 'etiqueta', 'data-materia': id }, '#' + porId.get(id).corto)))),
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

  // Áreas: botones que filtran la lista; un segundo clic sobre la activa la quita.
  const botones = new Map();
  for (const m of materias) {
    const n = temas.filter((t) => t.etiquetas.includes(m.id)).length;
    const b = el('button', { class: 'materia', type: 'button', title: m.nombre, 'aria-pressed': 'false' },
      '#' + m.corto, el('small', null, String(n)));
    b.disabled = n === 0;
    b.addEventListener('click', () => elegir(activa === m.id ? null : m.id));
    botones.set(m.id, b);
    chips.appendChild(el('li', null, b));
  }

  // Un clic sobre la etiqueta de una tarjeta filtra por esa área en vez de abrir el tema.
  lista.addEventListener('click', (e) => {
    const et = e.target.closest('.etiqueta');
    if (!et) return;
    e.preventDefault();
    elegir(et.dataset.materia);
    document.getElementById('secciones').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('pie').textContent =
    `${secciones.length} secciones · ${temas.length} temas · ${temas.reduce((n, t) => n + t.visualizaciones, 0)} visualizaciones`;

  const buscador = document.getElementById('buscador');
  const sinResultados = document.getElementById('sin-resultados');

  // Aplica el área elegida y el texto del buscador; oculta tarjetas y secciones vacías.
  function filtrar() {
    const q = normalizar(buscador.value.trim());
    let visibles = 0;
    for (const sec of lista.children) {
      let n = 0;
      for (const tarjeta of sec.querySelectorAll('.tarjeta')) {
        const ok = (!activa || tarjeta.dataset.materias.split(' ').includes(activa))
          && (!q || normalizar(tarjeta.dataset.busqueda).includes(q));
        tarjeta.hidden = !ok;
        if (ok) n++;
      }
      sec.hidden = n === 0;
      visibles += n;
    }
    sinResultados.hidden = visibles > 0;
    return visibles;
  }

  function elegir(id, { url = true } = {}) {
    activa = id;
    botones.forEach((b, mid) => b.setAttribute('aria-pressed', String(mid === id)));
    const visibles = filtrar();
    aviso.hidden = !id;
    if (id) {
      const volver = el('button', { type: 'button' }, 'Ver todos los temas');
      volver.addEventListener('click', () => elegir(null));
      aviso.replaceChildren(el('strong', null, '#' + porId.get(id).nombre),
        ` · ${temas.filter((t) => t.etiquetas.includes(id)).length} temas`, volver);
    }
    if (url) {
      const u = new URL(location.href);
      if (id) u.searchParams.set('materia', id); else u.searchParams.delete('materia');
      history.replaceState(null, '', u);
    }
    return visibles;
  }

  buscador.addEventListener('input', filtrar);

  const inicial = new URLSearchParams(location.search).get('materia');
  if (inicial && porId.has(inicial)) elegir(inicial, { url: false });

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
