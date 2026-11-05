(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  // «El n-ésimo símbolo desde el final es 1»: n + 1 estados en el AFN.
  function enesimo(n) {
    const trans = [[0, ['0', '1'], 0], [0, '1', 1]];
    for (let i = 1; i < n; i++) trans.push([i, ['0', '1'], i + 1]);
    return A.construir({ n: n + 1, ini: [0], fin: [n], trans });
  }
  // «termina en 1ⁿ»: también n + 1 estados, pero el AFD no crece más.
  function sufijoUnos(n) {
    const trans = [[0, ['0', '1'], 0], [0, '1', 1]];
    for (let i = 1; i < n; i++) trans.push([i, '1', i + 1]);
    return A.construir({ n: n + 1, ini: [0], fin: [n], trans });
  }
  // Unión de ciclos de longitudes primas: el AFN suma, el AFD multiplica.
  const PRIMOS = [2, 3, 5, 7, 11];
  function ciclos(k) {
    const trans = [], ini = [];
    let n = 0;
    for (const p of PRIMOS.slice(0, k)) { ini.push(n); for (let i = 0; i < p; i++) trans.push([n + i, 'a', n + ((i + 1) % p)]); n += p; }
    return A.construir({ n, ini, fin: ini, trans });
  }
  const FAMILIAS = {
    enesimo: { nombre: 'n-ésimo símbolo desde el final es 1', max: 9, hacer: enesimo, param: 'n' },
    sufijo: { nombre: 'termina en 1ⁿ', max: 9, hacer: sufijoUnos, param: 'n' },
    ciclos: { nombre: 'unión de ciclos de longitud prima 2, 3, 5, …', max: 4, hacer: ciclos, param: 'k (cantidad de ciclos)' },
  };
  const tam = (aut) => { const d = A.determinizar(aut).dfa; return { afn: aut.n, afd: d.n, min: A.minimizar(d).min.n }; };

  /* ---------- Fig. 1: la ventana de los últimos n símbolos ---------- */

  function montarVentana(cuerpo) {
    let n = 3, palabra = '0110100', leidos = 7, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'n', min: 1, max: 6, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.texto({ etiqueta: 'Palabra binaria', valor: palabra, alCambiar: (v) => { palabra = v.replace(/[^01]/g, '').slice(0, 16); leidos = palabra.length; r.valor = leidos; r.input.max = palabra.length; dibujar(); } });
    const r = ctl.rango({ etiqueta: 'Símbolos leídos', min: 0, max: palabra.length, valor: leidos, alCambiar: (v) => { leidos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estados activos del AFN' },
      { color: VIZ.alfa(C.s4, 0.5), borde: C.s4, texto: 'ventana de los últimos n símbolos (estado del AFD)' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'acepta: el n-ésimo desde el final es 1' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El AFN adivina qué «1» será el n-ésimo desde el final y cuenta n − 1 símbolos. Un AFD no puede adivinar: debe recordar los últimos n símbolos, y hay 2ⁿ ventanas distintas.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, aut = enesimo(n), w = palabra.slice(0, leidos);
      lienzo.limpiar();
      const S = A.simular(aut, w).trazas[leidos];
      const lw = [...palabra], celda = Math.max(16, Math.min(32, Math.floor((W - 20) / Math.max(1, lw.length))));
      const x0 = (W - lw.length * celda) / 2;
      ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lw.forEach((c, i) => {
        const dentro = i >= leidos - n && i < leidos, leida = i < leidos;
        ctx.fillStyle = dentro ? VIZ.alfa(C.s4, 0.5) : leida ? C.neutro : C.superficie; ctx.strokeStyle = dentro ? C.s4 : C.rejilla; ctx.lineWidth = dentro ? 2 : 1;
        ctx.fillRect(x0 + i * celda, 10, celda, celda); ctx.strokeRect(x0 + i * celda + 0.5, 10.5, celda - 1, celda - 1);
        ctx.fillStyle = leida ? C.tinta : C.inactivo; ctx.fillText(c, x0 + i * celda + celda / 2, 10 + celda / 2 + 0.5);
      });
      if (leidos > 0) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.fillText(`últimos ${Math.min(n, leidos)} símbolos`, x0 + (Math.max(0, leidos - n) + Math.min(n, leidos) / 2) * celda, 10 + celda + 10); }
      const acepta = A.hayFinal(aut, S);
      geo = A.dibujar(lienzo, aut, { caja: { x: 0, y: 70, w: W, h: H - 70 }, nodo: A.estiloConjunto(S, { color: C.s1, fin: aut.fin }) });
      void geo;
      registro.textContent = leidos >= n ? `El símbolo n = ${n} desde el final es «${w[leidos - n]}»: ${acepta ? 'acepta' : 'rechaza'}. El AFD debe haber guardado la ventana «${w.slice(leidos - n)}».` : `Se han leído menos de n = ${n} símbolos: todavía no hay un n-ésimo desde el final.`;
      lectura.set([['estados del AFN (n + 1)', String(n + 1)], ['estados del AFD mínimo (2ⁿ)', VIZ.entero(Math.pow(2, n))], ['estados activos', A.nombreConj(aut, S)], ['veredicto', acepta ? 'acepta' : 'rechaza']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: tres familias ---------- */

  function montarFamilias(cuerpo) {
    let fam = 'enesimo', plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Familia de lenguajes', opciones: Object.entries(FAMILIAS).map(([k, f]) => [k, f.nombre]), valor: fam, alCambiar: (v) => { fam = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'estados del AFN', forma: 'linea' },
      { color: C.s2, texto: 'estados del AFD por subconjuntos', forma: 'linea' },
      { color: C.s3, texto: 'estados del AFD mínimo', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico. En la primera familia el AFN crece linealmente y el AFD exponencialmente; en la segunda no hay explosión; en la tercera el AFD pasa de sumar a multiplicar.');
    let datos = [];
    function calcular() { const f = FAMILIAS[fam]; datos = []; for (let i = 1; i <= f.max; i++) datos.push({ n: i, ...tam(f.hacer(i)) }); }
    function dibujar() {
      const { ctx } = lienzo, f = FAMILIAS[fam], mx = Math.max(...datos.map((d) => d.afd));
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: f.max, ymin: 1, ymax: Math.pow(10, Math.ceil(Math.log10(mx + 1))) }, { logY: true, etiquetaX: f.param, etiquetaY: 'estados', ticksX: datos.map((d) => d.n) });
      plano.ejes();
      for (const [clave, col] of [['afn', C.s1], ['afd', C.s2], ['min', C.s3]]) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d[clave]]), col, 2);
        for (const d of datos) VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d[clave]), col, d.n === hover ? 5 : 3);
      }
      const d = datos[(hover || datos.length) - 1];
      lectura.set([[f.param.split(' ')[0], String(d.n)], ['AFN', String(d.afn)], ['AFD (subconjuntos)', String(d.afd)], ['AFD mínimo', String(d.min)], ['razón AFD / AFN', VIZ.fmt(d.afd / d.afn, 3)]]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(datos.length, Math.round(plano.ix(x))));
      dibujar();
      const d = datos[hover - 1];
      tip.mostrar(x, y, `${FAMILIAS[fam].param.split(' ')[0]} = <b>${d.n}</b>` + VIZ.filaTooltip(C.s1, 'AFN', d.afn) + VIZ.filaTooltip(C.s2, 'AFD', d.afd) + VIZ.filaTooltip(C.s3, 'AFD mínimo', d.min));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('subset-blowup', {
    intro: String.raw`
      <p>La construcción por subconjuntos garantiza que un AFN con \(n\) estados se puede convertir en un AFD con a lo más \(2^n\). La pregunta natural es si esa explosión es real o solo una cota pesimista.
      Hay lenguajes, como «el \(n\)-ésimo símbolo desde el final es 1», para los que es <strong>inevitable</strong>: aunque el AFN tenga \(n+1\) estados, todo AFD necesita \(2^n\).</p>
      <p>Otros lenguajes, en cambio, determinizan sin costo. La figura 2 compara tres familias para ver qué las diferencia.</p>`,
    visualizaciones: [
      {
        titulo: 'Un AFD debe recordar una ventana',
        descripcion: 'Aumente n y avance sobre la palabra: el AFN solo cuenta, pero un AFD debe recordar los últimos n símbolos, de los que hay \\(2^n\\) posibilidades.',
        montar: montarVentana,
      },
      {
        titulo: 'Tres familias, tres comportamientos',
        descripcion: 'Estados del AFN, del AFD por subconjuntos y del AFD mínimo según el parámetro. Pase el cursor para leer valores.',
        montar: montarFamilias,
      },
    ],
    teoria: String.raw`
      <h2>La familia \(L_n\)</h2>
      <p>Sea \(L_n = \{ w \in \{0,1\}^* : \text{el } n\text{-ésimo símbolo desde el final de } w \text{ es } 1\}\). Un AFN con \(n + 1\) estados lo reconoce: se queda en \(q_0\) hasta «adivinar» el 1 correcto, y luego cuenta \(n-1\) símbolos más.</p>
      <div class="recuadro"><p><strong>Teorema.</strong> Todo AFD que reconoce \(L_n\) tiene al menos \(2^n\) estados.</p></div>
      <p><em>Demostración.</em> Sean \(u \ne v\) dos palabras de longitud \(n\). Difieren en alguna posición \(i\), digamos \(u_i = 1\) y \(v_i = 0\). Sea \(z = 0^{i-1}\). Entonces el \(n\)-ésimo símbolo desde el final de \(uz\) es \(u_i = 1\), y el de \(vz\) es \(v_i = 0\):
      \(uz \in L_n\) pero \(vz \notin L_n\). Así, \(u\) y \(v\) llevan a estados distintos, y hay \(2^n\) palabras de longitud \(n\). \(\blacksquare\)</p>
      <p>El argumento es un caso del teorema de <a href="tema.html?id=myhill-nerode">Myhill-Nerode</a>: la cantidad de estados de un AFD mínimo es el número de clases de palabras que se distinguen por algún sufijo.</p>
      <h2>Cuándo no hay explosión</h2>
      <table>
        <tr><th>Familia</th><th>AFN</th><th>AFD mínimo</th><th>Por qué</th></tr>
        <tr><td>\(n\)-ésimo desde el final es 1</td><td>\(n+1\)</td><td>\(2^n\)</td><td>hay que recordar una ventana arbitraria</td></tr>
        <tr><td>termina en \(1^n\)</td><td>\(n+1\)</td><td>\(n+1\)</td><td>solo importa cuántos 1 seguidos hay al final</td></tr>
        <tr><td>unión de ciclos de largos \(p_1,\dots,p_k\) primos</td><td>\(\sum p_i\)</td><td>\(\prod p_i\)</td><td>hay que llevar a la vez todos los restos (teorema chino del resto)</td></tr>
      </table>
      <h2>Qué se hace en la práctica</h2>
      <ul>
        <li>Determinizar <em>bajo demanda</em>: construir solo los subconjuntos que la entrada visita (<a href="tema.html?id=nfa-simulation">Simulating NFAs Efficiently</a>).</li>
        <li>Simular el AFN directamente con un vector de bits: costo \(O(n)\) por símbolo sin construir nada.</li>
        <li>Minimizar tras cada construcción (<a href="tema.html?id=dfa-minimization">DFA Minimization</a>).</li>
      </ul>`,
  });
})();
