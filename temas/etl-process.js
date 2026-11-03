(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => `$${VIZ.entero(v)}`;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fuentes heterogéneas y reglas de transformación ---------- */

  const REG = ['Norte', 'Centro', 'Sur'];
  const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dos = (n) => String(n).padStart(2, '0');
  const FUENTES = [
    { k: 'Tienda', nombre: 'Caja de tiendas', pref: 'T', fecha: (a, m, d) => `${dos(d)}/${dos(m)}/${a}`, reg: (r) => r[0], monto: (v) => miles(v), formato: 'DD/MM/AAAA, región en una letra, monto «12.450»' },
    { k: 'Web', nombre: 'Comercio electrónico', pref: 'W', fecha: (a, m, d) => `${a}-${dos(m)}-${dos(d)}`, reg: (r) => r, monto: (v) => String(v), formato: 'AAAA-MM-DD, región con su nombre, monto «12450»' },
    { k: 'ERP', nombre: 'ERP de facturación', pref: 'E', fecha: (a, m, d) => `${a}${dos(m)}${dos(d)}`, reg: (r) => r.toUpperCase(), monto: (v) => (v / 1000).toFixed(2), formato: 'AAAAMMDD, región en mayúsculas, monto en miles «12.45»' },
  ];
  const COD = { N: 'Norte', C: 'Centro', S: 'Sur' };
  const TIT = (s) => s[0] + s.slice(1).toLowerCase();

  // Registros de las tres fuentes con defectos (duplicados, nulos, negativos, fechas imposibles, regiones mal escritas).
  function generar(semilla, n, mult) {
    const rnd = VIZ.semilla(semilla * 7919 + 13), listas = [];
    FUENTES.forEach((f) => {
      const lista = [];
      for (let i = 0; i < n; i++) {
        const a = 2024, m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
        const region = REG[Math.floor(rnd() * 3)], monto = (800 + Math.floor(rnd() * 9000)) * 10;
        const verdad = { fecha: `${a}-${dos(m)}-${dos(d)}`, region, monto };
        const r = { fuente: f.k, id: `${f.pref}${String(i + 1).padStart(3, '0')}`, verdad, defecto: null, dup: false, fecha: f.fecha(a, m, d), region: f.reg(region), monto: f.monto(monto) };
        const u = rnd();
        if (u < 0.04 * mult) { r.defecto = 'fecha'; r.fecha = f.fecha(a, 2, 30); }
        else if (u < 0.07 * mult) { r.defecto = 'región'; r.region = r.region + 'x'; }
        else if (u < 0.12 * mult) { r.defecto = 'nulo'; r.monto = null; }
        else if (u < 0.15 * mult) { r.defecto = 'negativo'; r.monto = '-' + r.monto; }
        lista.push(r);
      }
      const copias = [];
      lista.forEach((r, i) => { if (rnd() < 0.06 * mult) copias.push([i + 1 + Math.floor(rnd() * (n - i)), { ...r, dup: true }]); });
      copias.sort((x, y) => y[0] - x[0]).forEach(([pos, c]) => lista.splice(Math.min(pos, lista.length), 0, c));
      listas.push(lista);
    });
    const orden = [], largo = Math.max(...listas.map((l) => l.length));
    for (let i = 0; i < largo; i++) listas.forEach((l) => { if (l[i]) orden.push(l[i]); });
    return orden;
  }
  const montoCorrecto = (r) => (r.monto == null ? null : r.fuente === 'Tienda' ? Number(r.monto.replace(/\./g, '')) : r.fuente === 'ERP' ? Math.round(Number(r.monto) * 1000) : Number(r.monto));

  // Aplica las reglas en orden a los registros dados (con memoria para detectar claves repetidas).
  function transformar(recs, reglas) {
    const vistos = new Set();
    return recs.map((r) => {
      const rech = (razon) => ({ r, ok: false, razon });
      let fecha;
      if (reglas.fecha) {
        let a, m, d;
        if (r.fuente === 'Tienda') [d, m, a] = r.fecha.split('/').map(Number);
        else if (r.fuente === 'Web') [a, m, d] = r.fecha.split('-').map(Number);
        else { a = +r.fecha.slice(0, 4); m = +r.fecha.slice(4, 6); d = +r.fecha.slice(6, 8); }
        const dt = new Date(Date.UTC(a, m - 1, d));
        if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return rech('fecha inexistente');
        fecha = `${a}-${dos(m)}-${dos(d)}`;
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) return rech('fecha sin formato AAAA-MM-DD');
        fecha = r.fecha;
      }
      let region = r.region;
      if (reglas.region) {
        region = r.fuente === 'Tienda' ? COD[r.region] : r.fuente === 'ERP' ? TIT(r.region) : r.region;
        if (!REG.includes(region)) return rech('región fuera de catálogo');
      } else if (!REG.includes(region)) return rech('región sin mapear');
      let monto;
      if (reglas.monto) monto = r.monto == null ? null : r.fuente === 'Tienda' ? Number(r.monto.replace(/\./g, '')) : r.fuente === 'ERP' ? Math.round(Number(r.monto) * 1000) : Number(r.monto);
      else monto = Number(r.monto);
      if (reglas.valida) {
        if (monto === null) return rech('monto nulo');
        if (monto < 0) return rech('monto negativo');
      }
      if (reglas.dup) {
        if (vistos.has(r.id)) return rech('clave duplicada');
        vistos.add(r.id);
      }
      const fila = { fecha, region, monto };
      const v = r.verdad;
      const silencioso = r.dup || !!r.defecto || fecha !== v.fecha || region !== v.region || monto !== v.monto;
      return { r, ok: true, fila, silencioso };
    });
  }
  const REGLAS = [
    { clave: 'fecha', texto: 'Convertir y validar fechas' }, { clave: 'region', texto: 'Mapear regiones al catálogo' }, { clave: 'monto', texto: 'Normalizar montos y unidades' },
    { clave: 'valida', texto: 'Rechazar montos nulos o negativos' }, { clave: 'dup', texto: 'Eliminar claves duplicadas' },
  ];
  const celdaTxt = (v) => (v == null ? '(nulo)' : String(v));

  /* ---------- Fig. 1: ETL registro a registro ---------- */

  function montarEtl(cuerpo) {
    let semilla = 1, mult = 1, k = 0, recs = [], res = [], hover = -1, celdas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Defectos en las fuentes', min: 0, max: 3, paso: 0.5, valor: mult, formato: (v) => `${v}×`, alCambiar: (v) => { mult = v; rep.reiniciar(); } });
    const reglas = ctl.casillas(REGLAS.map((r) => ({ clave: r.clave, texto: r.texto })), () => dibujar());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 3 * 44 + 14 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tenue, texto: 'pendiente', borde: C.inactivo }, { color: C.s6, texto: 'cargada correcta' }, { color: C.s2, texto: 'cargada con error silencioso' }, { color: C.s8, texto: 'rechazada' },
      { color: C.superficie, texto: 'registro que se procesa', borde: C.s1 },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada cuadro es un registro de una fuente (cajas de tienda, web y ERP, cada una con su formato). Apague una regla y vuelva a ejecutar: los registros que antes se rechazaban pueden cargarse mal sin que nadie lo note (naranjo). Pase el cursor sobre un cuadro para ver el registro.');

    function iniciar() { recs = generar(semilla, 20, mult); k = 0; return (function* () { while (k < recs.length) { k++; yield; } })(); }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      res = transformar(recs.slice(0, k), reglas);
      const porFuente = FUENTES.map((f) => recs.map((r, i) => [r, i]).filter(([r]) => r.fuente === f.k));
      const maxN = Math.max(...porFuente.map((l) => l.length)), izq = 62, tam = Math.min(26, (W - izq - 8) / maxN);
      celdas = [];
      porFuente.forEach((lista, s) => {
        const y = 8 + s * 44;
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(FUENTES[s].k, 4, y + tam / 2);
        lista.forEach(([r, i], j) => {
          const x = izq + j * tam, hecho = i < k, e = res[i];
          ctx.fillStyle = !hecho ? C.tenue : !e.ok ? C.s8 : e.silencioso ? C.s2 : C.s6;
          ctx.beginPath(); ctx.roundRect(x + 1, y, tam - 2, tam - 2, 3); ctx.fill();
          if (r.dup) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(9, 700); ctx.textAlign = 'center'; ctx.fillText('=', x + tam / 2, y + tam / 2 - 1); }
          if (i === k - 1) { ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 1, y - 2, tam + 2, tam + 2, 4); ctx.stroke(); }
          if (i === hover) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(x, y - 1, tam, tam); }
          celdas.push({ x, y, w: tam, h: tam, i });
        });
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(FUENTES[s].formato, izq, y + tam + 2);
      });
      const ult = res.slice(-8).reverse();
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('tr', null, ...['fuente', 'clave', 'fecha cruda', 'región cruda', 'monto crudo', 'resultado'].map((t) => VIZ.el('th', null, t))),
        ...ult.map((e, i) => VIZ.el('tr', { class: i === 0 ? 'activa' : null }, VIZ.el('td', null, e.r.fuente), VIZ.el('td', null, e.r.id), VIZ.el('td', null, e.r.fecha), VIZ.el('td', null, e.r.region),
          VIZ.el('td', null, celdaTxt(e.r.monto)), VIZ.el('td', null, e.ok ? (e.silencioso ? `cargada con error: ${e.fila.fecha}, ${e.fila.region}, ${dinero(e.fila.monto)}` : `cargada: ${e.fila.fecha}, ${e.fila.region}, ${dinero(e.fila.monto)}`) : `rechazada: ${e.razon}`)))));
      const ok = res.filter((e) => e.ok), mal = ok.filter((e) => e.silencioso), rechazadas = res.length - ok.length;
      registro.textContent = !k ? 'Ninguna fila leída aún. Cada paso extrae un registro, aplica las reglas activas y lo carga o lo rechaza.'
        : `${res[k - 1].r.fuente} ${res[k - 1].r.id}: ${res[k - 1].ok ? (res[k - 1].silencioso ? 'se cargó, pero con un valor equivocado (la regla desactivada no lo detectó)' : 'pasó todas las reglas y se cargó') : 'rechazado, ' + res[k - 1].razon}.`;
      lectura.set([
        ['registros leídos', `${k} de ${recs.length}`],
        ['cargados correctos', String(ok.length - mal.length)],
        ['cargados con error silencioso', String(mal.length)],
        ['rechazados', String(rechazadas)],
        ['cuadratura leídos = cargados + rechazados', k === ok.length + rechazadas ? 'cuadra' : 'no cuadra'],
        ['error en lo cargado', ok.length ? pct(mal.length / ok.length) : '—'],
      ]);
    }
    lienzo.alDibujar = () => recs.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celdas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y - 2 && y <= q.y + q.h);
      if ((c ? c.i : -1) !== hover) { hover = c ? c.i : -1; dibujar(); }
      if (!c) return tip.ocultar();
      const r = recs[c.i];
      if (c.i >= k) return tip.mostrar(x, y, `<b>${r.fuente} ${r.id}</b><br>pendiente de procesar`);
      const e = res[c.i];
      tip.mostrar(x, y, `<b>${r.fuente} ${r.id}</b>${r.dup ? ' (copia repetida)' : ''}<br>${r.fecha} · ${r.region} · ${celdaTxt(r.monto)}<br>` + (e.ok ? `→ ${e.fila.fecha} · ${e.fila.region} · ${dinero(e.fila.monto)}${e.silencioso ? '<br>valor real: ' + dinero(r.verdad.monto) : ''}` : `rechazado: ${e.razon}`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (recs.length) dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: carga completa frente a incremental ---------- */

  const BASE = 5e6, DIAS = 30;
  function montarCarga(cuerpo) {
    let nuevas = 400000, pmod = 0.005, pborr = 0.0005, tasa = 2000, ventana = 2, dia = 0, hover = 0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Filas nuevas por día', min: 50000, max: 1000000, paso: 50000, valor: nuevas, formato: (v) => VIZ.entero(v), alCambiar: (v) => { nuevas = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Filas antiguas modificadas por día', min: 0, max: 0.02, paso: 0.001, valor: pmod, formato: (v) => pct(v), alCambiar: (v) => { pmod = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Borrados en el origen por día', min: 0, max: 0.003, paso: 0.0001, valor: pborr, formato: (v) => pct(v), alCambiar: (v) => { pborr = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Velocidad de carga', min: 500, max: 5000, paso: 250, valor: tasa, formato: (v) => `${VIZ.entero(v)} filas/s`, alCambiar: (v) => { tasa = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ventana nocturna disponible', min: 1, max: 6, paso: 0.5, valor: ventana, formato: (v) => `${v} h`, alCambiar: (v) => { ventana = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar: () => { dia = 0; return (function* () { while (dia < DIAS) { dia++; yield; } })(); }, dibujar, velocidad: 2 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'carga completa (todas las filas)', forma: 'linea' }, { color: C.s1, texto: 'carga incremental (cambios)', forma: 'linea' },
      { color: C.s8, texto: 'límite de la ventana nocturna', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Parte con 5 millones de filas. Cada noche llegan filas nuevas y cambian otras. Reproduzca los 30 días y suba las filas nuevas hasta que la carga completa deje de caber en la ventana; luego observe qué filas «fantasma» deja el incremental si en el origen se borran registros. Pase el cursor sobre una línea para ver el día.');

    function series() {
      const rnd = VIZ.semilla(5), completa = [], incr = [], fantasma = [];
      let total = BASE, fan = 0;
      for (let d = 1; d <= DIAS; d++) {
        const mod = pmod * total * (0.8 + 0.4 * rnd()), borr = pborr * total;
        total += nuevas - borr; fan += borr;
        completa.push(total / tasa / 60);
        incr.push((nuevas + mod) / tasa / 60);
        fantasma.push(fan);
      }
      return { completa, incr, fantasma };
    }
    function dibujar() {
      const { ctx } = lienzo, s = series();
      lienzo.limpiar();
      const lim = ventana * 60, ymax = Math.max(lim, ...s.completa) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: DIAS, ymin: 0, ymax }, { etiquetaX: 'día', etiquetaY: 'minutos de carga por noche', formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(lim)); ctx.lineTo(pl.x1, pl.sy(lim)); ctx.stroke(); ctx.restore();
      const pts = (a) => a.slice(0, dia).map((v, i) => [i + 1, v]);
      VIZ.trazar(ctx, pl, pts(s.completa), C.s2, 2.5);
      VIZ.trazar(ctx, pl, pts(s.incr), C.s1, 2.5);
      const rotura = s.completa.findIndex((v) => v > lim) + 1;
      if (rotura && rotura <= dia) VIZ.marcador(ctx, pl.sx(rotura), pl.sy(s.completa[rotura - 1]), C.s8, 6);
      if (dia) { VIZ.marcador(ctx, pl.sx(dia), pl.sy(s.completa[dia - 1]), C.s2, 4.5); VIZ.marcador(ctx, pl.sx(dia), pl.sy(s.incr[dia - 1]), C.s1, 4.5); }
      if (hover) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y0); ctx.lineTo(pl.sx(hover), pl.y1); ctx.stroke(); }
      const d = Math.max(1, dia);
      const ahorro = Array.from({ length: dia }, (_, i) => (s.completa[i] - s.incr[i]) * 60 * tasa).reduce((a, b) => a + b, 0);
      registro.textContent = !dia ? 'Pulse «Reproducir»: cada paso es una noche de carga.'
        : `Noche ${dia}: la carga completa procesa ${VIZ.entero(s.completa[d - 1] * 60 * tasa)} filas (${VIZ.fmt(s.completa[d - 1], 3)} min) y la incremental ${VIZ.entero(s.incr[d - 1] * 60 * tasa)} (${VIZ.fmt(s.incr[d - 1], 3)} min).` +
          (s.completa[d - 1] > lim ? ' La carga completa ya no cabe en la ventana.' : '');
      lectura.set([
        ['carga completa hoy', dia ? `${VIZ.fmt(s.completa[d - 1], 3)} min` : '—'],
        ['carga incremental hoy', dia ? `${VIZ.fmt(s.incr[d - 1], 3)} min` : '—'],
        ['ventana disponible', `${lim} min`],
        ['primera noche en que la completa no cabe', rotura ? `día ${rotura}` : 'ninguna en 30 días'],
        ['filas ahorradas por el incremental', VIZ.entero(ahorro)],
        ['filas fantasma en el incremental', dia ? VIZ.entero(s.fantasma[d - 1]) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = 0; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(DIAS, Math.round(pl.ix(x))));
      dibujar();
      const s = series();
      tip.mostrar(x, y, `día <b>${hover}</b>` + VIZ.filaTooltip(C.s2, 'completa', `${VIZ.fmt(s.completa[hover - 1], 3)} min`) + VIZ.filaTooltip(C.s1, 'incremental', `${VIZ.fmt(s.incr[hover - 1], 3)} min`) + `fantasmas: <b>${VIZ.entero(s.fantasma[hover - 1])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = 0; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 3: rechazos y auditoría ---------- */

  const RAZONES = ['fecha inexistente', 'región fuera de catálogo', 'monto nulo', 'monto negativo', 'clave duplicada'];
  function montarAuditoria(cuerpo) {
    let semilla = 1, mult = 1, tol = 0.1, sel = -1, hover = -1, filas = [], res = [], zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Defectos en las fuentes', min: 0.5, max: 4, paso: 0.5, valor: mult, formato: (v) => `${v}×`, alCambiar: (v) => { mult = v; calcular(); } });
    ctl.rango({ etiqueta: 'Rechazo tolerado antes de detener la carga', min: 0.02, max: 0.3, paso: 0.01, valor: tol, formato: pct, alCambiar: (v) => { tol = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => RAZONES.length * 42 + 10 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, FUENTES.map((f, i) => ({ color: C['s' + (i + 1)], texto: f.nombre })));
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con todas las reglas activas, 300 registros se auditan por motivo de rechazo y por fuente. Haga clic en una barra para ver ejemplos de filas rechazadas; suba los defectos y vea cuándo la carga se detiene por superar la tolerancia.');

    function calcular() { filas = generar(semilla, 100, mult); res = transformar(filas, { fecha: true, region: true, monto: true, valida: true, dup: true }); dibujar(); }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const rech = res.filter((e) => !e.ok), cargadas = res.filter((e) => e.ok);
      const cuenta = RAZONES.map((rz) => FUENTES.map((f) => rech.filter((e) => e.razon === rz && e.r.fuente === f.k).length));
      const tot = cuenta.map((a) => a.reduce((x, y) => x + y, 0)), max = Math.max(1, ...tot), izq = 8, der = 50;
      zonas = [];
      RAZONES.forEach((rz, i) => {
        const y = 6 + i * 42;
        zonas.push([y - 2, y + 38]);
        if (i === hover || i === sel) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y - 3, W, 41); }
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(rz, izq, y);
        let x = izq;
        const esc = (W - izq - der) / max;
        cuenta[i].forEach((n, s) => {
          if (!n) return;
          ctx.fillStyle = C['s' + (s + 1)]; ctx.fillRect(x, y + 16, n * esc, 18); x += n * esc;
        });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle'; ctx.fillText(String(tot[i]), x + 6, y + 25);
      });
      const frac = rech.length / res.length, sumaF = filas.reduce((s, r) => s + (montoCorrecto(r) || 0), 0);
      const sumaC = cargadas.reduce((s, e) => s + e.fila.monto, 0), sumaR = rech.reduce((s, e) => s + (montoCorrecto(e.r) || 0), 0);
      const detenida = frac > tol;
      if (sel >= 0) {
        const ej = rech.filter((e) => e.razon === RAZONES[sel]).slice(0, 6);
        caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
          VIZ.el('tr', null, ...['fuente', 'clave', 'fecha cruda', 'región cruda', 'monto crudo'].map((t) => VIZ.el('th', null, t))),
          ...ej.map((e) => VIZ.el('tr', null, VIZ.el('td', null, e.r.fuente), VIZ.el('td', null, e.r.id), VIZ.el('td', null, e.r.fecha), VIZ.el('td', null, e.r.region), VIZ.el('td', null, celdaTxt(e.r.monto))))));
      } else caja.replaceChildren();
      registro.textContent = (detenida ? `Carga detenida: se rechaza ${pct(frac)} de las filas y la tolerancia es ${pct(tol)}; hay que revisar las fuentes antes de cargar.` : `Carga aprobada: se rechaza ${pct(frac)} de las filas, dentro de la tolerancia de ${pct(tol)}.`) +
        (sel >= 0 ? ` Ejemplos de «${RAZONES[sel]}» abajo.` : ' Haga clic en una barra para ver ejemplos.');
      lectura.set([
        ['filas extraídas', String(res.length)],
        ['cargadas', String(cargadas.length)],
        ['rechazadas', `${rech.length} (${pct(frac)})`],
        ['monto en las fuentes', dinero(sumaF)],
        ['cargado + rechazado', dinero(sumaC + sumaR)],
        ['conciliación', sumaF === sumaC + sumaR ? 'cuadra' : 'diferencia ' + dinero(sumaF - sumaC - sumaR)],
      ]);
      zonas.cuenta = cuenta;
    }
    lienzo.alDibujar = () => res.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = zonas.findIndex(([a, b]) => y >= a && y < b);
      if (i !== hover) { hover = i; dibujar(); }
      lienzo.canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${RAZONES[i]}</b>` + FUENTES.map((f, s) => VIZ.filaTooltip(C['s' + (s + 1)], f.nombre, zonas.cuenta[i][s])).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (res.length) dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { y } = lienzo.posicion(ev);
      const i = zonas.findIndex(([a, b]) => y >= a && y < b);
      sel = i === sel ? -1 : i;
      dibujar();
    });
    calcular();
  }

  VIZ.registrarTema('etl-process', {
    intro: String.raw`
      <p>El proceso <strong>ETL</strong> (<em>extract, transform, load</em>) lleva los datos desde los sistemas operativos hasta el almacén: se <em>extraen</em> de cada fuente, se
      <em>transforman</em> para que sean coherentes entre sí (formatos de fecha, claves, unidades) y se <em>cargan</em>. Casi siempre las fuentes son heterogéneas: la caja de la tienda,
      el sitio web y el ERP describen la misma venta de maneras distintas.</p>
      <p>La parte delicada no es mover datos, sino decidir qué hacer con los que no sirven. Un buen ETL rechaza lo inválido, deja registro de por qué y concilia los totales; uno descuidado
      carga errores silenciosos que luego contaminan todos los informes.</p>`,
    visualizaciones: [
      {
        titulo: 'ETL registro a registro',
        descripcion: 'Ejecute el ETL y observe cuáles registros se cargan o se rechazan. Apague «Normalizar montos y unidades» o «Eliminar claves duplicadas» y vuelva a mirar: aparecen cargas equivocadas sin aviso.',
        montar: montarEtl,
      },
      {
        titulo: 'Carga completa frente a incremental',
        descripcion: 'Reproduzca 30 noches y suba las filas nuevas hasta que la carga completa se salga de la ventana; luego aumente los borrados en el origen y vea crecer las filas fantasma del incremental.',
        montar: montarCarga,
      },
      {
        titulo: 'Rechazos y auditoría',
        descripcion: 'Suba los defectos de las fuentes y mire qué motivo de rechazo domina y de qué fuente viene. Baje la tolerancia hasta que la carga se detenga y haga clic en una barra para ver ejemplos.',
        montar: montarAuditoria,
      },
    ],
    teoria: String.raw`
      <h2>Las tres etapas</h2>
      <table>
        <tr><th>Etapa</th><th>Tarea</th><th>Ejemplo en las fuentes de la figura</th></tr>
        <tr><td>Extracción</td><td>Leer los datos de cada fuente, completos o solo los cambios</td><td>Consultas a las cajas, exportación del ERP, API de la web</td></tr>
        <tr><td>Transformación</td><td>Limpiar, convertir, integrar y validar</td><td>«12.450» → 12450; «ERP 12.45 (miles)» → 12450; «N» → Norte</td></tr>
        <tr><td>Carga</td><td>Insertar en el almacén y registrar la auditoría</td><td>Hechos de ventas con una fila rechazada por motivo</td></tr>
      </table>
      <h2>Reglas de transformación</h2>
      <ul>
        <li><strong>Formatos:</strong> tres fechas distintas se llevan a un solo formato (AAAA-MM-DD) y se validan (el 30 de febrero no existe).</li>
        <li><strong>Claves:</strong> las regiones «N», «NORTE» y «Norte» se reducen a un catálogo común; un valor fuera del catálogo se rechaza.</li>
        <li><strong>Unidades:</strong> si el ERP informa en miles, \( \text{monto}_{\text{pesos}} = 1000 \times \text{monto}_{\text{miles}} \). Si la regla falta, el dato se carga 1 000 veces menor y nadie lo ve.</li>
        <li><strong>Calidad:</strong> montos nulos o negativos, claves repetidas. Las reglas de calidad conectan con la <a href="tema.html?id=information-quality">calidad de la información</a>.</li>
      </ul>
      <h2>Rechazo y auditoría</h2>
      <p>Los registros inválidos no se descartan en silencio: pasan a una tabla de rechazos con el motivo, para corregirlos en el origen. La <strong>conciliación</strong> comprueba que nada se perdió:</p>
      \[ N_{\text{extraídas}} = N_{\text{cargadas}} + N_{\text{rechazadas}}, \qquad \sum_{\text{fuente}} \text{monto} = \sum_{\text{cargado}} \text{monto} + \sum_{\text{rechazado}} \text{monto}. \]
      <p>Si la fracción rechazada \(N_{\text{rechazadas}}/N_{\text{extraídas}}\) supera una tolerancia, la carga se detiene: un cambio de formato en una fuente suele ser la causa.</p>
      <h2>Carga completa e incremental</h2>
      <p>Con \(T\) filas totales, \(n\) nuevas por noche y una fracción \(p\) de filas antiguas modificadas, la carga completa procesa \(T\) filas y la incremental solo \(n + pT\). Si \(v\) es la velocidad de carga y \(W\) la ventana nocturna,</p>
      \[ t_{\text{completa}} = \frac{T_d}{v}, \qquad T_d = T_0 + d\,n, \qquad \text{falla cuando } T_d > v\,W. \]
      <p>Ejemplo: con \(T_0 = 5\,000\,000\), \(n = 400\,000\), \(v = 2\,000\) filas/s y \(W = 2\) h, la capacidad es \(14{,}4\) millones de filas y se rebasa en la noche \(\lceil (14{,}4 - 5)/0{,}4 \rceil = 24\), mientras la incremental
      tarda menos de 5 minutos. La incremental, en cambio, depende de una marca de cambio (fecha de modificación) y <em>no ve los borrados</em>: requiere marcar los borrados lógicamente o una recarga completa periódica.</p>
      <h2>Conexiones</h2>
      <p>El ETL alimenta el <a href="tema.html?id=data-warehouse-marts">almacén de datos</a> y forma parte de la arquitectura de <a href="tema.html?id=bi-dss">inteligencia de negocios</a>; la integración entre sistemas se amplía en
      <a href="tema.html?id=legacy-integration">sistemas heredados e integración</a>.</p>`,
  });
})();
