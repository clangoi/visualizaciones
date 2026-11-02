(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Proceso real (a; b ‖ c; d | e; f) y las cuatro trazas completas que permite.
  const ARBOL = P.sec(P.act('a'), P.y(P.act('b'), P.act('c')), P.xor([P.act('d'), P.act('e')], [0.6, 0.4]), P.act('f'));
  const VALIDAS = ['abcdf', 'acbdf', 'abcef', 'acbef'];
  const SIGNIFICADO = 'a = registrar, b = verificar crédito, c = verificar inventario, d = aprobar, e = rechazar, f = archivar';

  // Posición (0-based) del primer evento que deja el prefijo fuera de todo comportamiento válido;
  // si el prefijo es válido pero la traza queda incompleta, la desviación aparece al cerrar (= largo).
  function indiceReal(t) {
    for (let i = 1; i <= t.length; i++) if (!VALIDAS.some((v) => v.startsWith(t.slice(0, i)))) return i - 1;
    return VALIDAS.includes(t) ? -1 : t.length;
  }

  // Reproducción incremental sobre la red: un paso por evento y un paso final de cierre del caso.
  function reproducir(red, traza) {
    let m = P.marcadoInicial(red), cum = 0;
    const pasos = [];
    for (const a of traza) {
      const t = red.trans.find((x) => x.nombre === a);
      if (!t) { pasos.push({ act: a, desconocida: true, faltan: [], cum: ++cum, marcado: { ...m } }); continue; }
      const faltan = [];
      for (const pl of P.entradas(red, t.id)) if ((m[pl] || 0) <= 0) { m[pl] = 1; faltan.push(pl); }
      cum += faltan.length;
      m = P.disparar(red, m, t.id);
      pasos.push({ act: a, trans: t.id, faltan, cum, marcado: { ...m } });
    }
    let sobran = 0, faltaFin = 0;
    if ((m[red.fin] || 0) > 0) m[red.fin]--; else faltaFin = 1;
    for (const k of Object.keys(m)) sobran += Math.max(0, m[k]);
    cum += faltaFin + sobran;
    pasos.push({ cierre: true, faltaFin, sobran, faltan: [], cum, marcado: { ...m } });
    return pasos;
  }

  /* ---------- Fig. 1: evento a evento ---------- */

  const ESCENARIOS = [
    ['abcdf', 'Caso conforme: abcdf'],
    ['acbef', 'Orden paralelo permitido: acbef'],
    ['abdf', 'Se omite c: abdf'],
    ['abbcdf', 'Se repite b: abbcdf'],
    ['abxcdf', 'Actividad desconocida: abxcdf'],
    ['abcd', 'Caso incompleto: abcd'],
  ];

  function montarEventos(cuerpo) {
    const ent = P.logSimple([['abcdf', 3], ['acbdf', 3], ['abcef', 2], ['acbef', 2]]);
    const red = P.alfa(ent).red;
    const pos = P.posDeRed(red);
    let texto = 'abdf', pasos = [], n = 0, ultimo = null;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Escenario', opciones: ESCENARIOS, valor: texto, alCambiar: (v) => { texto = v; campo.valor = v; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'Traza (letras a–f)', valor: texto, alCambiar: (v) => { texto = v.toLowerCase().replace(/[^a-z]/g, ''); campo.valor = texto; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w >= 640 ? 300 : 520) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'transición que acaba de disparar', forma: 'cuadro' },
      { color: C.s8, texto: 'transición no habilitada (alerta) y plaza con ficha faltante', forma: 'cuadro' },
      { color: C.tinta, texto: 'ficha en una plaza', forma: 'punto' },
    ]);
    const recibidos = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(recibidos);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Modelo descubierto con Alfa a partir de ocho casos limpios. ${SIGNIFICADO}. Pulse «Un paso» para enviar un evento a la vez; edite la traza o elija un escenario. Omitir c solo se nota cuando llega d: la alerta nunca puede salir antes del primer evento que ya no cuadra con el modelo.`);

    function iniciar() {
      texto = campo.valor.toLowerCase().replace(/[^a-z]/g, '');
      pasos = reproducir(red, [...texto]);
      n = 0; ultimo = null;
      return (function* () { while (n < pasos.length) { ultimo = pasos[n++]; yield; } })();
    }
    function dibujar() {
      lienzo.limpiar();
      const vistos = pasos.slice(0, n);
      const alertaIdx = vistos.findIndex((p) => p.cum > 0);
      const marcado = ultimo ? ultimo.marcado : P.marcadoInicial(red);
      const { nodos, aristas } = P.nodosDeRed(red, marcado, {
        plaza: (p) => (ultimo && ultimo.faltan.includes(p.id) ? { anillo: C.s8, insignia: 'falta', colorInsignia: C.s8 } : {}),
        trans: (t) => (ultimo && ultimo.trans === t.id ? (ultimo.faltan.length ? { relleno: VIZ.alfa(C.s8, 0.2), anillo: C.s8 } : { relleno: VIZ.alfa(C.s1, 0.2), anillo: C.s1 }) : {}),
      });
      const v = lienzo.ancho < 640;
      const p = {}; for (const id of Object.keys(pos)) p[id] = v ? { x: pos[id].y, y: pos[id].x } : pos[id];
      P.dibujarGrafo(lienzo, nodos, aristas, p, { margenX: 30, margenY: 30 });

      recibidos.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'recibidos:'),
        ...(vistos.length ? vistos.map((q, i) => (q.cierre
          ? VIZ.ficha('■ cierre', q.faltaFin || q.sobran ? { color: C.s8, tinta: C.s8 } : { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) })
          : VIZ.ficha(q.act, q.cum > (i ? vistos[i - 1].cum : 0) ? { color: C.s8, tinta: C.s8, fondo: VIZ.alfa(C.s8, 0.1) } : { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) })))
          : [VIZ.el('span', { class: 'fichas-vacio' }, 'ninguno todavía')]));

      const real = indiceReal(texto);
      if (!ultimo) registro.textContent = 'La traza aún no empieza: hay una ficha en «inicio». Pulse Un paso.';
      else if (ultimo.cierre) registro.textContent = ultimo.faltaFin || ultimo.sobran
        ? `Cierre del caso: ${ultimo.faltaFin ? 'falta la ficha de «fin» (el caso quedó incompleto)' : ''}${ultimo.faltaFin && ultimo.sobran ? ' y ' : ''}${ultimo.sobran ? `sobran ${ultimo.sobran} ficha(s) en plazas intermedias` : ''}.`
        : 'Cierre del caso: la ficha llegó a «fin» y no sobra ninguna; el caso fue conforme.';
      else if (ultimo.desconocida) registro.textContent = `«${ultimo.act}» no es una actividad del modelo: alerta inmediata, no hay transición que disparar.`;
      else if (ultimo.faltan.length) registro.textContent = `ALERTA: «${ultimo.act}» no estaba habilitada; faltaba ${ultimo.faltan.length} ficha(s) de entrada. Se las agrega artificialmente para seguir reproduciendo.`;
      else registro.textContent = `«${ultimo.act}» disparó con fichas de verdad: el caso sigue siendo conforme hasta aquí.`;

      const etiq = (i) => (i === texto.length ? 'cierre' : `evento ${i + 1} («${texto[i]}»)`);
      lectura.set([
        ['eventos recibidos', `${vistos.filter((q) => !q.cierre).length} de ${texto.length}`],
        ['alerta', alertaIdx >= 0 ? (vistos[alertaIdx].cierre ? 'al cierre del caso' : `en el evento ${alertaIdx + 1} («${vistos[alertaIdx].act}»)`) : 'ninguna'],
        ['fichas faltantes + sobrantes', String(ultimo ? ultimo.cum : 0)],
        ['desviación real', real < 0 ? 'ninguna' : `en el ${etiq(real)}`],
        ['retraso de detección', alertaIdx >= 0 && real >= 0 ? `${Math.max(0, alertaIdx - real)} evento(s)` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: umbral, falsos positivos y retraso ---------- */

  function desviar(t, rnd) {
    const tipo = Math.floor(rnd() * 4), i = Math.floor(rnd() * t.length);
    if (tipo === 0) return t.slice(0, i) + t.slice(i + 1);
    if (tipo === 1) return t.slice(0, i + 1) + t.slice(i);
    if (tipo === 2) return t.slice(0, i) + 'x' + t.slice(i);
    return i + 1 < t.length ? t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2) : t;
  }

  function montarUmbral(cuerpo) {
    let nEnt = 4, tasa = 0.3, umbral = 1, semilla = 1, resultado = [], casos = [], red = null, plano = null, hover = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos de entrenamiento', min: 2, max: 40, valor: nEnt, alCambiar: (v) => { nEnt = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos realmente desviados', min: 5, max: 60, valor: tasa * 100, formato: (v) => `${v} %`, alCambiar: (v) => { tasa = v / 100; calcular(); } });
    const rU = ctl.rango({ etiqueta: 'Umbral de alerta (fichas)', min: 1, max: 5, valor: umbral, alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.boton('Nuevo flujo', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'precisión: alertas que eran desviaciones reales', forma: 'linea' },
      { color: C.s2, texto: 'cobertura: desviaciones reales que alertaron', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se vigilan 80 casos con un modelo aprendido de pocos ejemplos. Con pocos casos de entrenamiento, el modelo no conoce todos los órdenes legítimos y lanza falsos positivos; subir el umbral los calla, pero deja pasar desviaciones leves y retrasa las alertas. Pase el cursor sobre el gráfico para ver cada umbral.');

    function calcular() {
      const ent = P.simular(ARBOL, nEnt, semilla * 17 + nEnt, {});
      red = P.alfa(ent).red;
      const rnd = VIZ.semilla(semilla * 977 + 3);
      casos = P.simular(ARBOL, 80, semilla * 101 + 5, {}).map((c) => {
        let t = P.trazaDe(c).join('');
        if (rnd() < tasa) t = desviar(t, rnd);
        const desviado = !VALIDAS.includes(t), cum = reproducir(red, [...t]).map((p) => p.cum);
        return { t, desviado, dev: indiceReal(t), cum };
      });
      resultado = [1, 2, 3, 4, 5].map((k) => {
        let tp = 0, fp = 0, fn = 0, retraso = 0;
        for (const c of casos) {
          const idx = c.cum.findIndex((v) => v >= k);
          if (idx >= 0 && c.desviado) { tp++; retraso += Math.max(0, idx - c.dev); } else if (idx >= 0) fp++; else if (c.desviado) fn++;
        }
        return { k, tp, fp, fn, prec: tp + fp ? tp / (tp + fp) : NaN, cob: tp + fn ? tp / (tp + fn) : NaN, ret: tp ? retraso / tp : NaN };
      });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0.7, xmax: 5.3, ymin: 0, ymax: 1.05 }, { etiquetaX: 'umbral de alerta (fichas faltantes + sobrantes)', etiquetaY: 'proporción', ticksX: [1, 2, 3, 4, 5], ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      ctx.save();
      ctx.fillStyle = VIZ.alfa(C.neutro, 0.7);
      ctx.fillRect(plano.sx(umbral - 0.3), plano.y1, plano.sx(umbral + 0.3) - plano.sx(umbral - 0.3), plano.y0 - plano.y1);
      ctx.restore();
      plano.ejes();
      VIZ.trazar(ctx, plano, resultado.map((r) => [r.k, r.prec]), C.s1, 2);
      VIZ.trazar(ctx, plano, resultado.map((r) => [r.k, r.cob]), C.s2, 2);
      for (const r of resultado) {
        if (Number.isFinite(r.prec)) VIZ.marcador(ctx, plano.sx(r.k), plano.sy(r.prec), C.s1, r.k === umbral ? 6 : 4);
        if (Number.isFinite(r.cob)) VIZ.marcador(ctx, plano.sx(r.k), plano.sy(r.cob), C.s2, r.k === umbral ? 6 : 4, 1);
      }
      const r = resultado[umbral - 1];
      registro.textContent = `Con umbral ${umbral}: ${r.tp + r.fp} alertas sobre 80 casos. De ellas, ${r.fp} fueron falsos positivos (casos legítimos que el modelo aprendido no reconoce) y se dejaron pasar ${r.fn} desviaciones reales.`;
      lectura.set([
        ['verdaderos positivos', String(r.tp)], ['falsos positivos', String(r.fp)], ['desviaciones no detectadas', String(r.fn)],
        ['precisión', Number.isFinite(r.prec) ? VIZ.fmt(r.prec, 2) : '—'], ['cobertura', Number.isFinite(r.cob) ? VIZ.fmt(r.cob, 2) : '—'],
        ['retraso medio de detección', Number.isFinite(r.ret) ? `${VIZ.fmt(r.ret, 2)} eventos` : '—'],
      ]);
    }
    lienzo.alDibujar = () => red && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const k = Math.min(5, Math.max(1, Math.round(plano.ix(x)))), r = resultado[k - 1];
      tip.mostrar(x, y, `umbral <b>${k}</b>` + VIZ.filaTooltip(C.s1, 'precisión', Number.isFinite(r.prec) ? VIZ.fmt(r.prec, 2) : '—') + VIZ.filaTooltip(C.s2, 'cobertura', Number.isFinite(r.cob) ? VIZ.fmt(r.cob, 2) : '—')
        + `<div>VP <b>${r.tp}</b> · FP <b>${r.fp}</b> · FN <b>${r.fn}</b></div><div>retraso <b>${Number.isFinite(r.ret) ? VIZ.fmt(r.ret, 2) : '—'}</b> ev.</div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (plano && plano.dentro(x, y)) { umbral = Math.min(5, Math.max(1, Math.round(plano.ix(x)))); rU.valor = umbral; dibujar(); }
    });
    calcular();
  }

  VIZ.registrarTema('online-deviation-detection', {
    intro: String.raw`
      <p>Descubrir en el informe del mes que un caso se saltó una aprobación es útil, pero llega tarde. La <strong>detección en línea de desviaciones</strong>
      revisa cada evento en cuanto llega y levanta una alerta mientras el caso todavía puede corregirse: se detiene un pago, se avisa al responsable, se repite un paso.</p>
      <p>La técnica es la reproducción de fichas hecha <em>incrementalmente</em>: se guarda el marcado de cada caso abierto y, con cada evento, se intenta disparar la transición
      correspondiente. Si no está habilitada, se registra la ficha que faltaba y se sigue. El umbral de alerta decide cuántas anomalías se toleran antes de molestar a alguien.</p>`,
    visualizaciones: [
      {
        titulo: 'Reproducción incremental con alertas',
        descripcion: 'Envíe los eventos de un caso uno a uno y vea la alerta aparecer. Pruebe «Se omite c»: nada en el flujo avisa que c no ocurrió; la alerta salta recién cuando llega d y su plaza de entrada está vacía. Luego pruebe el orden paralelo acbef, que es legítimo y no alerta.',
        montar: montarEventos,
      },
      {
        titulo: 'Umbral, falsos positivos y retraso',
        descripcion: 'Con pocos casos de entrenamiento y umbral 1 verá falsos positivos. Suba los casos de entrenamiento para que el modelo conozca todos los órdenes válidos, o suba el umbral y observe cómo cae la cobertura.',
        montar: montarUmbral,
      },
    ],
    teoria: String.raw`
      <h2>Reproducción incremental</h2>
      <p>Sea \(N\) una red de Petri con marcado inicial \(m_0\) y \(\sigma=\langle a_1,\dots,a_n\rangle\) la traza de un caso. Para cada caso abierto se guarda un marcado
      \(m\) y un contador de anomalías \(\delta\). Al llegar el evento \(a\), con transición \(t\) etiquetada \(a\) y preconjunto \(\bullet t\):</p>
      <pre><code>si no existe t con etiqueta a:  δ ← δ + 1                  # actividad desconocida
sino:
    para cada plaza p en •t con m(p) = 0:
        m(p) ← 1;  δ ← δ + 1                          # ficha faltante, creada artificialmente
    disparar t:  m ← m − •t + t•
    si δ ≥ umbral y aún no se alertó: alertar(caso, a)</code></pre>
      <p>Al cerrar el caso se añade la comprobación final: si la plaza «fin» no tiene ficha, \(\delta\) crece en 1, y cada ficha que sobra en una plaza intermedia suma 1. Un caso
      conforme termina con \(\delta=0\). Cada evento cuesta \(O(|\bullet t|+|t\bullet|)\), independiente del largo del caso, y por eso la técnica sirve para flujos grandes.</p>
      <h2>Retraso de detección</h2>
      <p>Sea \(d\) el primer índice tal que \(\langle a_1,\dots,a_d\rangle\) ya no es prefijo de ningún comportamiento del modelo. Ninguna técnica basada en prefijos puede alertar antes del evento
      \(d\), y puede hacerlo después: omitir una actividad produce un prefijo todavía válido que solo se contradice cuando llega la siguiente. El <em>retraso</em> es
      \(\text{ret}=i_{\text{alerta}}-d\ge 0\). Si el prefijo es válido pero incompleto, la desviación recién existe al cerrar el caso.</p>
      <h2>Falsos positivos y umbral</h2>
      <p>Para un umbral \(k\), con VP, FP y FN los casos con alerta correcta, alerta sobre un caso legítimo y desviación sin alerta:</p>
      \[ \text{precisión}(k)=\frac{VP}{VP+FP},\qquad \text{cobertura}(k)=\frac{VP}{VP+FN}. \]
      <p>Al subir \(k\), las alertas exigen más evidencia: la precisión sube y la cobertura baja. Los falsos positivos tienen dos fuentes: ruido en los datos y, sobre todo, un
      <em>modelo incompleto</em>. Un modelo descubierto con pocos casos no conoce todos los órdenes legítimos, de modo que casos buenos «desvían» respecto del modelo, no del proceso.
      Por eso conviene validar el modelo con <a href="tema.html?id=fitness-precision">fitness y precisión</a> antes de usarlo como vigilante.</p>
      <div class="recuadro">Una alerta no dice qué hacer: la causa puede ser un error de registro, un caso excepcional legítimo o un fraude. El umbral es una decisión de costo: ¿cuánto cuesta
      una alarma falsa frente a una desviación que pasa inadvertida?</div>
      <h2>Conexiones</h2>
      <p>La reproducción es la de <a href="tema.html?id=token-based-replay">Token-Based Replay</a>; si se necesita saber <em>qué</em> se omitió, y no solo que algo falló, se usan
      <a href="tema.html?id=alignments">alineamientos</a>, más costosos. El marco general está en <a href="tema.html?id=operational-support">Operational Support</a>, y los resultados
      acumulados alimentan el <a href="tema.html?id=deviation-analysis">análisis de desviaciones</a> offline.</p>`,
  });
})();
