(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  const prod = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm = (a) => Math.hypot(a[0], a[1]);
  const ptos = (v) => `(${VIZ.fmt(v[0], 4)}, ${VIZ.fmt(v[1], 4)})`;

  function planoIgual(l, cx, cy, semi) {
    const m = { izq: 36, der: 12, sup: 12, inf: 26 };
    const pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw, ph) / (2 * semi);
    const hx = pw / (2 * s), hy = ph / (2 * s);
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen: m });
  }

  /* ---------- Problemas con solución de referencia conocida ---------- */

  const PROBLEMAS = {
    circulo: {
      nombre: 'Lineal sobre un círculo (h = 0)',
      f: (p) => p[0] + 2 * p[1], hs: [(p) => p[0] ** 2 + p[1] ** 2 - 4], gs: [],
      ref: { x: [-2 / Math.sqrt(5), -4 / Math.sqrt(5)], lam: [Math.sqrt(5) / 4], mu: [] },
      niveles: [-4, -3, -2, -1, 0, 1, 2, 3, 4], centro: [0, 0], semi: 3.2, x0: [1.8, 1.2],
    },
    disco: {
      nombre: 'Distancia a un punto sobre un disco (g ≤ 0)',
      f: (p) => (p[0] - 2) ** 2 + (p[1] - 2) ** 2, hs: [], gs: [(p) => p[0] ** 2 + p[1] ** 2 - 2],
      ref: { x: [1, 1], lam: [], mu: [1] },
      niveles: [0.5, 1, 2, 3.5, 5, 8, 12], centro: [1, 1], semi: 3, x0: [-1.5, 0.5],
    },
    mixto: {
      nombre: 'Mixto: recta (h = 0) y cota (g ≤ 0)',
      f: (p) => (p[0] - 2) ** 2 + (p[1] - 2) ** 2, hs: [(p) => p[0] + p[1] - 2], gs: [(p) => p[0] - 0.5],
      ref: { x: [0.5, 1.5], lam: [1], mu: [2] },
      niveles: [0.5, 1, 2, 3.5, 5, 8, 12], centro: [1, 1], semi: 3.2, x0: [-1, 0],
    },
  };
  const LISTA = Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]);

  // Dos métodos: penalización cuadrática (ρ crece) y Lagrangiano aumentado (ρ fijo, multiplicadores actualizados).
  function correr(P, rho, crec, K) {
    const fin = (m) => ({ ...m, ex: nrm([m.x[0] - P.ref.x[0], m.x[1] - P.ref.x[1]]), em: Math.hypot(...m.lam.map((v, i) => v - P.ref.lam[i]), ...m.mu.map((v, i) => v - P.ref.mu[i])) });
    const pen = [], aug = [];
    let x = P.x0.slice(), r = rho;
    for (let k = 0; k <= K; k++) {
      const pr = r;
      const F = (y) => P.f(y) + P.hs.reduce((s, h) => s + 0.5 * pr * h(y) ** 2, 0) + P.gs.reduce((s, g) => s + 0.5 * pr * Math.max(0, g(y)) ** 2, 0);
      x = O.nelderMead(F, x, { paso: 0.4, iter: 700 });
      pen.push(fin({ x: x.slice(), rho: pr, lam: P.hs.map((h) => pr * h(x)), mu: P.gs.map((g) => pr * Math.max(0, g(x))) }));
      r *= crec;
    }
    let y = P.x0.slice(), lam = P.hs.map(() => 0), mu = P.gs.map(() => 0);
    for (let k = 0; k <= K; k++) {
      const L = (z) => P.f(z) + P.hs.reduce((s, h, i) => s + lam[i] * h(z) + 0.5 * rho * h(z) ** 2, 0)
        + P.gs.reduce((s, g, j) => s + (Math.max(0, mu[j] + rho * g(z)) ** 2 - mu[j] ** 2) / (2 * rho), 0);
      y = O.nelderMead(L, y, { paso: 0.4, iter: 700 });
      aug.push(fin({ x: y.slice(), rho, lam: lam.slice(), mu: mu.slice() }));
      // multiplicadores actualizados con la solución de este subproblema
      lam = lam.map((l, i) => l + rho * P.hs[i](y));
      mu = mu.map((m, j) => Math.max(0, m + rho * P.gs[j](y)));
      aug[aug.length - 1] = fin({ x: y.slice(), rho, lam: lam.slice(), mu: mu.slice() });
    }
    return { pen, aug };
  }

  // Condición de segundo orden sobre el espacio tangente en la referencia.
  function segundoOrden(P) {
    const x = P.ref.x, lam = P.ref.lam, mu = P.ref.mu;
    const L = (z) => P.f(z) + lam.reduce((s, l, i) => s + l * P.hs[i](z), 0) + mu.reduce((s, m, j) => s + m * P.gs[j](z), 0);
    const H = O.hess(L, x);
    const act = [...P.hs, ...P.gs.filter((g) => g(x) > -1e-6)];
    if (act.length >= 2) return { txt: 'dos restricciones activas independientes en 2-D: el espacio tangente es {0}; el punto es mínimo estricto sin más condiciones', ok: true, H };
    if (act.length === 0) { const ev = O.propios(H).map((q) => q.valor); return { txt: `sin restricciones activas: Hessiana de f con valores propios ${ev.map((v) => VIZ.fmt(v, 3)).join(', ')}`, ok: ev[0] > 0, H }; }
    const gh = O.grad(act[0], x), t = [-gh[1] / nrm(gh), gh[0] / nrm(gh)];
    const cur = t[0] * (H[0][0] * t[0] + H[0][1] * t[1]) + t[1] * (H[1][0] * t[0] + H[1][1] * t[1]);
    return { txt: `curvatura de la lagrangiana sobre la tangente tᵀ∇²L t = ${VIZ.fmt(cur, 4)} ${cur > 0 ? '> 0: mínimo local estricto' : '≤ 0: no es mínimo'}`, ok: cur > 0, H };
  }

  /* ---------- Fig. 1: trayectorias ---------- */

  function montarTrayectoria(cuerpo) {
    let P = PROBLEMAS.circulo, rho = 5, crec = 3, res = null, k = 0, plano = null;
    const K = 8;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'circulo', alCambiar: (v) => { P = PROBLEMAS[v]; recalcular(); } });
    ctl.rango({ etiqueta: 'Parámetro de penalización ρ', min: 1, max: 40, paso: 1, valor: rho, alCambiar: (v) => { rho = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Crecimiento de ρ en la penalización', min: 1.5, max: 6, paso: 0.5, valor: crec, formato: (v) => '×' + v, alCambiar: (v) => { crec = v; recalcular(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.68, altoMin: 290, altoMax: 450 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'restricciones h = 0 y g = 0', forma: 'linea' },
      { color: C.s2, texto: 'penalización (ρ crece)', forma: 'linea' },
      { color: C.s1, texto: 'Lagrangiano aumentado (ρ fijo)', forma: 'linea' },
      { color: C.s6, texto: 'óptimo exacto', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso»: cada iteración resuelve un subproblema sin restricciones. La penalización se acerca al óptimo desde fuera de la región factible; el aumentado converge con ρ moderado porque corrige los multiplicadores.');

    function recalcular() { res = correr(P, rho, crec, K); rep.reiniciar(); }
    function iniciar() { k = 0; return (function* () { while (k < K) { k++; yield; } })(); }
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, P.centro[0], P.centro[1], P.semi);
      plano.ejes();
      ctx.save(); plano.recortar();
      for (const c of P.niveles) ML.contorno(ctx, plano, (a, b) => P.f([a, b]), c, { color: C.eje, ancho: 1.1, paso: 6 });
      ctx.restore();
      [...P.hs, ...P.gs].forEach((f) => ML.contorno(ctx, plano, (a, b) => f([a, b]), 0, { color: C.tinta, ancho: 2.5, paso: 3 }));
      const tr = (arr) => [P.x0, ...arr.slice(0, k + 1).map((m) => m.x)];
      VIZ.trazar(ctx, plano, tr(res.pen), C.s2, 2);
      VIZ.trazar(ctx, plano, tr(res.aug), C.s1, 2);
      res.pen.slice(0, k + 1).forEach((m) => VIZ.marcador(ctx, plano.sx(m.x[0]), plano.sy(m.x[1]), C.s2, 3.5));
      res.aug.slice(0, k + 1).forEach((m) => VIZ.marcador(ctx, plano.sx(m.x[0]), plano.sy(m.x[1]), C.s1, 3.5));
      ctx.save(); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 2; ctx.fillStyle = C.superficie; ctx.beginPath(); ctx.arc(plano.sx(P.x0[0]), plano.sy(P.x0[1]), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
      VIZ.marcador(ctx, plano.sx(P.ref.x[0]), plano.sy(P.ref.x[1]), C.s6, 7);
      const a = res.aug[k], p = res.pen[k], so = segundoOrden(P);
      const mult = (m) => [...m.lam, ...m.mu].map((v) => VIZ.fmt(v, 4)).join(', ');
      registro.textContent = k === 0 ? 'Iteración 0: ambos métodos resuelven el primer subproblema (el aumentado con λ = μ = 0 equivale a la penalización con ρ inicial).'
        : `Iteración ${k}: la penalización usa ρ = ${VIZ.fmt(p.rho, 4)} y queda a ${VIZ.fmt(p.ex, 2)} del óptimo; el aumentado usa ρ = ${rho} y queda a ${VIZ.fmt(a.ex, 2)}. Sus multiplicadores estimados: (${mult(a)}) frente a los exactos (${[...P.ref.lam, ...P.ref.mu].map((v) => VIZ.fmt(v, 4)).join(', ')}).`;
      lectura.set([
        ['iteración', `${k} de ${K}`], ['óptimo exacto', ptos(P.ref.x)], ['x penalización', ptos(p.x)], ['x aumentado', ptos(a.x)],
        ['error (pen. / aum.)', `${VIZ.fmt(p.ex, 2)} / ${VIZ.fmt(a.ex, 2)}`], ['multiplicadores (aum.)', mult(a)],
        ['segundo orden', so.ok ? 'cumple' : 'no cumple'],
      ]);
      registro.title = so.txt;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt(P.f(q))}</b><br>` + [...P.hs.map((h, i) => ['h' + (i + 1), h]), ...P.gs.map((g, j) => ['g' + (j + 1), g])].map(([n, f]) => `${n} = <b>${VIZ.fmt(f(q), 3)}</b>`).join('  '));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recalcular();
  }

  /* ---------- Fig. 2: convergencia del error ---------- */

  function montarConvergencia(cuerpo) {
    let P = PROBLEMAS.disco, rho = 5, crec = 3, metrica = 'x', res = null, graf = null;
    const K = 8;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'disco', alCambiar: (v) => { P = PROBLEMAS[v]; recalcular(); } });
    ctl.selector({ etiqueta: 'Error a mostrar', opciones: [['x', 'Distancia al óptimo ‖x − x*‖'], ['m', 'Error del multiplicador ‖λ − λ*‖']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'ρ', min: 1, max: 40, paso: 1, valor: rho, alCambiar: (v) => { rho = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Crecimiento de ρ en la penalización', min: 1.5, max: 6, paso: 0.5, valor: crec, formato: (v) => '×' + v, alCambiar: (v) => { crec = v; recalcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'penalización', forma: 'linea' },
      { color: C.s1, texto: 'Lagrangiano aumentado', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico. Suba ρ: el aumentado converge más rápido. Baje el crecimiento de ρ: la penalización avanza más lento, porque el error baja como 1/ρ. Cambie al error del multiplicador para ver cómo se estiman λ y μ.');

    function recalcular() { res = correr(P, rho, crec, K); dibujar(); }
    const err = (m) => Math.max(1e-12, metrica === 'x' ? m.ex : m.em);
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      graf = VIZ.plano(lienzo, { xmin: 0, xmax: K, ymin: 1e-9, ymax: 10 }, { logY: true, etiquetaX: 'iteración', etiquetaY: metrica === 'x' ? '‖x − x*‖' : '‖multiplicador − exacto‖', margen: { izq: 52 } });
      graf.ejes();
      ctx.save(); graf.recortar();
      VIZ.trazar(ctx, graf, res.pen.map((m, i) => [i, err(m)]), C.s2, 2.5);
      VIZ.trazar(ctx, graf, res.aug.map((m, i) => [i, err(m)]), C.s1, 2.5);
      ctx.restore();
      res.pen.forEach((m, i) => VIZ.marcador(ctx, graf.sx(i), graf.sy(err(m)), C.s2, 3.5));
      res.aug.forEach((m, i) => VIZ.marcador(ctx, graf.sx(i), graf.sy(err(m)), C.s1, 3.5));
      const a = res.aug[K], p = res.pen[K];
      registro.textContent = `Tras ${K} iteraciones: penalización ρ = ${VIZ.fmt(p.rho, 3)}, error ${VIZ.fmt(err(p), 2)}; aumentado con ρ = ${rho}, error ${VIZ.fmt(err(a), 2)}. El aumentado no necesita ρ → ∞, lo que evita subproblemas mal condicionados.`;
      lectura.set([['ρ final (penalización)', VIZ.fmt(p.rho, 4)], ['‖x − x*‖ (pen.)', VIZ.fmt(p.ex, 2)], ['‖x − x*‖ (aum.)', VIZ.fmt(a.ex, 2)], ['error mult. (pen.)', VIZ.fmt(p.em, 2)], ['error mult. (aum.)', VIZ.fmt(a.em, 2)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!graf || !graf.dentro(pos.x, pos.y) || !res) return tip.ocultar();
      const i = Math.max(0, Math.min(K, Math.round(graf.ix(pos.x))));
      tip.mostrar(pos.x, pos.y, `iteración <b>${i}</b>` + VIZ.filaTooltip(C.s2, `penalización (ρ = ${VIZ.fmt(res.pen[i].rho, 3)})`, VIZ.fmt(err(res.pen[i]), 2)) + VIZ.filaTooltip(C.s1, 'aumentado', VIZ.fmt(err(res.aug[i]), 2)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recalcular();
  }

  VIZ.registrarTema('constrained-nlp-solving', {
    intro: String.raw`
      <p>Las condiciones de optimalidad no resuelven un problema restringido, solo lo caracterizan. Para calcular el óptimo se transforma el problema en una <em>secuencia</em> de problemas sin restricciones,
      que sí se saben resolver. La idea más simple es la <strong>penalización</strong>: sumar a \(f\) un castigo proporcional al cuadrado de la violación. Su defecto es que necesita un castigo cada vez más grande.</p>
      <p>El <strong>Lagrangiano aumentado</strong> añade además un término con multiplicadores estimados que se corrigen en cada ronda. Así converge sin que el castigo crezca sin límite y, de paso, entrega los multiplicadores.</p>`,
    visualizaciones: [
      {
        titulo: 'Penalización frente a Lagrangiano aumentado',
        descripcion: 'Avance paso a paso y compare las dos trayectorias hacia el punto verde: la naranja llega desde fuera de la región factible y la azul mejora aunque \\(\\rho\\) no crezca. Pruebe otro problema y otros valores de \\(\\rho\\).',
        montar: montarTrayectoria,
      },
      {
        titulo: 'Convergencia y estimación de multiplicadores',
        descripcion: 'Observe el error por iteración en escala logarítmica. Cambie \\(\\rho\\) y el crecimiento, y alterne entre el error en \\(x\\) y el error en el multiplicador.',
        montar: montarConvergencia,
      },
    ],
    teoria: String.raw`
      <h2>Condiciones de optimalidad</h2>
      <p>Para \(\min f(x)\) con \(h(x)=0\) y \(g(x)\le0\), sea \(x^*\) un punto KKT con multiplicadores \((\lambda^*,\mu^*)\) y lagrangiana \(L=f+\lambda^\top h+\mu^\top g\).</p>
      <ul>
        <li><strong>Necesaria (primer orden)</strong>: KKT, bajo LICQ (véase <a href="tema.html?id=kkt-conditions">KKT</a>).</li>
        <li><strong>Necesaria (segundo orden)</strong>: si \(x^*\) es mínimo local, \(d^\top\nabla^2_{xx}L(x^*,\lambda^*,\mu^*)\,d\ge0\) para todo \(d\) del cono crítico.</li>
        <li><strong>Suficiente (segundo orden)</strong>: KKT y \(d^\top\nabla^2_{xx}L\,d>0\) para todo \(d\neq0\) con \(\nabla h_i^\top d=0\) y \(\nabla g_j^\top d=0\) (\(j\) activa con \(\mu_j>0\)). Entonces \(x^*\) es un mínimo local estricto.</li>
      </ul>
      <p>En el plano con una restricción activa, el espacio tangente es una recta con vector unitario \(t\), y la prueba es el signo de \(t^\top\nabla^2_{xx}L\,t\). Con dos restricciones activas independientes el espacio tangente es \(\{0\}\) y la condición se cumple sola.</p>
      <h2>Método de penalización cuadrática</h2>
      \[ P_\rho(x)=f(x)+\frac\rho2\sum_i h_i(x)^2+\frac\rho2\sum_j\max(0,g_j(x))^2. \]
      <p>Se minimiza \(P_\rho\) para \(\rho_0<\rho_1<\cdots\to\infty\). Los minimizadores \(x_k\) tienden a \(x^*\) desde el exterior de la región factible, y \(\rho_k h(x_k)\to\lambda^*\), \(\rho_k\max(0,g(x_k))\to\mu^*\). El error es \(O(1/\rho)\), pero la Hessiana de \(P_\rho\) queda mal condicionada cuando \(\rho\) es grande.</p>
      <h2>Lagrangiano aumentado</h2>
      \[ L_\rho(x;\lambda,\mu)=f+\sum_i\big(\lambda_ih_i+\tfrac\rho2h_i^2\big)+\frac1{2\rho}\sum_j\Big(\max(0,\mu_j+\rho g_j)^2-\mu_j^2\Big). \]
      <pre><code>λ ← 0, μ ← 0, x ← x₀
repetir:
    x ← argmin_x L_ρ(x; λ, μ)           (subproblema sin restricciones)
    λ_i ← λ_i + ρ h_i(x)
    μ_j ← max(0, μ_j + ρ g_j(x))
hasta que ‖h(x)‖ y ‖max(0, g(x))‖ sean pequeños</code></pre>
      <p>Si \(\lambda\) fuera \(\lambda^*\), minimizar \(L_\rho\) con \(\rho\) moderado ya daría \(x^*\) exactamente. La actualización de multiplicadores es un paso de ascenso dual de tamaño \(\rho\): converge linealmente con una razón del orden \(1/\rho\) y no necesita \(\rho\to\infty\). Aquí el subproblema se resuelve con Nelder–Mead.</p>
      <h2>Ejemplo</h2>
      <p>\(\min x+2y\) con \(x^2+y^2=4\) tiene solución \(x^*=-(2,4)/\sqrt5\) y \(\lambda^*=\sqrt5/4\approx0{,}559\). Con penalización, \(\lambda_k=\rho_kh(x_k)\) se acerca a este valor desde un lado; con el aumentado, \(\lambda\) se corrige en cada ronda hasta coincidir con él. Sobre la tangente, \(t^\top\nabla^2_{xx}L\,t=2\lambda^*>0\), de modo que es un mínimo estricto.</p>
      <h2>Conexiones</h2>
      <p>Los multiplicadores resultantes se interpretan como sensibilidades en <a href="tema.html?id=multiplier-interpretation">su significado geométrico</a>. La lagrangiana y su sistema se trabajan en <a href="tema.html?id=lagrangian-function">la función lagrangiana</a>; los subproblemas sin restricciones usan métodos como
      el <a href="tema.html?id=descenso-gradiente">descenso del gradiente</a> o Newton (<a href="tema.html?id=unconstrained-optimality-conditions">condiciones sin restricciones</a>).</p>`,
  });
})();
