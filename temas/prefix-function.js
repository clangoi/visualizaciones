(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const PATRONES = ['abababca', 'aabaaab', 'abcabcabc', 'aaaa', 'abcd'];

  // Autómata de búsqueda del patrón: estados 0..m (largo del prefijo emparejado), con transiciones desde la función de prefijos.
  function automataKMP(p, alf) {
    const pi = A.prefijos(p), m = p.length, tabla = [];
    for (let j = 0; j <= m; j++) {
      tabla.push(alf.map((c) => {
        if (j < m && p[j] === c) return j + 1;
        return j === 0 ? 0 : tabla[pi[j - 1]][alf.indexOf(c)];
      }));
    }
    return A.desdeTabla({ nombres: Array.from({ length: m + 1 }, (_, i) => String(i)), alf, tabla, ini: 0, fin: [m], pos: Array.from({ length: m + 1 }, (_, i) => [m ? i / m : 0, 0.5]) });
  }

  /* ---------- Fig. 1: calcular π paso a paso ---------- */

  function montarPrefijos(cuerpo) {
    let p = 'abababca', pi = [], i = 0, k = 0, mensaje = '', geo = null, sel = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplos', opciones: PATRONES.map((x) => [x, x]), valor: p, alCambiar: (v) => { p = v; campo.valor = v; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'Patrón (hasta 14)', valor: p, alCambiar: (v) => { p = v.replace(/\s/g, '').slice(0, 14); rep.reiniciar(); }, alEnter: (v) => { p = v.replace(/\s/g, '').slice(0, 14); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'borde: prefijo del patrón' },
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'borde: sufijo del prefijo p[0..i]' },
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'carácter que coincide' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'carácter que no coincide' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'π[i] es la longitud del borde más largo del prefijo p[0..i]: la mayor parte propia que es a la vez prefijo y sufijo. Se calcula reutilizando π: si p[i] no continúa el borde k, se prueba con el borde del borde, k ← π[k−1]. Haga clic en una columna para ver su borde.');
    let ok = null;

    function iniciar() {
      const m = p.length;
      pi = Array(m).fill(0); i = 1; k = 0; ok = null; mensaje = m ? 'π[0] = 0: un solo carácter no tiene bordes propios. Se empieza en i = 1 con k = 0.' : '';
      return (function* () {
        yield;
        for (i = 1; i < m; i++) {
          for (;;) {
            ok = p[i] === p[k];
            mensaje = `i = ${i}: compara p[${i}] = «${p[i]}» con p[${k}] = «${p[k]}» → ${ok ? 'coincide: el borde crece a ' + (k + 1) : k > 0 ? `no coincide: se acorta el borde, k ← π[${k - 1}] = ${pi[k - 1]}` : 'no coincide y k = 0: π[i] = 0'}.`;
            yield;
            if (ok) { k++; break; }
            if (k === 0) break;
            k = pi[k - 1];
          }
          pi[i] = k; mensaje = `π[${i}] = ${k}.`; ok = null;
          yield;
        }
        i = m; mensaje = 'Terminó: la tabla π está completa.'; ok = null;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, m = p.length;
      lienzo.limpiar();
      if (!m) { registro.textContent = 'Escriba un patrón.'; return; }
      const celda = Math.max(18, Math.min(40, Math.floor((W - 80) / m))), x0 = 70, y0 = 28;
      geo = { x0, celda, m };
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'right';
      ctx.fillText('i', x0 - 8, y0 - 12); ctx.fillText('patrón', x0 - 8, y0 + celda / 2); ctx.fillText('π[i]', x0 - 8, y0 + celda + 22 + celda / 2); ctx.textAlign = 'center';
      const sin = i >= m, actual = sin ? -1 : i, objetivo = sel >= 0 ? sel : actual;
      const bordeSel = objetivo >= 0 && objetivo < m && (objetivo < pi.length) ? pi[objetivo] : 0;
      for (let c = 0; c < m; c++) {
        const x = x0 + c * celda;
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.fillText(String(c), x + celda / 2, y0 - 12);
        let col = null;
        if (objetivo >= 0 && c < bordeSel) col = C.s1;
        if (objetivo >= 0 && c > objetivo - bordeSel && c <= objetivo && sel >= 0 && bordeSel) col = col || C.s2;
        if (sel < 0 && !sin) {
          if (c === actual) col = ok === null ? C.s2 : ok ? C.s6 : C.s8;
          else if (c === k) col = ok === null ? C.s1 : ok ? C.s6 : C.s8;
          else col = null;
        }
        ctx.fillStyle = col ? VIZ.alfa(col, 0.3) : C.superficie; ctx.strokeStyle = col || C.rejilla; ctx.lineWidth = col ? 2 : 1;
        ctx.fillRect(x, y0, celda, celda); ctx.strokeRect(x + 0.5, y0 + 0.5, celda - 1, celda - 1);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14, 600); ctx.fillText(p[c], x + celda / 2, y0 + celda / 2 + 0.5);
        // fila de π
        const listo = c < pi.length && (c < i || sin || c === 0);
        ctx.fillStyle = c === sel ? VIZ.alfa(C.s1, 0.3) : C.neutro; ctx.strokeStyle = c === sel ? C.s1 : C.rejilla; ctx.lineWidth = c === sel ? 2 : 1;
        ctx.fillRect(x, y0 + celda + 22, celda, celda); ctx.strokeRect(x + 0.5, y0 + celda + 22.5, celda - 1, celda - 1);
        if (listo) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14, 700); ctx.fillText(String(pi[c]), x + celda / 2, y0 + celda + 22 + celda / 2 + 0.5); }
        if (!sin && sel < 0 && c === actual) { ctx.fillStyle = C.s2; ctx.font = VIZ.fuente(10, 700); ctx.fillText('i', x + celda / 2, y0 + celda + 9); }
        if (!sin && sel < 0 && c === k && k !== actual) { ctx.fillStyle = C.s1; ctx.font = VIZ.fuente(10, 700); ctx.fillText('k', x + celda / 2, y0 + celda + 9); }
      }
      registro.textContent = sel >= 0 && sel < pi.length && (sel < i || sin) ? `El prefijo «${p.slice(0, sel + 1)}» tiene como borde más largo «${p.slice(0, pi[sel]) || 'ε'}» (π[${sel}] = ${pi[sel]}).` : mensaje;
      lectura.set([['patrón', p], ['m', String(m)], ['π calculada', `${Math.min(pi.length, Math.max(1, sin ? m : i))} de ${m}`], ['tabla π', pi.slice(0, sin ? m : i).join(' ') || '—']]);
    }
    lienzo.alDibujar = () => pi.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const col = (ev) => { const { x } = lienzo.posicion(ev); return geo ? Math.floor((x - geo.x0) / geo.celda) : -1; };
    lienzo.canvas.addEventListener('click', (ev) => { const c = col(ev); sel = c >= 0 && c < p.length && c !== sel ? c : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const c = col(ev), { x, y } = lienzo.posicion(ev);
      if (!geo || c < 0 || c >= p.length || c >= pi.length || !(c < i || i >= p.length)) return tip.ocultar();
      tip.mostrar(x, y, `prefijo <b>${p.slice(0, c + 1)}</b><br>borde más largo: «${p.slice(0, pi[c]) || 'ε'}» (π = ${pi[c]})`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el autómata de búsqueda ---------- */

  function montarAutomata(cuerpo) {
    const lista = ['abab', 'aab', 'abaab', 'aaaa'];
    A.figuraEjecucion(cuerpo, {
      ejemplos: lista.map((p, i) => ({ nombre: `Patrón ${p}`, aut: automataKMP(p, ['a', 'b']), palabra: ['aabababab', 'aaabaab', 'ababaabaab', 'baaaaab'][i] })),
      tabla: true,
      alto: 230,
      nota: 'El estado j es la longitud del mayor prefijo del patrón que es sufijo de lo leído hasta ahora. Al llegar al estado m (doble círculo) hay una ocurrencia; las transiciones que «retroceden» son exactamente los saltos de la función de prefijos.',
    });
  }

  VIZ.registrarTema('prefix-function', {
    intro: String.raw`
      <p>Para no repetir comparaciones hay que saber qué parte de lo leído sigue siendo útil después de un fallo. La respuesta está en los <strong>bordes</strong> del patrón: un borde de una palabra es una parte de ella que es <em>a la vez prefijo y sufijo</em> (y distinta de toda la palabra). En «ababa», «a» y «aba» son bordes.</p>
      <p>La <strong>función de prefijos</strong> \(\pi\) guarda, para cada prefijo del patrón, el largo de su borde más largo. Con ella se puede construir un autómata de búsqueda y saltarse comparaciones sin perder ninguna ocurrencia.</p>`,
    visualizaciones: [
      {
        titulo: 'Calcular la función de prefijos',
        descripcion: 'Avance paso a paso: k es el largo del borde actual. Si el siguiente carácter no continúa el borde, se prueba con el borde del borde. Haga clic en una columna para ver su borde.',
        montar: montarPrefijos,
      },
      {
        titulo: 'El autómata de búsqueda del patrón',
        descripcion: 'Un AFD con m + 1 estados reconoce todos los textos que terminan en el patrón. Lea un texto y observe cómo el estado coincide con el prefijo emparejado.',
        montar: montarAutomata,
      },
    ],
    teoria: String.raw`
      <h2>Prefijos, sufijos y bordes</h2>
      <p>Una palabra \(x\) es un <strong>borde</strong> de \(w\) si es prefijo y sufijo de \(w\) con \(x \ne w\). La función de prefijos de un patrón \(p = p_0 \cdots p_{m-1}\) es</p>
      \[ \pi[i] = \max\{\, k : 0 \le k \le i,\ p_0\cdots p_{k-1} = p_{i-k+1}\cdots p_i \,\}, \]
      <p>el largo del borde más largo de \(p_0 \cdots p_i\). Todos los bordes de \(p_0\cdots p_i\) se obtienen encadenando: \(\pi[i],\ \pi[\pi[i]-1],\ \pi[\pi[\pi[i]-1]-1],\dots\)</p>
      <h2>Cálculo en tiempo lineal</h2>
      <pre><code>π[0] ← 0;  k ← 0
para i ← 1 hasta m − 1:
    mientras k &gt; 0 y p[i] ≠ p[k]:  k ← π[k − 1]
    si p[i] = p[k]:  k ← k + 1
    π[i] ← k</code></pre>
      <p><strong>Costo.</strong> \(k\) aumenta a lo más una vez por iteración del bucle externo, y cada iteración del <em>mientras</em> la disminuye. Como \(k \ge 0\), el total de disminuciones es a lo más \(m - 1\): el algoritmo es \(\Theta(m)\) (análisis amortizado).</p>
      <h2>Autómata de búsqueda</h2>
      <p>El AFD de estados \(0, 1, \dots, m\) (el estado \(j\) significa «los últimos \(j\) caracteres leídos son \(p_0\cdots p_{j-1}\) y \(j\) es máximo») tiene</p>
      \[ \delta(j, c) = \begin{cases} j + 1 & \text{si } j < m \text{ y } p_j = c,\\ 0 & \text{si } j = 0 \text{ y } p_0 \neq c,\\ \delta(\pi[j-1],\, c) & \text{en otro caso.} \end{cases} \]
      <p>Se completa con \(O(m|\Sigma|)\) tiempo y memoria, y lee el texto con una consulta a tabla por carácter. El algoritmo de <a href="tema.html?id=kmp-search">Knuth-Morris-Pratt</a> simula este autómata guardando solo \(\pi\) (\(O(m)\) memoria, independiente del alfabeto), a costa de a lo más una cadena de saltos amortizada por carácter.</p>
      <div class="recuadro"><p>El autómata de búsqueda es el AFD mínimo del lenguaje \(\Sigma^* p\) (palabras que terminan en \(p\)), con exactamente \(m + 1\) estados: la misma familia que en <a href="tema.html?id=dfa-construction">Building DFAs for Languages</a>.</p></div>`,
  });
})();
