(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const POR_PAG = 2;
  const R0 = [101, 104, 102, 106, 103, 105, 107, 110, 108, 109, 111, 112];
  const S0 = [104, 101, 106, 103, 106, 101, 102, 112, 109, 107];
  const paginas = (v) => Array.from({ length: Math.ceil(v.length / POR_PAG) }, (_, i) => v.slice(i * POR_PAG, (i + 1) * POR_PAG));

  /* ---------- Fig. 1: bloques de B − 2 páginas ---------- */

  function montarBloques(cuerpo) {
    let Bm = 4, bloque = [], pagS = -1, lecturas = 0, pares = [], mensaje = '', nBloque = 0;
    const PR = paginas(R0), PS = paginas(S0);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Marcos de buffer B', min: 3, max: 8, valor: Bm, alCambiar: (v) => { Bm = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 244 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'bloque de R en memoria (B − 2 marcos)' },
      { color: C.s2, texto: 'página de S que se recorre (1 marco)' },
      { color: C.s6, texto: 'tupla con pareja en el bloque' },
      { color: C.apagado, texto: 'marco de salida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const caja = B.grupoTablas(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso lee una página de S y la compara con todo el bloque de R a la vez. Suba B: hay menos bloques y S se recorre menos veces.');

    function iniciar() {
      bloque = []; pagS = -1; lecturas = 0; pares = []; nBloque = 0;
      mensaje = `R: ${PR.length} páginas, S: ${PS.length} páginas. Con B = ${Bm}: ${Bm - 2} marcos para el bloque de R, 1 para S y 1 para la salida.`;
      return (function* () {
        for (let b = 0; b < PR.length; b += Bm - 2) {
          bloque = []; nBloque++;
          for (let p = b; p < Math.min(PR.length, b + Bm - 2); p++) { bloque.push(p); lecturas++; }
          pagS = -1;
          mensaje = `Bloque ${nBloque}: se cargan las páginas ${bloque.map((p) => p + 1).join(', ')} de R (${bloque.length} lecturas) y se arma una tabla hash con sus tuplas.`;
          yield;
          const enBloque = new Set(bloque.flatMap((p) => PR[p]));
          for (let s = 0; s < PS.length; s++) {
            pagS = s; lecturas++;
            const nuevos = PS[s].filter((v) => enBloque.has(v));
            nuevos.forEach((v) => pares.push(v));
            mensaje = `Página ${s + 1} de S: ${PS[s].join(', ')} → ${nuevos.length ? `coinciden ${nuevos.join(', ')}` : 'sin coincidencias en este bloque'}.`;
            yield;
          }
        }
        pagS = -1; bloque = [];
        mensaje = `Fin: S se recorrió ${nBloque} ${nBloque === 1 ? 'vez' : 'veces'}; ${lecturas} lecturas en total.`;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const pw = Math.min(64, (W - 30) / Math.max(PR.length, PS.length) - 6), ph = 40;
      const fila = (y, P, nombre, color, activa, marcadas) => {
        B.texto(ctx, nombre, 10, y - 10, { px: 10, color: C.apagado });
        P.forEach((pg, p) => {
          const x = 10 + p * (pw + 6);
          const act = activa(p);
          B.pagina(ctx, x, y, pw, ph, pg.map((v) => ({ texto: v, color: marcadas && marcadas(v, p) ? C.s6 : act ? color : null })), { capacidad: POR_PAG, borde: act ? color : C.inactivo, grosor: act ? 3 : 1.5 });
        });
      };
      fila(24, PR, 'R en disco', C.s1, (p) => bloque.includes(p));
      fila(24 + ph + 34, PS, 'S en disco', C.s2, (p) => p === pagS, (v, p) => p === pagS && bloque.some((q) => PR[q].includes(v)));
      // Buffer.
      const y = 36 + 2 * (ph + 34), mw = Math.min(70, (W - 20) / Bm - 8);
      B.texto(ctx, `buffer: B = ${Bm} marcos`, 10, y - 24, { px: 10, color: C.apagado });
      for (let i = 0; i < Bm; i++) {
        const x = 10 + i * (mw + 8);
        let items = [], col = C.inactivo, et = '';
        if (i < Bm - 2) { const p = bloque[i]; if (p != null) items = PR[p].map((v) => ({ texto: v, color: C.s1 })); col = C.s1; et = 'R'; }
        else if (i === Bm - 2) { if (pagS >= 0) items = PS[pagS].map((v) => ({ texto: v, color: C.s2 })); col = C.s2; et = 'S'; }
        else { col = C.apagado; et = 'salida'; }
        B.pagina(ctx, x, y, mw, ph, items, { capacidad: POR_PAG, borde: col, etiqueta: et, tintaEtiqueta: col });
      }
      registro.textContent = mensaje;
      caja.replaceChildren(B.tabla(B.rel('salida', ['a'], pares.map((v) => [v])), { maxFilas: 6, vacio: '(sin pares aún)' }));
      const M = PR.length, N = PS.length;
      lectura.set([
        ['lecturas medidas', String(lecturas)],
        ['M + ⌈M/(B−2)⌉·N', String(M + Math.ceil(M / (Bm - 2)) * N)],
        ['página a página: M + M·N', String(M + M * N)],
        ['recorridos de S', String(Math.ceil(M / (Bm - 2)))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: costo según el tamaño del buffer ---------- */

  function montarCosto(cuerpo) {
    let M = 1000, N = 500, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Páginas de R (M)', min: 100, max: 5000, paso: 100, valor: M, formato: VIZ.entero, alCambiar: (v) => { M = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Páginas de S (N)', min: 100, max: 5000, paso: 100, valor: N, formato: VIZ.entero, alCambiar: (v) => { N = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'BNLJ con R afuera', forma: 'linea' },
      { color: C.s2, texto: 'BNLJ con S afuera', forma: 'linea' },
      { color: C.apagado, texto: 'página a página (B = 3)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico. Pase el cursor para leer el costo con cada tamaño de buffer.');
    const bn = (ext, int, b) => ext + Math.ceil(ext / (b - 2)) * int;
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const bmax = Math.max(M, N) + 2;
      plano = VIZ.plano(lienzo, { xmin: Math.log10(3), xmax: Math.log10(bmax * 1.3), ymin: M + N - 1, ymax: (M + M * N) * 1.5 }, {
        logY: true, etiquetaX: 'marcos de buffer B', etiquetaY: 'lecturas de páginas',
        ticksX: [3, 10, 30, 100, 300, 1000, 3000].filter((v) => v <= bmax * 1.3).map(Math.log10), formatoX: (v) => VIZ.entero(10 ** v), formatoY: (v) => (v < 1e6 ? VIZ.entero(v) : VIZ.fmt(v)),
      });
      plano.ejes();
      const serie = (f, c, g) => {
        const pts = [];
        for (let e = Math.log10(3); e <= Math.log10(bmax * 1.3); e += 0.01) pts.push([e, f(Math.round(10 ** e))]);
        VIZ.trazar(ctx, plano, pts, c, 2, g);
      };
      ctx.save(); plano.recortar();
      serie(() => M + M * N, C.apagado, [3, 4]);
      serie((b) => bn(M, N, b), C.s1);
      serie((b) => bn(N, M, b), C.s2);
      ctx.restore();
      if (hover) { VIZ.marcador(ctx, plano.sx(Math.log10(hover)), plano.sy(bn(M, N, hover)), C.s1, 4); VIZ.marcador(ctx, plano.sx(Math.log10(hover)), plano.sy(bn(N, M, hover)), C.s2, 4); }
      const menor = Math.min(M, N);
      lectura.set([
        ['con B = 102', VIZ.entero(Math.min(bn(M, N, 102), bn(N, M, 102)))],
        ['B para leer cada una una vez', VIZ.entero(menor + 2)],
        ['mínimo posible M + N', VIZ.entero(M + N)],
        ['conviene afuera', M <= N ? 'R (la más chica)' : 'S (la más chica)'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(3, Math.round(10 ** plano.ix(x))); dibujar();
      tip.mostrar(x, y, `B = <b>${VIZ.entero(hover)}</b>` + VIZ.filaTooltip(C.s1, 'R afuera', VIZ.entero(bn(M, N, hover))) + VIZ.filaTooltip(C.s2, 'S afuera', VIZ.entero(bn(N, M, hover))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('block-nested-loop-join', {
    intro: String.raw`
      <p>El <a href="tema.html?id=nested-loop-join">nested loop join</a> página a página usa solo tres marcos de buffer: uno para \(R\), uno
      para \(S\) y uno para la salida. Si hay \(B\) marcos disponibles, desperdicia casi toda la memoria.</p>
      <p>El <strong>block nested loop join</strong> usa \(B - 2\) marcos para cargar un <em>bloque</em> de páginas de la relación externa y
      recorre la interna una vez por bloque en vez de una vez por página. Si la relación externa cabe entera en el buffer, cada relación se
      lee exactamente una vez.</p>`,
    visualizaciones: [
      {
        titulo: 'Bloques en el buffer',
        descripcion: 'R tiene 6 páginas y S tiene 5. Cambie B y cuente cuántas veces se recorre S. Con B = 8 todo R cabe en un bloque.',
        montar: montarBloques,
      },
      {
        titulo: 'Costo según el tamaño del buffer',
        descripcion: 'Lecturas totales al crecer B. El costo baja como 1/(B − 2) hasta llegar a M + N, cuando la relación más chica cabe completa en memoria.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>para cada bloque de B − 2 páginas de R:
    cargar el bloque y construir una tabla hash sobre el atributo de junta
    para cada página P_S de S:
        para cada s en P_S:
            para cada r en hash[s.a]:  emitir (r, s)</code></pre>
      <p>La tabla hash sobre el bloque evita comparar cada \(s\) con todas las tuplas del bloque; sin ella, el costo en E/S es el mismo pero
      el de CPU es mucho mayor. Para condiciones que no son igualdades, se compara con todo el bloque.</p>

      <h2>Costo</h2>
      <p>Con \(M\) páginas en \(R\) (externa), \(N\) en \(S\):</p>
      \[ \text{costo} = M + \left\lceil \frac{M}{B - 2} \right\rceil \cdot N. \]
      <p>Con \(M = 1\,000\), \(N = 500\) y \(B = 102\): \(1\,000 + 10 \cdot 500 = 6\,000\) lecturas, frente a \(501\,000\) de la versión página
      a página. Si \(B - 2 \ge \min(M, N)\), basta con poner afuera la relación más chica y el costo es \(M + N\), el mínimo posible: hay que
      leer cada relación al menos una vez.</p>
      <div class="recuadro">La relación externa debe ser la más chica: \(\lceil M/(B-2)\rceil \cdot N\) es menor cuando \(M\) es la menor
      de las dos. Además, conviene leer la interna alternando el sentido del recorrido (de ida y de vuelta): así la última página leída
      sigue en el buffer al empezar el siguiente bloque.</div>

      <h2>Comparación con otras juntas</h2>
      <table>
        <tr><th>Algoritmo</th><th>Costo (E/S)</th><th>Requiere</th></tr>
        <tr><td>página a página</td><td>\(M + MN\)</td><td>3 marcos</td></tr>
        <tr><td>block nested loop</td><td>\(M + \lceil M/(B-2)\rceil N\)</td><td>\(B\) marcos</td></tr>
        <tr><td>index nested loop</td><td>\(M + |R| \cdot c_{\text{índice}}\)</td><td>índice sobre \(S\)</td></tr>
        <tr><td>sort-merge</td><td>\(\approx 5(M + N)\)</td><td>junta de igualdad</td></tr>
        <tr><td>hash join (Grace)</td><td>\(3(M + N)\)</td><td>igualdad, \(B &gt; \sqrt{M}\)</td></tr>
      </table>
      <p>El optimizador elige entre ellos con las estadísticas del catálogo; BNLJ sigue siendo la opción para condiciones arbitrarias y
      cuando una relación es pequeña.</p>`,
  });
})();
