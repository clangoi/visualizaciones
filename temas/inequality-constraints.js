(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  const prod = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm = (a) => Math.hypot(a[0], a[1]);
  const ptos = (v) => `(${VIZ.fmt(v[0], 3)}, ${VIZ.fmt(v[1], 3)})`;
  const S2 = Math.SQRT2;

  function planoIgual(l, cx, cy, semi) {
    const m = { izq: 36, der: 12, sup: 12, inf: 26 };
    const pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw, ph) / (2 * semi);
    const hx = pw / (2 * s), hy = ph / (2 * s);
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen: m });
  }
  function flecha(ctx, x, y, dx, dy, color, ancho = 2.5) {
    const L = Math.hypot(dx, dy);
    if (L < 2) return;
    const a = Math.atan2(dy, dx), c = Math.min(10, L * 0.5), x1 = x + dx, y1 = y + dy;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1 - Math.cos(a) * c * 0.6, y1 - Math.sin(a) * c * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - c * Math.cos(a - 0.4), y1 - c * Math.sin(a - 0.4));
    ctx.lineTo(x1 - c * Math.cos(a + 0.4), y1 - c * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function flechaDir(ctx, p, pt, v, largo, color, etiqueta) {
    const n = nrm(v);
    if (n < 1e-9) return;
    const x = p.sx(pt[0]), y = p.sy(pt[1]), dx = (v[0] / n) * largo, dy = (-v[1] / n) * largo;
    flecha(ctx, x, y, dx, dy, color);
    if (etiqueta) {
      ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(etiqueta, x + dx * 1.22 + (dx >= 0 ? 6 : -6), y + dy * 1.22); ctx.restore();
    }
  }

  /* ---------- Regiones factibles {g_j(x) ≤ 0} y proyección euclídea (óptimo de min |x − c|²) ---------- */

  const REGIONES = {
    disco: {
      nombre: 'Disco (una restricción curva)',
      crear: (r) => ({
        restr: [{ nombre: 'g₁', g: (x, y) => x * x + y * y - r * r, gr: (x, y) => [2 * x, 2 * y] }],
        proy: (c) => { const n = nrm(c); return n <= r ? c.slice() : [(c[0] * r) / n, (c[1] * r) / n]; },
      }),
    },
    semiplano: {
      nombre: 'Semiplano (una restricción lineal)',
      crear: (r) => ({
        restr: [{ nombre: 'g₁', g: (x, y) => (x + y) / S2 - r, gr: () => [1 / S2, 1 / S2] }],
        proy: (c) => { const s = (c[0] + c[1]) / S2 - r; return s <= 0 ? c.slice() : [c[0] - s / S2, c[1] - s / S2]; },
      }),
    },
    caja: {
      nombre: 'Caja (cuatro restricciones)',
      crear: (r) => {
        const a = r, b = 0.7 * r;
        return {
          restr: [
            { nombre: 'g₁', g: (x) => x - a, gr: () => [1, 0] }, { nombre: 'g₂', g: (x) => -x - a, gr: () => [-1, 0] },
            { nombre: 'g₃', g: (x, y) => y - b, gr: () => [0, 1] }, { nombre: 'g₄', g: (x, y) => -y - b, gr: () => [0, -1] },
          ],
          proy: (c) => [Math.max(-a, Math.min(a, c[0])), Math.max(-b, Math.min(b, c[1]))],
        };
      },
    },
  };
  const LISTA = Object.entries(REGIONES).map(([k, r]) => [k, r.nombre]);
  const maxG = (R) => (x, y) => Math.max(...R.restr.map((q) => q.g(x, y)));

  // Multiplicadores μ de las restricciones activas: mínimos cuadrados de Σ μ_j ∇g_j = −∇f.
  function multiplicadores(R, x, gf, tol = 1e-6) {
    const act = R.restr.map((q, j) => j).filter((j) => R.restr[j].g(x[0], x[1]) > -tol);
    const mu = R.restr.map(() => 0);
    if (!act.length) return { act, mu };
    const G = act.map((j) => R.restr[j].gr(x[0], x[1]));
    const A = G.map((gi) => G.map((gj) => prod(gi, gj))), b = G.map((gi) => -prod(gi, gf));
    const sol = O.resolver(A, b) || b.map(() => 0);
    act.forEach((j, i) => { mu[j] = sol[i]; });
    return { act, mu };
  }
  // Lleva un punto a la frontera de las restricciones que está a menos de `tol` de cumplir con igualdad.
  function ajustarFrontera(R, p, tol) {
    let q = p.slice();
    for (let it = 0; it < 4; it++) {
      for (const r of R.restr) {
        const g = r.g(q[0], q[1]);
        if (Math.abs(g) < tol) { const n = r.gr(q[0], q[1]); q = [q[0] - (g * n[0]) / prod(n, n), q[1] - (g * n[1]) / prod(n, n)]; }
      }
    }
    return q;
  }
  function rellenarRegion(ctx, p, R) {
    const G = maxG(R), paso = 5;
    ctx.save();
    ctx.fillStyle = VIZ.alfa(C.s3, 0.2);
    for (let px = p.x0; px < p.x1; px += paso) for (let py = p.y1; py < p.y0; py += paso) {
      if (G(p.ix(px + paso / 2), p.iy(py + paso / 2)) <= 0) ctx.fillRect(px, py, Math.min(paso, p.x1 - px), Math.min(paso, p.y0 - py));
    }
    ctx.restore();
    ML.contorno(ctx, p, G, 0, { color: C.tinta, ancho: 3, paso: 3 });
  }
  function circulos(ctx, p, c, radios, color, ancho) {
    ctx.save();
    p.recortar();
    ctx.strokeStyle = color; ctx.lineWidth = ancho;
    for (const r of radios) { ctx.beginPath(); ctx.arc(p.sx(c[0]), p.sy(c[1]), r * Math.abs(p.sx(1) - p.sx(0)), 0, 2 * Math.PI); ctx.stroke(); }
    ctx.restore();
  }
  const RADIOS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7];
  function arrastrable(lienzo, alMover) {
    let activo = false;
    const c = lienzo.canvas;
    c.style.cursor = 'crosshair';
    c.addEventListener('pointerdown', (ev) => { activo = true; c.setPointerCapture(ev.pointerId); alMover(lienzo.posicion(ev), true); });
    c.addEventListener('pointermove', (ev) => alMover(lienzo.posicion(ev), activo));
    c.addEventListener('pointerup', () => { activo = false; });
    c.addEventListener('pointerleave', () => alMover(null, false));
  }

  /* ---------- Fig. 1: restricción activa o inactiva ---------- */

  function montarActivaInactiva(cuerpo) {
    let tipo = 'disco', r = 1.6, c = [2.4, 1.6], plano = null, R = REGIONES.disco.crear(r);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Región factible', opciones: LISTA, valor: tipo, alCambiar: (v) => { tipo = v; recrear(); } });
    ctl.rango({ etiqueta: 'Tamaño de la región', min: 0.6, max: 3, paso: 0.05, valor: r, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { r = v; recrear(); } });
    ctl.boton('Óptimo libre dentro', () => { c = [0.35 * r, 0.25 * r]; dibujar(); }, { primario: true });
    ctl.boton('Óptimo libre fuera', () => { c = [1.9 * r, 1.1 * r]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.68, altoMin: 290, altoMax: 450 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región factible', forma: 'cuadro' },
      { color: C.superficie, borde: C.apagado, texto: 'mínimo sin restricciones (centro de f)' },
      { color: C.s6, texto: 'óptimo restringido', forma: 'punto' },
      { color: C.s2, texto: '−∇f en el óptimo', forma: 'linea' },
      { color: C.s1, texto: '∇g de la restricción activa', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre el gráfico para mover el centro de las curvas de nivel (el mínimo de f sin restricciones). Si cae dentro de la región, la restricción no importa; si cae fuera, el óptimo se pega al borde.');

    function recrear() { R = REGIONES[tipo].crear(r); dibujar(); }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, 0, 0, 3.7);
      plano.ejes();
      rellenarRegion(ctx, plano, R);
      const x = R.proy(c), gf = [2 * (x[0] - c[0]), 2 * (x[1] - c[1])];
      const { act, mu } = multiplicadores(R, x, gf, 1e-7);
      circulos(ctx, plano, c, RADIOS, C.eje, 1.2);
      circulos(ctx, plano, c, [nrm([x[0] - c[0], x[1] - c[1]])], C.s2, 2);
      ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
      ctx.beginPath(); ctx.arc(plano.sx(c[0]), plano.sy(c[1]), 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
      if (act.length) {
        for (const j of act) flechaDir(ctx, plano, x, R.restr[j].gr(x[0], x[1]), 42, C.s1, R.restr[j].nombre);
        flechaDir(ctx, plano, x, [-gf[0], -gf[1]], 54, C.s2, '−∇f');
      }
      VIZ.marcador(ctx, plano.sx(x[0]), plano.sy(x[1]), C.s6, 6.5);
      const activa = act.length > 0;
      const fx = (x[0] - c[0]) ** 2 + (x[1] - c[1]) ** 2;
      registro.textContent = activa
        ? `El mínimo libre ${ptos(c)} es infactible: el óptimo queda en el borde, ${act.length === 1 ? 'con la restricción ' + R.restr[act[0]].nombre + ' activa' : 'con ' + act.length + ' restricciones activas'}. Ahí −∇f apunta hacia fuera y se equilibra con ${act.length === 1 ? 'su gradiente' : 'sus gradientes'}, con multiplicador${act.length === 1 ? '' : 'es'} ≥ 0.`
        : `El mínimo libre ${ptos(c)} es factible: el óptimo es ese mismo punto, ∇f = 0 y la restricción está inactiva (g < 0, multiplicador 0). Es como si la restricción no existiera.`;
      lectura.set([
        ['mín. libre', ptos(c)], ['óptimo x*', ptos(x)], ['f(x*)', VIZ.fmt(fx, 4)],
        ['estado', activa ? `activa (${act.map((j) => R.restr[j].nombre).join(', ')})` : 'inactiva'],
        ['μ', R.restr.map((q, j) => `${q.nombre}=${VIZ.fmt(mu[j], 3)}`).join('  ')],
        ['g(x*)', R.restr.map((q) => VIZ.fmt(q.g(x[0], x[1]), 2)).join('  ')],
      ]);
    }
    lienzo.alDibujar = dibujar;
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { c = q; dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt((q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2)}</b><br>` + R.restr.map((s) => `${s.nombre} = <b>${VIZ.fmt(s.g(q[0], q[1]), 3)}</b>`).join('  '));
    });
    dibujar();
  }

  /* ---------- Fig. 2: direcciones factibles de descenso ---------- */

  function montarDirecciones(cuerpo) {
    let tipo = 'disco', r = 1.6, c = [0.3, 0.2], p = [-1.1, -0.6], theta = 20, traza = [], plano = null;
    let R = REGIONES.disco.crear(r);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Región factible', opciones: LISTA, valor: tipo, alCambiar: (v) => { tipo = v; R = REGIONES[v].crear(r); p = R.proy(p); traza = [p.slice()]; dibujar(); } });
    ctl.selector({ etiqueta: 'Centro de f', opciones: [['dentro', 'Dentro de la región'], ['fuera', 'Fuera de la región']], valor: 'dentro', alCambiar: (v) => { c = v === 'dentro' ? [0.3, 0.2] : [2.6, 1.7]; traza = [p.slice()]; dibujar(); } });
    const sAng = ctl.rango({ etiqueta: 'Dirección d (ángulo)', min: 0, max: 359, paso: 1, valor: theta, formato: (v) => v + '°', alCambiar: (v) => { theta = v; dibujar(); } });
    ctl.boton('Dar un paso factible de descenso', () => {
      const gf = [2 * (p[0] - c[0]), 2 * (p[1] - c[1])];
      p = R.proy([p[0] - 0.35 * gf[0], p[1] - 0.35 * gf[1]]);
      traza.push(p.slice());
      dibujar();
    }, { primario: true });
    ctl.boton('Ir al óptimo', () => { p = R.proy(c); traza.push(p.slice()); dibujar(); });
    ctl.boton('Reiniciar', () => { p = R.proy([-1.1, -0.6]); traza = [p.slice()]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.68, altoMin: 290, altoMax: 450 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región factible', forma: 'cuadro' },
      { color: C.s6, texto: 'dirección factible que baja f', forma: 'linea' },
      { color: C.tenue, texto: 'otras direcciones', forma: 'linea' },
      { color: C.tinta, texto: 'dirección d elegida', forma: 'linea' },
      { color: C.s2, texto: '−∇f', forma: 'linea' },
      { color: C.s1, texto: '∇g activo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para colocar el punto actual (se ajusta al borde si está cerca). Pulse «Dar un paso» varias veces: las líneas verdes se acortan y desaparecen justo en el óptimo.');

    const clasificar = (x, gf, d) => {
      const act = R.restr.filter((q) => q.g(x[0], x[1]) > -0.015).map((q) => q.gr(x[0], x[1]));
      const factible = act.every((g) => prod(g, d) <= 1e-9);
      const baja = nrm(gf) > 1e-3 && prod(gf, d) < -1e-3 * nrm(gf);
      return { factible, baja, nact: act.length };
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, 0, 0, 3.7);
      plano.ejes();
      rellenarRegion(ctx, plano, R);
      circulos(ctx, plano, c, RADIOS, C.eje, 1.2);
      ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
      ctx.beginPath(); ctx.arc(plano.sx(c[0]), plano.sy(c[1]), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
      VIZ.trazar(ctx, plano, traza, C.apagado, 1.5, [4, 4]);
      const gf = [2 * (p[0] - c[0]), 2 * (p[1] - c[1])];
      const px = plano.sx(p[0]), py = plano.sy(p[1]);
      let buenas = 0, factibles = 0;
      const N = 72;
      for (let k = 0; k < N; k++) {
        const a = (2 * Math.PI * k) / N, d = [Math.cos(a), Math.sin(a)], q = clasificar(p, gf, d);
        if (q.factible) factibles++;
        const bueno = q.factible && q.baja;
        if (bueno) buenas++;
        ctx.save(); ctx.strokeStyle = bueno ? C.s6 : C.tenue; ctx.lineWidth = bueno ? 3 : 1.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + d[0] * (bueno ? 46 : 30), py - d[1] * (bueno ? 46 : 30)); ctx.stroke(); ctx.restore();
      }
      const act = R.restr.filter((q) => q.g(p[0], p[1]) > -0.015);
      for (const q of act) flechaDir(ctx, plano, p, q.gr(p[0], p[1]), 36, C.s1, q.nombre);
      if (nrm(gf) > 1e-3) flechaDir(ctx, plano, p, [-gf[0], -gf[1]], 52, C.s2, '−∇f');
      const a = (theta * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)], cd = clasificar(p, gf, d);
      flecha(ctx, px, py, d[0] * 70, -d[1] * 70, C.tinta, 3);
      VIZ.marcador(ctx, px, py, C.s2, 6);
      const opt = buenas === 0;
      registro.textContent = opt
        ? (act.length ? 'No queda ninguna dirección factible que baje f: todas las direcciones que no salen de la región suben f (o no la cambian). Este es el óptimo restringido.' : 'En el mínimo libre ∇f = 0: ninguna dirección baja f a primer orden. La restricción es inactiva.')
        : `Hay ${buenas} de 72 direcciones que son factibles y bajan f: el punto aún no es óptimo. ${act.length ? 'Las que apuntan hacia fuera de la región están prohibidas por la restricción activa.' : 'Sin restricción activa, toda dirección con ∇f·d < 0 sirve.'}`;
      lectura.set([
        ['punto', ptos(p)], ['f', VIZ.fmt((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2, 4)], ['restricciones activas', String(act.length)],
        ['dir. factibles', `${factibles} de ${N}`], ['factibles que bajan f', `${buenas} de ${N}`],
        ['d elegida', !cd.factible ? 'no factible' : cd.baja ? 'factible y baja f' : 'factible, no baja f'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { p = ajustarFrontera(R, R.proy(q), 0.08); traza = [p.slice()]; dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt((q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2)}</b><br>` + R.restr.map((s) => `${s.nombre} = <b>${VIZ.fmt(s.g(q[0], q[1]), 3)}</b>`).join('  '));
    });
    void sAng;
    R = REGIONES[tipo].crear(r);
    traza = [p.slice()];
    dibujar();
  }

  VIZ.registrarTema('inequality-constraints', {
    intro: String.raw`
      <p>Una <strong>restricción de desigualdad</strong> \(g(x)\le 0\) no obliga a quedarse en una curva, sino a permanecer dentro de una región. Eso cambia el
      problema: el óptimo puede estar en el interior (y entonces la restricción «no se entera») o pegado al borde (y entonces actúa como una pared).</p>
      <p>Una restricción es <strong>activa</strong> en un punto si se cumple con igualdad, \(g(x)=0\), e <strong>inactiva</strong> si se cumple con holgura, \(g(x)<0\). Distinguir ambos casos es
      la idea central detrás de las condiciones de Karush–Kuhn–Tucker.</p>`,
    visualizaciones: [
      {
        titulo: 'Restricción activa o inactiva',
        descripcion: 'Arrastre el centro de las curvas de nivel (el mínimo sin restricciones) dentro y fuera de la región, y cambie la forma de la región. Observe cuándo el óptimo se pega al borde y aparece un multiplicador positivo.',
        montar: montarActivaInactiva,
      },
      {
        titulo: 'Direcciones factibles de descenso',
        descripcion: 'En el punto elegido, las líneas verdes son las direcciones que bajan f sin salir de la región. Pulse «Dar un paso factible de descenso» hasta que no queden: ese es el óptimo.',
        montar: montarDirecciones,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>El problema con desigualdades es</p>
      \[ \min f(x) \quad\text{sujeto a}\quad g_j(x)\le 0,\ \ j=1,\dots,p. \]
      <p>La <strong>región factible</strong> es \(F=\{x: g_j(x)\le 0\ \forall j\}\). En un punto \(x\in F\), el <em>conjunto activo</em> es \(A(x)=\{j : g_j(x)=0\}\). Las restricciones fuera de \(A(x)\) son inactivas y,
      por continuidad, no limitan ningún desplazamiento pequeño.</p>
      <h2>Dos casos para el óptimo</h2>
      <ul>
        <li><strong>Óptimo interior</strong> (\(A(x^*)=\varnothing\)): el óptimo es un mínimo libre local, por tanto \(\nabla f(x^*)=0\). Las restricciones pueden ignorarse.</li>
        <li><strong>Óptimo en la frontera</strong> (\(A(x^*)\neq\varnothing\)): \(\nabla f(x^*)\neq0\) en general, y las restricciones activas impiden bajar más. Se comporta como si fueran igualdades \(g_j=0\), pero con una diferencia:
        solo importa el lado de la pared, así que el multiplicador debe tener un signo definido.</li>
      </ul>
      <h2>Direcciones factibles de descenso</h2>
      <p>Una dirección \(d\) es <em>factible a primer orden</em> en \(x\) si \(\nabla g_j(x)^\top d\le0\) para todo \(j\in A(x)\) (no sale de la región). Es de <em>descenso</em> si \(\nabla f(x)^\top d<0\).
      Si \(x^*\) es un mínimo local, no existe ninguna dirección que sea a la vez factible y de descenso:</p>
      \[ \{d:\ \nabla g_j(x^*)^\top d\le0\ \forall j\in A(x^*)\}\ \cap\ \{d:\ \nabla f(x^*)^\top d<0\}=\varnothing. \]
      <p>Con una igualdad, el conjunto factible de direcciones es un espacio (se puede ir y volver) y la condición obliga a \(\nabla f\perp\) tangente. Con una desigualdad solo se puede ir «hacia adentro»,
      de modo que la condición equivale a que \(-\nabla f\) pertenezca al <strong>cono generado por los gradientes activos</strong>: \(-\nabla f=\sum_{j\in A}\mu_j\nabla g_j\) con \(\mu_j\ge0\).
      Esta es la forma de los multiplicadores que se desarrolla en <a href="tema.html?id=kkt-conditions">las condiciones KKT</a> (lema de Farkas).</p>
      <h2>Ejemplo resuelto</h2>
      <p>Minimizar \(f=(x-2)^2+(y-2)^2\) con \(g=x^2+y^2-2\le0\). El mínimo libre \((2,2)\) viola \(g\) (\(g=6\)). El óptimo es la proyección sobre el disco: \(x^*=(1,1)\), con \(g(x^*)=0\) (activa).
      Ahí \(\nabla f=(-2,-2)\) y \(\nabla g=(2,2)\), por lo que \(\nabla f+\mu\nabla g=0\) da \(\mu=1\ge0\). Si en cambio el centro fuera \((0{,}3;\,0{,}2)\), se cumple \(g<0\) en el centro y el óptimo es interior con \(\mu=0\).</p>
      <h2>Conexiones</h2>
      <p>Con igualdades, el análogo es <a href="tema.html?id=equality-constraints-lagrange">el método de Lagrange</a>. La distinción activa/inactiva se estudia como enumeración en
      <a href="tema.html?id=active-inactive-constraints">restricciones activas e inactivas en KKT</a>. En programación lineal la misma idea explica por qué el óptimo está en un vértice
      (<a href="tema.html?id=active-constraints-bfs">restricciones activas y soluciones básicas factibles</a>).</p>`,
  });
})();
