(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Pila de componentes de arriba hacia abajo. `horas` son horas de administración al mes que exige cada una
     y `control` el peso de la capacidad de decidir sobre ella (suman 200 h y 1). Son supuestos didácticos, iguales en las tres figuras. */
  const FILAS = [
    { n: 'Aplicaciones', horas: 40, control: 0.25, ej: 'instalar, configurar y actualizar el software de negocio' },
    { n: 'Datos', horas: 24, control: 0.15, ej: 'esquemas, copias de respaldo lógicas, permisos' },
    { n: 'Tiempo de ejecución', horas: 12, control: 0.10, ej: 'Java, .NET, Python: versiones y bibliotecas' },
    { n: 'Middleware', horas: 16, control: 0.10, ej: 'servidor de aplicaciones, colas de mensajes, balanceadores' },
    { n: 'Sistema operativo', horas: 28, control: 0.12, ej: 'parches, usuarios, endurecimiento de seguridad' },
    { n: 'Virtualización', horas: 20, control: 0.08, ej: 'hipervisor, máquinas virtuales, migraciones' },
    { n: 'Servidores', horas: 24, control: 0.08, ej: 'hardware, firmware, reposición de piezas' },
    { n: 'Almacenamiento', horas: 16, control: 0.06, ej: 'discos, cabinas, cintas, redundancia física' },
    { n: 'Redes y centro de datos', horas: 20, control: 0.06, ej: 'switches, cableado, energía, refrigeración' },
  ];
  const N = FILAS.length;
  const MODELOS = [[0, 'Local (propio)'], [4, 'IaaS'], [7, 'PaaS'], [9, 'SaaS']];
  const nombreModelo = (k) => { const m = MODELOS.find((x) => x[0] === k); return m ? m[1] : 'Mixto'; };
  // k = filas (desde abajo) que administra el proveedor. A cargo del cliente: las N − k de arriba.
  const horasCliente = (k) => FILAS.slice(0, N - k).reduce((s, f) => s + f.horas, 0);
  const controlCliente = (k) => FILAS.slice(0, N - k).reduce((s, f) => s + f.control, 0);

  /* ---------- Fig. 1: la línea de responsabilidad ---------- */

  function montarLinea(cuerpo) {
    let k = 4, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({
      etiqueta: 'Modelo de servicio', opciones: [...MODELOS.map(([v, t]) => [String(v), t]), ['otro', 'Mixto (a medida)']], valor: '4',
      alCambiar: (v) => { if (v !== 'otro') { k = +v; r.valor = k; dibujar(); } },
    });
    const r = ctl.rango({ etiqueta: 'Capas a cargo del proveedor', min: 0, max: N, valor: k, alCambiar: (v) => { k = v; sincronizar(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => N * 36 + 16 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'lo administra su organización' },
      { color: C.s3, texto: 'lo administra el proveedor' },
      { color: C.tinta, texto: 'línea de responsabilidad', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una capa para mover la línea hasta ella (o use el selector y el control deslizante). Cada capa que pasa al proveedor le quita horas de trabajo, pero también capacidad de decidir. Pase el cursor para ver el detalle.');

    function sincronizar() { sel.valor = MODELOS.some((m) => m[0] === k) ? String(k) : 'otro'; }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      FILAS.forEach((f, i) => {
        const prov = i >= N - k, y = 8 + i * 36;
        ctx.fillStyle = prov ? C.s3 : C.s1;
        ctx.beginPath(); ctx.roundRect(8, y, W - 16, 32, 4); ctx.fill();
        if (i === hover) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = prov ? C.tinta : C.sobre; ctx.font = VIZ.fuente(12, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillText(f.n, 18, y + 16);
        ctx.font = VIZ.fuente(11); ctx.textAlign = 'right';
        ctx.fillText(prov ? 'proveedor' : `${f.horas} h/mes`, W - 18, y + 16);
      });
      const yl = 8 + (N - k) * 36 - 2;
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(2, yl); ctx.lineTo(W - 2, yl); ctx.stroke(); ctx.setLineDash([]);
      const h = horasCliente(k);
      registro.textContent = k === 0
        ? 'Modelo local: su organización administra las nueve capas, desde la red hasta la aplicación.'
        : k === N
          ? 'SaaS: el proveedor administra todo; usted solo usa el servicio y configura lo que éste le permite.'
          : `${nombreModelo(k)}: el proveedor se hace cargo de ${k} capas (hasta «${FILAS[N - k].n}»); usted sigue a cargo de ${N - k}, desde «${FILAS[0].n}» hasta «${FILAS[N - k - 1].n}».`;
      lectura.set([
        ['modelo', nombreModelo(k)],
        ['capas a su cargo', `${N - k} de ${N}`],
        ['trabajo de administración', `${h} h/mes (${VIZ.fmt(h / 160, 3)} personas)`],
        ['horas que asume el proveedor', `${horasCliente(0) - h} h/mes`],
        ['control sobre la solución', `${VIZ.fmt(controlCliente(k) * 100, 3)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const fila = (ev) => { const { x, y } = lienzo.posicion(ev); const i = Math.floor((y - 8) / 36); return { x, y, i: i >= 0 && i < N && (y - 8) % 36 < 32 ? i : -1 }; };
    lienzo.canvas.addEventListener('click', (ev) => {
      const { i } = fila(ev);
      if (i < 0) return;
      k = i >= N - k ? N - i - 1 : N - i; r.valor = k; sincronizar(); dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, i } = fila(ev);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const f = FILAS[i];
      tip.mostrar(x, y, `<b>${f.n}</b><br>${f.ej}<br>trabajo: <b>${f.horas} h/mes</b> · control: <b>${VIZ.fmt(f.control * 100, 2)} %</b><br>hoy lo administra: <b>${i >= N - k ? 'el proveedor' : 'su organización'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: control frente a esfuerzo ---------- */

  const CASOS = {
    libre: { t: 'Ajuste manual', ctrl: 50, horas: 100 },
    startup: { t: 'Empresa nueva con una aplicación web', ctrl: 40, horas: 70 },
    banco: { t: 'Banco con normativa estricta', ctrl: 70, horas: 180 },
    universidad: { t: 'Universidad con sistema académico propio', ctrl: 30, horas: 100 },
    pyme: { t: 'Pyme que solo necesita correo y ofimática', ctrl: 0, horas: 10 },
  };

  function montarControl(cuerpo) {
    let ctrlMin = 50, horasMax = 100, hover = -1, pl = null, recom = -1;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({
      etiqueta: 'Situación', opciones: Object.entries(CASOS).map(([v, c]) => [v, c.t]), valor: 'libre',
      alCambiar: (v) => { if (v === 'libre') return; ctrlMin = CASOS[v].ctrl; horasMax = CASOS[v].horas; rc.valor = ctrlMin; rh.valor = horasMax; dibujar(); },
    });
    const rc = ctl.rango({ etiqueta: 'Control mínimo necesario', min: 0, max: 100, paso: 5, valor: ctrlMin, formato: (v) => `${v} %`, alCambiar: (v) => { ctrlMin = v; sel.valor = 'libre'; dibujar(); } });
    const rh = ctl.rango({ etiqueta: 'Horas de TI disponibles al mes', min: 0, max: 200, paso: 10, valor: horasMax, formato: (v) => `${v} h`, alCambiar: (v) => { horasMax = v; sel.valor = 'libre'; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'modelo recomendado (el que menos trabajo exige)' },
      { color: C.s1, texto: 'modelo que cumple control y horas' },
      { color: C.inactivo, texto: 'modelo que no cumple' },
      { color: VIZ.alfa(C.s6, 0.25), texto: 'zona que cumple ambas restricciones' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una posición de la línea de responsabilidad (0 a 9 capas del proveedor). Elija una situación o mueva los dos controles: la zona verde son los puntos con suficiente control y horas suficientes. Pase el cursor sobre un punto.');

    const pts = Array.from({ length: N + 1 }, (_, k) => ({ k, x: horasCliente(k), y: controlCliente(k) * 100 }));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 210, ymin: 0, ymax: 108 }, { etiquetaX: 'trabajo de administración (h/mes)', etiquetaY: 'control sobre la solución (%)' });
      pl.ejes();
      ctx.fillStyle = VIZ.alfa(C.s6, 0.25);
      ctx.fillRect(pl.sx(0), pl.sy(108), pl.sx(horasMax) - pl.sx(0), pl.sy(ctrlMin) - pl.sy(108));
      VIZ.trazar(ctx, pl, pts.map((p) => [p.x, p.y]), C.eje, 2);
      const ok = pts.filter((p) => p.x <= horasMax + 1e-9 && p.y >= ctrlMin - 1e-9);
      recom = ok.length ? ok.reduce((a, b) => (b.x < a.x ? b : a)).k : -1;
      pts.forEach((p) => {
        const cumple = ok.includes(p);
        VIZ.marcador(ctx, pl.sx(p.x), pl.sy(p.y), p.k === recom ? C.s6 : cumple ? C.s1 : C.inactivo, p.k === recom || p.k === hover ? 7 : MODELOS.some((m) => m[0] === p.k) ? 5.5 : 4);
        if (MODELOS.some((m) => m[0] === p.k)) {
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'bottom'; ctx.textAlign = p.k === 0 ? 'right' : 'left';
          ctx.fillText(nombreModelo(p.k), pl.sx(p.x) + (p.k === 0 ? -9 : 9), pl.sy(p.y) - 8);
        }
      });
      if (recom >= 0) {
        registro.textContent = `Recomendado: ${nombreModelo(recom)}. Deja ${N - recom} capas a su cargo (${VIZ.fmt(controlCliente(recom) * 100, 3)} % de control, ${horasCliente(recom)} h/mes), con ${ok.length} alternativa${ok.length > 1 ? 's' : ''} factible${ok.length > 1 ? 's' : ''}.`;
      } else registro.textContent = 'Ningún modelo cumple a la vez el control exigido y las horas disponibles: relaje una de las dos restricciones o contrate más capacidad.';
      lectura.set([
        ['recomendado', recom >= 0 ? nombreModelo(recom) : 'ninguno'],
        ['alternativas factibles', `${ok.length} de ${N + 1}`],
        ['horas necesarias', recom >= 0 ? `${horasCliente(recom)} de ${horasMax}` : '—'],
        ['control logrado', recom >= 0 ? `${VIZ.fmt(controlCliente(recom) * 100, 3)} % (mínimo ${ctrlMin} %)` : '—'],
        ['más control posible con sus horas', `${VIZ.fmt(Math.max(0, ...pts.filter((p) => p.x <= horasMax + 1e-9).map((p) => p.y)), 3)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = -1, d = 22;
      pts.forEach((p) => { const dd = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (dd < d) { d = dd; mejor = p.k; } });
      if (mejor !== hover) { hover = mejor; dibujar(); }
      if (mejor < 0) return tip.ocultar();
      const p = pts[mejor];
      tip.mostrar(x, y, `<b>${nombreModelo(p.k)}</b> · proveedor a cargo de ${p.k} capas<br>trabajo <b>${p.x} h/mes</b><br>control <b>${VIZ.fmt(p.y, 3)} %</b><br>${p.x <= horasMax + 1e-9 && p.y >= ctrlMin - 1e-9 ? 'cumple sus restricciones' : 'no cumple sus restricciones'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: nube pública, privada e híbrida ---------- */

  // pico y media en vCPU. Costos anuales por vCPU: local dimensionado para el pico y nube pagada por el uso medio.
  const CARGAS = [
    { n: 'Sitio web', sens: 1, pico: 40, media: 10 },
    { n: 'Tienda en línea', sens: 2, pico: 120, media: 25 },
    { n: 'ERP financiero', sens: 4, pico: 24, media: 18 },
    { n: 'Nómina y RR. HH.', sens: 5, pico: 8, media: 5 },
    { n: 'Analítica de ventas', sens: 3, pico: 80, media: 12 },
    { n: 'Correo y colaboración', sens: 3, pico: 30, media: 22 },
    { n: 'Desarrollo y pruebas', sens: 1, pico: 60, media: 8 },
    { n: 'Fichas de clientes', sens: 5, pico: 16, media: 12 },
  ];
  const LOCAL_VCPU = 270;              // 600/5 de amortización + 25 % de 600 en operación, por vCPU al año
  const NUBE_VCPU = 0.045 * 8760;      // precio bajo demanda por vCPU-hora, por 8 760 h
  const ENLACE = 8000;                 // enlace dedicado y gestión de dos entornos, al año
  const costoCarga = (c, publica) => (publica ? c.media * NUBE_VCPU : c.pico * LOCAL_VCPU);

  function costoTotal(pub, maxSens) {
    let t = 0, malas = 0;
    CARGAS.forEach((c, i) => { t += costoCarga(c, pub[i]); if (pub[i] && c.sens > maxSens) malas++; });
    const hibrida = pub.some((x) => x) && pub.some((x) => !x);
    return { total: t + (hibrida ? ENLACE : 0), malas, hibrida };
  }
  function optimo(maxSens) {
    let mejor = null;
    for (let m = 0; m < 1 << CARGAS.length; m++) {
      const pub = CARGAS.map((_, i) => !!(m & (1 << i)));
      const r = costoTotal(pub, maxSens);
      if (r.malas === 0 && (!mejor || r.total < mejor.total)) mejor = { ...r, pub };
    }
    return mejor;
  }

  function montarDespliegue(cuerpo) {
    let pub = CARGAS.map(() => false), maxSens = 3, zonas = [], msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Sensibilidad máxima permitida en nube pública', min: 1, max: 5, valor: maxSens, alCambiar: (v) => { maxSens = v; msg = ''; dibujar(); } });
    ctl.boton('Todo local', () => { pub = CARGAS.map(() => false); msg = 'Todo el trabajo está en su centro de datos: dimensionado para el pico de cada carga.'; dibujar(); });
    ctl.boton('Todo en la nube', () => { pub = CARGAS.map(() => true); msg = 'Todo en la nube pública: se paga por el uso medio, pero las cargas sensibles incumplen la política.'; dibujar(); });
    ctl.boton('Mejor combinación', () => { const o = optimo(maxSens); pub = o.pub.slice(); msg = `Se revisaron las ${1 << CARGAS.length} combinaciones posibles y se eligió la más barata que cumple la política.`; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => CARGAS.length * 46 + 52 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'carga en la nube privada o local' },
      { color: C.s3, texto: 'carga en la nube pública' },
      { color: C.s8, texto: 'incumple la política de sensibilidad' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una carga para pasarla de un lado al otro. Cada una indica su sensibilidad (1 a 5) y sus vCPU de pico y de uso medio. Baje la sensibilidad permitida y vea cuáles quedan obligadas a permanecer en casa; luego pida la mejor combinación.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      zonas = [];
      const pw = (W - 24) / 2;
      [['Privada o local', 0, C.s1], ['Pública', 1, C.s3]].forEach(([t, lado, col]) => {
        const x = 8 + lado * (pw + 8);
        ctx.fillStyle = C.neutro; ctx.fillRect(x, 4, pw, lienzo.alto - 8);
        ctx.fillStyle = col; ctx.fillRect(x, 4, pw, 5);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`Nube ${t.toLowerCase()}`, x + 6, 16);
        let fila = 0;
        CARGAS.forEach((c, i) => {
          if ((pub[i] ? 1 : 0) !== lado) return;
          const y = 40 + fila * 46, mala = pub[i] && c.sens > maxSens;
          ctx.fillStyle = mala ? VIZ.alfa(C.s8, 0.16) : VIZ.alfa(col, 0.18);
          ctx.strokeStyle = mala ? C.s8 : col; ctx.lineWidth = mala ? 3 : 1.5;
          ctx.beginPath(); ctx.roundRect(x + 4, y, pw - 8, 40, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle';
          ctx.fillText(c.n, x + 10, y + 13);
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10);
          ctx.fillText(`sens. ${c.sens} · ${c.pico}/${c.media} vCPU`, x + 10, y + 28);
          zonas.push({ x: x + 4, y, w: pw - 8, h: 40, i });
          fila++;
        });
      });
      const r = costoTotal(pub, maxSens), o = optimo(maxSens);
      const modelo = !r.hibrida ? (pub[0] ? 'pública' : 'privada') : 'híbrida';
      if (msg) registro.textContent = msg;
      else registro.textContent = `Despliegue ${modelo}: ${CARGAS.filter((_, i) => pub[i]).length} cargas en la nube pública y ${CARGAS.filter((_, i) => !pub[i]).length} en casa${r.hibrida ? `, más $${VIZ.entero(ENLACE)} al año del enlace entre ambos entornos` : ''}.`;
      lectura.set([
        ['modelo resultante', modelo],
        ['costo anual', `$${VIZ.entero(r.total)}`],
        ['incumplimientos de política', String(r.malas)],
        ['mejor costo que cumple la política', `$${VIZ.entero(o.total)}`],
        ['diferencia con el mejor', r.malas ? 'no comparable (hay incumplimientos)' : `${r.total - o.total <= 0.5 ? '0' : '+$' + VIZ.entero(r.total - o.total)}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), z = zonas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (!z) return;
      pub[z.i] = !pub[z.i]; msg = `${CARGAS[z.i].n} pasa a la nube ${pub[z.i] ? 'pública' : 'privada'}.`; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), z = zonas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (!z) return tip.ocultar();
      const c = CARGAS[z.i];
      tip.mostrar(x, y, `<b>${c.n}</b><br>pico <b>${c.pico}</b> vCPU · media <b>${c.media}</b> vCPU<br>local: <b>$${VIZ.entero(costoCarga(c, false))}</b>/año<br>pública: <b>$${VIZ.entero(costoCarga(c, true))}</b>/año<br>${c.sens > maxSens ? 'no permitida en nube pública' : 'permitida en nube pública'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('cloud-service-models', {
    intro: String.raw`
      <p>La <strong>computación en la nube</strong> entrega recursos informáticos como un servicio, por Internet, con pago por uso. Lo que distingue a los modelos <strong>IaaS</strong> (infraestructura como servicio),
      <strong>PaaS</strong> (plataforma) y <strong>SaaS</strong> (software) es hasta dónde llega lo que administra el proveedor: cuantas más capas asume, menos trabajo le queda a usted, pero también menos libertad para decidir.</p>
      <p>A eso se suma el <em>dónde</em> se despliega: nube pública, privada o híbrida. Elegir bien es una decisión de gestión que equilibra trabajo disponible, control necesario, sensibilidad de los datos y costo.</p>`,
    visualizaciones: [
      {
        titulo: 'La línea de responsabilidad',
        descripcion: 'Haga clic en una capa para mover la línea entre su organización y el proveedor, o elija IaaS, PaaS y SaaS. Observe cómo cae el trabajo en horas al mes cuando el proveedor asume más capas.',
        montar: montarLinea,
      },
      {
        titulo: 'Control frente a esfuerzo',
        descripcion: 'Exija un nivel de control y fije las horas de TI que tiene. Pruebe las situaciones predefinidas (banco, pyme, empresa nueva) y vea qué modelo cumple ambas condiciones con el menor trabajo.',
        montar: montarControl,
      },
      {
        titulo: 'Nube pública, privada o híbrida',
        descripcion: 'Reparta ocho cargas entre su centro de datos y la nube pública. Baje la sensibilidad permitida y vea cuáles deben volver a casa; luego pida la combinación más barata que cumple la política.',
        montar: montarDespliegue,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Según la definición del NIST, la nube es un modelo que da acceso por red, bajo demanda, a un conjunto compartido de recursos configurables. Sus cinco características son: <em>autoservicio</em> bajo demanda, acceso amplio por red,
      agrupación de recursos, <em>elasticidad</em> rápida y servicio medido. Los tres modelos de servicio se distinguen por la capa donde empieza la responsabilidad del cliente:</p>
      <table>
        <tr><th>Modelo</th><th>El proveedor administra</th><th>Usted administra</th><th>Ejemplo</th></tr>
        <tr><td>Local</td><td>nada</td><td>las 9 capas</td><td>servidores propios</td></tr>
        <tr><td>IaaS</td><td>red, almacenamiento, servidores, virtualización</td><td>sistema operativo hacia arriba</td><td>máquinas virtuales en la nube</td></tr>
        <tr><td>PaaS</td><td>además: sistema operativo, <em>middleware</em>, ejecución</td><td>aplicación y datos</td><td>plataforma para publicar aplicaciones</td></tr>
        <tr><td>SaaS</td><td>todo</td><td>solo el uso y la configuración</td><td>correo, CRM, ofimática en línea</td></tr>
      </table>
      <h2>Compromiso entre control y esfuerzo</h2>
      <p>Sea \(w_j\) el trabajo mensual de la capa \(j\) y \(g_j\) el peso de su control (\(\sum g_j = 1\)). Si el proveedor asume las \(k\) capas inferiores, el cliente conserva</p>
      \[ H(k) = \sum_{j \le N-k} w_j \quad\text{horas al mes}, \qquad G(k) = \sum_{j \le N-k} g_j \quad\text{de control}. \]
      <p>Ambas son decrecientes en \(k\). Con el trabajo disponible \(H_{\max}\) y el control exigido \(G_{\min}\), el modelo recomendado es el \(k\) más grande con \(H(k) \le H_{\max}\) y \(G(k) \ge G_{\min}\): el que más trabajo delega sin perder el control necesario.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con las ponderaciones de la figura (200 h/mes en total, 160 h por persona):</p>
      <table>
        <tr><th>Modelo</th><th>Horas/mes a su cargo</th><th>Personas equivalentes</th><th>Control</th></tr>
        <tr><td>Local</td><td>200</td><td>1,25</td><td>100 %</td></tr>
        <tr><td>IaaS</td><td>120</td><td>0,75</td><td>72 %</td></tr>
        <tr><td>PaaS</td><td>64</td><td>0,40</td><td>40 %</td></tr>
        <tr><td>SaaS</td><td>0</td><td>0</td><td>0 %</td></tr>
      </table>
      <p>Un banco que exige al menos 70 % de control y dispone de 180 horas queda en IaaS (\(120 \le 180\), \(72 \ge 70\)); una pyme con 10 horas y sin necesidad de personalizar, en SaaS.</p>
      <h2>Modelos de despliegue</h2>
      <p>La nube <em>pública</em> es operada por un tercero para muchos clientes; la <em>privada</em> es de uso exclusivo de una organización (en su propio centro de datos o alojada); la <em>híbrida</em> combina ambas y exige un enlace y una gestión común.
      Una regla práctica: lo que tiene datos sensibles o carga estable y predecible tiende a quedarse en casa; lo que tiene picos, es poco sensible o es experimental, a la nube pública. Si el costo de una carga en el lugar \(\ell\) es \(c_\ell\), la mejor
      combinación minimiza</p>
      \[ \sum_i c_{\ell(i)}(i) \;+\; E\cdot\mathbb{1}[\text{hay cargas en ambos lados}] \quad\text{sujeto a}\quad s_i \le s_{\max}\ \text{para toda carga } i \text{ en la nube pública}, \]
      <p>donde \(E\) es el costo del enlace y \(s_i\) la sensibilidad. La figura resuelve exactamente este problema revisando las \(2^8\) asignaciones. Los costos por carga se explican en
      <a href="tema.html?id=cloud-vs-on-premise-costs">costos de la nube y del entorno local</a>.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> La responsabilidad por los <em>datos</em> y el cumplimiento normativo nunca se delega por completo, ni siquiera en SaaS: el proveedor opera la plataforma, pero la organización responde por quién accede y qué guarda.</p></div>
      <h2>Conexiones</h2>
      <p>La línea de responsabilidad recorre las capas de la <a href="tema.html?id=it-infrastructure-layers">infraestructura</a>; IaaS se apoya en la <a href="tema.html?id=virtualization">virtualización</a>; la elasticidad se estudia en
      <a href="tema.html?id=scalability-availability">escalabilidad y disponibilidad</a>; y la decisión de comprar un servicio frente a construirlo, en <a href="tema.html?id=buy-vs-build">comprar o construir software</a>.</p>`,
  });
})();
