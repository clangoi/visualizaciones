(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => VIZ.fmt(v * 100, 3) + ' %';

  /* ---------- Fig. 1: armar el sistema ---------- */

  const COMPONENTES = [
    { id: 'personas', nombre: 'Personas', corto: 'Personas' },
    { id: 'procesos', nombre: 'Procesos', corto: 'Procesos' },
    { id: 'hardware', nombre: 'Hardware', corto: 'Hardware' },
    { id: 'software', nombre: 'Software', corto: 'Software' },
    { id: 'datos', nombre: 'Datos', corto: 'Datos' },
    { id: 'redes', nombre: 'Redes', corto: 'Redes' },
  ];
  const ETAPAS = [
    { id: 'ent', nombre: 'Entradas', sub: 'captura del pedido', usa: ['personas', 'procesos', 'datos'] },
    { id: 'pro', nombre: 'Procesamiento', sub: 'validar y facturar', usa: ['procesos', 'software', 'hardware'] },
    { id: 'sal', nombre: 'Salidas', sub: 'confirmar y entregar', usa: ['redes', 'software', 'personas'] },
  ];
  const ESCENARIOS = [
    ['bien', 'Todos los componentes sólidos', {}],
    ['personas', 'Personas sin capacitación', { personas: 15 }],
    ['procesos', 'Procesos informales', { procesos: 20 }],
    ['hardware', 'Equipos obsoletos', { hardware: 25 }],
    ['software', 'Software que no calza con el trabajo', { software: 20 }],
    ['datos', 'Datos sucios', { datos: 25 }],
    ['redes', 'Red inestable', { redes: 20 }],
  ];
  const nivelColor = (v) => (v >= 70 ? C.s6 : v >= 40 ? C.s4 : C.s8);

  function montarArmar(cuerpo) {
    const N = 200, LOTE = 10;
    let semilla = 1, val = Object.fromEntries(COMPONENTES.map((c) => [c.id, 80])), guardado = {}, fb = 0.3;
    let sim = null, zonas = [];

    const calidad = (e) => Math.cbrt(e.usa.reduce((p, k) => p * val[k] / 100, 1)); // media geométrica: un cero anula la etapa
    const efectiva = (q) => q + (1 - q) * fb;

    const ctl = VIZ.controles(cuerpo);
    const escenario = ctl.selector({ etiqueta: 'Escenario', opciones: ESCENARIOS.map((e) => [e[0], e[1]]), valor: 'bien', alCambiar: (v) => {
      const mod = ESCENARIOS.find((e) => e[0] === v)[2];
      COMPONENTES.forEach((c) => { poner(c.id, mod[c.id] === undefined ? 80 : mod[c.id]); });
      cambio();
    } });
    const sl = {};
    COMPONENTES.forEach((c) => {
      sl[c.id] = ctl.rango({ etiqueta: c.nombre, min: 0, max: 100, paso: 5, valor: 80, formato: (v) => `${v} %`, alCambiar: (v) => { val[c.id] = v; cambio(); } });
    });
    ctl.rango({ etiqueta: 'Retroalimentación (errores corregidos)', min: 0, max: 100, paso: 5, valor: 30, formato: (v) => `${v} %`, alCambiar: (v) => { fb = v / 100; cambio(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 5 });
    ctl.boton('Nuevos pedidos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 420 : 400) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'pedido que supera la etapa' },
      { color: C.s1, texto: 'pedido corregido por la retroalimentación' },
      { color: C.s8, texto: 'pedido perdido' },
      { color: C.tenue, borde: C.eje, texto: 'pedidos que llegan a la etapa' },
      { color: C.s6, texto: 'componente sólido (≥ 70 %)', forma: 'linea' },
      { color: C.s4, texto: 'regular (40–69 %)', forma: 'linea' },
      { color: C.s8, texto: 'débil (menos de 40 %)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un escenario o mueva los componentes, y pulse Reproducir para procesar 200 pedidos en lotes de 10. Haga clic en un componente del pie para quitarlo (0 %) o restituirlo. Cada etapa depende de tres componentes: un solo eslabón débil la arrastra.');

    function poner(id, v) { val[id] = v; sl[id].valor = v; sl[id].refrescar(); }
    function cambio() { rep.reiniciar(); }

    function iniciar() {
      sim = { n: 0, e: ETAPAS.map(() => ({ llegan: 0, directo: 0, corregido: 0, perdido: 0 })) };
      const rnd = VIZ.semilla(semilla * 977);
      return (function* () {
        while (sim.n < N) {
          for (let k = 0; k < LOTE; k++) {
            sim.n++;
            let vivo = true;
            ETAPAS.forEach((et, i) => {
              if (!vivo) return;
              const s = sim.e[i], q = calidad(et);
              s.llegan++;
              if (rnd() < q) s.directo++;
              else if (rnd() < fb) s.corregido++;
              else { s.perdido++; vivo = false; }
            });
          }
          yield;
        }
      })();
    }

    function dibujar() {
      if (!sim) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      zonas = [];
      const m = 10, cw = (W - 2 * m) / 3, topBox = 8, hBox = 44, baseBarras = H - 150, altoBarra = baseBarras - (topBox + hBox + 34);
      const qs = ETAPAS.map(calidad);
      // Cajas de etapa y flechas.
      ETAPAS.forEach((et, i) => {
        const x = m + i * cw + 6, w = cw - 12;
        ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x, topBox, w, hBox, 6); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(W < 520 ? 11 : 13, 600);
        ctx.fillText(et.nombre, x + w / 2, topBox + 19);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10);
        ctx.fillText(W < 520 ? `q = ${pct(qs[i])}` : `${et.sub} · q = ${pct(qs[i])}`, x + w / 2, topBox + 35);
        if (i < 2) {
          const ax = x + w + 1, ay = topBox + hBox / 2;
          ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 10, ay); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ax + 11, ay); ctx.lineTo(ax + 5, ay - 4); ctx.lineTo(ax + 5, ay + 4); ctx.fill();
        }
        // Barras apiladas.
        const s = sim.e[i];
        const bx = x + w * 0.2, bw = w * 0.6, esc = altoBarra / N;
        ctx.strokeStyle = C.eje; ctx.fillStyle = C.tenue; ctx.lineWidth = 1;
        const hLl = s.llegan * esc;
        ctx.beginPath(); ctx.roundRect(bx, baseBarras - hLl, bw, hLl, [4, 4, 0, 0]); if (hLl > 0) { ctx.fill(); ctx.stroke(); }
        let y = baseBarras;
        [[s.directo, C.s6], [s.corregido, C.s1], [s.perdido, C.s8]].forEach(([n, col]) => {
          const h = n * esc; if (h <= 0) return;
          ctx.fillStyle = col; ctx.fillRect(bx + 2, y - h, bw - 4, h); y -= h;
        });
        // Marca de lo esperado en teoría para el volumen que llega.
        const esp = s.llegan * efectiva(qs[i]);
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        const ye = baseBarras - esp * esc;
        ctx.beginPath(); ctx.moveTo(bx - 6, ye); ctx.lineTo(bx + bw + 6, ye); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center';
        ctx.fillText(`${s.directo + s.corregido} de ${s.llegan}`, bx + bw / 2, baseBarras + 15);
        zonas.push({ x: bx, y: baseBarras - altoBarra, w: bw, h: altoBarra, html: `<b>${et.nombre}</b><br>llegan <b>${s.llegan}</b><br>pasan directo <b>${s.directo}</b><br>corregidos <b>${s.corregido}</b><br>perdidos <b>${s.perdido}</b><br>esperado ${VIZ.fmt(esp, 3)} (línea punteada)` });
      });
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m, baseBarras + 0.5); ctx.lineTo(W - m, baseBarras + 0.5); ctx.stroke();
      // Retroalimentación de salidas a entradas.
      ctx.strokeStyle = C.s1; ctx.fillStyle = C.s1; ctx.lineWidth = 1.5;
      const fy = baseBarras + 30, fx0 = m + 2.5 * cw, fx1 = m + 0.5 * cw;
      ctx.beginPath(); ctx.moveTo(fx0, baseBarras + 22); ctx.lineTo(fx0, fy); ctx.lineTo(fx1, fy); ctx.lineTo(fx1, baseBarras + 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx1, baseBarras + 22); ctx.lineTo(fx1 - 4, baseBarras + 29); ctx.lineTo(fx1 + 4, baseBarras + 29); ctx.fill();
      ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center';
      ctx.fillText(`retroalimentación: ${Math.round(fb * 100)} % de los errores se corrigen`, W / 2, fy - 4);
      // Componentes.
      const chipW = (W - 2 * m) / 6, chipY = H - 62, chipH = 42;
      const debil = COMPONENTES.slice().sort((a, b) => val[a.id] - val[b.id])[0];
      COMPONENTES.forEach((c, i) => {
        const x = m + i * chipW + 3, w = chipW - 6;
        const col = nivelColor(val[c.id]);
        ctx.fillStyle = C.superficie; ctx.strokeStyle = col; ctx.lineWidth = c.id === debil.id && val[c.id] < 70 ? 3.5 : 2;
        ctx.beginPath(); ctx.roundRect(x, chipY, w, chipH, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, chipY + chipH - 7, w * val[c.id] / 100, 7, [0, 0, 5, 5]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(W < 520 ? 9 : 11, 600); ctx.textAlign = 'center';
        ctx.fillText(c.corto, x + w / 2, chipY + 17);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.fillText(`${val[c.id]} %`, x + w / 2, chipY + 31);
        zonas.push({ x, y: chipY, w, h: chipH, comp: c.id, html: `<b>${c.nombre}</b> ${val[c.id]} %<br>alimenta: ${ETAPAS.filter((e) => e.usa.includes(c.id)).map((e) => e.nombre.toLowerCase()).join(', ')}<br>haga clic para ${val[c.id] ? 'quitarlo' : 'restituirlo'}` });
      });
      ctx.textAlign = 'start';

      const esperado = qs.reduce((p, q) => p * efectiva(q), 1), sinFb = qs.reduce((p, q) => p * q, 1);
      const entregados = sim.e[2].directo + sim.e[2].corregido;
      const etapaDebil = ETAPAS.map((e, i) => [e, qs[i]]).sort((a, b) => a[1] - b[1])[0];
      lectura.set([
        ['componente más débil', `${debil.nombre} (${val[debil.id]} %)`],
        ['etapa más débil', `${etapaDebil[0].nombre} (${pct(etapaDebil[1])})`],
        ['pedidos entregados', `${entregados} de ${sim.n}`],
        ['rendimiento esperado', pct(esperado)],
        ['sin retroalimentación', pct(sinFb)],
        ['aporte de la retroalimentación', `+${VIZ.fmt((esperado - sinFb) * 100, 3)} pp`],
      ]);
      registro.textContent = sim.n === 0
        ? `Sistema listo: cada etapa combina tres componentes (calidad q = media geométrica). Rendimiento esperado de extremo a extremo: ${pct(esperado)}. Pulse Reproducir.`
        : `Se procesaron ${sim.n} pedidos: ${entregados} llegaron al cliente. La etapa «${etapaDebil[0].nombre.toLowerCase()}» es la que más pedidos pierde porque depende de ${etapaDebil[0].usa.join(', ')}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const z = zonas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      lienzo.canvas.style.cursor = z && z.comp ? 'pointer' : 'default';
      if (z) tip.mostrar(x, y, z.html); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const z = zonas.find((q) => q.comp && x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!z) return;
      if (val[z.comp] > 0) { guardado[z.comp] = val[z.comp]; poner(z.comp, 0); } else poner(z.comp, guardado[z.comp] || 80);
      cambio();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el ciclo de retroalimentación ---------- */

  function montarCiclo(cuerpo) {
    const SEM = 52, META = 60;
    let semilla = 1, k = 0.5, retraso = 1, plazo = 2, salto = true, sd = 3, t = SEM, ab = [], ce = [], dem = [], pl = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ganancia de la retroalimentación', min: 0, max: 1.2, paso: 0.05, valor: k, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { k = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Retraso del informe de existencias', min: 0, max: 5, paso: 1, valor: retraso, formato: (v) => `${v} sem`, alCambiar: (v) => { retraso = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Plazo de entrega del proveedor', min: 1, max: 5, paso: 1, valor: plazo, formato: (v) => `${v} sem`, alCambiar: (v) => { plazo = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Variabilidad de la demanda', min: 0, max: 8, paso: 0.5, valor: sd, formato: (v) => `±${v}`, alCambiar: (v) => { sd = v; recalcular(); } });
    ctl.casilla({ etiqueta: 'La demanda sube en la semana 20', valor: salto, alCambiar: (v) => { salto = v; recalcular(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2.5, velMax: 5 });
    ctl.boton('Nuevos datos', () => { semilla++; recalcular(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.46, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'existencias sin retroalimentación (pedido fijo)', forma: 'linea' },
      { color: C.s1, texto: 'existencias con retroalimentación', forma: 'linea' },
      { color: C.apagado, texto: 'meta de existencias', forma: 'linea' },
      { color: C.s4, texto: 'demanda semanal', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Entrada: la demanda y el informe de existencias; procesamiento: la regla «pedir lo habitual más k veces la diferencia con la meta»; salida: la orden de compra. Suba la ganancia con retraso y plazo largos y verá oscilaciones: la retroalimentación también puede desestabilizar. Pase el cursor para ver cada semana.');

    function simular(cerrado) {
      const st = [META], ped = [], hist = [];
      for (let w = 0; w < SEM; w++) {
        const llega = w - plazo >= 0 ? ped[w - plazo] : 20;
        const visto = st[Math.max(0, w - retraso)];
        const habitual = w >= 4 ? dem.slice(Math.max(0, w - 4), w).reduce((s, v) => s + v, 0) / Math.min(4, w) : 20;
        const o = cerrado ? Math.max(0, habitual + k * (META - visto)) : 20;
        ped.push(o); hist.push(o);
        st.push(st[w] + llega - dem[w]);
      }
      return { st, ped };
    }
    function recalcular() {
      const rnd = VIZ.semilla(semilla * 31 + 9);
      dem = Array.from({ length: SEM }, (_, w) => Math.max(0, (salto && w >= 20 ? 26 : 20) + sd * VIZ.normal(rnd)));
      ab = simular(false); ce = simular(true);
      rep.reiniciar();
      t = SEM; dibujar();
    }
    function iniciar() {
      t = 0;
      return (function* () { for (let w = 1; w <= SEM; w++) { t = w; yield; } })();
    }
    const stats = (s) => {
      const v = s.st.slice(1); const med = v.reduce((a, b) => a + b, 0) / v.length;
      return { med, rmse: Math.sqrt(v.reduce((a, b) => a + (b - META) ** 2, 0) / v.length), quiebres: v.filter((x) => x < 0).length, min: Math.min(...v) };
    };
    function dibujar() {
      if (!ab.st) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todo = [...ab.st, ...ce.st];
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: SEM, ymin: Math.min(0, Math.floor(Math.min(...todo) / 20) * 20), ymax: Math.ceil(Math.max(...todo, 80) / 20) * 20 }, { etiquetaX: 'semana', etiquetaY: 'unidades en existencia' });
      pl.ejes();
      if (pl.d.ymin < 0) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke(); }
      VIZ.trazar(ctx, pl, [[0, META], [SEM, META]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, dem.slice(0, t).map((v, w) => [w + 1, v]), C.s4, 1.5);
      VIZ.trazar(ctx, pl, ab.st.slice(0, t + 1).map((v, w) => [w, v]), C.s8, 2);
      VIZ.trazar(ctx, pl, ce.st.slice(0, t + 1).map((v, w) => [w, v]), C.s1, 2);
      if (t > 0 && t < SEM) { VIZ.marcador(ctx, pl.sx(t), pl.sy(ab.st[t]), C.s8, 4); VIZ.marcador(ctx, pl.sx(t), pl.sy(ce.st[t]), C.s1, 4); }
      const sa = stats(ab), sc = stats(ce);
      const mejora = sc.rmse < sa.rmse;
      registro.textContent = t === 0 ? 'Semana 0: existencias en la meta. Pulse Reproducir para ver cómo cada política responde a la demanda.'
        : `Semana ${t}: demanda ${VIZ.fmt(dem[t - 1], 3)}; existencias ${VIZ.fmt(ab.st[t], 3)} sin retroalimentación y ${VIZ.fmt(ce.st[t], 3)} con ella. ` + (t === SEM ? (mejora ? 'La retroalimentación mantiene las existencias más cerca de la meta.' : 'Con estos parámetros la retroalimentación empeora el resultado: pruebe una ganancia menor.') : '');
      lectura.set([
        ['desvío respecto de la meta (sin)', `${VIZ.fmt(sa.rmse, 3)} u.`],
        ['desvío respecto de la meta (con)', `${VIZ.fmt(sc.rmse, 3)} u.`],
        ['semanas con faltante (sin)', String(sa.quiebres)],
        ['semanas con faltante (con)', String(sc.quiebres)],
        ['existencias mínimas (con)', VIZ.fmt(sc.min, 3)],
        ['pedido máximo (con)', VIZ.fmt(Math.max(...ce.ped), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const w = Math.max(1, Math.min(SEM, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `semana <b>${w}</b>` + VIZ.filaTooltip(C.s4, 'demanda', VIZ.fmt(dem[w - 1], 3)) + VIZ.filaTooltip(C.s8, 'existencias (sin)', VIZ.fmt(ab.st[w], 3)) + VIZ.filaTooltip(C.s1, 'existencias (con)', VIZ.fmt(ce.st[w], 3)) + VIZ.filaTooltip(C.apagado, 'pedido (con)', VIZ.fmt(ce.ped[w - 1], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recalcular();
  }

  VIZ.registrarTema('is-components', {
    intro: String.raw`
      <p>Un sistema de información no es solo software. Es un conjunto de <strong>personas</strong>, <strong>procesos</strong> y
      <strong>tecnología</strong> (equipos, programas, datos y redes) que reciben <em>entradas</em>, las <em>procesan</em> y entregan
      <em>salidas</em>, con una <em>retroalimentación</em> que permite corregir el rumbo.</p>
      <p>Por eso un sistema falla de maneras muy distintas según qué componente esté débil: un equipo excelente con un proceso informal o un
      proceso impecable con usuarios sin capacitación producen el mismo síntoma, pedidos que se pierden. Estas figuras permiten verlo.</p>`,
    visualizaciones: [
      {
        titulo: 'Armar un sistema de pedidos',
        descripcion: 'Defina qué tan sólido es cada componente y procese 200 pedidos. Pruebe «Datos sucios» y luego «Equipos obsoletos»: la pérdida cae en etapas distintas. Quite un componente con un clic y vea qué etapa deja de funcionar.',
        montar: montarArmar,
      },
      {
        titulo: 'Entrada, proceso, salida y retroalimentación',
        descripcion: 'Una bodega decide cuánto pedir. Compare un pedido fijo con una regla que corrige según las existencias. Suba la ganancia junto con el retraso del informe: la corrección llega tarde y las existencias oscilan.',
        montar: montarCiclo,
      },
    ],
    teoria: String.raw`
      <h2>Los componentes</h2>
      <table>
        <tr><th>Componente</th><th>Qué es</th><th>Ejemplo en una distribuidora</th></tr>
        <tr><td>Personas</td><td>Quienes capturan, usan y administran el sistema</td><td>vendedores, bodegueros, analistas</td></tr>
        <tr><td>Procesos</td><td>Reglas y secuencias de trabajo que el sistema apoya</td><td>flujo de pedido a despacho</td></tr>
        <tr><td>Hardware</td><td>Equipos físicos</td><td>servidores, lectores de código de barras</td></tr>
        <tr><td>Software</td><td>Programas y aplicaciones</td><td>ERP, aplicación de bodega</td></tr>
        <tr><td>Datos</td><td>Hechos almacenados y su estructura</td><td>clientes, productos, existencias</td></tr>
        <tr><td>Redes</td><td>Comunicación entre dispositivos y sedes</td><td>red local, Internet, enlaces con proveedores</td></tr>
      </table>
      <h2>Entradas, procesamiento, salidas, retroalimentación</h2>
      <p>Un sistema es una función \(y = f(x)\) más un lazo que usa la salida para ajustar la entrada o el proceso. La disponibilidad de cada
      etapa depende de varios componentes a la vez; si todos son necesarios, se combinan como en un sistema en serie. En la primera figura la
      calidad de una etapa se modela con la media geométrica de sus componentes:</p>
      \[ q_e = \Big(\prod_{c \in e} m_c\Big)^{1/|e|}, \qquad R = \prod_{e} \big(q_e + (1 - q_e)\,f\big), \]
      <p>donde \(m_c \in [0,1]\) es la madurez del componente, \(f\) la fracción de errores que la retroalimentación corrige y \(R\) el
      rendimiento de extremo a extremo. Un componente en cero anula su etapa y por tanto todo el sistema, salvo que la retroalimentación
      recupere los pedidos.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con todos los componentes al 80 %, cada etapa tiene \(q = 0{,}8\) y, sin retroalimentación, \(R = 0{,}8^3 = 51{,}2\,\%\). Con \(f = 30\,\%\) cada etapa sube a
      \(0{,}8 + 0{,}2 \cdot 0{,}3 = 0{,}86\) y \(R = 0{,}86^3 \approx 63{,}6\,\%\). Si las personas bajan al 15 %, las etapas de entrada y salida pierden calidad
      porque ambas dependen de ellas: el efecto de un componente se multiplica por el número de etapas que lo usan.</p>
      <h2>Retroalimentación como control</h2>
      <p>En la bodega, el pedido es \(o_t = \hat d_t + k\,(M - s_{t-r})\): la demanda habitual más una corrección proporcional a la
      diferencia entre la meta \(M\) y las existencias que el informe muestra con \(r\) semanas de retraso. Con \(k\) pequeño la
      corrección es lenta; con \(k\) grande y retraso largo se sobrecorrige y aparecen oscilaciones, la misma dinámica que amplifica
      los pedidos a lo largo de una cadena (<a href="tema.html?id=scm">Supply Chain Management</a>).</p>
      <div class="recuadro">Un sistema de información falla por su eslabón más débil, no por su promedio.</div>
      <h2>Conexiones</h2>
      <p>La interdependencia entre tecnología y organización se profundiza en <a href="tema.html?id=sociotechnical-systems">Sociotechnical Systems</a>;
      el detalle de la infraestructura, en <a href="tema.html?id=it-infrastructure-layers">IT Infrastructure Layers</a>; y los procesos que el sistema apoya,
      en <a href="tema.html?id=business-process-anatomy">Anatomy of a Business Process</a>.</p>`,
  });
})();
