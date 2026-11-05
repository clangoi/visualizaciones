(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const EJ = [
    { nombre: 'Texto corriente', t: 'abracadabra y abracadabras', p: 'abra' },
    { nombre: 'ADN', t: 'ACGTACGGTACGTTACGTAC', p: 'ACGT' },
    { nombre: 'Peor caso: aaaa…b', t: 'aaaaaaaaaaaaaaaaaaaaaaaaa', p: 'aaaab' },
    { nombre: 'Mejor caso: primer carácter distinto', t: 'bbbbbbbbbbbbbbbbbbbbbbbbb', p: 'aaaab' },
  ];

  /* ---------- Fig. 1: deslizar el patrón ---------- */

  function montarBusqueda(cuerpo) {
    let t = EJ[0].t, p = EJ[0].p, r = null, k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplos', opciones: EJ.map((e, i) => [i, e.nombre]), valor: 0, alCambiar: (v) => { t = EJ[+v].t; p = EJ[+v].p; ct.valor = t; cp.valor = p; rep.reiniciar(); } });
    const ct = ctl.texto({ etiqueta: 'Texto (hasta 40)', valor: t, alCambiar: (v) => { t = v.slice(0, 40); rep.reiniciar(); }, alEnter: (v) => { t = v.slice(0, 40); rep.reiniciar(); } });
    const cp = ctl.texto({ etiqueta: 'Patrón', valor: p, alCambiar: (v) => { p = v.slice(0, 12); rep.reiniciar(); }, alEnter: (v) => { p = v.slice(0, 12); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 112 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'carácter coincide / ocurrencia' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'carácter no coincide' },
      { color: VIZ.alfa(C.s1, 0.2), borde: C.rejilla, texto: 'ya emparejado en esta ventana' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ante cada fallo el patrón se desliza una sola posición y se vuelve a comparar desde su primer carácter, olvidando todo lo que ya se había emparejado. Pruebe el «peor caso».');
    function iniciar() {
      r = A.ingenua(t, p); k = 0;
      return (function* () { for (let i = 1; i <= r.ev.length; i++) { k = i; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (!p || !t) { registro.textContent = 'Escriba un texto y un patrón.'; return; }
      const e = k ? r.ev[k - 1] : null, vistos = r.occ.filter((o) => r.ev.findIndex((x, idx) => idx < k && x.i === o && x.j === p.length - 1 && x.ok) >= 0);
      A.dibujarAlineado(ctx, W, t, p, e ? { inicio: e.i, j: e.j, ok: e.ok, i: e.i + e.j, occ: vistos } : { occ: [] });
      registro.textContent = !e ? 'Pulse «Un paso» o «Reproducir».' : `Ventana ${e.i}: compara texto[${e.i + e.j}] = «${t[e.i + e.j]}» con patrón[${e.j}] = «${p[e.j]}» → ${e.ok ? (e.j === p.length - 1 ? '¡ocurrencia completa!' : 'coincide, sigue') : 'no coincide: el patrón se desliza una posición'}.`;
      lectura.set([['n (texto)', String(t.length)], ['m (patrón)', String(p.length)], ['comparaciones', `${k} de ${r.cmp}`], ['ocurrencias', vistos.length ? vistos.join(', ') : 'ninguna aún'], ['cota (n − m + 1)·m', String(Math.max(0, t.length - p.length + 1) * p.length)]]);
    }
    lienzo.alDibujar = () => r && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: comparaciones según el tamaño ---------- */

  function montarCosto(cuerpo) {
    let m = 6, tipo = 'peor', datos = [], plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de texto', opciones: [['peor', 'peor caso: aaa…a con patrón aaa…ab'], ['alea', 'aleatorio binario'], ['mejor', 'mejor caso: nunca coincide el primer carácter']], valor: tipo, alCambiar: (v) => { tipo = v; calcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Largo del patrón m', min: 2, max: 20, valor: m, alCambiar: (v) => { m = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'comparaciones de la búsqueda ingenua', forma: 'linea' },
      { color: C.apagado, texto: 'cota n·m y referencia n', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con el peor caso el costo sigue la cota \\(n \\cdot m\\); con texto aleatorio es casi lineal (la mayoría de las ventanas fallan pronto); en el mejor caso es exactamente n − m + 1.');
    function calcular() {
      const rnd = VIZ.semilla(11 + m);
      datos = [];
      for (let n = 20; n <= 400; n += 20) {
        let T, P;
        if (tipo === 'peor') { T = 'a'.repeat(n); P = 'a'.repeat(m - 1) + 'b'; }
        else if (tipo === 'mejor') { T = 'b'.repeat(n); P = 'a'.repeat(m); }
        else { T = Array.from({ length: n }, () => (rnd() < 0.5 ? 'a' : 'b')).join(''); P = Array.from({ length: m }, () => (rnd() < 0.5 ? 'a' : 'b')).join(''); }
        datos.push({ n, cmp: A.ingenua(T, P).cmp, cota: Math.max(0, n - m + 1) * m });
      }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mx = Math.max(...datos.map((d) => Math.max(d.cmp, d.cota)));
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 400, ymin: 0, ymax: mx * 1.05 }, { etiquetaX: 'n (largo del texto)', etiquetaY: 'comparaciones' });
      plano.ejes();
      ctx.save(); ctx.setLineDash([3, 4]);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.cota]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.n]), C.apagado, 1.5, [3, 4]);
      ctx.restore();
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.cmp]), C.s2, 2);
      if (hover != null) { const d = datos[hover]; VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d.cmp), C.s2, 4.5); }
      const d = datos[hover != null ? hover : datos.length - 1];
      lectura.set([['n', String(d.n)], ['m', String(m)], ['comparaciones', VIZ.entero(d.cmp)], ['cota (n − m + 1)·m', VIZ.entero(d.cota)], ['comparaciones por carácter del texto', VIZ.fmt(d.cmp / d.n, 3)]]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(datos.length - 1, Math.round(plano.ix(x) / 20) - 1));
      dibujar();
      const d = datos[hover];
      tip.mostrar(x, y, `n = <b>${d.n}</b>` + VIZ.filaTooltip(C.s2, 'comparaciones', VIZ.entero(d.cmp)) + VIZ.filaTooltip(C.apagado, 'cota n·m', VIZ.entero(d.cota)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('naive-search', {
    intro: String.raw`
      <p>Buscar un <strong>patrón</strong> dentro de un <strong>texto</strong> es una de las tareas más frecuentes de la computación: un buscador, un editor, un antivirus, un análisis de ADN. El método más natural es el <em>ingenuo</em>: poner el patrón al principio del texto, comparar carácter a carácter y, si falla, correrlo una posición y empezar de nuevo.</p>
      <p>Es simple y suele ser rápido, pero tiene una debilidad: al fallar <strong>olvida</strong> todo lo que había emparejado, y en textos muy repetitivos vuelve a comparar los mismos caracteres una y otra vez.</p>`,
    visualizaciones: [
      {
        titulo: 'Deslizar el patrón sobre el texto',
        descripcion: 'Avance paso a paso: cada comparación se pinta verde o roja, y cada fallo desliza el patrón una posición. Pruebe el «peor caso» y cuente las comparaciones.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Cuántas comparaciones hace',
        descripcion: 'Compare el costo en el peor caso, con texto aleatorio y en el mejor caso. El peor sigue la cota \\(n \\cdot m\\).',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>para i ← 0 hasta n − m:
    j ← 0
    mientras j &lt; m y texto[i + j] = patrón[j]:
        j ← j + 1
    si j = m: informar ocurrencia en i</code></pre>
      <h2>Costo</h2>
      <table>
        <tr><th>Caso</th><th>Ejemplo</th><th>Comparaciones</th></tr>
        <tr><td>mejor</td><td>el primer carácter del patrón nunca aparece</td><td>\(n - m + 1\)</td></tr>
        <tr><td>aleatorio</td><td>texto y patrón al azar sobre un alfabeto de tamaño \(\sigma\)</td><td>\(\approx n\,\dfrac{\sigma}{\sigma - 1}\)</td></tr>
        <tr><td>peor</td><td>\(a^n\) con patrón \(a^{m-1}b\)</td><td>\((n - m + 1)\,m = \Theta(nm)\)</td></tr>
      </table>
      <p>Con un alfabeto de tamaño \(\sigma\), una ventana avanza en promedio \(\sum_{j \ge 0} \sigma^{-j} = \tfrac{\sigma}{\sigma - 1}\) comparaciones antes de fallar. Por eso en la práctica el método ingenuo parece lineal, hasta que aparece un texto repetitivo.</p>
      <h2>Qué se desperdicia</h2>
      <p>Si el patrón es <code>aaaab</code> y se emparejaron <code>aaaa</code> antes de fallar, se <em>sabe</em> qué hay en esas cuatro posiciones del texto. El método ingenuo lo olvida y, tras el desplazamiento, vuelve a leerlas. Dos ideas lo corrigen:</p>
      <ul>
        <li>construir un <strong>autómata</strong> del patrón que consume cada carácter del texto exactamente una vez (<a href="tema.html?id=prefix-function">Borders &amp; the Prefix Function</a>);</li>
        <li>guardar solo la información necesaria como una tabla de <em>bordes</em> y desplazar el patrón lo máximo seguro: <a href="tema.html?id=kmp-search">Knuth-Morris-Pratt</a>.</li>
      </ul>
      <div class="recuadro"><p>Otros algoritmos de búsqueda de cadenas: Boyer-Moore (compara de derecha a izquierda y puede saltar \(m\) posiciones; sublineal en promedio), Rabin-Karp (huellas con hashing) y Aho-Corasick (muchos patrones a la vez con un autómata).</p></div>`,
  });
})();
