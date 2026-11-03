(function () {
  'use strict';
  const { color: C } = VIZ;

  // Supuestos de costo (USD por año), iguales en toda la figura y en la teoría.
  const COSTO_SERVIDOR = 3200;            // servidor físico pequeño: energía, espacio, soporte y amortización
  const costoHost = (cap) => 2000 + 1200 * cap; // host grande: parte fija más una parte por unidad de capacidad
  const SOBRECARGA_VM = 0.02;             // CPU y memoria que consume cada máquina virtual (en servidores equivalentes)

  /* ---------- Fig. 1: consolidación y empaquetado ---------- */

  // Primer ajuste (opcionalmente decreciente): devuelve los hosts como listas de índices.
  function empaquetar(cargas, tope, decreciente) {
    const orden = cargas.map((c, i) => i);
    if (decreciente) orden.sort((a, b) => cargas[b] - cargas[a]);
    const hosts = [];
    for (const i of orden) {
      let h = hosts.find((x) => x.carga + cargas[i] <= tope + 1e-9);
      if (!h) { h = { carga: 0, vms: [] }; hosts.push(h); }
      h.carga += cargas[i]; h.vms.push(i);
    }
    return hosts;
  }

  function montarConsolidacion(cuerpo) {
    let semilla = 1, n = 12, cap = 4, lim = 70, decreciente = true, reserva = true;
    let utils = [], cargas = [], orden = [], pasos = 0, hosts = [], actual = -1, slots = 3, msg = '', zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Servidores físicos actuales', min: 6, max: 24, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Capacidad de cada host', min: 2, max: 8, valor: cap, formato: (v) => `${v} servidores`, alCambiar: (v) => { cap = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Utilización máxima permitida', min: 50, max: 90, paso: 5, valor: lim, formato: (v) => `${v} %`, alCambiar: (v) => { lim = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Orden de colocación', opciones: [['dec', 'De la más pesada a la más liviana'], ['orig', 'En el orden en que llegan']], valor: 'dec', alCambiar: (v) => { decreciente = v === 'dec'; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Host de reserva (N+1)', valor: reserva, alCambiar: (v) => { reserva = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos servidores', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'servidor por virtualizar' },
      { color: C.s2, texto: 'máquina virtual que se coloca ahora' },
      { color: C.s1, texto: 'máquina virtual ya colocada' },
      { color: C.apagado, texto: 'utilización máxima permitida', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La altura de cada bloque es la carga real de un servidor (más la sobrecarga de su máquina virtual). Pulse «Un paso» para colocar cada una en el primer host con espacio; compare las dos formas de ordenar. Pase el cursor sobre un bloque para ver su origen.');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 131 + n);
      utils = Array.from({ length: n }, () => 0.04 + 0.3 * rnd());
      cargas = utils.map((u) => u + SOBRECARGA_VM);
      orden = cargas.map((c, i) => i);
      if (decreciente) orden.sort((a, b) => cargas[b] - cargas[a]);
      slots = Math.max(2, empaquetar(cargas, cap * lim / 100, decreciente).length) + (reserva ? 1 : 0);
      pasos = 0; actual = -1; hosts = [];
      msg = `${n} servidores con utilización media de ${VIZ.fmt(100 * utils.reduce((s, u) => s + u, 0) / n, 3)} %. Hay que decidir en qué host va cada máquina virtual.`;
      return (function* () {
        for (const i of orden) {
          actual = i;
          let h = hosts.find((x) => x.carga + cargas[i] <= cap * lim / 100 + 1e-9);
          msg = h ? `La máquina del servidor ${i + 1} (${VIZ.fmt(cargas[i] * 100, 3)} %) cabe en el host ${hosts.indexOf(h) + 1}.` : `La máquina del servidor ${i + 1} (${VIZ.fmt(cargas[i] * 100, 3)} %) no cabe en ningún host: se enciende uno nuevo.`;
          if (!h) { h = { carga: 0, vms: [] }; hosts.push(h); }
          h.carga += cargas[i]; h.vms.push(i); pasos++;
          yield;
        }
        actual = -1;
        msg = `Listo: ${hosts.length} hosts${reserva ? ' más uno de reserva' : ''} reemplazan a ${n} servidores.`;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      zonas = [];
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('servidores por virtualizar (altura = carga)', 8, 4);
      const bw = Math.min(26, (W - 16) / n), base = 78;
      const pend = orden.slice(pasos);
      pend.forEach((i, k) => {
        const h = Math.max(3, cargas[i] / 0.4 * 48), x = 8 + k * bw;
        ctx.fillStyle = i === actual ? C.s2 : C.inactivo;
        ctx.beginPath(); ctx.roundRect(x + 1, base - h, bw - 2, h, [3, 3, 0, 0]); ctx.fill();
        zonas.push({ x, y: base - h, w: bw, h, i });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(8, base + 0.5); ctx.lineTo(W - 8, base + 0.5); ctx.stroke();
      const top = 108, fondo = H - 34, esc = (fondo - top) / cap, cw = Math.min(100, (W - 16) / slots);
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      ctx.fillStyle = C.apagado; ctx.fillText('hosts con hipervisor', W / 2, 88);
      for (let s = 0; s < slots; s++) {
        const x = 8 + s * cw + 4, w = cw - 8, h = hosts[s];
        const reservaSlot = reserva && s === slots - 1;
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash(reservaSlot ? [4, 3] : []);
        ctx.strokeRect(x, top, w, fondo - top); ctx.setLineDash([]);
        let y = fondo;
        if (h) for (const i of h.vms) {
          const hh = cargas[i] * esc;
          ctx.fillStyle = i === actual ? C.s2 : C.s1; ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.rect(x + 2, y - hh, w - 4, hh); ctx.fill(); ctx.stroke();
          zonas.push({ x: x + 2, y: y - hh, w: w - 4, h: hh, i });
          y -= hh;
        }
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10);
        ctx.fillText(reservaSlot ? 'reserva' : `host ${s + 1}`, x + w / 2, fondo + 4);
        if (h) { ctx.fillStyle = C.tinta; ctx.fillText(`${VIZ.fmt(100 * h.carga / cap, 3)} %`, x + w / 2, fondo + 16); }
      }
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
      const yl = fondo - (cap * lim / 100) * esc;
      ctx.beginPath(); ctx.moveTo(8, yl); ctx.lineTo(W - 8, yl); ctx.stroke(); ctx.setLineDash([]);
      registro.textContent = msg;
      const antes = utils.reduce((s, u) => s + u, 0) / n, total = cargas.reduce((s, c) => s + c, 0);
      const usados = hosts.length + (reserva && pasos === n ? 1 : 0);
      const cLocal = n * COSTO_SERVIDOR, cVirt = usados * costoHost(cap);
      lectura.set([
        ['servidores físicos', `${n} → ${pasos === n ? usados : '…'}`],
        ['utilización media', `${VIZ.fmt(antes * 100, 3)} % → ${pasos === n ? VIZ.fmt(100 * total / (hosts.length * cap), 3) + ' %' : '…'}`],
        ['mínimo teórico de hosts', String(Math.ceil(total / (cap * lim / 100) - 1e-9))],
        ['costo anual', pasos === n ? `$${VIZ.entero(cLocal)} → $${VIZ.entero(cVirt)}` : `$${VIZ.entero(cLocal)} → …`],
        ['ahorro', pasos === n ? `${VIZ.fmt(100 * (1 - cVirt / cLocal), 3)} %` : '…'],
      ]);
    }
    lienzo.alDibujar = () => utils.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const z = zonas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (!z) return tip.ocultar();
      tip.mostrar(x, y, `servidor <b>${z.i + 1}</b><br>utilización actual <b>${VIZ.fmt(utils[z.i] * 100, 3)} %</b><br>como máquina virtual <b>${VIZ.fmt(cargas[z.i] * 100, 3)} %</b> de un servidor`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: sobreasignación ---------- */

  const NUCLEOS_HOST = 32, VCPU_POR_VM = 4, PUNTOS = 96;
  function montarSobreasignacion(cuerpo) {
    let semilla = 1, nvm = 24, util = 20, escalonado = true, total = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Máquinas virtuales en el host', min: 4, max: 60, valor: nvm, alCambiar: (v) => { nvm = v; calcular(); } });
    ctl.rango({ etiqueta: 'Uso medio de cada vCPU', min: 5, max: 60, valor: util, formato: (v) => `${v} %`, alCambiar: (v) => { util = v; calcular(); } });
    ctl.selector({ etiqueta: 'Horario de los picos', opciones: [['esc', 'Escalonados (cada máquina, a su hora)'], ['sim', 'Simultáneos (todas a la vez)']], valor: 'esc', alCambiar: (v) => { escalonado = v === 'esc'; calcular(); } });
    ctl.boton('Nuevo día', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'demanda total de las máquinas virtuales', forma: 'linea' },
      { color: C.tinta, texto: `núcleos físicos del host (${NUCLEOS_HOST})`, forma: 'linea' },
      { color: C.s8, texto: 'demanda que el host no puede atender' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Cada máquina tiene ${VCPU_POR_VM} vCPU sobre un host de ${NUCLEOS_HOST} núcleos. Suba el número de máquinas hasta pasar de 1:1 y observe cuándo la demanda del día cruza la capacidad real; luego cambie a picos simultáneos. Pase el cursor para ver cada instante (cada 15 minutos).`);

    function calcular() {
      const rnd = VIZ.semilla(semilla * 977 + nvm);
      total = new Array(PUNTOS).fill(0);
      for (let v = 0; v < nvm; v++) {
        const fase = escalonado ? rnd() : 0.0, sesgo = 0.8 + 0.4 * rnd();
        for (let t = 0; t < PUNTOS; t++) {
          const base = (util / 100) * sesgo * (1 + 0.8 * Math.sin(2 * Math.PI * (t / PUNTOS - fase)));
          total[t] += VCPU_POR_VM * Math.max(0, base * (1 + 0.2 * (rnd() - 0.5)));
        }
      }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(NUCLEOS_HOST, ...total) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 24, ymin: 0, ymax }, { etiquetaX: 'hora del día', etiquetaY: 'núcleos', ticksX: [0, 4, 8, 12, 16, 20, 24] });
      pl.ejes();
      const pts = total.map((d, t) => [t * 24 / PUNTOS, d]);
      ctx.save(); pl.recortar();
      ctx.fillStyle = VIZ.alfa(C.s8, 0.35);
      ctx.beginPath(); let abierto = false;
      pts.forEach(([x, y], k) => {
        const yy = pl.sy(Math.max(y, NUCLEOS_HOST));
        if (!abierto) { ctx.moveTo(pl.sx(x), pl.sy(NUCLEOS_HOST)); abierto = true; }
        ctx.lineTo(pl.sx(x), yy);
        if (k === pts.length - 1) ctx.lineTo(pl.sx(x), pl.sy(NUCLEOS_HOST));
      });
      ctx.closePath(); ctx.fill(); ctx.restore();
      VIZ.trazar(ctx, pl, [[0, NUCLEOS_HOST], [24, NUCLEOS_HOST]], C.tinta, 2);
      VIZ.trazar(ctx, pl, pts, C.s1, 2);
      if (hover >= 0) VIZ.marcador(ctx, pl.sx(pts[hover][0]), pl.sy(pts[hover][1]), C.s1, 4);
      const exceso = total.reduce((s, d) => s + Math.max(0, d - NUCLEOS_HOST), 0), suma = total.reduce((s, d) => s + d, 0);
      const sat = total.filter((d) => d > NUCLEOS_HOST).length, pico = Math.max(...total), razon = nvm * VCPU_POR_VM / NUCLEOS_HOST;
      registro.textContent = sat
        ? `Con ${nvm * VCPU_POR_VM} vCPU sobre ${NUCLEOS_HOST} núcleos (${VIZ.fmt(razon, 3)}:1), el host está saturado ${VIZ.fmt(100 * sat / PUNTOS, 3)} % del día: las máquinas esperan CPU y los usuarios lo notan como lentitud.`
        : `Con ${nvm * VCPU_POR_VM} vCPU sobre ${NUCLEOS_HOST} núcleos (${VIZ.fmt(razon, 3)}:1) la demanda nunca supera la capacidad: la sobreasignación es segura para este perfil.`;
      lectura.set([
        ['razón vCPU : núcleos', `${VIZ.fmt(razon, 3)} : 1`],
        ['uso medio del host', `${VIZ.fmt(100 * suma / PUNTOS / NUCLEOS_HOST, 3)} %`],
        ['pico de demanda', `${VIZ.fmt(pico, 3)} núcleos (${VIZ.fmt(100 * pico / NUCLEOS_HOST, 3)} %)`],
        ['tiempo saturado', `${VIZ.fmt(100 * sat / PUNTOS, 3)} %`],
        ['demanda no atendida', `${VIZ.fmt(100 * exceso / suma, 3)} %`],
      ]);
    }
    lienzo.alDibujar = () => total.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const k = Math.max(0, Math.min(PUNTOS - 1, Math.round(pl.ix(x) * PUNTOS / 24)));
      if (k !== hover) { hover = k; dibujar(); }
      const hh = Math.floor(k / 4), mm = (k % 4) * 15;
      tip.mostrar(x, y, `<b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b>` + VIZ.filaTooltip(C.s1, 'demanda', VIZ.fmt(total[k], 3) + ' núcleos') + VIZ.filaTooltip(C.tinta, 'capacidad', NUCLEOS_HOST + ' núcleos') + (total[k] > NUCLEOS_HOST ? VIZ.filaTooltip(C.s8, 'sin atender', VIZ.fmt(total[k] - NUCLEOS_HOST, 3) + ' núcleos') : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (total.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('virtualization', {
    intro: String.raw`
      <p>La <strong>virtualización</strong> permite que un mismo servidor físico ejecute varias máquinas virtuales aisladas entre sí, cada una con su propio sistema operativo y sus aplicaciones.
      Una capa de software, el <em>hipervisor</em>, reparte entre ellas la CPU, la memoria y el almacenamiento.</p>
      <p>Antes de la virtualización cada aplicación solía tener su servidor, que pasaba la mayor parte del tiempo casi ocioso (utilizaciones de 10 a 20 %). Consolidar esas cargas en pocos equipos
      reduce la cantidad de hardware, la energía y el espacio, y hace posible mover cargas entre equipos sin apagarlas. El costo es un problema de empaquetado y un riesgo: si se asigna de más, las máquinas compiten por la CPU.</p>`,
    visualizaciones: [
      {
        titulo: 'Consolidar servidores en hosts',
        descripcion: 'Coloque, una a una, las cargas de varios servidores en hosts virtualizados. Compare el orden «de la más pesada a la más liviana» con el de llegada, baje la utilización máxima permitida y active el host de reserva.',
        montar: montarConsolidacion,
      },
      {
        titulo: 'Sobreasignación de CPU',
        descripcion: 'Agregue máquinas virtuales a un mismo host y vea cuándo la demanda del día cruza su capacidad. Pruebe picos escalonados y simultáneos con la misma razón vCPU : núcleos.',
        montar: montarSobreasignacion,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un <em>hipervisor</em> de tipo 1 se ejecuta directamente sobre el hardware (servidores de centros de datos); uno de tipo 2 lo hace sobre un sistema operativo anfitrión (escritorios y pruebas).
      Cada <em>máquina virtual</em> (MV) ve un hardware virtual propio: vCPU, memoria y discos. Los <em>contenedores</em> son una variante más liviana que comparte el núcleo del sistema operativo.
      Entre las ventajas están la consolidación, el aislamiento, las copias instantáneas y la migración en caliente entre hosts (véase <a href="tema.html?id=virtualization-migration">migración de máquinas virtuales</a>).</p>
      <h2>Consolidación como empaquetado</h2>
      <p>Si la MV \(i\) necesita una fracción \(c_i\) de un servidor equivalente y cada host ofrece \(K\) servidores con utilización máxima \(u\), el tope por host es \(T = K\,u\). Se busca el menor número de hosts \(m\) tal que las cargas
      se repartan sin superar \(T\): el problema de empaquetado (<em>bin packing</em>). Una cota inferior inmediata es</p>
      \[ m \;\ge\; \left\lceil \frac{\sum_i c_i}{T} \right\rceil. \]
      <p>El heurístico <em>primer ajuste</em> coloca cada MV en el primer host con espacio; ordenar antes de mayor a menor carga (<em>primer ajuste decreciente</em>) garantiza a lo más \(\tfrac{11}{9}\,m^{*} + \tfrac{6}{9}\) hosts, siendo \(m^{*}\) el óptimo.
      Los hosts «de reserva» (N+1) permiten sobrevivir a la falla de uno.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Doce servidores con utilización media de 15 % cargan en total \(12 \times 0{,}15 = 1{,}8\) servidores; con \(0{,}02\) de sobrecarga por MV, \(1{,}8 + 12 \times 0{,}02 = 2{,}04\). Con hosts de \(K = 4\) y \(u = 70\,\%\), \(T = 2{,}8\):
      \(\lceil 2{,}04/2{,}8 \rceil = 1\) host, más uno de reserva. Con los costos de la figura (\(3\,200\) por servidor y \(2\,000 + 1\,200K\) por host):</p>
      \[ 12 \times 3\,200 = 38\,400 \ \longrightarrow\ 2 \times (2\,000 + 1\,200 \times 4) = 13\,600, \qquad \text{ahorro} \approx 65\,\%. \]
      <p>La utilización del host activo pasa de 15 % a \(2{,}04/4 = 51\,\%\).</p>
      <h2>Sobreasignación</h2>
      <p>La <em>sobreasignación</em> (<em>overcommit</em>) entrega más vCPU de las que existen físicamente, apostando a que las máquinas no piden CPU al mismo tiempo. Con \(N\) máquinas de \(v\) vCPU y \(P\) núcleos, la razón es \(Nv/P\). Si la demanda
      de cada máquina es \(d_k(t)\), el host se satura cuando</p>
      \[ \sum_{k=1}^{N} d_k(t) \;>\; P. \]
      <p>Con picos independientes la suma fluctúa menos que la capacidad contratada (por eso razones de 3:1 o 4:1 son habituales en cargas de oficina); con picos simultáneos (todos entran a las 9:00), la suma se acerca a \(Nv\,\bar u\,(1+a)\)
      y la misma razón es peligrosa. Memoria y E/S suelen limitar antes que la CPU, y no se sobreasignan con el mismo margen.</p>
      <div class="recuadro"><p><strong>Riesgo.</strong> Consolidar concentra el riesgo: la falla de un host ahora arrastra a muchas aplicaciones a la vez. Por eso se combina con reserva N+1 y con <a href="tema.html?id=scalability-availability">redundancia</a>.</p></div>
      <h2>Conexiones</h2>
      <p>La virtualización es una capa de la <a href="tema.html?id=it-infrastructure-layers">infraestructura</a> y la base de la nube de tipo <a href="tema.html?id=cloud-service-models">IaaS</a>. Su impacto económico se compara con el de un centro de datos propio en
      <a href="tema.html?id=cloud-vs-on-premise-costs">costos de la nube y del entorno local</a>.</p>`,
  });
})();
