(function () {
  'use strict';
  const { color: C } = VIZ;
  const num = (v) => VIZ.fmt(v);
  const EPS = 1e-9;

  /* ---------- Datos: orígenes, destinos y costos (con fila o columna ficticia si no hay equilibrio) ---------- */

  // modo: 'igual' (oferta = demanda), 'sobra' (oferta > demanda: destino ficticio) o 'falta' (demanda > oferta: origen ficticio).
  function crearDatos(semilla, modo) {
    const rnd = VIZ.semilla(semilla * 6271 + 11);
    const m = 3, n = 4;
    const s = Array.from({ length: m }, () => 15 + 5 * Math.floor(rnd() * 5));
    const T = s.reduce((a, b) => a + b, 0), extra = 10 + 5 * Math.floor(rnd() * 3);
    const Td = modo === 'sobra' ? T - extra : modo === 'falta' ? T + extra : T;
    const w = Array.from({ length: n }, () => 1 + Math.floor(rnd() * 4)), W = w.reduce((a, b) => a + b, 0);
    const d = w.map((q) => Math.floor((Td * q) / W));
    d[n - 1] += Td - d.reduce((a, b) => a + b, 0);
    const costos = Array.from({ length: m }, () => Array.from({ length: n }, () => 2 + Math.floor(rnd() * 11)));
    const filas = s.map((_, i) => `O${i + 1}`), cols = d.map((_, j) => `D${j + 1}`);
    if (modo === 'sobra') { d.push(T - Td); cols.push('ficticio'); costos.forEach((f) => f.push(0)); }
    if (modo === 'falta') { s.push(Td - T); filas.push('ficticio'); costos.push(Array(d.length).fill(0)); }
    return { costos, s, d, filas, cols, modo };
  }
  // Costo mínimo con la biblioteca (red bipartita con origen y sumidero): sirve para verificar el método.
  function optimo(P) {
    const m = P.s.length, n = P.d.length, arcos = [];
    P.s.forEach((v, i) => arcos.push({ de: m + n, a: i, cap: v, costo: 0 }));
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) arcos.push({ de: i, a: m + j, cap: 1e9, costo: P.costos[i][j] });
    P.d.forEach((v, j) => arcos.push({ de: m + j, a: m + n + 1, cap: v, costo: 0 }));
    const total = P.s.reduce((a, b) => a + b, 0);
    const r = VIZ.opt.flujoCostoMinimo(m + n + 2, arcos, m + n, m + n + 1, total);
    const x = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => Math.round(r.flujo[m + i * n + j])));
    return { costo: r.costo, x };
  }
  const costoPlan = (P, x) => x.reduce((q, f, i) => q + f.reduce((r, v, j) => r + (v || 0) * P.costos[i][j], 0), 0);

  // Solución inicial: devuelve un generador de asignaciones [i, j, cantidad]; siempre m + n − 1 celdas básicas.
  function* inicial(P, metodo) {
    const m = P.s.length, n = P.d.length, sr = P.s.slice(), dr = P.d.slice();
    if (metodo === 'noroeste') {
      let i = 0, j = 0;
      while (i < m && j < n) {
        const q = Math.min(sr[i], dr[j]);
        sr[i] -= q; dr[j] -= q;
        yield [i, j, q];
        if (sr[i] === 0 && i < m - 1) i++; else j++;
      }
    } else {
      const filas = new Set(sr.map((_, i) => i)), cols = new Set(dr.map((_, j) => j));
      while (filas.size && cols.size) {
        let mi = -1, mj = -1, mc = Infinity;
        for (const i of filas) for (const j of cols) if (P.costos[i][j] < mc) { mc = P.costos[i][j]; mi = i; mj = j; }
        const q = Math.min(sr[mi], dr[mj]);
        sr[mi] -= q; dr[mj] -= q;
        yield [mi, mj, q];
        if (sr[mi] === 0 && filas.size > 1) filas.delete(mi);
        else if (dr[mj] === 0 && cols.size > 1) cols.delete(mj);
        else { filas.delete(mi); cols.delete(mj); }
      }
    }
  }
  // Potenciales u, v con u₀ = 0 a partir de las celdas básicas (x no nulo en la matriz de bases).
  function potenciales(P, x) {
    const m = P.s.length, n = P.d.length, u = Array(m).fill(null), v = Array(n).fill(null);
    u[0] = 0;
    for (let k = 0; k < m + n; k++) {
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
        if (x[i][j] === null) continue;
        if (u[i] !== null && v[j] === null) v[j] = P.costos[i][j] - u[i];
        else if (v[j] !== null && u[i] === null) u[i] = P.costos[i][j] - v[j];
      }
    }
    return { u, v };
  }
  // Ciclo de la celda entrante: camino en el árbol de básicas de la fila i a la columna j, con signos alternados.
  function cicloDe(P, x, ei, ej) {
    const m = P.s.length, n = P.d.length, prev = new Map([[ei, null]]), cola = [ei];
    while (cola.length && !prev.has(m + ej)) {
      const a = cola.shift();
      if (a < m) { for (let j = 0; j < n; j++) if (x[a][j] !== null && !prev.has(m + j)) { prev.set(m + j, [a, j, a]); cola.push(m + j); } }
      else { for (let i = 0; i < m; i++) if (x[i][a - m] !== null && !prev.has(i)) { prev.set(i, [i, a - m, a]); cola.push(i); } }
    }
    const camino = [];
    for (let nodo = m + ej; prev.get(nodo); nodo = prev.get(nodo)[2]) camino.unshift(prev.get(nodo));
    const L = camino.length;
    return [{ i: ei, j: ej, sg: 1 }, ...camino.map(([i, j], k) => ({ i, j, sg: (L - 1 - k) % 2 === 0 ? -1 : 1 })).reverse()];
  }

  /* ---------- Tabla de transporte ---------- */

  // estado de celda: { fondo, borde }; mostrar: función (i, j) → [texto principal, color]
  function pintarTabla(caja, P, x, est, extras) {
    const m = P.s.length, n = P.d.length;
    const pot = !extras.sinPot;
    const cab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'origen \\ destino'), pot ? VIZ.el('th', null, 'u') : null,
      P.cols.map((c, j) => VIZ.el('th', null, `${c} (${P.d[j]})`)));
    const vs = pot ? VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'v'), VIZ.el('td'),
      P.cols.map((_, j) => VIZ.el('td', null, est.v && est.v[j] !== null ? String(num(est.v[j])) : '·'))) : null;
    const filas = P.filas.map((f, i) => VIZ.el('tr', null,
      VIZ.el('td', { class: 'izq' }, `${f} (${P.s[i]})`),
      pot ? VIZ.el('td', null, est.u && est.u[i] !== null ? String(num(est.u[i])) : '·') : null,
      P.cols.map((_, j) => {
        const e = extras.celda(i, j);
        const principal = x[i][j] !== null ? VIZ.el('span', { style: { fontWeight: '600' } }, String(x[i][j])) : est.red ? VIZ.el('span', { style: { color: est.red[i][j] < -EPS ? C.s8 : C.tinta2 } }, `d=${num(est.red[i][j])}`) : VIZ.el('span', { style: { color: C.apagado } }, '·');
        return VIZ.el('td', { style: { background: e.fondo || null, border: e.borde || null } },
          VIZ.el('span', { style: { color: C.apagado, fontSize: '11px', marginRight: '6px' } }, num(P.costos[i][j])), principal, e.signo ? VIZ.el('span', { style: { color: e.signoColor, marginRight: '2px' } }, ` ${e.signo}`) : null);
      })));
    caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, cab), VIZ.el('tbody', null, vs, filas)));
  }

  /* ---------- Fig. 1: solución inicial y mejora (MODI) ---------- */

  function montarMejora(cuerpo) {
    let semilla = 1, modo = 'igual', metodo = 'noroeste', P = crearDatos(semilla, modo), est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Solución inicial', opciones: [['noroeste', 'esquina noroeste'], ['minimo', 'costo mínimo']], valor: metodo, alCambiar: (v) => { metodo = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Oferta frente a demanda', opciones: [['igual', 'iguales'], ['sobra', 'sobra oferta (destino ficticio)'], ['falta', 'falta oferta (origen ficticio)']], valor: modo, alCambiar: (v) => { modo = v; P = crearDatos(semilla, modo); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; P = crearDatos(semilla, modo); rep.reiniciar(); });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s4, 0.3), texto: 'celda recién asignada' }, { color: VIZ.alfa(C.s2, 0.3), texto: 'celda entrante (costo reducido más negativo)' },
      { color: VIZ.alfa(C.s6, 0.25), texto: 'ciclo: se suma θ' }, { color: VIZ.alfa(C.s8, 0.25), texto: 'ciclo: se resta θ' }, { color: C.s7, texto: 'celda que sale', borde: C.s7 },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En cada celda: costo unitario (gris) y cantidad enviada (negrita). Las celdas vacías muestran su costo reducido d = c − u − v. Si alguna es negativa, enviar por ella abarata el plan; el ciclo indica qué celdas se compensan.');

    function iniciar() {
      const m = P.s.length, n = P.d.length, ref = optimo(P);
      est = { x: Array.from({ length: m }, () => Array(n).fill(null)), u: null, v: null, red: null, nueva: null, entra: null, ciclo: null, sale: null, theta: null, it: 0, fase: 'asigna', msg: `Se parte de la tabla vacía (${m} orígenes, ${n} destinos). Se asignarán ${m + n - 1} celdas básicas con ${metodo === 'noroeste' ? 'la esquina noroeste' : 'el costo mínimo'}.`, ref, fin: false, nBas: 0 };
      return (function* () {
        for (const [i, j, q] of inicial(P, metodo)) {
          est.x[i][j] = q; est.nueva = [i, j]; est.nBas++;
          est.msg = `${P.filas[i]} → ${P.cols[j]}: se envían ${q} (costo unitario ${P.costos[i][j]}).` + (q === 0 ? ' Cantidad cero: celda básica degenerada para completar el árbol.' : '');
          yield;
        }
        est.nueva = null;
        for (let k = 0; k < 40; k++) {
          const { u, v } = potenciales(P, est.x);
          est.u = u; est.v = v;
          est.red = P.costos.map((f, i) => f.map((c, j) => c - u[i] - v[j]));
          let mn = -EPS, ei = -1, ej = -1;
          est.red.forEach((f, i) => f.forEach((d, j) => { if (est.x[i][j] === null && d < mn) { mn = d; ei = i; ej = j; } }));
          est.ciclo = null; est.sale = null; est.theta = null; est.entra = null;
          if (ei < 0) {
            est.fin = true; est.msg = `Todos los costos reducidos son ≥ 0: el plan es óptimo, con costo ${num(costoPlan(P, est.x))}.`;
            yield; return;
          }
          est.entra = [ei, ej];
          est.msg = `Iteración ${est.it + 1}: potenciales con u₁ = 0. La celda ${P.filas[ei]} → ${P.cols[ej]} tiene costo reducido ${num(mn)} < 0: entra a la base.`;
          yield;
          const ciclo = cicloDe(P, est.x, ei, ej);
          const neg = ciclo.filter((c) => c.sg < 0);
          const theta = Math.min(...neg.map((c) => est.x[c.i][c.j]));
          const sale = neg.find((c) => est.x[c.i][c.j] === theta);
          est.ciclo = ciclo; est.theta = theta; est.sale = [sale.i, sale.j];
          est.msg = `Ciclo de ${ciclo.length} celdas: θ = ${theta} (mínimo de las celdas con signo −); sale ${P.filas[sale.i]} → ${P.cols[sale.j]}. El costo baja ${num(-mn * theta)}.`;
          yield;
          ciclo.forEach((c) => { est.x[c.i][c.j] = (est.x[c.i][c.j] || 0) + c.sg * theta; });
          est.x[sale.i][sale.j] = null;
          est.it++;
          est.msg = `Se envía θ = ${theta} por el ciclo; nuevo costo ${num(costoPlan(P, est.x))}.`;
        }
        est.msg = 'Se alcanzó el límite de iteraciones.';
        yield;
      })();
    }
    function dibujar() {
      if (!est) return;
      const entra = est.entra, sale = est.sale, nueva = est.nueva, ciclo = est.ciclo;
      pintarTabla(caja, P, est.x, est, {
        celda: (i, j) => {
          if (sale && sale[0] === i && sale[1] === j) return { fondo: VIZ.alfa(C.s8, 0.25), borde: `2px solid ${C.s7}`, signo: '−', signoColor: C.s8 };
          const c = ciclo && ciclo.find((q) => q.i === i && q.j === j);
          if (c) return { fondo: VIZ.alfa(c.sg > 0 ? C.s6 : C.s8, 0.25), signo: c.sg > 0 ? '+' : '−', signoColor: c.sg > 0 ? C.s6 : C.s8 };
          if (entra && entra[0] === i && entra[1] === j) return { fondo: VIZ.alfa(C.s2, 0.3) };
          if (nueva && nueva[0] === i && nueva[1] === j) return { fondo: VIZ.alfa(C.s4, 0.3) };
          return {};
        },
      });
      registro.textContent = est.msg;
      const costo = costoPlan(P, est.x);
      const basicas = est.x.flat().filter((v) => v !== null).length;
      const dmin = est.red ? Math.min(...est.red.flat().filter((_, k) => est.x[Math.floor(k / P.d.length)][k % P.d.length] === null)) : null;
      lectura.set([
        ['costo del plan', num(costo)], ['costo óptimo (VIZ.opt)', num(est.ref.costo)],
        ['celdas básicas', `${basicas} de ${P.s.length + P.d.length - 1}`], ['iteraciones de mejora', String(est.it)],
        ['menor costo reducido', dmin === null || !Number.isFinite(dmin) ? '—' : num(dmin)],
        ['estado', est.fin ? (Math.abs(costo - est.ref.costo) < 1e-6 ? 'óptimo ✓' : 'revisar') : 'en curso'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: pruebe sus propios envíos ---------- */

  function montarPlan(cuerpo) {
    let semilla = 3, P = crearDatos(semilla, 'igual'), x = null, ref = null, accion = 5, verOpt = true, geo = null;
    const reinicio = () => { x = P.s.map(() => P.d.map(() => 0)); ref = optimo(P); };
    reinicio();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Un clic en un arco o celda', opciones: [['5', 'suma 5 unidades'], ['1', 'suma 1 unidad'], ['-1', 'resta 1 unidad']], valor: '5', alCambiar: (v) => { accion = +v; } });
    ctl.casilla({ etiqueta: 'Mostrar la solución óptima', valor: verOpt, alCambiar: (v) => { verOpt = v; dibujar(); } });
    ctl.boton('Esquina noroeste', () => { x = P.s.map(() => P.d.map(() => 0)); for (const [i, j, q] of inicial(P, 'noroeste')) x[i][j] = q; dibujar(); }, { primario: true });
    ctl.boton('Costo mínimo', () => { x = P.s.map(() => P.d.map(() => 0)); for (const [i, j, q] of inicial(P, 'minimo')) x[i][j] = q; dibujar(); });
    ctl.boton('Poner el óptimo', () => { x = ref.x.map((f) => f.slice()); dibujar(); });
    ctl.boton('Vaciar', () => { x = P.s.map(() => P.d.map(() => 0)); dibujar(); });
    ctl.boton('Nuevos datos', () => { semilla++; P = crearDatos(semilla, 'igual'); reinicio(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'envío del plan (grosor = cantidad)', forma: 'linea' }, { color: C.s6, texto: 'envío de la solución óptima (discontinuo)', forma: 'linea' },
      { color: C.s6, texto: 'nodo cubierto exactamente' }, { color: C.s8, texto: 'nodo excedido' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un arco del grafo o en una celda de la tabla para cambiar su envío (el selector decide cuánto). El grosor de cada arco es la cantidad enviada. El plan es óptimo cuando es factible y su costo iguala al mínimo.');

    const m = () => P.s.length, n = () => P.d.length;
    const usoF = (i) => x[i].reduce((a, b) => a + b, 0), usoC = (j) => x.reduce((a, f) => a + f[j], 0);
    const cambiar = (i, j) => { x[i][j] = Math.max(0, x[i][j] + accion); dibujar(); };
    function pos() {
      const W = lienzo.ancho, H = lienzo.alto, xo = Math.min(60, W * 0.12), xd = W - xo;
      return {
        o: P.s.map((_, i) => ({ x: xo, y: 30 + ((i + 0.5) / m()) * (H - 50) })),
        d: P.d.map((_, j) => ({ x: xd, y: 30 + ((j + 0.5) / n()) * (H - 50) })),
      };
    }
    function dibujar() {
      lienzo.limpiar();
      const { ctx } = lienzo, g = pos(), r = 15;
      geo = g;
      for (let i = 0; i < m(); i++) for (let j = 0; j < n(); j++) {
        if (verOpt && ref.x[i][j] > 0) {
          ctx.save(); ctx.strokeStyle = C.s6; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(g.o[i].x, g.o[i].y); ctx.lineTo(g.d[j].x, g.d[j].y); ctx.stroke(); ctx.restore();
        }
      }
      for (let i = 0; i < m(); i++) for (let j = 0; j < n(); j++) {
        if (x[i][j] <= 0) continue;
        ctx.save(); ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5 + (6 * x[i][j]) / Math.max(...P.s); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(g.o[i].x, g.o[i].y); ctx.lineTo(g.d[j].x, g.d[j].y); ctx.stroke(); ctx.restore();
        const mx = g.o[i].x + 0.5 * (g.d[j].x - g.o[i].x), my = g.o[i].y + 0.5 * (g.d[j].y - g.o[i].y), t = String(x[i][j]);
        ctx.font = VIZ.fuente(11, 600); const w = ctx.measureText(t).width + 8;
        ctx.fillStyle = C.superficie; ctx.fillRect(mx - w / 2, my - 8, w, 16);
        ctx.fillStyle = C.s1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, mx, my + 0.5);
      }
      const nodo = (p, etiqueta, uso, cap) => {
        const ok = uso === cap, mal = uso > cap;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = ok ? C.s6 : mal ? C.s8 : C.superficie; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = ok ? C.s6 : mal ? C.s8 : C.tinta; ctx.stroke();
        ctx.fillStyle = ok || mal ? C.sobre : C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(etiqueta, p.x, p.y + 0.5);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'bottom';
        ctx.fillText(`${uso}/${cap}`, p.x, p.y - r - 3);
      };
      P.s.forEach((c, i) => nodo(g.o[i], `O${i + 1}`, usoF(i), c));
      P.d.forEach((c, j) => nodo(g.d[j], `D${j + 1}`, usoC(j), c));
      pintarTabla(caja, P, x, {}, { sinPot: true, celda: (i, j) => (x[i][j] > 0 ? { fondo: VIZ.alfa(C.s1, 0.12) } : {}) });
      caja.querySelectorAll('tbody tr td:nth-child(n+2)').forEach((td, k) => {
        td.classList.add('celda-clic');
        td.onclick = () => cambiar(Math.floor(k / n()), k % n());
      });
      const costo = costoPlan(P, x);
      const factible = P.s.every((c, i) => usoF(i) === c) && P.d.every((c, j) => usoC(j) === c);
      const gap = costo - ref.costo;
      registro.textContent = factible
        ? (Math.abs(gap) < 1e-9 ? `Plan factible de costo ${num(costo)}: coincide con el mínimo, es óptimo.` : `Plan factible de costo ${num(costo)}, ${num(gap)} por encima del mínimo ${num(ref.costo)}. Hay un ciclo de envíos que lo abarata.`)
        : `El plan aún no cubre exactamente cada oferta y demanda (nodos verdes = cubiertos, rojos = excedidos).`;
      lectura.set([
        ['costo de su plan', num(costo)], ['costo óptimo', num(ref.costo)],
        ['brecha', factible ? num(gap) : '—'],
        ['enviado / total', `${x.flat().reduce((a, b) => a + b, 0)} / ${P.s.reduce((a, b) => a + b, 0)}`],
        ['factible', factible ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const arcoEn = (px, py) => {
      let mejor = null, dm = 9;
      for (let i = 0; i < m(); i++) for (let j = 0; j < n(); j++) {
        const a = geo.o[i], b = geo.d[j], dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0.1, Math.min(0.9, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
        const d = Math.hypot(px - a.x - t * dx, py - a.y - t * dy);
        if (d < dm) { dm = d; mejor = [i, j]; }
      }
      return mejor;
    };
    lienzo.canvas.addEventListener('click', (ev) => { const { x: px, y: py } = lienzo.posicion(ev), a = arcoEn(px, py); if (a) cambiar(a[0], a[1]); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: px, y: py } = lienzo.posicion(ev), a = arcoEn(px, py);
      if (!a) return tip.ocultar();
      const [i, j] = a;
      tip.mostrar(px, py, `${P.filas[i]} → ${P.cols[j]}<br>costo unitario <b>${P.costos[i][j]}</b><br>su envío <b>${x[i][j]}</b> (óptimo <b>${ref.x[i][j]}</b>)`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('transportation-problem', {
    intro: String.raw`
      <p>El <strong>problema de transporte</strong> reparte una mercancía desde varios orígenes con oferta limitada hacia varios destinos con demanda conocida, sabiendo cuánto cuesta enviar una unidad por cada ruta.
      El objetivo es cubrir toda la demanda sin exceder ninguna oferta al menor costo total. Es el ejemplo clásico de programa lineal con estructura de red: un grafo bipartito donde cada origen se conecta con cada destino.</p>
      <p>Se resuelve sin tableau completo: se construye una solución inicial barata (esquina noroeste o costo mínimo) y se mejora con potenciales, que indican si alguna ruta sin uso convendría. Si la oferta total no iguala a la demanda total, se agrega un origen o destino ficticio de costo cero para equilibrar.</p>`,
    visualizaciones: [
      {
        titulo: 'Solución inicial y mejora paso a paso',
        descripcion: 'Elija esquina noroeste o costo mínimo y avance: primero se asignan las celdas básicas y luego, mientras haya costos reducidos negativos, una celda entra y se compensa a lo largo de un ciclo. Compare el costo inicial con el final, y pruebe el caso con destino ficticio.',
        montar: montarMejora,
      },
      {
        titulo: 'Pruebe sus propios envíos',
        descripcion: 'Distribuya las unidades haciendo clic en arcos o celdas hasta cubrir cada oferta y demanda. Compare con la solución óptima (discontinua verde) y vea la brecha de costo.',
        montar: montarPlan,
      },
    ],
    teoria: String.raw`
      <h2>Formulación</h2>
      <p>Con \(m\) orígenes de oferta \(s_i\), \(n\) destinos de demanda \(d_j\) y costo unitario \(c_{ij}\), sea \(x_{ij}\) la cantidad enviada de \(i\) a \(j\):</p>
      \[ \min \sum_{i=1}^{m}\sum_{j=1}^{n} c_{ij}x_{ij} \quad \text{s.a.} \quad \sum_{j} x_{ij} = s_i\;\;(\forall i), \qquad \sum_{i} x_{ij} = d_j\;\;(\forall j), \qquad x_{ij} \ge 0. \]
      <p>Es un <a href="tema.html?id=min-cost-flow">flujo de costo mínimo</a> en la red bipartita con arcos \(i \to j\) sin capacidad. Por la unimodularidad de la matriz de incidencia (<a href="tema.html?id=network-flow-model">modelo de flujo</a>), si \(s\) y \(d\) son enteros, todo vértice óptimo es entero.</p>
      <h2>Equilibrio de oferta y demanda</h2>
      <p>La suma de las restricciones de origen y la de destino coinciden solo si \(\sum s_i = \sum d_j\). Si sobra oferta se agrega un <strong>destino ficticio</strong> con demanda \(\sum s_i - \sum d_j\) y costos 0 (lo que «se envía» a él se queda en el origen); si falta oferta, un <strong>origen ficticio</strong> con la oferta faltante y costos 0 (lo que recibe de él es demanda no atendida). Con costos de penalización distintos de 0 se modela el costo de no atender o de almacenar.</p>
      <h2>Estructura de la base</h2>
      <p>El sistema tiene \(m+n\) ecuaciones, pero una es redundante, así que el rango es \(m+n-1\). Una solución básica tiene a lo más \(m+n-1\) celdas positivas, y sus celdas básicas forman un <strong>árbol generador</strong> del grafo bipartito: sin ciclos. Si una celda básica vale 0 la solución es degenerada (ver <a href="tema.html?id=degeneracy-cycling">degeneración</a>).</p>
      <h2>Solución inicial</h2>
      <ul>
        <li><strong>Esquina noroeste:</strong> comienza en la celda superior izquierda, envía lo máximo posible y avanza a la fila o columna siguiente. Es inmediata pero ignora los costos.</li>
        <li><strong>Costo mínimo:</strong> asigna lo máximo en la celda más barata disponible y repite. Suele comenzar más cerca del óptimo.</li>
      </ul>
      <p>Ambos producen \(m+n-1\) celdas básicas (incluidos ceros si hay empates) y una solución básica factible.</p>
      <h2>Mejora: potenciales (MODI)</h2>
      <pre><code>repetir:
    resolver  u[i] + v[j] = c[i][j]  para las celdas básicas, con u[1] = 0
    para cada celda no básica: d[i][j] ← c[i][j] − u[i] − v[j]
    si todos d[i][j] ≥ 0: devolver x      (óptimo)
    elegir la celda (p, q) con d más negativo; hallar su ciclo en el árbol básico
    asignar signos + − + − … comenzando con + en (p, q)
    θ ← mínimo de x en las celdas con signo −
    sumar θ en las celdas +, restar θ en las −; la celda − que llega a 0 sale</code></pre>
      <p>Los \(u_i, v_j\) son las variables del <a href="tema.html?id=dual-construction">problema dual</a> y \(d_{ij}\) el costo reducido de \(x_{ij}\); enviar una unidad por la celda entrante y compensar a lo largo del ciclo cambia el costo en exactamente \(d_{pq}\). Si todos son no negativos, la condición de <a href="tema.html?id=complementary-slackness">holgura complementaria</a> se cumple y \(x\) es óptimo: es el
      <a href="tema.html?id=optimality-certificates">certificado de optimalidad</a>.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con dos orígenes (\(s = 30, 20\)), dos destinos (\(d = 25, 25\)) y costos \(c = \begin{pmatrix}4 & 6\\ 5 & 3\end{pmatrix}\), la esquina noroeste da \(x_{11} = 25,\ x_{12} = 5,\ x_{22} = 20\) con costo \(100+30+60 = 190\). Los potenciales con \(u_1 = 0\) son \(v_1 = 4,\ v_2 = 6,\ u_2 = -3\). La celda vacía \((2,1)\) tiene \(d_{21} = 5 - (-3) - 4 = 4 \ge 0\): no conviene. Es óptimo. Si en cambio \(c_{21} = 0\), entonces \(d_{21} = 0 + 3 - 4 = -1 &lt; 0\) y entra; el ciclo (2,1)+, (1,1)−, (1,2)+, (2,2)− tiene \(\theta = \min(25, 20) = 20\) y el costo baja 20.</p>
      <h2>Costo y conexiones</h2>
      <p>Con \(m + n\) nodos y \(mn\) arcos, cada iteración cuesta \(O(mn)\). El problema de asignación (cada origen a un solo destino, como en la <a href="tema.html?id=shift-assignment">asignación de turnos</a>) es un transporte con \(s_i = d_j = 1\). Para variantes con capacidad en las rutas se usa el modelo general de flujo de costo mínimo, y para decisiones sí/no, los <a href="tema.html?id=problem-classes">problemas enteros</a>.</p>`,
  });
})();
