(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  // Una mancha densa, una dispersa, un atípico local junto a la densa y uno global.
  function datos(semilla) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd), pts = [];
    for (let i = 0; i < 60; i++) pts.push({ x: -0.45 + N() * 0.06, y: 0.35 + N() * 0.06, g: 0 });
    for (let i = 0; i < 70; i++) pts.push({ x: 0.4 + N() * 0.22, y: -0.3 + N() * 0.22, g: 1 });
    pts.push({ x: -0.45 + 0.26, y: 0.35 - 0.05, g: -1 }, { x: -0.45 - 0.05, y: 0.35 - 0.24, g: -1 }, { x: 0.95, y: 0.85, g: -1 }, { x: -0.9, y: -0.8, g: -1 });
    return pts;
  }
  // LOF completo: k-dist, vecinos, lrd y lof de cada punto.
  function lof(pts, k) {
    const n = pts.length, D = pts.map((p) => pts.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
    const vec = D.map((f, i) => f.map((d, j) => [j, d]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, k).map(([j]) => j));
    const kd = vec.map((v, i) => D[i][v[k - 1]]);
    const reach = (p, o) => Math.max(kd[o], D[p][o]);
    const lrd = vec.map((v, p) => 1 / (M.media(v.map((o) => reach(p, o))) || 1e-12));
    const f = vec.map((v, p) => M.media(v.map((o) => lrd[o])) / lrd[p]);
    return { D, vec, kd, reach, lrd, lof: f, n };
  }
  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.1 * a, xmax: 1.1 * a, ymin: -1.1, ymax: 1.1 } }); };
  const cerca = (pl, pts, x, y) => { let m = -1, dm = 10; pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } }); return m; };

  /* ---------- Fig. 1: LOF de un punto, paso a paso ---------- */

  function montarPasos(cuerpo) {
    let k = 6, semilla = 1, pts = datos(semilla), L = null, p = 130, etapa = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'k (MinPts)', min: 2, max: 20, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; pts = datos(semilla); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'punto p', forma: 'punto' },
      { color: C.s1, texto: 'vecinos o ∈ N_k(p)', forma: 'punto' },
      { color: C.s3, texto: 'círculo k-dist(o) de cada vecino', forma: 'linea' },
      { color: C.s4, texto: 'distancia de alcanzabilidad', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un punto para calcular su LOF. Pruebe el punto suelto junto a la mancha compacta (atípico local) y uno del borde de la mancha dispersa.');
    function iniciar() {
      L = lof(pts, k); etapa = 0;
      return (function* () { for (etapa = 1; etapa <= 4; etapa++) yield; etapa = 4; })();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      const esc = pl.sx(1) - pl.sx(0), P = pts[p], V = L.vec[p];
      ctx.save(); pl.recortar();
      if (etapa >= 2) for (const o of V) {
        ctx.strokeStyle = VIZ.alfa(C.s3, 0.8); ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(pl.sx(pts[o].x), pl.sy(pts[o].y), L.kd[o] * esc, 0, 2 * Math.PI); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (etapa >= 1) for (const o of V) {
        const r = etapa >= 2 ? L.reach(p, o) : L.D[p][o];
        // Segmento de largo «r» desde p en dirección a o.
        const dx = pts[o].x - P.x, dy = pts[o].y - P.y, d = Math.hypot(dx, dy) || 1;
        VIZ.trazar(ctx, pl, [[P.x, P.y], [P.x + (dx / d) * r, P.y + (dy / d) * r]], etapa >= 2 ? C.s4 : C.s1, etapa >= 2 ? 2.5 : 1.5);
      }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: (q, i) => (i === p ? C.s2 : etapa >= 1 && V.includes(i) ? C.s1 : C.inactivo), r: (q, i) => (i === p ? 6 : 3.5) });
      if (etapa >= 4) {
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        for (const o of V) ctx.fillText(VIZ.fmt(L.lrd[o], 2), pl.sx(pts[o].x) + 5, pl.sy(pts[o].y) - 3);
      }
      const rd = V.map((o) => L.reach(p, o));
      const textos = [
        'Elija un punto y pulse Un paso.',
        `N_k(p): los ${k} vecinos más cercanos de p; el más lejano está a k-dist(p) = ${VIZ.fmt(L.kd[p], 3)}.`,
        `reach-dist(p, o) = max(k-dist(o), d(p, o)): si p cae dentro del círculo de o, cuenta como si estuviera en su borde. Promedio ${VIZ.fmt(M.media(rd), 3)}.`,
        `lrd(p) = 1 / promedio de reach-dist = ${VIZ.fmt(L.lrd[p], 3)}: densidad de alcanzabilidad local de p.`,
        `LOF(p) = promedio de lrd(o) / lrd(p) = ${VIZ.fmt(M.media(V.map((o) => L.lrd[o])), 3)} / ${VIZ.fmt(L.lrd[p], 3)} = ${VIZ.fmt(L.lof[p], 3)}. ${L.lof[p] > 1.5 ? 'Bastante mayor que 1: p es menos denso que sus vecinos.' : 'Cerca de 1: p es tan denso como sus vecinos.'}`,
      ];
      registro.textContent = textos[Math.min(etapa, 4)];
      lectura.set([
        ['k-dist(p)', VIZ.fmt(L.kd[p], 3)],
        ['lrd(p)', etapa >= 3 ? VIZ.fmt(L.lrd[p], 3) : '—'],
        ['lrd medio de los vecinos', etapa >= 4 ? VIZ.fmt(M.media(V.map((o) => L.lrd[o])), 3) : '—'],
        ['LOF(p)', etapa >= 4 ? VIZ.fmt(L.lof[p], 3) : '—'],
      ]);
    }
    lienzo.alDibujar = () => L && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), i = pl ? cerca(pl, pts, x, y) : -1; if (i >= 0) { p = i; rep.reiniciar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = pl ? cerca(pl, pts, x, y) : -1;
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `k-dist <b>${VIZ.fmt(L.kd[i], 3)}</b><br>lrd <b>${VIZ.fmt(L.lrd[i], 3)}</b><br>LOF <b>${VIZ.fmt(L.lof[i], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: LOF frente a la distancia al k-ésimo vecino ---------- */

  function montarComparar(cuerpo) {
    let k = 8, m = 4, semilla = 1, pts = datos(semilla), L = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'k', min: 2, max: 30, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Marcar los m más anómalos', min: 1, max: 15, valor: m, alCambiar: (v) => { m = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; pts = datos(semilla); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.5) : Math.min(380, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.1)), texto: 'puntaje bajo', forma: 'punto' },
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'puntaje alto (tamaño ∝ puntaje)', forma: 'punto' },
      { color: C.s8, texto: 'los m con mayor puntaje', forma: 'linea' },
      { color: C.s6, texto: 'atípico plantado', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los dos atípicos junto a la mancha compacta están más cerca de ella que muchos puntos normales de la mancha dispersa: la k-distancia los confunde con el borde de esa mancha; LOF los compara con su entorno y los encuentra con más frecuencia. Pase el cursor para ver los puntajes.');
    function calcular() { L = lof(pts, k); dibujar(); }
    let paneles = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, w = vertical ? W : W / 2, h = vertical ? H / 2 : H;
      const plantados = new Set(pts.map((p, i) => (p.g < 0 ? i : -1)).filter((i) => i >= 0));
      paneles = [['LOF', L.lof], ['k-distancia', L.kd]].map(([nombre, s], j) => {
        ctx.save();
        const dx = vertical ? 0 : j * w, dy = vertical ? j * h : 0;
        ctx.translate(dx, dy);
        const pl = planoDatos({ ...lienzo, ancho: w, alto: h, ctx });
        pl.ejes();
        const orden = s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), top = new Set(orden.slice(0, m).map(([, i]) => i));
        const lo = Math.min(...s), hi = M.cuantil(s, 0.99);
        const t = (v) => Math.min(1, (v - lo) / (hi - lo || 1));
        M.dispersion(ctx, pl, pts, { color: (p, i) => VIZ.css(VIZ.enRampa(0.08 + 0.92 * t(s[i]))), r: (p, i) => 2.5 + 5 * t(s[i]),
          anillo: (p, i) => (top.has(i) ? C.s8 : plantados.has(i) ? C.s6 : null) });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(nombre, pl.x1 - 4, pl.y1 + 4);
        ctx.restore();
        return { dx, dy, pl, s, nombre, aciertos: [...top].filter((i) => plantados.has(i)).length };
      });
      lectura.set(paneles.map((p) => [`${p.nombre}: plantados entre los ${m}`, `${p.aciertos} de ${plantados.size}`]));
    }
    lienzo.alDibujar = () => L && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      for (const pn of paneles) {
        const i = cerca(pn.pl, pts, x - pn.dx, y - pn.dy);
        if (i >= 0) return tip.mostrar(x, y, `LOF <b>${VIZ.fmt(L.lof[i], 3)}</b><br>k-distancia <b>${VIZ.fmt(L.kd[i], 3)}</b>`);
      }
      tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('local-outlier-factor', {
    intro: String.raw`
      <p>Un punto es atípico no por estar lejos en términos absolutos, sino por estar <strong>más aislado que sus vecinos</strong>.
      Un punto a 0,2 de una mancha muy compacta es sospechoso; a 0,2 de una mancha dispersa, es normal.</p>
      <p>El <strong>Local Outlier Factor</strong> (Breunig et al., 2000) formaliza esa idea: estima una densidad local para cada
      punto y la compara con la de sus vecinos. Un LOF cercano a 1 significa «tan denso como su entorno»; mucho mayor que 1, «atípico local».</p>`,
    visualizaciones: [
      {
        titulo: 'LOF de un punto, paso a paso',
        descripcion: 'Vecinos, distancias de alcanzabilidad, densidad local y el cociente final para el punto elegido.',
        montar: montarPasos,
      },
      {
        titulo: 'LOF frente a la distancia al k-ésimo vecino',
        descripcion: 'Dos puntajes de anomalía sobre los mismos datos, con densidades muy distintas. Compare cuáles quedan entre los m más anómalos.',
        montar: montarComparar,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Con \(N_k(p)\) los \(k\) vecinos de \(p\) y \(\operatorname{k-dist}(o)\) la <a href="tema.html?id=k-distance">k-distancia</a> de \(o\):</p>
      \[ \operatorname{reach-dist}_k(p, o) = \max\{\operatorname{k-dist}(o),\; d(p, o)\} \]
      \[ \operatorname{lrd}_k(p) = \left( \frac{1}{|N_k(p)|} \sum_{o \in N_k(p)} \operatorname{reach-dist}_k(p, o) \right)^{-1} \]
      \[ \operatorname{LOF}_k(p) = \frac{1}{|N_k(p)|} \sum_{o \in N_k(p)} \frac{\operatorname{lrd}_k(o)}{\operatorname{lrd}_k(p)}. \]
      <p>La distancia de alcanzabilidad suaviza las fluctuaciones: dos puntos muy juntos dentro de un grupo no producen una
      densidad desmesurada, porque la distancia se «redondea hacia arriba» a la k-distancia del vecino.</p>
      <h2>Propiedades</h2>
      <ul>
        <li>Dentro de un grupo de densidad uniforme, \(\operatorname{LOF} \approx 1\).</li>
        <li>Es un cociente de densidades: no depende de la escala global, por eso detecta atípicos locales junto a grupos densos.</li>
        <li>No hay un umbral universal: según los datos, LOF = 1,5 puede ser muy anómalo o normal. Se suele ordenar y revisar los mayores.</li>
      </ul>
      <h2>Algoritmo y costo</h2>
      <pre><code>para cada p: N_k(p), k-dist(p)            ← O(n log n) con índice, O(n²) sin él
para cada p: lrd(p)                         ← O(nk)
para cada p: LOF(p)                         ← O(nk)</code></pre>
      <p>El resultado depende de \(k\) (llamado <em>MinPts</em> en el artículo original): con \(k\) chico, LOF es ruidoso; con \(k\) mayor
      que el tamaño de un grupo pequeño, todo el grupo puede aparecer como atípico. Los autores recomiendan tomar el máximo
      de LOF sobre un rango de valores de \(k\), por ejemplo de 10 a 50.</p>
      <h2>Relación con otros métodos</h2>
      <p>La \(\operatorname{lrd}\) es la inversa de una distancia media de alcanzabilidad, la misma idea que usan
      <a href="tema.html?id=dbscan">DBSCAN</a> y OPTICS. Un enfoque distinto, que no usa distancias, es
      <a href="tema.html?id=isolation-forest">Isolation Forest</a>.</p>`,
  });
})();