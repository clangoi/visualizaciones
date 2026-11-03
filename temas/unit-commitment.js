(function () {
  'use strict';
  const { color: C } = VIZ;
  const H = 12;
  // Generadores: mínimo y máximo técnico (MW), costo variable ($/MWh), costo fijo por hora encendido ($/h) y de arranque ($).
  const U = [
    { nombre: 'Carbón', pmin: 40, pmax: 100, c: 12, fijo: 900, arranque: 2500 },
    { nombre: 'Ciclo combinado', pmin: 30, pmax: 80, c: 18, fijo: 200, arranque: 600 },
    { nombre: 'Turbina a gas', pmin: 10, pmax: 50, c: 30, fijo: 60, arranque: 150 },
    { nombre: 'Diésel', pmin: 5, pmax: 30, c: 50, fijo: 10, arranque: 30 },
  ];
  const NU = U.length, COL = [C.s1, C.s2, C.s3, C.s4];
  const PERFIL = [70, 62, 58, 64, 90, 125, 155, 168, 150, 122, 100, 84];
  const bits = (m) => U.map((_, i) => !!(m >> i & 1));
  const texto = (m) => U.map((_, i) => (m >> i & 1 ? '1' : '0')).join('');

  function demandas(semilla, escala) {
    const rnd = VIZ.semilla(semilla * 31 + 11);
    return PERFIL.map((v) => Math.round(v * escala * (semilla ? 0.92 + rnd() * 0.16 : 1)));
  }
  // Despacho económico de un conjunto encendido: mínimos técnicos y el resto por orden de mérito.
  function despacho(mask, D, res, contarFijo = true) {
    let pmin = 0, pmax = 0;
    U.forEach((u, i) => { if (mask >> i & 1) { pmin += u.pmin; pmax += u.pmax; } });
    if (D < pmin - 1e-9) return { ok: false, motivo: `la demanda (${D}) queda bajo la suma de mínimos técnicos (${pmin})` };
    if (D > pmax + 1e-9) return { ok: false, motivo: `la capacidad encendida (${pmax}) no alcanza la demanda (${D})` };
    if (pmax < D * (1 + res) - 1e-9) return { ok: false, motivo: `falta reserva: ${pmax} MW encendidos < ${VIZ.fmt(D * (1 + res), 4)} requeridos` };
    const p = U.map((u, i) => (mask >> i & 1 ? u.pmin : 0));
    let resto = D - pmin;
    U.map((u, i) => i).filter((i) => mask >> i & 1).sort((a, b) => U[a].c - U[b].c).forEach((i) => {
      const x = Math.min(resto, U[i].pmax - U[i].pmin); p[i] += x; resto -= x;
    });
    const variable = p.reduce((s, v, i) => s + v * U[i].c, 0);
    const fijo = contarFijo ? U.reduce((s, u, i) => s + (mask >> i & 1 ? u.fijo : 0), 0) : 0;
    return { ok: true, p, variable, fijo, cost: variable + fijo, pmax };
  }
  const arranques = (prev, mask) => U.reduce((s, u, i) => s + (!(prev >> i & 1) && (mask >> i & 1) ? u.arranque : 0), 0);

  // Costo de un calendario (un conjunto encendido por hora). Parte con todo apagado.
  function evaluar(masks, dem, res) {
    let variable = 0, fijo = 0, arr = 0, infact = 0, prev = 0;
    const horas = masks.map((m, t) => {
      const q = despacho(m, dem[t], res);
      if (q.ok) { variable += q.variable; fijo += q.fijo; } else infact++;
      const a = arranques(prev, m); arr += a; prev = m;
      return q;
    });
    return { horas, variable, fijo, arr, infact, total: variable + fijo + arr };
  }
  // Programación dinámica sobre las 2⁴ combinaciones: devuelve el calendario óptimo o null si no hay uno factible.
  function optimo(dem, res) {
    const S = 1 << NU;
    let f = Array(S).fill(Infinity); f[0] = 0;
    const padre = [];
    for (let t = 0; t < H; t++) {
      const g = Array(S).fill(Infinity), pa = Array(S).fill(-1);
      for (let s = 0; s < S; s++) {
        const q = despacho(s, dem[t], res);
        if (!q.ok) continue;
        for (let r = 0; r < S; r++) {
          if (f[r] === Infinity) continue;
          const c = f[r] + q.cost + arranques(r, s);
          if (c < g[s] - 1e-9) { g[s] = c; pa[s] = r; }
        }
      }
      f = g; padre.push(pa);
    }
    let s = f.indexOf(Math.min(...f));
    if (f[s] === Infinity) return null;
    const masks = Array(H);
    for (let t = H - 1; t >= 0; t--) { masks[t] = s; s = padre[t][s]; }
    return { masks, total: f[masks[H - 1]] };
  }

  /* ---------- Fig. 1: calendario de encendido ---------- */

  function montarCalendario(cuerpo) {
    let semilla = 0, escala = 1, res = 0.1, dem = demandas(semilla, escala), masks = Array(H).fill(15), mensaje = 'Calendario inicial: el óptimo por programación dinámica. Pruebe «Encender todo».', hover = -1, pl = null, geoM = null, ev = null, opt = null;
    masks = (optimo(dem, res) || { masks }).masks.slice();
    const recalcular = () => { dem = demandas(semilla, escala); ev = evaluar(masks, dem, res); opt = optimo(dem, res); };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Escala de la demanda', min: 0.6, max: 1.4, paso: 0.05, valor: escala, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { escala = v; mensaje = ''; dibujar(); } });
    ctl.rango({ etiqueta: 'Reserva requerida', min: 0, max: 0.25, paso: 0.01, valor: res, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { res = v; mensaje = ''; dibujar(); } });
    ctl.boton('Óptimo (PD)', () => { if (!opt) { mensaje = 'No existe ningún calendario factible con esta demanda y reserva.'; return dibujar(); } masks = opt.masks.slice(); mensaje = 'Calendario óptimo por programación dinámica sobre las 16 combinaciones de cada hora.'; dibujar(); }, { primario: true });
    ctl.boton('Encender todo', () => { masks = Array(H).fill(15); mensaje = 'Todos los generadores encendidos todo el día.'; dibujar(); });
    ctl.boton('Apagar todo', () => { masks = Array(H).fill(0); mensaje = 'Todo apagado: ninguna hora cubre su demanda.'; dibujar(); });
    ctl.boton('Nueva demanda', () => { semilla++; mensaje = ''; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(250, Math.min(340, w * 0.5)) + 30 + NU * 26 + 14 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...U.map((u, i) => ({ color: COL[i], texto: `${u.nombre} (${u.pmin}–${u.pmax} MW, ${u.c} $/MWh)` })),
      { color: C.tinta, texto: 'demanda', forma: 'linea' },
      { color: C.apagado, texto: 'capacidad encendida', forma: 'linea' },
      { color: VIZ.alfa(C.s8, 0.25), texto: 'hora infactible' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un cuadro de la matriz inferior para encender o apagar un generador en esa hora. Cada hora se despacha por orden de mérito (el más barato primero) respetando los mínimos técnicos.');

    function dibujar() {
      recalcular();
      const { ctx, ancho: W, alto: Hh } = lienzo;
      lienzo.limpiar();
      const capTot = U.reduce((s, u) => s + u.pmax, 0);
      pl = VIZ.plano({ ctx, ancho: W, alto: Hh - NU * 26 - 14 }, { xmin: 0.5, xmax: H + 0.5, ymin: 0, ymax: capTot * 1.04 }, { etiquetaY: 'MW', ticksX: Array.from({ length: H }, (_, i) => i + 1), formatoX: (v) => String(v), margen: { inf: 44, sup: 20 } });
      pl.ejes();
      const bw = (pl.sx(2) - pl.sx(1)) * 0.7;
      for (let t = 0; t < H; t++) {
        const xc = pl.sx(t + 1), q = ev.horas[t];
        if (!q.ok) { ctx.fillStyle = VIZ.alfa(C.s8, 0.14); ctx.fillRect(xc - bw * 0.7, pl.y1, bw * 1.4, pl.y0 - pl.y1); }
        else if (t === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(xc - bw * 0.7, pl.y1, bw * 1.4, pl.y0 - pl.y1); }
        if (q.ok) {
          let acum = 0;
          q.p.forEach((v, i) => {
            if (v <= 0) return;
            ctx.fillStyle = COL[i]; ctx.fillRect(xc - bw / 2, pl.sy(acum + v), bw, pl.sy(acum) - pl.sy(acum + v));
            ctx.strokeStyle = C.sobre; ctx.lineWidth = 1; ctx.strokeRect(xc - bw / 2, pl.sy(acum + v), bw, pl.sy(acum) - pl.sy(acum + v));
            acum += v;
          });
        } else {
          ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', xc, pl.sy(8));
        }
      }
      const capEnc = masks.map((m) => U.reduce((s, u, i) => s + (m >> i & 1 ? u.pmax : 0), 0));
      capEnc.forEach((v, t) => VIZ.trazar(ctx, pl, [[t + 0.6, v], [t + 1.4, v]], C.apagado, 2, [4, 3]));
      VIZ.trazar(ctx, pl, dem.map((v, t) => [t + 1, v]), C.tinta, 2.5);
      dem.forEach((v, t) => VIZ.marcador(ctx, pl.sx(t + 1), pl.sy(v), C.tinta, 3.5));
      // Matriz de encendido.
      const y0 = pl.y0 + 34, lado = Math.min(24, (pl.sx(2) - pl.sx(1)) - 4);
      geoM = { y0, lado };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      U.forEach((u, i) => {
        const yy = y0 + i * 26;
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(`G${i + 1}`, pl.x0 - 8, yy + lado / 2);
        for (let t = 0; t < H; t++) {
          const on = masks[t] >> i & 1, xc = pl.sx(t + 1);
          ctx.fillStyle = on ? COL[i] : C.superficie; ctx.strokeStyle = on ? COL[i] : C.eje; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(xc - lado / 2, yy, lado, lado, 4); ctx.fill(); ctx.stroke();
        }
      });
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.font = VIZ.fuente(11);
      ctx.fillText('hora', pl.x1, Hh - 0);

      const dif = opt ? ev.total - opt.total : null;
      registro.textContent = mensaje || (ev.infact ? `${ev.infact} hora(s) infactible(s): ${ev.horas.map((q, t) => (q.ok ? null : `${t + 1} (${q.motivo})`)).filter(Boolean).slice(0, 2).join('; ')}${ev.infact > 2 ? '…' : ''}.` : 'Todas las horas son factibles.');
      lectura.set([
        ['costo total', ev.infact ? `${VIZ.entero(ev.total)} $ (sin las horas infactibles)` : `${VIZ.entero(ev.total)} $`],
        ['variable / sin carga / arranques', `${VIZ.entero(ev.variable)} / ${VIZ.entero(ev.fijo)} / ${VIZ.entero(ev.arr)}`],
        ['horas infactibles', String(ev.infact)],
        ['costo óptimo', opt ? `${VIZ.entero(opt.total)} $` : 'sin calendario factible'],
        ['sobrecosto frente al óptimo', opt && !ev.infact ? `${VIZ.entero(dif)} $ (${Math.round((100 * dif) / opt.total)} %)` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const hora = (x, y) => { if (!pl) return -1; const t = Math.round(pl.ix(x)) - 1; return t >= 0 && t < H && x >= pl.x0 && x <= pl.x1 ? t : -1; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => {
      const { x, y } = lienzo.posicion(e), t = hora(x, y);
      if (t < 0 || !geoM || y < geoM.y0 - 4) return;
      const i = Math.floor((y - geoM.y0) / 26);
      if (i < 0 || i >= NU || y - geoM.y0 - i * 26 > geoM.lado) return;
      masks[t] ^= 1 << i;
      mensaje = `${U[i].nombre} ${masks[t] >> i & 1 ? 'se enciende' : 'se apaga'} en la hora ${t + 1}.`;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), t = hora(x, y);
      if (t !== hover) { hover = t; dibujar(); }
      if (t < 0) return tip.ocultar();
      const q = ev.horas[t];
      tip.mostrar(x, y, `hora <b>${t + 1}</b><br>demanda <b>${dem[t]}</b> MW · reserva ${Math.round(res * 100)} % → <b>${VIZ.fmt(dem[t] * (1 + res), 4)}</b><br>` + (q.ok
        ? U.map((u, i) => (masks[t] >> i & 1 ? VIZ.filaTooltip(COL[i], u.nombre, `${VIZ.fmt(q.p[i], 4)} MW`) : '')).join('') + `costo de la hora <b>${VIZ.entero(q.cost)}</b> $`
        : `<b>infactible</b>: ${q.motivo}`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: las 2ⁿ combinaciones de una hora ---------- */

  function montarCombinaciones(cuerpo) {
    let D = 100, res = 0.1, contarFijo = true, sel = -1, hover = -1, filas = [], mejor = -1, pl = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Demanda de la hora', min: 0, max: 260, paso: 5, valor: D, formato: (v) => `${v} MW`, alCambiar: (v) => { D = v; sel = -1; dibujar(); } });
    ctl.rango({ etiqueta: 'Reserva requerida', min: 0, max: 0.25, paso: 0.01, valor: res, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { res = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Contar el costo fijo de estar encendido', valor: contarFijo, alCambiar: (v) => { contarFijo = v; dibujar(); } });
    ctl.boton('Ver la mejor combinación', () => { sel = -1; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(300, Math.min(400, w * 0.5)) + 40 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'combinación de menor costo' },
      { color: C.s1, texto: 'combinación factible' },
      { color: C.s8, texto: 'infactible (marca en la base)' },
      ...U.map((u, i) => ({ color: COL[i], texto: `G${i + 1} ${u.nombre}` })),
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es una combinación de generadores encendidos (dígito 1 = encendido, en el orden G1 G2 G3 G4). Haga clic en una barra para ver su despacho en la franja inferior.');

    function dibujar() {
      const { ctx, ancho: W, alto: Hh } = lienzo;
      lienzo.limpiar();
      filas = Array.from({ length: 1 << NU }, (_, m) => ({ m, q: despacho(m, D, res, contarFijo) }));
      mejor = -1;
      filas.forEach((f) => { if (f.q.ok && (mejor < 0 || f.q.cost < filas[mejor].q.cost - 1e-9)) mejor = f.m; });
      const cmax = Math.max(100, ...filas.filter((f) => f.q.ok).map((f) => f.q.cost)) * 1.1;
      pl = VIZ.plano({ ctx, ancho: W, alto: Hh - 40 }, { xmin: -0.5, xmax: 15.5, ymin: 0, ymax: cmax }, { etiquetaY: 'costo de la hora ($)', ticksX: [], margen: { inf: 40, sup: 20 }, formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      geo = pl;
      const w = (pl.sx(1) - pl.sx(0)) * 0.72;
      filas.forEach((f) => {
        const xc = pl.sx(f.m);
        ctx.save(); ctx.font = VIZ.fuente(10, f.m === (sel >= 0 ? sel : mejor) ? 600 : 400); ctx.fillStyle = f.m === (sel >= 0 ? sel : mejor) ? C.tinta : C.tinta2;
        ctx.translate(xc + 4, pl.y0 + 6); ctx.rotate(Math.PI / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(texto(f.m), 0, 0); ctx.restore();
        if (f.m === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(xc - w * 0.65, pl.y1, w * 1.3, pl.y0 - pl.y1); }
        if (f.q.ok) {
          ctx.fillStyle = f.m === mejor ? C.s6 : C.s1;
          ctx.beginPath(); ctx.roundRect(xc - w / 2, pl.sy(f.q.cost), w, pl.y0 - pl.sy(f.q.cost), [4, 4, 0, 0]); ctx.fill();
        } else {
          ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xc - 4, pl.y0 - 10); ctx.lineTo(xc + 4, pl.y0 - 2); ctx.moveTo(xc + 4, pl.y0 - 10); ctx.lineTo(xc - 4, pl.y0 - 2); ctx.stroke();
        }
        if (f.m === sel) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(xc - w / 2 - 2, pl.y1, w + 4, pl.y0 - pl.y1); }
      });
      // Franja de despacho de la combinación mostrada.
      const m = sel >= 0 ? sel : mejor, q = m >= 0 ? filas[m].q : null, yb = Hh - 28, hb = 22, capTot = U.reduce((s, u) => s + u.pmax, 0), sx = (v) => pl.x0 + (v / capTot) * (pl.x1 - pl.x0);
      ctx.fillStyle = C.neutro; ctx.fillRect(pl.x0, yb, pl.x1 - pl.x0, hb);
      if (q && q.ok) {
        let acum = 0;
        q.p.forEach((v, i) => { if (v > 0) { ctx.fillStyle = COL[i]; ctx.fillRect(sx(acum), yb, sx(acum + v) - sx(acum), hb); ctx.strokeStyle = C.sobre; ctx.lineWidth = 1; ctx.strokeRect(sx(acum), yb, sx(acum + v) - sx(acum), hb); acum += v; } });
      }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(D), yb - 4); ctx.lineTo(sx(D), yb + hb + 4); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(m >= 0 ? `despacho de ${texto(m)}` : 'despacho', pl.x0 - 6, yb + hb / 2);
      ctx.textAlign = sx(D) > pl.x1 - 60 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`D = ${D}`, sx(D) + (sx(D) > pl.x1 - 60 ? -5 : 5), yb - 2);

      const nOk = filas.filter((f) => f.q.ok).length;
      registro.textContent = m < 0 ? `Ninguna de las 16 combinaciones cubre ${D} MW con ${Math.round(res * 100)} % de reserva.`
        : q.ok ? `${sel >= 0 ? 'Combinación elegida' : 'Mejor combinación'} ${texto(m)}: despacho ${q.p.map((v, i) => (v ? `G${i + 1}=${VIZ.fmt(v, 4)}` : '')).filter(Boolean).join(', ')}; costo ${VIZ.entero(q.cost)} $/h.` : `La combinación ${texto(m)} es infactible: ${q.motivo}.`;
      lectura.set([
        ['demanda con reserva', `${VIZ.fmt(D * (1 + res), 4)} MW`],
        ['combinaciones factibles', `${nOk} / ${1 << NU}`],
        ['mejor combinación', mejor >= 0 ? `${texto(mejor)} · ${VIZ.entero(filas[mejor].q.cost)} $/h` : 'ninguna'],
        ['costo variable / fijo de la mostrada', q && q.ok ? `${VIZ.entero(q.variable)} / ${VIZ.entero(q.fijo)} $` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const barra = (x, y) => { if (!pl) return -1; const m = Math.round(pl.ix(x)); return m >= 0 && m < 16 && x >= pl.x0 - 4 && x <= pl.x1 + 4 && y >= pl.y1 && y <= pl.y0 + 56 ? m : -1; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => { const { x, y } = lienzo.posicion(e), m = barra(x, y); if (m >= 0) { sel = sel === m ? -1 : m; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), m = barra(x, y);
      if (m !== hover) { hover = m; dibujar(); }
      if (m < 0) return tip.ocultar();
      const q = filas[m].q;
      tip.mostrar(x, y, `combinación <b>${texto(m)}</b><br>` + (q.ok ? `variable <b>${VIZ.entero(q.variable)}</b> $<br>fijo <b>${VIZ.entero(q.fijo)}</b> $<br>total <b>${VIZ.entero(q.cost)}</b> $/h` : `<b>infactible</b>: ${q.motivo}`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('unit-commitment', {
    intro: String.raw`
      <p>Una central eléctrica no puede acumular su producción: en cada hora debe generar justo lo que se consume. Encender un generador cuesta (arranque, combustible en vacío) y, una vez encendido,
      no puede operar por debajo de un <em>mínimo técnico</em>. Por eso la pregunta es doble: <strong>qué generadores encender cada hora</strong> y <strong>cuánto debe producir cada uno</strong>.
      La primera es una decisión binaria; la segunda, continua. A este problema se le llama <em>unit commitment</em>.</p>
      <p>El generador más barato por MWh no siempre se enciende, ni el más caro se deja siempre apagado: los costos fijos, los arranques y los mínimos técnicos hacen que la mejor combinación cambie con la demanda y entre una hora y la siguiente.</p>`,
    visualizaciones: [
      {
        titulo: 'Calendario de encendido de 12 horas',
        descripcion: 'El calendario inicial es el óptimo. Pulse «Encender todo» y vea cómo los mínimos técnicos vuelven infactibles las horas de poca demanda; luego suba la demanda o la reserva hasta que falte capacidad.',
        montar: montarCalendario,
      },
      {
        titulo: 'Las 16 combinaciones de una hora',
        descripcion: 'Mueva la demanda y observe cómo cambia la combinación más barata y cuántas son factibles. Con 100 MW, alterne el costo fijo: gana otra combinación (el carbón es barato por MWh pero caro de mantener encendido). Pruebe también 60 MW y 180 MW.',
        montar: montarCombinaciones,
      },
    ],
    teoria: String.raw`
      <h2>Modelo</h2>
      <p>Para el generador \(i\) y la hora \(t\): \(u_{it} \in \{0,1\}\) indica si está encendido, \(s_{it} \in \{0,1\}\) si arranca en \(t\) y \(p_{it} \ge 0\) es la potencia. Con costo variable \(c_i\), costo fijo \(F_i\) por hora encendido y costo de arranque \(S_i\):</p>
      \[
      \begin{aligned}
      \min\ & \sum_{t}\sum_{i} \left( c_i\, p_{it} + F_i\, u_{it} + S_i\, s_{it} \right) \\
      \text{s.a. } & \sum_i p_{it} = D_t && \text{(balance de la hora } t\text{)} \\
      & P^{\min}_i\, u_{it} \le p_{it} \le P^{\max}_i\, u_{it} && \text{(mínimo técnico y capacidad)} \\
      & \sum_i P^{\max}_i\, u_{it} \ge (1+\rho)\, D_t && \text{(reserva } \rho\text{)} \\
      & s_{it} \ge u_{it} - u_{i,t-1}, \qquad u_{it}, s_{it} \in \{0,1\}.
      \end{aligned}
      \]
      <p>La doble desigualdad \(P^{\min}_i u_{it} \le p_{it} \le P^{\max}_i u_{it}\) hace que un generador apagado produzca 0 y uno encendido produzca dentro de su rango: es la misma idea del enlace \(x \le M y\) de <a href="tema.html?id=lot-sizing">Lot Sizing</a>. Con \(u_{it}\) fijos, el resto es un LP muy simple.</p>

      <h2>Despacho económico</h2>
      <p>Una vez elegidos los generadores encendidos de una hora, el reparto óptimo se obtiene por <em>orden de mérito</em>: cada uno parte en su mínimo técnico y la demanda restante \(D - \sum P^{\min}_i\) se le asigna al más barato hasta su máximo, luego al siguiente, y así. Es la solución exacta de ese LP porque los costos son lineales. Es factible solo si
      \[ \sum_i P^{\min}_i u_i \;\le\; D \;\le\; \sum_i P^{\max}_i u_i, \qquad \sum_i P^{\max}_i u_i \ge (1+\rho) D. \]
      El mínimo técnico explica por qué apagar no siempre es posible (con poca demanda, muchos generadores encendidos sobrepasan \(D\)) y la reserva explica por qué no se puede apagar todo lo que sobra.</p>

      <h2>Programación dinámica sobre las combinaciones</h2>
      <p>Con \(n\) generadores hay \(2^n\) combinaciones por hora. Sea \(f_t(s)\) el mínimo costo de las horas \(1,\dots,t\) terminando con el conjunto encendido \(s\):</p>
      \[ f_t(s) = \text{costo}(s, D_t) + \min_{r}\Bigl\{ f_{t-1}(r) + \sum_{i \in s \setminus r} S_i \Bigr\}, \qquad f_0(\varnothing) = 0, \]
      <p>donde el costo es infinito si \(s\) no es factible en esa hora. El tiempo es \(O(T \cdot 4^n)\): trivial con 4 unidades, impracticable con 100, y por eso los sistemas reales usan <a href="tema.html?id=milp-solving-strategies">ramificación y acotamiento con planos de corte</a>.
      La figura calcula así el calendario óptimo.</p>
      <div class="recuadro"><p>Los costos de arranque acoplan las horas: lo que conviene en la hora 7 depende de si se encendió en la 6. Si los arranques fueran gratis, cada hora podría resolverse por separado (segunda figura); con ellos, un generador caro puede dejarse encendido en un valle para no pagar otro arranque.</p></div>

      <h2>Variantes</h2>
      <p>Se agregan tiempos mínimos de encendido y apagado, rampas máximas \(|p_{it} - p_{i,t-1}| \le R_i\), costos variables convexos linealizados por tramos (ver <a href="tema.html?id=piecewise-linear">funciones lineales por tramos</a>) y restricciones de red. La relajación lineal de \(u_{it}\) es débil, y lograr formulaciones más ajustadas es un tema activo de <a href="tema.html?id=valid-inequalities">desigualdades válidas</a>.</p>`,
  });
})();
