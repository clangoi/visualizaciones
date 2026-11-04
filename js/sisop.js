/* Sistemas operativos y redes (VIZ.sor): planificación de CPU (FCFS, SJF, SRTF, prioridades con envejecimiento,
   Round Robin y MLFQ) con diagrama de Gantt y métricas; reemplazo de páginas (FIFO, LRU, MIN, aleatorio, reloj);
   planificación del brazo del disco; CRC, paridad y suma de verificación; direcciones IPv4; hash y cifrado de juguete;
   y un dibujo de diagramas de secuencia para protocolos de red. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = {};
  VIZ.sor = S;

  /* ---------- Planificación de CPU ---------- */

  // procs: [{ nombre, llegada, rafaga, prio }]. opciones: { alg: 'fcfs'|'sjf'|'prio'|'rr'|'mlfq', apropiativo, q, envejecer, niveles, refuerzo }.
  // Devuelve { segs: [{ p, ini, fin }] (p = -1 es CPU ociosa), por: [{ fin, retorno, espera, respuesta }], ... }.
  S.planificar = function (procs, o = {}) {
    const n = procs.length, alg = o.alg || 'fcfs', q0 = o.q || 2, niveles = o.niveles || 3;
    const resto = procs.map((p) => p.rafaga), prio = procs.map((p) => p.prio || 0);
    const nivel = procs.map(() => 0), espera = procs.map(() => 0);
    const fin = Array(n).fill(null), prim = Array(n).fill(null);
    const segs = [];
    let listos = [], actual = -1, usado = 0, t = 0, hechos = 0, cambios = 0, ocupado = 0, ultimo = -2;
    const cuanto = (i) => (alg === 'mlfq' ? q0 * 2 ** nivel[i] : q0);
    const mejor = (i, j) => { // ¿es i estrictamente mejor que j?
      if (alg === 'sjf') return resto[i] < resto[j];
      if (alg === 'prio') return prio[i] < prio[j];
      if (alg === 'mlfq') return nivel[i] < nivel[j];
      return false;
    };
    const elegir = () => {
      let b = -1;
      for (const i of listos) if (b < 0 || mejor(i, b)) b = i;
      if (b >= 0) listos.splice(listos.indexOf(b), 1);
      return b;
    };
    while (hechos < n && t < 5000) {
      procs.forEach((p, i) => { if (p.llegada === t) listos.push(i); });
      if (alg === 'mlfq' && o.refuerzo && t > 0 && t % o.refuerzo === 0) {
        nivel.fill(0);
      }
      if (actual >= 0) {
        let sacar = false;
        if ((alg === 'rr' || alg === 'mlfq') && usado >= cuanto(actual)) {
          if (alg === 'mlfq') nivel[actual] = Math.min(niveles - 1, nivel[actual] + 1);
          sacar = true;
        } else if (o.apropiativo || alg === 'mlfq') {
          if (listos.some((i) => mejor(i, actual))) sacar = true;
        }
        if (sacar) { listos.push(actual); actual = -1; }
      }
      if (actual < 0) {
        actual = elegir(); usado = 0;
        if (actual >= 0 && prim[actual] === null) prim[actual] = t;
        if (actual >= 0 && actual !== ultimo && ultimo >= 0) cambios++;
      }
      if (actual < 0) {
        const u = segs[segs.length - 1];
        if (u && u.p === -1 && u.fin === t) u.fin++; else segs.push({ p: -1, ini: t, fin: t + 1 });
        ultimo = -1;
        t++;
        continue;
      }
      const u = segs[segs.length - 1];
      if (u && u.p === actual && u.fin === t) u.fin++; else segs.push({ p: actual, ini: t, fin: t + 1 });
      resto[actual]--; usado++; ocupado++; t++; ultimo = actual;
      if (alg === 'prio' && o.envejecer) {
        for (const i of listos) { espera[i]++; if (espera[i] % o.envejecer === 0) prio[i] = Math.max(0, prio[i] - 1); }
      }
      if (resto[actual] === 0) { fin[actual] = t; hechos++; actual = -1; }
    }
    const por = procs.map((p, i) => {
      const retorno = (fin[i] ?? t) - p.llegada;
      return { fin: fin[i], retorno, espera: retorno - p.rafaga, respuesta: (prim[i] ?? t) - p.llegada };
    });
    const prom = (k) => por.reduce((s, x) => s + x[k], 0) / n;
    return { segs, por, total: t, cambios, espMedia: prom('espera'), retMedia: prom('retorno'), respMedia: prom('respuesta'), cpu: ocupado / Math.max(1, t), caudal: n / Math.max(1, t) };
  };

  // Dibuja el diagrama de Gantt (una fila por proceso) hasta el instante `hasta`. Devuelve la geometría para tooltips.
  S.gantt = function (lienzo, procs, res, hasta, o = {}) {
    const { ctx, ancho: W } = lienzo;
    const izq = 54, der = 12, sup = 22, fila = o.fila || 26, n = procs.length;
    const T = Math.max(res.total, 1), esc = (W - izq - der) / T;
    const col = o.colores || ((i) => VIZ.series[i % 8]);
    ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle';
    const paso = T > 40 ? 5 : T > 20 ? 2 : 1;
    for (let k = 0; k <= T; k += paso) {
      const x = Math.round(izq + k * esc) + 0.5;
      ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, sup - 4); ctx.lineTo(x, sup + n * fila); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.fillText(String(k), x, 9);
    }
    procs.forEach((p, i) => {
      const y = sup + i * fila;
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(p.nombre, izq - 8, y + fila / 2);
      // ventana de espera: desde la llegada hasta el fin, en gris tenue
      const x0 = izq + p.llegada * esc;
      const x1 = izq + Math.min(res.por[i].fin ?? hasta, hasta) * esc;
      if (hasta > p.llegada) { ctx.fillStyle = C.neutro; ctx.fillRect(x0, y + 4, Math.max(0, x1 - x0), fila - 8); }
      ctx.fillStyle = C.tinta; ctx.fillRect(x0 - 1, y + 2, 2, fila - 4);
    });
    for (const s of res.segs) {
      if (s.p < 0 || s.ini >= hasta) continue;
      const fin = Math.min(s.fin, hasta), y = sup + s.p * fila;
      ctx.fillStyle = col(s.p);
      ctx.fillRect(izq + s.ini * esc, y + 4, (fin - s.ini) * esc - 1, fila - 8);
      if ((fin - s.ini) * esc > 22) { ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.fillText(String(fin - s.ini), izq + ((s.ini + fin) / 2) * esc, y + fila / 2); }
    }
    if (hasta < T) { const x = izq + hasta * esc; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, sup - 4); ctx.lineTo(x, sup + n * fila); ctx.stroke(); ctx.lineWidth = 1; }
    return { izq, sup, fila, esc, n };
  };
  S.altoGantt = (n, fila = 26) => 30 + n * fila;

  // Procesos de ejemplo con semilla: n procesos con llegadas y ráfagas aleatorias.
  S.procesosAzar = function (semilla, n, maxRafaga = 8, maxLlegada = 8) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, (_, i) => ({ nombre: 'P' + (i + 1), llegada: i === 0 ? 0 : Math.floor(rnd() * maxLlegada), rafaga: 1 + Math.floor(rnd() * maxRafaga), prio: 1 + Math.floor(rnd() * 5) }));
  };

  // Cargas de trabajo predefinidas: (semilla, n) → procesos.
  S.CARGAS = {
    azar: ['Llegadas y ráfagas al azar', (sem, n) => S.procesosAzar(sem, n)],
    convoy: ['Un proceso largo llega primero', (sem, n) => {
      const rnd = VIZ.semilla(sem);
      return Array.from({ length: n }, (_, i) => ({ nombre: 'P' + (i + 1), llegada: i === 0 ? 0 : 1 + Math.floor(rnd() * 2), rafaga: i === 0 ? 14 : 1 + Math.floor(rnd() * 3), prio: i === 0 ? 3 : 1 + Math.floor(rnd() * 5) }));
    }],
    juntos: ['Todos llegan en t = 0', (sem, n) => S.procesosAzar(sem, n).map((p) => ({ ...p, llegada: 0 }))],
    larga: ['Una tarea corta entre muchas largas', (sem, n) => Array.from({ length: n }, (_, i) => ({ nombre: 'P' + (i + 1), llegada: i, rafaga: i === n - 1 ? 2 : 6 + (i % 3), prio: i === n - 1 ? 1 : 3 + (i % 2) })),
    ],
  };

  // Figura estándar de planificación: Gantt animado, tabla de métricas por proceso y lectura global.
  // cfg: { algs: [[id, etiqueta, opciones]], cargas: ['azar', …], n0, q (rango de quantum), envejecer (rango), refuerzo }.
  S.figuraPlanificacion = function (cuerpo, cfg) {
    let ia = 0, carga = cfg.cargas[0], n = cfg.n0 || 5, sem = 1, q = cfg.q0 || 2, env = cfg.env0 || 0, procs, res, t = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    if (cfg.algs.length > 1) ctl.selector({ etiqueta: 'Algoritmo', opciones: cfg.algs.map((a, i) => [i, a[1]]), valor: 0, alCambiar: (v) => { ia = +v; rep.reiniciar(); } });
    if (cfg.cargas.length > 1) ctl.selector({ etiqueta: 'Carga de trabajo', opciones: cfg.cargas.map((c) => [c, S.CARGAS[c][0]]), valor: carga, alCambiar: (v) => { carga = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Procesos', min: 3, max: 8, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    if (cfg.q) ctl.rango({ etiqueta: 'Quantum', min: 1, max: 8, valor: q, alCambiar: (v) => { q = v; rep.reiniciar(); } });
    if (cfg.envejecer) ctl.rango({ etiqueta: 'Envejecimiento: cada k unidades (0 = sin)', min: 0, max: 10, valor: env, alCambiar: (v) => { env = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos datos', () => { sem++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => S.altoGantt(n) + 10 });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, cfg.nota || 'Cada fila es un proceso: la franja gris es el tiempo desde su llegada y el color, cuando usa la CPU. Pase el cursor por una franja.');
    function calcular() {
      procs = S.CARGAS[carga][1](sem, n);
      const a = cfg.algs[ia];
      res = S.planificar(procs, { ...a[2], q, envejecer: env, refuerzo: cfg.refuerzo });
    }
    function iniciar() {
      calcular(); t = 0;
      ley.set(procs.map((p, i) => ({ color: VIZ.series[i % 8], texto: p.nombre })));
      lienzo.ajustar(true);
      return (function* () { for (let x = 1; x <= res.total; x++) { t = x; yield; } })();
    }
    function dibujar() {
      if (!res) return;
      lienzo.limpiar();
      geo = S.gantt(lienzo, procs, res, t);
      const hecho = t >= res.total;
      const act = res.segs.find((s) => s.p >= 0 && s.ini < t && t <= s.fin);
      registro.textContent = t === 0 ? 'Pulse «Un paso» o «Reproducir»: avanza una unidad de tiempo por paso.' : act ? `t = ${t}: ejecuta ${procs[act.p].nombre} (desde ${act.ini}).` : `t = ${t}: CPU ociosa, nadie ha llegado.`;
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos' },
        VIZ.el('tr', null, ['proceso', 'llegada', 'ráfaga', 'prioridad', 'fin', 'espera', 'retorno', 'respuesta'].map((h, i) => VIZ.el('th', { class: i ? '' : 'izq' }, h))),
        procs.map((p, i) => { const r = res.por[i], ok = hecho || (r.fin != null && r.fin <= t); return VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, p.nombre), [p.llegada, p.rafaga, p.prio, ok ? r.fin : '·', ok ? r.espera : '·', ok ? r.retorno : '·', ok ? r.respuesta : '·'].map((v) => VIZ.el('td', null, String(v)))); })));
      lectura.set(hecho ? [['espera media', VIZ.fmt(res.espMedia, 3)], ['retorno medio', VIZ.fmt(res.retMedia, 3)], ['respuesta media', VIZ.fmt(res.respMedia, 3)], ['CPU utilizada', `${VIZ.fmt(res.cpu * 100, 3)} %`], ['cambios de contexto', String(res.cambios)], ['caudal', `${VIZ.fmt(res.caudal, 3)} proc./u.`]]
        : [['tiempo', `${t} de ${res.total}`], ['terminados', String(res.por.filter((r) => r.fin != null && r.fin <= t).length)], ['métricas', 'al terminar']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !res) return;
      const { x, y } = lienzo.posicion(ev), i = Math.floor((y - geo.sup) / geo.fila), u = Math.floor((x - geo.izq) / geo.esc);
      const sg = res.segs.find((s) => s.p === i && u >= s.ini && u < s.fin && s.ini < t);
      if (sg) tip.mostrar(x, y, `<b>${procs[i].nombre}</b><br>CPU de ${sg.ini} a ${Math.min(sg.fin, t)}<br>llegó en ${procs[i].llegada}, ráfaga ${procs[i].rafaga}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
    return { rep };
  };

  // Comparación de algoritmos sobre la misma carga: barras de una métrica elegida.
  S.figuraComparacion = function (cuerpo, cfg) {
    let n = cfg.n0 || 6, sem = 1, carga = cfg.cargas[0], met = 'espMedia', q = cfg.q0 || 2, hover = -1, filas = [];
    const MET = { espMedia: 'Espera media', retMedia: 'Retorno medio', respMedia: 'Respuesta media' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Métrica', opciones: Object.entries(MET), valor: met, alCambiar: (v) => { met = v; dibujar(); } });
    if (cfg.cargas.length > 1) ctl.selector({ etiqueta: 'Carga de trabajo', opciones: cfg.cargas.map((c) => [c, S.CARGAS[c][0]]), valor: carga, alCambiar: (v) => { carga = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Procesos', min: 3, max: 8, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    if (cfg.q) ctl.rango({ etiqueta: 'Quantum', min: 1, max: 8, valor: q, alCambiar: (v) => { q = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + cfg.algs.length * 34 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'cada barra lleva el nombre del algoritmo';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todos los algoritmos reciben exactamente los mismos procesos. Menor es mejor; cambie la métrica y la carga para ver que ninguno gana en todo.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const procs = S.CARGAS[carga][1](sem, n);
      filas = cfg.algs.map((a) => ({ a, r: S.planificar(procs, { ...a[2], q }) }));
      const mx = Math.max(...filas.map((f) => f.r[met]), 1), izq = Math.min(150, W * 0.38), ancho = W - izq - 56;
      const mejor = Math.min(...filas.map((f) => f.r[met]));
      ctx.font = VIZ.fuente(11); ctx.textBaseline = 'middle';
      filas.forEach((f, i) => {
        const y = 12 + i * 34, w = (f.r[met] / mx) * ancho;
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(f.a[1], izq - 8, y + 12, izq - 10);
        ctx.fillStyle = hover === i ? VIZ.series[i % 8] : VIZ.series[i % 8]; ctx.beginPath(); ctx.roundRect(izq, y, Math.max(2, w), 24, [0, 4, 4, 0]); ctx.fill();
        if (hover === i) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = f.r[met] === mejor ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(11, f.r[met] === mejor ? 700 : 400); ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(f.r[met], 3), izq + w + 6, y + 12); ctx.font = VIZ.fuente(11);
      });
      const b = filas.find((f) => f.r[met] === mejor);
      lectura.set([['mejor', b.a[1]], [MET[met].toLowerCase(), VIZ.fmt(mejor, 3)], ['peor', VIZ.fmt(Math.max(...filas.map((f) => f.r[met])), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = Math.floor((y - 12) / 34);
      hover = i >= 0 && i < filas.length ? i : -1; dibujar();
      if (hover >= 0) { const r = filas[hover].r; tip.mostrar(x, y, `<b>${filas[hover].a[1]}</b><br>espera ${VIZ.fmt(r.espMedia, 3)}<br>retorno ${VIZ.fmt(r.retMedia, 3)}<br>respuesta ${VIZ.fmt(r.respMedia, 3)}<br>cambios de contexto ${r.cambios}`); } else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  };

  /* ---------- Reemplazo de páginas ---------- */

  S.cadenaLocal = function (semilla, n, paginas = 8, localidad = 0.7) {
    const rnd = VIZ.semilla(semilla);
    const r = []; let p = Math.floor(rnd() * paginas);
    for (let i = 0; i < n; i++) {
      if (rnd() > localidad) p = Math.floor(rnd() * paginas);
      else if (rnd() < 0.5) p = (p + 1) % paginas;
      r.push(p);
    }
    return r;
  };
  // Devuelve { pasos: [{ ref, marcos: [pág|null], fallo, victima }], fallos }.
  S.reemplazo = function (refs, marcos, alg, semilla = 1) {
    const rnd = VIZ.semilla(semilla), M = Array(marcos).fill(null), pasos = [];
    const carga = Array(marcos).fill(0), uso = Array(marcos).fill(0), bit = Array(marcos).fill(0);
    let mano = 0, fallos = 0;
    refs.forEach((r, t) => {
      let k = M.indexOf(r), fallo = false, victima = null;
      if (k >= 0) { uso[k] = t; bit[k] = 1; }
      else {
        fallo = true; fallos++;
        k = M.indexOf(null);
        if (k < 0) {
          if (alg === 'fifo') k = carga.indexOf(Math.min(...carga));
          else if (alg === 'lru') k = uso.indexOf(Math.min(...uso));
          else if (alg === 'min') {
            const prox = M.map((p) => { const j = refs.indexOf(p, t + 1); return j < 0 ? Infinity : j; });
            k = prox.indexOf(Math.max(...prox));
          } else if (alg === 'reloj') {
            while (bit[mano]) { bit[mano] = 0; mano = (mano + 1) % marcos; }
            k = mano; mano = (mano + 1) % marcos;
          } else k = Math.floor(rnd() * marcos);
          victima = M[k];
        }
        M[k] = r; carga[k] = t; uso[k] = t; bit[k] = 1;
      }
      pasos.push({ ref: r, marcos: M.slice(), fallo, victima });
    });
    return { pasos, fallos };
  };

  /* ---------- Disco ---------- */

  // Recorrido del brazo: devuelve la lista de cilindros visitados (incluye los extremos que SCAN/C-SCAN recorren) y el movimiento total.
  S.disco = function (pedidos, cabeza, alg, subiendo = true, maxCil = 199) {
    const pend = pedidos.slice(), ruta = [cabeza], atend = [];
    let pos = cabeza, dir = subiendo ? 1 : -1;
    const ir = (c, servir = true) => { ruta.push(c); pos = c; if (servir) atend.push(c); };
    if (alg === 'fcfs') for (const c of pend) ir(c);
    else if (alg === 'sstf') {
      while (pend.length) {
        let b = 0; pend.forEach((c, i) => { if (Math.abs(c - pos) < Math.abs(pend[b] - pos)) b = i; });
        ir(pend.splice(b, 1)[0]);
      }
    } else {
      const ord = pend.slice().sort((a, b) => a - b);
      const mayores = ord.filter((c) => c >= pos), menores = ord.filter((c) => c < pos).reverse();
      if (alg === 'scan') {
        if (dir > 0) { mayores.forEach((c) => ir(c)); if (menores.length) ir(maxCil, false); menores.forEach((c) => ir(c)); }
        else { menores.forEach((c) => ir(c)); if (mayores.length) ir(0, false); mayores.forEach((c) => ir(c)); }
      } else { // cscan
        mayores.forEach((c) => ir(c));
        if (menores.length) { ir(maxCil, false); ir(0, false); menores.slice().reverse().forEach((c) => ir(c)); }
      }
    }
    let mov = 0; for (let i = 1; i < ruta.length; i++) mov += Math.abs(ruta[i] - ruta[i - 1]);
    return { ruta, atend, mov };
  };

  /* ---------- Detección de errores ---------- */

  S.paridad = (bits) => [...bits].filter((b) => b === '1').length % 2; // bit que hace par el total de unos
  // División módulo 2 de bits·x^r entre el generador; devuelve el resto de r bits.
  S.crc = function (bits, gen) {
    const r = gen.length - 1, a = (bits + '0'.repeat(r)).split('').map(Number), g = gen.split('').map(Number);
    for (let i = 0; i < bits.length; i++) if (a[i]) for (let j = 0; j < g.length; j++) a[i + j] ^= g[j];
    return a.slice(bits.length).join('');
  };
  // Suma de verificación de Internet (complemento a uno de 16 bits) sobre palabras de 16 bits.
  S.sumaVerif = function (palabras) {
    let s = 0;
    for (const w of palabras) { s += w; while (s > 0xffff) s = (s & 0xffff) + (s >> 16); }
    return (~s) & 0xffff;
  };
  S.hex = (v, d = 4) => v.toString(16).toUpperCase().padStart(d, '0');

  /* ---------- IPv4 ---------- */

  S.ip = {
    aEntero: (t) => t.split('.').reduce((a, b) => (a * 256 + (+b)) >>> 0, 0),
    aTexto: (v) => [24, 16, 8, 0].map((s) => (v >>> s) & 255).join('.'),
    mascara: (len) => (len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0),
    valida: (t) => /^\d{1,3}(\.\d{1,3}){3}$/.test(t) && t.split('.').every((x) => +x <= 255),
    binario: (v) => [24, 16, 8, 0].map((s) => ((v >>> s) & 255).toString(2).padStart(8, '0')).join('.'),
  };
  // Datos de una red a partir de una dirección y un prefijo.
  S.red = function (dir, len) {
    const a = S.ip.aEntero(dir), m = S.ip.mascara(len), r = (a & m) >>> 0, d = (r | (~m >>> 0)) >>> 0;
    const util = len >= 31 ? (len === 31 ? 2 : 1) : 2 ** (32 - len) - 2;
    return { red: r, difusion: d, mascara: m, primera: len >= 31 ? r : r + 1, ultima: len >= 31 ? d : d - 1, hosts: util, total: 2 ** (32 - len) };
  };

  /* ---------- Criptografía de juguete (solo didáctica) ---------- */

  // Hash de 32 bits tipo FNV-1a: sirve para mostrar el efecto avalancha, NO es seguro.
  S.hash = function (txt, sal = 0) {
    let h = (0x811c9dc5 ^ sal) >>> 0;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
    return h >>> 0;
  };
  S.hash64 = (txt, clave = '') => S.hex(S.hash(clave + txt, 1), 8) + S.hex(S.hash(txt + clave, 7), 8);
  // Flujo de bytes pseudoaleatorio a partir de la clave y cifrado XOR (juguete).
  S.cifrar = function (txt, clave) {
    const rnd = VIZ.semilla(S.hash(clave) || 1);
    return [...txt].map((c) => (c.charCodeAt(0) ^ Math.floor(rnd() * 256)) & 255);
  };
  S.descifrar = function (bytes, clave) {
    const rnd = VIZ.semilla(S.hash(clave) || 1);
    return bytes.map((b) => String.fromCharCode((b ^ Math.floor(rnd() * 256)) & 255)).join('');
  };

  /* ---------- Flujo entre zonas ---------- */

  // Bandas horizontales (zonas) y pasos numerados que saltan entre ellas; pasos: [{ z, texto }] y se dibujan los primeros n.
  S.flujo = function (lienzo, zonas, pasos, n, o = {}) {
    const { ctx, ancho: W, alto: H } = lienzo, m = 8, bh = (H - 2 * m) / zonas.length, izq = o.izq || 76;
    ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'middle';
    zonas.forEach((z, i) => {
      const y = m + i * bh;
      ctx.fillStyle = i % 2 ? C.neutro : C.fondo2; ctx.fillRect(0, y, W, bh);
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(z, 8, y + bh / 2, izq - 12);
    });
    const dx = (W - izq - 26) / Math.max(1, pasos.length - 1);
    const pt = pasos.map((p, k) => ({ x: izq + 8 + k * dx, y: m + p.z * bh + bh / 2 }));
    for (let k = 0; k < Math.min(n, pasos.length); k++) {
      if (k > 0) {
        const a = pt[k - 1], b = pt[k];
        ctx.strokeStyle = C.tinta2; ctx.fillStyle = C.tinta2; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath(); ctx.moveTo(b.x - 11 * Math.cos(ang), b.y - 11 * Math.sin(ang));
        ctx.lineTo(b.x - 19 * Math.cos(ang) - 4 * Math.sin(ang), b.y - 19 * Math.sin(ang) + 4 * Math.cos(ang));
        ctx.lineTo(b.x - 19 * Math.cos(ang) + 4 * Math.sin(ang), b.y - 19 * Math.sin(ang) - 4 * Math.cos(ang)); ctx.fill();
      }
    }
    for (let k = 0; k < Math.min(n, pasos.length); k++) {
      const { x, y } = pt[k], ult = k === n - 1;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fillStyle = pasos[k].color || VIZ.series[pasos[k].z % 8]; ctx.fill();
      if (ult) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 700); ctx.textAlign = 'center'; ctx.fillText(String(k + 1), x, y + 0.5);
    }
    ctx.lineWidth = 1;
  };

  /* ---------- Diagramas de secuencia ---------- */

  // actores: ['Cliente', 'Servidor']; msgs: [{ de, a, texto, nota?, color?, perdido?, punteado? }] (de/a son índices).
  S.altoSecuencia = (msgs, extra = 0) => 56 + msgs.length * 34 + extra;
  S.secuencia = function (lienzo, actores, msgs, n, o = {}) {
    const { ctx, ancho: W } = lienzo, k = actores.length;
    const m = Math.max(36, Math.min(80, W / (2 * k) - 2)), xs = actores.map((_, i) => m + ((W - 2 * m) * i) / Math.max(1, k - 1));
    if (k === 1) xs[0] = W / 2;
    ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const H = S.altoSecuencia(msgs, o.extra || 0);
    actores.forEach((a, i) => {
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(xs[i], 30); ctx.lineTo(xs[i], H - 8); ctx.stroke(); ctx.setLineDash([]);
      const w = Math.min(ctx.measureText(a).width + 16, Math.min(2 * m - 4, (W - 2 * m) / Math.max(1, k - 1) - 6), 150);
      ctx.fillStyle = C.fondo2; ctx.fillRect(xs[i] - w / 2, 6, w, 22);
      ctx.strokeStyle = C.tinta; ctx.strokeRect(xs[i] - w / 2, 6, w, 22);
      ctx.fillStyle = C.tinta; ctx.fillText(a, xs[i], 17, w - 4);
    });
    ctx.font = VIZ.fuente(11);
    msgs.forEach((g, i) => {
      if (i >= n) return;
      const y = 52 + i * 34, x0 = xs[g.de], x1 = xs[g.a], c = g.color || C.s1, ult = i === n - 1;
      ctx.strokeStyle = g.perdido ? C.s8 : c; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = ult ? 2.5 : 1.5;
      ctx.setLineDash(g.punteado || g.perdido ? [5, 4] : []);
      const xf = g.perdido ? x0 + (x1 - x0) * 0.6 : x1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xf, y); ctx.stroke(); ctx.setLineDash([]);
      const d = Math.sign(x1 - x0) || 1;
      if (g.perdido) { ctx.font = VIZ.fuente(14, 700); ctx.textAlign = 'center'; ctx.fillText('×', xf + 6 * d, y); ctx.font = VIZ.fuente(11); }
      else if (x0 !== x1) { ctx.beginPath(); ctx.moveTo(xf, y); ctx.lineTo(xf - 8 * d, y - 4); ctx.lineTo(xf - 8 * d, y + 4); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(x0 + 18, y, 8, -Math.PI / 2, Math.PI, false); ctx.stroke(); }
      ctx.fillStyle = ult ? C.tinta : C.tinta2; ctx.textAlign = 'center';
      const mx = x0 === x1 ? x0 + 70 : (x0 + x1) / 2;
      ctx.fillText(g.texto, mx, y - 10, Math.max(60, Math.abs(x1 - x0) - 16));
      if (g.nota) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.fillText(g.nota, mx, y + 11, Math.max(60, Math.abs(x1 - x0) - 12)); ctx.font = VIZ.fuente(11); }
    });
    ctx.lineWidth = 1;
  };

  // Figura estándar de un protocolo: diagrama de secuencia paso a paso con un registro y lecturas.
  // cfg: { actores, casos: [{ id, nombre, msgs: (p) => [{ de, a, texto, nota?, expl, color?, perdido?, punteado? }] }],
  //        params: [{ clave, etiqueta, min, max, valor, formato? }], leyenda, nota, lectura: (caso, msgs, k, p) => pares }.
  S.figuraSecuencia = function (cuerpo, cfg) {
    let caso = cfg.casos[0], k = 0;
    const p = {};
    const ctl = VIZ.controles(cuerpo);
    if (cfg.casos.length > 1) ctl.selector({ etiqueta: cfg.etiquetaCaso || 'Escenario', opciones: cfg.casos.map((c) => [c.id, c.nombre]), valor: caso.id, alCambiar: (v) => { caso = cfg.casos.find((c) => c.id === v); lienzo.ajustar(true); rep.reiniciar(); } });
    for (const q of cfg.params || []) { p[q.clave] = q.valor; ctl.rango({ etiqueta: q.etiqueta, min: q.min, max: q.max, paso: q.paso || 1, valor: q.valor, formato: q.formato, alCambiar: (v) => { p[q.clave] = v; lienzo.ajustar(true); rep.reiniciar(); } }); }
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => S.altoSecuencia(caso.msgs(p)) });
    VIZ.leyenda(cuerpo, cfg.leyenda);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, cfg.nota || 'Avance con «Un paso». El tiempo corre hacia abajo; cada flecha es un mensaje.');
    function iniciar() { k = 0; return (function* () { const n = caso.msgs(p).length; for (let j = 1; j <= n; j++) { k = j; yield; } })(); }
    function dibujar() {
      const m = caso.msgs(p);
      lienzo.limpiar();
      S.secuencia(lienzo, cfg.actores, m, k);
      registro.textContent = k ? `${k}. ${m[k - 1].expl || m[k - 1].texto}` : 'Pulse «Un paso» para comenzar.';
      lectura.set(cfg.lectura(caso, m, k, p));
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  };
})();
