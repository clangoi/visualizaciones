(function () {
  'use strict';
  const { color: C } = VIZ;

  const REGLAS = [
    { nombre: 'RESERVADA', re: 'if|else|while|return', col: C.s1 },
    { nombre: 'ID', re: '[a-zA-Z_]\\w*', col: C.s2 },
    { nombre: 'NUM', re: '\\d+(\\.\\d+)?', col: C.s3 },
    { nombre: 'COMP', re: '<=|>=|==|!=', col: C.s4 },
    { nombre: 'OP', re: '[-+*/<>=]', col: C.s5 },
    { nombre: 'PUNTO', re: '[(){};,]', col: C.s7 },
    { nombre: 'ESPACIO', re: '\\s+', col: C.inactivo, ignorar: true },
    { nombre: 'COMENTARIO', re: '//[^\\n]*', col: C.inactivo, ignorar: true },
  ];
  const EJEMPLOS = [
    'while (x1 <= 10) { total = total + 3.5; } // fin',
    'ifx = if + 12',
    'a<=b != c>=3',
    'return 4.2.1 # 7',
  ];

  // Analizador: en cada posición se prueban todas las reglas; con «masLargo» gana el lexema más largo
  // (empate: la primera regla); si no, la primera regla que coincide.
  function analizar(fuente, reglas, masLargo) {
    const res = [], rx = reglas.map((r) => new RegExp(r.re, 'y'));
    let i = 0;
    while (i < fuente.length) {
      const cand = reglas.map((r, k) => { rx[k].lastIndex = i; const m = rx[k].exec(fuente); return m && m[0].length ? m[0] : null; });
      let elegido = -1;
      if (masLargo) cand.forEach((c, k) => { if (c && (elegido < 0 || c.length > cand[elegido].length)) elegido = k; });
      else elegido = cand.findIndex((c) => c);
      if (elegido < 0) { res.push({ pos: i, lexema: fuente[i], regla: -1, cand }); i++; continue; }
      res.push({ pos: i, lexema: cand[elegido], regla: elegido, cand });
      i += cand[elegido].length;
    }
    return res;
  }
  const arreglar = (prioridadReservadas) => (prioridadReservadas ? REGLAS : [REGLAS[1], REGLAS[0], ...REGLAS.slice(2)]);

  /* ---------- Fig. 1: tokenizar ---------- */

  function montarTokens(cuerpo) {
    let fuente = EJEMPLOS[0], masLargo = true, reservadasPrimero = true;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Programa fuente', valor: fuente, alCambiar: (v) => { fuente = v.slice(0, 120); dibujar(); }, alEnter: (v) => { fuente = v.slice(0, 120); dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { fuente = v; campo.valor = v; dibujar(); } } });
    ctl.casilla({ etiqueta: 'Regla del lexema más largo', valor: masLargo, alCambiar: (v) => { masLargo = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Palabras reservadas antes que identificadores', valor: reservadasPrimero, alCambiar: (v) => { reservadasPrimero = v; dibujar(); } });
    const ley = VIZ.leyenda(cuerpo, []);
    const salida = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(salida);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Desactive «lexema más largo» y pruebe «ifx = if + 12»: «ifx» se parte en «if» y «x». Desactive «reservadas primero»: «if» deja de ser palabra reservada y se convierte en identificador.');
    ley.set(REGLAS.filter((r) => !r.ignorar).map((r) => ({ color: r.col, texto: `${r.nombre}: ${r.re}` })).concat([{ color: C.s8, texto: 'ERROR léxico (ningún patrón coincide)' }]));

    function dibujar() {
      const reglas = arreglar(reservadasPrimero), toks = analizar(fuente, reglas, masLargo), vis = toks.filter((t) => t.regla < 0 || !reglas[t.regla].ignorar);
      salida.replaceChildren(...vis.map((t) => { const c = t.regla < 0 ? C.s8 : reglas[t.regla].col; return VIZ.ficha(t.lexema, { color: c, fondo: VIZ.alfa(c, 0.14) }); }));
      tabla.replaceChildren(VIZ.el('tr', null, ['#', 'Lexema', 'Token', 'Posición'].map((x) => VIZ.el('th', null, x))),
        ...vis.slice(0, 40).map((t, k) => VIZ.el('tr', null, VIZ.el('td', null, String(k + 1)), VIZ.el('td', { class: 'izq' }, t.lexema), VIZ.el('td', { class: 'izq', style: { color: t.regla < 0 ? C.s8 : null, fontWeight: 600 } }, t.regla < 0 ? 'ERROR' : reglas[t.regla].nombre), VIZ.el('td', null, String(t.pos)))));
      const errores = vis.filter((t) => t.regla < 0).length, reservadas = vis.filter((t) => t.regla >= 0 && reglas[t.regla].nombre === 'RESERVADA').length;
      registro.textContent = `El texto se divide en ${vis.length} tokens (${toks.length - vis.length} ignorados: espacios y comentarios).${errores ? ` Hay ${errores} error(es) léxico(s).` : ''}`;
      lectura.set([['caracteres', String(fuente.length)], ['tokens', String(vis.length)], ['palabras reservadas', String(reservadas)], ['errores léxicos', String(errores)], ['estrategia', masLargo ? 'lexema más largo' : 'primera regla']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: candidatos en cada posición ---------- */

  function montarCandidatos(cuerpo) {
    let fuente = EJEMPLOS[1], masLargo = true, k = 0, toks = [], reglas = REGLAS;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Programa fuente', valor: fuente, alCambiar: (v) => { fuente = v.slice(0, 80); rep.reiniciar(); }, alEnter: (v) => { fuente = v.slice(0, 80); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { fuente = v; campo.valor = v; rep.reiniciar(); } } });
    ctl.casilla({ etiqueta: 'Regla del lexema más largo', valor: masLargo, alCambiar: (v) => { masLargo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 56 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'texto ya consumido' },
      { color: VIZ.alfa(C.s2, 0.28), borde: C.s2, texto: 'lexema que se elige ahora' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'En cada posición todas las reglas intentan coincidir desde ahí. Gana la que da el lexema más largo; si dos empatan, la que está primero en la lista (por eso «if» es palabra reservada y no identificador).');

    function iniciar() { reglas = REGLAS; toks = analizar(fuente, reglas, masLargo).filter((t) => t.regla < 0 || !reglas[t.regla].ignorar || true); k = 0; return (function* () { for (let i = 1; i <= toks.length; i++) { k = i; yield; } })(); }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, t = toks[Math.max(0, k - 1)];
      lienzo.limpiar();
      if (!t) { registro.textContent = 'No hay texto.'; tabla.replaceChildren(); return; }
      const chars = [...fuente], celda = Math.max(10, Math.min(24, (W - 8) / chars.length));
      chars.forEach((ch, i) => {
        const consumido = k > 0 && i < t.pos, actual = k > 0 && i >= t.pos && i < t.pos + t.lexema.length;
        ctx.fillStyle = actual ? VIZ.alfa(C.s2, 0.28) : consumido ? VIZ.alfa(C.s1, 0.28) : C.superficie; ctx.strokeStyle = actual ? C.s2 : consumido ? C.s1 : C.rejilla; ctx.lineWidth = actual ? 2 : 1;
        ctx.fillRect(4 + i * celda, 8, celda, celda + 6); ctx.strokeRect(4.5 + i * celda, 8.5, celda - 1, celda + 5);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(13, celda - 3), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch === ' ' ? '·' : ch, 4 + i * celda + celda / 2, 8 + (celda + 6) / 2 + 0.5);
      });
      const mejor = Math.max(0, ...t.cand.map((c) => (c ? c.length : 0)));
      tabla.replaceChildren(VIZ.el('tr', null, ['Regla', 'Patrón', 'Coincide con', 'Largo'].map((x) => VIZ.el('th', null, x))),
        ...reglas.map((r, i) => VIZ.el('tr', { class: i === t.regla ? 'activa' : null }, VIZ.el('td', { class: 'izq', style: { fontWeight: i === t.regla ? 700 : 400 } }, r.nombre), VIZ.el('td', { class: 'izq' }, r.re), VIZ.el('td', { class: t.cand[i] ? 'izq' : 'vacia' }, t.cand[i] ? `«${t.cand[i]}»` : '—'), VIZ.el('td', null, t.cand[i] ? String(t.cand[i].length) : '0'))));
      registro.textContent = t.regla < 0 ? `En la posición ${t.pos}: «${t.lexema}» no coincide con ninguna regla → error léxico; se descarta y se sigue.` : `Posición ${t.pos}: ${masLargo ? `la coincidencia más larga es de ${mejor} carácter(es)` : 'se usa la primera regla que coincide'} → token ${reglas[t.regla].nombre} con lexema «${t.lexema}».`;
    }
    lienzo.alDibujar = () => toks.length && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('lexical-analysis', {
    intro: String.raw`
      <p>La primera fase de un compilador, el <strong>análisis léxico</strong>, convierte el texto del programa —una larga sucesión de caracteres— en una sucesión de <strong>tokens</strong>: palabras reservadas, identificadores, números, operadores, signos de puntuación. Cada token es la clase de un trozo del texto, el <em>lexema</em>.</p>
      <p>Cada clase se describe con una expresión regular. Como varias reglas pueden coincidir en el mismo punto (<code>if</code> es a la vez palabra reservada e identificador), se necesitan reglas de desempate: el <strong>lexema más largo</strong> y, a igual largo, la <strong>prioridad</strong> de la regla.</p>`,
    visualizaciones: [
      {
        titulo: 'Del texto a los tokens',
        descripcion: 'Tokenice un programa. Cambie la estrategia de desempate y observe cómo «ifx» o «if» se analizan de otra manera.',
        montar: montarTokens,
      },
      {
        titulo: 'Qué regla gana en cada posición',
        descripcion: 'Avance token a token: la tabla muestra lo que cada regla reconocería desde la posición actual y cuál se elige.',
        montar: montarCandidatos,
      },
    ],
    teoria: String.raw`
      <h2>Tokens, patrones y lexemas</h2>
      <table>
        <tr><th>Término</th><th>Qué es</th><th>Ejemplo</th></tr>
        <tr><td>Token</td><td>clase de elementos léxicos (nombre y, a veces, un atributo)</td><td>ID, NUM, WHILE</td></tr>
        <tr><td>Patrón</td><td>expresión regular que describe los lexemas del token</td><td>\([a\text{-}zA\text{-}Z][a\text{-}zA\text{-}Z0\text{-}9]^*\)</td></tr>
        <tr><td>Lexema</td><td>trozo concreto del texto que coincide con el patrón</td><td>total, x1</td></tr>
      </table>
      <p>Además se descartan los espacios y comentarios, que el analizador sintáctico no necesita.</p>
      <h2>Reglas de desempate</h2>
      <ol>
        <li><strong>Lexema más largo</strong> (<em>maximal munch</em>): entre todas las reglas, se elige la que reconoce más caracteres desde la posición actual. Así <code>&lt;=</code> es un solo operador y <code>ifx</code> un identificador, no <code>if</code> seguido de <code>x</code>.</li>
        <li><strong>Prioridad</strong>: si dos reglas dan el mismo largo, gana la que aparece primero. Por eso las palabras reservadas van antes que los identificadores.</li>
      </ol>
      <p>Formalmente, el analizador léxico es una función \(\text{lex} : \Sigma^* \to \text{Tokens}^*\) que parte el texto en trozos \(w = x_1 x_2 \cdots x_n\), donde cada \(x_i \in L(r_{j_i})\), y en cada paso elige el \(x_i\) más largo posible que pertenezca a algún \(L(r_j)\). No siempre existe una partición (error léxico), y la regla del más largo puede <em>fallar</em> en casos raros: el lenguaje \(\{a, ab, bc\}\) sobre la entrada «abc» da «ab» y luego «c», que es un error, aunque «a»,«bc» habría funcionado. Los analizadores prácticos aceptan esa limitación a cambio de simplicidad.</p>
      <h2>Errores léxicos</h2>
      <p>Cuando ningún patrón coincide (por ejemplo el símbolo <code>#</code>), se informa un error con su posición y se sigue desde el carácter siguiente. El análisis léxico no entiende la estructura: no sabe si los paréntesis se cierran, solo reconoce los trozos.</p>
      <h2>Implementación</h2>
      <p>Las reglas se combinan en un único autómata finito determinista que se recorre carácter a carácter (<a href="tema.html?id=scanner-dfa">Scanners and Maximal Munch</a>). Herramientas como <code>lex</code>/<code>flex</code> generan ese autómata a partir de una lista de reglas con acciones. El resultado alimenta al analizador sintáctico, que usa gramáticas libres de contexto (<a href="tema.html?id=cfg-derivations">Context-Free Grammars &amp; Derivations</a>).</p>`,
  });
})();
