(function () {
  'use strict';
  const { color: C } = VIZ;
  const NOMBRES = ['ERP', 'CRM', 'WMS', 'RRHH', 'Web', 'BI', 'Fact.', 'Banco', 'Log.', 'Help', 'Prov.', 'App'];
  const NOMBRES_LARGOS = ['ERP central', 'CRM de clientes', 'Gestión de bodega', 'Recursos humanos', 'Sitio web', 'Inteligencia de negocios', 'Facturación', 'Banco', 'Logística', 'Mesa de ayuda', 'Portal de proveedores', 'Aplicación móvil'];
  const mil = (v) => '$' + VIZ.fmt(v, 4) + ' mil';

  /* ---------- Fig. 1: punto a punto frente a bus ---------- */

  function montarTopologia(cuerpo) {
    let n = 6, modo = 'p2p', legado = new Set([2, 3]), hover = -1, nodos = [], cx = 0, cy = 0;
    const ctl = VIZ.controles(cuerpo);
    const rN = ctl.rango({ etiqueta: 'Sistemas por conectar (n)', min: 2, max: 12, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Arquitectura de integración', opciones: [['p2p', 'Punto a punto'], ['bus', 'Bus de integración (middleware)']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.boton('Agregar un sistema', () => { if (n < 12) { n++; rN.valor = n; dibujar(); } }, { primario: true });
    ctl.boton('Quitar un sistema', () => { if (n > 2) { n--; rN.valor = n; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.85, altoMin: 290, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'sistema moderno (ofrece API)' }, { color: C.s7, texto: 'sistema legado (hay que construirle un adaptador)' },
      { color: C.eje, texto: 'interfaz estándar', forma: 'linea' }, { color: C.s2, texto: 'interfaz a medida (toca un legado)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un sistema para marcarlo o desmarcarlo como legado. Use «Agregar un sistema» y compare cuántas interfaces nuevas exige cada arquitectura. Pase el cursor sobre un sistema para resaltar sus conexiones.');

    const aMedida = (i, j) => (legado.has(i) || legado.has(j) ? 1 : 0);
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      cx = W / 2; cy = H / 2;
      const R = Math.min(W, H) / 2 - 30;
      nodos = Array.from({ length: n }, (_, i) => ({ i, x: cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n), y: cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n) }));
      let cMedida = 0;
      if (modo === 'p2p') {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const m = aMedida(i, j), res = hover === i || hover === j;
          if (m) cMedida++;
          ctx.strokeStyle = res ? C.tinta : m ? VIZ.alfa(C.s2, 0.75) : C.eje; ctx.lineWidth = res ? 2.5 : m ? 1.5 : 1;
          ctx.beginPath(); ctx.moveTo(nodos[i].x, nodos[i].y); ctx.lineTo(nodos[j].x, nodos[j].y); ctx.stroke();
        }
      } else {
        for (let i = 0; i < n; i++) {
          const m = legado.has(i); if (m) cMedida++;
          ctx.strokeStyle = hover === i ? C.tinta : m ? C.s2 : C.eje; ctx.lineWidth = hover === i ? 3 : m ? 2.5 : 2;
          ctx.beginPath(); ctx.moveTo(nodos[i].x, nodos[i].y); ctx.lineTo(cx, cy); ctx.stroke();
        }
        ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(cx - 26, cy - 16, 52, 32, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Bus', cx, cy + 1);
      }
      for (const p of nodos) {
        ctx.fillStyle = legado.has(p.i) ? C.s7 : C.s1; ctx.strokeStyle = hover === p.i ? C.tinta : C.superficie; ctx.lineWidth = hover === p.i ? 3 : 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 19, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(NOMBRES[p.i], p.x, p.y + 0.5);
      }
      const p2p = (n * (n - 1)) / 2;
      const cp = (() => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c += aMedida(i, j) ? 2.5 : 1; return c; })();
      const cb = 3 + [...Array(n).keys()].reduce((s, i) => s + (legado.has(i) ? 2.5 : 1), 0);
      registro.textContent = modo === 'p2p'
        ? `Punto a punto: ${n} sistemas necesitan ${n}·(${n} − 1)/2 = ${p2p} interfaces, y cada sistema nuevo agrega ${n - 1}. Con un bus bastarían ${n}.`
        : `Con bus: cada sistema se conecta una sola vez, así que hay ${n} adaptadores (frente a ${p2p} interfaces punto a punto); un sistema nuevo agrega sólo 1.`;
      lectura.set([
        ['interfaces punto a punto', String(p2p)], ['adaptadores con bus', String(n)],
        ['interfaces por sistema', modo === 'p2p' ? String(n - 1) : '1'], ['interfaces a medida', String(cMedida)],
        ['costo de construir, punto a punto', VIZ.fmt(cp, 4) + ' u.'], ['costo de construir, con bus', VIZ.fmt(cb, 4) + ' u.'],
      ]);
    }
    const buscar = (x, y) => nodos.findIndex((p) => (p.x - x) ** 2 + (p.y - y) ** 2 <= 22 * 22);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = buscar(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${NOMBRES_LARGOS[i]}</b><br>${legado.has(i) ? 'sistema legado' : 'sistema moderno'}<br>interfaces: <b>${modo === 'p2p' ? n - 1 : 1}</b>`);
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = buscar(x, y);
      if (i < 0) return;
      legado.has(i) ? legado.delete(i) : legado.add(i);
      dibujar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: costo de integrar ---------- */

  function montarCosto(cuerpo) {
    let c1 = 30, c2 = 40, K = 200, m = 6, T = 5, n = 8, hover = 0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Construir una interfaz punto a punto', min: 5, max: 80, valor: c1, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { c1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Construir un adaptador al bus', min: 5, max: 80, valor: c2, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { c2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo fijo de implantar el bus', min: 0, max: 600, paso: 20, valor: K, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { K = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Mantener una interfaz por año', min: 0, max: 20, valor: m, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { m = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Horizonte', min: 1, max: 10, valor: T, formato: (v) => v + ' años', alCambiar: (v) => { T = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'punto a punto', forma: 'linea' }, { color: C.s1, texto: 'con bus de integración', forma: 'linea' }, { color: C.tinta, texto: 'n elegido', forma: 'circulo' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para elegir cuántos sistemas hay (n). El bus tiene un costo fijo pero crece linealmente; el punto a punto crece con el cuadrado de n. Reduzca el costo fijo o suba el de cada interfaz y vea cómo se adelanta el punto de equilibrio.');

    const costoP = (k) => (k * (k - 1) / 2) * (c1 + m * T);
    const costoB = (k) => K + k * (c2 + m * T);
    const equilibrio = () => { for (let k = 2; k <= 40; k++) if (costoB(k) <= costoP(k)) return k; return null; };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const N = 20, ymax = Math.max(costoP(N), costoB(N)) * 1.05;
      pl = VIZ.plano(lienzo, { xmin: 2, xmax: N, ymin: 0, ymax }, { etiquetaX: 'sistemas por integrar (n)', etiquetaY: 'costo total (miles de dólares)', formatoY: (v) => VIZ.fmt(v, 3) });
      pl.ejes();
      const pts = (f) => Array.from({ length: N - 1 }, (_, i) => [i + 2, f(i + 2)]);
      VIZ.trazar(lienzo.ctx, pl, pts(costoP), C.s2, 2.5);
      VIZ.trazar(lienzo.ctx, pl, pts(costoB), C.s1, 2.5);
      const eq = equilibrio();
      if (eq && eq <= N) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(pl.sx(eq), pl.y1); ctx.lineTo(pl.sx(eq), pl.y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('equilibrio n = ' + eq, pl.sx(eq) + 5, pl.y1 + 2);
      }
      VIZ.marcador(ctx, pl.sx(n), pl.sy(costoP(n)), C.tinta, 5); VIZ.marcador(ctx, pl.sx(n), pl.sy(costoB(n)), C.tinta, 5);
      if (hover && hover !== n) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(costoP(hover)), C.s2, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(costoB(hover)), C.s1, 4); }
      const cp = costoP(n), cb = costoB(n);
      registro.textContent = `Con n = ${n}: punto a punto = ${n * (n - 1) / 2} · (${c1} + ${m}·${T}) = ${mil(cp)}; bus = ${K} + ${n} · (${c2} + ${m}·${T}) = ${mil(cb)}. ${cb < cp ? 'El bus resulta más barato.' : 'Todavía conviene el punto a punto.'}`;
      lectura.set([
        ['sistemas (n)', String(n)], ['interfaces punto a punto', String(n * (n - 1) / 2)], ['costo punto a punto', mil(cp)], ['costo con bus', mil(cb)],
        ['diferencia', (cb < cp ? 'el bus ahorra ' : 'el bus cuesta más ') + mil(Math.abs(cp - cb))], ['punto de equilibrio', eq ? 'n = ' + eq : 'no se alcanza'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover) { hover = 0; dibujar(); } return tip.ocultar(); }
      const k = Math.max(2, Math.min(20, Math.round(pl.ix(x))));
      if (k !== hover) { hover = k; dibujar(); }
      tip.mostrar(x, y, `n = <b>${k}</b>` + VIZ.filaTooltip(C.s2, 'punto a punto', mil(costoP(k))) + VIZ.filaTooltip(C.s1, 'bus', mil(costoB(k))) + `<div>${k * (k - 1) / 2} interfaces frente a ${k}</div>`);
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (pl && pl.dentro(x, y)) { n = Math.max(2, Math.min(20, Math.round(pl.ix(x)))); dibujar(); }
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = 0; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: migración gradual (strangler) ---------- */

  const MODULOS = ['Clientes', 'Facturación', 'Inventario', 'Nómina', 'Contabilidad', 'Compras', 'Ventas', 'Reportes', 'Pagos', 'Bodega', 'Crédito', 'Activos'];
  const TRIM = 20;

  function montarStrangler(cuerpo) {
    let porTrim = 2, cMig = 100, cLeg = 30, envej = 15, q = 0, geo = [], pl = null, hover = -1;
    const NUEVO = 10, FACHADA = 60;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Módulos migrados por trimestre', min: 1, max: 4, valor: porTrim, alCambiar: (v) => { porTrim = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Migrar un módulo', min: 40, max: 200, paso: 10, valor: cMig, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { cMig = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Mantener un módulo legado al año', min: 10, max: 80, valor: cLeg, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { cLeg = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Aumento anual del costo del legado', min: 0, max: 40, valor: envej, formato: (v) => v + ' %', alCambiar: (v) => { envej = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lt = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 460 ? 130 : 94) });
    const tipT = VIZ.tooltip(lt);
    const lg = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tipG = VIZ.tooltip(lg);
    VIZ.leyenda(cuerpo, [
      { color: C.tenue, texto: 'módulo que sigue en el legado', borde: C.inactivo }, { color: C.s2, texto: 'migrándose en este trimestre' }, { color: C.s6, texto: 'ya migrado' },
      { color: C.s8, texto: 'costo acumulado: mantener el legado', forma: 'linea' }, { color: C.s1, texto: 'costo acumulado: migración gradual', forma: 'linea' }, { color: C.s7, texto: 'costo acumulado: reemplazo total', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca los 20 trimestres: una fachada de API recibe las llamadas y las dirige al módulo viejo o al nuevo, y el legado se «estrangula» de a poco. Cambie el ritmo o el envejecimiento del legado y observe en qué trimestre la migración gradual deja de costar más que mantener. Pase el cursor sobre el gráfico para comparar.');

    // Series de costo por trimestre (miles de dólares).
    function series() {
      const g = Math.pow(1 + envej / 100, 1 / 4), leg = (t) => (cLeg / 4) * Math.pow(g, t), nuevo = NUEVO / 4;
      const mant = [0], grad = [0], bang = [0], mig = [0];
      for (let t = 1; t <= TRIM; t++) {
        const antes = Math.min(12, porTrim * (t - 1)), ahora = Math.min(12, porTrim * t), nMig = ahora - antes;
        mant.push(mant[t - 1] + 12 * leg(t));
        grad.push(grad[t - 1] + (12 - antes) * leg(t) + antes * nuevo + nMig * cMig + (t === 1 ? FACHADA : 0));
        const dur = 6, total = 12 * cMig * 1.4;
        bang.push(bang[t - 1] + (t <= dur ? 12 * leg(t) + total / dur : 12 * nuevo));
        mig.push(ahora);
      }
      return { mant, grad, bang, mig };
    }
    let S = null;
    function iniciar() {
      S = series(); q = 0;
      return (function* () { for (q = 1; q <= TRIM; q++) yield; q = TRIM; })();
    }
    function dibujar() {
      S = series();
      // Módulos.
      {
        const { ctx, ancho: W } = lt;
        lt.limpiar();
        const cols = W < 460 ? 4 : 6, gap = 6, tw = (W - gap * (cols + 1)) / cols, th = 34;
        geo = MODULOS.map((nm, i) => ({ nm, i, x: gap + (i % cols) * (tw + gap), y: gap + Math.floor(i / cols) * (th + gap), w: tw, h: th }));
        const migrados = q ? S.mig[q] : 0, previos = q > 1 ? S.mig[q - 1] : 0;
        geo.forEach((t) => {
          const hecho = t.i < previos, ahora = t.i >= previos && t.i < migrados;
          ctx.fillStyle = hecho ? C.s6 : ahora ? C.s2 : C.tenue; ctx.strokeStyle = hecho || ahora ? 'transparent' : C.inactivo; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, t.h, 6); ctx.fill(); if (!hecho && !ahora) ctx.stroke();
          ctx.fillStyle = hecho || ahora ? C.sobre : C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.nm, t.x + t.w / 2, t.y + t.h / 2, t.w - 6);
        });
      }
      // Costos acumulados.
      {
        const { ctx } = lg;
        lg.limpiar();
        const ymax = Math.max(S.mant[TRIM], S.grad[TRIM], S.bang[TRIM]) * 1.05;
        pl = VIZ.plano(lg, { xmin: 0, xmax: TRIM, ymin: 0, ymax }, { etiquetaX: 'trimestre', etiquetaY: 'costo acumulado (miles de dólares)', formatoY: (v) => VIZ.fmt(v, 3) });
        pl.ejes();
        [[S.mant, C.s8], [S.grad, C.s1], [S.bang, C.s7]].forEach(([a, c]) => {
          VIZ.trazar(ctx, pl, a.map((v, t) => [t, v]), VIZ.alfa(c, 0.25), 2);
          VIZ.trazar(ctx, pl, a.slice(0, q + 1).map((v, t) => [t, v]), c, 3);
          if (q > 0) VIZ.marcador(ctx, pl.sx(q), pl.sy(a[q]), c, 4);
        });
        if (hover >= 0) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); ctx.setLineDash([]); }
      }
      const cruce = S.grad.findIndex((v, t) => t > 0 && v <= S.mant[t]);
      registro.textContent = q === 0 ? 'Todos los módulos viven en el sistema legado. Pulse «Un paso» para avanzar un trimestre.'
        : `Trimestre ${q}: ${S.mig[q]} de 12 módulos migrados; la fachada de API enruta cada llamada al módulo nuevo o al legado, así el negocio no se detiene.`;
      lectura.set([
        ['trimestre', `${q} / ${TRIM}`], ['módulos migrados', `${q ? S.mig[q] : 0} / 12`],
        ['acumulado: mantener', mil(S.mant[q])], ['acumulado: gradual', mil(S.grad[q])], ['acumulado: reemplazo total', mil(S.bang[q])],
        ['gradual deja de costar más', cruce < 0 ? 'no en 5 años' : 'trimestre ' + cruce],
      ]);
    }
    lt.alDibujar = () => S && dibujar(); lg.alDibujar = () => S && dibujar();
    lt.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lt.posicion(ev), t = geo.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
      if (!t) return tipT.ocultar();
      const estado = q && t.i < S.mig[q] ? 'migrado al sistema nuevo' : 'sigue en el legado';
      tipT.mostrar(x, y, `<b>${t.nm}</b><br>${estado}`);
    });
    lt.canvas.addEventListener('pointerleave', () => tipT.ocultar());
    lg.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lg.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tipG.ocultar(); }
      const t = Math.max(0, Math.min(TRIM, Math.round(pl.ix(x))));
      if (t !== hover) { hover = t; dibujar(); }
      tipG.mostrar(x, y, `trimestre <b>${t}</b>` + VIZ.filaTooltip(C.s8, 'mantener', mil(S.mant[t])) + VIZ.filaTooltip(C.s1, 'gradual', mil(S.grad[t])) + VIZ.filaTooltip(C.s7, 'reemplazo total', mil(S.bang[t])));
    });
    lg.canvas.addEventListener('pointerleave', () => { hover = -1; tipG.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('legacy-integration', {
    intro: String.raw`
      <p>Un <strong>sistema legado</strong> es una aplicación antigua que sigue sosteniendo procesos críticos: funciona, pero está escrita en tecnología obsoleta, es cara de modificar y rara vez ofrece interfaces
      modernas. Reemplazarlo de golpe es arriesgado, así que casi siempre debe convivir con sistemas nuevos, y para eso hay que <strong>integrar aplicaciones</strong>.</p>
      <p>La forma de conectarlas importa mucho. Unir cada sistema con todos los demás parece sencillo con tres aplicaciones, pero el número de conexiones crece con el cuadrado. Un
      <strong>middleware</strong> o bus de integración reduce el problema a una conexión por sistema, y una migración gradual permite apagar el legado módulo a módulo.</p>`,
    visualizaciones: [
      {
        titulo: 'Punto a punto frente a bus',
        descripcion: 'Agregue sistemas de a uno y cuente las interfaces: en punto a punto la malla se vuelve densa enseguida, con el bus cada sistema nuevo suma una. Marque algunos como legado (clic) y vea cuántas interfaces deben construirse a medida.',
        montar: montarTopologia,
      },
      {
        titulo: 'Cuándo conviene el bus',
        descripcion: 'La curva del punto a punto sube con n² y la del bus con n más un costo fijo. Busque el punto de equilibrio y vea cómo se mueve al encarecer las interfaces o al abaratar la implantación del bus.',
        montar: montarCosto,
      },
      {
        titulo: 'Migración gradual del legado',
        descripcion: 'Reproduzca los trimestres y compare tres caminos: mantener el legado, migrar de a poco con una fachada de API o reemplazar todo de una vez. Pruebe un legado que envejece rápido (30 %) y otro estable (0 %) y observe qué estrategia gana.',
        montar: montarStrangler,
      },
    ],
    teoria: String.raw`
      <h2>Sistemas legados</h2>
      <p>Un legado no es «viejo» por su edad, sino por su costo de cambio: tecnología sin soporte, conocimiento concentrado en pocas personas, documentación escasa y datos en formatos propios.
      Sigue en uso porque contiene reglas de negocio valiosas y porque su reemplazo interrumpe operaciones. Su costo de mantención suele crecer con el tiempo, con una tasa \(g\) anual: \(C(t) = C_0 (1+g)^t\).</p>
      <h2>Conectar aplicaciones</h2>
      <p>Entre \(n\) aplicaciones que deben intercambiar datos hay dos arquitecturas básicas:</p>
      <table>
        <tr><th>Arquitectura</th><th>Interfaces</th><th>Al agregar un sistema</th><th>Riesgo</th></tr>
        <tr><td>Punto a punto</td><td>\(\dfrac{n(n-1)}{2}\)</td><td>\(n\) nuevas</td><td>«espagueti», cada cambio afecta a muchos</td></tr>
        <tr><td>Bus o hub (middleware, ESB)</td><td>\(n\)</td><td>1 nueva</td><td>punto único de falla, costo fijo inicial</td></tr>
      </table>
      <p>El bus traduce formatos, enruta mensajes y centraliza seguridad y monitoreo; los sistemas modernos exponen <strong>API</strong> y los legados requieren un <strong>adaptador</strong> que las simule.
      Con 8 sistemas hay \(8 \cdot 7/2 = 28\) interfaces punto a punto frente a 8 con bus; con 12, 66 frente a 12.</p>
      <h3>Punto de equilibrio</h3>
      <p>Sean \(c_1\) el costo de construir una interfaz, \(c_2\) el de un adaptador, \(K\) el costo fijo del bus, \(m\) el costo anual de mantener una interfaz y \(T\) el horizonte en años. Entonces</p>
      \[ C_{\text{p2p}}(n) = \frac{n(n-1)}{2}\,(c_1 + mT), \qquad C_{\text{bus}}(n) = K + n\,(c_2 + mT). \]
      <p><strong>Ejemplo resuelto.</strong> Con \(c_1 = 30\), \(c_2 = 40\), \(K = 200\), \(m = 6\) y \(T = 5\) (miles de dólares): \(C_{\text{p2p}} = 60\,\tfrac{n(n-1)}{2} = 30n^2 - 30n\) y \(C_{\text{bus}} = 200 + 70n\).
      Igualando, \(30n^2 - 100n - 200 = 0\), de donde \(n \approx 4{,}7\): desde 5 sistemas el bus es más barato. Con \(n = 8\), \(C_{\text{p2p}} = 1680\) y \(C_{\text{bus}} = 760\).</p>
      <h2>Migración gradual (estrangulamiento)</h2>
      <p>En lugar de reemplazar el legado de una vez, se coloca delante una <strong>fachada</strong> de API y se reescribe un módulo por vez; cada llamada se dirige al módulo nuevo si ya existe o al legado si no.
      Cuando todos están migrados, el legado se apaga. Si se migran \(r\) módulos por trimestre, el costo del trimestre \(t\) es</p>
      \[ \text{costo}(t) = \underbrace{(M - k_t)\,\frac{C_0}{4}(1+g)^{t/4}}_{\text{legado restante}} + \underbrace{k_t\,\frac{c_n}{4}}_{\text{módulos nuevos}} + \underbrace{r\,c_{\text{mig}}}_{\text{migración}}, \quad k_t = \min(M, r\,t). \]
      <div class="recuadro"><p>El reemplazo total concentra el riesgo: las estimaciones de proyectos grandes suelen quedar cortas (aquí se supone un 40 % de sobrecosto) y no entrega valor hasta el final. La migración gradual entrega valor
      desde el primer módulo y permite corregir el rumbo, a cambio de mantener durante un tiempo dos sistemas en paralelo.</p></div>
      <h2>Conexiones</h2>
      <p>Un <a href="tema.html?id=erp-modules">ERP</a> reduce la necesidad de interfaces al unificar módulos; cuando no es posible, la integración mide su beneficio en el
      <a href="tema.html?id=cross-department-flow">flujo de información entre departamentos</a>. Las decisiones de migrar o reemplazar se evalúan con las
      <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a> y con la lógica de <a href="tema.html?id=buy-vs-build">comprar o construir</a>. Los bus y las API dependen de la
      <a href="tema.html?id=client-server-architectures">arquitectura cliente-servidor</a>.</p>`,
  });
})();
