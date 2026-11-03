(function () {
  'use strict';
  const { color: C } = VIZ;
  const mil = (v) => (v >= 1000 ? `${VIZ.fmt(v / 1000, 3)} M USD` : `${VIZ.fmt(v, 3)} mil USD`);
  const horas = (h) => (h >= 48 ? `${VIZ.fmt(h / 24, 3)} días` : `${VIZ.fmt(h, 3)} h`);
  const recortar = (ctx, texto, ancho) => {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: análisis de impacto y orden de recuperación ---------- */

  const PROCESOS = [
    { n: 'Pagos en línea', costo: 12, mtd: 4, dur: 3 },
    { n: 'Facturación', costo: 6, mtd: 24, dur: 4 },
    { n: 'Atención al cliente', costo: 4, mtd: 12, dur: 2 },
    { n: 'Nómina', costo: 3, mtd: 72, dur: 3 },
    { n: 'Correo interno', costo: 1.5, mtd: 24, dur: 1.5 },
    { n: 'Reportes de gestión', costo: 0.5, mtd: 120, dur: 2 },
  ];

  function montarBia(cuerpo) {
    let orden = PROCESOS.map((_, i) => i), hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const ordenar = (f) => { orden = PROCESOS.map((_, i) => i).sort(f); dibujar(); };
    ctl.boton('Por tolerancia (MTD menor primero)', () => ordenar((a, b) => PROCESOS[a].mtd - PROCESOS[b].mtd));
    ctl.boton('Por costo por hora', () => ordenar((a, b) => PROCESOS[b].costo - PROCESOS[a].costo));
    ctl.boton('Óptimo (costo ÷ duración)', () => ordenar((a, b) => PROCESOS[b].costo / PROCESOS[b].dur - PROCESOS[a].costo / PROCESOS[a].dur), { primario: true });
    ctl.boton('Orden de la lista', () => ordenar((a, b) => a - b));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + PROCESOS.length * 40 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'restaurado dentro de su MTD' }, { color: C.s8, texto: 'restaurado después de su MTD' },
      { color: C.tinta, texto: 'MTD (caída máxima tolerable)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un solo equipo restaura los procesos uno tras otro tras un desastre. Haga clic en una barra para subirla una posición, o use los botones. Compare cuánto se pierde con cada orden y cuántos procesos pasan su MTD.');

    function calcular() {
      let t = 0;
      return orden.map((i) => { const p = PROCESOS[i]; const ini = t; t += p.dur; return { i, ini, fin: t, perdida: p.costo * t }; });
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const filas = calcular(), izq = W < 500 ? 104 : 170, fila = 40, top = 22, T = filas[filas.length - 1].fin;
      const xmax = Math.max(T, ...PROCESOS.map((p) => Math.min(p.mtd, T * 1.3))) * 1.05, esc = (W - izq - 10) / xmax;
      geo = { top, fila };
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const v of VIZ.ticks(0, xmax, 6)) { ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(izq + v * esc, top - 4); ctx.lineTo(izq + v * esc, top + filas.length * fila); ctx.stroke(); ctx.fillText(`${v} h`, izq + v * esc, 4); }
      let fuera = 0, total = 0;
      filas.forEach((f, k) => {
        const p = PROCESOS[f.i], y = top + k * fila, tarde = f.fin > p.mtd;
        if (tarde) fuera++; total += f.perdida;
        if (k === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y, W, fila - 2); }
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, `${k + 1}. ${p.n}`, izq - 10), 6, y + fila / 2 - 2);
        ctx.beginPath(); ctx.roundRect(izq + f.ini * esc, y + 8, (f.fin - f.ini) * esc - 1, 22, 4); ctx.fillStyle = tarde ? C.s8 : C.s6; ctx.fill();
        if (p.mtd <= xmax) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(izq + p.mtd * esc, y + 3); ctx.lineTo(izq + p.mtd * esc, y + 35); ctx.stroke(); }
      });
      registro.textContent = `Con este orden, ${fuera} de ${filas.length} procesos se restauran después de su MTD y la pérdida total es ${mil(total)}. Orden: ${filas.map((f) => PROCESOS[f.i].n).join(' → ')}.`;
      const opt = orden.slice().sort((a, b) => PROCESOS[b].costo / PROCESOS[b].dur - PROCESOS[a].costo / PROCESOS[a].dur);
      let tt = 0, mejor = 0;
      opt.forEach((i) => { tt += PROCESOS[i].dur; mejor += PROCESOS[i].costo * tt; });
      lectura.set([
        ['pérdida total', mil(total)], ['pérdida del orden óptimo', mil(mejor)], ['exceso sobre el óptimo', mil(total - mejor)],
        ['procesos fuera de su MTD', `${fuera} de ${filas.length}`], ['recuperación completa', horas(T)],
      ]);
    }
    const fila = (y) => { const k = Math.floor((y - geo.top) / geo.fila); return k >= 0 && k < PROCESOS.length ? k : -1; };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = fila(y);
      if (k !== hover) { hover = k; dibujar(); }
      if (k < 0) return tip.ocultar();
      const f = calcular()[k], p = PROCESOS[f.i];
      tip.mostrar(x, y, `<b>${p.n}</b><br>cuesta ${mil(p.costo)} por hora caído<br>MTD ${horas(p.mtd)} · recuperar ${horas(p.dur)}<br>vuelve a la hora <b>${VIZ.fmt(f.fin, 3)}</b><br>pérdida ${mil(f.perdida)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const k = fila(lienzo.posicion(ev).y);
      if (k > 0) { [orden[k - 1], orden[k]] = [orden[k], orden[k - 1]]; dibujar(); }
    });
    dibujar();
  }

  /* ---------- Fig. 2: estrategias de mitigación ---------- */

  const RIESGOS = [
    { n: 'Ransomware', aro: 0.3, sle: 500, evitar: 200, reducir: 40, red: 0.7 },
    { n: 'Fuga de datos de clientes', aro: 0.1, sle: 900, evitar: 120, reducir: 45, red: 0.6 },
    { n: 'Falla del centro de datos', aro: 0.05, sle: 600, evitar: 150, reducir: 12, red: 0.5 },
    { n: 'Fraude interno', aro: 0.3, sle: 60, evitar: 30, reducir: 8, red: 0.6 },
    { n: 'Caída del proveedor', aro: 0.5, sle: 80, evitar: 90, reducir: 15, red: 0.5 },
  ];
  const ESTR = ['Evitar', 'Reducir', 'Transferir', 'Aceptar'];
  const DEDUCIBLE = 0.1;

  function montarEstrategias(cuerpo) {
    let recargo = 1.5, tol = 40, hover = null, geo = null;
    const sel = RIESGOS.map(() => 3);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Recargo de la prima del seguro', min: 1, max: 3, paso: 0.1, valor: recargo, formato: (v) => `×${VIZ.fmt(v, 2)}`, alCambiar: (v) => { recargo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Riesgo residual tolerable por riesgo', min: 5, max: 100, paso: 5, valor: tol, formato: mil, alCambiar: (v) => { tol = v; dibujar(); } });
    ctl.boton('Elegir la más barata de cada riesgo', () => { RIESGOS.forEach((_, i) => { const c = costos(i); sel[i] = c.indexOf(Math.min(...c)); }); dibujar(); }, { primario: true });
    ctl.boton('Aceptar todo', () => { sel.fill(3); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 56 + RIESGOS.length * 44 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'estrategia elegida' }, { color: C.s6, texto: 'la más barata del riesgo (contorno)' }, { color: C.s8, texto: 'residual sobre lo tolerable' },
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'costo total bajo' }, { color: VIZ.css(VIZ.enRampa(0.8)), texto: 'costo total alto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda es el costo anual total (costo de la estrategia + pérdida esperada que queda). Haga clic en una celda para elegir la estrategia de ese riesgo. Suba el recargo del seguro y vea cuándo deja de convenir transferir.');

    const ale = (r) => r.aro * r.sle;
    function detalle(i, e) {
      const r = RIESGOS[i], a = ale(r);
      if (e === 0) return { costo: r.evitar, res: 0 };
      if (e === 1) return { costo: r.reducir, res: a * (1 - r.red) };
      if (e === 2) return { costo: recargo * a * (1 - DEDUCIBLE), res: a * DEDUCIBLE };
      return { costo: 0, res: a };
    }
    const costos = (i) => [0, 1, 2, 3].map((e) => { const d = detalle(i, e); return d.costo + d.res; });
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = W < 500 ? 92 : 190, top = 26, fila = 44, cw = (W - izq - 6) / 4;
      geo = { izq, top, fila, cw };
      const todos = RIESGOS.flatMap((_, i) => costos(i)), maxc = Math.max(...todos);
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ESTR.forEach((e, k) => ctx.fillText(e, izq + (k + 0.5) * cw, 12));
      let costoSel = 0, resSel = 0, sinNada = 0, optimo = 0, fuera = 0;
      RIESGOS.forEach((r, i) => {
        const y = top + i * fila, c = costos(i), mejor = c.indexOf(Math.min(...c));
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(recortar(ctx, r.n, izq - 10), 6, y + fila / 2 - 6);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.fillText(`pérdida esperada ${mil(ale(r))}`.slice(0, W < 500 ? 14 : 40), 6, y + fila / 2 + 9);
        for (let e = 0; e < 4; e++) {
          const x = izq + e * cw + 3, d = detalle(i, e);
          ctx.beginPath(); ctx.roundRect(x, y + 3, cw - 6, fila - 6, 4);
          ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.sqrt(c[e] / maxc))); ctx.fill();
          const dark = Math.sqrt(c[e] / maxc) > 0.5;
          if (e === sel[i]) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3.5; ctx.stroke(); }
          else if (e === mejor) { ctx.strokeStyle = C.s6; ctx.lineWidth = 2.5; ctx.stroke(); }
          if (d.res > tol) { ctx.fillStyle = C.s8; ctx.beginPath(); ctx.arc(x + cw - 16, y + 12, 4, 0, Math.PI * 2); ctx.fill(); }
          ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = dark ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.fillText(VIZ.fmt(c[e], 3), x + (cw - 6) / 2, y + fila / 2);
        }
        const d = detalle(i, sel[i]);
        costoSel += d.costo; resSel += d.res; sinNada += ale(r); optimo += c[mejor]; if (d.res > tol) fuera++;
      });
      registro.textContent = `Con sus elecciones se pagan ${mil(costoSel)} al año en estrategias y quedan ${mil(resSel)} de pérdida esperada: total ${mil(costoSel + resSel)}, frente a ${mil(sinNada)} si acepta todo y ${mil(optimo)} con la elección más barata. ${fuera ? fuera + ' riesgo(s) quedan sobre lo tolerable (punto rojo).' : 'Todo queda dentro de lo tolerable.'}`;
      lectura.set([
        ['costo de las estrategias', mil(costoSel)], ['riesgo residual', mil(resSel)], ['total anual', mil(costoSel + resSel)],
        ['aceptando todo', mil(sinNada)], ['mínimo posible', mil(optimo)], ['sobre lo tolerable', `${fuera} de ${RIESGOS.length}`],
      ]);
    }
    const celda = (x, y) => {
      const e = Math.floor((x - geo.izq) / geo.cw), i = Math.floor((y - geo.top) / geo.fila);
      return e >= 0 && e < 4 && i >= 0 && i < RIESGOS.length ? { i, e } : null;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celda(x, y);
      hover = c;
      if (!c) return tip.ocultar();
      const d = detalle(c.i, c.e);
      tip.mostrar(x, y, `<b>${RIESGOS[c.i].n}: ${ESTR[c.e].toLowerCase()}</b><br>costo de la estrategia ${mil(d.costo)}<br>pérdida que queda ${mil(d.res)}<br>total <b>${mil(d.costo + d.res)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const c = celda(...Object.values(lienzo.posicion(ev))); if (c) { sel[c.i] = c.e; dibujar(); } });
    dibujar();
  }

  VIZ.registrarTema('continuity-risk-mitigation', {
    intro: String.raw`
      <p>La <strong>continuidad del negocio</strong> es la capacidad de seguir entregando lo esencial cuando algo falla. Se empieza con un <strong>análisis de impacto (BIA)</strong>: qué procesos hay, cuánto cuesta cada hora sin ellos y cuánto tiempo puede la organización tolerar su caída antes de un daño grave (el MTD).
      Con eso se decide qué recuperar primero y qué inversión se justifica.</p>
      <p>Frente a cada riesgo hay cuatro respuestas: <strong>evitar</strong> la actividad, <strong>reducir</strong> la probabilidad o el impacto con controles, <strong>transferir</strong> la pérdida (un seguro, un contrato) o <strong>aceptar</strong> el riesgo. La mejor depende de comparar su costo con la pérdida esperada que deja.</p>`,
    visualizaciones: [
      {
        titulo: 'Impacto y orden de recuperación',
        descripcion: 'Pruebe los cuatro órdenes de recuperación: por tolerancia evita pasar el MTD, pero el orden «costo ÷ duración» minimiza la pérdida total. Suba una barra con clic y vea el efecto.',
        montar: montarBia,
      },
      {
        titulo: 'Evitar, reducir, transferir o aceptar',
        descripcion: 'Elija una estrategia por riesgo con clic y compare el total anual con el mínimo posible. Suba el recargo del seguro a ×3 y observe cómo transferir deja de ser la mejor opción.',
        montar: montarEstrategias,
      },
    ],
    teoria: String.raw`
      <h2>Análisis de impacto en el negocio</h2>
      <table>
        <tr><th>Concepto</th><th>Significado</th></tr>
        <tr><td>MTD</td><td>tiempo máximo de caída tolerable antes de un daño grave</td></tr>
        <tr><td>RTO</td><td>tiempo en que se planea restablecer el proceso; debe ser menor que el MTD</td></tr>
        <tr><td>RPO</td><td>máxima pérdida de datos aceptable, medida en tiempo</td></tr>
        <tr><td>Dependencias</td><td>sistemas, personas y proveedores sin los cuales el proceso no funciona</td></tr>
      </table>
      <p>Si un solo equipo restaura los procesos en secuencia y el proceso \(i\) tarda \(d_i\) y cuesta \(c_i\) por hora caído, terminando en \(F_i\) (suma de las duraciones hasta él), la pérdida total es</p>
      \[ L = \sum_i c_i\, F_i. \]
      <p>Este es un problema de secuenciación: la pérdida mínima se logra ordenando por \(c_i/d_i\) de mayor a menor (regla de Smith). Un intercambio de dos procesos adyacentes lo demuestra: poner \(i\) antes que \(j\) es mejor si \(c_i d_j > c_j d_i\).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Dos procesos: A con \(c=12\), \(d=3\) y B con \(c=6\), \(d=4\). A primero: \(F_A=3\), \(F_B=7\), \(L = 12\cdot 3 + 6\cdot 7 = 78\). B primero: \(F_B=4\), \(F_A=7\), \(L = 6\cdot 4 + 12\cdot 7 = 108\). Coincide con \(12/3 = 4 &gt; 6/4 = 1{,}5\).</p></div>
      <h2>Estrategias de mitigación</h2>
      <p>Con tasa anual de ocurrencia \(\mathrm{ARO}\) y pérdida por evento \(\mathrm{SLE}\), la pérdida anual esperada es \(\mathrm{ALE} = \mathrm{ARO}\times \mathrm{SLE}\). Cada estrategia tiene un costo \(k\) y deja una pérdida residual \(R\):</p>
      <table>
        <tr><th>Estrategia</th><th>Costo anual</th><th>Pérdida que queda</th></tr>
        <tr><td>Evitar</td><td>valor de la actividad que se abandona</td><td>\(0\)</td></tr>
        <tr><td>Reducir</td><td>costo del control</td><td>\((1-r)\,\mathrm{ALE}\)</td></tr>
        <tr><td>Transferir</td><td>prima \(= \rho\,(1-d)\,\mathrm{ALE}\)</td><td>\(d\,\mathrm{ALE}\) (deducible \(d\))</td></tr>
        <tr><td>Aceptar</td><td>\(0\)</td><td>\(\mathrm{ALE}\)</td></tr>
      </table>
      <p>Se elige la que minimiza \(k + R\), siempre que el residual sea tolerable. El recargo \(\rho \ge 1\) refleja que el asegurador cobra más que la pérdida esperada: con \(\rho\) alto, el seguro rara vez es el más barato en promedio, pero puede ser razonable para eventos raros y catastróficos, porque protege contra la variabilidad que la organización no podría absorber.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Falla del centro de datos: \(\mathrm{ALE} = 0{,}05 \times 600 = 30\) mil USD. Aceptar cuesta 30; reducir con un control de 12 mil que baja 50 % cuesta \(12 + 15 = 27\); transferir con \(\rho = 1{,}5\) y deducible de 10 %: \(1{,}5 \times 27 + 3 = 43{,}5\). Gana reducir, aunque por poco.</p></div>
      <h2>Plan de continuidad</h2>
      <p>El plan reúne los procedimientos para operar en modo degradado, los contactos, el orden de recuperación y las pruebas periódicas. Un plan que no se ensaya suele fallar en lo más básico: quién decide, dónde se reúne el equipo, qué sistema se levanta primero.</p>
      <h2>Conexiones</h2>
      <p>Las pérdidas esperadas vienen de <a href="tema.html?id=threats-vulnerabilities-risk">amenazas, vulnerabilidades y riesgo</a>; la parte técnica de volver a operar se estudia en <a href="tema.html?id=backups-disaster-recovery">respaldos y recuperación ante desastres</a>
      y <a href="tema.html?id=incident-management">gestión de incidentes</a>. La secuenciación por costo y duración es un caso de <a href="tema.html?id=cia-triad">proteger la disponibilidad</a> con criterio económico.</p>`,
  });
})();
