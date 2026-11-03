(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  const nrm = (a) => Math.hypot(...a);
  const ptos = (v) => `(${VIZ.fmt(v[0], 3)}, ${VIZ.fmt(v[1], 3)})`;
  function planoIgual(l, cx, cy, semi) {
    const m = { izq: 36, der: 12, sup: 12, inf: 26 };
    const pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw, ph) / (2 * semi);
    const hx = pw / (2 * s), hy = ph / (2 * s);
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen: m });
  }

  /* ---------- Fig. 1: problemas en el plano, min f(x, y) s.a. h(x, y) = 0 ---------- */

  const PROB = {
    circulo: { nombre: 'Función lineal sobre un círculo', f: (x, y) => x + 2 * y, h: (x, y) => x * x + y * y - 4, centro: [0, 0], semi: 3.4, niveles: [-4, -3, -2, -1, 0, 1, 2, 3, 4], ini: [1.2, 1.8], tex: 'x+2y + \\lambda\\,(x^2+y^2-4)' },
    recta: { nombre: 'Distancia a un punto desde una recta', f: (x, y) => (x - 3) ** 2 + (y - 1) ** 2, h: (x, y) => x + y - 2, centro: [1.5, 1], semi: 4.2, niveles: [0.5, 2, 4, 8, 13, 20, 28], ini: [-1, 3], tex: '(x-3)^2+(y-1)^2 + \\lambda\\,(x+y-2)' },
    producto: { nombre: 'Maximizar un producto con suma fija', f: (x, y) => -x * y, h: (x, y) => x + y - 4, centro: [2, 2], semi: 3.6, niveles: [-6, -4, -2, -1, 0, 1, 2, 4, 6], ini: [0.6, 3], tex: '-xy + \\lambda\\,(x+y-4)' },
    elipse: { nombre: 'Distancia a un punto desde una elipse', f: (x, y) => (x - 1.2) ** 2 + (y - 1.4) ** 2, h: (x, y) => (x * x) / 4 + y * y - 1, centro: [0.6, 0.5], semi: 3.3, niveles: [0.3, 0.8, 1.6, 2.6, 4, 6, 9, 13], ini: [1.2, 1.6], tex: '(x-1{,}2)^2+(y-1{,}4)^2 + \\lambda\\,(x^2/4+y^2-1)' },
  };
  const LISTA = Object.entries(PROB).map(([k, p]) => [k, p.nombre]);

  function montarNewton(cuerpo) {
    let P = PROB.circulo, lam0 = 0, ini = P.ini.slice(), its = [], semilla = 1, plano = null;
    const Lf = (z) => P.f(z[0], z[1]) + z[2] * P.h(z[0], z[1]);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'circulo', alCambiar: (v) => { P = PROB[v]; ini = P.ini.slice(); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'λ inicial', min: -3, max: 3, paso: 0.1, valor: lam0, alCambiar: (v) => { lam0 = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Inicio al azar', () => {
      const r = VIZ.semilla(semilla++ * 97 + 5);
      ini = [P.centro[0] + (r() * 2 - 1) * P.semi * 0.8, P.centro[1] + (r() * 2 - 1) * P.semi * 0.6];
      rep.reiniciar();
    });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.68, altoMin: 290, altoMax: 450 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'restricción h = 0', forma: 'linea' },
      { color: C.eje, texto: 'curvas de nivel de f', forma: 'linea' },
      { color: C.s1, texto: 'iteraciones de Newton', forma: 'linea' },
      { color: C.s2, texto: 'iteración actual', forma: 'punto' },
      { color: C.superficie, borde: C.tinta2, texto: 'inicio' },
      { color: C.s6, texto: 'punto estacionario de L', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para elegir el punto inicial \\((x_0,y_0)\\) y cambie \\(\\lambda_0\\) con el control. Desde inicios distintos Newton puede llegar al mínimo o al máximo restringido: ambos anulan \\(\\nabla L\\).');

    function iniciar() {
      its = [{ z: [ini[0], ini[1], lam0] }];
      return (function* () {
        for (let k = 0; k < 16; k++) {
          const z = its[its.length - 1].z, g = O.grad(Lf, z);
          if (nrm(g) < 1e-7) return;
          const d = O.resolver(O.hess(Lf, z), g.map((v) => -v));
          if (!d || d.some((v) => !Number.isFinite(v)) || nrm(d) > 1e3) { its.push({ z, falla: true }); return; }
          its.push({ z: z.map((v, i) => v + d[i]) });
          yield;
        }
      })();
    }
    function clasificar(z) {
      const gh = O.grad((q) => P.h(q[0], q[1]), [z[0], z[1]]);
      const Hxx = O.hess((q) => P.f(q[0], q[1]) + z[2] * P.h(q[0], q[1]), [z[0], z[1]]);
      const t = [-gh[1], gh[0]], n = nrm(t);
      const u = [t[0] / n, t[1] / n];
      const cur = u[0] * (Hxx[0][0] * u[0] + Hxx[0][1] * u[1]) + u[1] * (Hxx[1][0] * u[0] + Hxx[1][1] * u[1]);
      return { cur, tipo: cur > 1e-6 ? 'mínimo restringido' : cur < -1e-6 ? 'máximo restringido' : 'indeterminado' };
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, P.centro[0], P.centro[1], P.semi);
      plano.ejes();
      ctx.save();
      plano.recortar();
      for (const c of P.niveles) ML.contorno(ctx, plano, P.f, c, { color: C.eje, ancho: 1.2, paso: 6 });
      ML.contorno(ctx, plano, P.h, 0, { color: C.tinta, ancho: 3, paso: 3 });
      ctx.restore();
      VIZ.trazar(ctx, plano, its.map((s) => [s.z[0], s.z[1]]), C.s1, 2);
      ctx.save(); ctx.strokeStyle = C.tinta2; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
      ctx.beginPath(); ctx.arc(plano.sx(ini[0]), plano.sy(ini[1]), 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
      const ult = its[its.length - 1], g = O.grad(Lf, ult.z), ng = nrm(g);
      its.forEach((s, k) => { if (k > 0 && k < its.length - 1) VIZ.marcador(ctx, plano.sx(s.z[0]), plano.sy(s.z[1]), C.s1, 3.5); });
      const conv = ng < 1e-6;
      VIZ.marcador(ctx, plano.sx(ult.z[0]), plano.sy(ult.z[1]), conv ? C.s6 : C.s2, conv ? 6.5 : 5);
      const cl = conv ? clasificar(ult.z) : null;
      registro.textContent = ult.falla ? 'La matriz del sistema es singular o el paso se dispara: pruebe otro inicio.'
        : conv ? `Convergió: ∇L = 0 en ${ptos(ult.z)} con λ = ${VIZ.fmt(ult.z[2], 4)}. Curvatura de L sobre la tangente = ${VIZ.fmt(cl.cur, 3)} → ${cl.tipo}.`
          : its.length === 1 ? `Inicio en ${ptos(ult.z)} con λ₀ = ${VIZ.fmt(lam0, 3)}. Cada paso resuelve el sistema lineal ∇²L·Δz = −∇L en (x, y, λ).`
            : `Paso ${its.length - 1}: Newton sobre ∇L(x, y, λ) = 0 lleva a ${ptos(ult.z)}, λ = ${VIZ.fmt(ult.z[2], 3)}; h = ${VIZ.fmt(P.h(ult.z[0], ult.z[1]), 2)}.`;
      lectura.set([
        ['iteración', String(its.length - 1)], ['(x, y)', ptos(ult.z)], ['λ', VIZ.fmt(ult.z[2], 4)],
        ['‖∇L‖', VIZ.fmt(ng, 2)], ['f', VIZ.fmt(P.f(ult.z[0], ult.z[1]), 4)], ['h', VIZ.fmt(P.h(ult.z[0], ult.z[1]), 2)],
      ]);
      const filas = its.map((s, k) => `<tr><td>${k}</td><td>${VIZ.fmt(s.z[0], 5)}</td><td>${VIZ.fmt(s.z[1], 5)}</td><td>${VIZ.fmt(s.z[2], 5)}</td><td>${VIZ.fmt(nrm(O.grad(Lf, s.z)), 2)}</td></tr>`).join('');
      caja.innerHTML = `<table class="tabla-datos sin-corte"><thead><tr><th>k</th><th>x</th><th>y</th><th>λ</th><th>‖∇L‖</th></tr></thead><tbody>${filas}</tbody></table>`;
    }
    lienzo.alDibujar = () => its.length && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return;
      ini = [plano.ix(pos.x), plano.iy(pos.y)];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const x = plano.ix(pos.x), y = plano.iy(pos.y);
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(x, 3)}, ${VIZ.fmt(y, 3)})<br>f = <b>${VIZ.fmt(P.f(x, y))}</b><br>h = <b>${VIZ.fmt(P.h(x, y))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: L(x, λ) como superficie de silla (una variable x) ---------- */

  const UNA = {
    a: { nombre: 'min (x − 3)²  s.a. x = 1', f: (x) => (x - 3) ** 2, fp: (x) => 2 * (x - 3), f2: () => 2, h: (x) => x - 1, hp: () => 1, h2: () => 0, dom: [-2, 4, -3, 9] },
    c: { nombre: 'min x  s.a. x² = 1', f: (x) => x, fp: () => 1, f2: () => 0, h: (x) => x * x - 1, hp: (x) => 2 * x, h2: () => 2, dom: [-2.2, 2.2, -2, 2] },
    d: { nombre: 'min (x − 2)²  s.a. x² = 1', f: (x) => (x - 2) ** 2, fp: (x) => 2 * (x - 2), f2: () => 2, h: (x) => x * x - 1, hp: (x) => 2 * x, h2: () => 2, dom: [-2.5, 3, -6, 4] },
  };

  function montarSilla(cuerpo) {
    let clave = 'a', P = UNA.a, eta = 0.1, z = [-1, 6], tray = [], fondo = null, claveFondo = '', plano = null, hover = null;
    const L = (x, l) => P.f(x) + l * P.h(x);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(UNA).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; P = UNA[v]; z = [(P.dom[0] + P.dom[1]) / 2 - 0.4, (P.dom[2] + P.dom[3]) / 2 + 0.7]; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Paso η', min: 0.02, max: 0.4, paso: 0.01, valor: eta, alCambiar: (v) => { eta = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 430 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.apagado, texto: 'L baja' },
      { color: VIZ.rampaGris[5], texto: 'L alta' },
      { color: C.s1, texto: 'restricción h(x) = 0', forma: 'linea' },
      { color: C.s2, texto: 'descenso en x, ascenso en λ', forma: 'linea' },
      { color: C.s6, texto: 'punto estacionario', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para elegir un punto \\((x,\\lambda)\\) y pulse «Reproducir»: x baja por L y λ sube. Los puntos estacionarios (círculos verdes) son sillas, nunca mínimos de L.');

    // Puntos estacionarios de L: Newton en (x, λ) desde una rejilla de inicios.
    function estacionarios() {
      const res = [];
      const [x0, x1, l0, l1] = P.dom;
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
        let q = [x0 + ((x1 - x0) * i) / 6, l0 + ((l1 - l0) * j) / 6];
        for (let k = 0; k < 40; k++) {
          const gx = P.fp(q[0]) + q[1] * P.hp(q[0]), gl = P.h(q[0]);
          const d = O.resolver([[P.f2(q[0]) + q[1] * P.h2(q[0]), P.hp(q[0])], [P.hp(q[0]), 0]], [-gx, -gl]);
          if (!d) break;
          q = [q[0] + d[0], q[1] + d[1]];
          if (Math.hypot(gx, gl) < 1e-12) break;
        }
        if (Math.abs(P.h(q[0])) < 1e-9 && Math.abs(P.fp(q[0]) + q[1] * P.hp(q[0])) < 1e-9 && q[0] >= x0 && q[0] <= x1 && q[1] >= l0 && q[1] <= l1 && !res.some((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1e-5)) res.push(q);
      }
      return res;
    }
    let crit = estacionarios();
    function iniciar() {
      crit = estacionarios();
      tray = [z.slice()];
      return (function* () {
        for (let k = 0; k < 400; k++) {
          const [x, l] = tray[tray.length - 1];
          const gx = P.fp(x) + l * P.hp(x), gl = P.h(x);
          if (Math.hypot(gx, gl) < 1e-6) return;
          const n = [x - eta * gx, l + eta * gl];
          if (!Number.isFinite(n[0]) || Math.abs(n[0]) > 50 || Math.abs(n[1]) > 50) return;
          tray.push(n);
          yield;
        }
      })();
    }
    function construirFondo() {
      const W = lienzo.ancho, H = lienzo.alto, dpr = window.devicePixelRatio || 1;
      const off = document.createElement('canvas');
      off.width = Math.round(W * dpr); off.height = Math.round(H * dpr);
      const o = off.getContext('2d');
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      const l2 = { ctx: o, ancho: W, alto: H };
      const p = VIZ.plano(l2, { xmin: P.dom[0], xmax: P.dom[1], ymin: P.dom[2], ymax: P.dom[3] }, { etiquetaX: 'x', etiquetaY: 'λ', margen: { izq: 44 } });
      p.ejes();
      const paso = 4, celdas = [];
      for (let px = p.x0; px < p.x1; px += paso) for (let py = p.y1; py < p.y0; py += paso) celdas.push([px, py, L(p.ix(px + paso / 2), p.iy(py + paso / 2))]);
      const orden = celdas.map((c) => c[2]).sort((a, b) => a - b);
      const lo = orden[Math.floor(orden.length * 0.03)], hi = orden[Math.floor(orden.length * 0.97)];
      for (const [px, py, v] of celdas) {
        o.fillStyle = VIZ.css(VIZ.enRampa((v - lo) / (hi - lo || 1), VIZ.rampaGris));
        o.fillRect(px, py, Math.min(paso, p.x1 - px), Math.min(paso, p.y0 - py));
      }
      o.save();
      p.recortar();
      for (let k = 1; k <= 12; k++) ML.contorno(o, p, L, lo + ((hi - lo) * k) / 13, { color: VIZ.alfa(C.tinta2, 0.45), ancho: 0.9, paso: 5 });
      o.restore();
      fondo = off; claveFondo = `${clave}|${W}|${H}`;
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      if (claveFondo !== `${clave}|${lienzo.ancho}|${lienzo.alto}`) construirFondo();
      ctx.drawImage(fondo, 0, 0, lienzo.ancho, lienzo.alto);
      plano = VIZ.plano(lienzo, { xmin: P.dom[0], xmax: P.dom[1], ymin: P.dom[2], ymax: P.dom[3] }, { etiquetaX: 'x', etiquetaY: 'λ', margen: { izq: 44 } });
      ctx.save();
      plano.recortar();
      // h(x) = 0: rectas verticales (raíces de h)
      const raices = crit.map((q) => q[0]).filter((v, i, a) => a.findIndex((w) => Math.abs(w - v) < 1e-6) === i);
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      for (const r of raices) { ctx.beginPath(); ctx.moveTo(plano.sx(r), plano.y1); ctx.lineTo(plano.sx(r), plano.y0); ctx.stroke(); }
      ctx.setLineDash([]);
      VIZ.trazar(ctx, plano, tray, C.s2, 2.5);
      ctx.restore();
      for (const q of crit) VIZ.marcador(ctx, plano.sx(q[0]), plano.sy(q[1]), C.s6, 6.5);
      const [x, l] = tray[tray.length - 1];
      VIZ.marcador(ctx, plano.sx(x), plano.sy(l), C.s2, 5);
      const gx = P.fp(x) + l * P.hp(x), gl = P.h(x), a = P.f2(x) + l * P.h2(x), b = P.hp(x);
      const ev = O.propios([[a, b], [b, 0]]).map((q) => q.valor);
      const fin = Math.hypot(gx, gl) < 1e-5;
      registro.textContent = fin ? `Se llegó a un punto estacionario: ∂L/∂x = ${VIZ.fmt(gx, 2)} y h = ${VIZ.fmt(gl, 2)}, o sea x = ${VIZ.fmt(x, 4)} es factible y ∇f + λ∇h = 0 con λ = ${VIZ.fmt(l, 4)}.`
        : tray.length === 1 ? 'Elija un punto (x, λ). En él, ∂L/∂x mide si conviene mover x y h(x) mide cuánto se viola la restricción.'
          : `Paso ${tray.length - 1}: x se mueve contra ∂L/∂x = ${VIZ.fmt(gx, 3)} y λ se mueve a favor de h = ${VIZ.fmt(gl, 3)}.`;
      lectura.set([
        ['(x, λ)', `(${VIZ.fmt(x, 3)}, ${VIZ.fmt(l, 3)})`], ['L', VIZ.fmt(L(x, l), 4)], ['∂L/∂x', VIZ.fmt(gx, 3)], ['h(x)', VIZ.fmt(gl, 3)],
        ['det de la Hessiana', VIZ.fmt(-b * b, 3)], ['valores propios', `${VIZ.fmt(ev[0], 3)} ; ${VIZ.fmt(ev[1], 3)}`],
      ]);
    }
    lienzo.alDibujar = () => { claveFondo = ''; tray.length && dibujar(); };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return;
      z = [plano.ix(pos.x), plano.iy(pos.y)];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) { hover = null; return tip.ocultar(); }
      hover = { x: pos.x, y: pos.y, vx: plano.ix(pos.x), vl: plano.iy(pos.y) };
      tip.mostrar(pos.x, pos.y, `x = <b>${VIZ.fmt(hover.vx, 3)}</b>, λ = <b>${VIZ.fmt(hover.vl, 3)}</b><br>L = <b>${VIZ.fmt(L(hover.vx, hover.vl))}</b><br>∂L/∂x = <b>${VIZ.fmt(P.fp(hover.vx) + hover.vl * P.hp(hover.vx), 3)}</b><br>h = <b>${VIZ.fmt(P.h(hover.vx), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('lagrangian-function', {
    intro: String.raw`
      <p>La <strong>función lagrangiana</strong> convierte un problema con restricciones en un problema <em>sin</em> restricciones, a costa de agregar una variable por restricción:
      el multiplicador. En lugar de «minimizar \(f\) obedeciendo \(h=0\)», se buscan los puntos donde la función \(L(x,\lambda)=f(x)+\lambda\,h(x)\) tiene gradiente cero.</p>
      <p>Es un cambio de punto de vista muy útil: las dos condiciones del óptimo (el gradiente de \(f\) paralelo al de \(h\), y la restricción cumplida) son
      simplemente \(\nabla L=0\). Resolver ese sistema —aquí con el método de Newton— entrega a la vez el punto y el multiplicador.</p>`,
    visualizaciones: [
      {
        titulo: 'Resolver ∇L = 0 con Newton',
        descripcion: 'Elija un inicio con un clic y pulse «Un paso» para ver cómo Newton resuelve las tres ecuaciones en \\((x,y,\\lambda)\\). Pruebe inicios distintos: algunos terminan en el mínimo y otros en el máximo restringido.',
        montar: montarNewton,
      },
      {
        titulo: 'La lagrangiana es una silla',
        descripcion: 'Con una sola variable, \\(L(x,\\lambda)\\) es una superficie en el plano \\((x,\\lambda)\\). Haga clic en un punto y reproduzca descenso en x con ascenso en \\(\\lambda\\): la trayectoria busca la silla; compare los tres problemas.',
        montar: montarSilla,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Para \(\min f(x)\) sujeto a \(h_i(x)=0\), \(i=1,\dots,m\), la <strong>lagrangiana</strong> es</p>
      \[ L(x,\lambda)=f(x)+\sum_{i=1}^{m}\lambda_i\,h_i(x), \qquad \lambda\in\mathbb{R}^m. \]
      <p>Los \(\lambda_i\) son los <em>multiplicadores</em> (o variables duales). Las derivadas parciales de \(L\) son</p>
      \[ \nabla_x L = \nabla f(x)+\sum_i\lambda_i\nabla h_i(x), \qquad \nabla_\lambda L = h(x). \]
      <p>Por lo tanto \(\nabla L(x,\lambda)=0\) equivale a <strong>estacionariedad</strong> (\(\nabla_xL=0\)) más <strong>factibilidad</strong> (\(h=0\)).
      Si \(x^*\) es un mínimo local regular (\(\nabla h_i(x^*)\) linealmente independientes), existe \(\lambda^*\) con \(\nabla L(x^*,\lambda^*)=0\).</p>
      <h2>Resolver el sistema</h2>
      <p>Con \(n\) variables y \(m\) restricciones hay \(n+m\) ecuaciones en \(n+m\) incógnitas. El método de Newton usa la Hessiana de \(L\) (la <em>matriz KKT</em>):</p>
      \[ \begin{pmatrix}\nabla^2_{xx}L & \nabla h^\top\\ \nabla h & 0\end{pmatrix}\begin{pmatrix}\Delta x\\ \Delta\lambda\end{pmatrix}=-\begin{pmatrix}\nabla_x L\\ h\end{pmatrix}. \]
      <pre><code>z ← (x₀, λ₀)
mientras ‖∇L(z)‖ &gt; ε:
    resolver ∇²L(z) Δz = −∇L(z)
    z ← z + Δz
devolver z</code></pre>
      <p>La convergencia es cuadrática cerca de una solución regular, pero Newton no distingue mínimos de máximos: converge a cualquier punto estacionario. Por eso la figura 1 puede terminar en el máximo restringido.</p>
      <h2>Por qué es una silla</h2>
      <p>En el punto estacionario, \(L\) <em>no</em> tiene un mínimo: la Hessiana respecto de \((x,\lambda)\) es la matriz de bloques anterior, cuyo bloque \(\lambda\lambda\) es cero. Con una variable,
      \(\det\begin{pmatrix}a&b\\ b&0\end{pmatrix}=-b^2\le 0\) con \(b=h'(x)\): los valores propios tienen signos opuestos (o hay uno nulo) y el punto es de <strong>silla</strong>. Esto significa que no puede encontrarse
      \((x^*,\lambda^*)\) minimizando \(L\) en todas las variables (L es lineal en \(\lambda\), así que no está acotada inferiormente). Lo que sí ocurre, bajo condiciones de segundo orden, es que
      \(L(\cdot,\lambda^*)\) tiene un mínimo local en \(x^*\) sobre el espacio tangente: la dirección «descender en x, ascender en λ» tiende al punto estacionario.</p>
      <h2>Ejemplo resuelto</h2>
      <p>\(\min (x-3)^2\) sujeto a \(x-1=0\): \(L=(x-3)^2+\lambda(x-1)\), \(\partial_xL=2(x-3)+\lambda=0\), \(h=x-1=0\). Entonces \(x^*=1\) y \(\lambda^*=4\); \(L^*=f(1)=4\).
      Con \(x^2=1\) y \(f=x\): \(1+2\lambda x=0\) y \(x=\pm1\) dan \((x,\lambda)=(-1,\tfrac12)\) (mínimo) y \((1,-\tfrac12)\) (máximo).</p>
      <h2>Conexiones</h2>
      <p>Es la forma compacta de la condición vista en <a href="tema.html?id=equality-constraints-lagrange">restricciones de igualdad</a>; al agregar desigualdades se obtienen las
      <a href="tema.html?id=kkt-conditions">condiciones KKT</a>. La lagrangiana también es la base de la dualidad (como en <a href="tema.html?id=strong-duality">dualidad fuerte</a>, donde el máximo sobre \(\lambda\) del mínimo sobre \(x\) de \(L\) recupera el óptimo)
      y del método del <a href="tema.html?id=constrained-nlp-solving">Lagrangiano aumentado</a>.</p>`,
  });
})();
