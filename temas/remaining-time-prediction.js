(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const ARBOL = P.procesos.pedidos.arbol;
  const MODELOS = [
    ['global', 'media global', C.s1],
    ['actividad', 'media por actividad actual', C.s2],
    ['regresion', 'regresión lineal', C.s3],
  ];

  /* ---------- Prefijos, modelos y evaluación ---------- */

  // Un prefijo por cada k = 1 … n − 1 de cada caso, con su tiempo restante real.
  function prefijos(c) {
    const ev = c.eventos, fin = ev[ev.length - 1].fin;
    return ev.slice(0, -1).map((e, i) => ({ k: i + 1, n: ev.length, last: e.act, elapsed: e.fin - ev[0].ini, rem: fin - e.fin }));
  }

  // Resuelve (A + λI) w = b por eliminación gaussiana con pivoteo.
  function resolver(A, b, lambda) {
    const n = b.length, M = A.map((f, i) => [...f.map((v, j) => v + (i === j && i > 0 ? lambda : 0)), b[i]]);
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      [M[i], M[p]] = [M[p], M[i]];
      for (let r = 0; r < n; r++) {
        if (r === i || !M[i][i]) continue;
        const f = M[r][i] / M[i][i];
        for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
      }
    }
    return M.map((f, i) => (f[i] ? f[n] / f[i] : 0));
  }

  // Entrena los tres predictores con una lista de prefijos; cada uno devuelve { y, lo, hi } (intervalo 10–90 %).
  function entrenar(pf, acts) {
    const rem = pf.map((p) => p.rem);
    const global = { y: P.media(rem), lo: P.cuantil(rem, 0.1), hi: P.cuantil(rem, 0.9) };
    const porAct = new Map();
    for (const a of acts) {
      const r = pf.filter((p) => p.last === a).map((p) => p.rem);
      porAct.set(a, r.length ? { y: P.media(r), lo: P.cuantil(r, 0.1), hi: P.cuantil(r, 0.9) } : global);
    }
    const rasgos = (p) => [1, p.elapsed / 60, p.k, ...acts.slice(1).map((a) => (a === p.last ? 1 : 0))];
    const d = rasgos(pf[0]).length, A = Array.from({ length: d }, () => new Array(d).fill(0)), b = new Array(d).fill(0);
    for (const p of pf) {
      const x = rasgos(p);
      for (let i = 0; i < d; i++) { b[i] += x[i] * p.rem; for (let j = 0; j < d; j++) A[i][j] += x[i] * x[j]; }
    }
    const w = resolver(A, b, 1e-3);
    const lineal = (p) => rasgos(p).reduce((s, v, i) => s + v * w[i], 0);
    const res = pf.map((p) => p.rem - lineal(p));
    const rlo = P.cuantil(res, 0.1), rhi = P.cuantil(res, 0.9);
    return {
      global: () => global,
      actividad: (p) => porAct.get(p.last) || global,
      regresion: (p) => { const y = Math.max(0, lineal(p)); return { y, lo: Math.max(0, y + rlo), hi: Math.max(0, y + rhi) }; },
    };
  }

  const cache = new Map();
  function datos(espera) {
    if (!cache.has(espera)) cache.set(espera, { train: P.simular(ARBOL, 500, 21, { espera }), test: P.simular(ARBOL, 200, 22, { espera }) });
    return cache.get(espera);
  }
  const ACTS = P.actividades(P.simular(ARBOL, 200, 5)).sort();
  const minutos = (v) => `${VIZ.fmt(v, 3)} min`;

  /* ---------- Fig. 1: un caso, prefijo a prefijo ---------- */

  function montarCaso(cuerpo) {
    let modelo = 'actividad', k = 2, indice = 0, pf = [], tren = null, plano = null, hover = 0;
    const { train, test } = datos(12);
    tren = entrenar(train.flatMap(prefijos), ACTS);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo con intervalo', opciones: MODELOS.map(([v, t]) => [v, t]), valor: modelo, alCambiar: (v) => { modelo = v; dibujar(); } });
    const rK = ctl.rango({ etiqueta: 'Eventos ya vistos (prefijo)', min: 1, max: 5, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Otro caso', () => { indice++; elegir(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'tiempo restante real', forma: 'linea' },
      ...MODELOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })),
      { color: VIZ.alfa(C.s2, 0.25), texto: 'intervalo 10–90 % del modelo elegido', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto del eje horizontal es un prefijo del mismo caso: lo que el sistema sabría tras k eventos. Haga clic sobre el gráfico para fijar k; la banda es el intervalo 10–90 % del modelo elegido. Los modelos se entrenaron con 500 pedidos históricos.');

    function elegir() {
      pf = prefijos(test[(indice * 37 + 5) % test.length]);
      rK.max = pf.length;
      k = Math.min(k, pf.length);
      rK.valor = k;
      dibujar();
    }
    function dibujar() {
      if (!pf.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pred = (m) => pf.map((p) => tren[m](p));
      const ymax = Math.max(...pf.map((p) => p.rem), ...MODELOS.flatMap(([m]) => pred(m).map((q) => q.y)), ...pred(modelo).map((q) => q.hi)) * 1.08;
      plano = VIZ.plano(lienzo, { xmin: 0.6, xmax: pf.length + 0.4, ymin: 0, ymax }, { etiquetaX: 'eventos vistos k', etiquetaY: 'minutos restantes', ticksX: pf.map((p) => p.k), formatoY: (v) => VIZ.fmt(v, 3) });
      plano.ejes();
      const bandas = pred(modelo), col = MODELOS.find((m) => m[0] === modelo)[2];
      ctx.fillStyle = VIZ.alfa(col, 0.2);
      ctx.beginPath();
      bandas.forEach((q, i) => { const x = plano.sx(i + 1), y = plano.sy(q.hi); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      for (let i = bandas.length - 1; i >= 0; i--) ctx.lineTo(plano.sx(i + 1), plano.sy(bandas[i].lo));
      ctx.closePath(); ctx.fill();
      for (const [m, , c] of MODELOS) VIZ.trazar(ctx, plano, pred(m).map((q, i) => [i + 1, q.y]), c, m === modelo ? 2.5 : 1.5, m === modelo ? null : [5, 4]);
      VIZ.trazar(ctx, plano, pf.map((p) => [p.k, p.rem]), C.tinta, 2.5);
      pf.forEach((p) => VIZ.marcador(ctx, plano.sx(p.k), plano.sy(p.rem), C.tinta, p.k === k ? 6 : 3.5));
      pred(modelo).forEach((q, i) => VIZ.marcador(ctx, plano.sx(i + 1), plano.sy(q.y), col, i + 1 === k ? 6 : 3.5, 1));
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.sx(k), plano.y0); ctx.lineTo(plano.sx(k), plano.y1); ctx.stroke(); ctx.setLineDash([]);

      const p = pf[k - 1], q = tren[modelo](p);
      registro.textContent = `Tras ${k} de ${p.n} eventos (última actividad: «${p.last}», ${minutos(p.elapsed)} transcurridos) el modelo «${MODELOS.find((m) => m[0] === modelo)[1]}» predice ${minutos(q.y)}; faltaban en realidad ${minutos(p.rem)}.`;
      lectura.set([
        ['tiempo transcurrido', minutos(p.elapsed)], ['predicción', minutos(q.y)], ['real', minutos(p.rem)],
        ['error absoluto', minutos(Math.abs(q.y - p.rem))], ['intervalo 10–90 %', `${minutos(q.lo)} a ${minutos(q.hi)}`], ['¿lo contiene?', p.rem >= q.lo && p.rem <= q.hi ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const cercano = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      return plano && plano.dentro(x, y) ? Math.min(pf.length, Math.max(1, Math.round(plano.ix(x)))) : 0;
    };
    lienzo.canvas.addEventListener('click', (ev) => { const j = cercano(ev); if (j) { k = j; rK.valor = j; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const j = cercano(ev), { x, y } = lienzo.posicion(ev);
      if (!j) return tip.ocultar();
      const p = pf[j - 1];
      tip.mostrar(x, y, `k = <b>${j}</b> · última «${p.last}»` + VIZ.filaTooltip(C.tinta, 'real', minutos(p.rem))
        + MODELOS.map(([m, t, c]) => VIZ.filaTooltip(c, t, minutos(tren[m](p).y))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    elegir();
  }

  /* ---------- Fig. 2: error frente al avance del caso ---------- */

  function montarError(cuerpo) {
    let espera = 12, nEnt = 300, metrica = 'mae', activos = { global: true, actividad: true, regresion: true }, plano = null, curvas = {}, resumen = {};
    const BINES = 10;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Métrica', opciones: [['mae', 'error absoluto medio (min)'], ['cob', 'cobertura del intervalo 10–90 %']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Casos de entrenamiento', min: 10, max: 500, paso: 10, valor: nEnt, alCambiar: (v) => { nEnt = v; calcular(); } });
    ctl.rango({ etiqueta: 'Espera media entre actividades', min: 0, max: 40, valor: espera, formato: (v) => `${v} min`, alCambiar: (v) => { espera = v; calcular(); } });
    ctl.casillas(MODELOS.map(([m, t, c]) => ({ clave: m, texto: t, color: c, activo: true })), (e) => { activos = e; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, MODELOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se evalúa sobre 200 pedidos que no se usaron para entrenar. El eje horizontal es el avance del caso, k/n: al principio el tiempo restante es largo e incierto; al final, corto. Con más espera entre actividades (más variabilidad) los errores absolutos tienden a crecer en todos los modelos.');

    function calcular() {
      const { train, test } = datos(espera);
      const modelos = entrenar(train.slice(0, nEnt).flatMap(prefijos), ACTS);
      const acc = Object.fromEntries(MODELOS.map(([m]) => [m, Array.from({ length: BINES }, () => ({ e: 0, c: 0, n: 0 }))]));
      for (const c of test) for (const p of prefijos(c)) {
        const b = Math.min(BINES - 1, Math.floor((p.k / p.n) * BINES));
        for (const [m] of MODELOS) {
          const q = modelos[m](p), s = acc[m][b];
          s.e += Math.abs(q.y - p.rem); s.c += p.rem >= q.lo && p.rem <= q.hi ? 1 : 0; s.n++;
        }
      }
      curvas = {}; resumen = {};
      for (const [m] of MODELOS) {
        curvas[m] = acc[m].map((s, i) => ({ x: (i + 0.5) / BINES, mae: s.n ? s.e / s.n : NaN, cob: s.n ? s.c / s.n : NaN, n: s.n }));
        const tot = acc[m].reduce((t, s) => ({ e: t.e + s.e, c: t.c + s.c, n: t.n + s.n }), { e: 0, c: 0, n: 0 });
        resumen[m] = { mae: tot.e / tot.n, cob: tot.c / tot.n };
      }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = metrica === 'mae' ? Math.max(...MODELOS.flatMap(([m]) => curvas[m].map((q) => q.mae).filter(Number.isFinite))) * 1.1 : 1.05;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax }, { etiquetaX: 'avance del caso k / n', etiquetaY: metrica === 'mae' ? 'error absoluto medio (min)' : 'cobertura', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => VIZ.fmt(v, 3) });
      plano.ejes();
      if (metrica === 'cob') {
        ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(0.8)); ctx.lineTo(plano.x1, plano.sy(0.8)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('nominal 80 %', plano.x1 - 4, plano.sy(0.8) - 2);
      }
      for (const [m, , c] of MODELOS) if (activos[m]) {
        VIZ.trazar(ctx, plano, curvas[m].map((q) => [q.x, q[metrica]]), c, 2);
        curvas[m].forEach((q) => Number.isFinite(q[metrica]) && VIZ.marcador(ctx, plano.sx(q.x), plano.sy(q[metrica]), c, 3.5));
      }
      const mejor = MODELOS.filter(([m]) => activos[m]).sort((a, b) => resumen[a[0]].mae - resumen[b[0]].mae)[0];
      registro.textContent = mejor
        ? `Con ${nEnt} casos de entrenamiento y espera media de ${espera} min, el menor error global es el de «${mejor[1]}» (${minutos(resumen[mejor[0]].mae)}).`
        : 'Active al menos un modelo.';
      lectura.set(MODELOS.flatMap(([m, t]) => [[`${t}: error medio`, minutos(resumen[m].mae)], [`${t}: cobertura`, `${Math.round(resumen[m].cob * 100)} %`]]));
    }
    lienzo.alDibujar = () => curvas.global && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const i = Math.min(BINES - 1, Math.max(0, Math.floor(plano.ix(x) * BINES)));
      tip.mostrar(x, y, `avance <b>${i * 10}–${i * 10 + 10} %</b> · ${curvas.global[i].n} prefijos`
        + MODELOS.filter(([m]) => activos[m]).map(([m, t, c]) => VIZ.filaTooltip(c, t, metrica === 'mae' ? minutos(curvas[m][i].mae) : `${Math.round(curvas[m][i].cob * 100)} %`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('remaining-time-prediction', {
    intro: String.raw`
      <p>Un cliente pregunta «¿cuándo llegará mi pedido?». Con el registro histórico se puede responder sin conocer el modelo del proceso: de cada caso en curso solo
      se tiene un <strong>prefijo</strong> (las actividades ya ocurridas y sus tiempos), y se busca estimar cuánto falta para que termine, el <em>tiempo restante</em>.</p>
      <p>La idea es convertir cada prefijo histórico en una fila de datos (qué actividad fue la última, cuánto tiempo pasó, cuántos eventos van) con su tiempo restante
      conocido, y ajustar un regresor. Lo interesante es cómo mejora la predicción a medida que el caso avanza y cuánta incertidumbre queda, que se expresa con un intervalo.</p>`,
    visualizaciones: [
      {
        titulo: 'Un caso visto prefijo a prefijo',
        descripcion: 'Compare los tres predictores contra el tiempo restante real, evento a evento. Cambie de modelo (la banda es su intervalo 10–90 %) y haga clic en distintos k: las predicciones se ajustan a medida que el caso avanza.',
        montar: montarCaso,
      },
      {
        titulo: 'Error frente al avance del caso',
        descripcion: 'Los modelos que usan el prefijo ven caer su error al avanzar el caso; la media global no, porque ignora el avance. Reduzca los casos de entrenamiento o suba la espera entre actividades y vea qué modelo se degrada más; cambie a cobertura para ver si el intervalo cumple su 80 % nominal.',
        montar: montarError,
      },
    ],
    teoria: String.raw`
      <h2>Planteamiento</h2>
      <p>Para un caso con eventos \(e_1,\dots,e_n\) y el instante de fin \(t_n\), cada prefijo \(\sigma_k=\langle e_1,\dots,e_k\rangle\) con \(1\le k<n\) define un ejemplo
      \((x_k, y_k)\) con objetivo</p>
      \[ y_k = t_n - t_k \quad(\text{tiempo restante}). \]
      <p>Los rasgos \(x_k\) resumen el prefijo: la <em>última actividad</em> \(a_k\) (codificada en indicadores 0/1), el <em>tiempo transcurrido</em> \(t_k-t_1\) y la <em>longitud</em> \(k\).
      Se genera un ejemplo por cada prefijo de cada caso histórico, de modo que un caso de \(n\) eventos aporta \(n-1\) filas.</p>
      <h2>Tres predictores</h2>
      <ul>
        <li><strong>Media global</strong>: \(\hat y=\overline{y}\). Ignora el prefijo; es la línea base.</li>
        <li><strong>Media por actividad</strong>: \(\hat y(a)=\overline{\{y_k : a_k=a\}}\). Es un modelo de estados donde el estado es la última actividad.</li>
        <li><strong>Regresión lineal</strong> (con regularización ridge): \(\hat y = w^\top x\), con \(w=(X^\top X+\lambda I)^{-1}X^\top y\).</li>
      </ul>
      <p>El error se mide con el error absoluto medio \(\text{MAE}=\frac1N\sum_i|\hat y_i-y_i|\). Como \(y_k\to 0\) al acercarse el final, el MAE decrece con el avance del caso; un
      buen predictor decrece <em>más rápido</em> que la línea base.</p>
      <h2>Intervalos de predicción</h2>
      <p>Una cifra sola oculta la incertidumbre. Un intervalo empírico del \(80\,\%\) toma los cuantiles 10 y 90 de lo observado: para las medias, de los \(y\) del mismo grupo; para la regresión, de los residuos
      \(r_i=y_i-\hat y_i\), con \([\hat y+q_{0.1}(r),\ \hat y+q_{0.9}(r)]\). Su <em>cobertura</em> es la fracción de casos de prueba cuyo \(y\) cae dentro, y debería rondar \(0.8\) si el modelo está calibrado.
      La regresión usa una banda de ancho constante, por lo que suele quedar corta al principio y larga al final: el error no tiene la misma varianza en todos los prefijos (heterocedasticidad).</p>
      <pre><code>entrenamiento:
    para cada caso histórico y cada k de 1 a n − 1:
        agregar fila (rasgos(prefijo k), t_n − t_k)
    ajustar regresor; guardar cuantiles de los residuos
predicción en línea (evento k de un caso abierto):
    devolver f(rasgos(prefijo k)) y su intervalo</code></pre>
      <div class="recuadro">Dos advertencias de evaluación: se debe <em>separar casos</em> (nunca prefijos del mismo caso en entrenamiento y prueba), y se debe reportar el error por avance del caso,
      porque un promedio global mezcla prefijos fáciles (cerca del final) con difíciles.</div>
      <h2>Conexiones</h2>
      <p>Los tiempos que alimentan el modelo se estudian en <a href="tema.html?id=cycle-time-throughput">Cycle Time and Throughput</a> y
      <a href="tema.html?id=duration-distributions">Duration Distributions</a>. El mismo esquema de prefijos sirve para predecir
      <a href="tema.html?id=next-activity-prediction">la próxima actividad</a>. El conjunto de las tres funciones online está en <a href="tema.html?id=operational-support">Operational Support</a>.</p>`,
  });
})();
