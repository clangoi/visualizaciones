/* Panel lateral izquierdo: secciones con sus temas anidados.
   Se despliega y retrae con el botón de la barra superior; en pantallas
   pequeñas se superpone al contenido. Recuerda su estado en el navegador. */
(function () {
  'use strict';
  const { el } = VIZ;

  const CLAVE_ABIERTO = 'panel-abierto';
  const CLAVE_SECCIONES = 'panel-secciones-plegadas';
  const leer = (k, def) => {
    try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; }
  };
  const guardar = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
  };

  const movil = window.matchMedia('(max-width: 920px)');
  const enTema = /tema\.html$/.test(location.pathname);
  const temaActual = enTema ? CATALOGO.buscar(new URLSearchParams(location.search).get('id')) : null;
  const plegadas = new Set(leer(CLAVE_SECCIONES, []));
  if (temaActual) plegadas.delete(temaActual.seccion.id);

  const chevron = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const iconoPanel = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3.5" width="15" height="13"/><path d="M7.5 3.5v13"/></svg>';

  /* --- Contenido del panel --- */

  const panel = el('nav', { class: 'panel', id: 'panel', 'aria-label': 'Secciones y temas' });
  const lista = el('ul', { class: 'panel-lista' });
  panel.append(
    el('div', { class: 'panel-cabeza' },
      el('a', { href: 'index.html', class: 'panel-inicio' }, 'Todas las secciones'),
      el('button', { type: 'button', class: 'panel-cerrar', 'aria-label': 'Cerrar panel', html: '×' })),
    lista);

  for (const s of CATALOGO.secciones) {
    const idTemas = `panel-temas-${s.id}`;
    const abierta = !plegadas.has(s.id);
    const plegar = el('button', {
      type: 'button', class: 'panel-plegar', 'aria-expanded': String(abierta), 'aria-controls': idTemas,
      'aria-label': `Mostrar u ocultar los temas de ${s.nombre}`, html: chevron,
    });
    const temas = el('ul', { class: 'panel-temas', id: idTemas, hidden: !abierta },
      s.temas.map((t) => el('li', null,
        el('a', { href: `tema.html?id=${t.id}`, 'aria-current': t === temaActual ? 'page' : null },
          el('span', { class: 'panel-codigo' }, t.codigo), t.titulo))));
    plegar.addEventListener('click', () => {
      const ahora = plegar.getAttribute('aria-expanded') !== 'true';
      plegar.setAttribute('aria-expanded', String(ahora));
      temas.hidden = !ahora;
      ahora ? plegadas.delete(s.id) : plegadas.add(s.id);
      guardar(CLAVE_SECCIONES, [...plegadas]);
    });
    lista.appendChild(el('li', { class: 'panel-seccion' + (temaActual && temaActual.seccion === s ? ' actual' : '') },
      el('div', { class: 'panel-fila' },
        plegar,
        el('a', { class: 'panel-seccion-enlace', href: `index.html#${s.id}` },
          el('span', { class: 'panel-codigo' }, s.numero), s.nombre)),
      temas));
  }

  const fondo = el('div', { class: 'panel-fondo', hidden: true });
  document.body.append(panel, fondo);

  /* --- Botón en la barra superior --- */

  const barra = document.querySelector('.barra');
  const boton = el('button', {
    type: 'button', class: 'boton-panel', 'aria-controls': 'panel', html: iconoPanel,
  });
  barra.querySelector('.barra-interior').prepend(boton);

  // La altura de la barra define dónde empieza el panel.
  const fijarAltura = () => document.documentElement.style.setProperty('--alto-barra', barra.offsetHeight + 'px');
  new ResizeObserver(fijarAltura).observe(barra);
  fijarAltura();

  /* --- Abrir y cerrar --- */

  function aplicar(abierto) {
    document.body.classList.toggle('panel-abierto', abierto);
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Retraer panel de secciones' : 'Desplegar panel de secciones');
    boton.title = boton.getAttribute('aria-label');
    fondo.hidden = !(abierto && movil.matches);
    panel.inert = !abierto;
  }
  const abiertoInicial = () => (movil.matches ? false : leer(CLAVE_ABIERTO, true));
  function alternar(abierto) {
    aplicar(abierto);
    if (!movil.matches) guardar(CLAVE_ABIERTO, abierto);
  }

  boton.addEventListener('click', () => alternar(!document.body.classList.contains('panel-abierto')));
  panel.querySelector('.panel-cerrar').addEventListener('click', () => { alternar(false); boton.focus(); });
  fondo.addEventListener('click', () => alternar(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && movil.matches && document.body.classList.contains('panel-abierto')) { alternar(false); boton.focus(); }
  });
  // En móvil, el panel se cierra al elegir un destino.
  panel.addEventListener('click', (e) => { if (e.target.closest('a') && movil.matches) alternar(false); });
  movil.addEventListener('change', () => aplicar(abiertoInicial()));

  aplicar(abiertoInicial());
  // Activa las transiciones solo después del primer pintado, para no animar al cargar.
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('panel-listo')));

  // Mantiene visible el tema actual dentro del panel.
  const actual = panel.querySelector('[aria-current="page"]');
  if (actual) panel.scrollTop = Math.max(0, actual.offsetTop - panel.clientHeight / 2);
})();
