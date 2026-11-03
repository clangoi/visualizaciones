(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  // Costo por ración (USD) y aporte por ración: energía (kcal), proteína (g), calcio (mg), vitamina C (mg), fibra (g).
  const ALIM = [
    { n: 'Avena', c: 0.30, a: [150, 5, 20, 0, 4] },
    { n: 'Pollo', c: 1.20, a: [165, 31, 15, 0, 0] },
    { n: 'Leche', c: 0.50, a: [120, 8, 300, 0, 0] },
    { n: 'Lentejas', c: 0.40, a: [230, 18, 40, 3, 16] },
    { n: 'Naranja', c: 0.45, a: [62, 1, 52, 70, 3] },
    { n: 'Pan', c: 0.25, a: [80, 3, 40, 0, 1] },
    { n: 'Brócoli', c: 0.60, a: [55, 4, 60, 100, 5] },
  ];
  const NUT = [
    { n: 'Energía', u: 'kcal' }, { n: 'Proteína', u: 'g' }, { n: 'Calcio', u: 'mg' },
    { n: 'Vitamina C', u: 'mg' }, { n: 'Fibra', u: 'g' },
  ];
  const usoDe = (r, x) => x.reduce((s, v, j) => s + v * ALIM[j].a[r.nut], 0);
  const bajo = (t) => t[0].toLowerCase() + t.slice(1);
  const activa = (r, uso) => Math.abs(uso - r.b) <= 1e-6 * (1 + Math.abs(r.b));

  // Lista de restricciones nutricionales a partir de los requisitos.
  function restricciones(q) {
    return [
      { nom: 'Energía mínima', nut: 0, sen: '>=', b: q.en },
      { nom: 'Energía máxima', nut: 0, sen: '<=', b: q.enMax },
      { nom: 'Proteína mínima', nut: 1, sen: '>=', b: q.pr },
      { nom: 'Calcio mínimo', nut: 2, sen: '>=', b: q.ca },
      { nom: 'Vitamina C mínima', nut: 3, sen: '>=', b: q.vc },
      { nom: 'Fibra mínima', nut: 4, sen: '>=', b: q.fi },
    ];
  }
  function resolver(R, act, tope) {
    const A = R.map((r) => ALIM.map((f) => f.a[r.nut]));
    const cotas = ALIM.map((_, j) => [0, act[j] ? tope : 0]);
    return O.lp(ALIM.map((f) => f.c), A, R.map((r) => r.sen), R.map((r) => r.b), { max: false, cotas });
  }

  /* ---------- Fig. 1: la dieta de costo mínimo ---------- */

  function montarDieta(cuerpo) {
    const base = { en: 2000, enMax: 2500, pr: 55, ca: 800, vc: 60, fi: 25 };
    const q = { ...base };
    let tope = 8, sol = null, R = [], filas = [], hover = -1, pl = null;

    const ctl = VIZ.controles(cuerpo);
    const rg = {};
    const def = (k, etiqueta, min, max, paso, u) => {
      rg[k] = ctl.rango({ etiqueta, min, max, paso, valor: q[k], formato: (v) => `${VIZ.entero(v)} ${u}`, alCambiar: (v) => { q[k] = v; calcular(); } });
    };
    def('en', 'Energía mínima', 1200, 2800, 50, 'kcal');
    def('enMax', 'Energía máxima', 1500, 3200, 50, 'kcal');
    def('pr', 'Proteína mínima', 0, 120, 5, 'g');
    def('ca', 'Calcio mínimo', 0, 1500, 50, 'mg');
    def('vc', 'Vitamina C mínima', 0, 200, 5, 'mg');
    def('fi', 'Fibra mínima', 0, 50, 1, 'g');
    ctl.rango({ etiqueta: 'Máx. raciones por alimento', min: 1, max: 12, valor: tope, alCambiar: (v) => { tope = v; calcular(); } });
    const act = ctl.casillas(ALIM.map((f, j) => ({ clave: j, texto: f.n })), () => calcular());
    ctl.boton('Restablecer requisitos', () => {
      Object.keys(base).forEach((k) => { q[k] = base[k]; rg[k].valor = base[k]; });
      calcular();
    }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'raciones en la dieta óptima' },
      { color: C.tenue, texto: 'alimento excluido' },
      { color: C.apagado, texto: 'tope de raciones', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva los requisitos o excluya alimentos y la dieta se recalcula con el método Simplex. Las filas resaltadas de la tabla son las restricciones activas: se cumplen con igualdad.');

    function calcular() {
      R = restricciones(q);
      sol = resolver(R, act, tope);
      filas = [];
      if (sol.estado === 'optimo') {
        R.forEach((r, i) => {
          const uso = usoDe(r, sol.x), d = Math.max(1, 0.01 * Math.abs(r.b));
          const s2 = resolver(R.map((t, k) => (k === i ? { ...t, b: t.b + d } : t)), act, tope);
          filas.push({ r, uso, act: activa(r, uso), precio: s2.estado === 'optimo' ? (s2.z - sol.z) / d : null });
        });
      }
      tabla();
      dibujar();
    }
    function tabla() {
      if (!filas.length) { caja.replaceChildren(); return; }
      const t = VIZ.el('table', { class: 'tabla-datos sin-corte' });
      t.innerHTML = '<thead><tr><th class="izq">Restricción</th><th>Aporte</th><th>Límite</th><th>Holgura</th><th>Precio sombra (USD por unidad)</th></tr></thead>';
      const cb = VIZ.el('tbody');
      filas.forEach((f) => {
        const u = NUT[f.r.nut].u, h = f.r.sen === '>=' ? f.uso - f.r.b : f.r.b - f.uso;
        const tr = VIZ.el('tr', { class: f.act ? 'activa' : null });
        tr.innerHTML = `<td class="izq">${f.r.nom}</td><td>${VIZ.fmt(f.uso)} ${u}</td><td>${f.r.sen === '>=' ? '≥' : '≤'} ${VIZ.fmt(f.r.b)}</td><td>${f.act ? 'activa' : VIZ.fmt(h)}</td><td>${f.precio == null ? '—' : VIZ.fmt(f.precio)}</td>`;
        cb.appendChild(tr);
      });
      t.appendChild(cb);
      caja.replaceChildren(t);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ok = sol && sol.estado === 'optimo';
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: ALIM.length, ymin: 0, ymax: tope * 1.15 }, { etiquetaY: 'raciones por día', ticksX: [] });
      pl.ejes();
      const paso = (pl.x1 - pl.x0) / ALIM.length, ancho = Math.min(52, paso * 0.7);
      ctx.save();
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'center';
      ALIM.forEach((f, j) => {
        const cx = pl.sx(j + 0.5), v = ok ? sol.x[j] : 0;
        ctx.fillStyle = C.tinta2;
        ctx.textBaseline = 'top';
        ctx.fillText(paso < 56 ? f.n.slice(0, 6) : f.n, cx, pl.y0 + 7);
        if (ok && v > 1e-6) {
          ctx.fillStyle = j === hover ? VIZ.alfa(C.s1, 0.75) : C.s1;
          ctx.beginPath();
          ctx.roundRect(cx - ancho / 2, pl.sy(v), ancho, pl.y0 - pl.sy(v), [4, 4, 0, 0]);
          ctx.fill();
          ctx.fillStyle = C.tinta;
          ctx.textBaseline = 'bottom';
          ctx.font = VIZ.fuente(11);
          ctx.fillText(VIZ.fmt(v, 3), cx, pl.sy(v) - 3);
          ctx.font = VIZ.fuente(10);
        } else if (!act[j]) {
          ctx.fillStyle = C.tenue;
          ctx.fillRect(cx - ancho / 2, pl.y0 - 4, ancho, 4);
        }
      });
      ctx.restore();
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = C.apagado;
      ctx.beginPath();
      ctx.moveTo(pl.x0, pl.sy(tope) + 0.5);
      ctx.lineTo(pl.x1, pl.sy(tope) + 0.5);
      ctx.stroke();
      ctx.restore();
      if (!ok) {
        ctx.save();
        ctx.fillStyle = C.s8;
        ctx.font = VIZ.fuente(13, 500);
        ctx.textAlign = 'center';
        ctx.fillText(sol && sol.estado === 'noacotado' ? 'Problema no acotado' : 'Sin dieta posible con estos requisitos', (pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2);
        ctx.restore();
        registro.textContent = 'Infactible: ninguna combinación de raciones permitidas cumple a la vez todos los requisitos. Baje un requisito, suba el tope o incluya más alimentos.';
        lectura.set([['costo mínimo', '—'], ['alimentos en la dieta', '0'], ['restricciones activas', '—'], ['estado', 'infactible']]);
        return;
      }
      const usados = ALIM.map((f, j) => [f.n, sol.x[j]]).filter(([, v]) => v > 1e-6);
      const nAct = filas.filter((f) => f.act).length;
      const nTope = sol.x.filter((v, j) => act[j] && Math.abs(v - tope) < 1e-6).length;
      registro.textContent = `Dieta de costo mínimo: ${usados.map(([n, v]) => `${VIZ.fmt(v, 3)} de ${n.toLowerCase()}`).join(', ')}. `
        + `Activas: ${filas.filter((f) => f.act).map((f) => bajo(f.r.nom)).join(', ') || 'ninguna'}.`;
      lectura.set([
        ['costo mínimo por día', `USD ${VIZ.fmt(sol.z)}`],
        ['alimentos en la dieta', `${usados.length} de ${ALIM.filter((_, j) => act[j]).length}`],
        ['restricciones activas', `${nAct} de ${filas.length}`],
        ['alimentos en el tope', String(nTope)],
      ]);
    }
    lienzo.alDibujar = () => sol && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !sol || sol.estado !== 'optimo' || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const j = Math.floor(pl.ix(x));
      if (j < 0 || j >= ALIM.length) return tip.ocultar();
      if (j !== hover) { hover = j; dibujar(); }
      const f = ALIM[j], v = sol.x[j];
      tip.mostrar(x, y, `<b>${f.n}</b>${act[j] ? '' : ' (excluido)'}<br>raciones <b>${VIZ.fmt(v)}</b><br>costo unitario <b>USD ${VIZ.fmt(f.c)}</b><br>aporte al costo <b>USD ${VIZ.fmt(v * f.c)}</b>`
        + NUT.map((n, k) => `<br>${n.n} ${VIZ.fmt(v * f.a[k])} ${n.u}`).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); if (hover >= 0) { hover = -1; if (sol) dibujar(); } });
    calcular();
  }

  /* ---------- Fig. 2: dos alimentos, la región factible ---------- */

  const COMIDA = { en: 650, enMax: 850, pr: 20, ca: 270, vc: 20, fi: 8 };
  const TOPE2 = 6;

  function montarRegion(cuerpo) {
    const R = restricciones(COMIDA);
    let ia = 3, ib = 4, ca = ALIM[ia].c, cb = ALIM[ib].c, punto = [2, 2], arrastra = false, poli = [], opt = null, pl = null;

    const ctl = VIZ.controles(cuerpo);
    const opciones = ALIM.map((f, j) => [j, f.n]);
    const selA = ctl.selector({ etiqueta: 'Alimento A (horizontal)', opciones, valor: ia, alCambiar: (v) => { ia = +v; if (ib === ia) { ib = (ia + 1) % ALIM.length; selB.valor = ib; } reponer(); } });
    const selB = ctl.selector({ etiqueta: 'Alimento B (vertical)', opciones, valor: ib, alCambiar: (v) => { ib = +v; if (ib === ia) { ia = (ib + 1) % ALIM.length; selA.valor = ia; } reponer(); } });
    const rA = ctl.rango({ etiqueta: 'Precio de A', min: 0.05, max: 2.5, paso: 0.05, valor: ca, formato: (v) => `USD ${VIZ.fmt(v)}`, alCambiar: (v) => { ca = v; calcular(); } });
    const rB = ctl.rango({ etiqueta: 'Precio de B', min: 0.05, max: 2.5, paso: 0.05, valor: cb, formato: (v) => `USD ${VIZ.fmt(v)}`, alCambiar: (v) => { cb = v; calcular(); } });
    ctl.boton('Ir al óptimo', () => { if (opt) { punto = opt.x.slice(); dibujar(); } }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    const COL = R.map((_, i) => C['s' + (i + 1)]);
    VIZ.leyenda(cuerpo, [
      ...R.map((r, i) => ({ color: COL[i], texto: r.nom, forma: 'linea' })),
      { color: VIZ.alfa(C.s1, 0.18), texto: 'región factible', borde: C.s1 },
      { color: C.tinta2, texto: 'recta de igual costo por su dieta', forma: 'linea' },
      { color: C.s6, texto: 'dieta óptima' },
      { color: C.tinta, texto: 'su dieta' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre sobre el gráfico para elegir cuántas raciones de A y de B come en una comida. Cada recta marca el límite de un requisito; la región sombreada cumple todos.');

    const coef = (r) => [ALIM[ia].a[r.nut], ALIM[ib].a[r.nut]];
    const costo = (p) => ca * p[0] + cb * p[1];
    function reponer() { ca = ALIM[ia].c; cb = ALIM[ib].c; rA.valor = ca; rB.valor = cb; calcular(); }
    function calcular() {
      const restr = R.map((r) => { const a = coef(r); return r.sen === '>=' ? { a: [-a[0], -a[1]], b: -r.b } : { a, b: r.b }; });
      poli = O.poligono(restr, { xmin: 0, xmax: TOPE2, ymin: 0, ymax: TOPE2 });
      opt = poli.length ? O.optimo2d(poli, [-ca, -cb]) : null;
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: TOPE2, ymin: 0, ymax: TOPE2 }, { etiquetaX: `raciones de ${ALIM[ia].n.toLowerCase()} (A)`, etiquetaY: `raciones de ${ALIM[ib].n.toLowerCase()} (B)` });
      pl.ejes();
      if (poli.length) {
        ctx.beginPath();
        poli.forEach(([x, y], i) => (i ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y))));
        ctx.closePath();
        ctx.fillStyle = VIZ.alfa(C.s1, 0.18);
        ctx.fill();
      }
      ctx.save();
      pl.recortar();
      R.forEach((r, i) => {
        const [a1, a2] = coef(r);
        ctx.strokeStyle = COL[i];
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (Math.abs(a2) > 1e-9) { ctx.moveTo(pl.sx(0), pl.sy(r.b / a2)); ctx.lineTo(pl.sx(TOPE2), pl.sy((r.b - a1 * TOPE2) / a2)); }
        else { ctx.moveTo(pl.sx(r.b / a1), pl.sy(0)); ctx.lineTo(pl.sx(r.b / a1), pl.sy(TOPE2)); }
        ctx.stroke();
      });
      const z = costo(punto);
      ctx.strokeStyle = C.tinta2;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      if (cb > 1e-9) { ctx.moveTo(pl.sx(0), pl.sy(z / cb)); ctx.lineTo(pl.sx(TOPE2), pl.sy((z - ca * TOPE2) / cb)); }
      ctx.stroke();
      ctx.restore();
      if (opt) VIZ.marcador(ctx, pl.sx(opt.x[0]), pl.sy(opt.x[1]), C.s6, 6);
      VIZ.marcador(ctx, pl.sx(punto[0]), pl.sy(punto[1]), C.tinta, 5);
      if (!poli.length) {
        ctx.save();
        ctx.fillStyle = C.s8;
        ctx.font = VIZ.fuente(13, 500);
        ctx.textAlign = 'center';
        ctx.fillText('Con estos dos alimentos no hay comida factible', (pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2);
        ctx.restore();
      }
      informar();
    }
    function informar() {
      const z = costo(punto), viol = R.filter((r) => { const u = punto[0] * coef(r)[0] + punto[1] * coef(r)[1]; return r.sen === '>=' ? u < r.b - 1e-9 : u > r.b + 1e-9; });
      if (!opt) {
        registro.textContent = 'Infactible: las rectas no dejan ninguna región común. Pruebe con otra pareja que incluya una fuente de vitamina C y otra de calcio o proteína.';
        lectura.set([['costo de su dieta', `USD ${VIZ.fmt(z)}`], ['costo mínimo', '—'], ['vértices de la región', '0'], ['estado', 'infactible']]);
        return;
      }
      const nombresAct = R.filter((r) => { const a = coef(r); return Math.abs(opt.x[0] * a[0] + opt.x[1] * a[1] - r.b) < 1e-6 * (1 + r.b); }).map((r) => bajo(r.nom));
      const enBorde = [opt.x[0], opt.x[1]].map((v) => Math.abs(v) < 1e-9 || Math.abs(v - TOPE2) < 1e-9);
      registro.textContent = (viol.length ? `Su dieta incumple: ${viol.map((r) => bajo(r.nom)).join(', ')}.` : 'Su dieta cumple todos los requisitos.')
        + ` El óptimo (${VIZ.fmt(opt.x[0], 3)} de A, ${VIZ.fmt(opt.x[1], 3)} de B) está en un vértice donde son activas: ${nombresAct.join(' y ') || 'solo los ejes'}${enBorde[0] || enBorde[1] ? ' y un eje' : ''}.`;
      lectura.set([
        ['costo de su dieta', `USD ${VIZ.fmt(z)}`],
        ['costo mínimo', `USD ${VIZ.fmt(-opt.z)}`],
        ['sobrecosto', viol.length ? 'dieta inválida' : `USD ${VIZ.fmt(z + opt.z)}`],
        ['vértices de la región', String(poli.length)],
      ]);
    }
    function mover(ev) {
      const { x, y } = lienzo.posicion(ev);
      const ex = Math.min(TOPE2, Math.max(0, pl.ix(x))), ey = Math.min(TOPE2, Math.max(0, pl.iy(y)));
      punto = [Math.round(ex * 20) / 20, Math.round(ey * 20) / 20];
      dibujar();
    }
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      if (!pl || !pl.dentro(...Object.values(lienzo.posicion(ev)))) return;
      if (ev.pointerType !== 'touch') { arrastra = true; lienzo.canvas.setPointerCapture(ev.pointerId); }
      mover(ev);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastra = false; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (arrastra) mover(ev);
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const p = [pl.ix(x), pl.iy(y)];
      const rs = R.map((r, i) => { const u = p[0] * coef(r)[0] + p[1] * coef(r)[1]; const ok = r.sen === '>=' ? u >= r.b : u <= r.b; return VIZ.filaTooltip(ok ? C.s6 : C.s8, `${r.nom}: ${VIZ.fmt(u, 3)} ${NUT[r.nut].u}`, ok ? 'cumple' : 'no cumple'); });
      tip.mostrar(x, y, `A <b>${VIZ.fmt(p[0], 3)}</b>, B <b>${VIZ.fmt(p[1], 3)}</b><br>costo <b>USD ${VIZ.fmt(costo(p))}</b>${rs.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = () => dibujar();
    calcular();
  }

  VIZ.registrarTema('diet-problem', {
    intro: String.raw`
      <p>El <strong>problema de la dieta</strong> fue uno de los primeros modelos de programación lineal (Stigler, 1945; Dantzig, 1947):
      entre muchos alimentos con precios y composiciones distintas, ¿cuántas raciones de cada uno comprar para cubrir las necesidades
      nutricionales al menor costo posible?</p>
      <p>Es el ejemplo más limpio de cómo traducir un problema real a un modelo: las <em>variables</em> son cantidades de alimento, cada
      requisito nutricional es una <em>restricción lineal</em> y el costo total es la <em>función objetivo</em>. En la solución óptima unas
      pocas restricciones quedan exactas (<em>activas</em>) y el resto sobra.</p>`,
    visualizaciones: [
      {
        titulo: 'La dieta de costo mínimo',
        descripcion: 'Suba el requisito de calcio o de vitamina C y observe qué alimentos entran; excluya la leche o las lentejas y compare. La tabla muestra qué restricciones son activas y su precio sombra. Pruebe una energía mínima mayor que la máxima para obtener un problema infactible.',
        montar: montarDieta,
      },
      {
        titulo: 'Dos alimentos: la región factible',
        descripcion: 'Con solo dos alimentos el problema se ve en el plano. Arrastre su dieta dentro y fuera de la región sombreada, mueva el precio de B hasta que el óptimo salte a otro vértice y cambie de pareja para ver cuándo no hay solución.',
        montar: montarRegion,
      },
    ],
    teoria: String.raw`
      <h2>El modelo</h2>
      <p>Sean \(n\) alimentos y \(m\) nutrientes. Se definen</p>
      <ul>
        <li>\(x_j \ge 0\): raciones del alimento \(j\) que se compran;</li>
        <li>\(c_j\): costo por ración;</li>
        <li>\(a_{ij}\): cantidad del nutriente \(i\) que aporta una ración del alimento \(j\);</li>
        <li>\(\ell_i\) y \(u_i\): mínimo y máximo diario del nutriente \(i\) (con \(u_i = \infty\) si no hay máximo).</li>
      </ul>
      \[ \min_{x}\ \sum_{j=1}^{n} c_j x_j \quad \text{s.a.}\quad \ell_i \le \sum_{j=1}^{n} a_{ij}\, x_j \le u_i \ \ (i = 1,\dots,m), \qquad 0 \le x_j \le \bar{x}_j. \]
      <p>Los topes \(\bar{x}_j\) evitan dietas absurdas (veinte litros de leche). Es un programa lineal porque el costo y los aportes son
      proporcionales a las raciones y se suman: no hay efectos de escala ni de interacción entre alimentos.</p>
      <h2>Ejemplo: dos alimentos</h2>
      <p>Con lentejas (\(x_1\), USD 0,40) y naranja (\(x_2\), USD 0,45), y los requisitos de una comida de la segunda figura, las restricciones son
      \[ 230x_1 + 62x_2 \ge 650,\quad 40x_1 + 52x_2 \ge 270,\quad 18x_1 + x_2 \ge 20,\quad 3x_1 + 70x_2 \ge 20,\quad 16x_1 + 3x_2 \ge 8, \]
      más la de energía máxima. Cada desigualdad es un semiplano; su intersección es un polígono y el óptimo de \(\min\, c^\top x\) está en
      un vértice (ver <a href="tema.html?id=polyhedra-vertices">poliedros y vértices</a>).</p>
      <h2>Restricciones activas y soluciones básicas</h2>
      <p>Una restricción es <strong>activa</strong> en \(x^*\) si se cumple con igualdad. En un vértice de un problema con \(n\) variables hay al menos
      \(n\) restricciones activas linealmente independientes (ver <a href="tema.html?id=active-constraints-bfs">restricciones activas y soluciones
      básicas factibles</a>). Por eso, en la primera figura, la dieta óptima usa pocos alimentos: cada alimento con ración estrictamente
      positiva y por debajo de su tope necesita «gastar» una restricción nutricional activa.</p>
      <div class="recuadro"><p><strong>Precio sombra.</strong> Si el requisito \(\ell_i\) es activo, subirlo en una unidad cuesta
      \(y_i^*\) (la variable dual) más por día; si es inactivo, su precio sombra es cero. La tabla de la primera figura lo estima
      resolviendo de nuevo el problema con el requisito ligeramente mayor. Ver <a href="tema.html?id=shadow-prices">precios sombra</a> y
      <a href="tema.html?id=dual-construction">el dual</a>.</p></div>
      <h2>Variantes</h2>
      <ul>
        <li>Si las raciones deben ser enteras (no se compran media lata), el problema pasa a ser entero: ver
        <a href="tema.html?id=problem-classes">LP, ILP, MILP y NLP</a>.</li>
        <li>Repartir un presupuesto entre usos que compiten es el mismo esqueleto: <a href="tema.html?id=resource-allocation">asignación de recursos</a>.</li>
        <li>Maximizar beneficio con capacidades limitadas es el modelo gemelo: <a href="tema.html?id=production-planning">planificación de producción</a>.</li>
        <li>La forma de resolverlo con el algoritmo Simplex se ve en <a href="tema.html?id=simplex-tableau">el tableau</a>.</li>
      </ul>`,
  });
})();
