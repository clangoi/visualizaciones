(function () {
  'use strict';
  const { color: C, fmt } = VIZ;
  const O = VIZ.opt;

  /* ---------- Fig. 1: un mismo modelo en cuatro clases ---------- */

  const RESTR = [
    { a: [2, 3], b: 14, nombre: '2x₁ + 3x₂ ≤ 14' },
    { a: [3, 1], b: 12.5, nombre: '3x₁ + x₂ ≤ 12.5' },
    { a: [-1, 0], b: 0, nombre: 'x₁ ≥ 0' },
    { a: [0, -1], b: 0, nombre: 'x₂ ≥ 0' },
  ];
  const POLI = O.poligono(RESTR).map((p) => p.map((v) => Math.round(v * 1e9) / 1e9));
  const DOM = { xmin: -0.5, xmax: 8, ymin: -0.5, ymax: 6.5 };
  const enPoli = (x, y) => RESTR.every((r) => r.a[0] * x + r.a[1] * y <= r.b + 1e-9);
  const esEntero = (v) => Math.abs(v - Math.round(v)) < 1e-9;

  const CLASES = {
    lp: { nombre: 'LP: variables continuas, todo lineal', corto: 'LP' },
    ilp: { nombre: 'ILP: x₁ y x₂ enteras', corto: 'ILP' },
    milp: { nombre: 'MILP: x₁ entera, x₂ continua', corto: 'MILP' },
    nlp: { nombre: 'NLP: continuas, con una restricción no lineal', corto: 'NLP' },
  };

  function montarClases(cuerpo) {
    let clase = 'ilp', c1 = 3, c2 = 2, R = 3.6, P = [2, 2], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Clase del modelo', opciones: Object.entries(CLASES).map(([k, q]) => [k, q.nombre]), valor: clase, alCambiar: (v) => { clase = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Coeficiente c₁', min: 0.5, max: 5, paso: 0.5, valor: c1, alCambiar: (v) => { c1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Coeficiente c₂', min: 0.5, max: 5, paso: 0.5, valor: c2, alCambiar: (v) => { c2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Radio R (restricción x₁² + x₂² ≤ R², solo NLP)', min: 2, max: 6, paso: 0.1, valor: R, formato: (v) => fmt(v, 2), alCambiar: (v) => { R = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 290, altoMax: 450 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.25), borde: C.s1, texto: 'conjunto factible de la clase elegida' },
      { color: C.s1, texto: 'puntos / segmentos factibles', forma: 'punto' },
      { color: C.s6, texto: 'óptimo de la clase', forma: 'cuadro' },
      { color: C.tinta, texto: 'óptimo de la relajación lineal', forma: 'punto' },
      { color: C.s2, texto: 'nivel del objetivo en el óptimo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic (o arrastre) para colocar un punto de prueba: su color dice si es factible en la clase elegida. Cambie de clase con el selector y compare los óptimos.');

    const dentroDisco = (x, y) => x * x + y * y <= R * R + 1e-9;
    const factible = (k, x, y) => enPoli(x, y) && (k === 'ilp' ? esEntero(x) && esEntero(y) : k === 'milp' ? esEntero(x) : k === 'nlp' ? dentroDisco(x, y) : true);

    // Óptimos de max c·x en cada clase.
    function resolver() {
      const lp = O.optimo2d(POLI, [c1, c2]);
      let ilp = null;
      for (let x = 0; x <= 8; x++) for (let y = 0; y <= 7; y++) if (enPoli(x, y)) { const v = c1 * x + c2 * y; if (!ilp || v > ilp.z) ilp = { x: [x, y], z: v }; }
      let milp = null;
      for (let x = 0; x <= 8; x++) {
        let hi = Infinity;
        RESTR.forEach((r) => { if (r.a[1] > 0) hi = Math.min(hi, (r.b - r.a[0] * x) / r.a[1]); });
        if (hi < -1e-9) continue;
        hi = Math.max(0, hi);
        if (!enPoli(x, 0)) continue;
        const v = c1 * x + c2 * hi;
        if (!milp || v > milp.z) milp = { x: [x, hi], z: v };
      }
      let nlp = null;
      const probar = (x, y) => { if (enPoli(x, y) && dentroDisco(x, y)) { const v = c1 * x + c2 * y; if (!nlp || v > nlp.z) nlp = { x: [x, y], z: v }; } };
      POLI.forEach(([x, y]) => probar(x, y));
      for (let k = 0; k <= 6000; k++) { const a = (k / 6000) * (Math.PI / 2); probar(R * Math.cos(a), R * Math.sin(a)); }
      for (let i = 0; i < POLI.length; i++) {
        const p = POLI[i], q = POLI[(i + 1) % POLI.length];
        for (let k = 0; k <= 3000; k++) probar(p[0] + ((q[0] - p[0]) * k) / 3000, p[1] + ((q[1] - p[1]) * k) / 3000);
      }
      return { lp, ilp, milp, nlp };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const S = resolver();
      const trazarPoli = () => { ctx.beginPath(); POLI.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y)))); ctx.closePath(); };
      const escala = plano.sx(1) - plano.sx(0), escalaY = plano.sy(0) - plano.sy(1);
      // La relajación lineal siempre aparece tenue como referencia.
      ctx.save();
      trazarPoli();
      if (clase === 'lp') { ctx.fillStyle = VIZ.alfa(C.s1, 0.25); ctx.fill(); }
      ctx.strokeStyle = clase === 'lp' ? C.s1 : C.eje; ctx.lineWidth = clase === 'lp' ? 2 : 1.5; ctx.setLineDash(clase === 'lp' ? [] : [5, 4]); ctx.stroke();
      ctx.restore();
      if (clase === 'nlp') {
        ctx.save();
        trazarPoli(); ctx.clip();
        ctx.beginPath(); ctx.ellipse(plano.sx(0), plano.sy(0), R * escala, R * escalaY, 0, 0, Math.PI * 2);
        ctx.fillStyle = VIZ.alfa(C.s1, 0.25); ctx.fill();
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.beginPath();
        POLI.forEach(([x, y], i) => { if (dentroDisco(x, y)) { const q = POLI[(i + 1) % POLI.length]; if (dentroDisco(q[0], q[1])) { ctx.moveTo(plano.sx(x), plano.sy(y)); ctx.lineTo(plano.sx(q[0]), plano.sy(q[1])); } } });
        ctx.stroke(); ctx.restore();
      }
      if (clase === 'ilp') {
        for (let x = 0; x <= 8; x++) for (let y = 0; y <= 7; y++) if (enPoli(x, y)) VIZ.marcador(ctx, plano.sx(x), plano.sy(y), C.s1, 4);
      }
      if (clase === 'milp') {
        ctx.save(); ctx.strokeStyle = C.s1; ctx.lineWidth = 3.5;
        for (let x = 0; x <= 8; x++) {
          let hi = Infinity;
          RESTR.forEach((r) => { if (r.a[1] > 0) hi = Math.min(hi, (r.b - r.a[0] * x) / r.a[1]); });
          if (enPoli(x, 0) && hi >= 0) { ctx.beginPath(); ctx.moveTo(plano.sx(x), plano.sy(0)); ctx.lineTo(plano.sx(x), plano.sy(hi)); ctx.stroke(); }
        }
        ctx.restore();
      }
      // Etiquetas de restricciones.
      ctx.save(); ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'middle';
      ctx.fillText('R1', plano.sx(0.4), plano.sy(4.667) - 13);
      ctx.fillText('R2', plano.sx(4.1) + 6, plano.sy(0.1) - 12);
      if (clase === 'nlp') ctx.fillText('x₁² + x₂² ≤ R²', plano.sx(R * 0.7) , plano.sy(R * 0.72) - 12);
      ctx.restore();

      const opt = S[clase];
      const v = opt ? opt.z : NaN;
      if (opt) {
        VIZ.ml.contorno(ctx, plano, (x, y) => c1 * x + c2 * y, v, { color: C.s2, ancho: 1.8, guiones: [5, 4] });
        VIZ.marcador(ctx, plano.sx(opt.x[0]), plano.sy(opt.x[1]), C.s6, 7, 1);
      }
      VIZ.marcador(ctx, plano.sx(S.lp.x[0]), plano.sy(S.lp.x[1]), C.tinta, 4);
      const ok = factible(clase, P[0], P[1]);
      VIZ.marcador(ctx, plano.sx(P[0]), plano.sy(P[1]), ok ? C.s6 : C.s8, 6, 3);

      const en = Object.keys(CLASES).filter((k) => factible(k, P[0], P[1])).map((k) => CLASES[k].corto);
      const explic = {
        lp: 'El conjunto factible es un polígono continuo: el óptimo está en un vértice y el Simplex lo encuentra rápido.',
        ilp: 'Solo valen los puntos de coordenadas enteras: el óptimo entero queda más abajo que el del LP y no siempre está en un vértice del polígono.',
        milp: 'La parte entera deja segmentos verticales: el óptimo es el mejor punto de esos segmentos.',
        nlp: 'La restricción curva recorta la región: el óptimo puede estar sobre la curva, no en un vértice.',
      }[clase];
      registro.textContent = `${explic} Punto (${fmt(P[0], 3)}, ${fmt(P[1], 3)}): ${en.length ? 'factible en ' + en.join(', ') : 'no es factible en ninguna clase'}.`;
      lectura.set([
        ['óptimo LP', fmt(S.lp.z, 5)],
        ['óptimo MILP', S.milp ? fmt(S.milp.z, 5) : '—'],
        ['óptimo ILP', S.ilp ? fmt(S.ilp.z, 5) : '—'],
        ['óptimo NLP (≈)', S.nlp ? fmt(S.nlp.z, 5) : '—'],
        ['brecha LP − ILP', S.ilp ? fmt(S.lp.z - S.ilp.z, 4) : '—'],
        ['en la clase', opt ? `(${fmt(opt.x[0], 3)}, ${fmt(opt.x[1], 3)})` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const cv = lienzo.canvas;
    let arrastrando = false;
    const poner = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      P = [Math.round(plano.ix(x) * 4) / 4, Math.round(plano.iy(y) * 4) / 4];
      dibujar();
    };
    cv.addEventListener('pointerdown', (ev) => { arrastrando = true; cv.setPointerCapture(ev.pointerId); poner(ev); });
    cv.addEventListener('pointermove', (ev) => {
      cv.style.cursor = 'crosshair';
      if (arrastrando) poner(ev);
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = Math.round(plano.ix(x) * 4) / 4, w = Math.round(plano.iy(y) * 4) / 4;
      tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(w, 3)})</b><br>objetivo <b>${fmt(c1 * u + c2 * w, 4)}</b><br>factible en: <b>${Object.keys(CLASES).filter((k) => factible(k, u, w)).map((k) => CLASES[k].corto).join(', ') || 'ninguna'}</b>`);
    });
    cv.addEventListener('pointerup', () => { arrastrando = false; });
    cv.addEventListener('pointercancel', () => { arrastrando = false; });
    cv.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: clasificador de modelos ---------- */

  const VARS = { cont: 'todas continuas', mixto: 'algunas enteras', ent: 'todas enteras', bin: 'todas binarias (0 o 1)' };
  const OBJ = {
    lineal: { n: 'lineal: 3x + 2y', conv: true, lin: true },
    cuad: { n: 'cuadrática convexa: x² + y²', conv: true },
    saddle: { n: 'cuadrática no convexa: x² − y²', conv: false },
    bil: { n: 'producto: x·y', conv: false },
    exp: { n: 'exponencial: eˣ + y', conv: true },
  };
  const RES = {
    lineales: { n: 'todas lineales', conv: true, lin: true },
    disco: { n: 'con x² + y² ≤ 4 (convexa)', conv: true },
    fuera: { n: 'con x² + y² ≥ 1 (no convexa)', conv: false },
    hip: { n: 'con x·y ≤ 2 (no convexa)', conv: false },
  };
  // Posiciones en la cuadrícula: columna según variables, fila según linealidad.
  const COL = { cont: 0, mixto: 1, ent: 2, bin: 2 };
  const NOMBRES = [['LP', 'MILP', 'ILP'], ['NLP', 'MINLP', 'MINLP (enteras)']];

  function clasificar(v, o, r) {
    const lineal = OBJ[o].lin && RES[r].lin;
    const convexo = OBJ[o].conv && RES[r].conv;
    const fila = lineal ? 0 : 1, col = COL[v];
    let nombre = NOMBRES[fila][col];
    if (v === 'bin') nombre = lineal ? 'ILP binario (0-1)' : 'MINLP binario';
    let dif, metodo, garantia;
    if (lineal) {
      if (v === 'cont') { dif = 1; metodo = 'Simplex o puntos interiores (tiempo polinomial)'; garantia = 'óptimo global certificado por dualidad'; }
      else { dif = v === 'mixto' ? 4 : 4; metodo = 'ramificación y acotamiento con planos de corte sobre relajaciones LP'; garantia = 'óptimo global; el costo puede crecer exponencialmente (NP-difícil)'; }
    } else if (v === 'cont') {
      if (convexo) { dif = 2; metodo = 'puntos interiores, gradiente proyectado, condiciones KKT'; garantia = 'todo óptimo local es global (problema convexo)'; }
      else { dif = 4; metodo = 'métodos locales (descenso, SQP) con varios arranques; global con ramificación espacial'; garantia = 'solo óptimos locales; el global no está garantizado'; }
    } else {
      dif = 5;
      metodo = convexo ? 'ramificación y acotamiento resolviendo una relajación NLP convexa en cada nodo' : 'ramificación espacial y enteros combinados; en la práctica, heurísticas';
      garantia = convexo ? 'óptimo global (relajación convexa)' : 'sin garantía global en general';
    }
    return { nombre, fila, col, lineal, convexo, dif, metodo, garantia };
  }

  function montarClasificador(cuerpo) {
    let v = 'ent', o = 'lineal', r = 'lineales', plano = null, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    const sV = ctl.selector({ etiqueta: 'Variables', opciones: Object.entries(VARS), valor: v, alCambiar: (x) => { v = x; dibujar(); } });
    const sO = ctl.selector({ etiqueta: 'Función objetivo (minimizar)', opciones: Object.entries(OBJ).map(([k, q]) => [k, q.n]), valor: o, alCambiar: (x) => { o = x; dibujar(); } });
    const sR = ctl.selector({ etiqueta: 'Restricciones', opciones: Object.entries(RES).map(([k, q]) => [k, q.n]), valor: r, alCambiar: (x) => { r = x; dibujar(); } });
    ctl.boton('Modelo al azar', () => {
      const rnd = VIZ.semilla(semilla++ * 977 + 11), pick = (m) => Object.keys(m)[Math.floor(rnd() * Object.keys(m).length)];
      v = pick(VARS); o = pick(OBJ); r = pick(RES);
      sV.valor = v; sO.valor = o; sR.valor = r; dibujar();
    }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 250, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'forma típica del conjunto factible' },
      { color: C.s2, texto: 'clase del modelo elegido', forma: 'cuadro' },
    ]);
    const pre = VIZ.el('pre', { class: 'lista-mono' });
    cuerpo.appendChild(pre);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija el tipo de variables y de funciones, o haga clic en una celda de la cuadrícula. La celda iluminada es la clase; las columnas van de lo continuo a lo entero y las filas de lo lineal a lo no lineal.');

    const dentroPoli = (x, y) => x >= 0.06 && y >= 0.08 && x <= 0.94 && y <= 0.92 && (x + y) >= 0.32 && (x + y) <= 1.5;
    function mini(ctx, cx, cy, w, h, fila, col) {
      const X = (u) => cx + u * w, Y = (t) => cy + (1 - t) * h;
      const dentro = (u, t) => dentroPoli(u, t) && (fila === 0 || Math.hypot(u - 0.2, t - 0.2) <= 0.82);
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, w, h); ctx.clip();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.28); ctx.strokeStyle = C.s1; ctx.lineWidth = 2;
      if (col === 0) {
        ctx.beginPath();
        const pts = [];
        for (let u = 0; u <= 1.0001; u += 0.01) for (let t = 0; t <= 1.0001; t += 0.01) if (dentro(u, t)) pts.push([u, t]);
        pts.forEach(([u, t]) => ctx.rect(X(u), Y(t), w * 0.0105, h * 0.0105));
        ctx.fill();
      } else if (col === 1) {
        ctx.lineWidth = 3;
        for (let k = 1; k <= 7; k++) {
          const u = k / 8;
          let a = -1, b = -1;
          for (let t = 0; t <= 1.0001; t += 0.005) if (dentro(u, t)) { if (a < 0) a = t; b = t; }
          if (a >= 0) { ctx.beginPath(); ctx.moveTo(X(u), Y(a)); ctx.lineTo(X(u), Y(b)); ctx.stroke(); }
        }
      } else {
        ctx.fillStyle = C.s1;
        for (let i = 1; i <= 7; i++) for (let j = 1; j <= 5; j++) {
          const u = i / 8, t = j / 6;
          if (dentro(u, t)) { ctx.beginPath(); ctx.arc(X(u), Y(t), 3.2, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.restore();
    }

    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const k = clasificar(v, o, r);
      const m = 8, cw = (W - 4 * m) / 3, ch = (H - 3 * m) / 2;
      celdas = [];
      for (let f = 0; f < 2; f++) for (let c = 0; c < 3; c++) {
        const x = m + c * (cw + m), y = m + f * (ch + m), act = f === k.fila && c === k.col;
        celdas.push({ x, y, w: cw, h: ch, f, c });
        ctx.fillStyle = act ? VIZ.alfa(C.s2, 0.14) : C.fondo2;
        ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = act ? C.s2 : C.rejilla; ctx.lineWidth = act ? 3 : 1;
        ctx.strokeRect(x, y, cw, ch);
        mini(ctx, x + cw * 0.08, y + 22, cw * 0.84, ch - 30, f, c);
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(NOMBRES[f][c] === 'MINLP (enteras)' ? 'MINLP entero' : NOMBRES[f][c], x + 8, y + 5);
      }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ['continuas', 'mixtas', 'enteras'].forEach((t, c) => ctx.fillText(t, m + c * (cw + m) + cw / 2, H - 0));
      const mod = `${'mín'} ${OBJ[o].n.split(': ')[1]}\ns.a. ${RES[r].lin ? 'restricciones lineales' : 'restricciones lineales y ' + RES[r].n.replace('con ', '')}\n    variables: ${VARS[v]}`;
      pre.textContent = mod;
      registro.textContent = `Clase: ${k.nombre}. ` + (k.lineal ? 'Objetivo y restricciones son lineales. ' : 'Hay al menos una función no lineal. ')
        + (v === 'cont' ? 'Todas las variables son continuas. ' : v === 'mixto' ? 'Mezcla variables enteras y continuas. ' : v === 'ent' ? 'Todas las variables son enteras. ' : 'Las variables solo toman 0 o 1. ')
        + (k.lineal ? '' : (k.convexo ? 'La relajación continua es convexa. ' : 'La relajación continua no es convexa. '));
      lectura.set([
        ['clase', k.nombre],
        ['relajación convexa', k.lineal ? 'sí (lineal)' : k.convexo ? 'sí' : 'no'],
        ['garantía', k.garantia],
        ['método típico', k.metodo],
        ['dificultad (1–5)', '●'.repeat(k.dif) + '○'.repeat(5 - k.dif)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const buscar = (x, y) => celdas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = buscar(x, y);
      if (!q) return;
      v = q.c === 0 ? 'cont' : q.c === 1 ? 'mixto' : (v === 'bin' ? 'bin' : 'ent');
      if (q.f === 0) { o = 'lineal'; r = 'lineales'; } else if (OBJ[o].lin && RES[r].lin) { o = 'cuad'; r = 'disco'; }
      sV.valor = v; sO.valor = o; sR.valor = r;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = buscar(x, y);
      lienzo.canvas.style.cursor = q ? 'pointer' : 'default';
      if (!q) return tip.ocultar();
      const desc = [
        ['Variables continuas, funciones lineales: región poligonal; se resuelve en tiempo polinomial.', 'Algunas variables enteras: el conjunto son «rebanadas» de la región; NP-difícil.', 'Todas enteras: solo los puntos de una malla dentro de la región; NP-difícil.'],
        ['Continuas con funciones no lineales: bordes curvos; fácil si es convexo, difícil si no.', 'Mezcla de enteros y no linealidad: la clase más difícil.', 'Enteros con no linealidad: malla dentro de una región curva.'],
      ][q.f][q.c];
      tip.mostrar(x, y, `<b>${NOMBRES[q.f][q.c]}</b><br>${desc}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('problem-classes', {
    intro: String.raw`
      <p>Según el tipo de variables y de funciones, un problema de optimización cae en una de cuatro familias grandes: <strong>LP</strong> (todo lineal,
      variables continuas), <strong>ILP</strong> (lineal, variables enteras), <strong>MILP</strong> (lineal, algunas enteras y otras continuas) y
      <strong>NLP</strong> (alguna función no lineal). Cambia mucho la forma del conjunto factible, y con ella la dificultad de resolver el problema.</p>
      <p>Lo más importante no es el nombre sino la consecuencia práctica: qué método usar, qué garantía se obtiene y cuánto puede tardar. Aquí verá el mismo
      modelo en las cuatro clases y luego podrá clasificar modelos mezclando sus ingredientes.</p>`,
    visualizaciones: [
      {
        titulo: 'Un mismo modelo en cuatro clases',
        descripcion: 'Cambie de clase con el selector y compare la forma del conjunto factible y el valor óptimo: el LP da la cota más alta, el MILP queda por debajo y el ILP más aún. Coloque puntos de prueba con clic para ver en qué clases son factibles.',
        montar: montarClases,
      },
      {
        titulo: 'Clasificador de modelos',
        descripcion: 'Combine el tipo de variables, la función objetivo y las restricciones: se ilumina la clase en la cuadrícula y la lectura indica convexidad, garantía y método típico. Pruebe «x² − y²» o «x·y» para perder la convexidad y «todas enteras» para pasar a ramificación.',
        montar: montarClasificador,
      },
    ],
    teoria: String.raw`
      <h2>Las cuatro clases</h2>
      <table>
        <tr><th>clase</th><th>funciones</th><th>variables</th><th>conjunto factible</th></tr>
        <tr><td>LP</td><td>lineales</td><td>continuas</td><td>poliedro (convexo)</td></tr>
        <tr><td>ILP</td><td>lineales</td><td>todas enteras, \(x \in \mathbb{Z}^n\)</td><td>puntos enteros de un poliedro</td></tr>
        <tr><td>MILP</td><td>lineales</td><td>parte entera, parte continua</td><td>unión de «rebanadas» poliédricas</td></tr>
        <tr><td>NLP</td><td>alguna no lineal</td><td>continuas</td><td>región con bordes curvos</td></tr>
        <tr><td>MINLP</td><td>alguna no lineal</td><td>mixtas</td><td>combinación de ambas dificultades</td></tr>
      </table>
      <p>Los problemas con variables binarias \(x_i \in \{0,1\}\) son un caso de ILP/MILP: se obtienen con \(0 \le x_i \le 1\) y \(x_i\) entera.</p>
      <h2>Relajación y orden de los óptimos</h2>
      <p>Si se ignoran las condiciones de integralidad se obtiene la <em>relajación lineal</em>, cuyo conjunto factible contiene al original. Para un problema de maximización,</p>
      \[ z_{\text{ILP}} \;\le\; z_{\text{MILP}} \;\le\; z_{\text{LP}}, \]
      <p>pues cada exigencia adicional puede empeorar el óptimo pero nunca mejorarlo (en el ejemplo de la figura: \(z_{LP} \approx 14.93\), \(z_{MILP} \approx 14.33\) y \(z_{ILP} = 13\)). La diferencia \(z_{LP} - z_{ILP}\) es la <em>brecha de integralidad</em>. Esto fundamenta <a href="tema.html?id=lp-relaxation">la relajación lineal</a> y <a href="tema.html?id=branch-and-bound">ramificación y acotamiento</a>.</p>
      <p>Además, redondear la solución del LP no sirve en general: puede ser infactible o muy lejana del óptimo entero (en la figura, \((3.36, 2.43)\) se redondea a \((3, 2)\), que sí es factible, pero a \((4,2)\) o \((3,3)\), que no).</p>
      <h2>Dificultad relativa</h2>
      <ul>
        <li><strong>LP</strong>: resoluble en tiempo polinomial (puntos interiores) y, en la práctica, muy rápido con el <a href="tema.html?id=simplex-tableau">Simplex</a>. El óptimo se certifica con el dual.</li>
        <li><strong>ILP y MILP</strong>: NP-difíciles. El tiempo de resolución puede crecer exponencialmente con el número de variables enteras; se usan ramificación, cortes y heurísticas.</li>
        <li><strong>NLP convexo</strong> (objetivo convexo y región convexa): todo óptimo local es global; se resuelve con puntos interiores o con las <a href="tema.html?id=kkt-conditions">condiciones KKT</a>.</li>
        <li><strong>NLP no convexo</strong>: pueden existir muchos mínimos locales (<a href="tema.html?id=local-global-optima">óptimos locales y globales</a>); los métodos usuales encuentran uno local.</li>
        <li><strong>MINLP</strong>: combina ambas dificultades y es la clase más exigente.</li>
      </ul>
      <h2>Cómo clasificar un modelo</h2>
      <pre><code>1. ¿Alguna variable es entera o binaria?     sí → (M)IP     no → continuo
2. ¿Objetivo y restricciones son lineales?   sí → LP / ILP / MILP
                                             no → NLP / MINLP
3. Si hay no linealidad: ¿objetivo convexo (al minimizar)
   y región convexa?                         sí → convexo (fácil)   no → no convexo</code></pre>
      <p>Una función es lineal si es de la forma \(a^\top x + b\); términos como \(x^2\), \(xy\), \(e^x\) o \(|x|\) la vuelven no lineal (aunque \(|x|\) se puede reescribir; véase <a href="tema.html?id=equivalent-formulations">formulaciones equivalentes</a>). Un producto de dos variables, como \(xy\), no es convexo. Conviene reformular un modelo hacia una clase más fácil siempre que sea posible. Consulte también la <a href="tema.html?id=optimization-problem-anatomy">anatomía de un problema de optimización</a> y <a href="tema.html?id=convex-sets-functions">convexidad</a>.</p>`,
  });
})();
