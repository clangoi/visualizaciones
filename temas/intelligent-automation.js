(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const dinero = (v) => (v < 0 ? '−' : '') + '$' + VIZ.entero(Math.abs(v));
  const horas = (v) => `${VIZ.entero(v)} h`;

  /* ---------- Fig. 1: qué automatizar ---------- */

  // vol: tareas al mes; min: minutos por tarea; vari: variabilidad (excepciones, datos no estructurados); riesgo: impacto de un error.
  const TAREAS = [
    { n: 'Conciliar facturas con órdenes', vol: 4200, min: 6, vari: 0.25, riesgo: 0.3 },
    { n: 'Ingresar pedidos desde correos', vol: 3000, min: 4, vari: 0.45, riesgo: 0.2 },
    { n: 'Responder consultas frecuentes', vol: 6500, min: 5, vari: 0.35, riesgo: 0.15 },
    { n: 'Armar el reporte semanal', vol: 40, min: 90, vari: 0.1, riesgo: 0.1 },
    { n: 'Aprobar créditos de consumo', vol: 900, min: 25, vari: 0.5, riesgo: 0.85 },
    { n: 'Detectar fraude en transacciones', vol: 12000, min: 2, vari: 0.55, riesgo: 0.9 },
    { n: 'Dar de alta a empleados', vol: 120, min: 40, vari: 0.2, riesgo: 0.35 },
    { n: 'Clasificar tickets de soporte', vol: 5200, min: 3, vari: 0.4, riesgo: 0.25 },
    { n: 'Negociar contratos clave', vol: 25, min: 240, vari: 0.9, riesgo: 0.7 },
    { n: 'Atender reclamos complejos', vol: 600, min: 30, vari: 0.85, riesgo: 0.6 },
    { n: 'Extraer datos de formularios', vol: 8000, min: 3, vari: 0.3, riesgo: 0.2 },
    { n: 'Revisar contratos legales', vol: 150, min: 60, vari: 0.75, riesgo: 0.8 },
    { n: 'Actualizar precios del catálogo', vol: 1500, min: 3, vari: 0.1, riesgo: 0.45 },
    { n: 'Planificar turnos de trabajo', vol: 80, min: 50, vari: 0.6, riesgo: 0.3 },
  ];
  const CLASES = {
    total: { texto: 'automatizar por completo', color: C.s6, forma: 0, ahorro: 0.9 },
    asistida: { texto: 'automatización asistida (humano en el ciclo)', color: C.s4, forma: 1, ahorro: 0.45 },
    manual: { texto: 'mantener humano (juicio o excepciones)', color: C.s8, forma: 5, ahorro: 0 },
    bajo: { texto: 'no vale la pena (poco volumen)', color: C.inactivo, forma: 3, ahorro: 0 },
  };

  function montarCartera(cuerpo) {
    let uVar = 0.4, uRiesgo = 0.4, vMin = 500, sel = -1, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variabilidad máxima para automatizar sola', min: 0, max: 1, paso: 0.05, valor: uVar, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { uVar = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Riesgo máximo para automatizar sola', min: 0, max: 1, paso: 0.05, valor: uRiesgo, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { uRiesgo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Volumen mínimo (tareas/mes)', min: 0, max: 3000, paso: 50, valor: vMin, formato: (v) => VIZ.entero(v), alCambiar: (v) => { vMin = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(CLASES).map((k) => ({ color: k.color, texto: k.texto, forma: 'punto' })).concat([{ color: C.apagado, texto: 'tamaño del círculo: volumen mensual', forma: 'punto' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un círculo para ver el cálculo de esa tarea. La zona verde es lo que cumple ambos umbrales; a la derecha de 0,8 de variabilidad el juicio humano gana siempre. Esta clasificación no incluye el costo de construir el robot ni el tiempo de supervisión; la figura siguiente los calcula.');

    const clase = (t) => (t.vol < vMin ? 'bajo' : t.vari <= uVar && t.riesgo <= uRiesgo ? 'total' : t.vari > 0.8 ? 'manual' : 'asistida');
    const hAhorro = (t) => (t.vol * t.min / 60) * CLASES[clase(t)].ahorro;
    const radio = (t) => 5 + 11 * (Math.log10(t.vol) - 1) / 3.2;

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, { etiquetaX: 'variabilidad de la tarea', etiquetaY: 'riesgo de un error' });
      ctx.fillStyle = VIZ.alfa(C.s4, 0.1);
      ctx.fillRect(pl.x0, pl.y1, pl.sx(0.8) - pl.x0, pl.y0 - pl.y1);
      ctx.fillStyle = VIZ.alfa(C.s8, 0.1);
      ctx.fillRect(pl.sx(0.8), pl.y1, pl.x1 - pl.sx(0.8), pl.y0 - pl.y1);
      ctx.fillStyle = VIZ.alfa(C.s6, 0.18);
      ctx.fillRect(pl.x0, pl.sy(uRiesgo), pl.sx(uVar) - pl.x0, pl.y0 - pl.sy(uRiesgo));
      pl.ejes();
      TAREAS.forEach((t, i) => {
        const k = CLASES[clase(t)], x = pl.sx(t.vari), y = pl.sy(t.riesgo);
        if (i === sel) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, radio(t) + 5, 0, Math.PI * 2); ctx.stroke(); }
        VIZ.marcador(ctx, x, y, k.color, radio(t), k.forma);
        if (i === hover || i === sel) {
          ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textBaseline = 'bottom';
          ctx.textAlign = x > pl.x1 - 120 ? 'right' : 'left';
          ctx.fillText(t.n, x + (x > pl.x1 - 120 ? -radio(t) - 4 : radio(t) + 4), y - 2);
        }
      });
      const cuenta = { total: 0, asistida: 0, manual: 0, bajo: 0 };
      TAREAS.forEach((t) => { cuenta[clase(t)]++; });
      const hTot = TAREAS.reduce((s, t) => s + t.vol * t.min / 60, 0), hAh = TAREAS.reduce((s, t) => s + hAhorro(t), 0);
      lectura.set([
        ['automatizar por completo', String(cuenta.total)],
        ['asistidas', String(cuenta.asistida)],
        ['siguen manuales', String(cuenta.manual + cuenta.bajo)],
        ['horas de trabajo al mes', horas(hTot)],
        ['horas liberadas', horas(hAh)],
        ['% del total', `${VIZ.fmt(100 * hAh / hTot, 3)} %`],
      ]);
      if (sel >= 0) {
        const t = TAREAS[sel], k = CLASES[clase(t)];
        registro.textContent = `${t.n}: ${VIZ.entero(t.vol)} tareas/mes × ${t.min} min = ${horas(t.vol * t.min / 60)}; clasificación «${k.texto}», ahorro ${Math.round(k.ahorro * 100)} % = ${horas(hAhorro(t))} al mes.`;
      } else registro.textContent = 'Seleccione una tarea para ver cuánto tiempo libera con la clasificación actual.';
    }
    lienzo.alDibujar = () => dibujar();
    const cerca = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = -1, dm = 1e9;
      TAREAS.forEach((t, i) => { const d = Math.hypot(pl.sx(t.vari) - x, pl.sy(t.riesgo) - y); if (d < radio(t) + 6 && d < dm) { dm = d; mejor = i; } });
      return { i: mejor, x, y };
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { i, x, y } = cerca(ev);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const t = TAREAS[i];
      tip.mostrar(x, y, `<b>${t.n}</b><br>${VIZ.entero(t.vol)} tareas/mes · ${t.min} min<br>variabilidad <b>${VIZ.fmt(t.vari, 2)}</b> · riesgo <b>${VIZ.fmt(t.riesgo, 2)}</b>` + VIZ.filaTooltip(CLASES[clase(t)].color, CLASES[clase(t)].texto, null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { if (!pl) return; const { i } = cerca(ev); sel = i === sel ? -1 : i; dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: ahorro, errores y recuperación ---------- */

  function montarAhorro(cuerpo) {
    const MESES = 36, CA = 0.05; // costo por ejecución automática
    const P = { V: 3000, t: 6, w: 15, eh: 0.03, ea: 0.05, a: 0.85, ce: 40, I: 30000, m: 800 };
    let pl = null, hover = -1, res = null;
    const ctl = VIZ.controles(cuerpo);
    const cfg = (clave, etiqueta, min, max, paso, formato) => ctl.rango({ etiqueta, min, max, paso, valor: P[clave], formato, alCambiar: (v) => { P[clave] = v; dibujar(); } });
    cfg('V', 'Tareas al mes', 200, 10000, 100, (v) => VIZ.entero(v));
    cfg('t', 'Minutos por tarea', 2, 30, 1, (v) => `${v} min`);
    cfg('eh', 'Error humano', 0.005, 0.1, 0.005, (v) => `${VIZ.fmt(v * 100, 2)} %`);
    cfg('ea', 'Error del robot sin supervisión', 0.005, 0.2, 0.005, (v) => `${VIZ.fmt(v * 100, 2)} %`);
    cfg('a', 'Parte automatizable sin excepciones', 0.5, 1, 0.05, (v) => `${Math.round(v * 100)} %`);
    cfg('ce', 'Costo de cada error', 5, 500, 5, dinero);
    cfg('I', 'Inversión en el robot completo', 5000, 100000, 2500, dinero);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'automatización total', forma: 'linea' },
      { color: C.s1, texto: 'automatización asistida (60 % de la inversión)', forma: 'linea' },
      { color: C.apagado, texto: 'punto de equilibrio: ahorro acumulado = 0', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre el gráfico para leer el ahorro acumulado mes a mes. Suba el error del robot o el costo de cada error: la automatización total pierde su ventaja y la asistida, que revisa cada resultado, resiste. Suponga salarios de $15/h y costo de 5 centavos por ejecución.');

    function calcular() {
      const { V, t, w, eh, ea, a, ce, I, m } = P;
      const manual = V * (t / 60) * w + V * eh * ce;
      const total = V * a * CA + V * a * ea * ce + V * (1 - a) * ((t / 60) * w + eh * ce) + m;
      // El humano revisa cada resultado en un 25 % del tiempo y detecta el 90 % de los errores del robot.
      const asist = V * a * (0.25 * (t / 60) * w + CA) + V * a * ea * 0.1 * ce + V * (1 - a) * ((t / 60) * w + eh * ce) + 0.6 * m;
      const errores = { manual: V * eh, total: V * a * ea + V * (1 - a) * eh, asist: V * a * ea * 0.1 + V * (1 - a) * eh };
      const flujo = (ah, inv) => [-inv, ...Array.from({ length: MESES }, () => ah)];
      const sT = manual - total, sA = manual - asist;
      return { manual, total, asist, sT, sA, errores, fT: flujo(sT, I), fA: flujo(sA, 0.6 * I), I };
    }
    const acum = (f) => f.map((_, i) => f.slice(0, i + 1).reduce((s, x) => s + x, 0));
    const mes = (r) => (r === null ? 'nunca (en 36 meses)' : `${VIZ.fmt(r, 3)} meses`);
    function dibujar() {
      res = calcular();
      const { ctx } = lienzo;
      lienzo.limpiar();
      const cT = acum(res.fT), cA = acum(res.fA);
      const lo = Math.min(...cT, ...cA, 0), hi = Math.max(...cT, ...cA, 1);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: lo * 1.08, ymax: hi * 1.08 }, { etiquetaX: 'mes', etiquetaY: 'ahorro acumulado neto', formatoY: dinero });
      pl.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke(); ctx.restore();
      VIZ.trazar(ctx, pl, cT.map((v, i) => [i, v]), C.s2, 2.5);
      VIZ.trazar(ctx, pl, cA.map((v, i) => [i, v]), C.s1, 2.5);
      if (hover >= 0) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke();
        VIZ.marcador(ctx, pl.sx(hover), pl.sy(cT[hover]), C.s2, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(cA[hover]), C.s1, 4);
      }
      const rT = S.recuperacion(res.fT), rA = S.recuperacion(res.fA);
      registro.textContent = `Hoy el proceso manual cuesta ${dinero(res.manual)} al mes. Total: ${dinero(res.total)} (ahorro ${dinero(res.sT)}). Asistida: ${dinero(res.asist)} (ahorro ${dinero(res.sA)}).`;
      lectura.set([
        ['ahorro mensual total', dinero(res.sT)],
        ['ahorro mensual asistida', dinero(res.sA)],
        ['recuperación total', mes(rT)],
        ['recuperación asistida', mes(rA)],
        ['errores al mes (manual → total → asistida)', `${VIZ.entero(res.errores.manual)} → ${VIZ.entero(res.errores.total)} → ${VIZ.entero(res.errores.asist)}`],
        ['VPN a 36 meses (1 % mensual), total / asistida', `${dinero(S.vpn(res.fT, 0.01))} / ${dinero(S.vpn(res.fA, 0.01))}`],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(MESES, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `mes <b>${hover}</b>` + VIZ.filaTooltip(C.s2, 'total', dinero(acum(res.fT)[hover])) + VIZ.filaTooltip(C.s1, 'asistida', dinero(acum(res.fA)[hover])));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('intelligent-automation', {
    intro: String.raw`
      <p>La <strong>automatización inteligente</strong> combina automatización de procesos (robots de software que repiten pasos) con técnicas de inteligencia artificial que leen documentos, clasifican solicitudes o proponen decisiones. No todo lo que puede automatizarse debe automatizarse: la pregunta útil es qué tareas tienen <em>mucho volumen</em>, <em>poca variabilidad</em> y <em>bajo riesgo</em>, y cuáles necesitan a una persona que revise.</p>
      <p>Entre «un robot lo hace todo» y «lo hace una persona» hay un punto medio muy común: la <strong>automatización asistida</strong> o <em>human in the loop</em>, donde la máquina prepara y la persona confirma. Cuesta menos construir, libera menos horas, pero tolera mejor los errores del modelo.</p>`,
    visualizaciones: [
      {
        titulo: 'Qué tareas automatizar',
        descripcion: 'Mueva los umbrales de variabilidad, riesgo y volumen y mire cómo cambia el color de cada tarea y las horas liberadas. Pruebe subir el volumen mínimo: las tareas pequeñas dejan de justificar el esfuerzo aunque sean fáciles.',
        montar: montarCartera,
      },
      {
        titulo: 'Ahorro, errores y recuperación de la inversión',
        descripcion: 'Compare el ahorro acumulado de automatizar por completo frente a hacerlo con revisión humana. Suba el error del robot y el costo de cada error: la línea naranja cae y la azul resiste.',
        montar: montarAhorro,
      },
    ],
    teoria: String.raw`
      <h2>Criterios para elegir tareas</h2>
      <table>
        <tr><th>Criterio</th><th>Favorece automatizar si…</th><th>Ejemplo</th></tr>
        <tr><td>Volumen</td><td>es alto: el costo fijo del robot se reparte</td><td>conciliar 4.200 facturas al mes</td></tr>
        <tr><td>Variabilidad</td><td>es baja: reglas estables, datos estructurados</td><td>actualizar precios desde una lista</td></tr>
        <tr><td>Riesgo</td><td>es bajo: un error es barato y reversible</td><td>clasificar tickets de soporte</td></tr>
        <tr><td>Juicio</td><td>no se requiere: no hay negociación ni empatía</td><td>lo contrario: negociar contratos clave</td></tr>
      </table>
      <p>Cuando el volumen es alto pero el riesgo también (aprobar créditos, detectar fraude), la solución habitual es asistida: el modelo prioriza y la persona decide. Esto se conecta con la <a href="tema.html?id=ai-ml-business">decisión basada en modelos</a>, con los <a href="tema.html?id=ai-adoption-risks">riesgos de adopción</a> y con el análisis de procesos de la <a href="tema.html?id=bottleneck-analysis">minería de procesos</a>.</p>
      <h2>Modelo de ahorro</h2>
      <p>Sea \(V\) el volumen mensual, \(t\) los minutos por tarea, \(w\) el costo por hora, \(e_h\) y \(e_a\) las tasas de error humano y del robot, y \(c_e\) el costo de un error. Manual:</p>
      \[ K_{\text{manual}} = V\,\frac{t}{60}\,w + V\,e_h\,c_e . \]
      <p>Si la fracción \(a\) de las tareas se automatiza sola, con costo \(c_a\) por ejecución y mantenimiento mensual \(m\):</p>
      \[ K_{\text{total}} = V a (c_a + e_a c_e) + V(1-a)\Big(\tfrac{t}{60}w + e_h c_e\Big) + m . \]
      <p>En la versión asistida una persona revisa cada resultado en una fracción \(\rho\) del tiempo (aquí \(\rho = 0{,}25\)) y detecta una fracción \(d\) de los errores (aquí \(d = 0{,}9\)): el término automático pasa a \(V a\big(\rho \tfrac{t}{60}w + c_a + (1-d)e_a c_e\big)\). El ahorro mensual es \(K_{\text{manual}} - K\), y el plazo de recuperación, la inversión dividida por ese ahorro (ver <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto</strong> (montos en dólares). Con \(V = 3000\), \(t = 6\) min, \(w = 15\), \(e_h = 3\,\%\), \(c_e = 40\): \(K_{\text{manual}} = 3000 \cdot 0{,}1 \cdot 15 + 3000 \cdot 0{,}03 \cdot 40 = 4500 + 3600 = 8100\). Con \(a = 0{,}85\), \(e_a = 5\,\%\), \(m = 800\), \(c_a = 0{,}05\): \(K_{\text{total}} = 2550(0{,}05 + 2) + 450(1{,}5 + 1{,}2) + 800 \approx 5228 + 1215 + 800 = 7243\), un ahorro modesto porque el robot comete más errores que la persona. La versión asistida cuesta \(2550 \cdot 0{,}625 + 1215 + 480 \approx 3289\) al mes: ahorra unos 4811 y deja pasar diez veces menos errores del robot.</p></div>
      <h2>Qué no automatizar</h2>
      <ul>
        <li>Procesos rotos: automatizar un mal proceso solo lo hace fallar más rápido (ver <a href="tema.html?id=continuous-improvement">mejora continua</a>).</li>
        <li>Tareas con muchas excepciones o con consecuencias legales y humanas graves.</li>
        <li>Tareas de poco volumen: el costo de construir y mantener el robot supera el ahorro.</li>
      </ul>`,
  });
})();
