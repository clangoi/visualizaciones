(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const TOPE = 300000;
  const PATRONES = [
    { re: '(a+)+b', nombre: '(a+)+b — exponencial' },
    { re: '(a|aa)+b', nombre: '(a|aa)+b — exponencial' },
    { re: '(a*)*b', nombre: '(a*)*b — exponencial' },
    { re: 'a*a*a*b', nombre: 'a*a*a*b — cúbico' },
    { re: '(a|b)*abb', nombre: '(a|b)*abb — lineal' },
  ];

  /* ---------- Fig. 1: pasos según la longitud del texto ---------- */

  function montarCrecimiento(cuerpo) {
    let k = 0, coincide = false, datos = [], plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Patrón', opciones: PATRONES.map((p, i) => [i, p.nombre]), valor: k, alCambiar: (v) => { k = +v; calcular(); dibujar(); } });
    ctl.casilla({ etiqueta: 'El texto termina en b (sí coincide)', valor: coincide, alCambiar: (v) => { coincide = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'motor con retroceso (llamadas)', forma: 'linea' },
      { color: C.s1, texto: 'simulación del autómata (estados activos examinados)', forma: 'linea' },
      { color: C.s8, texto: `tope de ${VIZ.entero(TOPE)} pasos`, forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El texto es aⁿ (o aⁿb). El eje vertical es logarítmico: una recta ascendente es crecimiento exponencial. Si el texto no termina en b, el retroceso debe agotar todas las maneras de repartir las a antes de rendirse.');
    function calcular() {
      const ast = A.parsear(PATRONES[k].re).ast, nfa = A.thompson(ast);
      datos = [];
      for (let n = 1; n <= 26; n++) {
        const w = 'a'.repeat(n) + (coincide ? 'b' : '');
        const r = A.retroceso(ast, w, { tope: TOPE, maxTraza: 0 });
        datos.push({ n, ret: r.pasos, cort: r.cortado, nfa: A.pasosNFA(nfa, w), ok: r.ok });
      }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 26, ymin: 1, ymax: 1e6 }, { logY: true, etiquetaX: 'n (cantidad de a)', etiquetaY: 'pasos' });
      plano.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.s8; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(TOPE)); ctx.lineTo(plano.x1, plano.sy(TOPE)); ctx.stroke(); ctx.restore();
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.nfa]), C.s1, 2);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, Math.min(d.ret, TOPE)]), C.s2, 2);
      for (const d of datos) { VIZ.marcador(ctx, plano.sx(d.n), plano.sy(Math.min(d.ret, TOPE)), d.cort ? C.s8 : C.s2, d.n === hover ? 5 : 3); }
      const sel = datos[(hover || 20) - 1];
      registro.textContent = datos.some((d) => d.cort) ? `El motor con retroceso supera el tope desde n = ${datos.find((d) => d.cort).n}; el autómata sigue creciendo de forma lineal (≈ ${VIZ.fmt(datos[25].nfa / 26, 3)} pasos por símbolo).` : 'Con este patrón el retroceso no explota: ambos crecen despacio.';
      lectura.set([['n', String(sel.n)], ['retroceso', sel.cort ? `> ${VIZ.entero(TOPE)}` : VIZ.entero(sel.ret)], ['autómata', VIZ.entero(sel.nfa)], ['¿coincide?', sel.ok ? 'sí' : 'no'], ['razón retroceso / autómata', sel.cort ? '> ' + VIZ.entero(TOPE / sel.nfa) : VIZ.fmt(sel.ret / sel.nfa, 3)]]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(26, Math.round(plano.ix(x))));
      dibujar();
      const d = datos[hover - 1];
      tip.mostrar(x, y, `n = <b>${hover}</b>` + VIZ.filaTooltip(C.s2, 'retroceso', d.cort ? '> ' + VIZ.entero(TOPE) : VIZ.entero(d.ret)) + VIZ.filaTooltip(C.s1, 'autómata', VIZ.entero(d.nfa)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  /* ---------- Fig. 2: la traza de un retroceso ---------- */

  function montarTraza(cuerpo) {
    let re = '(a|ab)c', texto = 'abc', r = null, paso = 0, error = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Patrón', valor: re, alCambiar: (v) => { re = v; rep.reiniciar(); }, alEnter: (v) => { re = v; rep.reiniciar(); } });
    ctl.texto({ etiqueta: 'Texto (hasta 12)', valor: texto, alCambiar: (v) => { texto = v.slice(0, 12); rep.reiniciar(); }, alEnter: (v) => { texto = v.slice(0, 12); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 96 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'el carácter coincide' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'no coincide' },
      { color: C.s2, texto: 'retroceso: lo emparejado no sirvió', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea es un intento de emparejar un símbolo. Si lo emparejado lleva a un callejón sin salida, el motor <em>retrocede</em> y prueba otra alternativa. En el ejemplo (a|ab)c sobre «abc», la primera alternativa (a) coincide pero luego falla la c: el motor deshace esa elección y prueba «ab».');

    function iniciar() {
      const x = A.parsear(re);
      error = x.error ? `Error en la posición ${x.pos + 1}: ${x.error}.` : null; paso = 0;
      r = error ? null : A.retroceso(x.ast, texto, { tope: 5000, maxTraza: 200 });
      return (function* () { if (!r) return; for (let i = 1; i <= r.traza.length; i++) { paso = i; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (error) { registro.textContent = error; lista.replaceChildren(); lectura.set([['estado', 'error']]); return; }
      const e = paso ? r.traza[paso - 1] : null, chars = [...texto], celda = Math.min(30, (W - 20) / Math.max(4, chars.length));
      const x0 = (W - celda * chars.length) / 2;
      chars.forEach((ch, i) => {
        ctx.fillStyle = e && i === e.i ? VIZ.alfa(e.ok ? C.s6 : C.s8, 0.28) : C.superficie; ctx.strokeStyle = e && i === e.i ? (e.ok ? C.s6 : C.s8) : C.rejilla; ctx.lineWidth = e && i === e.i ? 3 : 1;
        ctx.fillRect(x0 + i * celda, 12, celda, celda); ctx.strokeRect(x0 + i * celda + 0.5, 12.5, celda - 1, celda - 1);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x0 + i * celda + celda / 2, 12 + celda / 2 + 0.5);
      });
      if (e) { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText(`¿«${e.c}» en la posición ${e.i}?`, W / 2, 12 + celda + 16); }
      const lineas = r.traza.slice(0, paso).map((t, k) => VIZ.el('div', { class: k === paso - 1 ? 'activa' : null, style: { color: t.ok ? (t.retro ? C.s2 : null) : C.s8 } }, `${String(k + 1).padStart(2, '0')}  «${t.c}» en ${t.i}: ${t.ok ? 'coincide' : 'no coincide'}${t.retro ? '  ↩ retrocede (el resto no encajó)' : ''}`));
      lista.replaceChildren(...lineas.slice(-8));
      const fin = paso === r.traza.length;
      registro.textContent = fin ? (r.ok ? `Coincidencia completa tras ${r.pasos} llamadas del motor.` : r.cortado ? 'Se cortó la búsqueda por exceder el tope.' : `Ninguna alternativa coincide con todo el texto (${r.pasos} llamadas).`) : 'Siguiendo la búsqueda…';
      lectura.set([['intentos de símbolo mostrados', `${paso} de ${r.traza.length}`], ['llamadas totales del motor', String(r.pasos)], ['retrocesos', String(r.traza.filter((t) => t.retro).length)], ['resultado', fin ? (r.ok ? 'coincide' : 'no coincide') : '…']]);
    }
    lienzo.alDibujar = () => (r || error) && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('regex-backtracking', {
    intro: String.raw`
      <p>Hay dos formas de ejecutar una expresión regular. Un motor con <strong>retroceso</strong> (backtracking) prueba una alternativa tras otra y, cuando una falla, vuelve atrás para ensayar la siguiente. Un motor de <strong>autómata</strong> sigue todas las alternativas a la vez, como en la simulación de un AFN.</p>
      <p>Para la mayoría de los patrones dan lo mismo. Pero para ciertos patrones, un motor con retroceso necesita un tiempo <em>exponencial</em> en el tamaño del texto, mientras que el autómata sigue siendo lineal. Es una causa real de caídas de servicios (ataques <em>ReDoS</em>).</p>`,
    visualizaciones: [
      {
        titulo: 'Retroceso frente a autómata',
        descripcion: 'Aumenta n en un texto de a: con (a+)+b el motor con retroceso explora un número exponencial de maneras de repartir las a; el autómata lee cada símbolo una vez.',
        montar: montarCrecimiento,
      },
      {
        titulo: 'La traza de un retroceso',
        descripcion: 'Siga cada intento del motor sobre un texto corto. Con (a|ab)c y «abc» verá cómo la primera elección (a) debe deshacerse para que la coincidencia aparezca con «ab».',
        montar: montarTraza,
      },
    ],
    teoria: String.raw`
      <h2>El motor con retroceso</h2>
      <pre><code>coincide(r, i, k):                # k: qué hacer después
    r = a:        i &lt; n  y  w[i] = a  y  k(i+1)
    r = s t:      coincide(s, i, j → coincide(t, j, k))
    r = s | t:    coincide(s, i, k)  o  coincide(t, i, k)
    r = s*:       coincide(s, i, j → j &gt; i  y  coincide(r, j, k))  o  k(i)</code></pre>
      <p>Prueba las alternativas en orden y se detiene con la primera que sirve. Es simple y permite agregar referencias hacia atrás, pero puede repetir el mismo trabajo muchas veces.</p>
      <h2>¿Por qué explota (a+)+b?</h2>
      <p>Sobre \(a^n\) (sin \(b\)) el motor debe agotar todas las particiones de las \(n\) letras \(a\) en bloques consecutivos: \(2^{n-1}\) maneras. Cada una termina en fracaso por la falta de la \(b\), y recién entonces se rinde. Por eso el número de pasos duplica con cada \(a\) adicional:</p>
      \[ T(n) = \Theta(2^n). \]
      <p>Los patrones peligrosos son los que tienen un cuantificador sobre algo que ya contiene un cuantificador, o alternativas que se solapan dentro de una repetición: \((a|aa)^+\), \((a^*)^*\), \((.*a)^+\).</p>
      <h2>El motor de autómata</h2>
      <p>Se convierte la expresión en un AFN de \(O(|r|)\) estados (<a href="tema.html?id=thompson-construction">Thompson</a>) y se simula con conjuntos de estados (<a href="tema.html?id=nfa-simulation">Simulating NFAs Efficiently</a>): tiempo \(O(|r|\cdot n)\), siempre. No puede, en cambio, manejar referencias hacia atrás, y para saber <em>qué</em> subcadena capturó cada grupo necesita trabajo adicional (autómatas con marcas, como en RE2).</p>
      <h2>Qué se puede hacer</h2>
      <table>
        <tr><th>Estrategia</th><th>Efecto</th></tr>
        <tr><td>Usar un motor de autómata (RE2, Rust <code>regex</code>, <code>grep -E</code>)</td><td>tiempo lineal garantizado</td></tr>
        <tr><td>Cuantificadores posesivos y grupos atómicos</td><td>prohíben retroceder dentro del grupo</td></tr>
        <tr><td>Evitar alternativas solapadas y estrellas anidadas</td><td>elimina la ambigüedad que causa la explosión</td></tr>
        <tr><td>Poner un límite de tiempo o de pasos</td><td>mitiga, pero no soluciona</td></tr>
      </table>
      <div class="recuadro"><p>La ambigüedad del patrón es la clave: si cada palabra se puede emparejar de una única manera, el retroceso no repite trabajo. Una expresión «inambigua» es la que corresponde a un autómata con a lo más un camino aceptante por palabra.</p></div>`,
  });
})();
