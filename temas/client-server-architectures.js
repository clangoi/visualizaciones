(function () {
  'use strict';
  const { color: C } = VIZ;

  const ARQ = [
    { id: 1, nombre: '1 capa (terminales y host central)', corta: '1 capa' },
    { id: 2, nombre: '2 capas (cliente grueso y servidor de datos)', corta: '2 capas' },
    { id: 3, nombre: '3 capas (navegador, aplicaciones y datos)', corta: '3 capas' },
    { id: 4, nombre: 'n capas (con balanceador y caché)', corta: 'n capas' },
  ];
  const MAX_CONEXIONES = 250; // conexiones simultáneas por servidor de datos en la arquitectura de 2 capas

  /* Cada tramo atiende una fracción `f` de las solicitudes y tarda `ms` por solicitud en cada uno de sus `c` servidores.
     `roles` indica dónde corren la presentación (P), la lógica de negocio (L) y los datos (D). Los tramos `local` corren en el equipo del usuario. */
  function tramos(id, apps, dbs) {
    switch (id) {
      case 1: return [
        { n: 'Terminales', roles: '', local: true, d: 'pantallas y teclados sin capacidad de cómputo propia' },
        { n: 'Host central', roles: 'PLD', ms: 32, c: 2, f: 1, d: 'un computador central de 2 procesadores hace todo el trabajo' },
      ];
      case 2: return [
        { n: 'PC cliente', roles: 'PL', local: true, d: 'cliente grueso: la aplicación instalada hace presentación y lógica en cada PC' },
        { n: 'Datos', roles: 'D', ms: 14, c: dbs, f: 1, conex: MAX_CONEXIONES * dbs, d: 'servidor de base de datos: ejecuta consultas y validaciones, y mantiene una conexión por cliente' },
      ];
      case 3: return [
        { n: 'Navegador', roles: 'P', local: true, d: 'cliente delgado: solo muestra páginas' },
        { n: 'Apps', roles: 'L', ms: 20, c: apps, f: 1, d: 'servidores de aplicaciones: lógica de negocio con un conjunto compartido de conexiones a datos' },
        { n: 'Datos', roles: 'D', ms: 8, c: dbs, f: 1, d: 'servidor de base de datos: solo consultas' },
      ];
      default: return [
        { n: 'Navegador', roles: 'P', local: true, d: 'cliente delgado: solo muestra páginas' },
        { n: 'Caché web', roles: 'P', ms: 1, c: 2, f: 1, d: 'balanceador y caché: sirve el 40 % de las solicitudes sin llegar a la lógica' },
        { n: 'Apps', roles: 'L', ms: 20, c: apps, f: 0.6, d: 'servidores de aplicaciones: reciben el 60 % de las solicitudes' },
        { n: 'Datos', roles: 'D', ms: 8, c: dbs, f: 0.3, d: 'base de datos: la caché de datos absorbe la mitad de las consultas, recibe el 30 %' },
      ];
    }
  }
  const SALTOS = { 1: 1, 2: 1, 3: 2, 4: 3 };

  // Evalúa una arquitectura con N clientes que generan `rpm` solicitudes por minuto cada uno.
  function evaluar(id, N, rpm, apps, dbs, salto) {
    const ts = tramos(id, apps, dbs), lamC = rpm / 60;
    let W = SALTOS[id] * salto / 1000, estable = true, razon = '';
    const res = ts.map((t) => {
      if (t.local) return { ...t, lam: 0, rho: 0, W: 0 };
      const lam = N * lamC * t.f, q = lam > 0 ? VIZ.si.cola(lam, 1000 / t.ms, t.c) : { estable: true, rho: 0, Wq: 0, W: t.ms / 1000 };
      if (!q.estable) estable = false;
      if (t.conex && N > t.conex) { estable = false; razon = 'conexiones agotadas'; }
      W += q.W;
      return { ...t, lam, rho: q.rho, W: q.W, cola: q };
    });
    if (!estable && !razon) razon = 'capa saturada';
    const nmax = ts.map((t) => (t.local ? Infinity : Math.min(t.c * (1000 / t.ms) / (t.f * lamC), t.conex || Infinity)));
    const maxClientes = Math.min(...nmax), cuello = nmax.indexOf(maxClientes);
    return { tramos: res, W: estable ? W : Infinity, estable, razon, maxClientes, cuello };
  }
  const ms = (s) => (Number.isFinite(s) ? `${VIZ.fmt(s * 1000, 3)} ms` : 'sin servicio');

  /* ---------- Fig. 1: tramos y carga ---------- */

  function montarCapas(cuerpo) {
    let id = 3, N = 600, rpm = 6, apps = 2, dbs = 1, cajas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Arquitectura', opciones: ARQ.map((a) => [String(a.id), a.nombre]), valor: '3', alCambiar: (v) => { id = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Clientes conectados', min: 10, max: 3000, paso: 10, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Solicitudes por cliente', min: 2, max: 20, valor: rpm, formato: (v) => `${v} / min`, alCambiar: (v) => { rpm = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Servidores de aplicaciones', min: 1, max: 6, valor: apps, alCambiar: (v) => { apps = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Servidores de datos', min: 1, max: 3, valor: dbs, alCambiar: (v) => { dbs = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 168 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'utilización menor que 70 %' },
      { color: VIZ.alfa(C.s4, 0.3), borde: C.s4, texto: '70 % a 100 %' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'saturado: la cola crece sin límite' },
      { color: C.neutro, borde: C.eje, texto: 'corre en el equipo del usuario' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada caja es un tramo de la arquitectura; las letras P, L y D marcan dónde corren la presentación, la lógica y los datos (azul = sí). Suba los clientes hasta que un tramo se ponga rojo, agregue servidores a ese tramo y compare arquitecturas. Pase el cursor sobre un tramo.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ev = evaluar(id, N, rpm, apps, dbs, 5), n = ev.tramos.length, gap = 16;
      const bw = Math.min(130, (W - 16 - gap * (n - 1)) / n), x0 = (W - (n * bw + gap * (n - 1))) / 2;
      cajas = [];
      ev.tramos.forEach((t, i) => {
        const x = x0 + i * (bw + gap), y = 8, h = 150;
        const col = t.local ? C.eje : t.rho >= 1 ? C.s8 : t.rho >= 0.7 ? C.s4 : C.s6;
        if (i) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - gap + 2, y + 40); ctx.lineTo(x - 2, y + 40); ctx.stroke();
          ctx.fillStyle = C.apagado; ctx.beginPath(); ctx.moveTo(x - 2, y + 40); ctx.lineTo(x - 8, y + 36); ctx.lineTo(x - 8, y + 44); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = t.local ? C.neutro : VIZ.alfa(col, 0.2); ctx.strokeStyle = col; ctx.lineWidth = t.local ? 1.5 : 2.5;
        ctx.beginPath(); ctx.roundRect(x, y, bw, h, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = VIZ.fuente(11, 600); ctx.fillText(t.n, x + bw / 2, y + 14);
        'PLD'.split('').forEach((r, k) => {
          const sx = x + bw / 2 + (k - 1) * 22, on = t.roles.includes(r);
          ctx.fillStyle = on ? C.s1 : C.rejilla; ctx.beginPath(); ctx.roundRect(sx - 9, y + 28, 18, 18, 3); ctx.fill();
          ctx.fillStyle = on ? C.sobre : C.apagado; ctx.font = VIZ.fuente(10, 600); ctx.fillText(r, sx, y + 37);
        });
        ctx.fillStyle = C.tinta;
        if (t.local) {
          ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText('sin cola', x + bw / 2, y + 70); ctx.fillText(`${VIZ.entero(N)} equipos`, x + bw / 2, y + 86);
        } else {
          ctx.font = VIZ.fuente(14, 600); ctx.fillText(`${VIZ.fmt(Math.min(t.rho, 9.99) * 100, 3)} %`, x + bw / 2, y + 68);
          ctx.fillStyle = C.rejilla; ctx.fillRect(x + 8, y + 82, bw - 16, 9);
          ctx.fillStyle = col; ctx.fillRect(x + 8, y + 82, (bw - 16) * Math.min(1, t.rho), 9);
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10);
          ctx.fillText(`${VIZ.fmt(t.lam, 3)} sol/s`, x + bw / 2, y + 106);
          ctx.fillText(`${t.ms} ms × ${t.c}`, x + bw / 2, y + 122);
          ctx.fillText(t.rho >= 1 ? 'saturado' : `espera ${ms(t.cola.Wq)}`, x + bw / 2, y + 138);
        }
        cajas.push({ x, y, w: bw, h, t });
      });
      const ult = ev.tramos[ev.cuello];
      registro.textContent = ev.estable
        ? `Con ${VIZ.entero(N)} clientes, el tramo más cargado es «${ev.tramos.reduce((a, b) => (b.rho > a.rho ? b : a)).n}» con ${VIZ.fmt(Math.max(...ev.tramos.map((t) => t.rho)) * 100, 3)} % de utilización; el sistema aguanta hasta unos ${VIZ.entero(ev.maxClientes)} clientes.`
        : `Con ${VIZ.entero(N)} clientes el sistema se cuelga (${ev.razon}): «${ev.tramos.find((t) => t.rho >= 1 || (t.conex && N > t.conex)).n}» no da abasto. Capacidad máxima: unos ${VIZ.entero(ev.maxClientes)} clientes; agregue servidores en ese tramo.`;
      lectura.set([
        ['carga total', `${VIZ.fmt(N * rpm / 60, 3)} solicitudes/s`],
        ['tramo cuello de botella', ult.n],
        ['clientes máximos', VIZ.entero(ev.maxClientes)],
        ['margen sobre los clientes actuales', `${VIZ.fmt((ev.maxClientes / N - 1) * 100, 3)} %`],
        ['tiempo de respuesta (red 5 ms por salto)', ms(ev.W)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = cajas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (!b) return tip.ocultar();
      const t = b.t;
      tip.mostrar(x, y, `<b>${t.n}</b><br>${t.d}` + (t.local ? '' : `<br>llegan <b>${VIZ.fmt(t.lam, 3)}</b> sol/s (${VIZ.fmt(t.f * 100, 3)} % del total)<br>capacidad <b>${VIZ.fmt(t.c * 1000 / t.ms, 3)}</b> sol/s<br>respuesta del tramo <b>${ms(t.W)}</b>` + (t.conex ? `<br>conexiones: ${VIZ.entero(N)} de ${t.conex}` : '')));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: tiempo de respuesta con cola ---------- */

  function montarRespuesta(cuerpo) {
    let N = 600, rpm = 6, apps = 2, salto = 5, meta = 200, hover = -1, pl = null;
    const XMAX = 3000, YMAX = 500, paso = 25;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Clientes (marca vertical)', min: 0, max: XMAX, paso: 50, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Solicitudes por cliente', min: 2, max: 20, valor: rpm, formato: (v) => `${v} / min`, alCambiar: (v) => { rpm = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Servidores de aplicaciones', min: 1, max: 6, valor: apps, alCambiar: (v) => { apps = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Latencia de red por salto', min: 1, max: 40, valor: salto, formato: (v) => `${v} ms`, alCambiar: (v) => { salto = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Respuesta aceptable', min: 50, max: YMAX, paso: 10, valor: meta, formato: (v) => `${v} ms`, alCambiar: (v) => { meta = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...ARQ.map((a, i) => ({ color: VIZ.series[i], texto: a.corta, forma: 'linea' })),
      { color: C.apagado, texto: 'respuesta aceptable', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada curva es el tiempo medio de respuesta (cola más servicio en cada tramo, más la red). Observe que la curva sube verticalmente al acercarse a la saturación de su tramo más débil. Mueva la marca de clientes y pase el cursor para comparar.');

    const curvas = () => ARQ.map((a) => {
      const pts = [];
      for (let n = 0; n <= XMAX; n += paso) { const e = evaluar(a.id, n, rpm, apps, 1, salto); pts.push([n, e.estable ? e.W * 1000 : NaN]); }
      return pts;
    });
    let datos = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      datos = curvas();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: XMAX, ymin: 0, ymax: YMAX }, { etiquetaX: 'clientes', etiquetaY: 'respuesta (ms)' });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, meta], [XMAX, meta]], C.apagado, 1.5, [3, 4]);
      ctx.save(); pl.recortar();
      datos.forEach((pts, i) => VIZ.trazar(ctx, pl, pts, VIZ.series[i], 2));
      ctx.restore();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.sx(N), pl.y0); ctx.lineTo(pl.sx(N), pl.y1); ctx.stroke();
      const ult = hover >= 0 ? hover : -1;
      if (ult >= 0) datos.forEach((pts, i) => { if (Number.isFinite(pts[ult][1]) && pts[ult][1] <= YMAX) VIZ.marcador(ctx, pl.sx(pts[ult][0]), pl.sy(pts[ult][1]), VIZ.series[i], 4); });
      const evs = ARQ.map((a) => evaluar(a.id, N, rpm, apps, 1, salto));
      const dentro = datos.map((pts) => { let m = 0; for (const [n, w] of pts) { if (Number.isFinite(w) && w <= meta) m = n; else break; } return m; });
      registro.textContent = `Con ${VIZ.entero(N)} clientes: ${ARQ.map((a, i) => `${a.corta} ${ms(evs[i].W)}`).join(' · ')}. Dentro de ${meta} ms soportan hasta ${ARQ.map((a, i) => `${a.corta}: ${VIZ.entero(dentro[i])}`).join(', ')} clientes.`;
      lectura.set(ARQ.map((a, i) => [`${a.corta}: respuesta con ${VIZ.entero(N)} clientes`, `${ms(evs[i].W)}${evs[i].estable ? '' : ` (${evs[i].razon})`}`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const k = Math.max(0, Math.min(datos[0].length - 1, Math.round(pl.ix(x) / paso)));
      if (k !== hover) { hover = k; dibujar(); }
      tip.mostrar(x, y, `<b>${VIZ.entero(datos[0][k][0])}</b> clientes` + ARQ.map((a, i) => VIZ.filaTooltip(VIZ.series[i], a.corta, Number.isFinite(datos[i][k][1]) ? `${VIZ.fmt(datos[i][k][1], 3)} ms` : 'sin servicio')).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('client-server-architectures', {
    intro: String.raw`
      <p>Una aplicación empresarial reparte tres tareas: <strong>presentación</strong> (lo que ve el usuario), <strong>lógica de negocio</strong> (las reglas) y <strong>datos</strong> (su almacenamiento). La arquitectura <em>cliente-servidor</em>
      decide en qué equipo corre cada una. Con una sola capa todo vive en un computador central; con dos, el cliente hace presentación y lógica y consulta un servidor de datos; con tres o más, la lógica se separa en servidores propios y el
      cliente puede ser un simple navegador.</p>
      <p>Cada decisión cambia dónde se acumula el trabajo y, con él, dónde se forma la fila de espera. Un sistema no se cuelga porque «tenga poca capacidad» en general, sino porque un tramo concreto se satura: ese es el cuello de botella,
      y mejorar cualquier otro tramo no cambia nada.</p>`,
    visualizaciones: [
      {
        titulo: 'Tramos, roles y cuello de botella',
        descripcion: 'Elija una arquitectura y suba los clientes: el primer tramo en ponerse rojo es el cuello de botella. Agregue servidores solo a ese tramo y compare cuántos clientes más soporta el sistema.',
        montar: montarCapas,
      },
      {
        titulo: 'Tiempo de respuesta con muchos clientes',
        descripcion: 'Compare las cuatro arquitecturas en una sola gráfica: con pocos clientes gana la más simple, y con muchos la que reparte mejor el trabajo. Suba la latencia de red y vea cuál sufre más.',
        montar: montarRespuesta,
      },
    ],
    teoria: String.raw`
      <h2>Arquitecturas</h2>
      <table>
        <tr><th>Arquitectura</th><th>Cliente</th><th>Dónde corre la lógica</th><th>Ventaja</th><th>Límite</th></tr>
        <tr><td>1 capa</td><td>terminal sin proceso propio</td><td>host central</td><td>administración centralizada</td><td>el host es el cuello de botella para todo</td></tr>
        <tr><td>2 capas</td><td>grueso (aplicación instalada)</td><td>en cada cliente</td><td>reparte el cómputo entre los PC</td><td>una conexión por cliente; actualizar cada PC</td></tr>
        <tr><td>3 capas</td><td>delgado (navegador)</td><td>servidores de aplicaciones</td><td>escala por capa; los clientes no se instalan</td><td>más piezas y más saltos de red</td></tr>
        <tr><td>n capas</td><td>delgado</td><td>varios servicios</td><td>caché, balanceo, escalar cada tramo</td><td>complejidad operativa</td></tr>
      </table>
      <h2>Carga por tramo y cuello de botella</h2>
      <p>Si cada cliente genera \(\lambda_c\) solicitudes por segundo y al tramo \(i\) llega la fracción \(f_i\), la tasa de llegadas es \(\lambda_i = N\,\lambda_c\,f_i\). Con \(c_i\) servidores que atienden cada uno a \(\mu_i = 1/s_i\) solicitudes por segundo (\(s_i\) es el tiempo de servicio),
      la utilización es</p>
      \[ \rho_i = \frac{\lambda_i}{c_i\,\mu_i}. \]
      <p>El tramo con mayor \(\rho_i\) es el cuello de botella, y el número máximo de clientes que soporta el sistema es \(N_{\max} = \min_i \dfrac{c_i\,\mu_i}{\lambda_c\,f_i}\) (y, en dos capas, también el límite de conexiones del servidor de datos).</p>
      <h2>Tiempo de respuesta con cola</h2>
      <p>Cada tramo se modela como una cola M/M/c (fórmula de Erlang C). Con \(a = \lambda/\mu\) y \(\rho = a/c\):</p>
      \[ P_{\text{espera}} = \frac{\dfrac{a^c}{c!\,(1-\rho)}}{\displaystyle\sum_{k=0}^{c-1}\frac{a^k}{k!} + \dfrac{a^c}{c!\,(1-\rho)}}, \qquad W_q = \frac{P_{\text{espera}}\,\rho}{\lambda\,(1-\rho)}, \qquad W = W_q + \frac{1}{\mu}. \]
      <p>El tiempo de respuesta total es la suma de \(W\) de cada tramo más la latencia de los saltos de red. Cuando \(\rho \to 1\), \(W_q \to \infty\): la curva se vuelve vertical y el sistema «se cuelga».</p>
      <h2>Ejemplo resuelto</h2>
      <p>Arquitectura de 3 capas con 600 clientes que hacen 6 solicitudes por minuto (\(\lambda = 60\) sol/s), 2 servidores de aplicaciones de 20 ms (\(\mu = 50\)) y un servidor de datos de 8 ms (\(\mu = 125\)).</p>
      <p><strong>Aplicaciones:</strong> \(a = 1{,}2\), \(\rho = 0{,}6\), \(P_{\text{espera}} = \dfrac{1{,}8}{2{,}2 + 1{,}8} = 0{,}45\), \(W_q = \dfrac{0{,}45 \times 0{,}6}{60 \times 0{,}4} = 11{,}3\) ms y \(W = 31{,}3\) ms.
      <strong>Datos:</strong> \(\rho = 0{,}48\) y \(W = \dfrac{1}{125 - 60} = 15{,}4\) ms. Con dos saltos de 5 ms:</p>
      \[ W_{\text{total}} \approx 31{,}3 + 15{,}4 + 10 \approx 56{,}6\ \text{ms}. \]
      <p>El cuello de botella son las aplicaciones (\(N_{\max} = 2 \times 50 / 0{,}1 = 1\,000\) clientes); un tercer servidor lo lleva a 1 500, momento en que el límite pasa a ser el servidor de datos (1 250).</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Con carga baja gana la arquitectura con menos saltos; con carga alta, la que permite escalar el tramo saturado. Un cliente delgado además reduce el trabajo de instalar y actualizar software en cada equipo.</p></div>
      <h2>Conexiones</h2>
      <p>Cada tramo se puede replicar para escalar y para tolerar fallas: véase <a href="tema.html?id=scalability-availability">escalabilidad y disponibilidad</a> y el reparto de solicitudes en
      <a href="tema.html?id=scalability-load-balancing">balanceo de carga</a>. Los tramos son capas de la <a href="tema.html?id=it-infrastructure-layers">infraestructura</a> y pueden contratarse como servicio en la nube
      (<a href="tema.html?id=cloud-service-models">IaaS, PaaS y SaaS</a>).</p>`,
  });
})();
