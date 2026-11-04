(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const { arbol, aplanar } = VIZ.web;

  const HTML = `<body>
  <header><h1>Tienda</h1>
    <nav id="menu"><a href="/">Inicio</a><a class="activo">Ofertas</a></nav>
  </header>
  <main><article><h2>Zapatos</h2><p class="precio">$29</p></article>
    <aside><p>Envío gratis</p></aside></main>
  <footer><p>© 2026</p></footer>
</body>`;

  // Convierte el DOM real (creado con DOMParser) en un árbol simple de elementos para dibujarlo.
  function construir() {
    const doc = new DOMParser().parseFromString(`<!doctype html><html><head></head>${HTML}</html>`, 'text/html');
    const mapa = new Map();
    function conv(e) {
      const clases = [...e.classList].map((c) => '.' + c).join('');
      const n = { dom: e, texto: e.localName + (e.id ? '#' + e.id : '') + clases, hijos: [...e.children].map(conv) };
      mapa.set(e, n);
      return n;
    }
    return { doc, raiz: conv(doc.body), mapa };
  }

  /* ---------- Fig. 1: el árbol y los selectores ---------- */

  const PRESETS = ['p', '#menu a', 'main > *', '.activo', 'article p', 'nav, footer', 'h1 + nav', 'a:first-child', '*'];

  function montarArbol(cuerpo) {
    let selector = '.activo', fijado = null, nodos = [];
    const { doc, raiz } = construir();
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Selector CSS', valor: selector, alCambiar: (v) => { selector = v; dibujar(); }, alEnter: (v) => { selector = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', valor: '', opciones: [['', '— elegir —'], ...PRESETS.map((p) => [p, p])], alCambiar: (v) => { if (!v) return; selector = v; campo.valor = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 260 : 230) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'elemento que coincide con el selector' }, { color: C.s2, texto: 'elemento elegido con clic' }, { color: C.eje, texto: 'sin coincidencia' }]);
    cuerpo.appendChild(el('pre', { class: 'codigo-bdd' }, HTML));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El navegador convierte el HTML en este árbol y ejecuta su selector sobre él con <code>querySelectorAll</code>. Haga clic en un nodo para ver su camino desde la raíz.');

    const camino = (e) => { const r = []; for (let x = e; x && x !== doc.documentElement; x = x.parentElement) r.unshift(x.localName + (x.id ? '#' + x.id : '')); return r.join(' > '); };
    function dibujar() {
      let coinciden = new Set(), error = false;
      try { coinciden = new Set(doc.body.querySelectorAll(selector)); } catch (e) { error = true; }
      lienzo.limpiar();
      nodos = arbol(lienzo.ctx, raiz, lienzo.ancho, lienzo.alto, (n) => (n === fijado ? { relleno: VIZ.alfa(C.s2, 0.25), borde: C.s2 } : coinciden.has(n.dom) ? { relleno: VIZ.alfa(C.s1, 0.25), borde: C.s1 } : {}), { alturaNodo: 24, tam: lienzo.ancho < 600 ? 10 : 11 });
      registro.textContent = error ? `«${selector}» no es un selector válido.` : fijado ? `Camino hasta ${fijado.texto}: body > ${camino(fijado.dom).replace(/^body > ?/, '')}` : `${coinciden.size} elemento(s) coinciden con «${selector}».`;
      lectura.set([['elementos en el árbol', String(aplanar(raiz).length)], ['coincidencias', error ? '—' : String(coinciden.size)], ['profundidad máxima', String(Math.max(...nodos.map((n) => n.d)) + 1)]]);
    }
    lienzo.alDibujar = dibujar;
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return nodos.find((n) => x >= n.x - n.w / 2 && x <= n.x + n.w / 2 && y >= n.y && y <= n.y + n.h); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const n = bajo(ev); fijado = n === fijado ? null : n || null; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const n = bajo(ev); if (!n) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      tip.mostrar(x, y, `<b>${n.dom.localName}</b><br>${n.dom.children.length} hijo(s)<br>${n.dom.textContent.trim().replace(/\s+/g, ' ').slice(0, 24)}…`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: HTML semántico y accesibilidad ---------- */

  const BLOQUES = [
    { sem: 'header', rol: 'banner', x: 0, y: 0, w: 1, h: 0.16, texto: 'cabecera' },
    { sem: 'nav', rol: 'navegación', x: 0, y: 0.18, w: 0.24, h: 0.62, texto: 'menú' },
    { sem: 'main', rol: 'contenido principal', x: 0.26, y: 0.18, w: 0.5, h: 0.62, texto: 'contenido' },
    { sem: 'aside', rol: 'complementario', x: 0.78, y: 0.18, w: 0.22, h: 0.62, texto: 'aparte' },
    { sem: 'footer', rol: 'pie de página', x: 0, y: 0.82, w: 1, h: 0.18, texto: 'pie' },
  ];

  function montarSemantica(cuerpo) {
    let semantico = true, sel = 2, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Marcado', valor: 'sem', opciones: [['sem', 'elementos semánticos'], ['div', 'solo <div>']], alCambiar: (v) => { semantico = v === 'sem'; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(260, w * 0.5)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'regiones con significado (landmarks)' }, { color: C.inactivo, texto: 'bloques anónimos' }]);
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un bloque. Un lector de pantalla puede saltar entre regiones solo si el HTML las declara; con puros <code>&lt;div&gt;</code> debe recorrer todo en orden.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      geo = BLOQUES.map((b, i) => {
        const g = { x: b.x * W + 2, y: b.y * H + 2, w: b.w * W - 4, h: b.h * H - 4, b, i };
        const act = i === sel;
        ctx.fillStyle = semantico ? VIZ.alfa(C.s1, act ? 0.35 : 0.14) : VIZ.alfa(C.inactivo, act ? 0.5 : 0.25);
        ctx.strokeStyle = semantico ? C.s1 : C.inactivo; ctx.lineWidth = act ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 4); ctx.fill(); ctx.stroke();
        VIZ.web.texto(ctx, semantico ? `<${b.sem}>` : '<div>', g.x + g.w / 2, g.y + g.h / 2 - 8, { tam: 12, peso: 600 });
        VIZ.web.texto(ctx, b.texto, g.x + g.w / 2, g.y + g.h / 2 + 8, { tam: 10, color: C.tinta2 });
        return g;
      });
      lista.replaceChildren(...BLOQUES.map((b, i) => el('div', { class: i === sel ? 'activa' : null },
        semantico ? `${b.rol}${i === 2 ? ' ← «saltar al contenido»' : ''}` : `grupo (${i + 1})`)));
      const b = BLOQUES[sel];
      registro.textContent = semantico ? `<${b.sem}> se anuncia como «${b.rol}»: el lector de pantalla y el modo lectura pueden saltar directo a esta región.` : 'Un <div> no dice nada de su función: es un «grupo» sin nombre y debe recorrerse en secuencia.';
      lectura.set([['regiones navegables', semantico ? '5' : '0'], ['pasos para llegar al contenido', semantico ? '1 (salto directo)' : String(sel === 2 ? 3 : sel + 1) + ' (en orden)'], ['buscadores y lectores', semantico ? 'entienden la estructura' : 'deben adivinarla']]);
    }
    lienzo.alDibujar = dibujar;
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return geo.find((g) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const g = bajo(ev); if (g) { sel = g.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const g = bajo(ev); if (!g) return tip.ocultar(); const { x, y } = lienzo.posicion(ev); tip.mostrar(x, y, semantico ? `<b>${g.b.rol}</b>` : '<b>grupo</b> sin rol'); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dom-tree', {
    intro: String.raw`
      <p>Un archivo HTML es texto; lo que el navegador manipula es un <strong>árbol de objetos</strong>, el <strong>DOM</strong> (<em>Document Object Model</em>).
      Cada etiqueta se vuelve un nodo con padre, hijos, atributos y texto. Los estilos CSS, los scripts y los lectores de pantalla trabajan sobre ese árbol, no sobre el texto.</p>
      <p>Por eso importa <em>qué</em> etiquetas se eligen: las <strong>semánticas</strong> (<code>header</code>, <code>nav</code>, <code>main</code>) describen la función de cada parte, y de ello dependen la accesibilidad y el posicionamiento en buscadores.</p>`,
    visualizaciones: [
      {
        titulo: 'El DOM y los selectores',
        descripcion: 'Escriba selectores como <code>article p</code> o <code>main &gt; *</code> y vea qué nodos del árbol coinciden. Haga clic en un nodo para obtener su camino.',
        montar: montarArbol,
      },
      {
        titulo: 'HTML semántico y accesibilidad',
        descripcion: 'Alterne entre elementos semánticos y solo <code>&lt;div&gt;</code>: la misma página visual pierde sus regiones navegables.',
        montar: montarSemantica,
      },
    ],
    teoria: String.raw`
      <h2>Del texto al árbol</h2>
      <pre><code>&lt;nav id="menu"&gt;&lt;a class="activo"&gt;Ofertas&lt;/a&gt;&lt;/nav&gt;

nav#menu                  ← nodo elemento (atributo id)
 └─ a.activo              ← nodo elemento (atributo class)
     └─ "Ofertas"         ← nodo de texto</code></pre>
      <p>El analizador (<em>parser</em>) lee el documento de arriba abajo, abre un nodo con cada etiqueta de apertura y lo cierra con la de cierre; si el HTML está mal formado, lo corrige siguiendo reglas estándar. El resultado es un árbol con raíz <code>document</code>.</p>
      <h2>Selectores y recorrido</h2>
      <table>
        <tr><th>Selector</th><th>Elige</th></tr>
        <tr><td><code>p</code></td><td>todos los <code>p</code></td></tr>
        <tr><td><code>.activo</code>, <code>#menu</code></td><td>por clase, por identificador</td></tr>
        <tr><td><code>article p</code></td><td>descendientes (a cualquier profundidad)</td></tr>
        <tr><td><code>main &gt; *</code></td><td>hijos directos</td></tr>
        <tr><td><code>h1 + nav</code></td><td>hermano inmediato</td></tr>
      </table>
      <h2>Semántica y accesibilidad</h2>
      <p>La API de accesibilidad del navegador construye, a partir del DOM, un <em>árbol de accesibilidad</em> con roles (<code>banner</code>, <code>navigation</code>, <code>main</code>…). Un <code>&lt;button&gt;</code> ya es enfocable y activable con teclado; un <code>&lt;div&gt;</code> con un clic necesita roles y manejadores extra para igualarlo.</p>
      <div class="recuadro">Regla práctica: use la etiqueta que describe el <em>significado</em> (<code>h1</code>–<code>h6</code> para títulos, <code>label</code> para campos, <code>button</code> para acciones) y deje el estilo a CSS. Los scripts que modifican este árbol se estudian en <a href="tema.html?id=dom-events">DOM y eventos</a>.</div>`,
  });
})();
