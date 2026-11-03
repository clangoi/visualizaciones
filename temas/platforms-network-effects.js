(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => '$' + VIZ.fmt(v, 4);
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: el valor de una red ---------- */

  function montarValor(cuerpo) {
    const NMAX = 100;
    let n = 20, k = 2, c = 30, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Usuarios de la red (n)', min: 2, max: NMAX, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Valor mensual de cada conexión', min: 0.5, max: 5, paso: 0.5, valor: k, formato: dinero, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo mensual de cada usuario', min: 5, max: 100, paso: 5, valor: c, formato: dinero, alCambiar: (v) => { c = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'Metcalfe: k·n(n − 1)/2', forma: 'linea' },
      { color: C.s3, texto: 'Odlyzko: k·n·log₂ n', forma: 'linea' },
      { color: C.s4, texto: 'sin efecto de red: 4k·n', forma: 'linea' },
      { color: C.s8, texto: 'costo total: c·n', forma: 'linea' },
      { color: C.tinta, texto: 'n elegido', forma: 'linea' },
    ]);
    VIZ.subtitulo(cuerpo, 'La misma red como grafo: cada usuario nuevo se conecta con todos los anteriores (se dibujan hasta 14)');
    const red = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 200, altoMax: 280 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'usuario', forma: 'punto' }, { color: C.s3, texto: 'conexión posible entre dos usuarios', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico o use el deslizador para elegir n. Duplique los usuarios y compare cuánto crece cada curva: la de Metcalfe se cuadruplica. A la izquierda de la masa crítica la red vale menos de lo que cuesta, a la derecha vale más.');

    const f = [(m) => k * m * (m - 1) / 2, (m) => k * m * Math.log2(Math.max(1, m)), (m) => 4 * k * m, (m) => c * m];
    const nStar = 1 + (2 * c) / k;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(f[0](NMAX), f[3](NMAX)) * 1.05;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: NMAX, ymin: 0, ymax }, { etiquetaX: 'usuarios n', etiquetaY: 'valor o costo al mes', formatoY: dinero });
      pl.ejes();
      const cols = [C.s1, C.s3, C.s4, C.s8];
      f.forEach((fn, i) => VIZ.trazar(ctx, pl, Array.from({ length: NMAX }, (_, j) => [j + 1, fn(j + 1)]), cols[i], i === 0 ? 3 : 2, i === 3 ? [6, 4] : undefined));
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(n), pl.y1); ctx.lineTo(pl.sx(n), pl.y0); ctx.stroke();
      f.forEach((fn, i) => VIZ.marcador(ctx, pl.sx(n), pl.sy(fn(n)), cols[i], 4.5));
      if (nStar <= NMAX) {
        VIZ.marcador(ctx, pl.sx(nStar), pl.sy(f[3](nStar)), C.tinta, 5, 3);
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = nStar > NMAX * 0.7 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`masa crítica ≈ ${Math.ceil(nStar)}`, pl.sx(nStar) + (nStar > NMAX * 0.7 ? -9 : 9), pl.sy(f[3](nStar)) - 6);
      }
      // grafo completo
      const m = Math.min(14, n), { ctx: g, ancho: W, alto: H } = red;
      red.limpiar();
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 14;
      const P = (i) => [cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / m), cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / m)];
      g.lineWidth = 1.2; g.strokeStyle = VIZ.alfa(C.s3, 0.6);
      for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { const [x0, y0] = P(i), [x1, y1] = P(j); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      for (let i = 0; i < m; i++) { const [x, y] = P(i); VIZ.marcador(g, x, y, C.s1, 6); }
      const v = f[0](n), perU = v / n;
      registro.textContent = `Con ${n} usuarios hay ${VIZ.entero((n * (n - 1)) / 2)} conexiones posibles: valor ${dinero(v)} frente a un costo de ${dinero(c * n)}. Cada usuario recibe ${dinero(perU)} de valor y cuesta ${dinero(c)}${perU >= c ? '.' : ', por eso la red todavía no se sostiene.'}`;
      lectura.set([
        ['conexiones posibles', VIZ.entero((n * (n - 1)) / 2)],
        ['valor de la red (Metcalfe)', dinero(v)],
        ['valor por usuario', dinero(perU)],
        ['masa crítica n* = 1 + 2c/k', nStar <= NMAX ? VIZ.fmt(nStar, 3) : `${VIZ.fmt(nStar, 3)} (fuera del gráfico)`],
        ['al duplicar n, el valor se multiplica por', VIZ.fmt(f[0](2 * n) / f[0](n), 3)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    red.alDibujar = () => dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const nEn = (ev) => { const { x, y } = lienzo.posicion(ev); return pl && pl.dentro(x, y) ? { x, y, m: Math.min(NMAX, Math.max(2, Math.round(pl.ix(x)))) } : null; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const p = nEn(ev);
      if (!p) return tip.ocultar();
      tip.mostrar(p.x, p.y, `n = <b>${p.m}</b>` + VIZ.filaTooltip(C.s1, 'Metcalfe', dinero(f[0](p.m))) + VIZ.filaTooltip(C.s3, 'Odlyzko', dinero(f[1](p.m))) + VIZ.filaTooltip(C.s4, 'sin efecto de red', dinero(f[2](p.m))) + VIZ.filaTooltip(C.s8, 'costo', dinero(f[3](p.m))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    const rN = ctl.caja.querySelector('input[type=range]'), sal = ctl.caja.querySelector('output');
    lienzo.canvas.addEventListener('click', (ev) => { const p = nEn(ev); if (p) { n = p.m; rN.value = n; sal.textContent = n; dibujar(); } });
    dibujar();
  }

  /* ---------- Modelo de adopción en una plataforma de dos lados ---------- */

  const sig = (z) => 1 / (1 + Math.exp(-8 * z));
  const paso = (x, y, P) => [
    x + 0.25 * (sig(P.beta * y + P.gamma * x - (P.th - P.sub)) - x),
    y + 0.25 * (sig(P.beta * x + P.gamma * y - P.th) - y),
  ];
  const final = (x, y, P) => { for (let i = 0; i < 160; i++) [x, y] = paso(x, y, P); return [x, y]; };
  // Masa crítica sobre la diagonal x = y: primer cruce de f(u) = S((β + γ)u − θ) − u de negativo a positivo.
  function masaCritica(P) {
    const f = (u) => sig((P.beta + P.gamma) * u - P.th + P.sub / 2) - u;
    if (f(0.002) > 0) return 0;
    for (let i = 3; i <= 1000; i++) if (f(i / 1000) > 0) return i / 1000;
    return NaN;
  }
  function controlesPlataforma(ctl, P, alCambiar) {
    ctl.rango({ etiqueta: 'Efecto entre lados (β)', min: 0, max: 3, paso: 0.1, valor: P.beta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { P.beta = v; alCambiar(); } });
    ctl.rango({ etiqueta: 'Efecto dentro del lado (γ)', min: 0, max: 1.5, paso: 0.1, valor: P.gamma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { P.gamma = v; alCambiar(); } });
    ctl.rango({ etiqueta: 'Fricción para unirse (θ)', min: 0.3, max: 2, paso: 0.05, valor: P.th, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { P.th = v; alCambiar(); } });
    ctl.rango({ etiqueta: 'Subsidio al lado A', min: 0, max: 0.6, paso: 0.05, valor: P.sub, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { P.sub = v; alCambiar(); } });
  }

  /* ---------- Fig. 2: crecimiento de la plataforma ---------- */

  function montarCrecimiento(cuerpo) {
    const MESES = 60;
    const P = { beta: 1.6, gamma: 0.3, th: 0.9, sub: 0 };
    let x0 = 0.3, y0 = 0.3, ser = [], t = 0, subsidio = 0, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Conductores iniciales (lado A)', min: 0, max: 0.6, paso: 0.02, valor: x0, formato: (v) => pct(v), alCambiar: (v) => { x0 = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Pasajeros iniciales (lado B)', min: 0, max: 0.6, paso: 0.02, valor: y0, formato: (v) => pct(v), alCambiar: (v) => { y0 = v; rep.reiniciar(); } });
    controlesPlataforma(ctl, P, () => rep.reiniciar());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'lado A: conductores (de 1.000 posibles)', forma: 'linea' },
      { color: C.s2, texto: 'lado B: pasajeros (de 20.000 posibles)', forma: 'linea' },
      { color: C.tenue, texto: 'masa crítica sobre la diagonal', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con los valores iniciales la plataforma arranca con 30 % de cada lado y se apaga: no alcanza la masa crítica. Suba los usuarios iniciales, el efecto entre lados o agregue un subsidio al lado A y vea cómo la misma plataforma despega. Pase el cursor para leer cada mes.');

    function iniciar() {
      ser = [[x0, y0]]; t = 0; subsidio = 0;
      return (function* () {
        for (t = 1; t <= MESES; t++) {
          const [x, y] = ser[t - 1];
          const [nx, ny] = paso(x, y, P);
          ser.push([nx, ny]); subsidio += P.sub * nx * 1000;
          const dx = nx - x, dy = ny - y;
          registro.textContent = `Mes ${t}: cada lado decide unirse según cuánto vale la plataforma (β × el otro lado + γ × su propio lado) frente a la fricción. ${Math.abs(dx) + Math.abs(dy) < 0.002 ? 'Equilibrio.' : dx + dy > 0 ? 'Crece.' : 'Se contrae.'}`;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: 0, ymax: 1 }, { etiquetaX: 'mes', etiquetaY: 'participación', formatoY: (v) => `${Math.round(v * 100)} %`, margen: { der: 20 } });
      pl.ejes();
      const mc = masaCritica(P);
      if (mc > 0 && mc < 1) {
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(mc)); ctx.lineTo(pl.x1, pl.sy(mc)); ctx.stroke(); ctx.restore();
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('masa crítica', pl.x1 - 4, pl.sy(mc) - 3);
      }
      VIZ.trazar(ctx, pl, ser.map((s, i) => [i, s[0]]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, ser.map((s, i) => [i, s[1]]), C.s2, 2.5);
      if (hover >= 0 && hover < ser.length) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke();
        VIZ.marcador(ctx, pl.sx(hover), pl.sy(ser[hover][0]), C.s1, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(ser[hover][1]), C.s2, 4);
      }
      const [x, y] = ser[ser.length - 1];
      const estado = x > 0.8 && y > 0.8 ? 'masa crítica superada' : x < 0.05 && y < 0.05 ? 'plataforma apagada' : 'en transición';
      lectura.set([
        ['mes', String(ser.length - 1)],
        ['conductores', `${VIZ.entero(x * 1000)} (${pct(x)})`],
        ['pasajeros', `${VIZ.entero(y * 20000)} (${pct(y)})`],
        ['viajes posibles al mes', VIZ.entero(Math.round(x * 1000) * Math.round(y * 20000) / 1000)],
        ['masa crítica (diagonal)', mc === 0 ? 'ninguna' : Number.isNaN(mc) ? 'no hay equilibrio alto' : pct(mc)],
        ['subsidio acumulado', P.sub ? `${VIZ.entero(subsidio)} conductores-mes` : '—'],
        ['estado', estado],
      ]);
      if (ser.length === 1) registro.textContent = `Inicio: ${pct(x0)} de los conductores y ${pct(y0)} de los pasajeros. Pulse «Reproducir» para ver 60 meses.`;
    }
    lienzo.alDibujar = () => ser.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(MESES, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      if (hover >= ser.length) return tip.ocultar();
      tip.mostrar(x, y, `mes <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'conductores', pct(ser[hover][0])) + VIZ.filaTooltip(C.s2, 'pasajeros', pct(ser[hover][1])));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 3: plano de fases y masa crítica ---------- */

  function montarFases(cuerpo) {
    const P = { beta: 1.6, gamma: 0.3, th: 0.9, sub: 0 };
    let ini = [0.3, 0.55], camino = [], k = 0, cuenca = [], pl = null;
    const NC = 28;
    const ctl = VIZ.controles(cuerpo);
    controlesPlataforma(ctl, P, () => { calcular(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 480 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'región que termina con la plataforma masiva', forma: 'cuadro' },
      { color: C.s8, texto: 'región que termina apagada', forma: 'cuadro' },
      { color: C.apagado, texto: 'flechas: hacia dónde empuja el modelo', forma: 'linea' },
      { color: C.tinta, texto: 'trayectoria desde el punto elegido', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en cualquier punto para elegir cómo arranca la plataforma (participación de cada lado) y vea su trayectoria. La frontera entre el verde y el rojo es la masa crítica. Un subsidio al lado A desplaza la frontera y agranda la región verde.');

    function calcular() {
      cuenca = [];
      for (let i = 0; i < NC; i++) for (let j = 0; j < NC; j++) { const [fx, fy] = final((i + 0.5) / NC, (j + 0.5) / NC, P); cuenca.push((fx + fy) / 2 > 0.5); }
      camino = [ini.slice()];
      for (let s = 0; s < 120; s++) camino.push(paso(...camino[s], P));
      k = camino.length - 1;
      dibujar();
    }
    function iniciar() {
      k = 0;
      return (function* () { for (k = 1; k < camino.length; k++) yield; k = camino.length - 1; })();
    }
    function dibujar() {
      if (!cuenca.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, { etiquetaX: 'participación del lado A', etiquetaY: 'participación del lado B', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => `${Math.round(v * 100)} %` });
      const cw = (pl.x1 - pl.x0) / NC, ch = (pl.y0 - pl.y1) / NC;
      for (let i = 0; i < NC; i++) for (let j = 0; j < NC; j++) {
        ctx.fillStyle = VIZ.alfa(cuenca[i * NC + j] ? C.s6 : C.s8, 0.2);
        ctx.fillRect(pl.x0 + i * cw, pl.y0 - (j + 1) * ch, cw + 0.5, ch + 0.5);
      }
      pl.ejes();
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
        const x = (i + 0.5) / 9, y = (j + 0.5) / 9, [nx, ny] = paso(x, y, P);
        const dx = (nx - x) * (pl.x1 - pl.x0), dy = -(ny - y) * (pl.y0 - pl.y1), m = Math.hypot(dx, dy);
        if (m < 0.3) continue;
        const l = Math.min(16, 4 + m * 2), ux = dx / m, uy = dy / m, px = pl.sx(x), py = pl.sy(y);
        ctx.beginPath(); ctx.moveTo(px - (ux * l) / 2, py - (uy * l) / 2); ctx.lineTo(px + (ux * l) / 2, py + (uy * l) / 2);
        ctx.lineTo(px + (ux * l) / 2 - ux * 4 + uy * 2.5, py + (uy * l) / 2 - uy * 4 - ux * 2.5); ctx.moveTo(px + (ux * l) / 2, py + (uy * l) / 2);
        ctx.lineTo(px + (ux * l) / 2 - ux * 4 - uy * 2.5, py + (uy * l) / 2 - uy * 4 + ux * 2.5); ctx.stroke();
      }
      VIZ.trazar(ctx, pl, camino.slice(0, k + 1), C.tinta, 2.5);
      VIZ.marcador(ctx, pl.sx(ini[0]), pl.sy(ini[1]), C.tinta, 6, 3);
      const u = camino[k];
      VIZ.marcador(ctx, pl.sx(u[0]), pl.sy(u[1]), C.s2, 5.5);
      const mc = masaCritica(P), fin = camino[camino.length - 1];
      registro.textContent = `Desde (${pct(ini[0])}, ${pct(ini[1])}) la plataforma ${(fin[0] + fin[1]) / 2 > 0.5 ? 'despega y llega a la adopción masiva' : 'se apaga'}. ${k < camino.length - 1 ? `Mes ${k}.` : ''}`;
      const verde = cuenca.filter(Boolean).length / cuenca.length;
      lectura.set([
        ['punto de partida', `${pct(ini[0])} · ${pct(ini[1])}`],
        ['mes', String(k)],
        ['destino', (fin[0] + fin[1]) / 2 > 0.5 ? 'adopción masiva' : 'apagada'],
        ['masa crítica en la diagonal', mc === 0 ? 'ninguna' : Number.isNaN(mc) ? 'no hay equilibrio alto' : pct(mc)],
        ['área que despega', pct(verde)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    const celda = (ev) => { const { x, y } = lienzo.posicion(ev); return pl && pl.dentro(x, y) ? { x, y, px: pl.ix(x), py: pl.iy(y) } : null; };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const c = celda(ev);
      if (!c) return tip.ocultar();
      const i = Math.min(NC - 1, Math.floor(c.px * NC)), j = Math.min(NC - 1, Math.floor(c.py * NC)), ok = cuenca[i * NC + j];
      tip.mostrar(c.x, c.y, `A <b>${pct(c.px)}</b> · B <b>${pct(c.py)}</b>` + VIZ.filaTooltip(ok ? C.s6 : C.s8, ok ? 'termina en adopción masiva' : 'termina apagada', null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const c = celda(ev); if (c) { ini = [c.px, c.py]; calcular(); } });
    calcular();
  }

  VIZ.registrarTema('platforms-network-effects', {
    intro: String.raw`
      <p>Una <strong>plataforma digital</strong> conecta a dos o más grupos que se necesitan entre sí: conductores y pasajeros, vendedores y compradores, desarrolladores y usuarios. Su valor no está solo en el producto, sino en <strong>quién más participa</strong>: es lo que se llama <strong>efecto de red</strong>. Un teléfono vale más cuantos más teléfonos existan; una aplicación de transporte vale más con más conductores y más pasajeros.</p>
      <p>Esto genera un problema de arranque (¿quién llega primero?) y una dinámica de «el ganador se lleva casi todo». Hay una <strong>masa crítica</strong> bajo la cual la plataforma se apaga y sobre la cual crece sola. Las figuras muestran el valor de la red, cómo crece una plataforma de dos lados y dónde está esa frontera.</p>`,
    visualizaciones: [
      {
        titulo: 'El valor de una red según su tamaño',
        descripcion: 'Mueva n y compare cómo crece el valor con la ley de Metcalfe, con una regla más conservadora y sin efecto de red. Cambie el costo por usuario y observe cómo se desplaza la masa crítica donde el valor supera al costo.',
        montar: montarValor,
      },
      {
        titulo: 'Crecimiento de una plataforma de dos lados',
        descripcion: 'Reproduzca 60 meses de adopción. Con los valores iniciales la plataforma se apaga; suba los usuarios iniciales, el efecto entre lados o el subsidio al lado A hasta que despegue y mire cuándo.',
        montar: montarCrecimiento,
      },
      {
        titulo: 'Plano de fases: dónde está la masa crítica',
        descripcion: 'Haga clic en distintos puntos del plano para ver adónde lleva cada arranque. La zona verde despega y la roja se apaga; con subsidio la frontera se mueve a favor del lado subsidiado.',
        montar: montarFases,
      },
    ],
    teoria: String.raw`
      <h2>Efectos de red</h2>
      <ul>
        <li><strong>Directos:</strong> el valor para un usuario crece con el número de usuarios de su mismo lado (mensajería, redes sociales).</li>
        <li><strong>Indirectos o entre lados:</strong> el valor para un lado crece con el tamaño del otro (más conductores, menos espera para los pasajeros; más pasajeros, más ingresos para los conductores).</li>
        <li><strong>Negativos:</strong> la congestión o el ruido pueden reducir el valor al crecer.</li>
      </ul>
      <h2>Ley de Metcalfe y alternativas</h2>
      <p>Si cada par de usuarios puede conectarse y cada conexión vale \(k\), el valor de la red es</p>
      \[ V_M(n) = k\,\binom{n}{2} = k\,\frac{n(n-1)}{2} = \Theta(n^2) . \]
      <p>Es una cota optimista: no todas las conexiones se usan. Odlyzko propone \(V_O(n) = k\,n\log_2 n\), más conservadora, y sin efecto de red el valor es lineal. Si cada usuario cuesta \(c\), la red se sostiene cuando el valor por usuario supera al costo, \(k(n-1)/2 \ge c\), es decir a partir de la <strong>masa crítica</strong></p>
      \[ n^{*} = 1 + \frac{2c}{k} . \]
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con \(k = 2\) y \(c = 30\): \(n^{*} = 1 + 60/2 = 31\). Con 20 usuarios el valor por usuario es \(2 \cdot 19/2 = 19 &lt; 30\): la red pierde dinero. Con 40, \(2 \cdot 39/2 = 39 &gt; 30\). Duplicar de 20 a 40 usuarios multiplica el valor total por \(\frac{40\cdot 39}{20\cdot 19} \approx 4{,}1\).</p></div>
      <h2>Plataforma de dos lados</h2>
      <p>Sea \(x\) la fracción de usuarios del lado A que participa e \(y\) la del lado B. Cada lado se une según el valor percibido frente a la fricción \(\theta\):</p>
      \[ x_{t+1} = x_t + \rho\big[\sigma(\beta y_t + \gamma x_t - \theta + s) - x_t\big], \qquad y_{t+1} = y_t + \rho\big[\sigma(\beta x_t + \gamma y_t - \theta) - y_t\big], \]
      <p>con \(\sigma(z) = 1/(1+e^{-8z})\), \(\beta\) el efecto entre lados, \(\gamma\) el efecto dentro del lado y \(s\) un subsidio al lado A. El sistema tiene al menos dos equilibrios estables (apagado y masivo) separados por una frontera inestable: la masa crítica. Por eso el arranque es el problema central, el <em>huevo y la gallina</em>.</p>
      <h3>Estrategias para cruzar la masa crítica</h3>
      <ul>
        <li><strong>Subsidiar un lado</strong> (conductores con bonos, usuarios gratis): baja \(\theta\) y desplaza la frontera, como muestra la figura.</li>
        <li><strong>Empezar en un nicho</strong> (una ciudad, un tipo de producto) donde la masa crítica es pequeña.</li>
        <li><strong>Producir valor sin red</strong> para el primer lado y luego atraer al segundo.</li>
        <li>Cuidar la <em>multi-pertenencia</em>: si los usuarios pueden usar varias plataformas, el efecto de red protege menos.</li>
      </ul>
      <p>Este tema se conecta con los <a href="tema.html?id=digital-business-models">modelos de negocio digitales</a>, con los <a href="tema.html?id=five-digital-domains">cinco dominios</a> (clientes como red, competencia como ecosistema) y con la <a href="tema.html?id=social-network-centrality">centralidad en redes sociales</a>.</p>`,
  });
})();
