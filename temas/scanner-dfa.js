(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  // Alfabeto reducido (i, f, x, 0, 1, <, =, espacio) para que el AFD combinado quepa en pantalla.
  const REGLAS = [
    { nombre: 'IF', re: 'if', col: C.s1 },
    { nombre: 'ID', re: '[ifx]+', col: C.s2 },
    { nombre: 'NUM', re: '[01]+', col: C.s3 },
    { nombre: 'LE', re: '<=', col: C.s4 },
    { nombre: 'LT', re: '<', col: C.s5 },
    { nombre: 'ASIG', re: '=', col: C.s7 },
    { nombre: 'ESP', re: ' ', col: C.inactivo, ignorar: true },
  ];
  const EJEMPLOS = ['if x<=10 ifx=1', 'ifif <=< 011', 'xf = if<x', 'i<f'];

  /* ---------- Fig. 1: el AFD combinado ---------- */

  function montarAutomata(cuerpo) {
    let comb = null, sel = -1, geo = null;
    comb = A.combinar(REGLAS);
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Quitar la selección', () => { sel = -1; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 440 : 400) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, REGLAS.map((r) => ({ color: r.col, texto: `${r.nombre}: ${r.re}` })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada estado de aceptación toma el color del token que reconoce; si varias reglas aceptan a la vez, gana la de mayor prioridad (la primera de la lista). Haga clic en un estado para ver qué subconjunto de estados de los AFN representa.');
    const ruleDe = (q) => comb.regla[q];
    function dibujar() {
      lienzo.limpiar();
      const d = comb.dfa;
      geo = A.dibujar(lienzo, d, {
        radio: d.n > 10 ? 13 : 15,
        nodo: (q) => { const r = ruleDe(q); return r >= 0 ? { relleno: VIZ.alfa(REGLAS[r].col, 0.3), borde: REGLAS[r].col, ancho: q === sel ? 4 : 2.5 } : q === sel ? { borde: C.tinta, ancho: 4 } : null; },
      });
      registro.textContent = sel >= 0
        ? `Estado s${sel}: ${ruleDe(sel) >= 0 ? `acepta el token ${REGLAS[ruleDe(sel)].nombre}${[...comb.dfa.aristas].filter((e) => e.de === sel).length ? ', pero aún puede seguir leyendo para un lexema más largo' : '; ya no tiene salida'}` : 'estado intermedio: todavía no se ha completado ningún lexema'}.`
        : 'AFD obtenido al unir los AFN de todas las reglas con un estado inicial común y determinizar.';
      lectura.set([['reglas', String(REGLAS.length)], ['estados del AFN combinado', String(comb.nfa.n)], ['estados del AFD', String(d.n)], ['estados de aceptación', String(d.fin.size)], ['transiciones', String(d.aristas.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y); sel = q === sel ? -1 : q; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y);
      if (q < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>s${q}</b>${ruleDe(q) >= 0 ? '<br>acepta ' + REGLAS[ruleDe(q)].nombre : '<br>no acepta'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: escanear con retroceso al último estado de aceptación ---------- */

  function montarEscaneo(cuerpo) {
    let texto = EJEMPLOS[0], comb = A.combinar(REGLAS), cur = { q: 0, ini: 0, pos: 0, ult: null }, tokens = [], nota = '', geo = null, T = A.delta(comb.dfa);
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Texto (alfabeto: i f x 0 1 < = espacio)', valor: texto, alCambiar: (v) => { texto = v.slice(0, 40); rep.reiniciar(); }, alEnter: (v) => { texto = v.slice(0, 40); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { texto = v; campo.valor = v; rep.reiniciar(); } } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 500 : 450) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado actual del AFD' },
      { color: VIZ.alfa(C.s4, 0.5), borde: C.s4, texto: 'lexema en curso' },
      { color: C.s6, texto: 'último punto de aceptación visto', forma: 'linea' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'se retrocede hasta ese punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El escáner avanza mientras exista transición y recuerda la última posición donde estuvo en un estado de aceptación. Cuando se atasca, emite el token de ese punto y <em>retrocede</em> el texto hasta allí. Pruebe «i&lt;f» o «ifif».');

    function iniciar() {
      comb = A.combinar(REGLAS); T = A.delta(comb.dfa);
      cur = { q: 0, ini: 0, pos: 0, ult: null }; tokens = []; nota = '';
      return (function* () {
        const w = texto;
        while (cur.ini < w.length) {
          cur = { q: 0, ini: cur.ini, pos: cur.ini, ult: null };
          nota = `Nuevo lexema desde la posición ${cur.ini}.`;
          yield;
          for (;;) {
            const c = w[cur.pos], k = c === undefined ? -1 : comb.dfa.alf.indexOf(c), q2 = k < 0 ? -1 : T[cur.q][k];
            if (q2 < 0) break;
            cur.q = q2; cur.pos++;
            if (comb.regla[q2] >= 0) cur.ult = { pos: cur.pos, regla: comb.regla[q2] };
            nota = `Lee «${c}» → s${q2}${comb.regla[q2] >= 0 ? ` (acepta ${REGLAS[comb.regla[q2]].nombre}: se recuerda la posición ${cur.pos})` : ''}.`;
            yield;
          }
          if (cur.ult) {
            const atras = cur.pos - cur.ult.pos;
            tokens.push({ lex: w.slice(cur.ini, cur.ult.pos), regla: cur.ult.regla, atras });
            nota = `Atascado en la posición ${cur.pos}. Emite ${REGLAS[cur.ult.regla].nombre} «${w.slice(cur.ini, cur.ult.pos)}»${atras ? ` y retrocede ${atras} carácter(es)` : ''}.`;
            cur.retro = atras; cur.fin = cur.ult.pos;
            yield;
            cur = { q: 0, ini: cur.ult.pos, pos: cur.ult.pos, ult: null };
          } else {
            tokens.push({ lex: w[cur.ini], regla: -1, atras: 0 });
            nota = `Atascado sin haber aceptado nada: error léxico en «${w[cur.ini]}».`;
            cur.fin = cur.ini + 1; cur.retro = cur.pos - cur.ini - 1;
            yield;
            cur = { q: 0, ini: cur.ini + 1, pos: cur.ini + 1, ult: null };
          }
        }
        nota = 'Fin del texto.'; cur.q = -1;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, d = comb.dfa, w = texto;
      lienzo.limpiar();
      const celda = Math.max(10, Math.min(24, (W - 12) / Math.max(1, w.length))), x0 = 6;
      [...w].forEach((ch, i) => {
        const enCurso = i >= cur.ini && i < cur.pos, retro = cur.retro && i >= cur.fin && i < cur.fin + cur.retro;
        ctx.fillStyle = retro ? VIZ.alfa(C.s8, 0.28) : enCurso ? VIZ.alfa(C.s4, 0.5) : i < cur.ini ? C.neutro : C.superficie; ctx.strokeStyle = retro ? C.s8 : enCurso ? C.s4 : C.rejilla; ctx.lineWidth = 1.5;
        ctx.fillRect(x0 + i * celda, 8, celda, 26); ctx.strokeRect(x0 + i * celda + 0.5, 8.5, celda - 1, 25);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(13, celda - 2), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch === ' ' ? '·' : ch, x0 + i * celda + celda / 2, 22);
      });
      if (cur.ult) { ctx.strokeStyle = C.s6; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + cur.ult.pos * celda, 4); ctx.lineTo(x0 + cur.ult.pos * celda, 38); ctx.stroke(); }
      geo = A.dibujar(lienzo, d, {
        caja: { x: 0, y: 44, w: W, h: H - 44 }, radio: d.n > 10 ? 13 : 15,
        nodo: (q) => { const r = comb.regla[q], base = r >= 0 ? { borde: REGLAS[r].col, relleno: VIZ.alfa(REGLAS[r].col, 0.12) } : null; return q === cur.q ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 4, ...(r >= 0 ? { tinta: C.tinta } : {}) } : base; },
      });
      tabla.replaceChildren(VIZ.el('tr', null, ['Lexema', 'Token', 'Retrocedió'].map((x) => VIZ.el('th', null, x))),
        ...tokens.filter((t) => t.regla < 0 || !REGLAS[t.regla].ignorar).slice(-10).map((t) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, t.lex), VIZ.el('td', { class: 'izq', style: { color: t.regla < 0 ? C.s8 : null, fontWeight: 600 } }, t.regla < 0 ? 'ERROR' : REGLAS[t.regla].nombre), VIZ.el('td', null, String(t.atras)))));
      registro.textContent = nota || 'Pulse «Un paso» para empezar.';
      lectura.set([['posición del cursor', String(cur.pos)], ['inicio del lexema', String(cur.ini)], ['último punto de aceptación', cur.ult ? `${cur.ult.pos} (${REGLAS[cur.ult.regla].nombre})` : '—'], ['tokens emitidos', String(tokens.filter((t) => t.regla < 0 || !REGLAS[t.regla].ignorar).length)], ['retrocesos', String(tokens.reduce((s, t) => s + t.atras, 0))]]);
    }
    lienzo.alDibujar = () => dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('scanner-dfa', {
    intro: String.raw`
      <p>Un generador como <code>lex</code> o <code>flex</code> recibe una lista de reglas «patrón → token» y fabrica un <strong>escáner</strong>: un único autómata determinista que reconoce el siguiente lexema carácter a carácter. Se obtiene uniendo los AFN de todas las reglas con un inicial común y determinizando; cada estado de aceptación recuerda a qué regla corresponde.</p>
      <p>Para respetar la regla del lexema más largo, el escáner no se detiene al aceptar: sigue leyendo mientras haya transiciones, anota la última posición aceptada y, cuando se atasca, <strong>retrocede</strong> hasta ella.</p>`,
    visualizaciones: [
      {
        titulo: 'El autómata combinado de las reglas',
        descripcion: 'Siete reglas se funden en un AFD. Los estados de aceptación llevan el color de su token; haga clic en uno para ver su significado.',
        montar: montarAutomata,
      },
      {
        titulo: 'Escanear con retroceso',
        descripcion: 'Siga al escáner por el texto: marca el último punto de aceptación y, al atascarse, emite el token y retrocede. Pruebe «i&lt;f»: «i» es ID, «&lt;» es LT y «f» otro ID.',
        montar: montarEscaneo,
      },
    ],
    teoria: String.raw`
      <h2>De las reglas al autómata</h2>
      <ol>
        <li>Se traduce cada patrón \(r_i\) a un AFN \(N_i\) (<a href="tema.html?id=thompson-construction">Thompson</a>).</li>
        <li>Se crea un AFN \(N\) con un estado inicial nuevo y una ε-transición hacia el inicial de cada \(N_i\).</li>
        <li>Se determiniza \(N\) (<a href="tema.html?id=subset-construction">subconjuntos</a>). Un estado del AFD (un subconjunto) es de aceptación si contiene algún final de algún \(N_i\); su token es el de la regla de <strong>menor índice</strong> entre ellas (prioridad).</li>
        <li>Se puede minimizar, respetando que no se fusionen estados con tokens distintos.</li>
      </ol>
      <h2>Algoritmo de escaneo</h2>
      <pre><code>mientras queda texto:
    q ← estado inicial;  i ← posición actual;  último ← ninguno
    mientras exista δ(q, texto[i]):
        q ← δ(q, texto[i]);  i ← i + 1
        si q es de aceptación: último ← (i, token de q)
    si último = ninguno: error léxico en la posición actual
    sino: emitir token de «último»; posición actual ← i de «último»</code></pre>
      <p>Retroceder es necesario, por ejemplo, con las reglas \(\{\,\texttt{ab},\ \texttt{abcd},\ \texttt{c}\,\}\) sobre «abce»: se llega hasta «abc» sin aceptar, se atasca en «e», y hay que volver a «ab» (último punto aceptado). El retroceso es a lo más hasta el inicio del lexema, pero puede repetirse sobre el mismo texto; en el peor caso el costo total es \(O(n^2)\), y existen versiones que garantizan tiempo lineal guardando información adicional (<em>Reps, 1998</em>).</p>
      <h2>Tabla de transiciones</h2>
      <p>Un escáner real guarda el AFD como una tabla \(\delta[q][c]\) por clases de caracteres (letras, dígitos, espacios…), más un arreglo «token de aceptación» por estado. El código del escáner es un bucle pequeño; todo el comportamiento está en los datos, lo que lo hace muy rápido (decenas de millones de caracteres por segundo).</p>
      <div class="recuadro"><p>El escáner es la primera etapa de un compilador: entrega tokens al analizador sintáctico (<a href="tema.html?id=cfg-derivations">gramáticas libres de contexto</a>). Los lenguajes regulares bastan para los tokens, pero no para la estructura anidada del programa; para eso hacen falta gramáticas.</p></div>`,
  });
})();
