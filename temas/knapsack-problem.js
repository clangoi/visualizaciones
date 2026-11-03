(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  const LET = 'ABCDEFGH';

  // Objetos reproducibles: pesos de 2 a 10 y valores de unas 1.2 a 4 veces el peso.
  function datos(semilla, n) {
    const rnd = VIZ.semilla(semilla * 97 + 13);
    const p = Array.from({ length: n }, () => 2 + Math.floor(rnd() * 9));
    const v = p.map((w) => Math.max(2, Math.round(w * (0.6 + rnd() * 1.4) * 2)));
    return { p, v };
  }

  /* ---------- Fig. 1: llene la mochila ---------- */

  function montarEleccion(cuerpo) {
    const N = 8;
    let semilla = 1, cap = 24, d = datos(semilla, N), sel = Array(N).fill(false), mostrarOpt = false, opt = null, frac = null, mensaje = '', geo = null;
    const recalcular = () => { opt = O.mochila(d.v, d.p, cap); frac = O.mochilaFraccionaria(d.v, d.p, cap); };
    recalcular();

    const ctl = VIZ.controles(cuerpo);
    const rCap = ctl.rango({ etiqueta: 'Capacidad C', min: 8, max: 40, valor: cap, alCambiar: (v) => { cap = v; recalcular(); mensaje = ''; dibujar(); } });
    ctl.casilla({ etiqueta: 'Marcar el óptimo entero', valor: mostrarOpt, alCambiar: (v) => { mostrarOpt = v; dibujar(); } });
    ctl.boton('Aplicar el óptimo', () => { sel = Array(N).fill(false); opt.elegidos.forEach((i) => { sel[i] = true; }); mensaje = 'Se aplicó el óptimo entero de la programación dinámica.'; dibujar(); }, { primario: true });
    ctl.boton('Vaciar', () => { sel = Array(N).fill(false); mensaje = 'Mochila vacía.'; dibujar(); });
    ctl.boton('Nuevos objetos', () => { semilla++; d = datos(semilla, N); sel = Array(N).fill(false); cap = Math.round(d.p.reduce((a, b) => a + b, 0) / 2); rCap.valor = cap; recalcular(); mensaje = ''; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 2 * 86 + 92 : 86 + 92) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'objeto elegido' },
      { color: C.sobre, borde: C.eje, texto: 'objeto sin elegir' },
      { color: C.s6, forma: 'cuadro', texto: 'pertenece al óptimo entero (si está marcado)' },
      { color: C.s8, texto: 'peso que excede la capacidad' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un objeto para meterlo o sacarlo de la mochila. La barra inferior muestra cuánto de la capacidad C ocupa lo elegido.');

    const peso = () => sel.reduce((s, q, i) => s + (q ? d.p[i] : 0), 0);
    const valor = () => sel.reduce((s, q, i) => s + (q ? d.v[i] : 0), 0);

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cols = W < 560 ? 4 : 8, gap = 6, cw = (W - gap * (cols - 1)) / cols, ch = 80;
      geo = { cols, cw, ch, gap };
      for (let i = 0; i < N; i++) {
        const x = (i % cols) * (cw + gap), y = Math.floor(i / cols) * (ch + 6);
        ctx.fillStyle = sel[i] ? VIZ.alfa(C.s1, 0.16) : C.superficie;
        ctx.strokeStyle = sel[i] ? C.s1 : C.eje;
        ctx.lineWidth = sel[i] ? 2 : 1;
        ctx.beginPath(); ctx.roundRect(x + 1, y + 1, cw - 2, ch - 2, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = VIZ.fuente(14, 600); ctx.fillText(LET[i], x + 8, y + 8);
        ctx.font = VIZ.fuente(11);
        ctx.fillStyle = C.tinta2;
        ctx.fillText(`valor ${d.v[i]}`, x + 8, y + 29);
        ctx.fillText(`peso  ${d.p[i]}`, x + 8, y + 44);
        ctx.fillStyle = C.apagado;
        ctx.fillText(`v/p ${VIZ.fmt(d.v[i] / d.p[i], 3)}`, x + 8, y + 59);
        if (mostrarOpt && opt.elegidos.includes(i)) { ctx.fillStyle = C.s6; ctx.fillRect(x + cw - 18, y + 8, 10, 10); }
      }
      // Barra de capacidad.
      const filas = Math.ceil(N / cols), yb = filas * (ch + 6) + 26, hb = 26, usado = peso();
      const escala = Math.max(cap, usado), sx = (q) => (q / escala) * (W - 2);
      ctx.fillStyle = C.neutro; ctx.fillRect(0, yb, sx(cap), hb);
      let acum = 0;
      for (let i = 0; i < N; i++) if (sel[i]) {
        const x0 = sx(acum), x1 = sx(acum + d.p[i]);
        const dentro = Math.max(0, Math.min(acum + d.p[i], cap) - acum);
        ctx.fillStyle = C.s1; ctx.fillRect(x0, yb, sx(acum + dentro) - x0, hb);
        if (dentro < d.p[i]) { ctx.fillStyle = C.s8; ctx.fillRect(sx(acum + dentro), yb, x1 - sx(acum + dentro), hb); }
        ctx.strokeStyle = C.sobre; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x1, yb + hb); ctx.stroke();
        if (x1 - x0 > 16) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LET[i], (x0 + x1) / 2, yb + hb / 2); }
        acum += d.p[i];
      }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(cap), yb - 5); ctx.lineTo(sx(cap), yb + hb + 5); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'bottom';
      ctx.textAlign = sx(cap) > W - 70 ? 'right' : 'left';
      ctx.fillText(`C = ${cap}`, sx(cap) + (sx(cap) > W - 70 ? -6 : 6), yb - 4);
      ctx.textAlign = 'left'; ctx.fillText(`peso usado ${usado}`, 0, yb - 4);

      const exceso = usado - cap;
      registro.textContent = mensaje || (exceso > 0 ? `Peso ${usado} > C = ${cap}: la restricción Σ pᵢxᵢ ≤ C no se cumple, esta mochila es infactible.` : 'Elija objetos con un clic.');
      lectura.set([
        ['valor elegido', exceso > 0 ? `${valor()} (infactible)` : String(valor())],
        ['peso usado / C', `${usado} / ${cap}`],
        ['óptimo entero z*', String(opt.valor)],
        ['cota fraccionaria z_LP', VIZ.fmt(frac.z, 4)],
        ['brecha z_LP − z*', VIZ.fmt(frac.z - opt.valor, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;

    function celda(ev) {
      if (!geo) return -1;
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor(x / (geo.cw + geo.gap)), r = Math.floor(y / (geo.ch + 6));
      if (c < 0 || c >= geo.cols || r < 0 || y - r * (geo.ch + 6) > geo.ch) return -1;
      const i = r * geo.cols + c;
      return i < N ? i : -1;
    }
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const i = celda(ev);
      if (i < 0) return;
      sel[i] = !sel[i];
      mensaje = `${sel[i] ? 'Entra' : 'Sale'} el objeto ${LET[i]} (valor ${d.v[i]}, peso ${d.p[i]}).`;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = celda(ev);
      if (i < 0) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      tip.mostrar(x, y, `objeto <b>${LET[i]}</b><br>valor <b>${d.v[i]}</b> · peso <b>${d.p[i]}</b><br>valor por peso <b>${VIZ.fmt(d.v[i] / d.p[i], 3)}</b><br>en el óptimo entero: <b>${opt.elegidos.includes(i) ? 'sí' : 'no'}</b><br>fracción en la relajación: <b>${VIZ.fmt(frac.x[i], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: relajación fraccionaria ---------- */

  function montarRelajacion(cuerpo) {
    const N = 8;
    let semilla = 3, cap = 24, d = datos(semilla, N), orden = [], tom = [], opt = null, zParcial = 0, mensaje = '', listo = false, pl = null, barras = [];
    const calcular = () => { opt = O.mochila(d.v, d.p, cap); orden = O.mochilaFraccionaria(d.v, d.p, cap).orden; };
    calcular();

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capacidad C', min: 8, max: 40, valor: cap, alCambiar: (v) => { cap = v; calcular(); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos objetos', () => { semilla++; d = datos(semilla, N); calcular(); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'objeto metido entero (xᵢ = 1)' },
      { color: C.s2, texto: 'objeto fraccionado (0 < xᵢ < 1)' },
      { color: VIZ.alfa(C.inactivo, 0.4), texto: 'objeto aún no considerado' },
      { color: C.s6, forma: 'cuadro', texto: 'pertenece al óptimo entero' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los objetos se ordenan por valor por peso (alto de cada barra); el ancho es el peso, así que el área es el valor. Pase el cursor sobre una barra para ver su fracción.');

    function iniciar() {
      tom = Array(N).fill(null); zParcial = 0; listo = false;
      mensaje = 'Se ordenan los objetos por valor/peso y se llena la mochila de izquierda a derecha.';
      return (function* () {
        let rest = cap;
        for (const i of orden) {
          if (rest <= 0) break;
          const t = Math.min(1, rest / d.p[i]);
          tom[i] = t; zParcial += t * d.v[i]; rest -= t * d.p[i];
          mensaje = t >= 1
            ? `${LET[i]} (v/p = ${VIZ.fmt(d.v[i] / d.p[i], 3)}) cabe entero: x = 1. Capacidad restante ${VIZ.fmt(rest)}.`
            : `${LET[i]} no cabe entero: quedan ${VIZ.fmt(rest + t * d.p[i])} de peso, se toma la fracción x = ${VIZ.fmt(t, 3)}.`;
          yield;
          if (t < 1) break;
        }
        listo = true;
        mensaje = `Relajación resuelta: z_LP = ${VIZ.fmt(zParcial, 4)} es una cota superior del óptimo entero z* = ${opt.valor}.`;
      })();
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const total = d.p.reduce((a, b) => a + b, 0), rmax = Math.max(...d.v.map((v, i) => v / d.p[i]));
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: total, ymin: 0, ymax: rmax * 1.2 }, { etiquetaX: 'peso acumulado', etiquetaY: 'valor por unidad de peso', margen: { inf: 62 } });
      pl.ejes();
      barras = [];
      let acum = 0;
      for (const i of orden) {
        const x0 = pl.sx(acum), x1 = pl.sx(acum + d.p[i]), r = d.v[i] / d.p[i], y = pl.sy(r), t = tom[i];
        barras.push({ i, x0, x1, y, acum });
        ctx.fillStyle = VIZ.alfa(C.inactivo, 0.35);
        ctx.fillRect(x0 + 1, y, x1 - x0 - 2, pl.y0 - y);
        if (t != null) {
          ctx.fillStyle = t >= 1 ? C.s1 : C.s2;
          ctx.fillRect(x0 + 1, y, (x1 - x0 - 2) * t, pl.y0 - y);
        }
        ctx.strokeStyle = C.sobre; ctx.lineWidth = 1; ctx.strokeRect(x0 + 1, y, x1 - x0 - 2, pl.y0 - y);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(LET[i], (x0 + x1) / 2, y - 3);
        if (opt.elegidos.includes(i)) { ctx.fillStyle = C.s6; ctx.fillRect((x0 + x1) / 2 - 5, pl.y0 + 22, 10, 10); }
        acum += d.p[i];
      }
      ctx.save();
      ctx.strokeStyle = C.tinta; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(cap), pl.y0); ctx.lineTo(pl.sx(cap), pl.y1); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'top';
      ctx.textAlign = pl.sx(cap) > pl.x1 - 50 ? 'right' : 'left';
      ctx.fillText(`C = ${cap}`, pl.sx(cap) + (pl.sx(cap) > pl.x1 - 50 ? -4 : 4), pl.y1 + 2);
      registro.textContent = mensaje;
      const enteros = tom.reduce((s, t, i) => s + (t >= 1 ? d.v[i] : 0), 0);
      lectura.set([
        ['cota fraccionaria z_LP', VIZ.fmt(zParcial, 4)],
        ['óptimo entero z*', String(opt.valor)],
        ['brecha z_LP − z*', listo ? VIZ.fmt(zParcial - opt.valor, 3) : '—'],
        ['voraz sin fracción', String(enteros)],
      ]);
    }
    lienzo.alDibujar = () => orden.length && dibujar();

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const b = barras.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y && y <= pl.y0);
      if (!b) return tip.ocultar();
      const i = b.i;
      tip.mostrar(x, y, `objeto <b>${LET[i]}</b><br>valor <b>${d.v[i]}</b> · peso <b>${d.p[i]}</b><br>valor/peso <b>${VIZ.fmt(d.v[i] / d.p[i], 3)}</b><br>fracción tomada <b>${tom[i] == null ? 'sin procesar' : VIZ.fmt(tom[i], 3)}</b><br>óptimo entero: <b>${opt.elegidos.includes(i) ? 'sí' : 'no'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: programación dinámica ---------- */

  function montarTabla(cuerpo) {
    let semilla = 5, n = 5, cap = 10, d = datos(semilla, n), R = null, llenas = 0, traza = [], vistas = 0, actual = null, mensaje = '', geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Objetos n', min: 3, max: 7, valor: n, alCambiar: (v) => { n = v; d = datos(semilla, n); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Capacidad C', min: 5, max: 14, valor: cap, alCambiar: (v) => { cap = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos objetos', () => { semilla++; d = datos(semilla, n); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 30 + (n + 1) * 28 + 6 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'celda que se calcula' },
      { color: C.s1, texto: 'no tomar el objeto: V[i−1][w]' },
      { color: C.s3, texto: 'tomarlo: V[i−1][w−pᵢ] + vᵢ' },
      { color: C.s6, texto: 'camino de la solución' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda V[i][w] es el mejor valor usando los primeros i objetos con capacidad w. Al terminar, el camino verde recorre la tabla hacia atrás y revela qué objetos se eligieron. Pase el cursor sobre una celda.');

    function iniciar() {
      R = O.mochila(d.v, d.p, cap);
      llenas = 0; traza = []; vistas = 0; actual = null;
      mensaje = 'La fila 0 (sin objetos) vale 0 para toda capacidad. Se llena fila a fila.';
      return (function* () {
        const V = R.V;
        for (let i = 1; i <= n; i++) for (let w = 0; w <= cap; w++) {
          actual = [i, w]; llenas++;
          const a = V[i - 1][w], p = d.p[i - 1], v = d.v[i - 1];
          mensaje = p > w
            ? `V[${i}][${w}]: el objeto ${LET[i - 1]} (peso ${p}) no cabe en ${w}; se hereda V[${i - 1}][${w}] = ${a}.`
            : `V[${i}][${w}] = máx( ${a} sin ${LET[i - 1]} ; V[${i - 1}][${w - p}] + ${v} = ${V[i - 1][w - p] + v} con ${LET[i - 1]} ) = ${V[i][w]}.`;
          yield;
        }
        let w = cap;
        for (let i = n; i >= 1; i--) {
          const toma = V[i][w] !== V[i - 1][w];
          traza.push([i, w, toma]); vistas++; actual = [i, w];
          mensaje = toma ? `Recuperación: V[${i}][${w}] ≠ V[${i - 1}][${w}], así que ${LET[i - 1]} está en la mochila y queda capacidad ${w - d.p[i - 1]}.` : `Recuperación: V[${i}][${w}] = V[${i - 1}][${w}], ${LET[i - 1]} no se usa.`;
          if (toma) w -= d.p[i - 1];
          yield;
        }
        actual = null;
        mensaje = `Óptimo: V[${n}][${cap}] = ${R.valor} con ${R.elegidos.length ? R.elegidos.map((i) => LET[i]).join(', ') : 'ningún objeto'}.`;
      })();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const L = 64, T = 28, ch = 28, cw = Math.min(46, (W - L - 2) / (cap + 1));
      geo = { L, T, ch, cw };
      const vmax = R.valor || 1;
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillStyle = C.apagado;
      for (let w = 0; w <= cap; w++) ctx.fillText(String(w), L + w * cw + cw / 2, 12);
      ctx.textAlign = 'left'; ctx.fillText('w →', 2, 12);
      const dep = actual && actual[0] >= 1 && vistas === 0 ? actual : null;
      for (let i = 0; i <= n; i++) {
        const y = T + i * ch;
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(10);
        ctx.fillText(i === 0 ? 'i=0 ∅' : `${LET[i - 1]} p${d.p[i - 1]} v${d.v[i - 1]}`, 2, y + ch / 2);
        for (let w = 0; w <= cap; w++) {
          const x = L + w * cw, lleno = i === 0 || (i - 1) * (cap + 1) + w + 1 <= llenas;
          ctx.fillStyle = lleno ? VIZ.css(VIZ.enRampa(0.04 + 0.4 * (R.V[i][w] / vmax))) : C.superficie;
          ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          if (lleno) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.fillText(String(R.V[i][w]), x + cw / 2, y + ch / 2); }
          else { ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
        }
      }
      const marco = (i, w, col, an = 2.5) => { ctx.strokeStyle = col; ctx.lineWidth = an; ctx.strokeRect(L + w * cw + 1.5, T + i * ch + 1.5, cw - 3, ch - 3); };
      if (dep) {
        const [i, w] = dep, p = d.p[i - 1];
        marco(i - 1, w, C.s1);
        if (p <= w) marco(i - 1, w - p, C.s3);
        marco(i, w, C.s2, 3);
      }
      for (let k = 0; k < vistas; k++) {
        const [i, w, toma] = traza[k];
        marco(i, w, C.s6, 3);
        if (toma) { ctx.fillStyle = C.s6; ctx.font = VIZ.fuente(9, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('toma', L + w * cw + cw - 3, T + i * ch + 3); ctx.textBaseline = 'middle'; }
      }
      registro.textContent = mensaje;
      lectura.set([
        ['celdas calculadas', `${llenas} / ${n * (cap + 1)}`],
        ['operaciones n·C', String(n * cap)],
        ['valor óptimo V[n][C]', llenas >= n * (cap + 1) ? String(R.valor) : '…'],
        ['objetos elegidos', vistas >= n ? (R.elegidos.map((i) => LET[i]).join(' ') || 'ninguno') : '…'],
      ]);
    }
    lienzo.alDibujar = () => R && dibujar();

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const w = Math.floor((x - geo.L) / geo.cw), i = Math.floor((y - geo.T) / geo.ch);
      if (w < 0 || w > cap || i < 0 || i > n) return tip.ocultar();
      const visible = i === 0 || (i - 1) * (cap + 1) + w + 1 <= llenas;
      if (!visible) return tip.mostrar(x, y, `V[${i}][${w}]<br>aún sin calcular`);
      const extra = i === 0 ? 'sin objetos' : `objeto ${LET[i - 1]}: ${d.p[i - 1] > w ? 'no cabe' : `tomar da ${R.V[i - 1][w - d.p[i - 1]] + d.v[i - 1]}`}, no tomar da ${R.V[i - 1][w]}`;
      tip.mostrar(x, y, `V[${i}][${w}] = <b>${R.V[i][w]}</b><br>${extra}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('knapsack-problem', {
    intro: String.raw`
      <p>Usted tiene una mochila con capacidad limitada y varios objetos, cada uno con un valor y un peso. Hay que decidir <strong>cuáles llevar</strong>:
      cada objeto entra completo o se queda fuera, y se busca el mayor valor total sin pasar la capacidad. Es el modelo más simple de
      una decisión «sí o no» bajo un recurso escaso, y reaparece en presupuestos, carga de camiones o selección de proyectos.</p>
      <p>Aunque el enunciado es corto, la decisión no es evidente: el objeto de mejor valor por peso no siempre es el que conviene.
      Aquí compara su elección con el <em>óptimo entero</em>, con la cota que da la <em>relajación fraccionaria</em> (que sí permite partir objetos) y con la
      tabla de programación dinámica que encuentra el óptimo.</p>`,
    visualizaciones: [
      {
        titulo: 'Llene la mochila',
        descripcion: 'Haga clic en los objetos para elegirlos y trate de alcanzar el mayor valor sin pasar la capacidad. Active «Marcar el óptimo entero» para comparar, y mueva C: el óptimo cambia de forma irregular.',
        montar: montarEleccion,
      },
      {
        titulo: 'Relajación fraccionaria',
        descripcion: 'Observe cómo el método voraz por valor/peso llena la mochila y fracciona el último objeto. Compare su cota z_LP con el óptimo entero: la brecha puede ser cero o no según C.',
        montar: montarRelajacion,
      },
      {
        titulo: 'Tabla de programación dinámica',
        descripcion: 'Avance paso a paso y vea de qué dos celdas depende cada V[i][w]. Cambie n y C: el trabajo crece como n·C, y al final el camino verde muestra los objetos elegidos.',
        montar: montarTabla,
      },
    ],
    teoria: String.raw`
      <h2>Modelo de programación entera</h2>
      <p>Con \(n\) objetos de valor \(v_i\) y peso \(p_i\), y capacidad \(C\), se introduce una <strong>variable binaria</strong> \(x_i\) que vale 1 si el objeto \(i\) se lleva:</p>
      \[ \max \sum_{i=1}^{n} v_i x_i \quad \text{s.a.} \quad \sum_{i=1}^{n} p_i x_i \le C, \qquad x_i \in \{0,1\}. \]
      <p>Es un problema de programación lineal entera (ILP) con una sola restricción, pero es NP-difícil: no se conoce un algoritmo que sea
      polinomial en el tamaño de la entrada. Es más sencillo que casi todos los ILP, porque admite un algoritmo pseudopolinomial.</p>

      <h2>Relajación lineal y cota fraccionaria</h2>
      <p>Si se cambia \(x_i \in \{0,1\}\) por \(0 \le x_i \le 1\) se obtiene un LP cuyo óptimo \(z_{LP}\) es siempre una cota superior de \(z^*\). Para la mochila se resuelve sin Simplex:
      se ordenan los objetos por \(v_i/p_i\) decreciente, se meten enteros mientras quepan y el primero que no cabe (el <em>objeto crítico</em> \(k\)) entra en la fracción que sobra:</p>
      \[ z_{LP} = \sum_{i<k} v_i + \frac{C - \sum_{i<k} p_i}{p_k}\, v_k . \]
      <div class="recuadro"><p>Como \(z^*\) es entero cuando los valores lo son, también vale \(z^* \le \lfloor z_{LP} \rfloor\). Esta cota es la que usa la
      ramificación y acotamiento (<a href="tema.html?id=branch-and-bound">Branch and Bound</a>) para descartar ramas sin explorarlas.</p></div>
      <p>Redondear la solución fraccionaria hacia abajo (el voraz «sin fracción») da una solución factible, pero puede ser mala: con dos objetos, uno de peso 1 y valor 2 y otro de peso \(C\) y valor \(C\), el voraz toma solo el primero y alcanza 2 cuando el óptimo vale \(C\).</p>

      <h2>Programación dinámica</h2>
      <p>Sea \(V[i][w]\) el mejor valor usando solo los primeros \(i\) objetos con capacidad \(w\). Para cada objeto se decide entre no tomarlo o tomarlo:</p>
      \[ V[i][w] = \begin{cases} V[i-1][w] & \text{si } p_i > w, \\ \max\bigl(V[i-1][w],\; V[i-1][w-p_i] + v_i\bigr) & \text{si } p_i \le w, \end{cases} \qquad V[0][w] = 0. \]
      <pre><code>para i ← 1 hasta n:
    para w ← 0 hasta C:
        V[i][w] ← V[i−1][w]
        si p[i] ≤ w:
            V[i][w] ← máx(V[i][w], V[i−1][w − p[i]] + v[i])
w ← C
para i ← n hasta 1:
    si V[i][w] ≠ V[i−1][w]: elegir i; w ← w − p[i]
devolver V[n][C]</code></pre>
      <p>Cada celda se calcula en tiempo constante, así que el costo total es \(\Theta(nC)\) y la memoria también. Es <em>pseudopolinomial</em>: polinomial en el valor numérico de \(C\), no en su número de bits.
      La corrección sale del principio de optimalidad: una solución óptima para \((i, w)\) o no usa el objeto \(i\) y es óptima para \((i-1, w)\), o lo usa y el resto es óptimo para \((i-1, w-p_i)\).</p>

      <h2>Conexiones</h2>
      <p>La mochila es el caso más pequeño de las decisiones binarias con presupuesto: la <a href="tema.html?id=investment-selection">selección de inversiones</a> añade dependencias entre proyectos.
      Su relajación lineal se estudia en <a href="tema.html?id=lp-relaxation">Linear Relaxation</a> y la tabla es un ejemplo de <a href="tema.html?id=problem-classes">problema ILP</a>.</p>`,
  });
})();
