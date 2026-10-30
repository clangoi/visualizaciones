(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const CLIMA = ['soleado', 'nublado', 'lluvia'], TRAFICO = ['bajo', 'medio', 'alto'];
  // Mezcla entre una tabla independiente y una dependiente (la lluvia trae tráfico).
  function tabla(dep) {
    const pc = [0.5, 0.3, 0.2], pt = [0.45, 0.35, 0.2];
    const D = [[0.33, 0.14, 0.03], [0.1, 0.15, 0.05], [0.02, 0.06, 0.12]];
    return pc.map((a, i) => pt.map((b, j) => (1 - dep) * a * b + dep * D[i][j]));
  }

  /* ---------- Fig. 1: tabla conjunta ---------- */

  function montarTabla(cuerpo) {
    let dep = 0.8, sel = { tipo: 'fila', i: 2 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dependencia entre clima y tráfico', min: 0, max: 1, paso: 0.05, valor: dep, formato: (v) => v.toFixed(2), alCambiar: (v) => { dep = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.25) : Math.min(380, Math.round(w * 0.4))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.9)), texto: 'P(clima, tráfico) alta' },
      { color: C.apagado, texto: 'marginales (sumas por fila y columna)' },
      { color: C.s4, texto: 'fila o columna en la que se condiciona', forma: 'linea' },
      { color: C.s1, texto: 'condicional', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila (un clima) o en una columna (un nivel de tráfico) para condicionar. La condicional es esa fila o columna dividida por su suma. Con dependencia 0, todas las filas tienen la misma forma: condicionar no cambia nada.');
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const P = tabla(dep), pc = P.map((f) => M.suma(f)), pt = TRAFICO.map((_, j) => M.suma(P.map((f) => f[j])));
      const vertical = W < 620, wT = vertical ? W : W * 0.55, hT = vertical ? H * 0.58 : H;
      const izq = 70, sup = 26, mar = 46, c = Math.min((wT - izq - mar - 10) / 3, (hT - sup - mar - 10) / 3);
      geo = { izq, sup, c };
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle';
      CLIMA.forEach((t, i) => { ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(t, izq - 8, sup + i * c + c / 2); });
      TRAFICO.forEach((t, j) => { ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.fillText(t, izq + j * c + c / 2, sup - 12); });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const v = P[i][j];
        ctx.fillStyle = VIZ.css(VIZ.enRampa(v / 0.35)); ctx.fillRect(izq + j * c + 1, sup + i * c + 1, c - 2, c - 2);
        ctx.fillStyle = v > 0.17 ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.font = VIZ.fuente(12, 500);
        ctx.fillText(VIZ.fmt(v, 2), izq + j * c + c / 2, sup + i * c + c / 2);
      }
      // Marginales.
      ctx.font = VIZ.fuente(11);
      pc.forEach((v, i) => { const w = v * (mar - 6) * 1.6; ctx.fillStyle = C.apagado; ctx.fillRect(izq + 3 * c + 4, sup + i * c + c / 2 - 6, w, 12); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(v, 2), izq + 3 * c + 8 + w, sup + i * c + c / 2); });
      pt.forEach((v, j) => { const h = v * (mar - 6) * 1.6; ctx.fillStyle = C.apagado; ctx.fillRect(izq + j * c + c / 2 - 6, sup + 3 * c + 4, 12, h); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(VIZ.fmt(v, 2), izq + j * c + c / 2 + 22, sup + 3 * c + 6); ctx.textBaseline = 'middle'; });
      ctx.strokeStyle = C.s4; ctx.lineWidth = 3;
      if (sel.tipo === 'fila') ctx.strokeRect(izq, sup + sel.i * c, 3 * c, c); else ctx.strokeRect(izq + sel.i * c, sup, c, 3 * c);
      ctx.lineWidth = 1;
      // Condicional.
      const cond = sel.tipo === 'fila' ? P[sel.i].map((v) => v / pc[sel.i]) : P.map((f) => f[sel.i] / pt[sel.i]);
      const marg = sel.tipo === 'fila' ? pt : pc, nombres = sel.tipo === 'fila' ? TRAFICO : CLIMA;
      ctx.save();
      const ox = vertical ? 0 : wT + 10, oy = vertical ? hT : 0;
      ctx.translate(ox, oy);
      const sub = { ...lienzo, ancho: vertical ? W : W - wT - 10, alto: vertical ? H - hT : H, ctx };
      const pl = VIZ.plano(sub, { xmin: -0.5, xmax: 2.5, ymin: 0, ymax: 1 }, { etiquetaY: sel.tipo === 'fila' ? `P(tráfico | clima = ${CLIMA[sel.i]})` : `P(clima | tráfico = ${TRAFICO[sel.i]})`, ticksX: [0, 1, 2], formatoX: (v) => nombres[v] || '', formatoY: (v) => `${Math.round(v * 100)}%` });
      pl.ejes();
      const bw = (pl.sx(1) - pl.sx(0)) * 0.6;
      cond.forEach((v, k) => {
        ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(pl.sx(k) - bw / 2, pl.sy(v), bw, pl.y0 - pl.sy(v), [4, 4, 0, 0]); ctx.fill();
        VIZ.trazar(ctx, pl, [[k - 0.35, marg[k]], [k + 0.35, marg[k]]], C.apagado, 2, [4, 3]);
      });
      ctx.restore();
      const MI = M.suma(P.flatMap((f, i) => f.map((v, j) => (v > 0 ? v * Math.log2(v / (pc[i] * pt[j])) : 0))));
      lectura.set([
        ['P(lluvia, alto)', VIZ.fmt(P[2][2], 3)],
        ['P(lluvia) · P(alto)', VIZ.fmt(pc[2] * pt[2], 3)],
        ['P(alto | lluvia)', VIZ.fmt(P[2][2] / pc[2], 3)],
        ['información mutua', `${VIZ.fmt(MI, 3)} bits`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const celda = (x, y) => { const j = Math.floor((x - geo.izq) / geo.c), i = Math.floor((y - geo.sup) / geo.c); return { i, j, dentro: i >= 0 && i < 3 && j >= 0 && j < 3 }; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const { i, j, dentro } = celda(x, y);
      if (dentro) { const fx = (x - geo.izq) / geo.c - j, fy = (y - geo.sup) / geo.c - i; sel = Math.abs(fx - 0.5) > Math.abs(fy - 0.5) ? { tipo: 'col', i: j } : { tipo: 'fila', i }; }
      else if (j < 0 && i >= 0 && i < 3) sel = { tipo: 'fila', i };
      else if (i < 0 && j >= 0 && j < 3) sel = { tipo: 'col', i: j };
      else return;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const { i, j, dentro } = celda(x, y);
      if (!dentro) return tip.ocultar();
      const P = tabla(dep), pc = M.suma(P[i]), pt = M.suma(P.map((f) => f[j]));
      tip.mostrar(x, y, `P(${CLIMA[i]}, ${TRAFICO[j]}) = <b>${VIZ.fmt(P[i][j], 3)}</b><br>P(${TRAFICO[j]} | ${CLIMA[i]}) = <b>${VIZ.fmt(P[i][j] / pc, 3)}</b><br>P(${CLIMA[i]} | ${TRAFICO[j]}) = <b>${VIZ.fmt(P[i][j] / pt, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: variables continuas ---------- */

  function montarContinuas(cuerpo) {
    let rho = 0.65, x0 = 7, ancho = 1, semilla = 1, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Relación entre horas y nota', min: -0.9, max: 0.9, paso: 0.05, valor: rho, formato: (v) => v.toFixed(2), alCambiar: (v) => { rho = v; generar(); } });
    ctl.rango({ etiqueta: 'Condicionar en horas ≈', min: 2, max: 14, paso: 0.25, valor: x0, formato: (v) => v.toFixed(2), alCambiar: (v) => { x0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ancho de la franja', min: 0.25, max: 4, paso: 0.25, valor: ancho, formato: (v) => `± ${(v / 2).toFixed(2)}`, alCambiar: (v) => { ancho = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 320, altoMax: 470 });
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'franja de condicionamiento', forma: 'cuadro' },
      { color: C.s1, texto: 'nota dentro de la franja: condicional', forma: 'cuadro' },
      { color: C.inactivo, texto: 'nota de todos: marginal', forma: 'cuadro' },
      { color: C.tinta2, texto: 'estudiante', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba y a la derecha, las marginales. A la derecha, en azul, la distribución de la nota solo entre quienes estudiaron alrededor de x₀ horas: es una estimación empírica de p(nota | horas = x₀).');
    function generar() {
      const rnd = VIZ.semilla(semilla);
      D = Array.from({ length: 600 }, () => { const z = VIZ.normal(rnd), w = VIZ.normal(rnd); return { x: 8 + 2.6 * z, y: 4.6 + 1.1 * (rho * z + Math.sqrt(1 - rho * rho) * w) }; });
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const mt = 70, md = 90;
      const pl = VIZ.plano({ ...lienzo, ancho: W - md, ctx }, { xmin: 0, xmax: 16, ymin: 1, ymax: 7.5 }, { etiquetaX: 'horas de estudio', etiquetaY: 'nota', margen: { sup: mt, izq: 44 } });
      pl.ejes();
      ctx.fillStyle = VIZ.alfa(C.s4, 0.18); ctx.fillRect(pl.sx(x0 - ancho / 2), pl.y1, pl.sx(x0 + ancho / 2) - pl.sx(x0 - ancho / 2), pl.y0 - pl.y1);
      const enF = (d) => Math.abs(d.x - x0) <= ancho / 2;
      ctx.save(); pl.recortar();
      for (const d of D) { ctx.fillStyle = enF(d) ? C.s1 : VIZ.alfa(C.tinta2, 0.45); ctx.beginPath(); ctx.arc(pl.sx(d.x), pl.sy(d.y), 2, 0, 2 * Math.PI); ctx.fill(); }
      ctx.restore();
      // Marginal de horas (arriba).
      const B = 32, hx = new Array(B).fill(0);
      D.forEach((d) => { const b = Math.floor((d.x / 16) * B); if (b >= 0 && b < B) hx[b]++; });
      const mx = Math.max(...hx), bwx = (pl.x1 - pl.x0) / B;
      hx.forEach((v, b) => { const h = (v / mx) * (mt - 22); ctx.fillStyle = C.inactivo; ctx.fillRect(pl.x0 + b * bwx + 0.5, mt - 8 - h, bwx - 1, h); });
      // Marginal y condicional de nota (derecha).
      const By = 26, hy = new Array(By).fill(0), hc = new Array(By).fill(0), yb = (v) => Math.floor(((v - 1) / 6.5) * By);
      D.forEach((d) => { const b = yb(d.y); if (b >= 0 && b < By) { hy[b]++; if (enF(d)) hc[b]++; } });
      const nC = M.suma(hc), sh = (pl.y0 - pl.y1) / By, x1 = pl.x1 + 10, wmax = md - 16;
      const dm = Math.max(...hy) / D.length, dc = nC ? Math.max(...hc) / nC : 1, esc = Math.max(dm, dc);
      hy.forEach((v, b) => { const w = (v / D.length / esc) * wmax; ctx.fillStyle = C.inactivo; ctx.fillRect(x1, pl.y0 - (b + 1) * sh + 0.5, w, sh - 1); });
      if (nC) hc.forEach((v, b) => { if (!v) return; const w = (v / nC / esc) * wmax; ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.strokeRect(x1, pl.y0 - (b + 1) * sh + 1, w, sh - 2); });
      const yc = D.filter(enF).map((d) => d.y), ys = D.map((d) => d.y);
      lectura.set([
        ['estudiantes en la franja', String(yc.length)],
        ['nota media: marginal · condicional', `${VIZ.fmt(M.media(ys), 3)} · ${yc.length ? VIZ.fmt(M.media(yc), 3) : '—'}`],
        ['desviación: marginal · condicional', `${VIZ.fmt(M.desv(ys), 3)} · ${yc.length > 1 ? VIZ.fmt(M.desv(yc), 3) : '—'}`],
        ['P(nota ≥ 5 | franja)', yc.length ? M.pct(yc.filter((v) => v >= 5).length / yc.length, 0) : '—'],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    generar();
  }

  VIZ.registrarTema('joint-marginal-conditional', {
    intro: String.raw`
      <p>Cuando se observan dos variables a la vez, su <strong>distribución conjunta</strong> dice qué tan probable es cada combinación.
      De ella salen las otras dos: la <strong>marginal</strong> de una variable (sumando sobre la otra) y la <strong>condicional</strong>
      de una dado un valor de la otra (quedarse con una fila de la tabla y renormalizarla).</p>
      <p>Estas tres operaciones —conjunta, marginalizar, condicionar— son todo lo que se necesita para el
      <a href="tema.html?id=bayes-theorem">teorema de Bayes</a>, las <a href="tema.html?id=bayesian-networks">redes bayesianas</a> y la inferencia probabilística.</p>`,
    visualizaciones: [
      {
        titulo: 'Tabla conjunta',
        descripcion: 'Clima y tráfico: la tabla conjunta, sus marginales y la condicional de la fila o columna elegida. Lleve la dependencia a 0 y compare.',
        montar: montarTabla,
      },
      {
        titulo: 'Variables continuas',
        descripcion: 'Horas de estudio y nota de 600 estudiantes sintéticos. Mueva la franja y compare la distribución de la nota dentro de ella con la de todos.',
        montar: montarContinuas,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Para variables discretas \(X, Y\) con distribución conjunta \(P(X = x, Y = y)\):</p>
      \[ P(X = x) = \sum_y P(X = x, Y = y) \quad\text{(marginal)}, \qquad
         P(Y = y \mid X = x) = \frac{P(X = x, Y = y)}{P(X = x)} \quad\text{(condicional, si } P(X = x) &gt; 0). \]
      <p>Para variables continuas las sumas se vuelven integrales: \(p(x) = \int p(x, y)\,dy\) y \(p(y \mid x) = p(x, y)/p(x)\).</p>
      <h2>Reglas</h2>
      <ul>
        <li><strong>Producto</strong>: \(P(X, Y) = P(Y \mid X)\,P(X) = P(X \mid Y)\,P(Y)\).</li>
        <li><strong>Cadena</strong>: \(P(X_1, \dots, X_n) = \prod_i P(X_i \mid X_1, \dots, X_{i-1})\).</li>
        <li><strong>Probabilidad total</strong>: \(P(Y) = \sum_x P(Y \mid X = x)\,P(X = x)\).</li>
      </ul>
      <h2>Independencia</h2>
      <p>\(X\) e \(Y\) son independientes si \(P(X, Y) = P(X)\,P(Y)\) para todos los valores, o equivalentemente \(P(Y \mid X) = P(Y)\):
      todas las filas de la tabla tienen la misma forma. La <strong>información mutua</strong>
      \(I(X; Y) = \sum_{x, y} P(x, y) \log_2 \frac{P(x, y)}{P(x) P(y)} \ge 0\) mide cuánto se aparta la conjunta de ese producto, y vale 0 solo
      con independencia. Ver <a href="tema.html?id=conditional-independence">independencia condicional</a>.</p>
      <h2>Estimación desde datos</h2>
      <p>Con datos, las probabilidades se estiman con frecuencias: \(\hat P(x, y) = n_{xy}/n\). Condicionar en un valor continuo exige una
      franja (como en la figura) o un modelo; con franjas angostas quedan pocos datos y la estimación se vuelve ruidosa. En dimensión alta
      la tabla conjunta tiene un número exponencial de celdas: por eso se factoriza con <a href="tema.html?id=bayesian-networks">redes bayesianas</a>.</p>`,
  });
})();