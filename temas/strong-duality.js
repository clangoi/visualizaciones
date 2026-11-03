(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* ---------- Ayudantes ---------- */

  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  const nom = (s) => s.replace(/\d+/g, (d) => d.replace(/\d/g, (k) => SUBS[k]));
  const trans = (A) => A[0].map((_, j) => A.map((f) => f[j]));
  const dot = (u, v) => u.reduce((s, a, k) => s + a * v[k], 0);
  const limpio = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
  const par = (v, d = 3) => `(${v.map((q) => VIZ.fmt(limpio(q), d)).join(', ')})`;

  function lpSeguro(c, A, sen, b, max) {
    const r = O.lp(c, A, sen, b, { max });
    if (r.estado !== 'noacotado') return r;
    const f = O.lp(c.map(() => 0), A, sen, b, { max: true });
    return f.estado === 'optimo' ? r : { estado: 'infactible' };
  }
  function resolverPar(K) {
    const m = K.A.length, n = K.c.length;
    return {
      p: lpSeguro(K.c, K.A, Array(m).fill('<='), K.b, true),
      d: lpSeguro(K.b, trans(K.A), Array(n).fill('>='), K.c, false),
    };
  }
  const factibleDual = (K, y) => y.every((v) => v >= -1e-9) && trans(K.A).every((a, j) => dot(a, y) >= K.c[j] - 1e-9);
  const poliPrimal = (K, W) => O.poligono([...K.A.map((a, i) => ({ a, b: K.b[i] })), { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }], W);
  const poliDual = (K, W) => O.poligono([...trans(K.A).map((a, j) => ({ a: a.map((v) => -v), b: -K.c[j] })), { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }], W);
  const estadoTexto = (r) => (r.estado === 'optimo' ? VIZ.fmt(r.z) : r.estado === 'noacotado' ? 'no acotado' : 'infactible');

  function recta(ctx, p, a, b, color, ancho, guion) {
    const d = p.d, pts = [];
    if (Math.abs(a[1]) > 1e-9) for (const x of [d.xmin, d.xmax]) pts.push([x, (b - a[0] * x) / a[1]]);
    else pts.push([b / a[0], d.ymin], [b / a[0], d.ymax]);
    VIZ.trazar(ctx, p, pts, color, ancho, guion);
  }

  function panel(padre, nombres, colorR) {
    const l = VIZ.lienzo(padre, { proporcion: 0.85, altoMin: 230, altoMax: 380 });
    const tip = VIZ.tooltip(l);
    const e = { l, W: null, poli: [], rectas: [], extra: null, p: null, tooltip: null };
    e.dibujar = () => {
      if (!e.W) return;
      const { ctx } = l;
      l.limpiar();
      const p = e.p = VIZ.plano(l, e.W, { etiquetaX: nombres[0], etiquetaY: nombres[1] });
      p.ejes();
      ctx.save();
      p.recortar();
      ctx.strokeStyle = C.eje;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.sx(0) + 0.5, p.y0); ctx.lineTo(p.sx(0) + 0.5, p.y1);
      ctx.moveTo(p.x0, p.sy(0) + 0.5); ctx.lineTo(p.x1, p.sy(0) + 0.5);
      ctx.stroke();
      if (e.poli.length >= 3) {
        ctx.beginPath();
        e.poli.forEach(([x, y], k) => (k ? ctx.lineTo(p.sx(x), p.sy(y)) : ctx.moveTo(p.sx(x), p.sy(y))));
        ctx.closePath();
        ctx.fillStyle = VIZ.alfa(colorR, 0.2);
        ctx.fill();
      }
      e.rectas.forEach((r) => recta(ctx, p, r.a, r.b, C.tinta2, 1.5, [6, 4]));
      ctx.restore();
      if (e.extra) e.extra(ctx, p);
    };
    l.alDibujar = e.dibujar;
    l.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l.posicion(ev);
      if (!e.p || !e.p.dentro(x, y) || !e.tooltip) return tip.ocultar();
      tip.mostrar(x, y, e.tooltip([e.p.ix(x), e.p.iy(y)]));
    });
    l.canvas.addEventListener('pointerleave', () => tip.ocultar());
    return e;
  }

  function aviso(ctx, p, texto, color) {
    ctx.font = VIZ.fuente(11);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(texto, p.x0 + 8, p.y1 + 6);
  }

  /* ---------- Fig. 1: Simplex resuelve los dos problemas a la vez ---------- */

  function montarSimplex(cuerpo) {
    const A = [[1, 2], [3, 1]];
    let c = [2, 3], b = [8, 9], regla = 'dantzig', hist = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Regla de entrada', opciones: [['dantzig', 'Mayor costo reducido'], ['bland', 'Menor índice (Bland)']], valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'c₁', min: 1, max: 6, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'c₂', min: 1, max: 6, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'b₁', min: 4, max: 12, paso: 0.5, valor: b[0], alCambiar: (v) => { b[0] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'b₂', min: 4, max: 12, paso: 0.5, valor: b[1], alCambiar: (v) => { b[1] = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const cols = VIZ.el('div', { class: 'dos-columnas' });
    const izq = VIZ.el('div'), der = VIZ.el('div');
    cols.append(izq, der);
    cuerpo.appendChild(cols);
    VIZ.subtitulo(izq, 'Primal: vértices que recorre el Simplex');
    const pp = panel(izq, ['x₁', 'x₂'], C.s1);
    VIZ.subtitulo(der, 'Dual: y leído de la fila z');
    const pd = panel(der, ['y₁', 'y₂'], C.s2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región del primal / camino x' },
      { color: C.s2, texto: 'región del dual / valores de y' },
      { color: C.s7, texto: 'iterado actual', forma: 'punto' },
      { color: C.s8, texto: 'y todavía no factible (hueco)', forma: 'punto' },
      { color: C.s6, texto: 'par óptimo', forma: 'punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» y observe: el valor cᵀx sube en cada vértice y coincide en todo momento con bᵀy, pero y solo es factible para el dual cuando el tablero es óptimo; entonces las dos cotas se encuentran.');

    function iniciar() {
      const g = O.simplex(c, A, b, { regla });
      hist = [g.next().value];
      return (function* () {
        for (let r = g.next(); !r.done; r = g.next()) { hist.push(r.value); yield; }
      })();
    }
    const K = () => ({ A, b, c });
    function dibujar() {
      const s = hist[hist.length - 1], Q = K(), fin = s.estado === 'optimo';
      pp.W = { xmin: 0, xmax: 8, ymin: 0, ymax: 8 };
      pd.W = { xmin: -2, xmax: 8, ymin: -2, ymax: 8 };
      pp.poli = poliPrimal(Q, { xmin: 0, xmax: 8, ymin: 0, ymax: 8 });
      pd.poli = poliDual(Q, { xmin: 0, xmax: 8, ymin: 0, ymax: 8 });
      pp.rectas = A.map((a, i) => ({ a, b: b[i] }));
      pd.rectas = trans(A).map((a, j) => ({ a, b: c[j] }));
      pp.extra = (ctx, p) => {
        VIZ.trazar(ctx, p, hist.map((h) => h.x), C.s1, 3);
        hist.forEach((h, k) => VIZ.marcador(ctx, p.sx(h.x[0]), p.sy(h.x[1]), k === hist.length - 1 ? (fin ? C.s6 : C.s7) : C.s1, k === hist.length - 1 ? 6.5 : 4.5));
      };
      pd.extra = (ctx, p) => {
        VIZ.trazar(ctx, p, hist.map((h) => h.duales), C.s2, 2, [4, 3]);
        hist.forEach((h, k) => {
          const ok = factibleDual(Q, h.duales), ult = k === hist.length - 1;
          const px = p.sx(h.duales[0]), py = p.sy(h.duales[1]);
          if (ok) VIZ.marcador(ctx, px, py, ult ? (fin ? C.s6 : C.s7) : C.s2, ult ? 6.5 : 4.5);
          else {
            ctx.save(); ctx.fillStyle = C.superficie; ctx.strokeStyle = ult ? C.s7 : C.s8; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, ult ? 6.5 : 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
          }
        });
      };
      pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>cᵀx = <b>${VIZ.fmt(dot(c, q))}</b>`;
      pd.tooltip = (q) => `y = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>bᵀy = <b>${VIZ.fmt(dot(b, q))}</b><br>${factibleDual(Q, q) ? 'factible' : 'no factible'}`;
      pp.dibujar(); pd.dibujar();

      // Tablero
      const m = 2, n = 2, T = s.T;
      const cab = ['base', ...s.nombres.map(nom), 'derecha', 'razón'];
      const filas = [];
      for (let i = 0; i <= m; i++) {
        const celdas = [VIZ.el('td', { class: 'izq' }, i < m ? nom(s.nombres[s.base[i]]) : 'z')];
        T[i].forEach((v, j) => {
          const pivote = s.estado === 'iterando' && i === s.sale && j === s.entra;
          celdas.push(VIZ.el('td', { style: pivote ? { background: VIZ.alfa(C.s7, 0.35), fontWeight: 600 } : null }, VIZ.fmt(limpio(v), 3)));
        });
        celdas.push(VIZ.el('td', null, i < m && s.estado === 'iterando' && Number.isFinite(s.razones[i]) ? VIZ.fmt(s.razones[i], 3) : '—'));
        filas.push(VIZ.el('tr', { class: i === s.sale && s.estado === 'iterando' ? 'activa' : null }, ...celdas));
      }
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, cab.map((h, j) => VIZ.el('th', { class: j === 0 ? 'izq' : null }, h)))),
        VIZ.el('tbody', null, filas)));
      void n;

      const cx = dot(c, s.x), by = dot(b, s.duales), fy = factibleDual(Q, s.duales);
      if (s.estado === 'iterando') {
        registro.textContent = `Iteración ${s.it + 1}: entra ${nom(s.nombres[s.entra])} (costo reducido ${VIZ.fmt(limpio(T[m][s.entra]), 3)}) y sale ${nom(s.nombres[s.base[s.sale]])} (razón mínima ${VIZ.fmt(s.razones[s.sale], 3)}). Ahora x = ${par(s.x)}, y = ${par(s.duales)}: bᵀy = cᵀx = ${VIZ.fmt(cx)}, pero y ${fy ? 'ya es factible' : 'aún viola alguna restricción dual'}.`;
      } else {
        registro.textContent = `Óptimo: ningún costo reducido es negativo. x* = ${par(s.x)} y y* = ${par(s.duales)} (la fila z bajo las holguras) son factibles y valen lo mismo: cᵀx* = bᵀy* = ${VIZ.fmt(cx)}.`;
      }
      lectura.set([
        ['iteración', String(s.it)],
        ['cᵀx', VIZ.fmt(cx)],
        ['bᵀy', VIZ.fmt(by)],
        ['¿y factible?', fy ? 'sí' : 'no'],
        ['estado', fin ? 'óptimo' : 'iterando'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: los casos posibles ---------- */

  const PRESETS = {
    optimo: { nombre: 'Óptimo en ambos', A: [[1, 2], [3, 1]], c: [2, 3], b: [8, 9], Wp: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
    noacotado: { nombre: 'Primal no acotado', A: [[1, -1], [-1, 1]], c: [1, 1], b: [2, 2], Wp: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 }, Wd: { xmin: 0, xmax: 6, ymin: 0, ymax: 6 } },
    dualnoac: { nombre: 'Dual no acotado', A: [[1, 1], [-1, -1]], c: [1, 1], b: [4, -6], Wp: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
    ambos: { nombre: 'Ambos infactibles', A: [[1, -1], [-1, 1]], c: [1, 1], b: [1, -2], Wp: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
  };
  const CASOS = [
    ['oo', 'óptimo', 'óptimo', 'los valores son iguales'],
    ['nd', 'no acotado', 'infactible', 'el dual no tiene puntos factibles'],
    ['dn', 'infactible', 'no acotado', 'el primal no tiene puntos factibles'],
    ['ii', 'infactible', 'infactible', 'ninguno tiene puntos factibles'],
  ];

  function montarCasos(cuerpo) {
    let K = { ...PRESETS.optimo, c: PRESETS.optimo.c.slice(), b: PRESETS.optimo.b.slice() }, sol = resolverPar(K);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplo de partida', opciones: Object.entries(PRESETS).map(([k, p]) => [k, p.nombre]), valor: 'optimo',
      alCambiar: (v) => {
        const P = PRESETS[v];
        K = { ...P, c: P.c.slice(), b: P.b.slice() };
        sc1.valor = K.c[0]; sc2.valor = K.c[1]; sb1.valor = K.b[0]; sb2.valor = K.b[1];
        actualizar();
      } });
    const cambiar = (campo, i) => (v) => { K[campo][i] = v; actualizar(); };
    const sc1 = ctl.rango({ etiqueta: 'c₁', min: -5, max: 8, paso: 0.5, valor: K.c[0], alCambiar: cambiar('c', 0) });
    const sc2 = ctl.rango({ etiqueta: 'c₂', min: -5, max: 8, paso: 0.5, valor: K.c[1], alCambiar: cambiar('c', 1) });
    const sb1 = ctl.rango({ etiqueta: 'b₁', min: -8, max: 12, paso: 0.5, valor: K.b[0], alCambiar: cambiar('b', 0) });
    const sb2 = ctl.rango({ etiqueta: 'b₂', min: -8, max: 12, paso: 0.5, valor: K.b[1], alCambiar: cambiar('b', 1) });

    const cols = VIZ.el('div', { class: 'dos-columnas' });
    const izq = VIZ.el('div'), der = VIZ.el('div');
    cols.append(izq, der);
    cuerpo.appendChild(cols);
    VIZ.subtitulo(izq, 'Primal');
    const pp = panel(izq, ['x₁', 'x₂'], C.s1);
    VIZ.subtitulo(der, 'Dual');
    const pd = panel(der, ['y₁', 'y₂'], C.s2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región factible del primal' },
      { color: C.s2, texto: 'región factible del dual' },
      { color: C.tinta2, texto: 'frontera de una restricción', forma: 'linea' },
      { color: C.s6, texto: 'solución óptima', forma: 'punto' },
      { color: C.s8, texto: 'región vacía o sin óptimo' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Parta de un ejemplo y mueva c y b para pasar de un caso a otro: nunca aparece «primal óptimo y dual no acotado», ni ningún par con un solo problema infactible y el otro óptimo.');

    const clase = (r) => (r.estado === 'optimo' ? 'óptimo' : r.estado === 'noacotado' ? 'no acotado' : 'infactible');
    function actualizar() {
      sol = resolverPar(K);
      const W = { xmin: 0, xmax: 12, ymin: 0, ymax: 12 };
      pp.W = K.Wp; pd.W = K.Wd;
      pp.poli = poliPrimal(K, { ...W, xmax: K.Wp.xmax, ymax: K.Wp.ymax });
      pd.poli = poliDual(K, { ...W, xmax: K.Wd.xmax, ymax: K.Wd.ymax });
      pp.rectas = K.A.map((a, i) => ({ a, b: K.b[i] }));
      pd.rectas = trans(K.A).map((a, j) => ({ a, b: K.c[j] }));
      const extra = (r, nombre) => (ctx, p) => {
        if (r.estado === 'optimo') VIZ.marcador(ctx, p.sx(r.x[0]), p.sy(r.x[1]), C.s6, 6.5);
        else aviso(ctx, p, r.estado === 'noacotado' ? `${nombre}: objetivo no acotado` : `${nombre}: región vacía`, C.s8);
      };
      pp.extra = extra(sol.p, 'primal'); pd.extra = extra(sol.d, 'dual');
      pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>cᵀx = <b>${VIZ.fmt(dot(K.c, q))}</b>`;
      pd.tooltip = (q) => `y = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>bᵀy = <b>${VIZ.fmt(dot(K.b, q))}</b>`;
      pp.dibujar(); pd.dibujar();

      const cp = clase(sol.p), cd = clase(sol.d);
      const actual = CASOS.find((q) => q[1] === cp && q[2] === cd);
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['Primal', 'Dual', 'Qué ocurre'].map((h) => VIZ.el('th', null, h)))),
        VIZ.el('tbody', null, CASOS.map((q) => VIZ.el('tr', { class: actual && actual[0] === q[0] ? 'activa' : null }, VIZ.el('td', null, q[1]), VIZ.el('td', null, q[2]), VIZ.el('td', null, q[3]))))));
      registro.textContent = actual
        ? (actual[0] === 'oo'
          ? `Ambos tienen óptimo y el mismo valor: ${VIZ.fmt(sol.p.z)}.`
          : `Caso «${cp} / ${cd}»: ${actual[3]}.`)
        : `Combinación ${cp} / ${cd}: la dualidad fuerte la excluye.`;
      lectura.set([
        ['primal', estadoTexto(sol.p)],
        ['dual', estadoTexto(sol.d)],
        ['diferencia', sol.p.estado === 'optimo' && sol.d.estado === 'optimo' ? VIZ.fmt(Math.abs(sol.p.z - sol.d.z)) : '—'],
        ['x*', sol.p.estado === 'optimo' ? par(sol.p.x) : '—'],
        ['y*', sol.d.estado === 'optimo' ? par(sol.d.x) : '—'],
      ]);
    }
    actualizar();
  }

  VIZ.registrarTema('strong-duality', {
    intro: String.raw`
      <p>La <strong>dualidad fuerte</strong> dice que la brecha de la dualidad débil puede cerrarse del todo: si uno de los dos
      problemas tiene óptimo, el otro también, y los valores óptimos son iguales. Las cotas superiores que producen las
      soluciones duales y las cotas inferiores de las soluciones primales terminan encontrándose en un mismo número.</p>
      <p>No es un lujo teórico: el método Simplex entrega las dos soluciones a la vez. Los números de la fila \(z\) bajo las
      variables de holgura son, en el tablero óptimo, las variables duales.</p>`,
    visualizaciones: [
      {
        titulo: 'Simplex resuelve primal y dual a la vez',
        descripcion: 'Avance paso a paso: el camino de x recorre vértices del primal mientras y, leído de la fila z, salta por el plano del dual. Observe que bᵀy = cᵀx en cada iteración, que y es infactible hasta el final y que en el óptimo cae en un vértice de la región dual.',
        montar: montarSimplex,
      },
      {
        titulo: 'Los casos posibles',
        descripcion: 'Elija un ejemplo y mueva c y b hasta que el problema cambie de tipo. Solo aparecen cuatro combinaciones; pruebe a encontrar una con un problema óptimo y el otro no.',
        montar: montarCasos,
      },
    ],
    teoria: String.raw`
      <h2>Enunciado</h2>
      <div class="recuadro"><p><strong>Teorema (dualidad fuerte).</strong> Si el primal (P) tiene una solución óptima \(x^*\), entonces el
      dual (D) tiene una solución óptima \(y^*\) y \(c^\top x^* = b^\top y^*\).</p></div>
      <p>Combinado con la <a href="tema.html?id=weak-duality">dualidad débil</a>, deja solo cuatro posibilidades para el par
      (P), (D):</p>
      <table>
        <thead><tr><th>Primal</th><th>Dual</th><th>Comentario</th></tr></thead>
        <tbody>
          <tr><td>óptimo</td><td>óptimo</td><td>valores iguales</td></tr>
          <tr><td>no acotado</td><td>infactible</td><td>la débil impide un \(y\) factible</td></tr>
          <tr><td>infactible</td><td>no acotado</td><td>simétrico al anterior</td></tr>
          <tr><td>infactible</td><td>infactible</td><td>posible, pero raro</td></tr>
        </tbody>
      </table>
      <p>Nunca ocurre que uno tenga óptimo y el otro no.</p>

      <h2>Cómo lo entrega el Simplex</h2>
      <p>Sea \(B\) la base final de (P) en forma estándar (ver <a href="tema.html?id=standard-form">Standard Form and Slack Variables</a>)
      y \(y^\top = c_B^\top B^{-1}\). Los costos reducidos son \(c_j - y^\top a_j\). En el óptimo todos son \(\le 0\) (en máximo), es decir
      \(A^\top y \ge c\), y los de las holguras dicen \(y \ge 0\): \(y\) es factible para (D). Además
      \(b^\top y = c_B^\top B^{-1} b = c_B^\top x_B = c^\top x^*\), con lo que la brecha es cero. En cada tablero intermedio también
      vale \(b^\top y = c^\top x\), pero algún costo reducido tiene el signo equivocado y \(y\) es infactible; es lo que muestra la
      primera figura.</p>
      <pre><code>resolver_con_simplex(c, A, b):
    llevar el problema a forma estándar y obtener una base factible B
    repetir:
        y ← c_B · B⁻¹                      (se lee en la fila z, bajo las holguras)
        si todos los costos reducidos cumplen la condición de óptimo:
            devolver x_B = B⁻¹ b,  y
        elegir variable que entra y variable que sale (prueba de la razón)
        pivotear</code></pre>

      <h2>Ejemplo resuelto</h2>
      <p>Para \(\max\, 2x_1 + 3x_2\) s.a. \(x_1 + 2x_2 \le 8,\ 3x_1 + x_2 \le 9\), el Simplex parte de \(x = (0,0)\), \(y = (0,0)\).
      Entra \(x_2\) (costo reducido \(-3\)); la razón mínima es \(8/2 = 4\) contra \(9/1 = 9\), así que sale \(s_1\) y se llega a
      \(x = (0,4)\) con \(z = 12\) y \(y = (3/2,\,0)\), que todavía viola \(y_1 + 3y_2 \ge 2\) (da \(3/2\)) y por eso es infactible para el dual, aunque \(b^\top y = 12\) coincide con \(c^\top x\).
      Después entra \(x_1\), sale \(s_2\) y se llega a \(x^* = (2,3)\), \(z^* = 13\), \(y^* = (7/5, 1/5)\), que cumple
      \(y_1 + 3y_2 = 2\) y \(2y_1 + y_2 = 3\). Aquí \(c^\top x^* = 13 = b^\top y^*\).</p>

      <h2>Por qué ocurre: separación de convexos</h2>
      <p>La demostración clásica usa el lema de Farkas (ver <a href="tema.html?id=optimality-certificates">Optimality Certificates</a>): si no
      existiera \(y \ge 0\) con \(A^\top y \ge c\) y \(b^\top y \le z^*\), un hiperplano separaría el punto \(z^*\) del cono generado por las
      restricciones, lo que contradice la optimalidad de \(x^*\). Geométricamente, en el óptimo el gradiente \(c\) es una combinación
      no negativa de las normales de las restricciones activas, y los coeficientes de esa combinación son \(y^*\)
      (<a href="tema.html?id=optimal-solution-geometry">Geometry of Optimal Solutions</a>).</p>

      <h2>Consecuencias</h2>
      <ul>
        <li>Se puede resolver el problema más cómodo de los dos (menos restricciones) y recuperar el otro.</li>
        <li>Las <a href="tema.html?id=complementary-slackness">holguras complementarias</a> caracterizan los pares óptimos.</li>
        <li>\(y^*_i\) es el <a href="tema.html?id=shadow-prices">precio sombra</a> del recurso \(i\).</li>
        <li>En programación entera la dualidad fuerte falla: hay brecha entre el entero y su <a href="tema.html?id=lp-relaxation">relajación lineal</a>.</li>
      </ul>`,
  });
})();
