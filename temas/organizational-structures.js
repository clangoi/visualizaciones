(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: estructuras como redes de comunicación ---------- */

  const TIPOS = [['jerarquica', 'Jerárquica (funcional)'], ['matricial', 'Matricial (jefe funcional y de proyecto)'], ['red', 'En red (equipos conectados)']];
  const NPM = 3; // coordinadores de proyecto de la estructura matricial

  // Grafo de la organización: nodos con posición normalizada y aristas con peso (1 = salto normal, 1.5 = negociación entre dos jefes).
  function construir(tipo, n, s) {
    const nodos = [], aristas = [], vistos = new Set();
    const unir = (a, b, w = 1, pm = false) => {
      if (a === b) return;
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (vistos.has(k)) return;
      vistos.add(k); aristas.push({ a, b, w, pm });
    };
    if (tipo === 'red') {
      const k = Math.max(1, Math.floor(s / 2)), rnd = VIZ.semilla(7 + n);
      for (let i = 0; i < n; i++) {
        const ang = (2 * Math.PI * i) / n - Math.PI / 2;
        nodos.push({ i, nivel: 0, hijos: 0, x: 0.5 + 0.43 * Math.cos(ang), y: 0.5 + 0.44 * Math.sin(ang) });
        for (let d = 1; d <= k; d++) unir(i, (i + d) % n);
      }
      for (let j = 0; j < Math.round(n / 6); j++) unir(Math.floor(rnd() * n), Math.floor(rnd() * n));
    } else {
      const nivel = [];
      for (let i = 0; i < n; i++) {
        const padre = i ? Math.floor((i - 1) / s) : -1;
        nivel[i] = padre < 0 ? 0 : nivel[padre] + 1;
        nodos.push({ i, padre, nivel: nivel[i], hijos: 0 });
        if (padre >= 0) { nodos[padre].hijos++; unir(padre, i); }
      }
      const L = Math.max(...nivel) + (tipo === 'matricial' ? 1 : 0), cuenta = {}, vistoN = {};
      nodos.forEach((o) => { cuenta[o.nivel] = (cuenta[o.nivel] || 0) + 1; });
      nodos.forEach((o) => {
        vistoN[o.nivel] = (vistoN[o.nivel] || 0) + 1;
        o.x = vistoN[o.nivel] / (cuenta[o.nivel] + 1);
        o.y = 0.07 + (0.86 * o.nivel) / Math.max(1, L);
      });
      if (tipo === 'matricial') {
        for (let p = 0; p < NPM; p++) nodos.push({ i: n + p, nivel: L, hijos: 0, pm: true, x: (p + 1) / (NPM + 1), y: 0.93 });
        nodos.forEach((o) => { if (!o.pm && o.i > 0 && o.hijos === 0) unir(o.i, n + (o.i % NPM), 1.5, true); });
      }
    }
    return { nodos, aristas };
  }

  // Caminos mínimos (Floyd–Warshall) con reconstrucción de la ruta.
  function caminos(g) {
    const N = g.nodos.length, d = Array.from({ length: N }, () => Array(N).fill(Infinity)), nx = Array.from({ length: N }, () => Array(N).fill(-1));
    for (let i = 0; i < N; i++) { d[i][i] = 0; nx[i][i] = i; }
    g.aristas.forEach(({ a, b, w }) => { d[a][b] = d[b][a] = w; nx[a][b] = b; nx[b][a] = a; });
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (d[i][k] + d[k][j] < d[i][j] - 1e-9) { d[i][j] = d[i][k] + d[k][j]; nx[i][j] = nx[i][k]; }
    }
    const ruta = (a, b) => { const r = [a]; while (a !== b && nx[a][b] >= 0) { a = nx[a][b]; r.push(a); } return r; };
    return { d, ruta };
  }

  function montarComunicacion(cuerpo) {
    let tipo = 'jerarquica', n = 21, s = 4, demora = 1, a = 20, b = 6, hover = -1, g, cam, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estructura', opciones: TIPOS, valor: tipo, alCambiar: (v) => { tipo = v; armar(); } });
    ctl.rango({ etiqueta: 'Personas', min: 8, max: 40, valor: n, alCambiar: (v) => { n = v; armar(); } });
    ctl.rango({ etiqueta: 'Tramo de control (vínculos por persona en red)', min: 2, max: 8, valor: s, alCambiar: (v) => { s = v; armar(); } });
    ctl.rango({ etiqueta: 'Demora por intermediario', min: 0.25, max: 3, paso: 0.25, valor: demora, formato: (v) => `${v} d`, alCambiar: (v) => { demora = v; dibujar(); } });
    ctl.boton('Dos personas al azar', () => { const r = VIZ.semilla(Date.now() % 100000); a = Math.floor(r() * n); b = Math.floor(r() * n); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'dirección (nodo 0)' }, { color: C.superficie, borde: C.tinta2, texto: 'persona' },
      { color: C.s7, texto: 'coordinador de proyecto' }, { color: C.s1, texto: 'extremos elegidos' },
      { color: C.s2, texto: 'ruta de la decisión', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en dos personas para ver la ruta más corta entre ellas y cuánto tarda una decisión (cada intermediario suma su demora; en la matricial, pasar por un coordinador de proyecto cuesta 1,5 veces). Cambie de estructura con las mismas personas.');

    function armar() {
      g = construir(tipo, n, s); cam = caminos(g);
      a = Math.min(a, n - 1); b = Math.min(b, n - 1);
      if (a === b) b = (a + Math.floor(n / 2)) % n;
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const mx = 24, my = 18, N = g.nodos.length;
      pos = g.nodos.map((o) => [mx + o.x * (W - 2 * mx), my + o.y * (H - 2 * my)]);
      const r = Math.max(5, Math.min(11, W / (Math.sqrt(n) * 7.5)));
      const ruta = cam.ruta(a, b), enRuta = new Set();
      for (let i = 0; i + 1 < ruta.length; i++) enRuta.add(`${Math.min(ruta[i], ruta[i + 1])}-${Math.max(ruta[i], ruta[i + 1])}`);
      g.aristas.forEach(({ a: u, b: v, pm }) => {
        const marca = enRuta.has(`${Math.min(u, v)}-${Math.max(u, v)}`);
        ctx.strokeStyle = marca ? C.s2 : pm ? VIZ.alfa(C.s7, 0.3) : C.eje;
        ctx.lineWidth = marca ? 3.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(...pos[u]); ctx.lineTo(...pos[v]); ctx.stroke();
      });
      g.nodos.forEach((o, i) => {
        const [x, y] = pos[i];
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = o.pm ? C.s7 : i === 0 ? C.tinta : C.superficie; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = o.pm ? C.s7 : C.tinta2; ctx.stroke();
        if (i === a || i === b || i === hover) {
          ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 2 * Math.PI); ctx.lineWidth = 3; ctx.strokeStyle = i === hover && i !== a && i !== b ? C.apagado : C.s1; ctx.stroke();
        }
        if (r >= 8 && !o.pm) { ctx.font = VIZ.fuente(9); ctx.fillStyle = i === 0 ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i), x, y + 0.5); }
      });
      // Métricas sobre las personas (sin coordinadores de proyecto).
      let suma = 0, pares = 0, diam = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { suma += cam.d[i][j]; pares++; diam = Math.max(diam, cam.d[i][j]); }
      const alcance = Math.max(...Array.from({ length: n }, (_, j) => cam.d[0][j]));
      const niveles = tipo === 'red' ? null : Math.max(...g.nodos.filter((o) => !o.pm).map((o) => o.nivel)) + 1;
      const conHijos = g.nodos.filter((o) => o.hijos > 0);
      const tramo = tipo === 'red' ? 2 * g.aristas.length / n : conHijos.reduce((q, o) => q + o.hijos, 0) / conHijos.length;
      const tAB = cam.d[a][b] * demora;
      registro.textContent = `Ruta de ${a} a ${b}: ${ruta.join(' → ')}. Peso de la ruta ${VIZ.fmt(cam.d[a][b])} × ${demora} d = ${VIZ.fmt(tAB)} días hasta tener una decisión acordada.`;
      lectura.set([
        ['niveles', niveles === null ? 'sin niveles' : String(niveles)],
        [tipo === 'red' ? 'vínculos por persona' : 'tramo de control medio', VIZ.fmt(tramo, 3)],
        ['vínculos de coordinación', String(g.aristas.length)],
        ['decisión de A a B', `${VIZ.fmt(tAB, 3)} d`],
        ['decisión media entre pares', `${VIZ.fmt((suma / pares) * demora, 3)} d`],
        ['difundir desde la dirección', `${VIZ.fmt(alcance * demora, 3)} d`],
      ]);
    }
    function cerca(x, y) {
      let mejor = -1, md = 16 * 16;
      pos.forEach(([px, py], i) => { const q = (px - x) ** 2 + (py - y) ** 2; if (q < md) { md = q; mejor = i; } });
      return mejor;
    }
    let primero = true;
    lienzo.alDibujar = () => g && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = cerca(x, y);
      if (i < 0 || g.nodos[i].pm) return;
      if (primero) { a = i; b = i; } else if (i !== a) b = i;
      primero = !primero; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = cerca(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const o = g.nodos[i];
      tip.mostrar(x, y, o.pm ? `<b>Coordinador de proyecto ${i - n + 1}</b><br>conecta personas de distintas áreas` : `<b>Persona ${i}</b>${i === 0 ? ' (dirección)' : ''}<br>${tipo === 'red' ? '' : `nivel ${o.nivel + 1}<br>${o.hijos} subordinado${o.hijos === 1 ? '' : 's'}<br>`}${g.aristas.filter((e) => e.a === i || e.b === i).length} vínculos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (g) dibujar(); });
    armar();
  }

  /* ---------- Fig. 2: cómo las TI aplanan la estructura ---------- */

  const SAL_JEFE = 1.8; // sueldo de un jefe en sueldos operativos
  const capas = (n, s) => { const c = [n]; let x = n; while (x > 1) { x = Math.ceil(x / s); c.push(x); } return c; };
  const smax = (ti) => 4 + 8 * ti; // personas que un jefe puede supervisar bien
  const costoOp = (n, s, ti) => capas(n, s).slice(1).reduce((q, v) => q + v, 0) / n * SAL_JEFE + 0.25 * (s / smax(ti)) ** 2;
  const optimo = (n, ti) => { let m = 2; for (let s = 2; s <= 16; s++) if (costoOp(n, s, ti) < costoOp(n, m, ti)) m = s; return m; };

  function montarAplanar(cuerpo) {
    let n = 400, ti = 0.7, geoP = [], plC = null, hoverS = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Personas operativas', min: 50, max: 2000, paso: 50, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Apoyo de TI a la supervisión', min: 0, max: 1, paso: 0.05, valor: ti, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ti = v; dibujar(); } });
    const lp = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 270 : 300) });
    const tipP = VIZ.tooltip(lp);
    VIZ.subtitulo(cuerpo, 'Costo de supervisión por persona operativa según el tramo de control');
    const lc = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 300 });
    const tipC = VIZ.tooltip(lc);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'sin TI (tramo óptimo 4–5)' }, { color: C.s1, texto: 'con TI' }, { color: C.s2, texto: 'tramo óptimo de cada caso', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Suba el apoyo de TI (tableros, flujos de trabajo, mensajería): el jefe puede coordinar más personas, el tramo óptimo crece y la pirámide pierde niveles. Pase el cursor sobre un nivel o sobre la curva.');

    function dibujar() {
      const s0 = optimo(n, 0), s1 = optimo(n, ti), c0 = capas(n, s0), c1 = capas(n, s1);
      const j0 = c0.slice(1).reduce((q, v) => q + v, 0), j1 = c1.slice(1).reduce((q, v) => q + v, 0);
      // Pirámides
      {
        const { ctx, ancho: W, alto: H } = lp;
        lp.limpiar(); geoP = [];
        const paneles = [[c0, s0, 'Sin TI', C.apagado], [c1, s1, 'Con TI', C.s1]], pw = W / 2, tope = 26, alto = H - tope - 8;
        paneles.forEach(([c, s, titulo, col], k) => {
          const filas = c.length, h = Math.min(30, alto / filas), cx = k * pw + pw / 2, maxW = pw - 36;
          ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(`${titulo}: tramo ${s}, ${filas} niveles`, cx, 4);
          for (let l = 0; l < filas; l++) {
            const cnt = c[filas - 1 - l], w = Math.max(14, (Math.log10(cnt + 1) / Math.log10(n + 1)) * maxW), y = tope + l * h;
            ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(cx - w / 2, y + 1, w, h - 2, 4); ctx.fill();
            ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
            ctx.fillStyle = k === 1 ? C.sobre : C.tinta; ctx.fillText(VIZ.entero(cnt), cx, y + h / 2);
            geoP.push({ x0: cx - w / 2, x1: cx + w / 2, y0: y, y1: y + h, cnt, s, nivel: l, filas, titulo });
          }
        });
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText('ancho en escala logarítmica', W - 4, H - 1);
      }
      // Curvas de costo
      {
        const { ctx } = lc;
        lc.limpiar();
        const pts = (t) => Array.from({ length: 15 }, (_, i) => [i + 2, costoOp(n, i + 2, t)]);
        const ymax = Math.max(...pts(0).map((p) => p[1]), ...pts(ti).map((p) => p[1])) * 1.05;
        plC = VIZ.plano(lc, { xmin: 2, xmax: 16, ymin: 0, ymax }, { etiquetaX: 'tramo de control', etiquetaY: 'costo / sueldo operativo', formatoX: (v) => String(Math.round(v)), ticksX: [2, 4, 6, 8, 10, 12, 14, 16] });
        plC.ejes();
        VIZ.trazar(ctx, plC, pts(0), C.apagado, 2, [5, 4]);
        VIZ.trazar(ctx, plC, pts(ti), C.s1, 2);
        [[s0, 0], [s1, ti]].forEach(([s, t]) => VIZ.marcador(ctx, plC.sx(s), plC.sy(costoOp(n, s, t)), C.s2, 5));
        if (hoverS) VIZ.marcador(ctx, plC.sx(hoverS), plC.sy(costoOp(n, hoverS, ti)), C.s1, 4);
      }
      const k0 = costoOp(n, s0, 0), k1 = costoOp(n, s1, ti);
      registro.textContent = `Con n = ${VIZ.entero(n)}: sin TI el mejor tramo es ${s0} (${c0.length} niveles, ${VIZ.entero(j0)} jefes); con TI es ${s1} (${c1.length} niveles, ${VIZ.entero(j1)} jefes). Una orden tarda ${c0.length * 2} días en bajar sin TI y ${c1.length * 2} con TI (2 días por nivel).`;
      lectura.set([
        ['niveles sin TI → con TI', `${c0.length} → ${c1.length}`],
        ['jefes sin TI → con TI', `${VIZ.entero(j0)} → ${VIZ.entero(j1)}`],
        ['costo por persona sin TI', `${VIZ.fmt(k0, 3)} sueldos`],
        ['costo por persona con TI', `${VIZ.fmt(k1, 3)} sueldos`],
        ['ahorro mensual', `${VIZ.fmt((k0 - k1) * n, 4)} sueldos operativos`],
      ]);
    }
    lp.alDibujar = dibujar; lc.alDibujar = dibujar;
    lp.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lp.posicion(ev), q = geoP.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
      if (!q) return tipP.ocultar();
      tipP.mostrar(x, y, `<b>${q.titulo}</b>, nivel ${q.nivel + 1} de ${q.filas}<br>${VIZ.entero(q.cnt)} persona${q.cnt === 1 ? '' : 's'}${q.nivel < q.filas - 1 ? `<br>cada jefe supervisa ${q.s}` : ''}`);
    });
    lp.canvas.addEventListener('pointerleave', () => tipP.ocultar());
    lc.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lc.posicion(ev);
      if (!plC || !plC.dentro(x, y)) { hoverS = null; tipC.ocultar(); return dibujar(); }
      hoverS = Math.max(2, Math.min(16, Math.round(plC.ix(x)))); dibujar();
      tipC.mostrar(x, y, `tramo <b>${hoverS}</b>` + VIZ.filaTooltip(C.apagado, 'sin TI', VIZ.fmt(costoOp(n, hoverS, 0), 3)) + VIZ.filaTooltip(C.s1, 'con TI', VIZ.fmt(costoOp(n, hoverS, ti), 3)) + `<div>${capas(n, hoverS).length} niveles</div>`);
    });
    lc.canvas.addEventListener('pointerleave', () => { hoverS = null; tipC.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('organizational-structures', {
    intro: String.raw`
      <p>La <strong>estructura organizacional</strong> define quién reporta a quién, cuántas personas supervisa cada jefe (el <em>tramo de control</em>) y por cuántos niveles debe pasar una decisión. Una empresa <em>funcional</em> agrupa por especialidad (ventas, finanzas, operaciones); una <em>divisional</em>, por producto o región; una <em>matricial</em> cruza ambas con jefes de proyecto; una <em>plana o en red</em> reduce los niveles y reparte la coordinación entre equipos.</p>
      <p>Cada estructura es un compromiso entre control, velocidad y costo de coordinación. Las tecnologías de información cambian ese compromiso: si un tablero, un flujo de trabajo o un canal de mensajería entrega la información sin intermediarios, un jefe puede coordinar a más personas y sobran niveles.</p>`,
    visualizaciones: [
      {
        titulo: 'Estructuras como redes de comunicación',
        descripcion: 'Elija dos personas con clic y compare cuántos intermediarios y cuántos días separan una decisión entre ellas. Pruebe cambiar de jerárquica a matricial (aparecen atajos entre áreas) y a red, y suba el tramo de control para ver cómo baja el número de niveles.',
        montar: montarComunicacion,
      },
      {
        titulo: 'Cómo las TI aplanan la pirámide',
        descripcion: 'Aumente el apoyo de TI y observe que el tramo de control óptimo crece, la pirámide pierde niveles y el costo de supervisión por persona baja. Compare organizaciones de 50 y de 2000 personas.',
        montar: montarAplanar,
      },
    ],
    teoria: String.raw`
      <h2>Estructura, niveles y tramo de control</h2>
      <p>Si cada jefe supervisa \(s\) personas y hay \(n\) personas operativas, el nivel \(k\) por encima de la base tiene \(\lceil n / s^k \rceil\) personas y la organización necesita aproximadamente</p>
      \[ L = \lceil \log_s n \rceil \quad \text{niveles gerenciales}, \qquad J \approx \frac{n}{s - 1} \quad \text{jefes}. \]
      <p>Con \(n = 400\): si \(s = 4\), \(L = 5\) y \(J \approx 133\); si \(s = 10\), \(L = 3\) y \(J \approx 44\). Una decisión que cruza la organización recorre hasta \(2L\) enlaces (sube y baja), y cada enlace suma una demora \(d\): el tiempo de decisión crece con \(L\).</p>
      <h2>Costo de coordinación y control</h2>
      <p>El modelo de la segunda figura suma dos costos por persona operativa (medidos en sueldos operativos): el de los jefes, \(\tfrac{J}{n}\,c_J\) con \(c_J = 1{,}8\), que baja al crecer \(s\), y la pérdida de control, que crece cuando \(s\) supera la capacidad \(s_{\max}\) de un jefe:</p>
      \[ c(s) = \frac{c_J}{s - 1} + 0{,}25 \left( \frac{s}{s_{\max}} \right)^2, \qquad s_{\max} = 4 + 8\,\tau, \]
      <p>donde \(\tau \in [0, 1]\) es el apoyo de TI. El mínimo de \(c(s)\) se desplaza hacia tramos mayores cuando \(\tau\) crece: eso es «aplanar». Los números son supuestos didácticos, pero la forma en U es general: pocos subordinados encarecen la estructura; demasiados la vuelven inmanejable.</p>
      <h2>Tipos de estructura</h2>
      <table>
        <tr><th>Estructura</th><th>Ventaja</th><th>Costo</th></tr>
        <tr><td>Funcional</td><td>Especialización, economías de escala</td><td>Silos: las decisiones entre áreas suben hasta la dirección</td></tr>
        <tr><td>Divisional</td><td>Foco en producto o mercado</td><td>Duplicación de funciones</td></tr>
        <tr><td>Matricial</td><td>Atajos entre áreas, uso flexible de especialistas</td><td>Doble reporte: conflictos entre dos jefes (aquí, 1,5 veces la demora)</td></tr>
        <tr><td>Plana / en red</td><td>Rapidez, autonomía</td><td>Más vínculos por persona y menos control central</td></tr>
      </table>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> En la matricial de 21 personas con \(s = 4\), dos operativos de áreas distintas no suben hasta la dirección: si comparten proyecto, pasan por un coordinador (\(2 \times 1{,}5 = 3\) unidades) en lugar de recorrer hasta cuatro enlaces de árbol por cada lado.</p></div>
      <h2>Conexiones</h2>
      <p>La estructura condiciona la <a href="tema.html?id=culture-governance">cultura y gobernanza de TI</a>, el diseño de la <a href="tema.html?id=value-chain">cadena de valor</a> y los <a href="tema.html?id=organizational-levels-is">niveles organizacionales y tipos de sistema</a>. La coordinación entre áreas es también el problema de fondo de los <a href="tema.html?id=cross-department-flow">flujos de información entre departamentos</a>.</p>`,
  });
})();
