(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const M = VIZ.ml;

  /* ---------- Regresión polinomial con base de Legendre en [−1, 1] ---------- */

  const real = (x) => 0.8 * Math.sin(2.6 * x) + 0.3 * x;
  function muestra(n, sigma, rnd) {
    return Array.from({ length: n }, () => { const x = rnd() * 2 - 1; return { x, y: real(x) + VIZ.normal(rnd) * sigma }; });
  }
  function base(x, d) {
    const p = [1, x];
    for (let k = 1; k < d; k++) p.push(((2 * k + 1) * x * p[k] - k * p[k - 1]) / (k + 1));
    return p.slice(0, d + 1);
  }
  // Mínimos cuadrados con una regularización mínima para estabilidad numérica.
  function ajustar(pts, d) {
    const A = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0)), b = new Array(d + 1).fill(0);
    for (const p of pts) {
      const f = base(p.x, d);
      for (let i = 0; i <= d; i++) { b[i] += f[i] * p.y; for (let j = 0; j <= d; j++) A[i][j] += f[i] * f[j]; }
    }
    for (let i = 0; i <= d; i++) A[i][i] += 1e-6;
    const c = M.resolver(A, b);
    return (x) => base(x, d).reduce((s, v, i) => s + v * c[i], 0);
  }
  const ecm = (pts, f) => pts.reduce((s, p) => s + (f(p.x) - p.y) ** 2, 0) / pts.length;
  const GRADOS = Array.from({ length: 16 }, (_, i) => i);
  const YDOM = { ymin: -1.8, ymax: 1.8 };

  function curva(ctx, plano, f, color, ancho, guiones) {
    const pts = [];
    for (let i = 0; i <= 200; i++) { const x = -1 + i / 100; pts.push([x, Math.max(-3, Math.min(3, f(x)))]); }
    ctx.save();
    plano.recortar();
    VIZ.trazar(ctx, plano, pts, color, ancho, guiones);
    ctx.restore();
  }

  /* ---------- Fig. 1: subajuste y sobreajuste ---------- */

  function montarAjuste(cuerpo) {
    let grado = 3, n = 15, sigma = 0.25, semilla = 1, tr = [], va = [], errores = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Grado del polinomio', min: 0, max: 15, valor: grado, alCambiar: (v) => { grado = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ejemplos de entrenamiento', min: 8, max: 80, valor: n, alCambiar: (v) => { n = v; datos(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0.05, max: 0.6, paso: 0.05, valor: sigma, formato: (v) => v.toFixed(2), alCambiar: (v) => { sigma = v; datos(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, 'Datos y polinomio ajustado');
    const l1 = VIZ.lienzo(a, { proporcion: 0.8, altoMin: 240, altoMax: 340 });
    VIZ.subtitulo(b, 'Error según el grado');
    const l2 = VIZ.lienzo(b, { proporcion: 0.8, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'entrenamiento', forma: 'punto' },
      { color: C.s2, texto: 'validación', forma: 'punto' },
      { color: C.tinta, texto: 'polinomio ajustado', forma: 'linea' },
      { color: C.apagado, texto: 'función real', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El error de la derecha está en escala logarítmica. Pase el cursor sobre él para ver los valores de cada grado.');

    function datos() {
      const rnd = VIZ.semilla(semilla * 97 + n);
      tr = muestra(n, sigma, rnd);
      va = muestra(60, sigma, rnd);
      errores = GRADOS.map((d) => { const f = ajustar(tr, d); return [ecm(tr, f), ecm(va, f)]; });
      dibujar();
    }
    let p2 = null, hover = null;
    function dibujar() {
      if (!tr.length) return;
      const f = ajustar(tr, grado);
      // Datos y ajuste
      let ctx = l1.ctx;
      l1.limpiar();
      const p1 = VIZ.plano(l1, { xmin: -1.05, xmax: 1.05, ...YDOM }, { etiquetaX: 'x', etiquetaY: 'y', margen: { izq: 40 } });
      p1.ejes();
      curva(ctx, p1, real, C.apagado, 1.5, [3, 4]);
      curva(ctx, p1, f, C.tinta, 2);
      for (const p of va) VIZ.marcador(ctx, p1.sx(p.x), p1.sy(p.y), VIZ.alfa(C.s2, 0.6), 3, 0);
      for (const p of tr) VIZ.marcador(ctx, p1.sx(p.x), p1.sy(p.y), C.s1, 4, 0);
      // Error según el grado
      ctx = l2.ctx;
      l2.limpiar();
      const ymax = Math.max(2, ...errores.map((e) => e[1])) * 1.5, ymin = Math.max(1e-4, Math.min(...errores.map((e) => e[0])) * 0.6);
      p2 = VIZ.plano(l2, { xmin: 0, xmax: 15, ymin, ymax: Math.min(ymax, 1e3) }, { logY: true, etiquetaX: 'grado', etiquetaY: 'ECM', margen: { izq: 46 } });
      p2.ejes();
      ctx.save();
      p2.recortar();
      VIZ.trazar(ctx, p2, errores.map((e, d) => [d, e[0]]), C.s1, 2);
      VIZ.trazar(ctx, p2, errores.map((e, d) => [d, Math.min(e[1], 1e3)]), C.s2, 2);
      VIZ.trazar(ctx, p2, [[0, sigma * sigma], [15, sigma * sigma]], C.apagado, 1, [3, 4]);
      ctx.restore();
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'right';
      ctx.fillText('σ² (ruido)', p2.x1 - 2, p2.sy(sigma * sigma) - 4);
      const g = hover ?? grado;
      VIZ.marcador(ctx, p2.sx(g), p2.sy(errores[g][0]), C.s1, 5);
      VIZ.marcador(ctx, p2.sx(g), p2.sy(Math.min(errores[g][1], 1e3)), C.s2, 5);
      const [et, ev] = errores[grado];
      const mejor = errores.reduce((m, e, d) => (e[1] < errores[m][1] ? d : m), 0);
      const diag = grado < mejor - 1 && ev > 1.3 * errores[mejor][1] ? 'subajuste: el modelo es demasiado simple y falla incluso en entrenamiento'
        : grado > mejor + 1 && ev > 1.3 * errores[mejor][1] ? 'sobreajuste: el error de entrenamiento baja pero el de validación sube' : 'buen equilibrio';
      registro.textContent = `Grado ${grado}: ${diag}. El menor error de validación se obtiene con grado ${mejor}.`;
      lectura.set([
        ['ECM entrenamiento', VIZ.fmt(et, 3)],
        ['ECM validación', VIZ.fmt(ev, 3)],
        ['parámetros', String(grado + 1)],
        ['mejor grado (validación)', String(mejor)],
      ]);
    }
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!p2 || !p2.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(15, Math.round(p2.ix(x))));
      dibujar();
      tip.mostrar(x, y, `grado <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'entrenamiento', VIZ.fmt(errores[hover][0], 3)) + VIZ.filaTooltip(C.s2, 'validación', VIZ.fmt(errores[hover][1], 3)));
    });
    l2.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    datos();
  }

  /* ---------- Fig. 2: sesgo y varianza ---------- */

  function montarSesgoVarianza(cuerpo) {
    let grado = 3, n = 20, sigma = 0.3, semilla = 1, ajustes = [], curvas = [];
    const R = 40, XS = Array.from({ length: 41 }, (_, i) => -0.95 + (i * 1.9) / 40);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Grado del polinomio', min: 0, max: 12, valor: grado, alCambiar: (v) => { grado = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ejemplos por conjunto', min: 10, max: 80, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0.05, max: 0.6, paso: 0.05, valor: sigma, formato: (v) => v.toFixed(2), alCambiar: (v) => { sigma = v; calcular(); } });
    ctl.boton('Nuevos conjuntos', () => { semilla++; calcular(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, `${R} ajustes, cada uno con un conjunto de datos distinto`);
    const l1 = VIZ.lienzo(a, { proporcion: 0.8, altoMin: 240, altoMax: 340 });
    VIZ.subtitulo(b, 'Descomposición del error');
    const l2 = VIZ.lienzo(b, { proporcion: 0.8, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.5), texto: 'ajuste de un conjunto', forma: 'linea' },
      { color: C.s2, texto: 'ajuste promedio', forma: 'linea' },
      { color: C.apagado, texto: 'función real · σ²', forma: 'linea' },
      { color: C.s3, texto: 'sesgo²', forma: 'linea' },
      { color: C.s4, texto: 'varianza', forma: 'linea' },
      { color: C.s5, texto: 'error esperado', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El sesgo es la distancia entre el ajuste promedio y la función real; la varianza, cuánto se dispersan los ajustes alrededor de su promedio. Pase el cursor sobre la derecha para ver los valores.');

    // Para cada grado: sesgo² y varianza promediados sobre XS.
    function calcular() {
      const rnd = VIZ.semilla(semilla * 13 + n);
      const conjuntos = Array.from({ length: R }, () => muestra(n, sigma, rnd));
      ajustes = [];
      curvas = Array.from({ length: 13 }, (_, d) => {
        const fs = conjuntos.map((s) => ajustar(s, d));
        ajustes[d] = fs;
        let sesgo = 0, varianza = 0;
        for (const x of XS) {
          const v = fs.map((f) => f(x)), m = v.reduce((s, z) => s + z, 0) / R;
          sesgo += (m - real(x)) ** 2;
          varianza += v.reduce((s, z) => s + (z - m) ** 2, 0) / R;
        }
        return { sesgo: sesgo / XS.length, varianza: varianza / XS.length };
      });
      dibujar();
    }
    let p2 = null, hover = null;
    function dibujar() {
      if (!curvas.length) return;
      let ctx = l1.ctx;
      l1.limpiar();
      const p1 = VIZ.plano(l1, { xmin: -1.05, xmax: 1.05, ...YDOM }, { etiquetaX: 'x', etiquetaY: 'y', margen: { izq: 40 } });
      p1.ejes();
      for (const f of ajustes[grado]) curva(ctx, p1, f, VIZ.alfa(C.s1, 0.28), 1);
      curva(ctx, p1, real, C.apagado, 2, [3, 4]);
      curva(ctx, p1, (x) => ajustes[grado].reduce((s, f) => s + f(x), 0) / R, C.s2, 2.5);

      ctx = l2.ctx;
      l2.limpiar();
      const total = curvas.map((c) => c.sesgo + c.varianza + sigma * sigma);
      p2 = VIZ.plano(l2, { xmin: 0, xmax: 12, ymin: 1e-3, ymax: Math.max(1, ...total) * 1.5 }, { logY: true, etiquetaX: 'grado', etiquetaY: 'error', margen: { izq: 46 } });
      p2.ejes();
      ctx.save();
      p2.recortar();
      VIZ.trazar(ctx, p2, curvas.map((c, d) => [d, Math.max(1e-3, c.sesgo)]), C.s3, 2);
      VIZ.trazar(ctx, p2, curvas.map((c, d) => [d, Math.max(1e-3, c.varianza)]), C.s4, 2);
      VIZ.trazar(ctx, p2, total.map((t, d) => [d, t]), C.s5, 2);
      VIZ.trazar(ctx, p2, [[0, sigma * sigma], [12, sigma * sigma]], C.apagado, 1, [3, 4]);
      ctx.restore();
      const g = hover ?? grado;
      VIZ.marcador(ctx, p2.sx(g), p2.sy(Math.max(1e-3, curvas[g].sesgo)), C.s3, 4.5);
      VIZ.marcador(ctx, p2.sx(g), p2.sy(Math.max(1e-3, curvas[g].varianza)), C.s4, 4.5);
      VIZ.marcador(ctx, p2.sx(g), p2.sy(total[g]), C.s5, 4.5);
      const c = curvas[grado];
      const mejor = total.reduce((m, t, d) => (t < total[m] ? d : m), 0);
      lectura.set([
        ['sesgo²', VIZ.fmt(c.sesgo, 3)],
        ['varianza', VIZ.fmt(c.varianza, 3)],
        ['varianza del ruido', VIZ.fmt(sigma * sigma, 3)],
        ['error esperado', VIZ.fmt(total[grado], 3)],
        ['grado óptimo', String(mejor)],
      ]);
    }
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!p2 || !p2.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(12, Math.round(p2.ix(x))));
      dibujar();
      const c = curvas[hover];
      tip.mostrar(x, y, `grado <b>${hover}</b>` + VIZ.filaTooltip(C.s3, 'sesgo²', VIZ.fmt(c.sesgo, 3)) + VIZ.filaTooltip(C.s4, 'varianza', VIZ.fmt(c.varianza, 3)) +
        VIZ.filaTooltip(C.s5, 'total', VIZ.fmt(c.sesgo + c.varianza + sigma * sigma, 3)));
    });
    l2.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 3: validación cruzada ---------- */

  function montarCV(cuerpo) {
    let k = 5, n = 30, semilla = 3, datos = [], prueba = [], res = [], pliegue = [];
    const MAXG = 12;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Pliegues k', min: 2, max: 10, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ejemplos', min: 15, max: 80, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); });

    VIZ.subtitulo(cuerpo, 'Particiones: en cada fila, un pliegue valida y los demás entrenan');
    const l1 = VIZ.lienzo(cuerpo, { altoFn: () => 16 + k * 18 });
    VIZ.subtitulo(cuerpo, 'Error de validación cruzada según el grado');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 320 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.35), texto: 'entrena' },
      { color: C.s2, texto: 'valida' },
      { color: C.s3, texto: 'error de validación cruzada (± 1 desv.)', forma: 'linea' },
      { color: C.apagado, texto: 'error en datos de prueba nunca vistos', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre el gráfico inferior para ver el error de cada grado. Los datos de prueba solo se usan para comprobar que la validación cruzada estima bien el error.');

    function calcular() {
      const rnd = VIZ.semilla(semilla * 7 + n);
      datos = muestra(n, 0.3, rnd);
      prueba = muestra(400, 0.3, rnd);
      pliegue = datos.map((_, i) => i % k);
      res = Array.from({ length: MAXG + 1 }, (_, d) => {
        const errs = [];
        for (let f = 0; f < k; f++) {
          const tr = datos.filter((_, i) => pliegue[i] !== f), va = datos.filter((_, i) => pliegue[i] === f);
          errs.push(ecm(va, ajustar(tr, Math.min(d, tr.length - 1))));
        }
        const m = errs.reduce((s, e) => s + e, 0) / k;
        const sd = Math.sqrt(errs.reduce((s, e) => s + (e - m) ** 2, 0) / k);
        return { m, sd, prueba: ecm(prueba, ajustar(datos, d)) };
      });
      l1.ajustar(true);
      dibujar();
    }
    let p2 = null, hover = null;
    function dibujar() {
      if (!res.length) return;
      // Pliegues
      let ctx = l1.ctx;
      l1.limpiar();
      const W = l1.ancho, x0 = 70, w = (W - x0 - 8) / n;
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      for (let f = 0; f < k; f++) {
        const y = 8 + f * 18;
        ctx.fillStyle = C.tinta2;
        ctx.textAlign = 'right';
        ctx.fillText(`ronda ${f + 1}`, x0 - 8, y + 7);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = pliegue[i] === f ? C.s2 : VIZ.alfa(C.s1, 0.35);
          ctx.fillRect(x0 + i * w + 0.5, y, Math.max(1, w - 1), 14);
        }
      }
      // Curva de error
      ctx = l2.ctx;
      l2.limpiar();
      const ymax = Math.min(10, Math.max(...res.map((r) => r.m + r.sd), ...res.map((r) => r.prueba)) * 1.3);
      p2 = VIZ.plano(l2, { xmin: -0.3, xmax: MAXG + 0.3, ymin: 0.01, ymax }, { logY: true, etiquetaX: 'grado', etiquetaY: 'ECM', margen: { izq: 46 }, ticksX: Array.from({ length: MAXG + 1 }, (_, i) => i) });
      p2.ejes();
      ctx.save();
      p2.recortar();
      ctx.strokeStyle = VIZ.alfa(C.s3, 0.6);
      ctx.lineWidth = 1.5;
      res.forEach((r, d) => {
        ctx.beginPath();
        ctx.moveTo(p2.sx(d), p2.sy(Math.max(0.01, r.m - r.sd)));
        ctx.lineTo(p2.sx(d), p2.sy(Math.min(ymax, r.m + r.sd)));
        ctx.stroke();
      });
      VIZ.trazar(ctx, p2, res.map((r, d) => [d, r.prueba]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, p2, res.map((r, d) => [d, Math.min(ymax, r.m)]), C.s3, 2);
      ctx.restore();
      const mejor = res.reduce((m, r, d) => (r.m < res[m].m ? d : m), 0);
      res.forEach((r, d) => VIZ.marcador(ctx, p2.sx(d), p2.sy(Math.min(ymax, r.m)), C.s3, d === mejor || d === hover ? 6 : 3.5));
      const optPrueba = res.reduce((m, r, d) => (r.prueba < res[m].prueba ? d : m), 0);
      registro.textContent = `Con ${k} pliegues se entrenan ${k} modelos por grado (${k * (MAXG + 1)} en total). La validación cruzada elige grado ${mejor}; ` +
        `en los datos de prueba el mejor grado es ${optPrueba}.`;
      lectura.set([
        ['grado elegido', String(mejor)],
        ['error CV', VIZ.fmt(res[mejor].m, 3)],
        ['error de prueba', VIZ.fmt(res[mejor].prueba, 3)],
        ['entrena con', `${Math.round((n * (k - 1)) / k)} de ${n} ejemplos`],
      ]);
    }
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!p2 || !p2.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(MAXG, Math.round(p2.ix(x))));
      dibujar();
      const r = res[hover];
      tip.mostrar(x, y, `grado <b>${hover}</b>` + VIZ.filaTooltip(C.s3, 'CV', `${VIZ.fmt(r.m, 3)} ± ${VIZ.fmt(r.sd, 2)}`) + VIZ.filaTooltip(C.apagado, 'prueba', VIZ.fmt(r.prueba, 3)));
    });
    l2.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('supervised-learning', {
    intro: String.raw`
      <p>En el <strong>aprendizaje supervisado</strong> cada ejemplo trae la respuesta correcta: se conocen los atributos \(x\) y
      el objetivo \(y\), y se busca una función que prediga \(y\) en ejemplos nuevos. Si \(y\) es un número se habla de
      <em>regresión</em>; si es una categoría, de <em>clasificación</em>.</p>
      <p>Ajustarse bien a los datos de entrenamiento es fácil; lo difícil es <strong>generalizar</strong>. Un modelo demasiado
      simple no captura el patrón (<strong>subajuste</strong>, mucho <em>sesgo</em>); uno demasiado flexible memoriza también el
      ruido (<strong>sobreajuste</strong>, mucha <em>varianza</em>). Por eso se <strong>entrena</strong> con unos datos y se
      <strong>valida</strong> con otros, y la <strong>validación cruzada</strong> aprovecha todos los datos para ambas cosas.</p>`,
    visualizaciones: [
      {
        titulo: 'Subajuste y sobreajuste',
        descripcion: 'Suba el grado del polinomio: el error de entrenamiento baja siempre, pero el de validación forma una «U». Con pocos ejemplos y grado alto, el polinomio pasa por todos los puntos y oscila entre ellos.',
        montar: montarAjuste,
      },
      {
        titulo: 'El equilibrio entre sesgo y varianza',
        descripcion: 'Cada curva clara es el mismo modelo entrenado con otro conjunto de datos. Con grado bajo todas se equivocan igual (sesgo); con grado alto, cada una se equivoca distinto (varianza). Pruebe más ejemplos: la varianza baja.',
        montar: montarSesgoVarianza,
      },
      {
        titulo: 'Validación cruzada de k pliegues',
        descripcion: 'Los datos se dividen en k pliegues; cada uno valida una vez mientras los demás entrenan. El promedio estima el error de generalización y permite elegir el grado sin apartar datos de prueba.',
        montar: montarCV,
      },
    ],
    teoria: String.raw`
      <h2>Formulación</h2>
      <p>Los ejemplos \((x_i, y_i)\) se suponen extraídos de una distribución \(\mathcal{D}\) desconocida. Con una función de
      pérdida \(L\) (cuadrática en regresión, 0-1 o logarítmica en clasificación), el objetivo es minimizar el
      <strong>riesgo</strong> o error de generalización</p>
      \[ R(h) = \mathbb{E}_{(x, y) \sim \mathcal{D}}\big[L(h(x), y)\big], \]
      <p>pero solo se puede calcular el <strong>riesgo empírico</strong> sobre el entrenamiento,
      \(\hat R(h) = \frac{1}{n} \sum_i L(h(x_i), y_i)\). Entrenar (<code>fit</code>) es minimizar \(\hat R\) dentro de una familia
      de modelos; el problema es que \(\hat R(h)\) subestima \(R(h)\) justamente para el \(h\) elegido.</p>

      <h2>Entrenar, validar y probar</h2>
      <ul>
        <li><strong>Entrenamiento:</strong> para ajustar los parámetros del modelo.</li>
        <li><strong>Validación:</strong> para elegir los <em>hiperparámetros</em> (grado, profundidad, regularización) y comparar modelos.</li>
        <li><strong>Prueba:</strong> se usa una sola vez al final para informar el error esperado; si se usa para decidir, deja de ser
        una estimación honesta.</li>
      </ul>

      <h2>Descomposición sesgo-varianza</h2>
      <p>Sea \(y = f(x) + \varepsilon\) con \(\mathbb{E}[\varepsilon] = 0\), \(\text{Var}(\varepsilon) = \sigma^2\), y sea
      \(\hat f_S\) el modelo entrenado con un conjunto aleatorio \(S\). Con \(\bar f(x) = \mathbb{E}_S[\hat f_S(x)]\), el error
      cuadrático esperado en un punto \(x\) es</p>
      \[ \mathbb{E}_{S,\varepsilon}\big[(y - \hat f_S(x))^2\big] = \underbrace{\big(f(x) - \bar f(x)\big)^2}_{\text{sesgo}^2}
         + \underbrace{\mathbb{E}_S\big[(\hat f_S(x) - \bar f(x))^2\big]}_{\text{varianza}} + \underbrace{\sigma^2}_{\text{ruido}}. \]
      <p>(Se obtiene sumando y restando \(\bar f(x)\) y \(f(x)\); los productos cruzados tienen esperanza cero.) El ruido es
      irreducible. Aumentar la complejidad del modelo baja el sesgo y sube la varianza; más datos bajan la varianza; la
      regularización sube un poco el sesgo a cambio de bajar mucho la varianza.</p>
      <table>
        <thead><tr><th></th><th>Subajuste</th><th>Sobreajuste</th></tr></thead>
        <tbody>
          <tr><td>Error de entrenamiento</td><td>alto</td><td>muy bajo</td></tr>
          <tr><td>Error de validación</td><td>alto, parecido al de entrenamiento</td><td>mucho mayor que el de entrenamiento</td></tr>
          <tr><td>Domina</td><td>sesgo</td><td>varianza</td></tr>
          <tr><td>Remedio</td><td>modelo más flexible, mejores atributos</td><td>más datos, regularización, modelo más simple</td></tr>
        </tbody>
      </table>

      <h2>Validación cruzada</h2>
      <pre><code>dividir los datos en k pliegues F₁, …, F_k
para cada hiperparámetro λ:
    para j ← 1 hasta k:
        h ← fit(datos ∖ F_j, λ)
        e_j ← error de h en F_j
    CV(λ) ← (e₁ + … + e_k) / k
elegir λ* con menor CV(λ) y reentrenar con todos los datos</code></pre>
      <p>Con \(k = n\) se obtiene <em>leave-one-out</em>: casi sin sesgo pero costoso y de varianza alta. Los valores habituales
      \(k = 5\) o \(10\) equilibran costo, sesgo (cada modelo ve una fracción \((k-1)/k\) de los datos) y varianza de la
      estimación. En clasificación conviene que cada pliegue conserve la proporción de clases (<em>estratificar</em>).</p>`,
  });
})();
