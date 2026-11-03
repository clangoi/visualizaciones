(function () {
  'use strict';
  const { color: C } = VIZ;
  const miles = (v) => (v < 0 ? '−' : '') + '$' + VIZ.fmt(Math.abs(v), 4) + ' mil';
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: valor esperado con escenarios ---------- */

  // p: probabilidad en el escenario base; imp: efecto en miles de dólares; m: eficacia de la gobernanza contra el riesgo.
  const ITEMS = [
    { n: 'Ahorro de costos operativos', tipo: 'op', p: 0.7, imp: 400 },
    { n: 'Mejor atención y retención', tipo: 'op', p: 0.5, imp: 300 },
    { n: 'Nuevos productos y servicios', tipo: 'op', p: 0.3, imp: 600 },
    { n: 'Sesgo y decisiones injustas', tipo: 'ri', p: 0.25, imp: -500, m: 0.7 },
    { n: 'Filtración de datos personales', tipo: 'ri', p: 0.15, imp: -900, m: 0.8 },
    { n: 'Dependencia de un proveedor', tipo: 'ri', p: 0.3, imp: -300, m: 0.5 },
    { n: 'Falta de explicabilidad', tipo: 'ri', p: 0.35, imp: -250, m: 0.6 },
    { n: 'Incumplimiento normativo', tipo: 'ri', p: 0.2, imp: -700, m: 0.75 },
  ];
  const ESCENARIOS = { pes: { t: 'pesimista', op: 0.6, ri: 1.4 }, base: { t: 'base', op: 1, ri: 1 }, opt: { t: 'optimista', op: 1.3, ri: 0.7 } };
  const COSTO_GOB = 300; // miles de dólares con gobernanza al 100 %

  function montarValor(cuerpo) {
    let esc = 'base', g = 0.4, activo = ITEMS.map(() => true), filas = [], hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', opciones: Object.entries(ESCENARIOS).map(([k, v]) => [k, v.t]), valor: esc, alCambiar: (v) => { esc = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Inversión en gobernanza de IA', min: 0, max: 1, paso: 0.05, valor: g, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { g = v; dibujar(); } });
    ctl.boton('Activar todo', () => { activo = ITEMS.map(() => true); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (ITEMS.length + 2) * 40 + 40 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'oportunidad (valor esperado)', forma: 'cuadro' },
      { color: C.s8, texto: 'riesgo (pérdida esperada)', forma: 'cuadro' },
      { color: C.s2, texto: 'costo de la gobernanza', forma: 'cuadro' },
      { color: C.tinta, texto: 'valor esperado neto', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es probabilidad × efecto. Haga clic en una fila para incluirla o excluirla del análisis. La gobernanza (políticas, revisión de sesgos, controles de datos) reduce la probabilidad de cada riesgo según su eficacia (con rendimientos decrecientes), pero cuesta: busque el nivel donde el valor neto es máximo.');

    const pEf = (it, gg) => {
      const e = ESCENARIOS[esc];
      return it.tipo === 'op' ? Math.min(1, it.p * e.op) : Math.min(1, it.p * e.ri) * (1 - it.m * (1 - (1 - gg) ** 2));
    };
    const neto = (gg) => ITEMS.reduce((s, it, i) => s + (activo[i] ? pEf(it, gg) * it.imp : 0), 0) - COSTO_GOB * gg;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      let acum = 0;
      filas = ITEMS.map((it, i) => {
        const v = activo[i] ? pEf(it, g) * it.imp : 0, a = acum;
        acum += v;
        return { n: it.n, ini: a, fin: acum, v, color: it.tipo === 'op' ? C.s6 : C.s8, it, i };
      });
      const costo = COSTO_GOB * g;
      filas.push({ n: 'Costo de la gobernanza', ini: acum, fin: acum - costo, v: -costo, color: C.s2, it: null });
      acum -= costo;
      filas.push({ n: 'Valor esperado neto', ini: 0, fin: acum, v: acum, color: C.tinta, it: null, total: true });
      const todos = filas.flatMap((f) => [f.ini, f.fin]).concat(0);
      const mn = Math.min(...todos), mx = Math.max(...todos), pad = (mx - mn) * 0.06 + 1;
      const izq = 8, der = 8, sup = 6, inf = 26, alto = 40;
      const sx = (v) => izq + ((v - (mn - pad)) / (mx - mn + 2 * pad)) * (W - izq - der);
      geo = { alto, sup, sx, izq };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'alphabetic';
      for (const t of VIZ.ticks(mn - pad, mx + pad, Math.max(2, Math.floor(W / 90)))) {
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(sx(t)) + 0.5, sup); ctx.lineTo(Math.round(sx(t)) + 0.5, sup + filas.length * alto); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.fillText(VIZ.fmt(t), sx(t), sup + filas.length * alto + 14);
      }
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(0), sup); ctx.lineTo(sx(0), sup + filas.length * alto); ctx.stroke();
      filas.forEach((f, k) => {
        const y = sup + k * alto, excl = f.it && !activo[f.i];
        ctx.font = VIZ.fuente(11, f.total ? 700 : 400); ctx.fillStyle = excl ? C.apagado : C.tinta; ctx.textAlign = 'left';
        ctx.fillText(f.n + (excl ? ' (excluido)' : ''), izq, y + 13);
        ctx.fillStyle = excl ? C.tenue : f.color;
        if (k === hover) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.75);
        const x0 = sx(Math.min(f.ini, f.fin)), w = Math.max(2, Math.abs(sx(f.fin) - sx(f.ini)));
        ctx.beginPath(); ctx.roundRect(x0, y + 18, w, 15, 3); ctx.fill();
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta2;
        const derecha = x0 + w + 6 + 70 < W;
        ctx.textAlign = derecha ? 'left' : 'right';
        ctx.fillText(excl ? '' : miles(f.v), derecha ? x0 + w + 6 : x0 - 6, y + 30);
      });
      const sin = neto(0);
      let mejor = 0, vm = -Infinity;
      for (let k = 0; k <= 20; k++) { const v = neto(k / 20); if (v > vm) { vm = v; mejor = k / 20; } }
      const riesgoTot = ITEMS.reduce((s, it, i) => s + (activo[i] && it.tipo === 'ri' ? pEf(it, g) * it.imp : 0), 0);
      registro.textContent = `Escenario ${ESCENARIOS[esc].t}: valor esperado = Σ probabilidad × efecto − costo de gobernanza = ${miles(acum + costo)} − ${miles(costo)} = ${miles(acum)}.`;
      lectura.set([
        ['valor esperado neto', miles(acum)],
        ['sin gobernanza', miles(sin)],
        ['gobernanza óptima', `${Math.round(mejor * 100)} % → ${miles(vm)}`],
        ['pérdida esperada por riesgos', miles(riesgoTot)],
        ['probabilidad de algún riesgo', pct(1 - ITEMS.reduce((s, it, i) => s * (activo[i] && it.tipo === 'ri' ? 1 - pEf(it, g) : 1), 1))],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    const fila = (ev) => { const { x, y } = lienzo.posicion(ev); const k = Math.floor((y - geo.sup) / geo.alto); return { k: k >= 0 && k < filas.length ? k : -1, x, y }; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { k, x, y } = fila(ev);
      if (k !== hover) { hover = k; dibujar(); }
      if (k < 0) return tip.ocultar();
      const f = filas[k];
      if (!f.it) return tip.mostrar(x, y, `<b>${f.n}</b><br>${f.total ? 'suma de todo lo anterior' : `${Math.round(g * 100)} % de ${miles(COSTO_GOB)}`}<br>${miles(f.v)}`);
      const base = f.it.p, ef = pEf(f.it, g);
      tip.mostrar(x, y, `<b>${f.n}</b><br>probabilidad base <b>${pct(base)}</b>${f.it.tipo === 'ri' ? `<br>con escenario y gobernanza <b>${pct(ef)}</b>` : `<br>en este escenario <b>${pct(ef)}</b>`}<br>efecto <b>${miles(f.it.imp)}</b><br>esperado <b>${miles(ef * f.it.imp)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { if (!geo) return; const { k } = fila(ev); if (k >= 0 && filas[k].it) { activo[k] = !activo[k]; dibujar(); } });
    dibujar();
  }

  /* ---------- Fig. 2: curva de adopción y madurez ---------- */

  const ETAPAS = [[0, 'Exploración'], [0.05, 'Pilotos'], [0.2, 'Escala'], [0.5, 'Integración'], [0.8, 'Transformación']];
  const etapa = (a) => ETAPAS.filter((e) => a >= e[0]).pop()[1];
  const MESES = 48;

  function simular(p, q, t0, sev, tau) {
    const A = [0.01], B = [0.01];
    for (let t = 0; t < MESES; t++) {
      const sinInc = B[t] + (p + q * B[t]) * (1 - B[t]);
      B.push(Math.min(1, sinInc));
      let a = A[t];
      if (t0 > 0 && t === t0) a *= 1 - 0.5 * sev;
      const conf = t0 > 0 && t >= t0 ? 1 - sev * Math.exp(-(t - t0) / tau) : 1;
      A.push(Math.min(1, a + (p + q * a) * (1 - a) * conf));
    }
    return { A, B };
  }
  const mesDe = (s, u) => { const i = s.findIndex((v) => v >= u); return i < 0 ? null : i; };

  function montarAdopcion(cuerpo) {
    let p = 0.02, q = 0.18, t0 = 18, sev = 0.6, tau = 8, s = { A: [], B: [] }, t = 0, pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Impulso inicial (directivos, p)', min: 0.005, max: 0.06, paso: 0.005, valor: p, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { p = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Contagio entre áreas (q)', min: 0.05, max: 0.5, paso: 0.01, valor: q, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { q = v; rep.reiniciar(); } });
    const rInc = ctl.rango({ etiqueta: 'Mes del incidente (0 = ninguno)', min: 0, max: 40, paso: 1, valor: t0, formato: (v) => (v ? `mes ${v}` : 'ninguno'), alCambiar: (v) => { t0 = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Gravedad del incidente', min: 0, max: 0.9, paso: 0.05, valor: sev, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sev = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Meses para recuperar la confianza', min: 2, max: 24, paso: 1, valor: tau, alCambiar: (v) => { tau = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'áreas que usan IA (con incidente)', forma: 'linea' },
      { color: C.apagado, texto: 'trayectoria sin incidente', forma: 'linea' },
      { color: C.s8, texto: 'mes del incidente', forma: 'linea' },
      { color: C.tenue, texto: 'umbrales de madurez', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para fijar el mes del incidente. Un incidente grave (filtración, sesgo público) hace perder usuarios y frena el contagio mientras no se recupera la confianza: compare con la línea gris. Los umbrales horizontales separan las etapas de madurez.');

    function iniciar() {
      s = simular(p, q, t0, sev, tau); t = 0;
      return (function* () {
        for (t = 1; t <= MESES; t++) {
          registro.textContent = t0 && t === t0 + 1 ? `Mes ${t0}: incidente. Se pierde ${Math.round(sev * 50)} % de los usuarios y la confianza cae ${Math.round(sev * 100)} %.` : `Mes ${t}: adopción ${pct(s.A[t])} (etapa «${etapa(s.A[t])}»). Nuevos usuarios = (p + q·A)(1 − A)·confianza.`;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: 0, ymax: 1 }, { etiquetaX: 'mes', etiquetaY: 'áreas que usan IA', formatoY: (v) => `${Math.round(v * 100)} %`, margen: { der: 92 } });
      pl.ejes();
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
      ETAPAS.forEach(([u, n], i) => {
        if (i > 0) { ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.tenue; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(u)); ctx.lineTo(pl.x1, pl.sy(u)); ctx.stroke(); ctx.restore(); }
        const sig = ETAPAS[i + 1] ? ETAPAS[i + 1][0] : 1;
        ctx.fillStyle = C.apagado; ctx.textBaseline = 'middle'; ctx.fillText(n, pl.x1 + 6, pl.sy((u + sig) / 2));
      });
      VIZ.trazar(ctx, pl, s.B.map((v, i) => [i, v]), C.apagado, 2, [3, 4]);
      if (t0 > 0) { ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(t0), pl.y1); ctx.lineTo(pl.sx(t0), pl.y0); ctx.stroke(); }
      VIZ.trazar(ctx, pl, s.A.slice(0, t + 1).map((v, i) => [i, v]), C.s1, 3);
      if (t > 0 || s.A.length) VIZ.marcador(ctx, pl.sx(t), pl.sy(s.A[t] || 0), C.s1, 5);
      if (hover >= 0) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); }
      const m1 = mesDe(s.A, 0.5), m0 = mesDe(s.B, 0.5);
      lectura.set([
        ['mes', String(t)],
        ['adopción actual', pct(s.A[t] || 0)],
        ['etapa de madurez', etapa(s.A[t] || 0)],
        ['50 % de adopción (con incidente)', m1 === null ? 'no se alcanza' : `mes ${m1}`],
        ['50 % de adopción (sin incidente)', m0 === null ? 'no se alcanza' : `mes ${m0}`],
        ['retraso por el incidente', m1 === null || m0 === null ? '—' : `${m1 - m0} meses`],
      ]);
    }
    lienzo.alDibujar = () => s.A.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(MESES, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `mes <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'con incidente', hover <= t ? pct(s.A[hover]) : '—') + VIZ.filaTooltip(C.apagado, 'sin incidente', pct(s.B[hover])) + `etapa <b>${etapa(s.A[hover])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      t0 = Math.min(40, Math.max(1, Math.round(pl.ix(x))));
      rInc.valor = t0;
      rep.reiniciar();
    });
    rep.reiniciar();
  }

  VIZ.registrarTema('ai-adoption-risks', {
    intro: String.raw`
      <p>Adoptar inteligencia artificial abre <strong>oportunidades</strong> (menos costos, mejor atención, productos nuevos) y trae <strong>riesgos</strong> propios: sesgos que discriminan sin que nadie lo haya querido, datos personales expuestos, dependencia de un proveedor, modelos que no pueden explicar sus decisiones y obligaciones legales que cambian. Una decisión responsable pesa ambas cosas en lugar de mirar solo la promesa o solo el miedo.</p>
      <p>Dos ideas ordenan el análisis: el <strong>valor esperado</strong> (cada resultado ponderado por su probabilidad) y la <strong>curva de adopción</strong>, que muestra cómo se extiende el uso por la organización y cómo un incidente la frena. La gobernanza de la IA es lo que baja la probabilidad de los riesgos y acorta esas caídas, a un costo.</p>`,
    visualizaciones: [
      {
        titulo: 'Valor esperado de adoptar IA',
        descripcion: 'Cambie el escenario y la inversión en gobernanza para ver cómo se compone el valor neto. Excluya con clic una oportunidad o un riesgo para ver cuánto pesa, y busque el nivel de gobernanza que maximiza el resultado.',
        montar: montarValor,
      },
      {
        titulo: 'Curva de adopción y madurez',
        descripcion: 'Reproduzca los 48 meses de adopción y observe las etapas de madurez. Agregue un incidente grave a mitad de camino y compare con la trayectoria sin incidente: la recuperación depende de cuánto tarde la confianza en volver.',
        montar: montarAdopcion,
      },
    ],
    teoria: String.raw`
      <h2>Oportunidades y riesgos</h2>
      <table>
        <tr><th>Tema</th><th>Qué puede pasar</th><th>Cómo se reduce</th></tr>
        <tr><td>Sesgo</td><td>el modelo hereda la discriminación de los datos históricos (ver <a href="tema.html?id=algorithmic-fairness">equidad algorítmica</a>)</td><td>auditoría por grupos, datos representativos</td></tr>
        <tr><td>Privacidad</td><td>datos personales usados sin base legal o filtrados (ver <a href="tema.html?id=data-protection">protección de datos</a>)</td><td>minimización, anonimización, controles de acceso</td></tr>
        <tr><td>Dependencia</td><td>precios y condiciones que impone un proveedor único</td><td>contratos de salida, estándares abiertos</td></tr>
        <tr><td>Explicabilidad</td><td>no se puede justificar una decisión ante el cliente o el regulador (ver <a href="tema.html?id=interpretability">interpretabilidad</a>)</td><td>modelos simples donde importa, documentación</td></tr>
        <tr><td>Cumplimiento</td><td>normas de protección de datos y de uso de IA</td><td>registro de usos, evaluaciones de impacto, supervisión humana</td></tr>
      </table>
      <h2>Valor esperado</h2>
      <p>Si el resultado \(i\) tiene probabilidad \(p_i\) y efecto \(x_i\) (positivo o negativo), el valor esperado del proyecto con una inversión de gobernanza \(g \in [0,1]\) que cuesta \(K g\) es</p>
      \[ \mathbb{E}[V] = \sum_{i \in \text{oport.}} p_i x_i + \sum_{j \in \text{riesgos}} p_j \big(1 - m_j\,\varepsilon(g)\big)\, x_j - K g , \qquad \varepsilon(g) = 1 - (1-g)^2 , \]
      <p>donde \(m_j\) es la eficacia máxima de la gobernanza contra el riesgo \(j\) y \(\varepsilon\) refleja que los primeros controles rinden más que los últimos. Derivando, el nivel óptimo cumple \(2(1-g)\sum_j m_j p_j |x_j| = K\).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto</strong> (miles de dólares, escenario base, \(K = 300\)). Oportunidades: \(0{,}7 \cdot 400 + 0{,}5 \cdot 300 + 0{,}3 \cdot 600 = 610\). Riesgos sin gobernanza: \(0{,}25 \cdot 500 + 0{,}15 \cdot 900 + 0{,}3 \cdot 300 + 0{,}35 \cdot 250 + 0{,}2 \cdot 700 = 577{,}5\). Valor neto \(= 32{,}5\): casi nulo. Con \(g = 0{,}6\) los riesgos bajan a \(\approx 243\), la gobernanza cuesta 180 y el neto sube a \(\approx 187\). Con \(g = 1\) los riesgos bajan a \(179{,}5\) pero el neto cae a \(\approx 130\). Como \(\sum m_j p_j |x_j| = 398\), el óptimo es \(g = 1 - 300/796 \approx 0{,}62\). Un solo número esperado oculta la dispersión: en el escenario pesimista, sin gobernanza, el resultado es negativo.</p></div>
      <h2>Curva de adopción y madurez</h2>
      <p>La difusión de una tecnología dentro de una organización sigue el modelo de Bass: la fracción \(A\) de áreas que la usan crece por impulso externo \(p\) (directivos, proveedores) y por contagio interno \(q\),</p>
      \[ A_{t+1} = A_t + (p + q A_t)(1 - A_t)\,c_t . \]
      <p>Aquí \(c_t\) es la confianza: vale 1 sin incidentes y cae a \(1 - \text{gravedad}\) cuando ocurre uno, recuperándose con constante de tiempo \(\tau\). Los hitos de madurez típicos son exploración, pilotos, escala, integración y transformación. Las curvas se conectan con la <a href="tema.html?id=change-management">gestión del cambio</a> y la <a href="tema.html?id=digitization-vs-transformation">transformación digital</a>.</p>`,
  });
})();
