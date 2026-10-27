(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;

  const MODELOS = {
    exponencial: {
      nombre: 'Decaimiento y = a·e^(−b·x)', params: ['a', 'b'], real: [1.5, 0.9], inicio: [0.4, 2.6], x: [0, 4],
      rango: [[0, 3], [-0.4, 3]],
      f: (x, [a, b]) => a * Math.exp(-b * x),
      J: (x, [a, b]) => [Math.exp(-b * x), -a * x * Math.exp(-b * x)],
    },
    seno: {
      nombre: 'Oscilación y = sen(ω·x + φ)', params: ['ω', 'φ'], real: [1.3, 0.5], inicio: [1.9, -1.2], x: [0, 6],
      rango: [[0.2, 3], [-Math.PI, Math.PI]],
      f: (x, [w, p]) => Math.sin(w * x + p),
      J: (x, [w, p]) => [x * Math.cos(w * x + p), Math.cos(w * x + p)],
    },
  };
  const METODOS = [['gn', 'Gauss-Newton', C.s1], ['lm', 'Levenberg-Marquardt', C.s2], ['gd', 'Descenso de gradiente', C.s3]];

  // Estado compartido por las dos figuras.
  const est = { modelo: 'exponencial', ruido: 0.08, semilla: 3, inicio: null, datos: [], oyentes: [] };
  const M = () => MODELOS[est.modelo];
  function generar() {
    const m = M(), rnd = VIZ.semilla(est.semilla);
    est.datos = Array.from({ length: 30 }, (_, i) => {
      const x = m.x[0] + ((m.x[1] - m.x[0]) * (i + 0.5)) / 30;
      return { x, y: m.f(x, m.real) + VIZ.normal(rnd) * est.ruido };
    });
    if (!est.inicio) est.inicio = m.inicio.slice();
  }
  const avisar = () => est.oyentes.forEach((f) => f());
  const costo = (th) => 0.5 * est.datos.reduce((s, d) => s + (d.y - M().f(d.x, th)) ** 2, 0);

  // Un paso de cada método. Devuelve el nuevo θ (y actualiza λ en LM).
  function paso(metodo, th, ctx) {
    const m = M();
    const J = est.datos.map((d) => m.J(d.x, th)), r = est.datos.map((d) => d.y - m.f(d.x, th));
    const JtJ = P.mul(P.trasp(J), J), Jtr = P.mulVec(P.trasp(J), r);
    const c0 = costo(th);
    if (metodo === 'gn') return th.map((t, k) => t + VIZ.ml.resolver(JtJ, Jtr)[k]);
    if (metodo === 'lm') {
      for (let intento = 0; intento < 12; intento++) {
        const A = JtJ.map((f, i) => f.map((v, j) => v + (i === j ? ctx.lambda * Math.max(v, 1e-9) : 0)));
        const d = VIZ.ml.resolver(A, Jtr), nuevo = th.map((t, k) => t + d[k]);
        if (costo(nuevo) < c0) { ctx.lambda = Math.max(1e-7, ctx.lambda / 10); return nuevo; }
        ctx.lambda *= 10;
      }
      return th;
    }
    // Descenso de gradiente con búsqueda de paso por retroceso (Armijo); el gradiente del costo es −Jᵀr.
    let t = ctx.t || 1;
    const g2 = Jtr.reduce((s, v) => s + v * v, 0);
    for (let k = 0; k < 40; k++) {
      const nuevo = th.map((v, i) => v + t * Jtr[i]);
      if (costo(nuevo) <= c0 - 0.3 * t * g2) { ctx.t = t * 2; return nuevo; }
      t /= 2;
    }
    ctx.t = t;
    return th;
  }
  function trayectoria(metodo, n = 60) {
    let th = est.inicio.slice();
    const ctx = { lambda: 1e-2 }, tr = [{ th, c: costo(th), lambda: ctx.lambda }];
    for (let i = 0; i < n; i++) {
      const nuevo = paso(metodo, th, ctx);
      if (!nuevo.every(Number.isFinite) || nuevo.some((v) => Math.abs(v) > 1e3)) break;
      th = nuevo;
      tr.push({ th, c: costo(th), lambda: ctx.lambda });
      if (!Number.isFinite(tr[tr.length - 1].c) || tr[tr.length - 1].c > 1e6 * (tr[0].c + 1)) { tr.divergio = true; break; }
    }
    return tr;
  }

  /* ---------- Fig. 1: iteraciones ---------- */

  function montarIteraciones(cuerpo) {
    let metodo = 'gn', tr = [], it = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: Object.entries(MODELOS).map(([k, m]) => [k, m.nombre]), valor: est.modelo,
      alCambiar: (v) => { est.modelo = v; est.inicio = null; generar(); avisar(); } });
    ctl.selector({ etiqueta: 'Método', opciones: METODOS.map(([k, t]) => [k, t]), valor: metodo, alCambiar: (v) => { metodo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.4, paso: 0.01, valor: est.ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { est.ruido = v; generar(); avisar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { est.semilla++; generar(); avisar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 2 : 1) * Math.min(340, Math.round((w < 560 ? w : w / 2) * 0.8)) + (w < 560 ? 16 : 0) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'dato', forma: 'punto' },
      { color: C.s2, texto: 'modelo en la iteración actual', forma: 'linea' },
      { color: C.apagado, texto: 'modelo verdadero', forma: 'linea' },
      { color: VIZ.css(VIZ.enRampa(0.7)), texto: 'costo S(θ) (más oscuro = mayor, escala log)' },
      { color: C.s4, texto: 'recorrido de θ', forma: 'linea' },
      { color: C.s6, texto: 'parámetros verdaderos', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la superficie de costo para elegir el punto de partida. Desde el punto inicial del decaimiento, Gauss-Newton da un salto enorme y diverge, mientras Levenberg-Marquardt llega en pocas iteraciones. Con la oscilación, parta lejos en ω para caer en otros mínimos locales.');

    function iniciar() {
      tr = trayectoria(metodo); it = 0;
      return (function* () { for (it = 1; it < tr.length; it++) yield; it = tr.length - 1; })();
    }
    let superficie = null, geo = null;
    function calcularSuperficie(nx, ny) {
      const m = M(), v = [];
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const th = [m.rango[0][0] + ((m.rango[0][1] - m.rango[0][0]) * (i + 0.5)) / nx, m.rango[1][1] - ((m.rango[1][1] - m.rango[1][0]) * (j + 0.5)) / ny];
        const c = Math.log10(costo(th) + 1e-6);
        v.push(c); lo = Math.min(lo, c); hi = Math.max(hi, c);
      }
      superficie = { nx, ny, v, lo, hi, clave: `${est.modelo}|${est.semilla}|${est.ruido}` };
    }
    function dibujar() {
      if (!tr.length) return;
      const { ctx, ancho, alto } = lienzo;
      lienzo.limpiar();
      const m = M(), th = tr[Math.min(it, tr.length - 1)].th, apilar = ancho < 560;
      const wp = apilar ? ancho : ancho / 2 - 8, hp = apilar ? (alto - 16) / 2 : alto;
      // Datos y modelo (panel izquierdo o superior).
      const sub = { ancho: wp, alto: hp, ctx };
      const yv = est.datos.map((d) => d.y), ymin = Math.min(...yv, -0.2) - 0.2, ymax = Math.max(...yv) + 0.3;
      const p1 = VIZ.plano(sub, { xmin: m.x[0], xmax: m.x[1], ymin, ymax }, { etiquetaX: 'x', etiquetaY: 'y', margen: { izq: 40 } });
      ctx.save();
      p1.ejes();
      const xs = Array.from({ length: 121 }, (_, i) => m.x[0] + ((m.x[1] - m.x[0]) * i) / 120);
      VIZ.trazar(ctx, p1, xs.map((x) => [x, m.f(x, m.real)]), C.apagado, 1.5, [4, 4]);
      ctx.save(); ctx.beginPath(); ctx.rect(p1.x0, p1.y1, p1.x1 - p1.x0, p1.y0 - p1.y1); ctx.clip();
      VIZ.trazar(ctx, p1, xs.map((x) => [x, m.f(x, th)]), C.s2, 2.5);
      ctx.restore();
      for (const d of est.datos) VIZ.marcador(ctx, p1.sx(d.x), p1.sy(d.y), C.s1, 3.5);
      ctx.restore();
      // Superficie de costo (panel derecho o inferior).
      const ox = apilar ? 0 : wp + 16, oy = apilar ? hp + 16 : 0;
      ctx.save();
      ctx.translate(ox, oy);
      const sub2 = { ancho: wp, alto: hp, ctx };
      const p2 = VIZ.plano(sub2, { xmin: m.rango[0][0], xmax: m.rango[0][1], ymin: m.rango[1][0], ymax: m.rango[1][1] }, { etiquetaX: m.params[0], etiquetaY: m.params[1], margen: { izq: 40 } });
      const nx = 70, ny = 60;
      if (!superficie || superficie.clave !== `${est.modelo}|${est.semilla}|${est.ruido}`) calcularSuperficie(nx, ny);
      const cw = (p2.x1 - p2.x0) / nx, ch = (p2.y0 - p2.y1) / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const t = (superficie.v[j * nx + i] - superficie.lo) / (superficie.hi - superficie.lo || 1);
        ctx.fillStyle = VIZ.css(VIZ.enRampa(t));
        ctx.fillRect(p2.x0 + i * cw, p2.y1 + j * ch, cw + 0.6, ch + 0.6);
      }
      p2.ejes();
      VIZ.trazar(ctx, p2, tr.slice(0, it + 1).map((s) => s.th), C.s4, 2);
      tr.slice(0, it + 1).forEach((s) => VIZ.marcador(ctx, p2.sx(s.th[0]), p2.sy(s.th[1]), C.s4, 3));
      VIZ.marcador(ctx, p2.sx(m.real[0]), p2.sy(m.real[1]), C.s6, 5.5, 6);
      VIZ.marcador(ctx, p2.sx(th[0]), p2.sy(th[1]), C.s2, 5);
      ctx.restore();
      geo = { ox, oy, p2 };
      const s = tr[Math.min(it, tr.length - 1)];
      registro.textContent = it === 0
        ? `Punto de partida θ₀ = (${th.map((v) => v.toFixed(3)).join(', ')}), costo ${VIZ.fmt(s.c, 4)}.`
        : `Iteración ${it}: θ = (${th.map((v) => v.toFixed(3)).join(', ')}), costo ${VIZ.fmt(s.c, 4)}${metodo === 'lm' ? `, λ = ${VIZ.fmt(s.lambda, 2)}` : ''}.`;
      lectura.set([
        ['iteración', `${it} de ${tr.length - 1}`],
        ['costo S(θ)', VIZ.fmt(s.c, 4)],
        ['parámetros', `${m.params[0]} = ${th[0].toFixed(3)}, ${m.params[1]} = ${th[1].toFixed(3)}`],
        ['verdaderos', `${m.params[0]} = ${m.real[0]}, ${m.params[1]} = ${m.real[1]}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    est.oyentes.push(() => rep.reiniciar());
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), { ox, oy, p2 } = geo;
      if (!p2.dentro(x - ox, y - oy)) return;
      est.inicio = [p2.ix(x - ox), p2.iy(y - oy)];
      avisar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), { ox, oy, p2 } = geo;
      if (!p2.dentro(x - ox, y - oy)) return tip.ocultar();
      const th = [p2.ix(x - ox), p2.iy(y - oy)];
      tip.mostrar(x, y, `${M().params[0]} = <b>${th[0].toFixed(3)}</b>, ${M().params[1]} = <b>${th[1].toFixed(3)}</b><br>costo <b>${VIZ.fmt(costo(th), 4)}</b><br>clic: partir de aquí`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: velocidad de convergencia ---------- */

  function montarConvergencia(cuerpo) {
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, METODOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Usa el modelo, los datos y el punto de partida de la figura anterior. Eje vertical logarítmico: el costo menos el mínimo encontrado por cualquiera de los métodos.');

    let trs = [], plano = null, cmin = 0;
    function dibujar() {
      if (!est.datos.length) return;
      trs = METODOS.map(([k]) => trayectoria(k, 60));
      cmin = Math.min(...trs.flat().map((s) => s.c));
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ex = (c) => Math.max(1e-12, c - cmin);
      const ymax = Math.min(Math.max(...trs.flat().map((s) => ex(s.c))) * 3, ex(trs[0][0].c) * 1e4);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 60, ymin: 1e-12, ymax }, { logY: true, etiquetaX: 'iteración', etiquetaY: 'S(θ) − S mínimo', margen: { izq: 54 },
        formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      plano.ejes();
      ctx.save(); plano.recortar();
      trs.forEach((tr, i) => VIZ.trazar(ctx, plano, tr.map((s, k) => [k, ex(s.c)]), METODOS[i][2], 2));
      ctx.restore();
      const iter = (tr) => {
        const k = tr.findIndex((s) => s.c - cmin < 1e-8 * (1 + cmin));
        if (k >= 0) return String(k);
        return tr.divergio || tr[tr.length - 1].c > tr[0].c ? 'diverge' : tr.length < 61 ? 'se detiene' : '> 60';
      };
      lectura.set(METODOS.map(([, t], i) => [`iteraciones ${t}`, iter(trs[i])]).concat([['costo final mínimo', VIZ.fmt(cmin, 4)]]));
    }
    lienzo.alDibujar = dibujar;
    est.oyentes.push(dibujar);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const k = Math.round(plano.ix(x));
      tip.mostrar(x, y, `iteración <b>${k}</b>` + trs.map((tr, i) => VIZ.filaTooltip(METODOS[i][2], METODOS[i][1], tr[k] ? VIZ.fmt(tr[k].c, 4) : '—')).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('nonlinear-estimation', {
    intro: String.raw`
      <p>Muchos modelos no son lineales en sus parámetros: un decaimiento exponencial, una oscilación, la distancia geométrica a un
      círculo, la proyección de una cámara. Minimizar la suma de residuos al cuadrado ya no tiene fórmula cerrada y hay que
      <strong>iterar</strong>: partir de una estimación, linealizar el modelo alrededor de ella y resolver un problema de
      <a href="tema.html?id=least-squares">mínimos cuadrados</a> lineal para corregirla.</p>
      <p><strong>Gauss-Newton</strong> converge muy rápido cerca de la solución pero puede divergir lejos de ella. El
      <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a> siempre baja, pero lento. <strong>Levenberg-Marquardt</strong>
      interpola entre ambos y es el método estándar.</p>`,
    visualizaciones: [
      {
        titulo: 'Iteraciones sobre la superficie de costo',
        descripcion: 'A la izquierda, los datos y el modelo actual; a la derecha, el costo para cada par de parámetros y el recorrido del método. Ejecute paso a paso con cada método.',
        montar: montarIteraciones,
      },
      {
        titulo: 'Velocidad de convergencia',
        descripcion: 'Cuánto falta para el mínimo en cada iteración. Gauss-Newton y Levenberg-Marquardt convergen casi cuadráticamente cerca de la solución; el gradiente, linealmente.',
        montar: montarConvergencia,
      },
    ],
    teoria: String.raw`
      <h2>Problema</h2>
      <p>Dados datos \((x_i, y_i)\) y un modelo \(f(x; \theta)\), se minimiza</p>
      \[ S(\theta) = \tfrac12 \sum_{i=1}^n r_i(\theta)^2, \qquad r_i(\theta) = y_i - f(x_i; \theta). \]
      <p>Si el ruido es gaussiano, el mínimo es el estimador de máxima verosimilitud.</p>
      <h2>Gauss-Newton</h2>
      <p>Con el jacobiano \(J_{ij} = \partial f(x_i; \theta)/\partial \theta_j\), el modelo linealizado es \(f(\theta + \delta) \approx f(\theta) + J\delta\), y
      el paso que minimiza los residuos linealizados resuelve un problema de mínimos cuadrados lineal:</p>
      \[ (J^\top J)\, \delta = J^\top r, \qquad \theta \leftarrow \theta + \delta. \]
      <p>Equivale al método de Newton con el hessiano aproximado por \(J^\top J\) (se ignoran los términos \(r_i \nabla^2 f_i\), pequeños si
      los residuos lo son). Cerca de una solución con residuos chicos converge casi cuadráticamente; lejos, el paso puede ser enorme
      y empeorar el costo.</p>
      <h2>Levenberg-Marquardt</h2>
      \[ (J^\top J + \lambda\, \operatorname{diag}(J^\top J))\, \delta = J^\top r. \]
      <pre><code>λ ← 0,01
repetir:
    resolver el sistema para δ
    si S(θ + δ) &lt; S(θ):  θ ← θ + δ;  λ ← λ / 10     (confiar más en el modelo lineal)
    si no:                 λ ← λ · 10              (paso más corto y más parecido al gradiente)
hasta que δ o la mejora sean pequeños</code></pre>
      <p>Con \(\lambda \to 0\) es Gauss-Newton; con \(\lambda\) grande, un paso corto en la dirección del gradiente \(J^\top r\) escalada por
      la diagonal. Es un método de <em>región de confianza</em>: \(\lambda\) controla cuánto se cree en la linealización.</p>
      <h2>Descenso de gradiente</h2>
      <p>\(\nabla S = -J^\top r\). El paso \(\theta \leftarrow \theta + t\, J^\top r\), con \(t\) elegido por retroceso, siempre baja el costo,
      pero si la superficie es un valle alargado (parámetros correlacionados, como \(a\) y \(b\) en el decaimiento) avanza en zigzag y
      su convergencia es lineal, con una razón que depende del número de condición de \(J^\top J\).</p>
      <h2>Mínimos locales e inicialización</h2>
      <div class="recuadro"><p>Ningún método local garantiza el mínimo global. En la oscilación, cada frecuencia \(\omega\) que encaja un número
      distinto de ciclos crea un mínimo local. Por eso la estimación no lineal casi siempre parte de una solución aproximada obtenida
      por un método lineal: el círculo algebraico antes del geométrico, la transformada de Fourier antes de ajustar la frecuencia,
      la calibración lineal de una cámara antes del ajuste de haces (<em>bundle adjustment</em>).</p></div>`,
  });
})();
