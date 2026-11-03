(function () {
  'use strict';
  const { color: C, fmt } = VIZ;

  function interaccion(lienzo, { asas, mover, hover, salir }) {
    const cv = lienzo.canvas;
    let arr = -1;
    const cerca = (x, y) => {
      let m = -1, d = 16;
      asas().forEach(([px, py], i) => { const q = Math.hypot(px - x, py - y); if (q < d) { d = q; m = i; } });
      return m;
    };
    cv.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = cerca(x, y);
      if (i < 0) return;
      arr = i;
      cv.setPointerCapture(ev.pointerId);
      mover(i, x, y);
    });
    cv.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arr >= 0) return mover(arr, x, y);
      cv.style.cursor = cerca(x, y) >= 0 ? 'grab' : 'default';
      if (hover) hover(x, y);
    });
    const fin = () => { arr = -1; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (arr < 0 && salir) salir(); });
  }

  /* ---------- Conjuntos del plano: d(x, y) ≤ 0 dentro ---------- */

  const POLIGONO = [[-2, -1.4], [1.6, -2], [2.6, 0.4], [0.6, 2.2], [-1.8, 1.4]];
  const dPoligono = (x, y) => {
    let m = -Infinity;
    for (let i = 0; i < POLIGONO.length; i++) {
      const p = POLIGONO[i], q = POLIGONO[(i + 1) % POLIGONO.length];
      const ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey);
      m = Math.max(m, (ex * (y - p[1]) - ey * (x - p[0])) / L * -1);
    }
    return m;
  };
  const CONJUNTOS = {
    disco: { nombre: 'Disco', convexo: true, d: (x, y) => Math.hypot(x, y) - 2.2 },
    elipse: { nombre: 'Elipse inclinada', convexo: true, d: (x, y) => { const c = Math.cos(0.5), s = Math.sin(0.5), u = c * x + s * y, v = -s * x + c * y; return Math.hypot(u / 3, v / 1.4) * 1.4 - 1.4; } },
    poligono: { nombre: 'Pentágono', convexo: true, d: dPoligono },
    luna: { nombre: 'Media luna', convexo: false, d: (x, y) => Math.max(Math.hypot(x, y) - 2.5, 1.8 - Math.hypot(x - 1, y)) },
    estrella: { nombre: 'Estrella', convexo: false, d: (x, y) => Math.hypot(x, y) - (1.55 + 0.85 * Math.cos(5 * Math.atan2(y, x))) },
    anillo: { nombre: 'Anillo', convexo: false, d: (x, y) => Math.max(1.2 - Math.hypot(x, y), Math.hypot(x, y) - 2.4) },
    dos: { nombre: 'Dos discos separados', convexo: false, d: (x, y) => Math.min(Math.hypot(x + 1.9, y) - 1.2, Math.hypot(x - 1.9, y) - 1.2) },
  };

  function montarConjuntos(cuerpo) {
    let clave = 'luna', A = [0.8, -2.2], B = [0.8, 2.2], t = 0.5, plano = null, semilla = 1, msg = '';
    const DOM = { xmin: -4, xmax: 4, ymin: -3, ymax: 3 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conjunto C', opciones: Object.entries(CONJUNTOS).map(([k, c]) => [k, c.nombre]), valor: clave, alCambiar: (v) => { clave = v; cache = null; msg = ''; dibujar(); } });
    ctl.rango({ etiqueta: 'Parámetro t (punto del segmento)', min: 0, max: 1, paso: 0.01, valor: t, formato: (v) => fmt(v, 2), alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Buscar contraejemplo', buscar, { primario: true });
    ctl.boton('A y B al azar dentro', () => {
      const r = VIZ.semilla(semilla++ * 17 + 3), dd = CONJUNTOS[clave].d;
      const uno = () => { for (let k = 0; k < 500; k++) { const p = [-4 + 8 * r(), -3 + 6 * r()]; if (dd(p[0], p[1]) <= 0) return p; } return [0, 0]; };
      A = uno(); B = uno(); msg = ''; dibujar();
    });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.22), borde: C.s1, texto: 'conjunto C' },
      { color: C.s6, texto: 'tramo del segmento dentro de C', forma: 'linea' },
      { color: C.s8, texto: 'tramo fuera de C', forma: 'linea' },
      { color: C.tinta, texto: 'A, B (arrastrables) y punto (1−t)A + tB', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre A y B (puntos grandes) y mire el color del segmento entre ellos: si C es convexo, será siempre verde mientras A y B estén dentro.');

    let cache = null;
    const dd = () => CONJUNTOS[clave].d;
    const dentro = (p) => dd()(p[0], p[1]) <= 0;
    function raster() {
      const w = lienzo.ancho, h = lienzo.alto;
      if (cache && cache.w === w && cache.h === h && cache.clave === clave) return cache.cv;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      c.fillStyle = VIZ.alfa(C.s1, 0.22);
      for (let px = Math.floor(plano.x0); px < plano.x1; px += 2) for (let py = Math.floor(plano.y1); py < plano.y0; py += 2) {
        if (dd()(plano.ix(px + 1), plano.iy(py + 1)) <= 0) c.fillRect(px, py, 2, 2);
      }
      cache = { w, h, clave, cv };
      return cv;
    }
    // Fracción de t ∈ [0,1] en que el segmento está dentro de C.
    const trozos = (n = 240) => Array.from({ length: n + 1 }, (_, k) => k / n).map((u) => ({ u, in: dentro([A[0] + u * (B[0] - A[0]), A[1] + u * (B[1] - A[1])]) }));

    function buscar() {
      const r = VIZ.semilla(semilla++ * 131 + 7), d = dd();
      const pts = [];
      for (let k = 0; k < 6000 && pts.length < 400; k++) { const p = [-4 + 8 * r(), -3 + 6 * r()]; if (d(p[0], p[1]) <= 0) pts.push(p); }
      let n = 0;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j += 3) {
        n++;
        const p = pts[i], q = pts[j];
        for (let k = 1; k < 40; k++) {
          const u = k / 40;
          if (d(p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])) > 0) { A = p; B = q; t = u; msg = `Contraejemplo tras ${n} pares: A y B están en C, pero (1−t)A + tB con t = ${fmt(u, 2)} no. C no es convexo.`; dibujar(); return; }
        }
      }
      msg = `Ningún contraejemplo en ${n} pares de puntos de C: es consistente con la convexidad (una búsqueda finita no la demuestra).`;
      dibujar();
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      ctx.drawImage(raster(), 0, 0, lienzo.ancho, lienzo.alto);
      ctx.save();
      plano.recortar();
      ctx.clip();
      VIZ.ml.contorno(ctx, plano, dd(), 0, { color: C.s1, ancho: 2, paso: 3 });
      ctx.restore();
      const ts = trozos();
      for (let i = 0; i < ts.length - 1; i++) {
        const a = ts[i], b = ts[i + 1];
        const p = [A[0] + a.u * (B[0] - A[0]), A[1] + a.u * (B[1] - A[1])], q = [A[0] + b.u * (B[0] - A[0]), A[1] + b.u * (B[1] - A[1])];
        VIZ.trazar(ctx, plano, [p, q], a.in && b.in ? C.s6 : C.s8, 3.5);
      }
      const X = [(1 - t) * A[0] + t * B[0], (1 - t) * A[1] + t * B[1]];
      const inA = dentro(A), inB = dentro(B), inX = dentro(X);
      VIZ.marcador(ctx, plano.sx(A[0]), plano.sy(A[1]), inA ? C.tinta : C.inactivo, 7);
      VIZ.marcador(ctx, plano.sx(B[0]), plano.sy(B[1]), inB ? C.tinta : C.inactivo, 7, 1);
      VIZ.marcador(ctx, plano.sx(X[0]), plano.sy(X[1]), inX ? C.s6 : C.s8, 5, 3);
      ctx.save();
      ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('A', plano.sx(A[0]) + 9, plano.sy(A[1]) - 6);
      ctx.fillText('B', plano.sx(B[0]) + 9, plano.sy(B[1]) - 6);
      ctx.restore();
      const frac = ts.filter((q) => q.in).length / ts.length;
      registro.textContent = msg || (inA && inB
        ? (frac > 0.995 ? 'A y B están en C y todo el segmento queda dentro: para este par se cumple la definición de convexidad.'
          : `A y B están en C, pero el ${fmt((1 - frac) * 100, 3)} % del segmento cae fuera: C no es convexo.`)
        : 'Para comprobar convexidad ponga A y B dentro de C (círculos oscuros): la definición solo habla de pares de puntos de C.');
      lectura.set([
        ['A ∈ C', inA ? 'sí' : 'no'],
        ['B ∈ C', inB ? 'sí' : 'no'],
        ['segmento dentro', `${fmt(frac * 100, 3)} %`],
        ['(1−t)A + tB ∈ C', inX ? 'sí' : 'no'],
        ['C es convexo', CONJUNTOS[clave].convexo ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    interaccion(lienzo, {
      asas: () => (plano ? [[plano.sx(A[0]), plano.sy(A[1])], [plano.sx(B[0]), plano.sy(B[1])]] : []),
      mover: (i, x, y) => {
        const p = [Math.min(DOM.xmax, Math.max(DOM.xmin, plano.ix(x))), Math.min(DOM.ymax, Math.max(DOM.ymin, plano.iy(y)))];
        if (i === 0) A = p; else B = p;
        msg = '';
        dibujar();
      },
      hover: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return tip.ocultar();
        const u = plano.ix(x), v = plano.iy(y);
        tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>${dd()(u, v) <= 0 ? 'dentro de C' : 'fuera de C'}`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Funciones de una variable ---------- */

  const FN = {
    cuad: { n: 'x²', f: (x) => x * x, cvx: true, mono: false },
    abs1: { n: '|x − 1|', f: (x) => Math.abs(x - 1), cvx: true },
    exp: { n: 'eˣ', f: Math.exp, cvx: true, mono: true },
    raiz: { n: '√(1 + x²)', f: (x) => Math.sqrt(1 + x * x), cvx: true },
    relu: { n: 'máx(x, 0)', f: (x) => Math.max(x, 0), cvx: true, mono: true },
    lineal: { n: 'x/2 + 1 (afín)', f: (x) => x / 2 + 1, cvx: true, cav: true, mono: true },
    cuarta: { n: 'x⁴ − 2x² (dos valles)', f: (x) => x ** 4 - 2 * x * x },
    seno: { n: 'sen x', f: Math.sin },
    conc: { n: '−x²', f: (x) => -x * x, cav: true },
  };
  const OPCIONES_FN = Object.entries(FN).map(([k, q]) => [k, q.n]);
  const A0 = -3, B0 = 3;

  // Segunda diferencia con paso h: negativa donde la función es cóncava.
  const d2 = (f, x, h = 0.03) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  function perfil(f) {
    let mn = Infinity, mx = -Infinity;
    for (let x = A0 + 0.05; x <= B0 - 0.05; x += 0.02) { const v = d2(f, x); mn = Math.min(mn, v); mx = Math.max(mx, v); }
    return { mn, mx, convexa: mn >= -1e-4, concava: mx <= 1e-4 };
  }
  const veredicto = (p) => (p.convexa && p.concava ? 'afín (convexa y cóncava)' : p.convexa ? 'convexa' : p.concava ? 'cóncava' : 'ni convexa ni cóncava');

  function ejesY(fs, extra = 0.1) {
    let mn = Infinity, mx = -Infinity;
    for (const f of fs) for (let x = A0; x <= B0; x += 0.05) { const v = f(x); if (Number.isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
    mn = Math.max(mn, -10); mx = Math.min(mx, 10);
    if (!(mx > mn)) { mn -= 1; mx += 1; }
    const p = (mx - mn) * extra;
    return [mn - p, mx + p];
  }
  function curva(f) {
    const pts = [];
    for (let k = 0; k <= 300; k++) { const x = A0 + ((B0 - A0) * k) / 300; pts.push([x, f(x)]); }
    return pts;
  }

  /* ---------- Fig. 2: Jensen, cuerdas y epígrafo ---------- */

  function montarCuerdas(cuerpo) {
    let clave = 'cuarta', a = -1.8, b = 1.4, t = 0.5, epi = true, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función f', opciones: OPCIONES_FN, valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parámetro t', min: 0, max: 1, paso: 0.01, valor: t, formato: (v) => fmt(v, 2), alCambiar: (v) => { t = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Sombrear el epígrafo', valor: epi, alCambiar: (v) => { epi = v; dibujar(); } });
    ctl.boton('Probar muchos pares', () => { probar = true; dibujar(); }, { primario: true });
    let probar = false;

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'f(x)', forma: 'linea' },
      { color: C.s6, texto: 'cuerda por encima de f (Jensen se cumple)', forma: 'linea' },
      { color: C.s8, texto: 'cuerda por debajo de f (Jensen se viola)', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.2), texto: 'epígrafo de f' },
      { color: C.s2, texto: 'brecha de Jensen en t', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre los puntos a y b sobre la curva; la cuerda es verde donde queda sobre f y roja donde queda debajo. «Probar muchos pares» revisa 1 600 pares del dominio.');

    let violaciones = null;
    function dibujar() {
      const { ctx } = lienzo;
      const F = FN[clave], f = F.f;
      lienzo.limpiar();
      const [y0, y1] = ejesY([f]);
      plano = VIZ.plano(lienzo, { xmin: A0, xmax: B0, ymin: y0, ymax: y1 }, { etiquetaX: 'x', etiquetaY: 'y' });
      plano.ejes();
      const pf = perfil(f);
      ctx.save();
      plano.recortar();
      // Epígrafo.
      if (epi) {
        ctx.beginPath();
        curva(f).forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
        ctx.lineTo(plano.sx(B0), plano.y1 - 5); ctx.lineTo(plano.sx(A0), plano.y1 - 5); ctx.closePath();
        ctx.fillStyle = VIZ.alfa(C.s1, 0.15); ctx.fill();
      }
      // Banda inferior: curvatura local.
      for (let x = A0; x < B0; x += 0.05) {
        ctx.fillStyle = d2(f, x + 0.025) >= -1e-4 ? VIZ.alfa(C.s6, 0.35) : VIZ.alfa(C.s8, 0.35);
        ctx.fillRect(plano.sx(x), plano.y0 - 6, plano.sx(x + 0.05) - plano.sx(x) + 0.5, 6);
      }
      VIZ.trazar(ctx, plano, curva(f), C.tinta, 2.5);
      // Cuerda coloreada por tramos.
      const ch = (x) => f(a) + ((f(b) - f(a)) * (x - a)) / (b - a || 1e-9);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let k = 0; k < 80; k++) {
        const x1 = lo + ((hi - lo) * k) / 80, x2 = lo + ((hi - lo) * (k + 1)) / 80;
        const ok = ch((x1 + x2) / 2) >= f((x1 + x2) / 2) - 1e-9;
        VIZ.trazar(ctx, plano, [[x1, ch(x1)], [x2, ch(x2)]], ok ? C.s6 : C.s8, 3);
      }
      const xt = (1 - t) * a + t * b, brecha = ch(xt) - f(xt);
      if (Math.abs(brecha) > 1e-9) VIZ.trazar(ctx, plano, [[xt, f(xt)], [xt, ch(xt)]], C.s2, 3);
      VIZ.marcador(ctx, plano.sx(xt), plano.sy(f(xt)), C.tinta, 4.5);
      VIZ.marcador(ctx, plano.sx(xt), plano.sy(ch(xt)), brecha >= -1e-9 ? C.s6 : C.s8, 4.5, 3);
      ctx.restore();
      [[a, 'a'], [b, 'b']].forEach(([x, n], i) => {
        VIZ.marcador(ctx, plano.sx(x), plano.sy(f(x)), C.tinta, 7, i);
        ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(n, plano.sx(x), plano.sy(f(x)) - 10); ctx.restore();
      });
      if (probar) {
        let mal = 0, tot = 0;
        for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
          const u = A0 + ((B0 - A0) * (i + 0.5)) / 40, v = A0 + ((B0 - A0) * (j + 0.5)) / 40;
          tot++;
          if (f((u + v) / 2) > (f(u) + f(v)) / 2 + 1e-9) mal++;
        }
        violaciones = { mal, tot };
      }
      const jens = brecha >= -1e-9;
      registro.textContent = `f((1−t)a + tb) = ${fmt(f(xt), 4)} ${jens ? '≤' : '>'} (1−t)f(a) + t f(b) = ${fmt(ch(xt), 4)}: `
        + (jens ? 'la desigualdad de Jensen se cumple para este par y este t.' : 'la desigualdad de Jensen se viola: f no es convexa.')
        + ` En el dominio, f es ${veredicto(pf)}.`;
      lectura.set([
        ['a, b', `${fmt(a, 3)}, ${fmt(b, 3)}`],
        ['f(xₜ)', fmt(f(xt), 4)],
        ['cuerda en xₜ', fmt(ch(xt), 4)],
        ['brecha (cuerda − f)', fmt(brecha, 3)],
        ['f en [−3, 3]', veredicto(pf)],
        ['pares que violan', violaciones ? `${violaciones.mal} de ${violaciones.tot}` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    interaccion(lienzo, {
      asas: () => (plano ? [a, b].map((x) => [plano.sx(x), plano.sy(FN[clave].f(x))]) : []),
      mover: (i, x) => {
        const v = Math.min(B0, Math.max(A0, plano.ix(x)));
        if (i === 0) a = v; else b = v;
        violaciones = null; probar = false;
        dibujar();
      },
      hover: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return tip.ocultar();
        const u = plano.ix(x);
        tip.mostrar(x, y, `x = <b>${fmt(u, 3)}</b><br>f = <b>${fmt(FN[clave].f(u), 3)}</b><br>f″ ≈ <b>${fmt(d2(FN[clave].f, u), 3)}</b>`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Fig. 3: operaciones que preservan (o no) la convexidad ---------- */

  const OPS = {
    suma: 'f + g',
    escalar: 'λ · f',
    maximo: 'máx(f, g)',
    minimo: 'mín(f, g)',
    diferencia: 'f − g',
    afin: 'f(αx + 0.5)',
    compuesta: 'g(f(x))',
  };

  function montarOperaciones(cuerpo) {
    let kf = 'cuad', kg = 'abs1', op = 'suma', lam = 2, alfa = 1.5, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función f', opciones: OPCIONES_FN, valor: kf, alCambiar: (v) => { kf = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Función g', opciones: OPCIONES_FN, valor: kg, alCambiar: (v) => { kg = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Operación h', opciones: Object.entries(OPS), valor: op, alCambiar: (v) => { op = v; dibujar(); } });
    ctl.rango({ etiqueta: 'λ (para λ · f)', min: -2, max: 2, paso: 0.5, valor: lam, alCambiar: (v) => { lam = v; dibujar(); } });
    ctl.rango({ etiqueta: 'α (para f(αx + 0.5))', min: -2, max: 2, paso: 0.5, valor: alfa, alCambiar: (v) => { alfa = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'f', forma: 'linea' },
      { color: C.s2, texto: 'g', forma: 'linea' },
      { color: C.tinta, texto: 'h (resultado)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija f, g y la operación. La regla teórica dice si h está garantizada convexa; la comprobación numérica mide la segunda diferencia de h en todo el dominio. Pruebe «f − g» o «mín» para ver convexidad que se pierde.');

    function construir() {
      const F = FN[kf], G = FN[kg], f = F.f, g = G.f;
      let h, regla, ok, expl;
      if (op === 'suma') { h = (x) => f(x) + g(x); ok = !!(F.cvx && G.cvx); expl = 'suma de convexas es convexa'; }
      else if (op === 'escalar') {
        h = (x) => lam * f(x);
        ok = lam >= 0 ? !!F.cvx : !!F.cav;
        expl = lam >= 0 ? 'λ ≥ 0 conserva la convexidad de f' : 'λ < 0 convierte una cóncava en convexa y una convexa en cóncava';
      } else if (op === 'maximo') { h = (x) => Math.max(f(x), g(x)); ok = !!(F.cvx && G.cvx); expl = 'el máximo de convexas es convexa'; }
      else if (op === 'minimo') { h = (x) => Math.min(f(x), g(x)); ok = false; expl = 'el mínimo de convexas en general no es convexo (sí es cóncavo si ambas lo son)'; }
      else if (op === 'diferencia') { h = (x) => f(x) - g(x); ok = !!(F.cvx && G.cav); expl = 'f − g es convexa si f es convexa y g cóncava'; }
      else if (op === 'afin') { h = (x) => f(alfa * x + 0.5); ok = !!F.cvx; expl = 'la composición con una función afín conserva la convexidad'; }
      else { h = (x) => g(f(x)); ok = !!((G.cvx && G.mono && F.cvx) || (G.cvx && F.cvx && F.cav) || (G.cvx && G.mono === undefined && false)); expl = 'g∘f es convexa si g es convexa y no decreciente y f es convexa (o si f es afín)'; }
      regla = ok ? 'garantizada' : 'no garantizada';
      return { f, g, h, regla, ok, expl };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const M = construir();
      const usaG = ['suma', 'maximo', 'minimo', 'diferencia', 'compuesta'].includes(op);
      const [y0, y1] = ejesY(usaG ? [M.f, M.g, M.h] : [M.f, M.h]);
      plano = VIZ.plano(lienzo, { xmin: A0, xmax: B0, ymin: y0, ymax: y1 }, { etiquetaX: 'x', etiquetaY: 'y' });
      plano.ejes();
      ctx.save();
      plano.recortar();
      VIZ.trazar(ctx, plano, curva(M.f), C.s1, 1.8);
      if (usaG) VIZ.trazar(ctx, plano, curva(M.g), C.s2, 1.8);
      VIZ.trazar(ctx, plano, curva(M.h), C.tinta, 3);
      ctx.restore();
      const pf = perfil(M.f), pg = perfil(M.g), ph = perfil(M.h);
      const num = ph.convexa;
      registro.textContent = `Regla: ${M.expl}. Para estas elecciones la convexidad está ${M.regla}. Numéricamente h es ${veredicto(ph)}`
        + (M.ok && !num ? ' (¡revise: la regla y el cálculo no concuerdan!).' : !M.ok && num ? ': la regla no lo garantiza, pero esta combinación particular resulta convexa.' : '.');
      lectura.set([
        ['f', veredicto(pf)],
        ['g', usaG ? veredicto(pg) : 'no se usa'],
        ['h', veredicto(ph)],
        ['mín. de h″', fmt(ph.mn, 3)],
        ['regla teórica', M.regla],
        ['convexa (numérico)', num ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), M = construir();
      tip.mostrar(x, y, `x = <b>${fmt(u, 3)}</b>` + VIZ.filaTooltip(C.s1, 'f', fmt(M.f(u), 3)) + VIZ.filaTooltip(C.s2, 'g', fmt(M.g(u), 3)) + VIZ.filaTooltip(C.tinta, 'h', fmt(M.h(u), 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('convex-sets-functions', {
    intro: String.raw`
      <p>Un conjunto es <strong>convexo</strong> si al unir con un segmento dos de sus puntos cualesquiera, el segmento no se sale del conjunto: no tiene
      huecos ni entrantes. Una función es <strong>convexa</strong> si su cuerda siempre queda por encima de su gráfico, es decir, si la región sobre la curva
      es un conjunto convexo.</p>
      <p>Esta propiedad es la frontera entre lo «fácil» y lo «difícil» en optimización: en un problema convexo todo mínimo local es global y los algoritmos
      de descenso no se pierden en valles falsos. Aquí comprobará la definición con segmentos y cuerdas que usted mueve, y verá qué operaciones conservan la convexidad.</p>`,
    visualizaciones: [
      {
        titulo: 'Segmentos dentro y fuera de un conjunto',
        descripcion: 'Arrastre A y B dentro de la media luna: el segmento se pone rojo donde sale del conjunto. Cambie a disco o pentágono y compruebe que nunca sale; «Buscar contraejemplo» prueba cientos de pares y se detiene al hallar uno.',
        montar: montarConjuntos,
      },
      {
        titulo: 'Cuerdas, Jensen y epígrafo',
        descripcion: 'Mueva a y b sobre la curva: en una función convexa la cuerda es siempre verde y la brecha de Jensen en t nunca es negativa. Con x⁴ − 2x² o sen x aparece un tramo rojo; la banda al pie marca dónde la curvatura es negativa.',
        montar: montarCuerdas,
      },
      {
        titulo: 'Operaciones que conservan la convexidad',
        descripcion: 'Combine f y g con suma, máximo, mínimo, diferencia, escala o composición. Compare la regla teórica con la comprobación numérica: la suma y el máximo conservan la convexidad, el mínimo y la diferencia no, y multiplicar por λ < 0 invierte la curvatura.',
        montar: montarOperaciones,
      },
    ],
    teoria: String.raw`
      <h2>Conjuntos convexos</h2>
      <p>Un conjunto \(C \subseteq \mathbb{R}^n\) es <strong>convexo</strong> si</p>
      \[ x, y \in C,\ \lambda \in [0,1] \;\Longrightarrow\; \lambda x + (1-\lambda) y \in C. \]
      <p>Ejemplos convexos: semiespacios \(\{x : a^\top x \le b\}\), bolas, elipsoides, poliedros y toda intersección de convexos. No son convexos: un anillo, una media luna, una estrella o la unión de dos discos separados. La unión de convexos, en general, no es convexa; la intersección sí.</p>
      <h2>Funciones convexas</h2>
      <p>Sea \(f : C \to \mathbb{R}\) con \(C\) convexo. \(f\) es <strong>convexa</strong> si, para todo \(x, y \in C\) y \(\lambda \in [0,1]\),</p>
      \[ f\bigl(\lambda x + (1-\lambda) y\bigr) \;\le\; \lambda f(x) + (1-\lambda) f(y) \qquad \text{(desigualdad de Jensen).} \]
      <p>La brecha entre la cuerda y la función es la que muestra la segunda figura. Equivalentemente, el <strong>epígrafo</strong> \(\operatorname{epi} f = \{(x,t) : t \ge f(x)\}\) es un conjunto convexo. \(f\) es <em>cóncava</em> si \(-f\) es convexa.</p>
      <p>Si \(f\) es dos veces diferenciable, \(f\) es convexa en un convexo abierto si y solo si su Hessiana \(\nabla^2 f(x)\) es semidefinida positiva en todo punto; en una variable, \(f''(x) \ge 0\). La figura estima \(f''\) con la segunda diferencia \(\bigl(f(x+h) - 2f(x) + f(x-h)\bigr)/h^2\). Consulte <a href="tema.html?id=hessian-curvature">la Hessiana y la curvatura</a>.</p>
      <h2>Operaciones que preservan la convexidad</h2>
      <table>
        <tr><th>operación</th><th>condición</th></tr>
        <tr><td>\(f + g\)</td><td>\(f, g\) convexas</td></tr>
        <tr><td>\(\lambda f\)</td><td>\(f\) convexa y \(\lambda \ge 0\)</td></tr>
        <tr><td>\(\max(f, g)\)</td><td>\(f, g\) convexas (también el supremo de cualquier familia)</td></tr>
        <tr><td>\(f(Ax + b)\)</td><td>\(f\) convexa; composición con una función afín</td></tr>
        <tr><td>\(g(f(x))\)</td><td>\(g\) convexa y no decreciente, \(f\) convexa</td></tr>
        <tr><td>\(\min(f, g)\), \(f - g\)</td><td>ninguna condición general: pueden perder la convexidad</td></tr>
      </table>
      <p>Cada fila se prueba directamente de la definición. Por ejemplo, para el máximo: \(\max(f,g)(\lambda x + (1-\lambda)y) \le \max\bigl(\lambda f(x) + (1-\lambda) f(y),\ \lambda g(x) + (1-\lambda) g(y)\bigr) \le \lambda \max(f,g)(x) + (1-\lambda)\max(f,g)(y)\).</p>
      <h2>Por qué importa</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Si \(f\) es convexa sobre un convexo \(C\), todo mínimo local de \(f\) en \(C\) es mínimo global, y el conjunto de mínimos globales es convexo. Si \(f\) es estrictamente convexa, el mínimo es único.</p></div>
      <p>Por eso los problemas convexos (LP, cuadráticos convexos, conos) se resuelven con garantías: se puede detener un método cuando se cumplen las condiciones de optimalidad locales. Detalles en <a href="tema.html?id=local-global-optima">óptimos locales y globales</a>, <a href="tema.html?id=existence-uniqueness">existencia y unicidad</a> y <a href="tema.html?id=halfspaces-hyperplanes">semiespacios e hiperplanos</a>, donde aparecen los poliedros como intersección de semiespacios.</p>`,
  });
})();
