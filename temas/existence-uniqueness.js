(function () {
  'use strict';
  const { color: C, fmt } = VIZ;
  const O = VIZ.opt;
  const INF = Infinity;

  function interaccion(lienzo, { asas, mover, hover, salir }) {
    const cv = lienzo.canvas;
    let arr = -1;
    const cerca = (x, y) => {
      let m = -1, d = 15;
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

  /* ---------- Fig. 1: existencia en una variable ---------- */

  // Cada función declara su valor, sus puntos críticos, sus discontinuidades (con límites laterales)
  // y su límite en ±∞ (null si oscila); con eso se obtienen ínfimo, supremo y si se alcanzan.
  const FUNS = {
    lineal: { nombre: 'f(x) = x', f: (x) => x, crit: [], disc: [], inf: { mas: INF, menos: -INF }, continua: true },
    parabola: { nombre: 'f(x) = (x − 2)²', f: (x) => (x - 2) ** 2, crit: [2], disc: [], inf: { mas: INF, menos: INF }, continua: true },
    expneg: { nombre: 'f(x) = e^(−x)', f: (x) => Math.exp(-x), crit: [], disc: [], inf: { mas: 0, menos: INF }, continua: true },
    cubica: { nombre: 'f(x) = x³ − 3x', f: (x) => x ** 3 - 3 * x, crit: [-1, 1], disc: [], inf: { mas: INF, menos: -INF }, continua: true },
    seno: { nombre: 'f(x) = sen x', f: (x) => Math.sin(x), crit: Array.from({ length: 13 }, (_, k) => Math.PI / 2 + (k - 6) * Math.PI), disc: [], inf: { mas: null, menos: null }, continua: true },
    salto: { nombre: 'f(x) = |x − 1| si x ≠ 1, y f(1) = 2 (discontinua)', f: (x) => (x === 1 ? 2 : Math.abs(x - 1)), crit: [], disc: [{ x: 1, izq: 0, der: 0 }], inf: { mas: INF, menos: INF }, continua: false },
  };

  // Ínfimo y supremo de f sobre el intervalo con extremos lo, hi (±∞ posibles) abiertos o cerrados.
  function analizarIntervalo(F, lo, hi, cerLo, cerHi) {
    if (lo > hi || (lo === hi && !(cerLo && cerHi))) return { vacio: true };
    const cand = [];
    const aporta = (x, v, att, donde) => cand.push({ x, v, att, donde });
    if (lo === hi) { aporta(lo, F.f(lo), true, 'punto'); }
    else {
      const extremo = (x, cerrado, lado) => {
        const d = F.disc.find((q) => q.x === x);
        const lim = d ? (lado === 'der' ? d.der : d.izq) : F.f(x);
        if (cerrado) aporta(x, F.f(x), true, 'extremo');
        if (!cerrado || lim !== F.f(x)) aporta(x, lim, false, cerrado ? 'salto' : 'abierto');
      };
      if (lo > -INF) extremo(lo, cerLo, 'der'); else if (F.inf.menos != null) aporta(-INF, F.inf.menos, false, 'infinito');
      if (hi < INF) extremo(hi, cerHi, 'izq'); else if (F.inf.mas != null) aporta(INF, F.inf.mas, false, 'infinito');
      for (const x of F.crit) if (x > lo && x < hi) aporta(x, F.f(x), true, 'interior');
      for (const d of F.disc) if (d.x > lo && d.x < hi) {
        aporta(d.x, F.f(d.x), true, 'interior');
        if (d.izq !== F.f(d.x)) aporta(d.x, d.izq, false, 'salto');
        if (d.der !== F.f(d.x)) aporta(d.x, d.der, false, 'salto');
      }
    }
    const elegir = (signo) => {
      let v = -INF * signo;
      cand.forEach((c) => { if (signo * c.v > signo * v) v = c.v; });
      const alc = cand.find((c) => c.att && Math.abs(c.v - v) < 1e-9);
      const apr = cand.find((c) => Math.abs(c.v - v) < 1e-9 || c.v === v);
      return { v, alcanzado: !!alc && Number.isFinite(v), x: (alc || apr || { x: NaN }).x, donde: (alc || apr || { donde: '' }).donde };
    };
    return { vacio: false, mn: elegir(-1), mx: elegir(1) };
  }

  function montarExistencia(cuerpo) {
    let clave = 'parabola', lo = -1, hi = 4, cerLo = true, cerHi = true, sinLo = false, sinHi = false, plano = null;
    const VISTA = { xmin: -4, xmax: 8 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función objetivo', opciones: Object.entries(FUNS).map(([k, q]) => [k, q.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Extremo izquierdo a', min: -3, max: 6, paso: 0.5, valor: lo, alCambiar: (v) => { lo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Extremo derecho b', min: -3, max: 6, paso: 0.5, valor: hi, alCambiar: (v) => { hi = v; dibujar(); } });
    ctl.casillas([
      { clave: 'cLo', texto: 'incluye a (cerrado)', activo: true },
      { clave: 'cHi', texto: 'incluye b (cerrado)', activo: true },
      { clave: 'sLo', texto: 'sin cota inferior', activo: false },
      { clave: 'sHi', texto: 'sin cota superior', activo: false },
    ], (e) => { cerLo = e.cLo; cerHi = e.cHi; sinLo = e.sLo; sinHi = e.sHi; dibujar(); });
    const presets = {
      'Compacto y continua': () => ['parabola', -1, 4, true, true, false, false],
      'Extremo abierto': () => ['lineal', 0, 3, false, true, false, false],
      'Región no acotada': () => ['expneg', 0, 3, true, true, false, true],
      'Función discontinua': () => ['salto', -1, 3, true, true, false, false],
    };
    // Los casilleros no tienen interfaz de escritura: se reconstruyen leyendo el DOM.
    const cajas = [...ctl.caja.querySelectorAll('.grupo-casillas input[type=checkbox]')];
    const rangos = [...ctl.caja.querySelectorAll('input[type=range]')];
    const selector = ctl.caja.querySelector('select');
    function aplicar([k, a, b, c1, c2, s1, s2]) {
      clave = k; lo = a; hi = b; cerLo = c1; cerHi = c2; sinLo = s1; sinHi = s2;
      selector.value = k;
      rangos[0].value = a; rangos[0].dispatchEvent(new Event('input'));
      rangos[1].value = b; rangos[1].dispatchEvent(new Event('input'));
      [c1, c2, s1, s2].forEach((v, i) => { cajas[i].checked = v; });
      dibujar();
    }
    Object.entries(presets).forEach(([n, fn], i) => ctl.boton(n, () => aplicar(fn()), { primario: i === 0 }));

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'f sobre la región factible', forma: 'linea' },
      { color: C.tenue, texto: 'f fuera de la región', forma: 'linea' },
      { color: C.s1, texto: 'mínimo / ínfimo', forma: 'punto' },
      { color: C.s7, texto: 'máximo / supremo', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Punto lleno: el valor se alcanza; círculo vacío: solo se aproxima. Use los botones para ver los cuatro casos clásicos y luego modifique extremos y casillas por su cuenta.');

    const dominio = () => [sinLo ? -INF : lo, sinHi ? INF : hi];
    function causa(q, tipo) {
      if (q.v === -INF * (tipo === 'mn' ? 1 : -1)) return `la función no está acotada ${tipo === 'mn' ? 'inferiormente' : 'superiormente'} en la región`;
      return q.donde === 'abierto' ? 'el extremo donde se aproxima es abierto'
        : q.donde === 'infinito' ? 'el valor solo se aproxima cuando x → ±∞'
          : q.donde === 'salto' ? 'la función es discontinua justo donde se aproxima y su valor allí es otro' : 'no se alcanza';
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const F = FUNS[clave], [a, b] = dominio();
      const r = analizarIntervalo(F, a, b, cerLo, cerHi);
      // Muestras para escalar y dibujar.
      const x0v = VISTA.xmin, x1v = VISTA.xmax;
      const segmentos = (desde, hasta) => {
        const cortes = [desde, ...F.disc.map((d) => d.x).filter((x) => x > desde && x < hasta), hasta];
        const res = [];
        for (let i = 0; i + 1 < cortes.length; i++) {
          const u = cortes[i] + (i > 0 ? 1e-7 : 0), v = cortes[i + 1] - (i + 2 < cortes.length ? 1e-7 : 0), pts = [];
          for (let k = 0; k <= 160; k++) { const x = u + ((v - u) * k) / 160; pts.push([x, F.f(x)]); }
          res.push(pts);
        }
        return res;
      };
      const todos = segmentos(x0v, x1v).flat();
      const dentroV = r.vacio ? [] : segmentos(Math.max(x0v, a), Math.min(x1v, b)).flat();
      const vals = (dentroV.length ? dentroV : todos).map((p) => p[1]);
      let ymn = Math.max(-10, Math.min(...vals)), ymx = Math.min(10, Math.max(...vals));
      if (!(ymx > ymn)) { ymn -= 1; ymx += 1; }
      const pad = (ymx - ymn) * 0.12;
      plano = VIZ.plano(lienzo, { xmin: x0v, xmax: x1v, ymin: ymn - pad, ymax: ymx + pad }, { etiquetaX: 'x', etiquetaY: 'f(x)' });
      plano.ejes();
      ctx.save();
      plano.recortar();
      ctx.fillStyle = r.vacio ? VIZ.alfa(C.s8, 0.07) : VIZ.alfa(C.s1, 0.08);
      if (!r.vacio) ctx.fillRect(plano.sx(Math.max(x0v, a)), plano.y1, plano.sx(Math.min(x1v, b)) - plano.sx(Math.max(x0v, a)), plano.y0 - plano.y1);
      ctx.restore();
      ctx.save();
      plano.recortar();
      segmentos(x0v, x1v).forEach((s) => VIZ.trazar(ctx, plano, s, C.tenue, 1.5));
      if (!r.vacio) segmentos(Math.max(x0v, a), Math.min(x1v, b)).forEach((s) => VIZ.trazar(ctx, plano, s, C.tinta, 2.5));
      // Extremos del intervalo y saltos.
      const hueco = (x, y, c) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.fillStyle = C.superficie; ctx.beginPath(); ctx.arc(plano.sx(x), plano.sy(y), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
      if (!r.vacio) {
        [[a, cerLo], [b, cerHi]].forEach(([x, cer]) => {
          if (!Number.isFinite(x) || x < x0v || x > x1v) return;
          ctx.strokeStyle = C.s1; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(plano.sx(x), plano.y1); ctx.lineTo(plano.sx(x), plano.y0); ctx.stroke(); ctx.setLineDash([]);
          if (cer) VIZ.marcador(ctx, plano.sx(x), plano.sy(F.f(x)), C.tinta, 4); else hueco(x, F.f(x), C.tinta);
        });
        F.disc.forEach((d) => { if (d.x > a && d.x < b) { hueco(d.x, d.der, C.tinta); VIZ.marcador(ctx, plano.sx(d.x), plano.sy(F.f(d.x)), C.tinta, 4); } });
      }
      ctx.restore();
      // Resultados: marcadores de extremos.
      const marca = (q, color, forma, texto) => {
        if (!Number.isFinite(q.v)) return;
        const px = plano.sx(Number.isFinite(q.x) ? q.x : 0), py = plano.sy(q.v);
        ctx.save();
        plano.recortar();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(plano.x0, py); ctx.lineTo(plano.x1, py); ctx.stroke(); ctx.setLineDash([]);
        if (!Number.isFinite(q.x)) { /* se aproxima en el infinito: solo la recta */ }
        else if (q.alcanzado) VIZ.marcador(ctx, px, py, color, 7, forma);
        else { ctx.lineWidth = 2.5; ctx.fillStyle = C.superficie; ctx.beginPath(); VIZ.forma(ctx, px, py, 7, forma); ctx.fill(); ctx.stroke(); }
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(texto + (Number.isFinite(q.x) ? '' : ' (x → ∞)') + `: ${fmt(q.v)}`, plano.x0 + 6, py - 4);
        ctx.restore();
      };
      if (!r.vacio) {
        marca(r.mn, C.s1, 0, r.mn.alcanzado ? 'mínimo' : 'ínfimo');
        marca(r.mx, C.s7, 1, r.mx.alcanzado ? 'máximo' : 'supremo');
      } else {
        ctx.save(); ctx.font = VIZ.fuente(13, 600); ctx.fillStyle = C.s8; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('región factible vacía', (plano.x0 + plano.x1) / 2, (plano.y0 + plano.y1) / 2); ctx.restore();
      }

      const compacto = !r.vacio && Number.isFinite(a) && Number.isFinite(b) && cerLo && cerHi;
      const txt = (q, tipo) => (q.alcanzado ? `existe: f = ${fmt(q.v)} en x = ${fmt(q.x, 3)}`
        : Number.isFinite(q.v) ? `no existe (${tipo === 'mn' ? 'ínfimo' : 'supremo'} ${fmt(q.v)} sin alcanzar)` : 'no existe (no acotado)');
      if (r.vacio) registro.textContent = 'La región factible es vacía (a > b, o a = b con un extremo abierto): no hay ninguna solución candidata.';
      else {
        registro.textContent = (compacto && F.continua ? 'Región compacta y f continua: el teorema de Weierstrass garantiza que existen mínimo y máximo. ' : '')
          + (r.mn.alcanzado ? 'Mínimo alcanzado. ' : `Mínimo inexistente: ${causa(r.mn, 'mn')}. `)
          + (r.mx.alcanzado ? 'Máximo alcanzado.' : `Máximo inexistente: ${causa(r.mx, 'mx')}.`);
      }
      lectura.set([
        ['región', r.vacio ? 'vacía' : `${cerLo ? '[' : '('}${sinLo ? '−∞' : fmt(a)}, ${sinHi ? '∞' : fmt(b)}${cerHi ? ']' : ')'}`],
        ['compacta', compacto ? 'sí' : 'no'],
        ['f continua', F.continua ? 'sí' : 'no'],
        ['mínimo', r.vacio ? '—' : txt(r.mn, 'mn')],
        ['máximo', r.vacio ? '—' : txt(r.mx, 'mx')],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), [a, b] = dominio();
      const ok = (u > a || (u === a && cerLo)) && (u < b || (u === b && cerHi));
      tip.mostrar(x, y, `x = <b>${fmt(u, 3)}</b><br>f(x) = <b>${fmt(FUNS[clave].f(u), 3)}</b><br>${ok ? 'en la región factible' : 'fuera de la región'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: unicidad en el plano ---------- */

  const RESTR = [
    { a: [1, 0], b: 6 }, { a: [1, 1], b: 9 }, { a: [0, 1], b: 6 }, { a: [-1, 1], b: 4 }, { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 },
  ];
  const POLI = O.poligono(RESTR).map((p) => p.map((v) => Math.round(v * 1e9) / 1e9));
  const NORMALES = [0, 45, 90, 135, 180, 270];
  const dentroPoli = (x, y) => RESTR.every((r) => r.a[0] * x + r.a[1] * y <= r.b + 1e-9);
  const DOM = { xmin: -1, xmax: 8, ymin: -1, ymax: 7.5 };

  function montarUnicidad(cuerpo) {
    let modo = 'lp', ang = 20, rad = 2, P = [3.5, 3], plano = null, arista = 0, S = [], info = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Problema', valor: modo,
      opciones: [['lp', 'LP: máx c·x'], ['estricta', 'mín ‖x − p‖² (estrictamente convexa)'], ['plana', 'mín (x₁ + x₂ − s)² (convexa, no estricta)'], ['anillo', 'mín (‖x − p‖² − r²)² (no convexa)']],
      alCambiar: (v) => { modo = v; dibujar(); },
    });
    const sAng = ctl.rango({ etiqueta: 'Dirección de c (LP)', min: 0, max: 355, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Radio r (anillo)', min: 0.5, max: 4, paso: 0.1, valor: rad, formato: (v) => fmt(v, 2), alCambiar: (v) => { rad = v; dibujar(); } });
    ctl.boton('Alinear c con una arista', () => { ang = NORMALES[arista++ % NORMALES.length]; sAng.valor = ang; modo = 'lp'; selector.value = 'lp'; dibujar(); }, { primario: true });
    ctl.boton('Girar c 5°', () => { ang = (ang + 5) % 360; sAng.valor = ang; dibujar(); });
    const selector = ctl.caja.querySelector('select');

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 290, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.22), borde: C.s1, texto: 'región factible' },
      { color: C.eje, texto: 'curvas de nivel', forma: 'linea' },
      { color: C.s6, texto: 'soluciones óptimas', forma: 'punto' },
      { color: C.tinta, texto: 'centro p (arrastrable) / dirección c', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En LP, gire c: cuando es perpendicular a una arista, toda la arista es óptima (use el botón). En los otros modos, arrastre el punto p y compare cuántas soluciones aparecen.');

    const c = () => [Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)];
    const fun = () => {
      if (modo === 'estricta') return (x, y) => (x - P[0]) ** 2 + (y - P[1]) ** 2;
      if (modo === 'plana') return (x, y) => (x + y - P[0] - P[1]) ** 2;
      if (modo === 'anillo') return (x, y) => (((x - P[0]) ** 2 + (y - P[1]) ** 2) - rad * rad) ** 2;
      const cc = c();
      return (x, y) => -(cc[0] * x + cc[1] * y);
    };

    function resolver() {
      const f = fun();
      if (modo === 'lp') {
        const cc = c(), z = (v) => cc[0] * v[0] + cc[1] * v[1];
        const o = O.optimo2d(POLI, cc);
        const vs = POLI.filter((v) => Math.abs(z(v) - o.z) < 1e-9);
        info = { fmin: -o.z, S: vs, exacto: true };
        return;
      }
      const pts = [];
      const paso = 0.04;
      for (let x = 0; x <= 6.0001; x += paso) for (let y = 0; y <= 6.0001; y += paso) if (dentroPoli(x, y)) pts.push([x, y]);
      for (let i = 0; i < POLI.length; i++) {
        const p = POLI[i], q = POLI[(i + 1) % POLI.length];
        for (let k = 0; k <= 300; k++) pts.push([p[0] + ((q[0] - p[0]) * k) / 300, p[1] + ((q[1] - p[1]) * k) / 300]);
      }
      let fm = Infinity;
      pts.forEach(([x, y]) => { fm = Math.min(fm, f(x, y)); });
      const tol = modo === 'anillo' ? 0.04 : 0.01;
      info = { fmin: fm, S: pts.filter(([x, y]) => f(x, y) <= fm + tol), exacto: false };
    }

    // Componentes conexas (distancia < 0.12) y diámetro del conjunto óptimo.
    function describir(S) {
      let M = S;
      if (M.length > 1500) M = M.filter((_, i) => i % Math.ceil(M.length / 1500) === 0);
      const padre = M.map((_, i) => i), raiz = (i) => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
      let diam = 0;
      for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
        const d = Math.hypot(M[i][0] - M[j][0], M[i][1] - M[j][1]);
        diam = Math.max(diam, d);
        if (d < (M.length < S.length ? 0.4 : 0.12)) padre[raiz(i)] = raiz(j);
      }
      return { comps: new Set(M.map((_, i) => raiz(i))).size, diam };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      resolver();
      ctx.save();
      ctx.beginPath();
      POLI.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
      ctx.closePath();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.2);
      ctx.fill();
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      const f = fun();
      for (let k = 1; k <= 8; k++) {
        if (modo === 'lp') VIZ.ml.contorno(ctx, plano, f, info.fmin + k * 1.2 - 0.0001, { color: C.rejilla, ancho: 1 });
        else if (modo === 'plana') VIZ.ml.contorno(ctx, plano, f, info.fmin + k * k * 0.6, { color: C.rejilla, ancho: 1 });
        else if (modo === 'anillo') VIZ.ml.contorno(ctx, plano, f, info.fmin + k * k * 1.5, { color: C.rejilla, ancho: 1 });
        else VIZ.ml.contorno(ctx, plano, f, info.fmin + k * k * 0.7, { color: C.rejilla, ancho: 1 });
      }
      if (modo === 'lp') {
        VIZ.ml.contorno(ctx, plano, f, info.fmin, { color: C.s6, ancho: 1.5, guiones: [4, 3] });
        const cc = c(), o = [3, 3], L = 1.5;
        VIZ.trazar(ctx, plano, [o, [o[0] + L * cc[0], o[1] + L * cc[1]]], C.tinta, 2.5);
        VIZ.marcador(ctx, plano.sx(o[0] + L * cc[0]), plano.sy(o[1] + L * cc[1]), C.tinta, 4);
        ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText('c', plano.sx(o[0] + L * cc[0]) + 8, plano.sy(o[1] + L * cc[1]) - 4); ctx.restore();
        if (info.S.length > 1) VIZ.trazar(ctx, plano, info.S, C.s6, 5);
        info.S.forEach((v) => VIZ.marcador(ctx, plano.sx(v[0]), plano.sy(v[1]), C.s6, 6));
      } else {
        ctx.save();
        ctx.fillStyle = C.s6;
        info.S.forEach(([x, y]) => ctx.fillRect(plano.sx(x) - 1.6, plano.sy(y) - 1.6, 3.2, 3.2));
        ctx.restore();
        VIZ.marcador(ctx, plano.sx(P[0]), plano.sy(P[1]), C.tinta, 6, modo === 'anillo' ? 3 : 1);
        if (modo === 'anillo') {
          ctx.save(); ctx.strokeStyle = C.apagado; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(plano.sx(P[0]), plano.sy(P[1]), rad * (plano.sx(1) - plano.sx(0)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      let verdicto, n, extra = '';
      if (modo === 'lp') {
        n = info.S.length;
        const L = n > 1 ? Math.hypot(info.S[0][0] - info.S[1][0], info.S[0][1] - info.S[1][1]) : 0;
        verdicto = n > 1 ? `toda una arista (longitud ${fmt(L, 3)}): infinitas soluciones óptimas` : `un único vértice (${fmt(info.S[0][0], 3)}, ${fmt(info.S[0][1], 3)})`;
        extra = n > 1 ? 'El objetivo lineal no es estrictamente convexo: puede quedar plano a lo largo de una arista.' : 'Con c no perpendicular a ninguna arista el óptimo es un vértice.';
      } else {
        const d = describir(info.S);
        n = d.comps;
        verdicto = d.comps > 1 ? `${d.comps} soluciones óptimas separadas`
          : d.diam < 0.4 ? 'una única solución' : `un conjunto continuo de soluciones (diámetro ≈ ${fmt(d.diam, 2)})`;
        extra = modo === 'estricta' ? 'f estrictamente convexa y región convexa: el óptimo, si existe, es único (aquí es la proyección de p).'
          : modo === 'plana' ? 'f es convexa pero constante a lo largo de x₁ + x₂ = s: el mínimo es un segmento, no un punto.'
            : 'f no es convexa: el conjunto de soluciones es un anillo (recortado por la región), no hay unicidad ni garantía de que local sea global.';
      }
      registro.textContent = `Conjunto óptimo: ${verdicto}. ${extra}`;
      lectura.set([
        ['valor óptimo', fmt(modo === 'lp' ? -info.fmin : info.fmin)],
        ['conjunto óptimo', modo === 'lp' ? (n > 1 ? 'arista' : 'vértice') : n > 1 ? `${n} piezas` : 'conexo'],
        ['puntos óptimos', modo === 'lp' ? `${info.S.length} vértice(s)` : `${info.S.length} de rejilla`],
        ['f estrictamente convexa', modo === 'estricta' ? 'sí' : 'no'],
        ['región convexa', 'sí'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    interaccion(lienzo, {
      asas: () => (plano && modo !== 'lp' ? [[plano.sx(P[0]), plano.sy(P[1])]] : []),
      mover: (i, x, y) => {
        P = [Math.round(Math.min(DOM.xmax, Math.max(DOM.xmin, plano.ix(x))) * 20) / 20, Math.round(Math.min(DOM.ymax, Math.max(DOM.ymin, plano.iy(y))) * 20) / 20];
        dibujar();
      },
      hover: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return tip.ocultar();
        const u = plano.ix(x), v = plano.iy(y), val = fun()(u, v);
        tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>${modo === 'lp' ? 'c·x' : 'f'} = <b>${fmt(modo === 'lp' ? -val : val, 3)}</b><br>${dentroPoli(u, v) ? 'factible' : 'infactible'}`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  VIZ.registrarTema('existence-uniqueness', {
    intro: String.raw`
      <p>Antes de buscar el mejor valor conviene preguntarse si existe. Un problema puede no tener solución aunque su enunciado parezca razonable:
      la función puede bajar indefinidamente, acercarse a un valor sin llegar nunca a él, o las restricciones pueden no dejar ningún punto.</p>
      <p>Y cuando existe, no siempre es única: un objetivo lineal puede quedar «plano» a lo largo de una arista de la región. Aquí cambiará la región
      factible y la función para ver cada caso, y comprobará que la convexidad estricta es lo que garantiza una sola solución.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuándo existe el óptimo',
        descripcion: 'Empiece con «Compacto y continua» y luego pruebe los otros tres botones: cada uno rompe una hipótesis del teorema de Weierstrass (extremo abierto, región no acotada, discontinuidad). Después cambie a, b y las casillas para fabricar una región vacía.',
        montar: montarExistencia,
      },
      {
        titulo: 'Cuándo el óptimo es único',
        descripcion: 'En LP gire c con el deslizador o pulse «Alinear c con una arista»: el óptimo salta de un vértice a toda una arista. Luego compare los otros tres problemas arrastrando p: un punto único, un segmento y un anillo de soluciones.',
        montar: montarUnicidad,
      },
    ],
    teoria: String.raw`
      <h2>Existencia</h2>
      <p>Para \(\min_{x \in F} f(x)\), el <strong>ínfimo</strong> \(\inf_F f\) siempre es un número de \([-\infty, +\infty]\) (si \(F \ne \emptyset\)), pero el mínimo existe solo si el ínfimo se alcanza en algún \(x^\ast \in F\).</p>
      <div class="recuadro"><p><strong>Teorema de Weierstrass.</strong> Si \(F \subset \mathbb{R}^n\) es no vacío y <em>compacto</em> (cerrado y acotado) y \(f\) es <em>continua</em> en \(F\), entonces \(f\) alcanza su mínimo y su máximo en \(F\).</p></div>
      <p>Cada hipótesis es necesaria, y la primera figura muestra por qué:</p>
      <table>
        <tr><th class="izq">hipótesis rota</th><th class="izq">ejemplo</th><th class="izq">qué ocurre</th></tr>
        <tr><td class="izq">no cerrada</td><td class="izq">\(\min x\) en \((0,3]\)</td><td class="izq">ínfimo 0, no se alcanza</td></tr>
        <tr><td class="izq">no acotada</td><td class="izq">\(\min e^{-x}\) en \([0,\infty)\)</td><td class="izq">ínfimo 0, no se alcanza</td></tr>
        <tr><td class="izq">no continua</td><td class="izq">\(|x-1|\) con \(f(1)=2\)</td><td class="izq">ínfimo 0, no se alcanza</td></tr>
        <tr><td class="izq">no acotada</td><td class="izq">\(\max x\) en \([0,\infty)\)</td><td class="izq">no acotado: supremo \(+\infty\)</td></tr>
        <tr><td class="izq">vacía</td><td class="izq">\(x \ge 4,\ x \le 1\)</td><td class="izq">\(F = \emptyset\): no hay candidatos</td></tr>
      </table>
      <p>Weierstrass es suficiente, no necesario: \((x-2)^2\) tiene mínimo sobre \(\mathbb{R}\), que no es compacto, porque la función es <em>coerciva</em> (\(f(x) \to \infty\) cuando \(\lVert x\rVert \to \infty\)). Toda función continua y coerciva alcanza su mínimo en un conjunto cerrado.</p>
      <h2>Soluciones no acotadas e infactibles en LP</h2>
      <p>Para un programa lineal solo hay tres desenlaces: infactible, no acotado u óptimo alcanzado en un vértice (si la región tiene vértices). El teorema fundamental de la programación lineal asegura que, si el LP es factible y el objetivo está acotado sobre la región, el óptimo se alcanza. Véase <a href="tema.html?id=unbounded-infeasible">problemas no acotados e infactibles</a>.</p>
      <h2>Unicidad</h2>
      <p>Si \(F\) es convexo y \(f\) es <strong>estrictamente convexa</strong>, es decir, \(f(\lambda x + (1-\lambda) y) < \lambda f(x) + (1-\lambda) f(y)\) para \(x \ne y\) y \(\lambda \in (0,1)\), el mínimo, si existe, es único.</p>
      <p><em>Demostración.</em> Si \(x \ne y\) fueran mínimos con valor \(f^\ast\), el punto medio \(m = (x+y)/2\) es factible y \(f(m) < \tfrac12 f(x) + \tfrac12 f(y) = f^\ast\), contradicción. \(\square\)</p>
      <ul>
        <li>\(\lVert x - p \rVert^2\) es estrictamente convexa: su mínimo sobre un convexo es la <em>proyección</em> de \(p\), única.</li>
        <li>Una función lineal es convexa pero no estrictamente: si \(c\) es perpendicular a una arista, todos sus puntos son óptimos. Un LP puede tener infinitos óptimos; el conjunto óptimo es una cara de la región.</li>
        <li>\((x_1 + x_2 - s)^2\) es convexa pero constante en la dirección \((1,-1)\): el conjunto óptimo es un segmento.</li>
        <li>Sin convexidad, ni siquiera es de esperar unicidad: \((\lVert x - p \rVert^2 - r^2)^2\) se anula en toda una circunferencia.</li>
      </ul>
      <p>En un problema convexo el conjunto de soluciones óptimas es siempre convexo: si hay dos, hay infinitas (el segmento que las une).</p>
      <h2>Conexiones</h2>
      <p>La convexidad se estudia en <a href="tema.html?id=convex-sets-functions">conjuntos y funciones convexas</a>; el papel del entorno en <a href="tema.html?id=local-global-optima">óptimos locales y globales</a>; y la geometría de los óptimos en LP en <a href="tema.html?id=optimal-solution-geometry">geometría de las soluciones óptimas</a>.</p>`,
  });
})();
