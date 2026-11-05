(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const EJEMPLOS = ['(a|b)*abb', 'ab*|c', 'a(b|c)*', '(ab)*', 'a|b', 'a?b+'];
  const REGLAS = {
    sim: 'Símbolo: un estado inicial, un final y una arista etiquetada.',
    eps: 'ε: una arista vacía entre el inicial y el final.',
    vacio: '∅: dos estados sin ninguna arista.',
    cat: 'Concatenación rs: el final de r se conecta por ε al inicial de s.',
    uni: 'Unión r|s: un inicial nuevo bifurca por ε a ambos; los dos finales confluyen por ε en un final nuevo.',
    est: 'Estrella r*: un inicial y un final nuevos; ε para saltar r por completo y ε de vuelta para repetirla.',
  };

  /* ---------- Fig. 1: construcción pieza por pieza ---------- */

  function montarPasos(cuerpo) {
    let texto = '(a|b)*abb', r = null, pasos = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Expresión regular', valor: texto, alCambiar: (v) => { texto = v; rep.reiniciar(); }, alEnter: (v) => { texto = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { texto = v; campo.valor = v; rep.reiniciar(); } } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (pasos.length && pasos[Math.max(0, k - 1)].nfa.n > 8 ? (w < 560 ? 340 : 300) : 220) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'estado inicial y final del fragmento' },
      { color: C.apagado, texto: 'transición ε', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso construye el autómata de una subexpresión, de las hojas hacia la raíz. Todo fragmento tiene exactamente un estado inicial y uno final, y nada entra al inicial ni sale del final.');

    function iniciar() {
      r = A.parsear(texto); k = 0;
      pasos = r.error ? [] : A.posorden(r.ast).map((x) => ({ x, nfa: A.thompson(x) }));
      return (function* () { for (let i = 0; i < pasos.length; i++) { k = i + 1; yield; } })();
    }
    function dibujar() {
      const { ctx, alto: H } = lienzo;
      lienzo.limpiar();
      if (r.error) { ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`Error en la posición ${r.pos + 1}: ${r.error}.`, 12, H / 2); registro.textContent = 'La expresión no está bien formada.'; lectura.set([['¿bien formada?', 'no']]); return; }
      const paso = pasos[Math.max(0, k - 1)], nfa = paso.nfa;
      A.dibujar(lienzo, nfa, { radio: nfa.n > 10 ? 12 : 15, nodo: (q) => (nfa.ini.includes(q) || nfa.fin.has(q) ? { relleno: VIZ.alfa(C.s6, 0.28), borde: C.s6, ancho: 2.5 } : null), arista: (de, a, sims) => (sims.includes(A.E) ? { color: C.apagado, guiones: [4, 3] } : null) });
      registro.textContent = k ? `Paso ${k} de ${pasos.length} — subexpresión «${A.aTexto(paso.x)}». ${REGLAS[paso.x.t]}` : 'Pulse «Un paso» para empezar.';
      const total = A.thompson(r.ast), ops = A.posorden(r.ast).filter((x) => x.t !== 'sim').length;
      lectura.set([['subexpresión', A.aTexto(paso.x)], ['estados del fragmento', String(nfa.n)], ['transiciones', String(nfa.aristas.length)], ['autómata completo', `${total.n} estados, ${total.aristas.length} transiciones`], ['símbolos + operadores', String(A.posorden(r.ast).length)], ['operadores', String(ops)]]);
    }
    lienzo.alDibujar = () => r && (r.error || pasos.length) && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el autómata completo en acción ---------- */

  function montarEjecucion(cuerpo) {
    A.figuraEjecucion(cuerpo, {
      ejemplos: [['(a|b)*abb', 'babb'], ['ab*|c', 'abb'], ['(ab)*', 'abab'], ['a(b|c)*', 'abcb']].map(([re, w]) => ({ nombre: re, aut: A.thompson(A.parsear(re).ast), palabra: w })),
      alto: 260,
      nota: 'El conjunto activo incluye siempre la ε-clausura. Observe cómo la estrella permite repetir o saltarse el fragmento, y cómo la unión mantiene vivas las dos ramas a la vez.',
    });
  }

  VIZ.registrarTema('thompson-construction', {
    intro: String.raw`
      <p>La <strong>construcción de Thompson</strong> convierte cualquier expresión regular en un autómata. Se aplica de forma <em>modular</em>: hay una pieza para cada símbolo y una receta para cada operador (unión, concatenación, estrella) que combina las piezas de las subexpresiones.</p>
      <p>Cada pieza tiene un único estado inicial y un único estado final, y las recetas solo agregan ε-transiciones. Por eso el resultado crece linealmente con la expresión.</p>`,
    visualizaciones: [
      {
        titulo: 'Construir el autómata pieza por pieza',
        descripcion: 'Escriba una expresión y avance: en cada paso se ve el autómata de una subexpresión, desde los símbolos hasta la expresión completa.',
        montar: montarPasos,
      },
      {
        titulo: 'Ejecutar el ε-AFN resultante',
        descripcion: 'Lea una palabra con el autómata de Thompson y siga el conjunto de estados activos, ε-clausuras incluidas.',
        montar: montarEjecucion,
      },
    ],
    teoria: String.raw`
      <h2>Las cinco recetas</h2>
      <p>Para una expresión \(r\), sea \(N(r)\) su autómata, con inicial \(i_r\) y final \(f_r\):</p>
      <table>
        <tr><th>Expresión</th><th>Autómata</th><th>Estados nuevos</th></tr>
        <tr><td>\(\varnothing\)</td><td>\(i \quad f\) sin aristas</td><td>2</td></tr>
        <tr><td>\(\varepsilon\)</td><td>\(i \xrightarrow{\varepsilon} f\)</td><td>2</td></tr>
        <tr><td>\(a\)</td><td>\(i \xrightarrow{a} f\)</td><td>2</td></tr>
        <tr><td>\(rs\)</td><td>\(N(r)\), \(f_r \xrightarrow{\varepsilon} i_s\), \(N(s)\)</td><td>0</td></tr>
        <tr><td>\(r \mid s\)</td><td>\(i \xrightarrow{\varepsilon} i_r, i_s\) y \(f_r, f_s \xrightarrow{\varepsilon} f\)</td><td>2</td></tr>
        <tr><td>\(r^*\)</td><td>\(i \xrightarrow{\varepsilon} i_r\), \(i \xrightarrow{\varepsilon} f\), \(f_r \xrightarrow{\varepsilon} i_r\), \(f_r \xrightarrow{\varepsilon} f\)</td><td>2</td></tr>
      </table>
      <h2>Corrección</h2>
      <p>Por inducción estructural se demuestra \(L(N(r)) = L(r)\). Los casos base son inmediatos. Para \(r \mid s\), una ejecución aceptante debe entrar por \(i_r\) o por \(i_s\) y salir por \(f_r\) o \(f_s\), sin poder pasar de una rama a la otra porque nada entra a los iniciales ni sale de los finales de las subpiezas.
      Para \(r^*\), cada vuelta por \(f_r \to i_r\) concatena otra palabra de \(L(r)\), y el salto \(i \to f\) acepta \(\varepsilon\).</p>
      <h2>Tamaño</h2>
      <p>Cada símbolo, \(\varepsilon\), unión y estrella agregan a lo más 2 estados, y la concatenación ninguno. Si \(|r|\) es el número de símbolos y operadores, \(N(r)\) tiene a lo más \(2|r|\) estados y \(4|r|\) transiciones. Además cada estado tiene a lo más dos transiciones de salida.</p>
      <div class="recuadro"><p>Recorrido completo: expresión → ε-AFN (Thompson) → AFN (<a href="tema.html?id=epsilon-nfa">quitar ε</a>) → AFD (<a href="tema.html?id=subset-construction">subconjuntos</a>) → AFD mínimo (<a href="tema.html?id=dfa-minimization">minimización</a>).
      Es la base de herramientas como <code>lex</code> (ver <a href="tema.html?id=scanner-dfa">Scanners and Maximal Munch</a>).</p></div>
      <h2>Variantes</h2>
      <p>La construcción de <em>Glushkov</em> (o de posiciones) genera un AFN sin ε con \(n+1\) estados, uno por cada símbolo de la expresión. La de Thompson destaca por su modularidad y por simplicidad de prueba.</p>`,
  });
})();
