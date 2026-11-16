(function () {
  'use strict';
  const { color: C } = VIZ;

  const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const cuantil = (a, q) => { const s = [...a].sort((x, y) => x - y), p = q * (s.length - 1), i = Math.floor(p); return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (p - i); };
  // Función de distribución normal estándar (aproximación de Abramowitz y Stegun 7.1.26).
  const Phi = (z) => {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  };
  const pc = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: semáforo sobre una serie ---------- */

  const N1 = 24;
  function montarSemaforo(cuerpo) {
    let semilla = 1, meta = 92, tol = 3, serie = [], hover = -1, plano = null;
    const generar = () => {
      const rnd = VIZ.semilla(semilla * 13 + 7);
      serie = Array.from({ length: N1 }, (_, t) => Math.min(100, 87 + 0.18 * t + 2.2 * Math.sin((2 * Math.PI * t) / 12) + 2.6 * VIZ.normal(rnd)));
    };
    generar();
    const ctl = VIZ.controles(cuerpo);
    const rMeta = ctl.rango({ etiqueta: 'Meta (verde desde)', min: 80, max: 100, paso: 0.5, valor: meta, formato: (v) => `${v} %`, alCambiar: (v) => { meta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tolerancia amarilla bajo la meta', min: 0, max: 10, paso: 0.5, valor: tol, formato: (v) => `${v} pts`, alCambiar: (v) => { tol = v; dibujar(); } });
    ctl.boton('Meta realista (mediana)', () => fijar(Math.round(cuantil(serie, 0.5) * 2) / 2));
    ctl.boton('Meta de estiramiento (percentil 90)', () => fijar(Math.round(cuantil(serie, 0.9) * 2) / 2));
    ctl.boton('Nuevos datos', () => { semilla++; generar(); dibujar(); }, { primario: true });
    const fijar = (v) => { meta = Math.min(100, Math.max(80, v)); rMeta.valor = meta; dibujar(); };
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'verde: cumple la meta', forma: 'punto' }, { color: C.s4, texto: 'amarillo: dentro de la tolerancia', forma: 'punto' }, { color: C.s8, texto: 'rojo: bajo el umbral', forma: 'punto' },
      { color: C.tinta, texto: 'meta', forma: 'linea' }, { color: C.apagado, texto: 'umbral rojo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Datos simulados: entregas a tiempo por mes (%). Haga clic en el gráfico para fijar la meta a esa altura. Compare qué fracción de meses queda en verde con la meta realista y con la de estiramiento.');

    const estado = (v) => (v >= meta ? 0 : v >= meta - tol ? 1 : 2);
    const COL = [C.s6, C.s4, C.s8], NOM = ['verde', 'amarillo', 'rojo'];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: N1, ymin: 78, ymax: 100 }, { etiquetaX: 'mes', etiquetaY: 'entregas a tiempo (%)', formatoX: (v) => String(Math.round(v)), formatoY: (v) => String(Math.round(v)) });
      const { x0, x1, y0, y1 } = plano;
      const yM = plano.sy(meta), yR = plano.sy(meta - tol);
      ctx.fillStyle = VIZ.alfa(C.s6, 0.12); ctx.fillRect(x0, y1, x1 - x0, Math.max(0, yM - y1));
      ctx.fillStyle = VIZ.alfa(C.s4, 0.16); ctx.fillRect(x0, yM, x1 - x0, Math.max(0, Math.min(y0, yR) - yM));
      ctx.fillStyle = VIZ.alfa(C.s8, 0.1); ctx.fillRect(x0, Math.min(y0, yR), x1 - x0, Math.max(0, y0 - Math.min(y0, yR)));
      plano.ejes();
      VIZ.trazar(ctx, plano, serie.map((v, t) => [t + 1, v]), C.tenue, 1.5);
      ctx.save();
      ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.beginPath(); ctx.moveTo(x0, yM); ctx.lineTo(x1, yM); ctx.stroke();
      if (tol > 0) { ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(x0, yR); ctx.lineTo(x1, yR); ctx.stroke(); }
      ctx.restore();
      serie.forEach((v, t) => VIZ.marcador(ctx, plano.sx(t + 1), plano.sy(v), COL[estado(v)], t === hover ? 6.5 : 4.5, [0, 3, 2][estado(v)]));
      const cuenta = [0, 1, 2].map((e) => serie.filter((v) => estado(v) === e).length);
      const ultimo = serie[N1 - 1];
      registro.textContent = `Meta ≥ ${VIZ.fmt(meta, 3)} %; amarillo entre ${VIZ.fmt(meta - tol, 3)} y ${VIZ.fmt(meta, 3)} %; rojo bajo ${VIZ.fmt(meta - tol, 3)} %. Último mes: ${VIZ.fmt(ultimo, 3)} %, en ${NOM[estado(ultimo)]}.`;
      lectura.set([
        ['meses en verde', `${cuenta[0]} de ${N1} (${pc(cuenta[0] / N1)})`],
        ['meses en amarillo', String(cuenta[1])], ['meses en rojo', String(cuenta[2])],
        ['promedio de la serie', `${VIZ.fmt(media(serie), 3)} %`],
        ['promedio / meta', pc(media(serie) / meta)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const t = Math.min(N1, Math.max(1, Math.round(plano.ix(x)))) - 1;
      if (t !== hover) { hover = t; dibujar(); }
      const v = serie[t], e = estado(v);
      tip.mostrar(x, y, `mes <b>${t + 1}</b><br>valor <b>${VIZ.fmt(v, 4)} %</b>` + VIZ.filaTooltip(COL[e], NOM[e], null) + `<br>frente a la meta: <b>${VIZ.fmt(v - meta, 3)} pts</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (plano && plano.dentro(x, y)) fijar(Math.round(plano.iy(y) * 2) / 2);
    });
    dibujar();
  }

  /* ---------- Fig. 2: falsas alarmas y variabilidad ---------- */

  const N2 = 100, CAMBIO = 60, MU = 90;
  function montarAlarmas(cuerpo) {
    let semilla = 1, sigma = 2, umbral = 3, delta = 4, seguidos = false, z = [], hover = -1, plano = null;
    const generar = () => { const rnd = VIZ.semilla(semilla * 101 + 3); z = Array.from({ length: N2 }, () => VIZ.normal(rnd)); };
    generar();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variabilidad σ del indicador', min: 0.5, max: 6, paso: 0.5, valor: sigma, formato: (v) => `${v} pts`, alCambiar: (v) => { sigma = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Umbral rojo bajo la meta', min: 0.5, max: 10, paso: 0.5, valor: umbral, formato: (v) => `${v} pts`, alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Deterioro real desde el mes 61', min: 0, max: 8, paso: 0.5, valor: delta, formato: (v) => `−${v} pts`, alCambiar: (v) => { delta = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Exigir dos meses seguidos bajo el umbral', valor: seguidos, alCambiar: (v) => { seguidos = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'meta', forma: 'linea' }, { color: C.s8, texto: 'umbral rojo', forma: 'linea' },
      { color: C.s8, texto: 'alerta disparada', forma: 'punto' }, { color: C.neutro, borde: C.eje, texto: 'periodo con deterioro real' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El indicador está en su meta (90) hasta el mes 60 y luego se deteriora. Toda alerta antes del mes 61 es una falsa alarma. Suba σ, baje el umbral o active la regla de dos meses y compare falsas alarmas con detecciones.');

    const valor = (t) => MU - (t >= CAMBIO ? delta : 0) + sigma * z[t];
    const bajo = (t) => valor(t) < MU - umbral;
    const alerta = (t) => bajo(t) && (!seguidos || (t > 0 && bajo(t - 1)));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const lo = 62, hi = 105;
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: N2, ymin: lo, ymax: hi }, { etiquetaX: 'mes', etiquetaY: 'valor del indicador', formatoX: (v) => String(Math.round(v)), formatoY: (v) => String(Math.round(v)) });
      const { x0, x1, y0, y1 } = plano;
      ctx.fillStyle = C.neutro; ctx.fillRect(plano.sx(CAMBIO + 1), y1, x1 - plano.sx(CAMBIO + 1), y0 - y1);
      plano.ejes();
      const vals = Array.from({ length: N2 }, (_, t) => valor(t));
      ctx.save(); plano.recortar();
      VIZ.trazar(ctx, plano, vals.map((v, t) => [t + 1, v]), C.s1, 1.5);
      ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.beginPath(); ctx.moveTo(x0, plano.sy(MU)); ctx.lineTo(x1, plano.sy(MU)); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = C.s8; ctx.beginPath(); ctx.moveTo(x0, plano.sy(MU - umbral)); ctx.lineTo(x1, plano.sy(MU - umbral)); ctx.stroke();
      ctx.restore();
      vals.forEach((v, t) => { if (alerta(t)) VIZ.marcador(ctx, plano.sx(t + 1), plano.sy(v), C.s8, t === hover ? 6.5 : 4.5); else if (t === hover) VIZ.marcador(ctx, plano.sx(t + 1), plano.sy(v), C.s1, 5); });
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('deterioro real', plano.sx(CAMBIO + 1) + 4, y1 + 3);
      const fa = [...Array(CAMBIO).keys()].filter(alerta).length, det = [...Array(N2 - CAMBIO).keys()].map((k) => k + CAMBIO).filter(alerta).length;
      const primera = [...Array(N2 - CAMBIO).keys()].map((k) => k + CAMBIO).find(alerta);
      const p1 = Phi(-umbral / sigma), pd1 = Phi((delta - umbral) / sigma);
      const pFa = seguidos ? p1 * p1 : p1, pDet = seguidos ? pd1 * pd1 : pd1;
      registro.textContent = `Sin deterioro, cada mes tiene probabilidad Φ(−${VIZ.fmt(umbral, 2)}/${VIZ.fmt(sigma, 2)}) = ${pc(p1)} de caer bajo el umbral${seguidos ? `; dos seguidos: ${pc(pFa)}` : ''}. Con deterioro, la detección esperada es ${pc(pDet)} por mes. ${fa ? `Esta serie tuvo ${fa} falsa${fa > 1 ? 's' : ''} alarma${fa > 1 ? 's' : ''}.` : 'Esta serie no tuvo falsas alarmas.'}`;
      lectura.set([
        ['falsas alarmas (meses 1 a 60)', `${fa} (${pc(fa / CAMBIO)})`], ['esperadas', pc(pFa)],
        ['detecciones (meses 61 a 100)', `${det} (${pc(det / (N2 - CAMBIO))})`], ['esperadas', pc(pDet)],
        ['demora hasta la primera detección', primera === undefined ? 'no se detectó' : `${primera - CAMBIO + 1} mes${primera - CAMBIO ? 'es' : ''}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const t = Math.min(N2, Math.max(1, Math.round(plano.ix(x)))) - 1;
      if (t !== hover) { hover = t; dibujar(); }
      tip.mostrar(x, y, `mes <b>${t + 1}</b><br>valor <b>${VIZ.fmt(valor(t), 4)}</b><br>${t >= CAMBIO ? 'con deterioro real' : 'proceso en la meta'}` + (alerta(t) ? VIZ.filaTooltip(C.s8, t >= CAMBIO ? 'alerta correcta' : 'falsa alarma', null) : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('targets-thresholds', {
    intro: String.raw`
      <p>Un indicador sin <strong>meta</strong> es solo un número. La meta dice qué valor se considera éxito, y los <strong>umbrales</strong> traducen la distancia a la meta en colores:
      verde si se cumple, amarillo si se está cerca y rojo si hay que actuar. Así se evalúa el cumplimiento de objetivos de un vistazo y a lo largo del tiempo.</p>
      <p>Fijar la meta y los umbrales es una decisión de gestión con consecuencias estadísticas: una meta de estiramiento puede dejar casi todo en rojo, y un umbral demasiado ajustado
      sobre un indicador muy variable genera alertas que son pura casualidad. Se aprende a distinguir una señal de ruido.</p>`,
    parametros: [
      ['Meta (verde desde) (Fig. 1)', String.raw`De 80 a 100 %. Valor del indicador desde el cual el mes cumple (verde); más alta, menos meses en verde. También se fija con un clic sobre el gráfico.`],
      ['Tolerancia amarilla bajo la meta (Fig. 1)', String.raw`De 0 a 10 puntos. Ancho de la franja amarilla bajo la meta; debajo de ella empieza el rojo. Con tolerancia 0 no hay amarillo.`],
      ['Meta realista (mediana) (Fig. 1)', String.raw`Fija la meta en la mediana de los 24 meses simulados (redondeada a 0,5): cerca de la mitad de los meses cumple.`],
      ['Meta de estiramiento (percentil 90) (Fig. 1)', String.raw`Fija la meta en el percentil 90 de la serie: solo los mejores meses cumplen.`],
      ['Nuevos datos (Fig. 1)', String.raw`Genera otra serie simulada de 24 meses para ver que la conclusión no depende de una muestra.`],
      ['Variabilidad σ del indicador (Fig. 2)', String.raw`De 0,5 a 6 puntos. Dispersión natural mes a mes; con más σ la serie cruza el umbral por casualidad.`],
      ['Umbral rojo bajo la meta (Fig. 2)', String.raw`De 0,5 a 10 puntos bajo la meta de 90. Una alerta se dispara cuando el valor cae bajo este umbral; más cerca de la meta, más alertas.`],
      ['Deterioro real desde el mes 61 (Fig. 2)', String.raw`De 0 a 8 puntos de caída del nivel a partir del mes 61. Es lo que la alerta debería detectar.`],
      ['Exigir dos meses seguidos bajo el umbral (Fig. 2)', String.raw`Casilla: solo se dispara la alerta si el mes y el anterior están bajo el umbral. Reduce las falsas alarmas, pero demora la detección.`],
      ['Nuevos datos (Fig. 2)', String.raw`Sortea otra serie de 100 meses de ruido, con la misma meta y deterioro.`],
    ],
    visualizaciones: [
      {
        titulo: 'Meta y semáforo sobre una serie',
        descripcion: 'Mueva la meta y la tolerancia, o haga clic en el gráfico, y vea cuántos meses quedan en cada color. Compare la meta realista (mediana de la serie) con la de estiramiento (percentil 90).',
        ayuda: String.raw`<p>Entregas a tiempo (%) por mes (eje horizontal, 24 meses) y la serie en una línea gris tenue con un punto por mes. Cada punto es verde (C.s6) si cumple la meta, amarillo (C.s4) si está dentro de la tolerancia y rojo (C.s8) si está bajo el umbral; la forma del marcador también cambia con el estado. La línea negra es la meta, la punteada gris el umbral rojo, y el fondo se tiñe de las mismas bandas.</p>
          <ul>
          <li><strong>Meta</strong>: subirla pasa meses de verde a amarillo o rojo; un clic en el gráfico también la fija.</li>
          <li><strong>Tolerancia amarilla</strong>: baja el umbral rojo y ensancha la banda amarilla.</li>
          <li><strong>Meta realista</strong> y <strong>Meta de estiramiento</strong>: comparan cuántos meses quedan en verde con cada una.</li>
          <li><strong>Nuevos datos</strong>: otra serie con los mismos parámetros.</li>
          </ul>`,
        montar: montarSemaforo,
      },
      {
        titulo: 'Falsas alarmas y variabilidad',
        descripcion: 'El proceso está en su meta hasta el mes 60. Suba la variabilidad σ y verá más alertas rojas sin que nada haya cambiado; luego pruebe la regla de dos meses seguidos y compare cuánto tarda en detectar el deterioro.',
        ayuda: String.raw`<p>Valor mensual del indicador durante 100 meses (línea azul, C.s1). La línea negra es la meta de 90 y la roja punteada (C.s8) el umbral. Los puntos rojos son alertas disparadas, y la zona gris de la derecha, desde el mes 61, es el deterioro real: una alerta antes de ese punto es una falsa alarma.</p>
          <ul>
          <li><strong>Variabilidad σ</strong>: más dispersión cruza el umbral por azar.</li>
          <li><strong>Umbral rojo</strong>: más cerca de la meta, más alertas, falsas y verdaderas.</li>
          <li><strong>Deterioro real</strong>: baja la serie desde el mes 61 y facilita la detección.</li>
          <li><strong>Exigir dos meses seguidos</strong>: elimina alertas aisladas, pero retrasa la primera detección.</li>
          </ul>`,
        montar: montarAlarmas,
      },
    ],
    teoria: String.raw`
      <h2>Metas y umbrales</h2>
      <p>Para un indicador donde más es mejor, con meta \(m\) y tolerancia \(\tau\), el estado del periodo \(t\) con valor \(x_t\) es</p>
      \[ \text{estado}(x_t) = \begin{cases} \text{verde} & x_t \ge m \\ \text{amarillo} & m - \tau \le x_t < m \\ \text{rojo} & x_t < m - \tau. \end{cases} \]
      <p>Si el indicador es de «menos es mejor» (tiempos, defectos) las desigualdades se invierten. El <em>cumplimiento</em> puede ser la fracción de periodos en verde o el cociente \(\bar{x}/m\).</p>
      <h3>Meta realista y meta de estiramiento</h3>
      <p>Una <strong>meta realista</strong> se apoya en el desempeño histórico (por ejemplo, la mediana): se espera cumplir la mitad de los periodos. Una <strong>meta de estiramiento</strong>
      (percentil 90) busca un salto: solo se cumple en uno de cada diez periodos si nada cambia, así que exige mejoras reales del proceso. La primera sirve para operación; la segunda para
      <a href="tema.html?id=okr-framework">OKR</a> ambiciosos.</p>
      <h2>Falsas alarmas</h2>
      <p>Si el proceso está en la meta \(m\) y el indicador varía como una normal de desviación \(\sigma\), la probabilidad de que un mes cualquiera caiga bajo el umbral \(m - u\) es</p>
      \[ P(\text{falsa alarma}) = \Phi\!\left(-\frac{u}{\sigma}\right). \]
      <p>Ejemplo: con \(u = 3\) y \(\sigma = 2\), \(\Phi(-1{,}5) \approx 6{,}7\ \%\), unos 4 meses de cada 60. Con \(\sigma = 4\), \(\Phi(-0{,}75) \approx 22{,}7\ \%\): casi uno de cada cuatro meses suena la alarma sin motivo.
      Exigir dos meses seguidos baja la probabilidad a \(p^2\) (0,45 % con \(\sigma = 2\)) pero también retrasa la detección.</p>
      <h2>Detección de un deterioro</h2>
      <p>Si el valor medio cae \(\delta\) puntos, la probabilidad de alerta en un mes es \(\Phi\!\left(\frac{\delta - u}{\sigma}\right)\). Con \(\delta = 4\), \(u = 3\) y \(\sigma = 2\): \(\Phi(0{,}5) \approx 69\ \%\) por mes, y se espera
      detectarlo en alrededor de \(1/0{,}69 \approx 1{,}4\) meses. Subir \(u\) reduce las falsas alarmas a costa de detectar tarde: es un compromiso, no un error que se pueda eliminar.</p>
      <div class="recuadro"><p><strong>Regla práctica.</strong> Fije el umbral en función de la variabilidad natural del indicador (por ejemplo, 2 σ), no solo de lo que la gerencia desea. Revise metas y umbrales cada año.</p></div>
      <h2>Conexiones</h2>
      <p>La elección del indicador se discute en <a href="tema.html?id=kpi-fundamentals">fundamentos de KPI</a>. La regla de intervención ante tendencias y la variabilidad en el tiempo continúan en
      <a href="tema.html?id=control-dashboards">tableros de control</a>, y el efecto de un proyecto sobre un indicador, en <a href="tema.html?id=project-impact-measurement">medición del impacto</a>.</p>`,
  });
})();
