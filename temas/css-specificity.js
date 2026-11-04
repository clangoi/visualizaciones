(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const { arbol } = VIZ.web;

  const COLORES = { violeta: C.s7, azul: C.s1, verde: C.s6, naranjo: C.s2, rojo: C.s8, amarillo: C.s4 };
  const REGLAS = [
    { sel: 'p', color: 'violeta' }, { sel: '.nota', color: 'azul' }, { sel: 'p.nota', color: 'verde' },
    { sel: '#aviso', color: 'naranjo' }, { sel: '.nota.urgente', color: 'rojo' }, { sel: 'body p', color: 'amarillo' },
  ];

  // Especificidad (identificadores, clases/atributos/pseudoclases, etiquetas) de un selector simple.
  function especificidad(s) {
    const a = (s.match(/#[\w-]+/g) || []).length;
    const b = (s.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length;
    const c = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) || []).length;
    return [a, b, c];
  }
  const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

  /* ---------- Fig. 1: la cascada decide qué regla gana ---------- */

  function montarCascada(cuerpo) {
    const doc = new DOMParser().parseFromString('<body><p id="aviso" class="nota urgente">Texto</p></body>', 'text/html');
    const p = doc.querySelector('p');
    const est = { activas: REGLAS.map(() => true), inline: false, importante: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(REGLAS.map((r, i) => ({ clave: String(i), texto: r.sel, color: COLORES[r.color], activo: true })), (e) => { REGLAS.forEach((_, i) => { est.activas[i] = e[String(i)]; }); dibujar(); });
    ctl.casillas([{ clave: 'inline', texto: 'estilo en línea: style="color: azul"', activo: false }, { clave: 'importante', texto: 'regla «p» con !important', activo: false }], (e) => { est.inline = e.inline; est.importante = e.importante; dibujar(); });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(el('p', { class: 'subtitulo-viz' }, 'Elemento: <p id="aviso" class="nota urgente">'), el('div', { class: 'caja-desplazable' }, tabla));
    const muestra = el('div', { class: 'fichas' });
    cuerpo.appendChild(muestra);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gana primero <code>!important</code>, luego el estilo en línea, luego la mayor especificidad (id, clase, etiqueta) y, ante un empate, la regla que aparece más tarde.');

    function dibujar() {
      const cand = REGLAS.map((r, i) => ({ ...r, i, esp: especificidad(r.sel), coincide: p.matches(r.sel), act: est.activas[i], imp: est.importante && i === 0 }));
      if (est.inline) cand.push({ sel: 'style="…"', color: 'azul', i: 99, esp: [1, 0, 0], coincide: true, act: true, inline: true });
      const vivos = cand.filter((c) => c.coincide && c.act);
      const nivel = (c) => (c.imp ? 3 : c.inline ? 2 : 1);
      const ganador = vivos.sort((x, y) => nivel(x) - nivel(y) || cmp(x.esp, y.esp) || x.i - y.i).pop();
      const orden = [...cand];
      tabla.replaceChildren(
        el('tr', null, ...['Regla', 'Color', 'Especificidad', 'Orden', 'Estado'].map((h) => el('th', null, h))),
        ...orden.map((c) => el('tr', { class: c === ganador ? 'activa' : (!c.act || !c.coincide ? 'tachada' : null) },
          el('td', null, VIZ.ficha(c.sel + (c.imp ? ' !important' : ''), { color: COLORES[c.color] })), el('td', null, c.color),
          el('td', null, c.inline ? 'en línea' : `(${c.esp.join(', ')})`), el('td', null, c.inline ? '—' : String(c.i + 1)),
          el('td', null, !c.act ? 'desactivada' : c === ganador ? 'GANA' : c.coincide ? 'pierde' : 'no coincide'))));
      muestra.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Color final:'), ganador ? VIZ.ficha(ganador.color, { color: COLORES[ganador.color], fondo: VIZ.alfa(COLORES[ganador.color], 0.25) }) : el('span', { class: 'fichas-vacio' }, 'heredado o por omisión'));
      registro.textContent = ganador ? `Gana «${ganador.sel}${ganador.imp ? ' !important' : ''}»: ${ganador.imp ? 'importante supera a todo' : ganador.inline ? 'el estilo en línea supera a las hojas de estilo' : `su especificidad (${ganador.esp.join(', ')}) es la más alta entre las que coinciden`}.` : 'Ninguna regla activa: el elemento usa el estilo por omisión.';
      lectura.set([['reglas que coinciden', String(cand.filter((c) => c.coincide && c.act).length)], ['ganadora', ganador ? ganador.sel : '—']]);
    }
    cuerpo.dataset.sinLeyenda = 'figura sin canvas: la tabla nombra cada regla';
    dibujar();
  }

  /* ---------- Fig. 2: herencia de estilos ---------- */

  const PROPS = {
    color: { heredada: true, valores: { violeta: C.s7, azul: C.s1, verde: C.s6, naranjo: C.s2 } },
    'font-size': { heredada: true, valores: { '1,5rem': C.s1, '1rem': C.s6, '0,8rem': C.s2 } },
    border: { heredada: false, valores: { 'borde 2px': C.s1, 'borde punteado': C.s7 } },
    background: { heredada: false, valores: { amarillo: C.s4, aguamarina: C.s3 } },
  };
  function montarHerencia(cuerpo) {
    const raiz = { texto: 'body', hijos: [{ texto: 'header', hijos: [{ texto: 'h1', hijos: [] }, { texto: 'nav', hijos: [{ texto: 'a', hijos: [] }] }] }, { texto: 'main', hijos: [{ texto: 'article', hijos: [{ texto: 'p', hijos: [] }, { texto: 'span', hijos: [] }] }] }] };
    const todos = VIZ.web.aplanar(raiz);
    const padre = new Map(); todos.forEach((n) => n.hijos.forEach((h) => padre.set(h, n)));
    let prop = 'color', valor = 'violeta', fijados = {}, nodos = [];
    const ctl = VIZ.controles(cuerpo);
    const selVal = ctl.selector({ etiqueta: 'Valor', valor, opciones: Object.keys(PROPS[prop].valores).map((v) => [v, v]), alCambiar: (v) => { valor = v; } });
    ctl.selector({ etiqueta: 'Propiedad', valor: prop, opciones: Object.keys(PROPS).map((k) => [k, `${k} (${PROPS[k].heredada ? 'se hereda' : 'no se hereda'})`]), alCambiar: (v) => {
      prop = v; fijados = {};
      selVal.select.replaceChildren(...Object.keys(PROPS[v].valores).map((x) => el('option', { value: x }, x)));
      valor = Object.keys(PROPS[v].valores)[0]; selVal.valor = valor; dibujar();
    } });
    ctl.boton('Limpiar', () => { fijados = {}; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 250 : 220) });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un elemento para aplicarle el valor elegido; haga clic otra vez para quitarlo. Con propiedades heredadas, los descendientes lo reciben solos.');

    const efectivo = (n) => { for (let x = n; x; x = padre.get(x)) { if (x.texto in fijados) return [fijados[x.texto], x === n]; if (!PROPS[prop].heredada) break; } return [null, false]; };
    function dibujar() {
      lienzo.limpiar();
      nodos = arbol(lienzo.ctx, raiz, lienzo.ancho, lienzo.alto, (n) => {
        const [v, propio] = efectivo(n);
        if (!v) return {};
        return { relleno: VIZ.alfa(PROPS[prop].valores[v], 0.25), borde: PROPS[prop].valores[v], guiones: propio ? null : [4, 3] };
      }, { tam: lienzo.ancho < 600 ? 10 : 11 });
      ley.set([...Object.entries(PROPS[prop].valores).map(([v, c]) => ({ color: c, texto: v })), { color: C.eje, texto: 'valor inicial (sin regla)' }]);
      const con = todos.filter((n) => efectivo(n)[0]).length;
      registro.textContent = PROPS[prop].heredada ? `«${prop}» se hereda: un valor fijado en un elemento llega a sus descendientes (borde punteado) hasta que alguno lo cambia.` : `«${prop}» no se hereda: solo el elemento al que se aplica lo tiene.`;
      lectura.set([['propiedad', prop], ['elementos con valor', `${con} de ${todos.length}`], ['reglas explícitas', String(Object.keys(fijados).length)]]);
    }
    lienzo.alDibujar = dibujar;
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return nodos.find((n) => x >= n.x - n.w / 2 && x <= n.x + n.w / 2 && y >= n.y && y <= n.y + n.h); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const n = bajo(ev); if (!n) return; if (fijados[n.texto] === valor) delete fijados[n.texto]; else fijados[n.texto] = valor; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const n = bajo(ev); if (!n) return tip.ocultar(); const [v, propio] = efectivo(n); const { x, y } = lienzo.posicion(ev); tip.mostrar(x, y, `<b>${n.texto}</b><br>${prop}: ${v ? `${v}${propio ? ' (propio)' : ' (heredado)'}` : 'inicial'}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('css-specificity', {
    intro: String.raw`
      <p>CSS significa <em>hojas de estilo en cascada</em>: muchas reglas pueden apuntar al mismo elemento, y el navegador debe decidir cuál manda.
      Esa decisión no es el azar ni el orden alfabético, sino un algoritmo con tres ingredientes: <strong>importancia</strong>, <strong>especificidad</strong> y <strong>orden</strong>.</p>
      <p>Además, algunas propiedades (como el color del texto) se <strong>heredan</strong> de padres a hijos, mientras que otras (como el borde) no.</p>`,
    visualizaciones: [
      {
        titulo: 'La cascada: quién gana',
        descripcion: 'Desactive reglas una por una, active el estilo en línea o <code>!important</code> y compruebe qué ingrediente decide el color final.',
        montar: montarCascada,
      },
      {
        titulo: 'Herencia de propiedades',
        descripcion: 'Aplique un color en <code>main</code> y mire hasta dónde llega; luego pruebe con <code>border</code> y vea que no se propaga.',
        montar: montarHerencia,
      },
    ],
    teoria: String.raw`
      <h2>Especificidad</h2>
      <p>La especificidad de un selector es una terna \((a, b, c)\):</p>
      <ul>
        <li>\(a\): número de selectores de identificador (<code>#aviso</code>),</li>
        <li>\(b\): clases, atributos y pseudoclases (<code>.nota</code>, <code>[type]</code>, <code>:hover</code>),</li>
        <li>\(c\): etiquetas y pseudoelementos (<code>p</code>, <code>::before</code>).</li>
      </ul>
      <p>Las ternas se comparan <em>lexicográficamente</em>: un solo identificador \((1,0,0)\) vence a cualquier cantidad de clases \((0,n,0)\). Por ejemplo, <code>p.nota</code> es \((0,1,1)\), <code>.nota.urgente</code> es \((0,2,0)\) y <code>#aviso</code> es \((1,0,0)\).</p>
      <h2>Orden de decisión</h2>
      <pre><code>1. declaraciones con !important       (invierte el orden normal)
2. estilo en línea (atributo style)
3. mayor especificidad (a, b, c)
4. aparece más tarde en la hoja       (desempate)</code></pre>
      <h2>Herencia</h2>
      <p>Si ninguna regla fija una propiedad, un elemento toma el valor de su padre cuando la propiedad es <em>heredada</em> (<code>color</code>, <code>font-*</code>, <code>line-height</code>) o su valor inicial cuando no lo es (<code>border</code>, <code>margin</code>, <code>background</code>). Con <code>inherit</code> se fuerza la herencia.</p>
      <div class="recuadro">Para mantener el CSS predecible: prefiera selectores de clase de baja especificidad, evite <code>!important</code> y los identificadores para estilos, y ordene las reglas de lo general a lo particular. La caja que ocupa cada elemento se estudia en <a href="tema.html?id=box-model">Box Model</a>.</div>`,
  });
})();
