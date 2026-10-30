(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };
  const RUIDO = 5; // forma de cruz para el ruido

  /* ---------- Fig. 1: DBSCAN paso a paso ---------- */

  function montarPasos(cuerpo) {
    let tipo = 'lunas', eps = 0.15, minPts = 5, semilla = 1, pts = [], est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Radio ε', min: 0.03, max: 0.4, paso: 0.01, valor: eps, formato: (v) => v.toFixed(2), alCambiar: (v) => { eps = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'MinPts', min: 1, max: 20, valor: minPts, alCambiar: (v) => { minPts = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los puntos núcleo (con al menos MinPts puntos a distancia ≤ ε, contándose a sí mismos) van rellenos; los de borde, huecos; el ruido, con una cruz. El círculo naranjo es la vecindad ε del punto que se está expandiendo.');
    function iniciar() {
      pts = M.datos2d(tipo, 170, semilla, { ruido: 0.05 });
      const R = M.dbscan(pts, eps, minPts);
      const nucleo = R.tipo.map((t) => t === 'nucleo');
      est = { et: new Array(pts.length).fill(-2), actual: -1, g: -1, msg: '', nucleo, vecinos: R.vecinos };
      return (function* () {
        for (let i = 0; i < pts.length; i++) {
          if (est.et[i] !== -2) continue;
          if (!nucleo[i]) { est.et[i] = -1; est.actual = i; est.msg = `Punto ${i}: solo ${est.vecinos[i].length} vecinos en ε; por ahora es ruido.`; yield; continue; }
          est.g++; est.et[i] = est.g; est.actual = i;
          est.msg = `Punto ${i} es núcleo y no tiene grupo: empieza el grupo ${est.g + 1}.`;
          yield;
          const cola = [i];
          for (let h = 0; h < cola.length; h++) {
            const u = cola[h];
            if (!nucleo[u]) continue;
            est.actual = u;
            let nuevos = 0;
            for (const v of est.vecinos[u]) if (est.et[v] < 0) { est.et[v] = est.g; nuevos++; if (nucleo[v]) cola.push(v); }
            est.msg = `Expandir desde el núcleo ${u}: ${nuevos} puntos nuevos entran al grupo ${est.g + 1}.`;
            if (nuevos) yield;
          }
        }
        est.actual = -1; est.msg = `Terminado: ${est.g + 1} grupos.`;
      })();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      if (est.actual >= 0) {
        const p = pts[est.actual], r = eps * (pl.sx(1) - pl.sx(0));
        ctx.fillStyle = VIZ.alfa(C.s2, 0.1); ctx.strokeStyle = C.s2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pl.sx(p.x), pl.sy(p.y), r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
      M.dispersion(ctx, pl, pts, {
        color: (p, i) => (est.et[i] === -2 ? C.inactivo : est.et[i] === -1 ? C.tinta : M.colorGrupo(est.et[i])),
        forma: (p, i) => (est.et[i] === -1 ? RUIDO : est.et[i] >= 0 ? est.et[i] % 5 : 0),
        hueco: (p, i) => est.et[i] >= 0 && !est.nucleo[i], r: 3.8,
        anillo: (p, i) => (i === est.actual ? C.s2 : null),
      });
      const K = est.g + 1;
      leyenda.set([...M.leyendaGrupos(Math.max(1, K)), { color: C.tinta, texto: 'ruido (cruz)', forma: 'cuadro' }, { color: C.inactivo, texto: 'sin visitar', forma: 'punto' }]);
      registro.textContent = est.msg || 'Pulse Un paso: se recorren los puntos en orden.';
      const asignados = est.et.filter((e) => e >= 0);
      lectura.set([
        ['grupos', String(K)],
        ['núcleo · borde', `${est.et.filter((e, i) => e >= 0 && est.nucleo[i]).length} · ${asignados.length - est.et.filter((e, i) => e >= 0 && est.nucleo[i]).length}`],
        ['ruido', String(est.et.filter((e) => e === -1).length)],
        ['puntos núcleo en total', String(est.nucleo.filter(Boolean).length)],
      ]);
    }
    lienzo.alDibujar = () => est && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      if (pl) pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return tip.ocultar();
      tip.mostrar(x, y, `punto <b>${m}</b><br>vecinos en ε: <b>${est.vecinos[m].length}</b><br>${est.nucleo[m] ? 'núcleo' : 'no núcleo'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: mapa de parámetros ---------- */

  const EPS = Array.from({ length: 14 }, (_, i) => 0.03 + i * 0.022);
  const MINPTS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

  function montarParametros(cuerpo) {
    let tipo = 'densidades', semilla = 1, pts = [], tabla = [], sel = [5, 3];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.55) : Math.min(420, Math.round(w * 0.45))) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda es una corrida de DBSCAN: el número es la cantidad de grupos y el color, el acuerdo (ARI) con los grupos reales. Haga clic en una celda para ver su resultado a la derecha. Con densidades distintas la zona buena es más angosta: un ε que respeta la mancha compacta deja como ruido el borde de la dispersa.');
    function calcular() {
      pts = M.datos2d(tipo, 180, semilla, { ruido: 0.04 });
      const verdad = pts.map((p) => p.g);
      tabla = EPS.map((e) => MINPTS.map((m) => { const R = M.dbscan(pts, e, m); return { R, ari: M.randAjustado(R.etiqueta, verdad), K: R.grupos, ruido: R.etiqueta.filter((x) => x < 0).length }; }));
      dibujar();
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.5 : H;
      const izq = 52, sup = 22, inf = 34, cw = (wA - izq - 8) / MINPTS.length, ch = (hA - sup - inf) / EPS.length;
      geo = { izq, sup, cw, ch };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      EPS.forEach((e, i) => {
        ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.fillText(e.toFixed(2), izq - 6, sup + i * ch + ch / 2);
        MINPTS.forEach((m, j) => {
          const c = tabla[i][j], x = izq + j * cw, y = sup + i * ch;
          ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.max(0, c.ari)));
          ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          if (sel[0] === i && sel[1] === j) { ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2); ctx.lineWidth = 1; }
          ctx.fillStyle = c.ari > 0.55 ? C.sobre : C.tinta; ctx.textAlign = 'center';
          if (cw > 16) ctx.fillText(String(c.K), x + cw / 2, y + ch / 2);
        });
      });
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      MINPTS.forEach((m, j) => ctx.fillText(String(m), izq + j * cw + cw / 2, sup + EPS.length * ch + 4));
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText('MinPts', izq + MINPTS.length * cw, sup + EPS.length * ch + 18);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('ε', 6, 4);
      // Resultado de la celda elegida.
      const c = tabla[sel[0]][sel[1]];
      ctx.save();
      const ox = vertical ? 0 : wA, oy = vertical ? hA : 0;
      ctx.translate(ox, oy);
      const pl = planoDatos({ ...lienzo, ancho: vertical ? W : W - wA, alto: vertical ? H - hA : H, ctx });
      pl.ejes();
      M.dispersion(ctx, pl, pts, { color: (p, i) => (c.R.etiqueta[i] < 0 ? C.tinta : M.colorGrupo(c.R.etiqueta[i])), forma: (p, i) => (c.R.etiqueta[i] < 0 ? RUIDO : c.R.etiqueta[i] % 5), hueco: (p, i) => c.R.tipo[i] === 'borde', r: 3.4 });
      ctx.restore();
      leyenda.set([{ color: VIZ.css(VIZ.enRampa(0.05)), texto: 'ARI ≈ 0' }, { color: VIZ.css(VIZ.enRampa(1)), texto: 'ARI = 1 (igual a los grupos reales)' }, ...M.leyendaGrupos(Math.min(4, Math.max(1, c.K))), { color: C.tinta, texto: 'ruido (cruz)', forma: 'cuadro' }]);
      let mejor = [0, 0];
      tabla.forEach((f, i) => f.forEach((x, j) => { if (x.ari > tabla[mejor[0]][mejor[1]].ari) mejor = [i, j]; }));
      lectura.set([
        ['celda elegida', `ε = ${EPS[sel[0]].toFixed(2)}, MinPts = ${MINPTS[sel[1]]}`],
        ['grupos · ruido', `${c.K} · ${c.ruido}`],
        ['ARI', VIZ.fmt(c.ari, 3)],
        ['mejor celda', `ε = ${EPS[mejor[0]].toFixed(2)}, MinPts = ${MINPTS[mejor[1]]} (ARI ${VIZ.fmt(tabla[mejor[0]][mejor[1]].ari, 2)})`],
      ]);
    }
    lienzo.alDibujar = () => tabla.length && dibujar();
    const celda = (x, y) => { const j = Math.floor((x - geo.izq) / geo.cw), i = Math.floor((y - geo.sup) / geo.ch); return i >= 0 && i < EPS.length && j >= 0 && j < MINPTS.length ? [i, j] : null; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), c = geo && celda(x, y); if (c) { sel = c; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = geo && celda(x, y);
      if (!c) return tip.ocultar();
      const t = tabla[c[0]][c[1]];
      tip.mostrar(x, y, `ε = <b>${EPS[c[0]].toFixed(2)}</b>, MinPts = <b>${MINPTS[c[1]]}</b><br>grupos <b>${t.K}</b>, ruido <b>${t.ruido}</b><br>ARI <b>${VIZ.fmt(t.ari, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('dbscan', {
    intro: String.raw`
      <p><strong>DBSCAN</strong> (<em>Density-Based Spatial Clustering of Applications with Noise</em>, Ester et al., 1996) define
      un grupo como una región densa de puntos separada de otras por zonas poco densas. No hay que decir cuántos grupos
      buscar, los grupos pueden tener cualquier forma y los puntos aislados quedan marcados como <strong>ruido</strong>.</p>
      <p>Todo depende de dos parámetros: el radio \(\varepsilon\) de la vecindad y el mínimo de puntos <em>MinPts</em> que debe
      haber en ella para que la zona cuente como densa.</p>`,
    visualizaciones: [
      {
        titulo: 'DBSCAN paso a paso',
        descripcion: 'Los puntos núcleo expanden su grupo a todo lo alcanzable por densidad. Con las lunas, el resultado separa bien las dos formas; achique ε y aparecerá más ruido.',
        montar: montarPasos,
      },
      {
        titulo: 'Mapa de parámetros',
        descripcion: 'El resultado para 140 combinaciones de ε y MinPts. Compare el tamaño de la zona buena en «Tres manchas» y en «Densidades distintas».',
        montar: montarParametros,
      },
    ],
    teoria: String.raw`
      <h2>Tipos de punto</h2>
      <p>Sea \(N_\varepsilon(p) = \{q : d(p, q) \le \varepsilon\}\) (incluye a \(p\)).</p>
      <ul>
        <li><strong>Núcleo</strong> (<em>core</em>): \(|N_\varepsilon(p)| \ge \text{MinPts}\).</li>
        <li><strong>Borde</strong> (<em>border</em>): no es núcleo, pero está en la vecindad de algún núcleo.</li>
        <li><strong>Ruido</strong> (<em>noise</em>): ninguno de los anteriores.</li>
      </ul>
      <p>\(q\) es <em>directamente alcanzable por densidad</em> desde \(p\) si \(p\) es núcleo y \(q \in N_\varepsilon(p)\); <em>alcanzable</em> si hay
      una cadena de alcanzables directos; dos puntos están <em>conectados por densidad</em> si ambos son alcanzables desde un mismo núcleo.
      Un grupo es un conjunto maximal de puntos conectados por densidad.</p>
      <h2>Algoritmo</h2>
      <pre><code>para cada punto p sin visitar:
    marcar p visitado
    si |N_ε(p)| &lt; MinPts: marcar p como ruido (provisional)
    si no:
        g ← nuevo grupo ;  cola ← N_ε(p)
        mientras cola no vacía:
            q ← sacar de cola
            si q es ruido o no tiene grupo: asignar q a g
            si q es núcleo y no visitado: agregar N_ε(q) a la cola</code></pre>
      <p>Con un índice espacial (<a href="tema.html?id=kd-tree">árbol k-d</a>, R-tree) cada consulta de vecindad cuesta \(O(\log n)\)
      en promedio y el total es \(O(n \log n)\); sin índice, \(O(n^2)\). Los grupos de los núcleos son deterministas; un punto de
      borde alcanzable desde dos grupos queda en el primero que lo encuentra.</p>
      <h2>Elegir los parámetros</h2>
      <ul>
        <li><strong>MinPts</strong>: regla práctica \(\text{MinPts} \ge d + 1\), y \(2d\) para datos con ruido.</li>
        <li><strong>ε</strong>: el codo del gráfico de <a href="tema.html?id=k-distance">k-distancias</a> con \(k = \text{MinPts} - 1\).</li>
      </ul>
      <div class="recuadro"><p>El defecto principal: un solo \(\varepsilon\) para todo el conjunto. Si los grupos tienen densidades muy
      distintas, un \(\varepsilon\) chico fragmenta los dispersos y uno grande fusiona los densos. OPTICS y
      <a href="tema.html?id=hdbscan">HDBSCAN</a> resuelven esto considerando todos los \(\varepsilon\) a la vez.</p></div>`,
  });
})();