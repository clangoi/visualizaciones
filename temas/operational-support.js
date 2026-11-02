(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const ARBOL = P.procesos.reclamos.arbol;
  const horas = (v) => VIZ.fmt(v / 60, 3) + ' h';

  /* ---------- Fig. 1: casos en ejecución sobre un flujo de eventos ---------- */

  function montarFlujo(cuerpo) {
    let n = 12, semilla = 1, log = [], flujo = [], k = 0, ahora = 0, fin = 1, sel = null, msg = '', filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 6, max: 20, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos casos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 50 + n * 17 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'caso abierto (eventos recibidos)', forma: 'linea' },
      { color: C.s6, texto: 'caso cerrado (completo)', forma: 'linea' },
      { color: C.s2, texto: 'último evento de un caso abierto', forma: 'punto' },
      { color: C.apagado, texto: 'silencio desde el último evento (hasta «ahora»)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un caso; los puntos son eventos ya recibidos y la línea vertical punteada es «ahora». Haga clic en una fila para ver la traza recibida de ese caso; pase el cursor para ver su estado.');

    function iniciar() {
      log = P.simular(ARBOL, n, semilla * 13 + n, { llegada: 35, espera: 10 });
      flujo = log.flatMap((c) => c.eventos.map((e) => ({ caso: c, e }))).sort((a, b) => a.e.fin - b.e.fin);
      fin = flujo[flujo.length - 1].e.fin;
      k = 0; ahora = 0; sel = null;
      msg = 'Todavía no ha llegado ningún evento. Pulse «Un paso» para recibir el primero del flujo.';
      lienzo.ajustar(true);
      return (function* () {
        while (k < flujo.length) {
          const ev = flujo[k++];
          ahora = ev.e.fin;
          msg = `Llega el evento ${k} de ${flujo.length}: el caso ${ev.caso.id} completó «${ev.e.act}» (${ev.e.recurso}). El monitor actualiza solo el estado de ese caso.`;
          yield;
        }
        msg = 'El flujo terminó: ya no hay casos abiertos y el análisis online coincide con el offline.';
      })();
    }

    const X0 = 44, Y0 = 26, FILA = 17;
    const sx = (t) => X0 + (t / (fin * 1.02)) * (lienzo.ancho - X0 - 14);

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      if (!log.length) return;
      const vistos = new Map();
      for (let j = 0; j < k; j++) vistos.set(flujo[j].caso.id, (vistos.get(flujo[j].caso.id) || 0) + 1);
      ctx.font = VIZ.fuente(10);
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const t of VIZ.ticks(0, fin, Math.max(2, Math.floor((lienzo.ancho - X0) / 80)))) {
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(sx(t)) + 0.5, Y0 - 4); ctx.lineTo(Math.round(sx(t)) + 0.5, Y0 + n * FILA); ctx.stroke();
        ctx.fillText(VIZ.fmt(t / 60, 3) + ' h', sx(t), 4);
      }
      filas = [];
      log.forEach((c, idx) => {
        const m = vistos.get(c.id) || 0;
        const y = Y0 + idx * FILA + FILA / 2;
        if (c.id === sel) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y - FILA / 2, lienzo.ancho, FILA); }
        ctx.fillStyle = m ? C.tinta2 : C.inactivo; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(c.id, 6, y);
        if (!m) return;
        const ev = c.eventos.slice(0, m), cerrado = m === c.eventos.length;
        const col = cerrado ? C.s6 : C.s1;
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(sx(ev[0].ini), y); ctx.lineTo(sx(ev[m - 1].fin), y); ctx.stroke();
        if (!cerrado && ahora > ev[m - 1].fin) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(sx(ev[m - 1].fin), y); ctx.lineTo(sx(ahora), y); ctx.stroke(); ctx.setLineDash([]);
        }
        ev.forEach((e, i) => VIZ.marcador(ctx, sx(e.fin), y, !cerrado && i === m - 1 ? C.s2 : col, 3.5));
        filas.push({ idx, c, m, cerrado });
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(sx(ahora) + 0.5, Y0 - 6); ctx.lineTo(sx(ahora) + 0.5, Y0 + n * FILA); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = ahora > fin * 0.85 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(' ahora ', sx(ahora), lienzo.alto - 3);

      const cerrados = filas.filter((f) => f.cerrado), abiertos = filas.filter((f) => !f.cerrado);
      registro.textContent = sel
        ? `Traza recibida de ${sel}: ${P.trazaDe({ eventos: log.find((c) => c.id === sel).eventos.slice(0, vistos.get(sel) || 0) }).join(' › ') || '(aún sin eventos)'}`
        : msg;
      lectura.set([
        ['eventos recibidos', `${k} de ${flujo.length}`],
        ['casos abiertos (solo online)', String(abiertos.length)],
        ['casos cerrados (visibles offline)', String(cerrados.length)],
        ['duración media de los cerrados', cerrados.length ? P.dur(P.media(cerrados.map((f) => f.c.eventos[f.m - 1].fin - f.c.eventos[0].ini))) : '—'],
        ['tiempo transcurrido medio de los abiertos', abiertos.length ? P.dur(P.media(abiertos.map((f) => ahora - f.c.eventos[0].ini))) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const filaEn = (y) => { const i = Math.floor((y - Y0) / FILA); return i >= 0 && i < n ? log[i] : null; };
    lienzo.canvas.addEventListener('click', (ev) => {
      const c = filaEn(lienzo.posicion(ev).y);
      sel = c && sel !== c.id ? c.id : null;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = filaEn(y), f = c && filas.find((q) => q.c === c);
      if (!f) return tip.ocultar();
      const u = f.c.eventos[f.m - 1];
      tip.mostrar(x, y, `<b>${c.id}</b> · ${f.cerrado ? 'cerrado' : 'abierto'}<br>última actividad: ${u.act}<br>eventos recibidos: <b>${f.m}</b> de ${c.eventos.length}<br>${f.cerrado ? 'duración' : 'transcurrido'}: <b>${P.dur((f.cerrado ? u.fin : ahora) - c.eventos[0].ini)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: detectar, predecir y recomendar sobre un caso abierto ---------- */

  // Estadísticas de un registro de referencia: tiempo restante tras cada actividad y tras cada decisión (a → b).
  function estadisticas(ref) {
    const porAct = new Map(), porPar = new Map(), pares = new Set(), inicios = new Set();
    const mete = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const c of ref) {
      const fin = c.eventos[c.eventos.length - 1].fin;
      inicios.add(c.eventos[0].act);
      c.eventos.forEach((e, i) => {
        mete(porAct, e.act, fin - e.fin);
        if (i + 1 < c.eventos.length) {
          const s = c.eventos[i + 1].act;
          pares.add(e.act + '\u0001' + s);
          mete(porPar, e.act + '\u0001' + s, fin - e.fin);
        }
      });
    }
    return { porAct, porPar, pares, inicios };
  }

  // En pantallas angostas se acortan las etiquetas para que tres nodos quepan en una capa.
  const CORTO = { 'Aprobar compensación': 'Aprobar', 'Rechazar reclamo': 'Rechazar', 'Pedir información': 'Pedir info', 'Recibir reclamo': 'Recibir' };

  function montarFunciones(cuerpo) {
    const ref = P.simular(ARBOL, 300, 11, { llegada: 30, espera: 10 });
    const ST = estadisticas(ref);
    const acts = P.actividades(ref);
    const aristasRef = [...ST.pares].map((p) => p.split('\u0001'));
    const pos = P.disponer(acts, aristasRef);
    const conteo = new Map(P.dfg(ref).aristas.map((e) => [e.de + '\u0001' + e.a, e.n]));

    let semilla = 4, desviar = false, k = 3, caso = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const rK = ctl.rango({ etiqueta: 'Eventos ya ocurridos', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Inyectar desviación (omitir «Clasificar»)', valor: desviar, alCambiar: (v) => { desviar = v; nuevoCaso(false); } });
    ctl.boton('Nuevo caso', () => { semilla++; nuevoCaso(true); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w >= 640 ? 340 : 500) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'recorrido del caso', forma: 'linea' },
      { color: C.s2, texto: 'actividad actual', forma: 'punto' },
      { color: C.s6, texto: 'recomendación (menor tiempo restante esperado)', forma: 'linea' },
      { color: C.s8, texto: 'salto que el modelo no permite (alerta)', forma: 'linea' },
      { color: C.eje, texto: 'transición del modelo (etiqueta: casos de referencia)', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre «Eventos ya ocurridos» para avanzar el caso en vivo. Las tres funciones usan el mismo modelo, aprendido de 300 casos históricos: detectar compara con las transiciones permitidas, predecir promedia lo que tardaron los casos que estuvieron en la misma actividad, y recomendar elige la salida con menor tiempo restante esperado.');

    function nuevoCaso(reiniciarK) {
      caso = P.simular(ARBOL, 1, semilla * 7 + 3, { llegada: 30, espera: 10 })[0];
      if (desviar) caso = { id: caso.id, eventos: caso.eventos.filter((e, i) => i !== 1) };
      rK.max = caso.eventos.length;
      if (reiniciarK) k = Math.min(3, caso.eventos.length);
      k = Math.min(k, caso.eventos.length);
      rK.valor = k;
      dibujar();
    }
    const vertical = () => lienzo.ancho < 640;
    function dibujar() {
      if (!caso) return;
      lienzo.limpiar();
      const ev = caso.eventos.slice(0, k), traza = ev.map((e) => e.act), actual = traza[k - 1];
      // Detectar: primera violación del modelo en el prefijo.
      let viol = -1;
      if (!ST.inicios.has(traza[0])) viol = 0;
      for (let i = 1; viol < 0 && i < traza.length; i++) if (!ST.pares.has(traza[i - 1] + '\u0001' + traza[i])) viol = i;
      // Predecir.
      const pasado = ST.porAct.get(actual) || [];
      const real = caso.eventos[caso.eventos.length - 1].fin - ev[k - 1].fin;
      const medio = P.media(pasado), lo = P.cuantil(pasado, 0.1), hi = P.cuantil(pasado, 0.9);
      // Recomendar.
      const cand = [...ST.pares].filter((p) => p.startsWith(actual + '\u0001')).map((p) => ({ sig: p.split('\u0001')[1], rest: P.media(ST.porPar.get(p)), n: conteo.get(p) || 0 }));
      cand.sort((a, b) => a.rest - b.rest);
      const mejor = cand.length > 1 ? cand[0] : null;

      const nodosVis = new Set(traza);
      const estrecho = vertical();
      const nodos = acts.map((a) => ({
        id: a, tipo: 'act', etiqueta: estrecho ? (CORTO[a] || a) : a,
        relleno: a === actual ? VIZ.alfa(C.s2, 0.2) : nodosVis.has(a) ? VIZ.alfa(C.s1, 0.12) : C.superficie,
        borde: a === actual ? C.s2 : nodosVis.has(a) ? C.s1 : C.tinta2,
        insignia: a === actual ? 'ahora' : null, colorInsignia: C.s2,
      }));
      const recorrido = new Set(); for (let i = 1; i < traza.length; i++) recorrido.add(traza[i - 1] + '\u0001' + traza[i]);
      const aristas = aristasRef.map(([de, a]) => {
        const c = conteo.get(de + '\u0001' + a) || 0, key = de + '\u0001' + a;
        const rec = mejor && de === actual && a === mejor.sig;
        return { de, a, etiqueta: c, ancho: rec ? 4 : recorrido.has(key) ? 3.5 : 1.5, color: rec ? C.s6 : recorrido.has(key) ? C.s1 : C.eje };
      });
      if (viol > 0) {
        const de = traza[viol - 1], a = traza[viol];
        aristas.push({ de, a, ancho: 3.5, color: C.s8, guiones: true, curva: 30, etiqueta: '¡alerta!', colorTexto: C.s8 });
      }
      const v = vertical();
      const p = {}; for (const id of acts) p[id] = v ? { x: pos[id].y, y: pos[id].x } : pos[id];
      geo = P.dibujarGrafo(lienzo, nodos, aristas, p, { fuente: 10, margenX: v ? 64 : 70, margenY: 34 });

      lista.replaceChildren(...(cand.length ? cand.map((c, i) => VIZ.el('div', null,
        VIZ.el('span', { style: { color: mejor && i === 0 ? C.s6 : C.tinta2, fontWeight: mejor && i === 0 ? '600' : null } },
          `${mejor && i === 0 ? '★ ' : '  '}${c.sig}`), `   restante esperado ${P.dur(c.rest)}   (${c.n} casos de referencia)`))
        : [VIZ.el('div', null, 'Esta es la última actividad del modelo: no hay decisión que recomendar.')]));
      registro.textContent = viol >= 0
        ? `ALERTA: en el evento ${viol + 1} el caso pasó de «${traza[Math.max(0, viol - 1)]}» a «${traza[viol]}», salto que ningún caso histórico hizo. Detectar solo necesita el prefijo.`
        : `Sin alertas: los ${k} eventos recibidos siguen transiciones vistas en el historial. Quedan por delante ${caso.eventos.length - k} eventos.`;
      lectura.set([
        ['detectar', viol >= 0 ? `desviación en el evento ${viol + 1}` : 'conforme'],
        ['predecir: restante esperado', P.dur(medio)],
        ['intervalo 10–90 %', `${P.dur(lo)} a ${P.dur(hi)}`],
        ['restante real (se sabrá al cerrar)', P.dur(real)],
        ['recomendar', mejor ? `«${mejor.sig}»` : 'sin alternativas'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    nuevoCaso(true);
  }

  VIZ.registrarTema('operational-support', {
    intro: String.raw`
      <p>El análisis clásico de procesos es <em>offline</em>: se extrae un registro de casos ya terminados, se descubre o se verifica un modelo y se
      sacan conclusiones para el futuro. El <strong>soporte operacional</strong> (<em>operational support</em>) hace lo contrario: trabaja sobre
      <em>casos abiertos</em>, a medida que llegan los eventos, para influir en lo que todavía puede cambiar.</p>
      <p>Se distinguen tres funciones: <strong>detectar</strong> que un caso se sale del modelo, <strong>predecir</strong> cómo terminará
      (cuánto falta, qué viene) y <strong>recomendar</strong> la próxima acción. Las tres comparten una idea: del caso solo se conoce un prefijo de su traza,
      y se lo contrasta con lo aprendido de los casos completos.</p>`,
    visualizaciones: [
      {
        titulo: 'Casos abiertos en un flujo de eventos',
        descripcion: 'Reproduzca el flujo y observe cuántos casos están abiertos en cada momento: son invisibles para un análisis offline. Compare la duración media de los cerrados con el tiempo transcurrido de los abiertos.',
        montar: montarFlujo,
      },
      {
        titulo: 'Detectar, predecir y recomendar',
        descripcion: 'Avance el caso en vivo y vea qué dice cada función con solo el prefijo. Active la desviación: la alerta salta en el primer salto imposible. Cambie de caso y vea cómo la recomendación depende de la actividad actual.',
        montar: montarFunciones,
      },
    ],
    teoria: String.raw`
      <h2>Offline frente a online</h2>
      <p>Sea \(\sigma = \langle e_1,\dots,e_n\rangle\) la traza completa de un caso y \(\sigma_k=\langle e_1,\dots,e_k\rangle\) su <em>prefijo</em>
      de longitud \(k\). El análisis offline usa solo trazas completas \(\sigma\); el online recibe un flujo de eventos y, en el instante \(t\), conoce
      \(\sigma_{k(t)}\) para cada caso abierto. Esa diferencia tiene un efecto estadístico: si se calcula la duración media solo con los casos
      <em>cerrados</em> en \([0,t]\), se subestima, porque los casos largos todavía no terminaron (sesgo de supervivencia). La figura 1 lo muestra con la
      comparación entre «duración media de los cerrados» y el tiempo transcurrido de los abiertos.</p>
      <h2>Las tres funciones</h2>
      <table>
        <tr><th>Función</th><th>Entrada</th><th>Salida</th><th>Ejemplo</th></tr>
        <tr><td>Detectar</td><td>\(\sigma_k\) y un modelo \(M\)</td><td>¿\(\sigma_k\) es prefijo de algún comportamiento de \(M\)?</td><td>alerta de salto no permitido</td></tr>
        <tr><td>Predecir</td><td>\(\sigma_k\) y un historial</td><td>\(\hat y = f(\sigma_k)\)</td><td>tiempo restante, próxima actividad</td></tr>
        <tr><td>Recomendar</td><td>\(\sigma_k\), historial y un objetivo</td><td>acción \(a^\star\)</td><td>la salida que minimiza el tiempo esperado</td></tr>
      </table>
      <h2>Esquema de un monitor</h2>
      <pre><code>estado ← diccionario vacío            # caso → prefijo recibido
para cada evento (caso, actividad, instante) del flujo:
    estado[caso] ← estado[caso] · actividad
    si el caso es nuevo: abrirlo
    alerta ← detectar(estado[caso], modelo)
    restante ← predecir(estado[caso], historial)
    acción ← recomendar(estado[caso], historial, objetivo)
    notificar si alerta o si restante supera el plazo
    si actividad es final: cerrar el caso y archivarlo</code></pre>
      <h2>Ejemplo de la figura 2</h2>
      <p>Para la actividad actual \(a\), el tiempo restante esperado es el promedio histórico de lo que faltó tras \(a\):</p>
      \[ \hat r(a) = \frac{1}{|H_a|}\sum_{(c,i)\in H_a}\bigl(t_{\text{fin}}(c) - t_i(c)\bigr),\qquad H_a=\{(c,i): a_i(c)=a\}. \]
      <p>Para recomendar se condiciona además a la actividad siguiente \(b\): \(\hat r(a\to b)\) se promedia solo sobre los pares con \(a_{i+1}=b\) y se elige
      \(b^\star=\arg\min_b \hat r(a\to b)\). Es una recomendación <em>descriptiva</em>: la correlación con un menor tiempo restante no prueba que elegir \(b\) lo cause
      (casos fáciles pueden tomar el atajo), por lo que en la práctica se controla por características del caso.</p>
      <div class="recuadro">El soporte operacional exige tiempo de respuesta: el análisis tiene que terminar antes de que llegue el siguiente evento del mismo caso. Por eso se prefieren
      modelos livianos (conteos, reproducción incremental) a recalcular todo el descubrimiento en cada evento.</div>
      <h2>Conexiones</h2>
      <p>La detección incremental se desarrolla en <a href="tema.html?id=online-deviation-detection">Online Deviation Detection</a> a partir de la
      <a href="tema.html?id=token-based-replay">reproducción de fichas</a>; la predicción, en <a href="tema.html?id=remaining-time-prediction">Remaining Time Prediction</a> y
      <a href="tema.html?id=next-activity-prediction">Next Activity Prediction</a>. Los tiempos de referencia provienen de métricas como las de
      <a href="tema.html?id=cycle-time-throughput">Cycle Time and Throughput</a>.</p>`,
  });
})();
