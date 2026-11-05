(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const EJ = [
    { nombre: 'Varias ocurrencias solapadas', t: 'abababababab', p: 'abab' },
    { nombre: 'Un fallo tardío que obliga a saltar', t: 'ababcabcabababd', p: 'ababd' },
    { nombre: 'ADN', t: 'GATTACAGATTACAGATTACA', p: 'GATTACA' },
    { nombre: 'Peor caso de la búsqueda ingenua', t: 'aaaaaaaaaaaaaaaaaaaaaaaab', p: 'aaaab' },
  ];

  /* ---------- Fig. 1: KMP paso a paso ---------- */

  function montarBusqueda(cuerpo) {
    let t = EJ[0].t, p = EJ[0].p, r = null, k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplos', opciones: EJ.map((e, i) => [i, e.nombre]), valor: 0, alCambiar: (v) => { t = EJ[+v].t; p = EJ[+v].p; ct.valor = t; cp.valor = p; rep.reiniciar(); } });
    const ct = ctl.texto({ etiqueta: 'Texto (hasta 40)', valor: t, alCambiar: (v) => { t = v.slice(0, 40); rep.reiniciar(); }, alEnter: (v) => { t = v.slice(0, 40); rep.reiniciar(); } });
    const cp = ctl.texto({ etiqueta: 'Patrón', valor: p, alCambiar: (v) => { p = v.slice(0, 12); rep.reiniciar(); }, alEnter: (v) => { p = v.slice(0, 12); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 112 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'coincide / ocurrencia' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'no coincide' },
      { color: VIZ.alfa(C.s1, 0.2), borde: C.rejilla, texto: 'emparejado, no se vuelve a comparar' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La marca naranja bajo el texto es el puntero i: nunca retrocede. Cuando hay un fallo después de j coincidencias, el patrón se desliza hasta alinear su borde más largo (π[j−1]) y la comparación continúa en el mismo i.');
    function iniciar() {
      r = A.kmp(t, p); k = 0;
      return (function* () { for (let i = 1; i <= r.ev.length; i++) { k = i; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, m = p.length;
      lienzo.limpiar();
      if (!m || !t) { registro.textContent = 'Escriba un texto y un patrón.'; return; }
      const e = k ? r.ev[k - 1] : null;
      const vistos = r.occ.filter((o) => o + m - 1 <= (e ? e.i : -1) && e && (e.i > o + m - 1 || e.ok));
      A.dibujarAlineado(ctx, W, t, p, e ? { inicio: e.inicio, j: e.j, ok: e.ok, i: e.i, occ: vistos } : { occ: [] });
      tabla.replaceChildren(VIZ.el('tr', null, VIZ.el('th', null, 'i'), [...p].map((c, i) => VIZ.el('th', null, String(i)))), VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'patrón'), [...p].map((c) => VIZ.el('td', null, c))), VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'π[i]'), r.pi.map((v) => VIZ.el('td', null, String(v)))));
      let txt = 'Pulse «Un paso» o «Reproducir».';
      if (e) {
        const sig = e.ok ? null : e.j > 0 ? r.pi[e.j - 1] : 0;
        txt = `Puntero i = ${e.i}: compara texto[${e.i}] = «${t[e.i]}» con patrón[${e.j}] = «${p[e.j]}» → ${e.ok ? (e.j === m - 1 ? '¡ocurrencia completa!' : 'coincide, avanza i') : e.j > 0 ? `no coincide: el patrón se desliza ${e.j - sig} (j ← π[${e.j - 1}] = ${sig}), i no retrocede` : 'no coincide con j = 0: avanza i'}.`;
      }
      registro.textContent = txt;
      lectura.set([['n (texto)', String(t.length)], ['m (patrón)', String(m)], ['comparaciones', `${k} de ${r.cmp}`], ['cota 2n − m', String(2 * t.length - m)], ['ocurrencias', vistos.length ? vistos.join(', ') : 'ninguna aún'], ['ingenua habría hecho', String(A.ingenua(t, p).cmp)]]);
    }
    lienzo.alDibujar = () => r && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: ingenua frente a KMP ---------- */

  function montarCosto(cuerpo) {
    let m = 8, tipo = 'peor', datos = [], plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de texto', opciones: [['peor', 'peor caso: aaa…a con patrón aaa…ab'], ['per', 'periódico: abab… con patrón (ab)ⁿc'], ['bin', 'aleatorio binario'], ['adn', 'aleatorio sobre 4 letras']], valor: tipo, alCambiar: (v) => { tipo = v; calcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Largo del patrón m', min: 2, max: 20, valor: m, alCambiar: (v) => { m = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'búsqueda ingenua', forma: 'linea' },
      { color: C.s1, texto: 'Knuth-Morris-Pratt', forma: 'linea' },
      { color: C.apagado, texto: 'cota 2n de KMP', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'KMP hace como máximo 2n comparaciones, sin importar el texto: el puntero del texto nunca retrocede y cada fallo acorta el patrón, que solo creció con coincidencias previas. En texto aleatorio la ingenua casi empata.');
    function generar(n) {
      const rnd = VIZ.semilla(5 + m + n);
      const al = (k) => Array.from({ length: n }, () => 'acgt'[Math.floor(rnd() * k)]).join('');
      if (tipo === 'peor') return ['a'.repeat(n), 'a'.repeat(m - 1) + 'b'];
      if (tipo === 'per') return ['ab'.repeat(Math.ceil(n / 2)).slice(0, n), 'ab'.repeat(Math.floor((m - 1) / 2)) + 'c'];
      const q = tipo === 'bin' ? 2 : 4;
      return [al(q), Array.from({ length: m }, () => 'acgt'[Math.floor(rnd() * q)]).join('')];
    }
    function calcular() {
      datos = [];
      for (let n = 20; n <= 400; n += 20) { const [T, P] = generar(n); datos.push({ n, ing: A.ingenua(T, P).cmp, kmp: A.kmp(T, P).cmp }); }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mx = Math.max(...datos.map((d) => Math.max(d.ing, d.kmp)), 800);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 400, ymin: 0, ymax: mx * 1.05 }, { etiquetaX: 'n (largo del texto)', etiquetaY: 'comparaciones' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, 0], [400, 800]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.ing]), C.s2, 2);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.kmp]), C.s1, 2);
      if (hover != null) { const d = datos[hover]; VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d.ing), C.s2, 4.5); VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d.kmp), C.s1, 4.5); }
      const d = datos[hover != null ? hover : datos.length - 1];
      lectura.set([['n', String(d.n)], ['m', String(m)], ['ingenua', VIZ.entero(d.ing)], ['KMP', VIZ.entero(d.kmp)], ['cota 2n', VIZ.entero(2 * d.n)], ['ahorro', VIZ.fmt(d.ing / d.kmp, 3) + ' ×']]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(datos.length - 1, Math.round(plano.ix(x) / 20) - 1));
      dibujar();
      const d = datos[hover];
      tip.mostrar(x, y, `n = <b>${d.n}</b>` + VIZ.filaTooltip(C.s2, 'ingenua', VIZ.entero(d.ing)) + VIZ.filaTooltip(C.s1, 'KMP', VIZ.entero(d.kmp)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('kmp-search', {
    intro: String.raw`
      <p>El algoritmo de <strong>Knuth-Morris-Pratt</strong> (KMP) busca un patrón en un texto <em>sin retroceder nunca en el texto</em>. Cuando una comparación falla después de haber emparejado \(j\) caracteres, el patrón no vuelve a empezar: se desliza hasta alinear su <strong>borde más largo</strong>, porque se sabe que esa parte ya coincide con el texto.</p>
      <p>Esa información está en la función de prefijos \(\pi\) del patrón, que se calcula una vez en tiempo \(O(m)\). La búsqueda completa cuesta \(O(n + m)\), sin importar qué texto o patrón se den.</p>`,
    visualizaciones: [
      {
        titulo: 'KMP paso a paso',
        descripcion: 'Avance y observe que el puntero i del texto nunca retrocede: tras un fallo, el patrón se desliza según \\(\\pi\\) y se sigue comparando en el mismo i. Se detectan ocurrencias solapadas.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Ingenua frente a KMP',
        descripcion: 'Compare comparaciones en cuatro tipos de texto. En el peor caso la ingenua crece como \\(n \\cdot m\\) y KMP se queda bajo \\(2n\\).',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>π ← función de prefijos de p
j ← 0                                  // caracteres emparejados
para i ← 0 hasta n − 1:
    mientras j &gt; 0 y t[i] ≠ p[j]:  j ← π[j − 1]
    si t[i] = p[j]:  j ← j + 1
    si j = m:
        informar ocurrencia en i − m + 1
        j ← π[m − 1]</code></pre>
      <h2>Corrección</h2>
      <p><strong>Invariante.</strong> Después de procesar \(t_0 \cdots t_i\), \(j\) es el largo del mayor prefijo de \(p\) que es sufijo de \(t_0\cdots t_i\) (con \(j < m\)). Si \(p_0\cdots p_{j-1}\) es sufijo de lo leído y \(t_i \ne p_j\), el siguiente candidato debe ser un <em>borde</em> de \(p_0\cdots p_{j-1}\): el mayor es \(\pi[j-1]\). Ningún borde intermedio puede perderse, porque se obtienen todos encadenando \(\pi\). Así no se omite ninguna ocurrencia, ni siquiera las solapadas.</p>
      <h2>Costo</h2>
      <p>El puntero \(i\) avanza \(n\) veces. El valor \(j\) aumenta como máximo una vez por iteración del <em>para</em> y cada paso del <em>mientras</em> lo disminuye en al menos 1, de modo que los pasos del <em>mientras</em> son a lo más \(n\) en total (análisis amortizado). Por eso:</p>
      \[ \text{comparaciones} \le 2n - m, \qquad T(n, m) = \Theta(n + m), \qquad \text{memoria } \Theta(m). \]
      <table>
        <tr><th>Algoritmo</th><th>Preproceso</th><th>Búsqueda (peor caso)</th><th>Memoria extra</th></tr>
        <tr><td>Ingenua</td><td>—</td><td>\(\Theta(nm)\)</td><td>\(O(1)\)</td></tr>
        <tr><td>Autómata de búsqueda</td><td>\(O(m|\Sigma|)\)</td><td>\(\Theta(n)\)</td><td>\(O(m|\Sigma|)\)</td></tr>
        <tr><td>KMP</td><td>\(O(m)\)</td><td>\(\Theta(n)\)</td><td>\(O(m)\)</td></tr>
        <tr><td>Shift-And (bits)</td><td>\(O(m + |\Sigma|)\)</td><td>\(O(n\lceil m/W\rceil)\)</td><td>\(O(|\Sigma|)\) palabras</td></tr>
      </table>
      <h2>Conexiones</h2>
      <ul>
        <li>KMP es una simulación del <a href="tema.html?id=prefix-function">autómata de búsqueda</a> que compacta su tabla de transiciones en el arreglo \(\pi\) (los saltos «hacia atrás» del autómata).</li>
        <li>Es la versión determinista del AFN del patrón (<a href="tema.html?id=nfa-simulation">Simulating NFAs Efficiently</a>), siguiendo un único estado en lugar de un conjunto.</li>
        <li>El algoritmo de Aho-Corasick generaliza la idea a muchos patrones a la vez, con un autómata sobre un trie.</li>
      </ul>`,
  });
})();
