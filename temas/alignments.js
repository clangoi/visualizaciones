(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Proceso de referencia y su lenguaje: a, luego b y c en paralelo, luego d o e, y por último f.
  const MUNDO = P.sec(P.act('a'), P.y(P.act('b'), P.act('c')), P.xor([P.act('d'), P.act('e')]), P.act('f'));
  const MODELO = ['abcdf', 'acbdf', 'abcef', 'acbef']; // ejecuciones completas que permite el modelo
  const ACTS = 'abcdef';
  const MINLEN = 5;

  // Alineamiento óptimo de la traza `tr` con la ejecución `w` por programación dinámica.
  // cl: costo de un movimiento de registro; cm: costo de un movimiento de modelo (el síncrono cuesta 0).
  function alinear(tr, w, cl = 1, cm = 1) {
    const n = tr.length, m = w.length;
    const D = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) D[i][0] = i * cl;
    for (let j = 1; j <= m; j++) D[0][j] = j * cm;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        let b = Math.min(D[i - 1][j] + cl, D[i][j - 1] + cm);
        if (tr[i - 1] === w[j - 1]) b = Math.min(b, D[i - 1][j - 1]);
        D[i][j] = b;
      }
    }
    // Retroceso: prefiere síncrono, luego movimiento de registro, luego de modelo.
    let i = n, j = m;
    const mov = [], celdas = [[n, m]];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && tr[i - 1] === w[j - 1] && D[i][j] === D[i - 1][j - 1]) { mov.push({ t: 's', a: tr[i - 1] }); i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + cl) { mov.push({ t: 'l', a: tr[i - 1] }); i--; }
      else { mov.push({ t: 'm', a: w[j - 1] }); j--; }
      celdas.push([i, j]);
    }
    mov.reverse();
    return { costo: D[n][m], D, mov, celdas };
  }
  // Mejor ejecución del modelo para una traza (ganan las primeras en caso de empate).
  function mejor(tr, cl = 1, cm = 1) {
    let best = null;
    MODELO.forEach((w, idx) => {
      const r = alinear(tr, w, cl, cm);
      if (!best || r.costo < best.costo) best = { ...r, w, idx };
    });
    return best;
  }
  const fitnessAl = (tr, costo, cl, cm) => 1 - costo / (cl * tr.length + cm * MINLEN);
  const limpiar = (t) => [...String(t).toLowerCase()].filter((c) => ACTS.includes(c)).join('').slice(0, 10);
  const colorMov = (t) => (t === 's' ? C.s6 : t === 'l' ? C.s8 : C.s2);
  const textoMov = (m) => (m.t === 's' ? `«${m.a}» sincrónico` : m.t === 'l' ? `«${m.a}» solo en el registro (de más o fuera de lugar)` : `«${m.a}» solo en el modelo (se omitió)`);

  /* ---------- Fig. 1: programación dinámica ---------- */

  function montarTabla(cuerpo) {
    let texto = 'abdf', modo = 'auto', datos = null, hecho = 0, actual = null, ruta = 0, fase = 'llenar';
    const ctl = VIZ.controles(cuerpo);
    const PRE = [['abdf', 'falta c'], ['abcdcf', 'c repetida'], ['adbcf', 'd antes de tiempo'], ['bacdf', 'empieza por b'], ['acbef', 'ajusta perfecto']];
    ctl.selector({ etiqueta: 'Traza de ejemplo', opciones: PRE.map(([t, d]) => [t, `${t} · ${d}`]), valor: texto, alCambiar: (v) => fijar(v) });
    const ent = ctl.texto({ etiqueta: 'O escriba una traza (a–f)', valor: texto, alCambiar: fijar, alEnter: fijar });
    ctl.selector({ etiqueta: 'Ejecución del modelo', opciones: [['auto', 'la mejor (automática)'], ...MODELO.map((w) => [w, w])], valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    function fijar(t) { texto = limpiar(t); ent.valor = texto; rep.reiniciar(); }

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (texto.length + 2) * 30 + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), borde: C.s1, texto: 'celda ya calculada', forma: 'cuadro' },
      { color: C.s2, texto: 'celda que se calcula ahora', forma: 'cuadro' },
      { color: VIZ.alfa(C.s6, 0.4), borde: C.s6, texto: 'camino del alineamiento óptimo', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La celda (i, j) guarda el costo mínimo de alinear los primeros i eventos de la traza con las primeras j actividades de la ejecución. Pulse «Un paso» para llenarla celda a celda y luego recorrer el camino de vuelta. Pase el cursor sobre una celda para ver de dónde sale su valor.');

    function iniciar() {
      const tr = [...texto];
      let w, costos;
      costos = MODELO.map((x) => alinear(tr, x).costo);
      if (modo === 'auto') w = mejor(tr).w; else w = modo;
      datos = { tr, w, r: alinear(tr, w), costos };
      hecho = -1; actual = null; ruta = 0; fase = 'llenar';
      lienzo.ajustar(true);
      const n = tr.length, m = w.length;
      return (function* () {
        for (let i = 0; i <= n; i++) {
          for (let j = 0; j <= m; j++) { hecho = i * (m + 1) + j; actual = [i, j]; yield; }
        }
        fase = 'ruta'; actual = null;
        for (let k = 1; k <= datos.r.celdas.length; k++) { ruta = k; yield; }
      })();
    }

    function origen(i, j) {
      const { tr, w, r } = datos, D = r.D;
      if (i === 0 && j === 0) return 'D[0][0] = 0: alinear dos secuencias vacías no cuesta nada.';
      if (i === 0) return `D[0][${j}] = ${j}: hay que agregar ${j} actividad(es) del modelo (movimientos de modelo).`;
      if (j === 0) return `D[${i}][0] = ${i}: hay que descartar ${i} evento(s) del registro (movimientos de registro).`;
      const igual = tr[i - 1] === w[j - 1];
      const partes = [`registro «${tr[i - 1]}» frente a modelo «${w[j - 1]}»`,
        igual ? `síncrono: D[${i - 1}][${j - 1}] + 0 = ${D[i - 1][j - 1]}` : 'síncrono: no aplica (actividades distintas)',
        `solo registro: D[${i - 1}][${j}] + 1 = ${D[i - 1][j] + 1}`, `solo modelo: D[${i}][${j - 1}] + 1 = ${D[i][j - 1] + 1}`];
      return `D[${i}][${j}] = mín → ${partes.join(' · ')} → ${D[i][j]}.`;
    }

    let geo = null;
    function dibujar() {
      if (!datos) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const { tr, w, r } = datos, n = tr.length, m = w.length;
      const cw = Math.min(54, (W - 12) / (m + 2)), ch = 30, x0 = 6 + cw, y0 = 6 + ch;
      geo = { cw, ch, x0, y0 };
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = VIZ.fuente(12, 600);
      ctx.fillStyle = C.apagado;
      ctx.fillText('ε', x0 + cw / 2, y0 - ch / 2);
      ctx.fillText('ε', x0 - cw / 2, y0 + ch / 2);
      for (let j = 1; j <= m; j++) { ctx.fillStyle = C.tinta; ctx.fillText(w[j - 1], x0 + (j + 0.5) * cw, y0 - ch / 2); }
      for (let i = 1; i <= n; i++) { ctx.fillStyle = C.tinta; ctx.fillText(tr[i - 1], x0 - cw / 2, y0 + (i + 0.5) * ch); }
      ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.apagado; ctx.textAlign = 'left';
      ctx.fillText('modelo →', x0 + cw, 6 + 2); ctx.textAlign = 'center';
      const enRuta = new Set(r.celdas.slice(0, ruta).map(([i, j]) => `${i},${j}`));
      ctx.font = VIZ.fuente(12, 500);
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= m; j++) {
          const idx = i * (m + 1) + j, calc = idx <= hecho || fase === 'ruta';
          const cx = x0 + j * cw, cy = y0 + i * ch;
          const esActual = actual && actual[0] === i && actual[1] === j;
          const rutaC = enRuta.has(`${i},${j}`);
          ctx.fillStyle = esActual ? C.s2 : rutaC ? VIZ.alfa(C.s6, 0.4) : calc ? VIZ.alfa(C.s1, 0.18) : C.neutro;
          ctx.strokeStyle = esActual ? C.s2 : rutaC ? C.s6 : calc ? C.s1 : C.rejilla;
          ctx.lineWidth = rutaC ? 2 : 1;
          ctx.beginPath(); ctx.rect(cx + 1, cy + 1, cw - 2, ch - 2); ctx.fill(); ctx.stroke();
          if (calc) { ctx.fillStyle = esActual ? C.sobre : C.tinta; ctx.fillText(String(r.D[i][j]), cx + cw / 2, cy + ch / 2 + 0.5); }
        }
      }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      if (fase === 'llenar') registro.textContent = actual ? origen(actual[0], actual[1]) : 'Tabla vacía: pulse «Un paso» para calcular la celda (0, 0).';
      else {
        const done = ruta >= r.celdas.length;
        registro.textContent = done
          ? `Camino completo: costo ${r.costo}. Cada diagonal con letras iguales es un movimiento síncrono; cada paso vertical, un movimiento de registro; cada horizontal, uno de modelo.`
          : `Retroceso desde la esquina: en cada celda se vuelve a la que dio su valor (${ruta} de ${r.celdas.length} celdas).`;
      }
      const lista = MODELO.map((x, k) => `${x}: ${datos.costos[k]}`).join(' · ');
      lectura.set([
        ['traza', texto || '(vacía)'], ['ejecución del modelo', w],
        ['costo del alineamiento', fase === 'ruta' && ruta >= r.celdas.length ? String(r.costo) : '…'],
        ['costo con cada ejecución', lista],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !datos) return;
      const { x, y } = lienzo.posicion(ev);
      const j = Math.floor((x - geo.x0) / geo.cw), i = Math.floor((y - geo.y0) / geo.ch);
      const n = datos.tr.length, m = datos.w.length;
      if (i < 0 || j < 0 || i > n || j > m) return tip.ocultar();
      const idx = i * (m + 1) + j;
      if (!(idx <= hecho || fase === 'ruta')) return tip.ocultar();
      tip.mostrar(x, y, `celda (${i}, ${j}) = <b>${datos.r.D[i][j]}</b><br>${i ? `registro «${datos.tr[i - 1]}»` : 'registro vacío'} · ${j ? `modelo «${datos.w[j - 1]}»` : 'modelo vacío'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el alineamiento óptimo ---------- */

  function montarAlineamiento(cuerpo) {
    let texto = 'abdf', cl = 1, cm = 1, sel = -1, res = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    const PRE = [['abdf', 'falta c'], ['abcdcf', 'c repetida'], ['adbcf', 'd antes de tiempo'], ['abcdef', 'd y e juntas'], ['acbdf', 'ajusta perfecto'], ['bdf', 'faltan a y c']];
    ctl.selector({ etiqueta: 'Traza de ejemplo', opciones: PRE.map(([t, d]) => [t, `${t} · ${d}`]), valor: texto, alCambiar: (v) => fijar(v) });
    const ent = ctl.texto({ etiqueta: 'O escriba una traza (a–f)', valor: texto, alCambiar: fijar, alEnter: fijar });
    ctl.rango({ etiqueta: 'Costo mov. de registro', min: 1, max: 4, valor: cl, alCambiar: (v) => { cl = v; calcular(); } });
    ctl.rango({ etiqueta: 'Costo mov. de modelo', min: 1, max: 4, valor: cm, alCambiar: (v) => { cm = v; calcular(); } });
    function fijar(t) { texto = limpiar(t); ent.valor = texto; sel = -1; calcular(); }
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.22, altoMin: 150, altoMax: 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'movimiento síncrono (costo 0)', forma: 'cuadro' },
      { color: C.s8, texto: 'movimiento de registro: evento de más', forma: 'cuadro' },
      { color: C.s2, texto: 'movimiento de modelo: actividad omitida', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, la traza observada; abajo, la ejecución del modelo con que mejor se alinea. «≫» indica que ese lado no se mueve. Suba el costo de un tipo de movimiento y vea cómo el alineamiento prefiere el otro. Haga clic en una columna para explicarla.');

    function calcular() {
      const tr = [...texto];
      res = mejor(tr, cl, cm);
      res.todos = MODELO.map((w) => alinear(tr, w, cl, cm).costo);
      dibujar();
    }
    function dibujar() {
      if (!res) return;
      lienzo.limpiar();
      const { ctx, ancho: W, alto: H } = lienzo, mov = res.mov, k = mov.length;
      const cw = Math.min(46, (W - 70) / Math.max(1, k)), x0 = 60 + ((W - 70) - cw * k) / 2, yT = H * 0.3, yB = H * 0.7, bh = 30;
      ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('registro', 54, yT); ctx.fillText('modelo', 54, yB);
      geo = [];
      mov.forEach((m, i) => {
        const x = x0 + i * cw;
        const caja = (y, lleno) => {
          ctx.beginPath(); ctx.roundRect(x + 2, y - bh / 2, cw - 4, bh, 5);
          if (lleno) { ctx.fillStyle = colorMov(m.t); ctx.fill(); ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.fillText(m.a, x + cw / 2, y + 0.5); }
          else { ctx.strokeStyle = C.tenue; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(13, 500); ctx.textAlign = 'center'; ctx.fillText('≫', x + cw / 2, y + 0.5); }
        };
        caja(yT, m.t !== 'm'); caja(yB, m.t !== 'l');
        if (i === sel) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, yT - bh / 2 - 4, cw, yB - yT + bh + 8, 7); ctx.stroke(); }
        geo.push({ x, w: cw });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      lista.replaceChildren(...MODELO.map((w, i) => VIZ.el('div', { class: i === res.idx ? 'activa' : null }, `${w}   costo ${res.todos[i]}${i === res.idx ? '   ← óptimo' : ''}`)));
      const nl = mov.filter((m) => m.t === 'l').length, nm = mov.filter((m) => m.t === 'm').length, ns = mov.filter((m) => m.t === 's').length;
      lectura.set([
        ['síncronos', String(ns)], ['de registro', String(nl)], ['de modelo', String(nm)],
        ['costo del alineamiento', String(res.costo)], ['fitness', VIZ.fmt(fitnessAl(texto, res.costo, cl, cm), 3)],
      ]);
      registro.textContent = sel >= 0 && mov[sel] ? `Columna ${sel + 1}: ${textoMov(mov[sel])}${mov[sel].t === 's' ? '.' : `; cuesta ${mov[sel].t === 'l' ? cl : cm}.`}`
        : res.costo === 0 ? `La traza «${texto}» es una ejecución del modelo: costo 0.`
          : `Mejor alineamiento con «${res.w}»: ${nl ? `${nl} evento(s) de más` : ''}${nl && nm ? ' y ' : ''}${nm ? `${nm} actividad(es) omitida(s)` : ''}; costo ${res.costo}.`;
    }
    lienzo.alDibujar = dibujar;
    const col = (x) => geo.findIndex((g) => x >= g.x && x <= g.x + g.w);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = col(x);
      if (i < 0) return tip.ocultar();
      const m = res.mov[i];
      tip.mostrar(x, y, `columna <b>${i + 1}</b><br>${textoMov(m)}<br>costo <b>${m.t === 's' ? 0 : m.t === 'l' ? cl : cm}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const i = col(lienzo.posicion(ev).x); sel = i === sel ? -1 : i; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 3: actividades faltantes y adicionales ---------- */

  function montarAgregado(cuerpo) {
    let ruido = 0.3, nCasos = 150, semilla = 4, cm = 1, sel = -1, datos = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.8, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos en el registro', min: 30, max: 300, paso: 10, valor: nCasos, alCambiar: (v) => { nCasos = v; calcular(); } });
    ctl.rango({ etiqueta: 'Costo mov. de modelo', min: 1, max: 3, valor: cm, alCambiar: (v) => { cm = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'de más: movimientos de registro', forma: 'cuadro' },
      { color: C.s2, texto: 'omitida: movimientos de modelo', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada actividad acumula, en todos los casos, cuántas veces el alineamiento óptimo la marca como «de más» (solo en el registro) o «omitida» (solo en el modelo). Suba el costo de los movimientos de modelo y cambian el costo promedio y el fitness. Haga clic en una actividad para ver ejemplos.');

    function calcular() {
      const log = P.simular(MUNDO, nCasos, semilla, { ruido });
      const mas = {}, omi = {};
      ACTS.split('').forEach((a) => { mas[a] = 0; omi[a] = 0; });
      let desv = 0, costo = 0, tot = 0, peor = 0;
      const filas = [];
      for (const v of P.variantes(log)) {
        const r = mejor(v.traza, 1, cm);
        r.mov.forEach((m) => { if (m.t === 'l') mas[m.a] += v.n; else if (m.t === 'm') omi[m.a] += v.n; });
        if (r.costo > 0) desv += v.n;
        costo += r.costo * v.n; tot += v.n; peor += (v.traza.length + cm * MINLEN) * v.n;
        filas.push({ v, r });
      }
      datos = { mas, omi, desv, costo, tot, fitness: 1 - costo / peor, filas };
      dibujar();
    }
    function dibujar() {
      if (!datos) return;
      lienzo.limpiar();
      const mx = Math.max(5, ...ACTS.split('').map((a) => Math.max(datos.mas[a], datos.omi[a])));
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 6, ymin: 0, ymax: mx * 1.1 }, { etiquetaY: 'casos con la desviación', ticksX: [], margen: { inf: 30 } });
      plano.ejes();
      const { ctx } = lienzo;
      geo = [];
      ACTS.split('').forEach((a, i) => {
        const gx = plano.sx(i + 0.5), bw = Math.min(30, (plano.sx(1) - plano.sx(0)) * 0.36);
        [[datos.mas[a], C.s8, -bw], [datos.omi[a], C.s2, 0]].forEach(([v, col, off]) => {
          const top = plano.sy(v);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(gx + off + 1, top, bw - 2, plano.y0 - top, [4, 4, 0, 0]); ctx.fill();
        });
        if (i === sel) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(gx - bw - 3, plano.y1, 2 * bw + 6, plano.y0 - plano.y1 + 2, 6); ctx.stroke(); }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(a, gx, plano.y0 + 8);
        geo.push({ x0: gx - bw - 3, x1: gx + bw + 3, a });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      lectura.set([
        ['casos con desviación', `${datos.desv} de ${datos.tot}`],
        ['costo promedio', VIZ.fmt(datos.costo / datos.tot, 3)],
        ['fitness (alineamientos)', VIZ.fmt(datos.fitness, 3)],
        ['de más / omitidas', `${ACTS.split('').reduce((s, a) => s + datos.mas[a], 0)} / ${ACTS.split('').reduce((s, a) => s + datos.omi[a], 0)}`],
      ]);
      if (sel < 0) registro.textContent = 'Haga clic en una actividad para ver qué variantes la desvían.';
      else {
        const a = ACTS[sel];
        const ej = datos.filas.map(({ v, r }) => ({ v, r, k: r.mov.filter((m) => m.t !== 's' && m.a === a) })).filter((e) => e.k.length).sort((x, z) => z.v.n - x.v.n).slice(0, 2);
        registro.textContent = ej.length
          ? `Actividad «${a}»: ${ej.map((e) => `«${e.v.clave.replace(/›/g, '')}» (${e.v.n} caso(s)) → ${e.k.map((m) => (m.t === 'l' ? 'de más' : 'omitida')).join(', ')}`).join('; ')}.`
          : `Actividad «${a}»: ningún alineamiento la marca como desviada.`;
      }
    }
    lienzo.alDibujar = dibujar;
    const sobre = (x) => (geo || []).findIndex((g) => x >= g.x0 && x <= g.x1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = sobre(x);
      if (i < 0) return tip.ocultar();
      const a = ACTS[i];
      tip.mostrar(x, y, `actividad <b>${a}</b>${VIZ.filaTooltip(C.s8, 'de más', datos.mas[a])}${VIZ.filaTooltip(C.s2, 'omitida', datos.omi[a])}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const i = sobre(lienzo.posicion(ev).x); sel = i === sel ? -1 : i; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('alignments', {
    intro: String.raw`
      <p>Un <strong>alineamiento</strong> pone una traza observada junto a una ejecución del modelo, columna por columna, y dice exactamente qué coincide y qué no.
      Cuando ambos hacen lo mismo avanzan juntos (<em>movimiento síncrono</em>); cuando el registro hizo algo que el modelo no permitía, solo el registro avanza
      (<em>movimiento de registro</em>); cuando el modelo exigía algo que no ocurrió, solo avanza el modelo (<em>movimiento de modelo</em>).</p>
      <p>Entre todos los alineamientos posibles interesa el de menor costo: es la desviación mínima que explica el caso. A diferencia de la
      <a href="tema.html?id=token-based-replay">reproducción de fichas</a>, no depende de heurísticas y localiza cada desviación en una actividad concreta.</p>`,
    visualizaciones: [
      {
        titulo: 'La tabla de programación dinámica',
        descripcion: 'Alinear dos secuencias es una distancia de edición. Avance paso a paso y observe cómo cada celda toma el mínimo de tres vecinas; luego el retroceso dibuja el alineamiento. Pruebe «abdf» con la ejecución «abcef» frente a «abcdf».',
        montar: montarTabla,
      },
      {
        titulo: 'Movimientos del alineamiento óptimo',
        descripcion: 'Una traza frente a la ejecución más cercana del modelo. Con costos iguales, «abdf» (una omisión) cuesta 1 y «adbcf» cuesta 2; suba el costo de modelo a 3 y solo la primera lo nota, mientras «abcdef» (un evento de más) no cambia.',
        montar: montarAlineamiento,
      },
      {
        titulo: 'Actividades de más y omitidas',
        descripcion: 'Alinee todas las variantes de un registro con ruido y cuente por actividad cuántas veces sobra o falta. Con 0 % de ruido no hay barras; súbalo y vea qué actividades sobran o faltan más, y cómo cambia el costo promedio si omitir cuesta más.',
        montar: montarAgregado,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(\sigma\) una traza y \(M\) un modelo cuyas ejecuciones completas forman el lenguaje \(L(M)\). Un <strong>alineamiento</strong> de \(\sigma\) con \(M\) es una secuencia de movimientos \((x, y)\), con \(x\) un evento de \(\sigma\) o «≫» y \(y\) una actividad de una ejecución de \(M\) o «≫», tal que:</p>
      <ul>
        <li>\((a, a)\): <strong>movimiento síncrono</strong>, el registro y el modelo hacen lo mismo;</li>
        <li>\((a, ≫)\): <strong>movimiento de registro</strong>, solo el registro avanza (evento de más);</li>
        <li>\((≫, b)\): <strong>movimiento de modelo</strong>, solo el modelo avanza (actividad omitida).</li>
      </ul>
      <p>Si se quitan las «≫» de la fila superior queda \(\sigma\), y si se quitan las de la inferior queda una ejecución de \(M\). Con una función de costo \(\delta\) (por defecto 0 para los síncronos y 1 para los demás), el <em>alineamiento óptimo</em> es el de costo total mínimo:</p>
      \[ \gamma^{*}(\sigma, M) = \min_{w \in L(M)} \operatorname{costo}\big(\text{alineamiento de } \sigma \text{ con } w\big). \]
      <h2>Algoritmo para un modelo pequeño</h2>
      <p>Para una ejecución fija \(w\) es una distancia de edición con inserciones y borrados (sin sustitución, que costaría dos movimientos):</p>
      \[ D[i][j] = \min\begin{cases} D[i-1][j-1] & \text{si } \sigma_i = w_j \\ D[i-1][j] + \delta_{\text{registro}} \\ D[i][j-1] + \delta_{\text{modelo}} \end{cases} \qquad D[i][0] = i\,\delta_{\text{registro}},\; D[0][j] = j\,\delta_{\text{modelo}}. \]
      <pre><code>para i ← 0 hasta n:
    para j ← 0 hasta m:
        D[i][j] ← mínimo de las tres opciones
(i, j) ← (n, m)
mientras (i, j) ≠ (0, 0):
    volver a la celda que dio el mínimo; anotar su movimiento</code></pre>
      <p>Cuesta \(\Theta(nm)\) por ejecución. Como \(L(M)\) puede ser infinito (bucles) o enorme (paralelismo), los algoritmos reales buscan el camino más corto en el producto del modelo con la traza (con A*), sin enumerar ejecuciones.</p>
      <h2>Ejemplo</h2>
      <p>Para \(\sigma = \langle a,b,d,f\rangle\) y \(w = \langle a,b,c,d,f\rangle\), el alineamiento óptimo tiene cuatro movimientos síncronos y uno de modelo (\(c\) omitida): costo 1.
      Para \(\langle a,d,b,c,f\rangle\) el óptimo cuesta 2: declarar \(d\) de más (movimiento de registro) y omitirla después de \(c\) (movimiento de modelo); cualquier otro camino necesita más movimientos.</p>
      <h2>Fitness basado en alineamientos</h2>
      \[ \text{fitness}(\sigma) = 1 - \frac{\gamma^{*}(\sigma, M)}{\delta(\sigma) + \delta(w_{\min})}, \]
      <p>donde el denominador es el costo del peor alineamiento posible: todos los eventos como movimientos de registro más la ejecución más corta del modelo como movimientos de modelo (aquí \(|\sigma| + 5\) con costos unitarios). Para \(\langle a,b,d,f\rangle\) vale \(1 - 1/9 \approx 0{,}889\).</p>
      <h2>Detección de desviaciones</h2>
      <p>Al agregar los movimientos no síncronos de todos los casos se obtiene, por actividad, cuántas veces falta o sobra: es la base del <a href="tema.html?id=deviation-analysis">análisis de desviaciones</a>. Los alineamientos son también la base de las medidas de <a href="tema.html?id=fitness-precision">fitness y precisión</a>
      del resto de la sección, y se calculan sobre redes de Petri como las de <a href="tema.html?id=petri-nets">redes de Petri</a>.</p>
      <div class="recuadro"><p>Un alineamiento óptimo no siempre es único: aquí se elige de forma determinista (síncrono, luego registro, luego modelo). Con otros costos o con transiciones silenciosas
      los empates cambian cuál se muestra, pero no el costo mínimo.</p></div>`,
  });
})();
