(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const hh = (h) => (h < 1 ? Math.round(h * 60) + ' min' : VIZ.fmt(h, 3) + ' h');
  const TIPOS = {
    trabajo: { color: C.s1, nombre: 'trabajo del área' },
    reingreso: { color: C.s2, nombre: 'reingreso de datos' },
    espera: { color: C.inactivo, nombre: 'espera entre áreas' },
    correccion: { color: C.s8, nombre: 'corrección de un error' },
  };

  /* ---------- Fig. 1: un pedido, con y sin integración ---------- */

  function montarGantt(cuerpo) {
    let esp = 6, mins = 15, pe = 8, corr = 4, falta = true, semilla = 1, paso = 0, S = [], I = [], etapas = [], geo = [], tmax = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera por traspaso en silos', min: 1, max: 24, valor: esp, formato: (v) => v + ' h', alCambiar: (v) => { esp = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Reingreso de datos', min: 5, max: 40, paso: 5, valor: mins, formato: (v) => v + ' min', alCambiar: (v) => { mins = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Probabilidad de error por captura', min: 0, max: 30, valor: pe, formato: (v) => v + ' %', alCambiar: (v) => { pe = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Corregir un error', min: 1, max: 12, valor: corr, formato: (v) => v + ' h', alCambiar: (v) => { corr = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'El pedido requiere comprar (pasa por Compras)', valor: falta, alCambiar: (v) => { falta = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Otro pedido', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, Object.values(TIPOS).map((t) => ({ color: t.color, texto: t.nombre })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso entrega el pedido a la siguiente área. La barra de arriba es la organización con sistemas aislados; la de abajo, con un sistema integrado. Pase el cursor sobre un tramo para ver su duración y pruebe «Otro pedido» para cambiar los errores.');

    const construir = () => {
      const rnd = VIZ.semilla(semilla * 53 + 1), u = Array.from({ length: 12 }, rnd);
      etapas = falta
        ? [['Ventas', 0.25, null], ['Bodega', 0.5, 'VB'], ['Compras', 1, 'BC'], ['Finanzas', 0.7, 'CF']]
        : [['Ventas', 0.25, null], ['Bodega', 0.5, 'VB'], ['Finanzas', 0.4, 'BF']];
      const k = { VB: 1, BC: 3, CF: 5, BF: 7 };
      const armar = (integrado) => etapas.map(([d, w, id], i) => {
        const t = [];
        if (i > 0) {
          const j = k[id];
          t.push({ tipo: 'espera', dur: (integrado ? 0.5 : esp) * (0.5 + u[j]), dept: d });
          if (!integrado) {
            t.push({ tipo: 'reingreso', dur: mins / 60, dept: d });
            if (u[j + 1] < pe / 100) t.push({ tipo: 'correccion', dur: corr, dept: d });
          }
        }
        t.push({ tipo: 'trabajo', dur: w, dept: d });
        if (i === 0 && u[0] < pe / 100) t.push({ tipo: 'correccion', dur: corr, dept: d });
        return t;
      });
      S = armar(false); I = armar(true);
      const tot = (R) => R.flat().reduce((s, x) => s + x.dur, 0);
      tmax = Math.max(tot(S), tot(I));
    };
    function iniciar() {
      construir(); paso = 0;
      return (function* () {
        for (let i = 0; i < etapas.length; i++) { paso = i + 1; yield; }
      })();
    }
    const acum = (R, hasta, tipo) => R.slice(0, hasta).flat().filter((x) => !tipo || x.tipo === tipo).reduce((s, x) => s + x.dur, 0);
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 8, x1 = W - 10, sx = (h) => x0 + (h / tmax) * (x1 - x0);
      geo = [];
      [['Silos: cada área con su sistema', S, 22], ['Sistema integrado: se captura una vez', I, 88]].forEach(([titulo, R, y]) => {
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(titulo, x0, y - 4);
        ctx.fillStyle = C.fondo2; ctx.fillRect(x0, y, x1 - x0, 30);
        let t = 0;
        R.forEach((tr, i) => tr.forEach((s) => {
          if (i < paso) {
            const a = sx(t), b = sx(t + s.dur);
            ctx.fillStyle = TIPOS[s.tipo].color; ctx.fillRect(a, y, Math.max(1, b - a - 1), 30);
            geo.push({ x: a, w: b - a, y, h: 30, s, t });
            if (s.tipo === 'trabajo' && b - a > 14) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.dept[0], (a + b) / 2, y + 15); }
          }
          t += s.dur;
        }));
      });
      // Eje de horas.
      const ejeY = 134;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, ejeY + 0.5); ctx.lineTo(x1, ejeY + 0.5); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      VIZ.ticks(0, tmax, Math.max(2, Math.floor((x1 - x0) / 60))).forEach((v) => { ctx.beginPath(); ctx.moveTo(sx(v) + 0.5, ejeY); ctx.lineTo(sx(v) + 0.5, ejeY + 4); ctx.stroke(); ctx.fillText(v + ' h', sx(v), ejeY + 7); });
      const nombres = etapas.map((e) => e[0]).slice(0, paso);
      ctx.textAlign = 'left'; ctx.fillStyle = C.tinta2; ctx.fillText(paso ? 'iniciales: ' + nombres.map((n) => n[0] + '=' + n).filter((v, i, a) => a.indexOf(v) === i).join(', ') : '', x0, ejeY + 24);
      const cs = acum(S, paso), ci = acum(I, paso);
      registro.textContent = paso === 0
        ? 'Un pedido nace en Ventas y debe pasar por Bodega, (Compras) y Finanzas. Pulse «Un paso» para entregarlo al siguiente área.'
        : `${etapas[paso - 1][0]}: en silos el pedido espera ${hh(acum(S.slice(paso - 1, paso), 1, 'espera'))} y alguien lo vuelve a digitar; con el sistema integrado espera ${hh(acum(I.slice(paso - 1, paso), 1, 'espera'))} y no se redigita.`;
      lectura.set([
        ['tiempo transcurrido en silos', hh(cs)], ['tiempo con integración', hh(ci)],
        ['espera acumulada (silos)', hh(acum(S, paso, 'espera'))], ['reingreso (silos)', hh(acum(S, paso, 'reingreso'))],
        ['errores (silos / integrado)', `${S.slice(0, paso).flat().filter((x) => x.tipo === 'correccion').length} / ${I.slice(0, paso).flat().filter((x) => x.tipo === 'correccion').length}`],
        ['reducción del ciclo', cs > 0 ? VIZ.fmt((1 - ci / cs) * 100, 3) + ' %' : '—'],
      ]);
    }
    lienzo.alDibujar = () => S.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((h) => x >= h.x && x <= h.x + Math.max(2, h.w) && y >= h.y && y <= h.y + h.h);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.s.dept}</b>` + VIZ.filaTooltip(TIPOS[g.s.tipo].color, TIPOS[g.s.tipo].nombre, hh(g.s.dur)) + `<div>desde la hora <b>${VIZ.fmt(g.t, 3)}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: muchos pedidos y qué interfaces integrar ---------- */

  const DEPT = [['ventas', 'Ventas', 0, 0.5], ['bodega', 'Bodega', 0.4, 0.5], ['compras', 'Compras', 0.68, 0.08], ['fin', 'Finanzas', 1, 0.5]];
  const IFACES = [['VB', 'ventas', 'bodega'], ['BC', 'bodega', 'compras'], ['CF', 'compras', 'fin'], ['BF', 'bodega', 'fin']];
  const NOMBRE_IF = { VB: 'Ventas → Bodega', BC: 'Bodega → Compras', CF: 'Compras → Finanzas', BF: 'Bodega → Finanzas' };

  function montarMuchos(cuerpo) {
    let esp = 6, pe = 8, mins = 15, sla = 24, pedidosMes = 800, semilla = 1, integ = { VB: false, BC: false, CF: false, BF: false };
    let orders = [], res = null, bins = [], hover = -1, pl = null, grafo = null;
    const gen = () => { const rnd = VIZ.semilla(semilla * 71 + 9); orders = Array.from({ length: 400 }, () => ({ falta: rnd() < 0.4, u: Array.from({ length: 9 }, rnd) })); };
    gen();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera por traspaso manual', min: 1, max: 24, valor: esp, formato: (v) => v + ' h', alCambiar: (v) => { esp = v; calcular(); } });
    ctl.rango({ etiqueta: 'Probabilidad de error por captura', min: 0, max: 30, valor: pe, formato: (v) => v + ' %', alCambiar: (v) => { pe = v; calcular(); } });
    ctl.rango({ etiqueta: 'Meta de ciclo del pedido', min: 8, max: 72, paso: 4, valor: sla, formato: (v) => v + ' h', alCambiar: (v) => { sla = v; calcular(); } });
    ctl.rango({ etiqueta: 'Pedidos al mes', min: 100, max: 3000, paso: 100, valor: pedidosMes, formato: (v) => VIZ.entero(v), alCambiar: (v) => { pedidosMes = v; calcular(); } });
    ctl.boton('Integrar todo', () => { Object.keys(integ).forEach((k) => { integ[k] = true; }); calcular(); }, { primario: true });
    ctl.boton('Todo manual', () => { Object.keys(integ).forEach((k) => { integ[k] = false; }); calcular(); });
    ctl.boton('Otros pedidos', () => { semilla++; gen(); calcular(); });
    const lg = VIZ.lienzo(cuerpo, { alto: 170 });
    const tipG = VIZ.tooltip(lg);
    VIZ.subtitulo(cuerpo, 'Tiempo de ciclo de 400 pedidos');
    const lh = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 310 });
    const tipH = VIZ.tooltip(lh);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'interfaz integrada (dato capturado una vez)', forma: 'linea' }, { color: C.s8, texto: 'interfaz manual (reingreso y espera)', forma: 'linea' },
      { color: C.s1, texto: 'pedidos dentro de la meta' }, { color: C.s2, texto: 'pedidos fuera de la meta' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una flecha del diagrama para integrar o dejar manual esa interfaz. Cada interfaz integrada elimina su espera y su reingreso; observe cuál mueve más el tiempo medio y los pedidos con error. Pase el cursor sobre una barra para ver cuántos pedidos hay.');

    function ciclo(o) {
      const ids = o.falta ? ['VB', 'BC', 'CF'] : ['VB', 'BF'], k = { VB: 1, BC: 3, CF: 5, BF: 7 };
      let t = 0.25 + 0.5 + (o.falta ? 1 + 0.7 : 0.4), errores = 0, espera = 0, reing = 0;
      if (o.u[0] < pe / 100) { t += 4; errores++; }
      for (const id of ids) {
        const j = k[id];
        if (integ[id]) { const w = 0.5 * (0.5 + o.u[j]); t += w; espera += w; }
        else {
          const w = esp * (0.5 + o.u[j]); t += w + mins / 60; espera += w; reing += mins / 60;
          if (o.u[j + 1] < pe / 100) { t += 4; errores++; }
        }
      }
      return { t, errores, espera, reing };
    }
    function calcular() {
      const r = orders.map(ciclo), ts = r.map((x) => x.t);
      const prom = P.media(ts), p90 = P.cuantil(ts, 0.9), max = Math.ceil(Math.max(...ts) / 4) * 4;
      const nb = max / 4;
      bins = Array.from({ length: nb }, (_, i) => ({ a: i * 4, b: (i + 1) * 4, n: 0 }));
      ts.forEach((t) => { bins[Math.min(nb - 1, Math.floor(t / 4))].n++; });
      res = { prom, p90, dentro: ts.filter((t) => t <= sla).length / ts.length, conError: r.filter((x) => x.errores).length / r.length, reing: P.media(r.map((x) => x.reing)), espera: P.media(r.map((x) => x.espera)) };
      dibujarGrafo(); dibujarHist();
      const n = Object.values(integ).filter(Boolean).length;
      registro.textContent = `${n} de 4 interfaces integradas. Tiempo medio de ciclo ${hh(prom)}; ${VIZ.fmt(res.conError * 100, 3)} % de los pedidos necesitó corregir al menos un dato.`;
      lectura.set([
        ['ciclo medio', hh(prom)], ['percentil 90', hh(p90)], ['dentro de la meta', VIZ.fmt(res.dentro * 100, 3) + ' %'],
        ['pedidos con error', VIZ.fmt(res.conError * 100, 3) + ' %'], ['espera media por pedido', hh(res.espera)],
        ['horas de reingreso al mes', VIZ.fmt(res.reing * pedidosMes, 3) + ' h'],
      ]);
    }
    function dibujarGrafo() {
      const nodos = DEPT.map(([id, n]) => ({ id, tipo: 'act', etiqueta: n, borde: C.tinta }));
      const aristas = IFACES.map(([id, de, a]) => ({ id, de, a, etiqueta: integ[id] ? 'auto' : 'manual', color: integ[id] ? C.s6 : C.s8, ancho: integ[id] ? 3 : 2.5, guiones: !integ[id], colorTexto: integ[id] ? C.s6 : C.s8 }));
      const pos = Object.fromEntries(DEPT.map(([id, , x, y]) => [id, { x, y }]));
      lg.limpiar();
      grafo = P.dibujarGrafo(lg, nodos, aristas, pos, { margenX: 48, margenY: 28 });
    }
    function dibujarHist() {
      const { ctx } = lh;
      lh.limpiar();
      const nmax = Math.max(...bins.map((b) => b.n)), xmax = bins[bins.length - 1].b;
      pl = VIZ.plano(lh, { xmin: 0, xmax, ymin: 0, ymax: nmax * 1.12 }, { etiquetaX: 'horas de ciclo', etiquetaY: 'pedidos', formatoY: (v) => String(Math.round(v)) });
      pl.ejes();
      bins.forEach((b, i) => {
        if (!b.n) return;
        const c = b.b <= sla + 1e-9 ? C.s1 : C.s2, y = pl.sy(b.n);
        ctx.fillStyle = i === hover ? VIZ.alfa(c, 0.7) : c;
        ctx.beginPath(); ctx.roundRect(pl.sx(b.a) + 1, y, pl.sx(b.b) - pl.sx(b.a) - 2, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
      });
      ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5;
      if (sla <= xmax) { ctx.beginPath(); ctx.moveTo(pl.sx(sla), pl.y1 - 2); ctx.lineTo(pl.sx(sla), pl.y0); ctx.stroke(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('meta', pl.sx(sla) + 4, pl.y1); }
      ctx.restore();
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.sx(res.prom), pl.y1 + 14); ctx.lineTo(pl.sx(res.prom), pl.y0); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('media', pl.sx(res.prom) + 4, pl.y1 + 14);
    }
    lg.alDibujar = () => res && dibujarGrafo(); lh.alDibujar = () => res && dibujarHist();
    const lineaCerca = (x, y) => {
      if (!grafo) return null;
      let mejor = null, dm = 14;
      for (const l of grafo.lineas) {
        const [ax, ay] = l.p1, [bx, by] = l.p2, dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
        if (d < dm) { dm = d; mejor = l.e; }
      }
      return mejor;
    };
    lg.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lg.posicion(ev), e = lineaCerca(x, y);
      lg.canvas.style.cursor = e ? 'pointer' : 'default';
      if (!e) return tipG.ocultar();
      tipG.mostrar(x, y, `<b>${NOMBRE_IF[e.id]}</b><br>${integ[e.id] ? 'integrada: el dato viaja solo' : 'manual: se vuelve a digitar'}<br>clic para cambiar`);
    });
    lg.canvas.addEventListener('click', (ev) => { const { x, y } = lg.posicion(ev), e = lineaCerca(x, y); if (e) { integ[e.id] = !integ[e.id]; calcular(); } });
    lg.canvas.addEventListener('pointerleave', () => tipG.ocultar());
    lh.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lh.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujarHist(); } return tipH.ocultar(); }
      const i = bins.findIndex((b) => pl.ix(x) >= b.a && pl.ix(x) < b.b);
      if (i !== hover) { hover = i; dibujarHist(); }
      if (i < 0 || !bins[i].n) return tipH.ocultar();
      tipH.mostrar(x, y, `entre <b>${bins[i].a}</b> y <b>${bins[i].b}</b> h<br><b>${bins[i].n}</b> pedidos` + VIZ.filaTooltip(bins[i].b <= sla + 1e-9 ? C.s1 : C.s2, bins[i].b <= sla + 1e-9 ? 'dentro de la meta' : 'fuera de la meta', null));
    });
    lh.canvas.addEventListener('pointerleave', () => { hover = -1; tipH.ocultar(); dibujarHist(); });
    calcular();
  }

  VIZ.registrarTema('cross-department-flow', {
    intro: String.raw`
      <p>Un pedido de venta cruza varias áreas: <strong>Ventas</strong> lo registra, <strong>Bodega</strong> verifica y despacha, <strong>Compras</strong> reabastece y <strong>Finanzas</strong> factura y cobra.
      Cada paso entre áreas es un <em>traspaso</em> de información. Si cada una tiene su propio sistema, el dato se vuelve a digitar en cada traspaso, espera su turno en una bandeja o un correo y
      acumula errores.</p>
      <p>Un sistema integrado captura el dato una sola vez en el origen y lo deja disponible para todos. El beneficio no está en trabajar más rápido en cada área, sino en eliminar las esperas y
      el retrabajo <em>entre</em> áreas, que suelen ser la mayor parte del tiempo de ciclo del pedido.</p>`,
    visualizaciones: [
      {
        titulo: 'Un pedido a través de las áreas',
        descripcion: 'Avance un paso por área y compare las dos barras de tiempo: en silos aparecen esperas (gris), reingresos (naranja) y correcciones (rojo). Suba la espera por traspaso y la probabilidad de error y vea cuánto crece la barra de arriba mientras la de abajo casi no cambia.',
        montar: montarGantt,
      },
      {
        titulo: 'Qué interfaz integrar primero',
        descripcion: 'Haga clic en las flechas del diagrama para integrar de a una interfaz y observe la distribución del tiempo de ciclo de 400 pedidos. Busque la interfaz que más reduce el tiempo medio y los errores, y cuántas horas de reingreso al mes se ahorran.',
        montar: montarMuchos,
      },
    ],
    teoria: String.raw`
      <h2>Tiempo de ciclo y desperdicio entre áreas</h2>
      <p>El <strong>tiempo de ciclo</strong> de un pedido es la suma de lo que se trabaja y de lo que se espera. Con \(n\) traspasos manuales, cada uno con una espera media \(w\), un reingreso de \(r\) minutos y
      una probabilidad \(p\) de error que cuesta \(c\) horas corregir, el tiempo esperado es</p>
      \[ \mathbb{E}[T] = T_{\text{trabajo}} + n\left(w + \frac{r}{60}\right) + (n+1)\,p\,c. \]
      <p>El término \((n+1)\) cuenta la captura inicial más los \(n\) reingresos: cada captura es una oportunidad de error. Con un sistema integrado el dato se captura sólo una vez, por lo que el término de error
      pasa a \(p\,c\), el reingreso desaparece y la espera \(w\) se reduce a la de una notificación automática.</p>
      <h3>Ejemplo resuelto</h3>
      <p>Pedido sin compras: ventas 0,25 h, bodega 0,5 h y finanzas 0,4 h (\(T_{\text{trabajo}} = 1{,}15\) h), con \(n = 2\) traspasos, \(w = 6\) h, \(r = 15\) min, \(p = 0{,}08\) y \(c = 4\) h:</p>
      \[ \mathbb{E}[T_{\text{silos}}] = 1{,}15 + 2\,(6 + 0{,}25) + 3 \cdot 0{,}08 \cdot 4 = 1{,}15 + 12{,}5 + 0{,}96 \approx 14{,}6\ \text{h}. \]
      <p>Con integración, con espera de 0,5 h: \(\mathbb{E}[T_{\text{int}}] = 1{,}15 + 2 \cdot 0{,}5 + 0{,}08 \cdot 4 \approx 2{,}5\) h. El trabajo útil es sólo 1,15 h: en silos, más del 90 % del tiempo de ciclo es espera y retrabajo.</p>
      <div class="recuadro"><p>La probabilidad de que un pedido llegue sin errores a Finanzas es \((1-p)^{n+1}\). Con \(p = 8\,\%\) y tres capturas es \(0{,}92^3 \approx 78\,\%\): uno de cada cinco pedidos requiere corrección. Integrar reduce \(n\) y por tanto eleva esa probabilidad a \(1-p\).</p></div>
      <h2>Cómo se integra el flujo</h2>
      <ul>
        <li><strong>Base de datos compartida</strong> (un <a href="tema.html?id=erp-modules">ERP</a>): el dato vive en un solo lugar.</li>
        <li><strong>Interfaces entre aplicaciones</strong> (<a href="tema.html?id=legacy-integration">integración con sistemas legados</a>) cuando conviven sistemas distintos.</li>
        <li><strong>Flujos de trabajo</strong> que notifican y asignan tareas automáticamente (<a href="tema.html?id=enterprise-platforms">automatización de operaciones</a>).</li>
      </ul>
      <p>Integrar la interfaz con más tráfico o con más espera rinde más: conviene medir antes de decidir, por ejemplo con simulación (<a href="tema.html?id=process-simulation">simulación de procesos</a>) o con la
      información de los registros (<a href="tema.html?id=process-mining-overview">minería de procesos</a>).</p>
      <h2>Conexiones</h2>
      <p>Es la versión interna de lo que ocurre entre empresas en la <a href="tema.html?id=scm">cadena de suministro</a>, y su calidad se mide con la <a href="tema.html?id=information-quality">calidad de la información</a>
      (exactitud y oportunidad).</p>`,
  });
})();
