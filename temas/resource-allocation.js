(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  // Canales de publicidad. Se asigna dinero x_j (miles de USD); alc: miles de personas alcanzadas por mil USD; ven: miles de USD de ventas por mil USD.
  const CAN = [
    { n: 'Televisión', alc: 5.0, ven: 1.2, min: 0, max: 50 },
    { n: 'Radio', alc: 3.2, ven: 1.8, min: 10, max: 30 },
    { n: 'Internet', alc: 4.1, ven: 2.6, min: 0, max: 45 },
    { n: 'Prensa', alc: 2.0, ven: 1.1, min: 5, max: 25 },
  ];
  const IDX_NET = 2;
  const COL = [C.s1, C.s2, C.s3, C.s4];
  const limpio = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
  const bajo = (t) => t[0].toLowerCase() + t.slice(1);
  const OBJ = {
    alc: { n: 'Alcance', u: 'miles de personas', c: CAN.map((k) => k.alc) },
    ven: { n: 'Ventas', u: 'miles de USD', c: CAN.map((k) => k.ven) },
    mix: { n: 'Mixto (alcance + ventas)', u: 'puntos', c: CAN.map((k) => k.alc + k.ven) },
  };

  // max c·x s.a. Σx ≤ B, (cuota) x_internet ≤ s Σx, mínimos y máximos por canal.
  function resolver(c, B, s) {
    const A = [[1, 1, 1, 1]], sen = ['<='], b = [B];
    if (s < 0.999) { A.push(CAN.map((_, j) => (j === IDX_NET ? 1 - s : -s))); sen.push('<='); b.push(0); }
    return O.lp(c, A, sen, b, { max: true, cotas: CAN.map((k) => [k.min, k.max]) });
  }

  /* ---------- Fig. 1: reparto óptimo ---------- */

  function montarReparto(cuerpo) {
    let B = 100, s = 1, clave = 'alc', sol = null, filas = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Qué se maximiza', opciones: Object.entries(OBJ).map(([k, o]) => [k, o.n]), valor: clave, alCambiar: (v) => { clave = v; calcular(); } });
    ctl.rango({ etiqueta: 'Presupuesto', min: 10, max: 200, valor: B, formato: (v) => `${v} mil USD`, alCambiar: (v) => { B = v; calcular(); } });
    ctl.rango({ etiqueta: 'Máx. en internet', min: 10, max: 100, valor: 100, formato: (v) => `${v} % del total`, alCambiar: (v) => { s = v / 100; calcular(); } });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 230 : 250) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'dinero asignado al canal' },
      { color: C.neutro, texto: 'rango permitido (mínimo a tope)', borde: C.eje },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un canal: la banda gris es lo que el contrato permite (mínimo y tope) y la barra azul, lo que el óptimo asigna. Pase el cursor por una fila para ver su retorno por mil USD.');

    function calcular() {
      const o = OBJ[clave];
      sol = resolver(o.c, B, s);
      filas = [];
      if (sol.estado === 'optimo') {
        const x = sol.x.map(limpio), tot = x.reduce((a, v) => a + v, 0);
        const zB = resolver(o.c, B + 1, s), zS = resolver(o.c, B, Math.min(1, s + 0.01));
        filas.push({ nom: 'Presupuesto total', uso: tot, lim: B, h: B - tot, act: B - tot < 1e-6, precio: zB.estado === 'optimo' ? zB.z - sol.z : null, u: 'por mil USD' });
        if (s < 0.999) {
          const lhs = x[IDX_NET] - s * tot;
          filas.push({ nom: 'Cuota de internet', uso: x[IDX_NET], lim: s * tot, h: -lhs, act: Math.abs(lhs) < 1e-6, precio: zS.estado === 'optimo' ? zS.z - sol.z : null, u: 'por punto porcentual' });
        }
      }
      tabla();
      dibujar();
    }
    function tabla() {
      if (!filas.length) { caja.replaceChildren(); return; }
      const t = VIZ.el('table', { class: 'tabla-datos sin-corte' });
      t.innerHTML = `<thead><tr><th class="izq">Restricción global</th><th>Uso</th><th>Límite</th><th>Holgura</th><th>Valor de relajarla (${OBJ[clave].u})</th></tr></thead>`;
      const tb = VIZ.el('tbody');
      filas.forEach((f) => {
        const tr = VIZ.el('tr', { class: f.act ? 'activa' : null });
        tr.innerHTML = `<td class="izq">${f.nom}</td><td>${VIZ.fmt(f.uso, 4)}</td><td>${VIZ.fmt(f.lim, 4)}</td><td>${f.act ? 'activa' : VIZ.fmt(f.h, 4)}</td><td>${f.precio == null ? '—' : `${VIZ.fmt(f.precio, 3)} ${f.u}`}</td>`;
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      caja.replaceChildren(t);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ok = sol && sol.estado === 'optimo', o = OBJ[clave];
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 55, ymin: 0, ymax: CAN.length }, { etiquetaX: 'miles de USD asignados', ticksY: [], margen: { izq: lienzo.ancho < 520 ? 78 : 104, sup: 8 } });
      const fh = (pl.y0 - pl.y1) / CAN.length;
      pl.ejes();
      const x = ok ? sol.x.map(limpio) : [];
      CAN.forEach((k, j) => {
        const yc = pl.y1 + (j + 0.5) * fh, hb = Math.min(40, fh * 0.78);
        ctx.fillStyle = C.neutro;
        ctx.strokeStyle = C.eje;
        ctx.lineWidth = 1;
        ctx.fillRect(pl.sx(k.min), yc - hb / 2, pl.sx(k.max) - pl.sx(k.min), hb);
        ctx.strokeRect(pl.sx(k.min) + 0.5, yc - hb / 2 + 0.5, pl.sx(k.max) - pl.sx(k.min), hb);
        if (ok && x[j] > 1e-9) {
          ctx.fillStyle = j === hover ? VIZ.alfa(C.s1, 0.75) : C.s1;
          ctx.beginPath();
          ctx.roundRect(pl.sx(0), yc - hb * 0.26, pl.sx(x[j]) - pl.sx(0), hb * 0.52, [0, 4, 4, 0]);
          ctx.fill();
        }
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillStyle = C.tinta;
        ctx.font = VIZ.fuente(11, 500);
        ctx.fillText(k.n, pl.x0 - 8, yc - 7);
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(10);
        ctx.fillText(lienzo.ancho < 520 ? `${VIZ.fmt(o.c[j], 3)}/mil` : `${VIZ.fmt(o.c[j], 3)} por mil USD`, pl.x0 - 8, yc + 7);
        if (ok) {
          ctx.textAlign = 'left';
          ctx.fillStyle = C.tinta;
          ctx.font = VIZ.fuente(11);
          ctx.fillText(VIZ.fmt(x[j], 4), Math.max(pl.sx(x[j]), pl.sx(k.max)) + 5, yc);
        }
        ctx.restore();
      });
      if (!ok) {
        ctx.save();
        ctx.fillStyle = C.s8;
        ctx.font = VIZ.fuente(13, 500);
        ctx.textAlign = 'center';
        ctx.fillText('Sin reparto posible: los mínimos y la cuota no caben', (pl.x0 + pl.x1) / 2, (pl.y0 + pl.y1) / 2);
        ctx.restore();
        registro.textContent = `Infactible: los mínimos contractuales suman ${CAN.reduce((a, k) => a + k.min, 0)} mil USD y, con la cuota de internet pedida, no caben en el presupuesto. Suba el presupuesto o la cuota.`;
        lectura.set([['valor óptimo', '—'], ['presupuesto usado', '—'], ['canales en un extremo', '—'], ['estado', 'infactible']]);
        return;
      }
      const estado = CAN.map((k, j) => (x[j] >= k.max - 1e-6 ? 'tope' : x[j] <= k.min + 1e-6 ? 'min' : 'medio'));
      const tot = x.reduce((a, v) => a + v, 0);
      const partes = CAN.map((k, j) => `${bajo(k.n)} ${estado[j] === 'tope' ? `en su tope (${k.max})` : estado[j] === 'min' ? (k.min > 0 ? `en su mínimo (${k.min})` : 'sin dinero') : `recibe el resto (${VIZ.fmt(x[j], 4)})`}`);
      registro.textContent = `Con "${bajo(o.n)}" como criterio: ${partes.join('; ')}.`;
      lectura.set([
        [`${bajo(o.n)} máximo`, `${VIZ.fmt(sol.z, 5)} ${o.u}`],
        ['presupuesto usado', `${VIZ.fmt(tot, 4)} de ${B}`],
        ['canales en un extremo', `${estado.filter((e) => e !== 'medio').length} de ${CAN.length}`],
        ['valor de 1 mil USD más', filas[0].precio == null ? '—' : `${VIZ.fmt(filas[0].precio, 3)} ${o.u}`],
      ]);
    }
    lienzo.alDibujar = () => sol && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !sol || sol.estado !== 'optimo' || y < pl.y1 || y > pl.y0) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const j = Math.min(CAN.length - 1, Math.floor(((y - pl.y1) / (pl.y0 - pl.y1)) * CAN.length));
      if (j !== hover) { hover = j; dibujar(); }
      const k = CAN[j], o = OBJ[clave], v = limpio(sol.x[j]);
      tip.mostrar(x, y, `<b>${k.n}</b><br>asignado <b>${VIZ.fmt(v, 4)}</b> mil USD<br>rango permitido ${k.min} a ${k.max}<br>`
        + `alcance ${VIZ.fmt(k.alc, 3)} · ventas ${VIZ.fmt(k.ven, 3)} por mil USD<br>aporta <b>${VIZ.fmt(v * o.c[j], 4)}</b> ${o.u}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); if (hover >= 0) { hover = -1; if (sol) dibujar(); } });
    calcular();
  }

  /* ---------- Fig. 2: compromiso entre dos objetivos ---------- */

  const N = 40;
  function montarCompromiso(cuerpo) {
    let B = 100, w = 0.5, pts = [], vert = [], Rmax = 1, Smax = 1, pA = null, pB = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto', min: 30, max: 200, valor: B, formato: (v) => `${v} mil USD`, alCambiar: (v) => { B = v; calcular(); } });
    const rW = ctl.rango({ etiqueta: 'Peso del alcance', min: 0, max: 1, paso: 1 / N, valor: w, formato: (v) => `${Math.round(v * 100)} % alcance`, alCambiar: (v) => { w = v; dibujar(); } });
    ctl.boton('Equilibrar (50 %)', () => { w = 0.5; rW.valor = w; dibujar(); }, { primario: true });

    VIZ.subtitulo(cuerpo, 'Frontera de compromiso: alcance frente a ventas');
    const lienzoA = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 250, altoMax: 380 });
    const tipA = VIZ.tooltip(lienzoA);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'repartos óptimos para cada peso', forma: 'linea' },
      { color: C.tinta, texto: 'peso elegido' },
      { color: C.apagado, texto: 'punto ideal (inalcanzable a la vez)', forma: 'linea' },
    ]);
    VIZ.subtitulo(cuerpo, 'Cómo cambia el reparto a lo largo de la frontera');
    const lienzoB = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 200, altoMax: 300 });
    const tipB = VIZ.tooltip(lienzoB);
    VIZ.leyenda(cuerpo, CAN.map((k, j) => ({ color: COL[j], texto: k.n })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en cualquiera de los dos gráficos (o use el deslizador) para elegir cuánto pesa el alcance frente a las ventas. En ningún punto de la frontera se mejora un objetivo sin empeorar el otro.');

    const R = (x) => x.reduce((a, v, j) => a + v * CAN[j].alc, 0), S = (x) => x.reduce((a, v, j) => a + v * CAN[j].ven, 0);
    function calcular() {
      const a = resolver(OBJ.alc.c, B, 1), v = resolver(OBJ.ven.c, B, 1);
      pts = [];
      if (a.estado !== 'optimo') { dibujar(); return; }
      Rmax = a.z; Smax = v.z;
      for (let i = 0; i <= N; i++) {
        const wi = i / N, c = CAN.map((k) => wi * (k.alc / Rmax) + (1 - wi) * (k.ven / Smax));
        const r = resolver(c, B, 1), x = r.x.map(limpio);
        pts.push({ w: wi, x, R: R(x), S: S(x) });
      }
      // Vértices distintos de la frontera, de menor a mayor alcance.
      vert = [];
      for (const p of pts) if (!vert.some((q) => Math.abs(q.R - p.R) < 1e-6 && Math.abs(q.S - p.S) < 1e-6)) vert.push(p);
      vert.sort((p, q) => p.R - q.R);
      dibujar();
    }
    const actual = () => pts[Math.round(w * N)];
    function dibujar() {
      if (!pts.length) return;
      const p = actual();
      // Frontera
      lienzoA.limpiar();
      const ctx = lienzoA.ctx;
      const rmin = Math.min(...pts.map((q) => q.R)), smin = Math.min(...pts.map((q) => q.S));
      pA = VIZ.plano(lienzoA, { xmin: Math.floor(rmin * 0.9), xmax: Rmax * 1.06, ymin: Math.floor(smin * 0.9), ymax: Smax * 1.06 }, { etiquetaX: 'alcance (miles de personas)', etiquetaY: 'ventas (miles de USD)' });
      pA.ejes();
      ctx.save();
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(pA.sx(Rmax), pA.y0); ctx.lineTo(pA.sx(Rmax), pA.sy(Smax)); ctx.lineTo(pA.x0, pA.sy(Smax));
      ctx.stroke();
      ctx.restore();
      VIZ.trazar(ctx, pA, vert.map((q) => [q.R, q.S]), C.s1, 2.5);
      for (const q of vert) VIZ.marcador(ctx, pA.sx(q.R), pA.sy(q.S), C.s1, 3.5);
      VIZ.marcador(ctx, pA.sx(p.R), pA.sy(p.S), C.tinta, 6);
      ctx.save();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('ideal', pA.sx(Rmax) - 4, pA.sy(Smax) - 2);
      ctx.restore();
      // Reparto a lo largo de los pesos
      lienzoB.limpiar();
      const cb = lienzoB.ctx;
      pB = VIZ.plano(lienzoB, { xmin: -0.5 / N, xmax: 1 + 0.5 / N, ymin: 0, ymax: B }, { etiquetaX: 'peso del alcance (0 = solo ventas, 1 = solo alcance)', etiquetaY: 'miles de USD', ticksX: [0, 0.25, 0.5, 0.75, 1] });
      pB.ejes();
      const bw = (pB.x1 - pB.x0) / (N + 1);
      pts.forEach((q) => {
        let acum = 0;
        q.x.forEach((v, j) => {
          cb.fillStyle = COL[j];
          cb.fillRect(pB.sx(q.w) - bw / 2, pB.sy(acum + v), bw + 1, pB.sy(acum) - pB.sy(acum + v));
          acum += v;
        });
      });
      cb.save();
      cb.strokeStyle = C.tinta; cb.lineWidth = 2;
      cb.beginPath(); cb.moveTo(pB.sx(p.w), pB.y1); cb.lineTo(pB.sx(p.w), pB.y0); cb.stroke();
      cb.restore();
      // Tasa de intercambio sobre el tramo de la frontera donde está el reparto elegido.
      let i = vert.findIndex((q) => q.R >= p.R - 1e-6);
      i = Math.min(Math.max(i, 0), vert.length - 1);
      let a = vert[i], b = vert[Math.min(i + 1, vert.length - 1)];
      if (a === b && i > 0) a = vert[i - 1];
      const tasa = b.R - a.R > 1e-9 ? (b.S - a.S) / (b.R - a.R) : null;
      registro.textContent = `Con ${Math.round(w * 100)} % de peso al alcance se logran ${VIZ.fmt(p.R, 5)} mil personas y USD ${VIZ.fmt(p.S, 5)} mil de ventas: `
        + `${VIZ.fmt((p.R / Rmax) * 100, 3)} % del mejor alcance posible y ${VIZ.fmt((p.S / Smax) * 100, 3)} % de las mejores ventas.`;
      lectura.set([
        ['alcance', `${VIZ.fmt(p.R, 5)} mil personas`],
        ['ventas', `${VIZ.fmt(p.S, 5)} mil USD`],
        ['del ideal', `${VIZ.fmt((p.R / Rmax) * 100, 3)} % · ${VIZ.fmt((p.S / Smax) * 100, 3)} %`],
        ['intercambio en este tramo', tasa == null ? '—' : `${VIZ.fmt(tasa, 3)} mil USD por mil personas`],
        ['reparto distinto en la frontera', `${vert.length} vértices`],
      ]);
    }
    function elegirDeFrontera(x, y) {
      let mejor = 0, d = Infinity;
      pts.forEach((q, k) => { const dd = Math.hypot(pA.sx(q.R) - x, pA.sy(q.S) - y); if (dd < d) { d = dd; mejor = k; } });
      return mejor;
    }
    const info = (q) => `peso del alcance <b>${Math.round(q.w * 100)} %</b><br>alcance <b>${VIZ.fmt(q.R, 5)}</b> · ventas <b>${VIZ.fmt(q.S, 5)}</b>`
      + CAN.map((k, j) => VIZ.filaTooltip(COL[j], k.n, `${VIZ.fmt(q.x[j], 4)} mil USD`)).join('');
    lienzoA.canvas.style.cursor = 'pointer';
    lienzoA.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzoA.posicion(ev);
      if (!pA || !pts.length || !pA.dentro(x, y)) return tipA.ocultar();
      tipA.mostrar(x, y, info(pts[elegirDeFrontera(x, y)]));
    });
    lienzoA.canvas.addEventListener('pointerleave', () => tipA.ocultar());
    lienzoA.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzoA.posicion(ev);
      if (!pA || !pts.length || !pA.dentro(x, y)) return;
      w = pts[elegirDeFrontera(x, y)].w; rW.valor = w; dibujar();
    });
    lienzoB.canvas.style.cursor = 'pointer';
    const colB = (ev) => { const { x, y } = lienzoB.posicion(ev); return pB && pB.dentro(x, y) ? Math.max(0, Math.min(N, Math.round(pB.ix(x) * N))) : -1; };
    lienzoB.canvas.addEventListener('pointermove', (ev) => {
      const k = colB(ev), { x, y } = lienzoB.posicion(ev);
      if (k < 0 || !pts.length) return tipB.ocultar();
      tipB.mostrar(x, y, info(pts[k]));
    });
    lienzoB.canvas.addEventListener('pointerleave', () => tipB.ocultar());
    lienzoB.canvas.addEventListener('click', (ev) => { const k = colB(ev); if (k >= 0 && pts.length) { w = k / N; rW.valor = w; dibujar(); } });
    lienzoA.alDibujar = dibujar;
    lienzoB.alDibujar = dibujar;
    calcular();
  }

  VIZ.registrarTema('resource-allocation', {
    intro: String.raw`
      <p>Casi toda organización tiene un recurso escaso (dinero, horas, espacio) y varias actividades que lo reclaman. <strong>Asignar
      recursos</strong> es repartirlo de modo que el resultado total sea el mejor posible, respetando mínimos que no se pueden incumplir
      (contratos, demanda comprometida) y topes que no se pueden superar (capacidad).</p>
      <p>La solución óptima suele tener una forma muy reconocible: se financia primero lo que más rinde por unidad hasta su tope, un solo
      canal recibe «lo que queda» y el resto se queda en su mínimo. Cuando hay dos objetivos que compiten, ya no existe un reparto
      perfecto: hay una <em>frontera de compromiso</em> y elegir un punto en ella es una decisión de valores, no de cálculo.</p>`,
    visualizaciones: [
      {
        titulo: 'Reparto óptimo de un presupuesto',
        descripcion: 'Cambie el criterio entre alcance, ventas o ambos y vea cómo se reordena el reparto. Baje el presupuesto hasta que solo alcancen los mínimos, o limite internet a una fracción del total y observe cuánto cuesta esa regla en la tabla.',
        montar: montarReparto,
      },
      {
        titulo: 'Compromiso entre alcance y ventas',
        descripcion: 'Cada punto de la curva es el mejor reparto para una ponderación distinta de los dos objetivos. Recorra la frontera: pasada cierta zona, ganar alcance cuesta cada vez más ventas. Cambie el presupuesto para ver cómo se desplaza.',
        montar: montarCompromiso,
      },
    ],
    teoria: String.raw`
      <h2>El modelo</h2>
      <p>Sea \(x_j\) el dinero asignado a la actividad \(j\), \(r_j\) su retorno por unidad de dinero y \(B\) el presupuesto:</p>
      \[ \max\ \sum_j r_j x_j \quad \text{s.a.}\quad \sum_j x_j \le B,\qquad \ell_j \le x_j \le u_j, \]
      <p>con mínimos \(\ell_j\) (compromisos) y topes \(u_j\) (capacidad de absorción). Una regla como «internet no puede pasar de la fracción
      \(s\) del total» es también lineal: \(x_{\text{net}} \le s\sum_j x_j\), es decir, \((1-s)x_{\text{net}} - s\sum_{j\ne\text{net}}x_j \le 0\).</p>
      <h2>Estructura de la solución</h2>
      <p>Sin la cuota, el problema es una <em>mochila fraccionaria</em> con cotas: se ordenan las actividades por \(r_j\) decreciente, se
      cubren primero todos los mínimos y se reparte el presupuesto restante en ese orden, llenando cada una hasta su tope. La última que no
      alcanza a llenarse es la <strong>actividad marginal</strong>. En el ejemplo de alcance, televisión llega a su tope de 50, internet recibe lo
      que sobra (35) y radio y prensa quedan en sus mínimos.</p>
      <div class="recuadro"><p><strong>Valor marginal del presupuesto.</strong> El precio sombra del presupuesto es el retorno de la actividad
      marginal: es lo que rendiría una unidad más de dinero. Si el presupuesto sobra (todas las actividades en su tope), ese precio es cero. Ver
      <a href="tema.html?id=shadow-prices">precios sombra</a> y <a href="tema.html?id=rhs-ranges">rangos de disponibilidad de recursos</a>.</p></div>
      <p>Las variables que quedan estrictamente entre su mínimo y su tope son las <em>básicas</em>; todas las demás están «pegadas» a una
      cota (ver <a href="tema.html?id=basic-feasible-solutions">soluciones básicas factibles</a>). Por eso, con una restricción global, a lo más
      una actividad queda en un valor intermedio.</p>
      <h2>Dos objetivos: la frontera de Pareto</h2>
      <p>Con alcance \(R(x)\) y ventas \(S(x)\), un reparto \(x\) es <strong>eficiente</strong> (óptimo de Pareto) si no existe otro que mejore uno
      sin empeorar el otro. Maximizar la suma ponderada normalizada
      \[ \max\ w\,\frac{R(x)}{R^*} + (1-w)\,\frac{S(x)}{S^*},\qquad 0 \le w \le 1, \]
      con \(R^*\) y \(S^*\) los máximos de cada objetivo por separado, recorre vértices de la frontera. Como el conjunto factible es un poliedro y los
      objetivos son lineales, la frontera es una poligonal cóncava: la pendiente entre dos vértices vecinos es la
      <em>tasa de intercambio</em> entre objetivos, que empeora hacia los extremos. El «punto ideal» \((R^*, S^*)\) no es alcanzable porque los
      dos óptimos individuales reparten el dinero de modos distintos.</p>
      <h2>Conexiones</h2>
      <ul>
        <li>Si los canales no son divisibles (se contrata o no un contrato entero), el modelo pasa a ser entero:
        <a href="tema.html?id=knapsack-problem">el problema de la mochila</a> y <a href="tema.html?id=investment-selection">selección de inversiones</a>.</li>
        <li>El modelo es gemelo del de <a href="tema.html?id=production-planning">planificación de producción</a>, con el presupuesto como único recurso.</li>
        <li>Cómo cambia el óptimo al mover \(B\) se estudia en <a href="tema.html?id=rhs-ranges">rangos de disponibilidad</a>.</li>
      </ul>`,
  });
})();
