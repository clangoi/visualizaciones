(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Proceso de referencia (a Recibir, b Verificar, c Cotizar, d Aprobar, e Rechazar, f Archivar):
  // a, luego b y c en paralelo, luego d o e, y por último f.
  const MUNDO = P.sec(P.act('a'), P.y(P.act('b'), P.act('c')), P.xor([P.act('d'), P.act('e')]), P.act('f'));
  const RED = P.alfa(P.logSimple([['abcdf', 4], ['acbdf', 3], ['abcef', 2], ['acbef', 1]])).red;
  const POS = P.posDeRed(RED);
  const MODELO = ['abcdf', 'acbdf', 'abcef', 'acbef'];
  const ACTS = 'abcdef';
  const GLOSARIO = 'a Recibir · b Verificar · c Cotizar · d Aprobar · e Rechazar · f Archivar';

  // Alineamiento óptimo (movimientos síncronos, de registro «l» y de modelo «m», todos de costo 1 salvo el síncrono).
  function alinear(tr, w) {
    const n = tr.length, m = w.length;
    const D = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) D[i][0] = i;
    for (let j = 1; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        let b = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1);
        if (tr[i - 1] === w[j - 1]) b = Math.min(b, D[i - 1][j - 1]);
        D[i][j] = b;
      }
    }
    let i = n, j = m;
    const mov = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && tr[i - 1] === w[j - 1] && D[i][j] === D[i - 1][j - 1]) { mov.push({ t: 's', a: tr[i - 1] }); i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { mov.push({ t: 'l', a: tr[i - 1] }); i--; }
      else { mov.push({ t: 'm', a: w[j - 1] }); j--; }
    }
    return { costo: D[n][m], mov: mov.reverse() };
  }
  function mejor(tr) {
    let best = null;
    for (const w of MODELO) { const r = alinear(tr, w); if (!best || r.costo < best.costo) best = { ...r, w }; }
    return best;
  }

  /* ---------- Fig. 1: mapa de desviaciones sobre el modelo ---------- */

  function montarMapa(cuerpo) {
    let ruido = 0.3, nCasos = 150, semilla = 6, modo = 'ambos', minimo = 0, sel = null, datos = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Mostrar', valor: modo,
      opciones: [['ambos', 'de más + omitidas'], ['mas', 'solo de más (registro)'], ['omi', 'solo omitidas (modelo)']],
      alCambiar: (v) => { modo = v; dibujar(); },
    });
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.8, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos en el registro', min: 30, max: 300, paso: 10, valor: nCasos, alCambiar: (v) => { nCasos = v; calcular(); } });
    ctl.rango({ etiqueta: 'Mostrar desde', min: 0, max: 20, valor: minimo, formato: (v) => `${v} %`, alCambiar: (v) => { minimo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'pocos casos con desviación en la actividad', forma: 'cuadro' },
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'muchos casos', forma: 'cuadro' },
      { color: C.s8, texto: 'insignia: +de más / −omitidas', forma: 'cuadro' },
      { color: C.s1, texto: 'actividad elegida (clic)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `El modelo es la red del proceso (${GLOSARIO}). Cada transición se colorea por la fracción de casos en que su alineamiento óptimo la marca como «de más» (solo en el registro) u «omitida» (solo en el modelo). Haga clic en una actividad para ver las variantes que la desvían.`);

    function calcular() {
      const log = P.simular(MUNDO, nCasos, semilla, { ruido });
      const mas = {}, omi = {}, dev = {};
      ACTS.split('').forEach((a) => { mas[a] = 0; omi[a] = 0; dev[a] = 0; });
      let conDesv = 0, costo = 0, tot = 0;
      const filas = [];
      for (const v of P.variantes(log)) {
        const r = mejor(v.traza);
        const vistos = new Set();
        r.mov.forEach((m) => { if (m.t === 'l') mas[m.a] += v.n; else if (m.t === 'm') omi[m.a] += v.n; if (m.t !== 's') vistos.add(m.a); });
        vistos.forEach((a) => { dev[a] += v.n; });
        if (r.costo) conDesv += v.n;
        costo += r.costo * v.n; tot += v.n;
        filas.push({ v, r, set: vistos });
      }
      datos = { mas, omi, dev, conDesv, costo, tot, filas };
      sel = null;
      dibujar();
    }
    const valor = (a) => (modo === 'mas' ? datos.mas[a] : modo === 'omi' ? datos.omi[a] : datos.mas[a] + datos.omi[a]);
    function dibujar() {
      if (!datos) return;
      lienzo.limpiar();
      const mx = Math.max(1, ...ACTS.split('').map(valor));
      const visible = (a) => 100 * valor(a) / datos.tot >= minimo && valor(a) > 0;
      const { nodos, aristas } = P.nodosDeRed(RED, {}, {
        trans: (t) => {
          const a = t.nombre, v = valor(a);
          if (!visible(a)) return { anillo: sel === a ? C.s1 : null };
          const ins = modo === 'ambos' ? `${datos.mas[a] ? '+' + datos.mas[a] : ''}${datos.mas[a] && datos.omi[a] ? ' ' : ''}${datos.omi[a] ? '−' + datos.omi[a] : ''}` : (modo === 'mas' ? '+' : '−') + v;
          return { relleno: VIZ.css(VIZ.enRampa(0.15 + 0.85 * v / mx)), colorTexto: v / mx > 0.45 ? C.sobre : C.tinta, anillo: sel === a ? C.s1 : null, insignia: ins, colorInsignia: C.s8 };
        },
      });
      geo = P.dibujarGrafo(lienzo, nodos, aristas, POS);
      const top = ACTS.split('').sort((x, z) => valor(z) - valor(x))[0];
      lectura.set([
        ['casos con desviación', `${datos.conDesv} de ${datos.tot}`],
        ['costo medio por caso', VIZ.fmt(datos.costo / datos.tot, 3)],
        ['de más / omitidas', `${ACTS.split('').reduce((s, a) => s + datos.mas[a], 0)} / ${ACTS.split('').reduce((s, a) => s + datos.omi[a], 0)}`],
        ['actividad más desviada', valor(top) ? top : '—'],
      ]);
      if (!sel) registro.textContent = datos.conDesv ? `Diagnóstico: el ${VIZ.fmt(100 * datos.conDesv / datos.tot, 3)} % de los casos se desvía; la actividad más afectada es «${top}». Haga clic en una actividad para ver las variantes responsables.` : 'Ningún caso se desvía: el registro cabe por completo en el modelo.';
      else {
        const ej = datos.filas.filter((f) => f.set.has(sel)).sort((x, z) => z.v.n - x.v.n).slice(0, 3);
        registro.textContent = ej.length
          ? `Actividad «${sel}»: ${datos.dev[sel]} caso(s) afectados (${datos.mas[sel]} de más, ${datos.omi[sel]} omitida). Variantes principales: ${ej.map((f) => `«${f.v.clave.replace(/›/g, '')}» (${f.v.n}) → alineada con «${f.r.w}»`).join('; ')}.`
          : `Actividad «${sel}»: no hay casos con desviación en ella.`;
      }
    }
    lienzo.alDibujar = dibujar;
    const sobre = (ev) => { const { x, y } = lienzo.posicion(ev); const n = geo ? P.nodoEn(geo, x, y) : null; return { x, y, n: n && n.tipo === 'trans' ? n : null }; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, n } = sobre(ev);
      if (!n || !datos) return tip.ocultar();
      const a = n.etiqueta;
      tip.mostrar(x, y, `actividad <b>${a}</b>${VIZ.filaTooltip(C.s8, 'de más', datos.mas[a])}${VIZ.filaTooltip(C.s2, 'omitida', datos.omi[a])}casos afectados <b>${datos.dev[a]}</b> (${VIZ.fmt(100 * datos.dev[a] / datos.tot, 3)} %)`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const { n } = sobre(ev); sel = n && n.etiqueta !== sel ? n.etiqueta : null; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: reglas de negocio ---------- */

  const A = { reg: 'Registrar pedido', ver: 'Verificar stock', prep: 'Preparar envío', fac: 'Emitir factura', cob: 'Cobrar al contado', des: 'Despachar' };
  const REGLAS = [
    { id: 'R1', texto: 'Cobrar antes de despachar', viola: (t) => t.includes(A.des) && !(t.includes(A.cob) && t.indexOf(A.cob) < t.indexOf(A.des)) },
    { id: 'R2', texto: 'Facturar antes de cobrar', viola: (t) => t.includes(A.cob) && !(t.includes(A.fac) && t.indexOf(A.fac) < t.indexOf(A.cob)) },
    { id: 'R3', texto: 'Verificar antes de preparar', viola: (t) => t.includes(A.prep) && !(t.includes(A.ver) && t.indexOf(A.ver) < t.indexOf(A.prep)) },
    { id: 'R4', texto: 'Empezar con Registrar', viola: (t) => t[0] !== A.reg },
    { id: 'R5', texto: 'Terminar con Despachar', viola: (t) => t[t.length - 1] !== A.des },
  ];

  function montarReglas(cuerpo) {
    let ruido = 0.1, presion = 0.15, semilla = 2, sel = -1, res = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presión por despachar rápido', min: 0, max: 0.5, paso: 0.05, valor: presion, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { presion = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.4, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'casos que cumplen la regla', forma: 'cuadro' },
      { color: C.s8, texto: 'casos que la incumplen', forma: 'cuadro' },
      { color: C.s1, texto: 'regla elegida (clic)', forma: 'punto' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Registro de 200 pedidos. «Presión por despachar rápido» es la fracción de pedidos en que se despacha antes de cobrar. Un mismo desvío puede romper varias reglas (despachar temprano rompe R1 y R5). Haga clic en una regla para listar casos que la incumplen.');

    function calcular() {
      const log = P.simular(P.procesos.pedidos.arbol, 200, semilla, { ruido });
      const rnd = VIZ.semilla(semilla * 7919 + 13);
      const trazas = log.map((c) => {
        const t = c.eventos.map((e) => e.act);
        if (rnd() < presion && t.includes(A.des) && t.includes(A.cob)) {
          const d = t.indexOf(A.des); t.splice(d, 1);
          t.splice(t.indexOf(A.cob), 0, A.des);
        }
        return { id: c.id, t };
      });
      const viol = REGLAS.map((r) => trazas.filter((x) => r.viola(x.t)));
      const limpios = trazas.filter((x) => !REGLAS.some((r) => r.viola(x.t))).length;
      res = { trazas, viol, limpios };
      dibujar();
    }
    function dibujar() {
      if (!res) return;
      lienzo.limpiar();
      const { ctx, ancho: W, alto: H } = lienzo;
      const izq = Math.min(190, W * 0.44), der = 58, sup = 10, fila = (H - sup - 22) / REGLAS.length;
      geo = [];
      ctx.textBaseline = 'middle';
      REGLAS.forEach((r, i) => {
        const y = sup + i * fila + fila / 2, v = res.viol[i].length, n = res.trazas.length;
        const x0 = izq, wTot = W - izq - der, wBad = wTot * v / n, h = Math.min(26, fila - 8);
        ctx.fillStyle = C.s6; ctx.fillRect(x0, y - h / 2, wTot - wBad, h);
        ctx.fillStyle = C.s8; ctx.fillRect(x0 + wTot - wBad, y - h / 2, wBad, h);
        if (i === sel) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.strokeRect(x0 - 2, y - h / 2 - 2, wTot + 4, h + 4); }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left';
        ctx.fillText(r.id, 6, y);
        ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.tinta2;
        // Texto de la regla en dos líneas si no cabe.
        const palabras = r.texto.split(' '), lin = ['', ''];
        palabras.forEach((p) => { const k = ctx.measureText(lin[0] + ' ' + p).width < izq - 40 ? 0 : 1; lin[k] += (lin[k] ? ' ' : '') + p; });
        if (lin[1]) { ctx.fillText(lin[0], 28, y - 7); ctx.fillText(lin[1], 28, y + 7); } else ctx.fillText(lin[0], 28, y);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left';
        ctx.fillText(`${VIZ.fmt(100 * v / n, 3)} %`, x0 + wTot + 4, y);
        geo.push({ y0: y - fila / 2, y1: y + fila / 2, i });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const peor = res.viol.map((v, i) => [v.length, i]).sort((a, b) => b[0] - a[0])[0];
      lectura.set([
        ['casos sin ningún incumplimiento', `${res.limpios} de ${res.trazas.length}`],
        ['incumplimientos totales', String(res.viol.reduce((s, v) => s + v.length, 0))],
        ['regla más incumplida', peor[0] ? REGLAS[peor[1]].id : '—'],
      ]);
      if (sel < 0) {
        lista.replaceChildren(VIZ.el('div', null, 'Elija una regla para ver ejemplos de casos que la incumplen.'));
        registro.textContent = peor[0] ? `Diagnóstico: la regla más incumplida es ${REGLAS[peor[1]].id} («${REGLAS[peor[1]].texto}») con ${peor[0]} caso(s). Revise las causas que la comparten con otras reglas.` : 'Todos los casos cumplen todas las reglas.';
      } else {
        const ej = res.viol[sel].slice(0, 4);
        lista.replaceChildren(...(ej.length ? ej.map((x) => VIZ.el('div', null, `${x.id}  ${x.t.map((a) => a.split(' ')[0]).join(' → ')}`)) : [VIZ.el('div', null, 'Ningún caso incumple esta regla.')]));
        const otras = REGLAS.map((r, k) => [r, k]).filter(([, k]) => k !== sel).map(([r, k]) => [r.id, res.viol[sel].filter((x) => REGLAS[k].viola(x.t)).length]).filter(([, c]) => c > 0);
        registro.textContent = `${REGLAS[sel].id} «${REGLAS[sel].texto}»: ${res.viol[sel].length} incumplimiento(s).${otras.length ? ` De ellos, también incumplen ${otras.map(([id, c]) => `${id} (${c})`).join(', ')}.` : ''}`;
      }
    }
    lienzo.alDibujar = dibujar;
    const fila = (y) => geo.findIndex((g) => y >= g.y0 && y < g.y1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = fila(y);
      if (i < 0) return tip.ocultar();
      const n = res.trazas.length, v = res.viol[i].length;
      tip.mostrar(x, y, `<b>${REGLAS[i].id}</b> ${REGLAS[i].texto}${VIZ.filaTooltip(C.s6, 'cumplen', n - v)}${VIZ.filaTooltip(C.s8, 'incumplen', v)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const i = fila(lienzo.posicion(ev).y); sel = i === sel ? -1 : i; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('deviation-analysis', {
    intro: String.raw`
      <p>Medir el fitness de un registro da un solo número; el <strong>análisis de desviaciones</strong> responde la pregunta útil: <em>dónde</em> y <em>cuántas veces</em> la realidad se aparta del modelo.
      Se alinea cada caso con el modelo, se reúnen los movimientos que no coinciden (actividades <em>de más</em> y <em>omitidas</em>) y se muestran sobre el propio modelo.</p>
      <p>También se puede comparar con reglas de negocio escritas a mano, como «hay que cobrar antes de despachar», sin necesidad de un modelo completo. En ambos casos el resultado es un
      diagnóstico: qué se incumple, con qué frecuencia y en qué casos.</p>`,
    visualizaciones: [
      {
        titulo: 'Mapa de desviaciones sobre el modelo',
        descripcion: 'Cada actividad se tiñe según los casos en que sobra o falta. Con 0 % de ruido no hay color; con 30 % aparecen manchas en las actividades centrales. Cambie «Mostrar» para separar las de más de las omitidas y use el umbral para ocultar lo poco frecuente.',
        montar: montarMapa,
      },
      {
        titulo: 'Incumplimiento de reglas de negocio',
        descripcion: 'Cinco reglas sobre un registro de pedidos. Suba la presión por despachar rápido a 50 %: R1 crece junto con R5, porque un mismo desvío (despachar antes de cobrar) rompe las dos. Con presión 0 sólo queda el ruido.',
        montar: montarReglas,
      },
    ],
    teoria: String.raw`
      <h2>Observado frente a permitido</h2>
      <p>Un modelo \(M\) define el comportamiento <em>permitido</em>, el registro \(L\) el <em>observado</em>. Una desviación es una traza \(\sigma \in L\) con \(\sigma \notin \mathcal{L}(M)\).
      Para estudiarlas hay que ir más allá del sí/no: se calcula, por cada caso, el <a href="tema.html?id=alignments">alineamiento óptimo</a> con el modelo, que descompone la desviación en movimientos:</p>
      <ul>
        <li><strong>movimiento de registro</strong> (actividad <em>de más</em> o fuera de orden): ocurrió pero el modelo no la permitía;</li>
        <li><strong>movimiento de modelo</strong> (actividad <em>omitida</em>): el modelo la exigía pero no ocurrió.</li>
      </ul>
      <h2>Agregación</h2>
      <p>Para cada actividad \(a\) y registro \(L\) con frecuencias \(f(\sigma)\):</p>
      \[ \text{más}(a) = \sum_{\sigma} f(\sigma)\,\#\{\text{mov. de registro sobre } a \text{ en } \gamma^{*}(\sigma)\}, \qquad \text{omitida}(a) = \sum_{\sigma} f(\sigma)\,\#\{\text{mov. de modelo sobre } a\}. \]
      <pre><code>para cada variante σ con f casos:
    γ ← alineamiento óptimo de σ con el modelo
    para cada movimiento no síncrono (tipo, a) de γ:
        contar[tipo][a] ← contar[tipo][a] + f
mostrar sobre el modelo: color por contar[·][a] / casos</code></pre>
      <p>Proyectar los conteos sobre el modelo es el <em>mapa de desviaciones</em>: las actividades más teñidas son los lugares donde la práctica se aparta del procedimiento. Si una actividad aparece a la vez como «de más» y «omitida»
      en el mismo caso, suele ser un <em>cambio de orden</em>, no dos errores independientes.</p>
      <h2>Reglas de negocio</h2>
      <p>Muchos controles no necesitan un modelo completo. Una regla es un predicado sobre una traza; los patrones habituales son <em>precedencia</em> («A antes de B»), <em>existencia</em> («A debe ocurrir»),
      <em>inicio</em> y <em>fin</em> («el caso comienza con A»). Para cada regla se calcula la fracción de casos que la incumplen. Una regla del tipo «pagar antes de despachar» (R1) se viola si
      <em>Despachar</em> ocurre sin un <em>Cobrar</em> previo, y la omisión de <em>Cobrar</em> también cuenta.</p>
      <h2>Diagnóstico</h2>
      <ul>
        <li>Priorice por <strong>frecuencia</strong> (cuántos casos) y por <strong>gravedad</strong> (qué regla de control rompe): una desviación rara pero grave puede importar más que una común e inofensiva.</li>
        <li>Mire las <strong>causas compartidas</strong>: varias reglas incumplidas por los mismos casos apuntan a un solo desvío de fondo.</li>
        <li>Cuando muchos casos se desvían del mismo modo, quizá no sea una infracción sino un modelo desactualizado: se corrige el modelo (vuelva a descubrirlo con un <a href="tema.html?id=process-discovery">algoritmo de descubrimiento</a>) en vez del proceso.</li>
      </ul>
      <p>Las desviaciones pueden detectarse mientras ocurren, no solo al final: vea <a href="tema.html?id=online-deviation-detection">detección en línea de desviaciones</a>. La cuantificación global sigue en <a href="tema.html?id=fitness-precision">fitness y precisión</a>, y la reproducción de fichas
      (<a href="tema.html?id=token-based-replay">token-based replay</a>) ofrece una versión más rápida y menos exacta del mismo mapa. Para saber si el desvío tiene costo en tiempo, vea <a href="tema.html?id=variant-performance">desempeño por variante</a>.</p>`,
  });
})();
