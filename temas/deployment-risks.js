(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  const perdida = (r, q) => { const p = DL.predecir(r, [q.x, q.y])[0]; return -(q.c * Math.log(p + 1e-12) + (1 - q.c) * Math.log(1 - p + 1e-12)); };

  /* ---------- Fig. 1: un modelo que memoriza delata a quién entrenó ---------- */

  function montarMembresia(cuerpo) {
    let ocultas = 40, l2 = 0, semilla = 1, miembros = [], ajenos = [], red = null, opt = null, ep = 0, hist = [], hov = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Neuronas por capa (capacidad)', min: 2, max: 60, valor: ocultas, alCambiar: (v) => { ocultas = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Regularización L2', min: 0, max: 0.05, paso: 0.002, valor: l2, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { l2 = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 8 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 250, altoMax: 340 }), l2c = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 250, altoMax: 340 });
    const tip1 = VIZ.tooltip(l1), tip2 = VIZ.tooltip(l2c);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'datos de entrenamiento («miembros»)', forma: 'cuadro' }, { color: C.s2, texto: 'datos que el modelo no vio', forma: 'cuadro' }, { color: C.s8, texto: 'exactitud del adversario que adivina «¿estaba en el entrenamiento?»', forma: 'linea' }, { color: C.apagado, texto: 'azar (50 %)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ataque de inferencia de pertenencia: el adversario ve solo la pérdida del modelo en un ejemplo y decide «estaba en el entrenamiento» si es baja. Con un modelo que memoriza (muchas neuronas, muchas épocas, datos ruidosos), las pérdidas de miembros y no miembros se separan y el adversario acierta bastante más que al azar. La regularización lo reduce.');
    function iniciar() {
      const todo = ML.datos('lunas', 80, 0.45, semilla * 3); miembros = todo.slice(0, 40); ajenos = todo.slice(40);
      red = DL.red([2, ocultas, ocultas, 1], { act: 'tanh', semilla: semilla + 2 }); opt = DL.optimizador('adam', { lr: 0.03 }); ep = 0; hist = [];
      const r = VIZ.semilla(semilla);
      return (function* () { while (ep < 300) { for (let k = 0; k < 4; k++) { const L = DL.mezclar(DL.pares(miembros), r); for (let i = 0; i < L.length; i += 10) DL.entrenarPaso(red, L.slice(i, i + 10), opt, { l2 }); ep++; } hist.push({ ep, a: ataque().acc, tr: media(miembros), te: media(ajenos) }); yield; } })();
    }
    const media = (L) => L.reduce((s, q) => s + perdida(red, q), 0) / L.length;
    function ataque() { const m = miembros.map((q) => perdida(red, q)), a = ajenos.map((q) => perdida(red, q)), ts = [...m, ...a].sort((x, y) => x - y); let mejor = 0.5, th = 0; ts.forEach((t) => { const ac = (m.filter((v) => v <= t).length + a.filter((v) => v > t).length) / (m.length + a.length); if (ac > mejor) { mejor = ac; th = t; } }); return { acc: mejor, th, m, a }; }
    function dibujar() {
      if (!red) return;
      const at = ataque();
      {
        const { ctx } = l1; l1.limpiar();
        const mx = Math.max(1.5, ...at.m, ...at.a), B = 14, h = (v) => Math.min(B - 1, Math.floor((v / mx) * B)), cm = new Array(B).fill(0), ca = new Array(B).fill(0);
        at.m.forEach((v) => cm[h(v)]++); at.a.forEach((v) => ca[h(v)]++);
        const p = VIZ.plano(l1, { xmin: 0, xmax: mx, ymin: 0, ymax: Math.max(...cm, ...ca) * 1.15 }, { etiquetaX: 'pérdida del modelo en el ejemplo', etiquetaY: 'ejemplos' }); p.ejes();
        const bw = (p.x1 - p.x0) / B;
        cm.forEach((n, i) => { ctx.fillStyle = VIZ.alfa(C.s1, 0.7); ctx.fillRect(p.x0 + i * bw + 1, p.sy(n), bw / 2 - 1, p.y0 - p.sy(n)); });
        ca.forEach((n, i) => { ctx.fillStyle = VIZ.alfa(C.s2, 0.7); ctx.fillRect(p.x0 + i * bw + bw / 2, p.sy(n), bw / 2 - 1, p.y0 - p.sy(n)); });
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(p.sx(at.th), p.y0); ctx.lineTo(p.sx(at.th), p.y1); ctx.stroke(); ctx.setLineDash([]);
      }
      {
        const { ctx } = l2c; l2c.limpiar();
        const p = VIZ.plano(l2c, { xmin: 0, xmax: 300, ymin: 0.4, ymax: 1 }, { etiquetaX: 'época', etiquetaY: 'exactitud del adversario', formatoY: (v) => `${Math.round(v * 100)} %` }); p.ejes();
        VIZ.trazar(ctx, p, [[0, 0.5], [300, 0.5]], C.apagado, 1.4, [4, 4]); VIZ.trazar(ctx, p, hist.map((h) => [h.ep, h.a]), C.s8, 2.5); l2c.pl = p;
      }
      const u = hist[hist.length - 1] || { a: at.acc, tr: media(miembros), te: media(ajenos) };
      registro.textContent = `Época ${ep}: pérdida media de ${VIZ.fmt(u.tr, 3)} en los datos de entrenamiento y de ${VIZ.fmt(u.te, 3)} en datos nuevos. Un adversario que solo mira la pérdida adivina la pertenencia en el ${VIZ.fmt(100 * at.acc, 3)} % de los casos.`;
      lectura.set([['época', String(ep)], ['pérdida en miembros', VIZ.fmt(u.tr, 3)], ['pérdida en no miembros', VIZ.fmt(u.te, 3)], ['exactitud del adversario', `${VIZ.fmt(100 * at.acc, 3)} %`], ['parámetros', String(DL.nParametros([2, ocultas, ocultas, 1]))]]);
    }
    l1.alDibujar = dibujar; l2c.alDibujar = dibujar;
    l2c.canvas.addEventListener('pointermove', (ev) => { const { x, y } = l2c.posicion(ev); if (!l2c.pl || !l2c.pl.dentro(x, y) || !hist.length) return tip2.ocultar(); const h = hist.reduce((m, q) => (Math.abs(q.ep - l2c.pl.ix(x)) < Math.abs(m.ep - l2c.pl.ix(x)) ? q : m)); tip2.mostrar(x, y, `época <b>${h.ep}</b><br>adversario <b>${VIZ.fmt(100 * h.a, 3)} %</b><br>pérdida: miembros ${VIZ.fmt(h.tr, 3)}, ajenos ${VIZ.fmt(h.te, 3)}`); });
    l2c.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cuando el mundo cambia después del despliegue ---------- */

  let R = null;
  function modelo() { if (R) return R; const pts = ML.datos('lunas', 200, 0.2, 9), r = DL.red([2, 16, 16, 1], { act: 'tanh', semilla: 4 }), o = DL.optimizador('adam', { lr: 0.03 }), rnd = VIZ.semilla(1); for (let e = 0; e < 200; e++) { const L = DL.mezclar(DL.pares(pts), rnd); for (let i = 0; i < L.length; i += 16) DL.entrenarPaso(r, L.slice(i, i + 16), o); } R = { r, base: ML.datos('lunas', 300, 0.2, 31) }; return R; }

  function montarDeriva(cuerpo) {
    let desplazo = 0.4, ruido = 0, tipo = 'traslacion', hover = -1, pl = null, geo = null;
    const { r, base } = modelo();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de cambio', opciones: [['traslacion', 'los datos se desplazan'], ['ruido', 'los datos son más ruidosos'], ['rotacion', 'los datos giran']], valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Magnitud del cambio', min: 0, max: 1, paso: 0.02, valor: desplazo, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { desplazo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 340 : 560) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2), { color: C.s1, texto: 'exactitud real', forma: 'linea' }, { color: C.s8, texto: 'confianza media del modelo (lo que se puede medir sin etiquetas)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El modelo se entrenó con las lunas de la izquierda. Después del despliegue, los datos reales cambian (otro sensor, otra población, otra época). La exactitud cae, pero el modelo sigue dando probabilidades altas: la confianza no avisa por sí sola. Para detectar la deriva hay que vigilar la distribución de las entradas y, cuando se pueda, obtener etiquetas.');
    const transformar = (q, m) => { const rr = VIZ.semilla(Math.round(q.x * 1e4 + q.y * 1e3 + 7)); if (tipo === 'traslacion') return { ...q, x: q.x + m, y: q.y - 0.5 * m }; if (tipo === 'ruido') return { ...q, x: q.x + 0.6 * m * VIZ.normal(rr), y: q.y + 0.6 * m * VIZ.normal(rr) }; const a = m * 1.2, c = Math.cos(a), s = Math.sin(a); return { ...q, x: c * q.x - s * q.y, y: s * q.x + c * q.y }; };
    const evaluar = (m) => { const T = base.map((q) => transformar(q, m)); const acc = T.filter((q) => (DL.predecir(r, [q.x, q.y])[0] > 0.5 ? 1 : 0) === q.c).length / T.length, conf = T.reduce((s, q) => { const p = DL.predecir(r, [q.x, q.y])[0]; return s + Math.max(p, 1 - p); }, 0) / T.length; return { m, acc, conf, T }; };
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 700, S = ancha ? Math.min(330, W * 0.42) : Math.min(W - 30, 320), E = evaluar(desplazo);
      lienzo.limpiar();
      const pp = VIZ.plano({ ancho: ancha ? S + 20 : W, alto: S + 30, ctx }, ML.DOMINIO, { etiquetaX: 'x₁', margen: { izq: 40, der: ancha ? 8 : W - S - 40, sup: 12, inf: 32 } }); pp.ejes(); geo = pp;
      ctx.save(); pp.recortar(); ML.regiones(ctx, pp, (x, y) => DL.predecir(r, [x, y])[0], { paso: 8, intensidad: 0.25 }); ML.contorno(ctx, pp, (x, y) => DL.predecir(r, [x, y])[0], 0.5, { color: C.tinta, ancho: 2 }); ctx.restore();
      ctx.save(); pp.recortar(); ML.puntos(ctx, pp, E.T, { r: 3 }); ctx.restore();
      const xg = ancha ? S + 60 : 40, yg = ancha ? 12 : S + 56, wg = ancha ? W - xg - 14 : W - 54, hg = ancha ? S - 10 : 170;
      const ms = Array.from({ length: 26 }, (_, i) => i / 25), curva = ms.map(evaluar);
      pl = VIZ.plano({ ancho: W, alto: yg + hg + 40, ctx }, { xmin: 0, xmax: 1, ymin: 0.4, ymax: 1 }, { etiquetaX: 'magnitud del cambio', formatoY: (v) => `${Math.round(v * 100)} %`, margen: { izq: xg, der: W - xg - wg, sup: yg, inf: 36 } }); pl.ejes();
      VIZ.trazar(ctx, pl, curva.map((c) => [c.m, c.acc]), C.s1, 2.5); VIZ.trazar(ctx, pl, curva.map((c) => [c.m, c.conf]), C.s8, 2.5, [5, 3]);
      VIZ.marcador(ctx, pl.sx(desplazo), pl.sy(E.acc), C.s1, 5); VIZ.marcador(ctx, pl.sx(desplazo), pl.sy(E.conf), C.s8, 5);
      registro.textContent = `Con el cambio ${VIZ.fmt(desplazo, 2)}: exactitud real ${VIZ.fmt(100 * E.acc, 3)} %, pero la confianza media sigue en ${VIZ.fmt(100 * E.conf, 3)} %${E.conf - E.acc > 0.1 ? ': el modelo está sobreconfiado y nadie lo notaría sin etiquetas.' : '.'}`;
      lectura.set([['exactitud sin cambio', `${VIZ.fmt(100 * curva[0].acc, 3)} %`], ['exactitud con el cambio', `${VIZ.fmt(100 * E.acc, 3)} %`], ['confianza media', `${VIZ.fmt(100 * E.conf, 3)} %`], ['brecha confianza − exactitud', `${VIZ.fmt(100 * (E.conf - E.acc), 3)} puntos`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) return tip.ocultar(); const m = Math.max(0, Math.min(1, pl.ix(x))), E = evaluar(m); tip.mostrar(x, y, `cambio <b>${VIZ.fmt(m, 2)}</b>` + VIZ.filaTooltip(C.s1, 'exactitud', `${VIZ.fmt(100 * E.acc, 3)} %`) + VIZ.filaTooltip(C.s8, 'confianza', `${VIZ.fmt(100 * E.conf, 3)} %`)); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('deployment-risks', {
    intro: String.raw`
      <p>Entrenar un buen modelo es la parte fácil de verificar; lo difícil empieza al <strong>desplegarlo</strong>. El mundo real no es el conjunto de prueba: los datos cambian con el tiempo (<em>deriva</em>), hay personas que intentan engañar al sistema, los datos de entrenamiento pueden filtrarse a través del modelo, y los errores tienen consecuencias para personas concretas.</p>
      <p>Esta página mira dos riesgos medibles. Primero, la <strong>privacidad</strong>: un modelo que memoriza sus datos de entrenamiento delata quién estuvo en ellos. Segundo, el <strong>cambio de distribución</strong>: un modelo que rinde bien en el laboratorio puede degradarse en silencio al cambiar la población que atiende.</p>`,
    visualizaciones: [
      { titulo: 'Un modelo que memoriza delata a sus datos', descripcion: 'Aumente la capacidad y las épocas y vea cómo se separan las pérdidas de miembros y no miembros. Active L2 y compare.', montar: montarMembresia },
      { titulo: 'Cuando los datos cambian', descripcion: 'Desplace, ensucie o gire los datos y compare la exactitud con la confianza que declara el modelo.', montar: montarDeriva },
    ],
    teoria: String.raw`
      <h2>Privacidad</h2>
      <ul>
        <li><strong>Inferencia de pertenencia:</strong> decidir si un ejemplo estuvo en el entrenamiento a partir de la salida del modelo. Es más fácil cuanto más sobreajustado está (la brecha de generalización es una cota inferior de la fuga).</li>
        <li><strong>Memorización y extracción:</strong> los modelos de lenguaje grandes pueden regurgitar fragmentos de sus datos (nombres, direcciones, claves), sobre todo si aparecen repetidos.</li>
        <li><strong>Defensas:</strong> regularizar y no sobreentrenar, deduplicar los datos y, con garantías formales, el <em>entrenamiento con privacidad diferencial</em> (DP-SGD): se recorta el gradiente por ejemplo y se añade ruido gaussiano, de modo que añadir o quitar una persona cambia poco la distribución de los modelos posibles (<a href="tema.html?id=privacidad-diferencial">Differential Privacy</a>).</li>
      </ul>
      <h2>Cambio de distribución</h2>
      <p>El modelo se entrena con \(P_{\text{train}}(x,y)\) y se usa con \(P_{\text{real}}(x,y)\ne P_{\text{train}}\). Tipos habituales: <em>covariate shift</em> (cambia \(P(x)\)), <em>label shift</em> (cambia \(P(y)\)) y <em>concept drift</em> (cambia \(P(y\mid x)\)). Se mitiga:</p>
      <ul><li>vigilando la distribución de las entradas y de las salidas, no solo la exactitud (que exige etiquetas);</li><li>reentrenando periódicamente y con datos recientes;</li><li>calibrando las probabilidades y permitiendo que el modelo diga «no sé» (<em>abstención</em>, detección de datos fuera de distribución).</li></ul>
      <h2>Lista de verificación antes de desplegar</h2>
      <ul>
        <li>¿Se evaluó por subgrupos relevantes (<a href="tema.html?id=algorithmic-fairness">equidad</a>) y no solo en promedio?</li>
        <li>¿Hay una persona que pueda revisar y revertir decisiones de alto impacto? ¿Se explican (<a href="tema.html?id=interpretability">interpretabilidad</a>)?</li>
        <li>¿Se probó contra entradas adversariales (<a href="tema.html?id=adversarial-robustness">robustez</a>) y contra datos fuera de lo esperado?</li>
        <li>¿Qué datos personales se usaron, con qué base, y qué pueden revelar? ¿Se cumple la normativa (por ejemplo, la <a href="tema.html?id=ley-21719">Ley 21.719</a>)?</li>
        <li>¿Quién responde por los errores? ¿Cómo se monitorea y se retira el sistema?</li>
        <li>¿Se evaluó el costo ambiental y de cómputo (<a href="tema.html?id=training-cost">Training Cost</a>)?</li>
      </ul>
      <div class="recuadro"><p>Las consideraciones éticas no se agregan al final: se deciden desde el diseño (qué problema resolver, con qué datos, para quién). Un modelo técnicamente correcto puede ser inaceptable si su uso vulnera derechos, y uno imperfecto puede ser útil si se despliega con supervisión y límites claros.</p></div>`,
  });
})();
