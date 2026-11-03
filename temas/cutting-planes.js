(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* Problemas con datos enteros: max c·x  s.a.  a1 x + a2 y ≤ b,  x, y ≥ 0 enteros. */
  const PROBLEMAS = {
    clasico: { nombre: 'Dos recursos (1 corte)', c: [5, 8], filas: [[1, 1, 6], [5, 9, 45]] },
    oblicuo: { nombre: 'Restricciones oblicuas (3 cortes)', c: [3, 4], filas: [[2, 3, 12], [3, 1, 9]] },
    largo: { nombre: 'Tres restricciones, 6 cortes', c: [1, 8], filas: [[-1, 6, 24], [1, 3, 16], [4, 4, 26]] },
    tres: { nombre: 'Tres restricciones, 8 cortes', c: [9, 5], filas: [[-2, 7, 25], [5, 2, 25], [1, 6, 24]] },
  };
  const restr = (P) => [...P.filas.map(([a1, a2, b]) => ({ a: [a1, a2], b })), { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }];
  const CAJA = { xmin: -1, xmax: 60, ymin: -1, ymax: 60 };
  const valor = (c, p) => c[0] * p[0] + c[1] * p[1];

  function geometria(P) {
    const poli = O.poligono(restr(P), CAJA);
    const lp = O.optimo2d(poli, P.c);
    const xm = Math.ceil(Math.max(...poli.map((p) => p[0]))), ym = Math.ceil(Math.max(...poli.map((p) => p[1])));
    const pts = [];
    for (let i = 0; i <= xm; i++) for (let j = 0; j <= ym; j++) if (P.filas.every(([a1, a2, b]) => a1 * i + a2 * j <= b + 1e-9)) pts.push([i, j]);
    let ip = null;
    for (const p of pts) { const z = valor(P.c, p); if (!ip || z > ip.z) ip = { x: p, z }; }
    return { poli, lp, pts, ip, dom: [0, xm + 1, 0, ym + 1] };
  }
  // Envoltura convexa (antihoraria) de puntos [x, y].
  function envoltura(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const mitad = (lista) => { const h = []; for (const q of lista) { while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
    return [...mitad(p), ...mitad(p.slice().reverse())];
  }
  const trazo = (ctx, plano, poli) => { ctx.beginPath(); poli.forEach((p, i) => (i ? ctx.lineTo(plano.sx(p[0]), plano.sy(p[1])) : ctx.moveTo(plano.sx(p[0]), plano.sy(p[1])))); ctx.closePath(); };
  // Extremos de la recta a·x = b sobre el dominio visible.
  function segmento(a, b, d) {
    const pts = [];
    if (Math.abs(a[1]) > 1e-12) for (const x of [d[0], d[1]]) pts.push([x, (b - a[0] * x) / a[1]]);
    if (Math.abs(a[0]) > 1e-12) for (const y of [d[2], d[3]]) pts.push([(b - a[1] * y) / a[0], y]);
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  }
  const rect = (ctx, plano) => { ctx.beginPath(); ctx.rect(plano.x0, plano.y1, plano.x1 - plano.x0, plano.y0 - plano.y1); ctx.clip(); };

  /* Formato racional y de desigualdades. */
  function racional(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v)).replace('-', '−');
    for (let q = 2; q <= 72; q++) { const p = Math.round(v * q); if (Math.abs(v * q - p) < 1e-7) return `${p < 0 ? '−' : ''}${Math.abs(p)}/${q}`; }
    return VIZ.fmt(v, 3);
  }
  const mcd = (a, b) => (b ? mcd(b, a % b) : Math.abs(a));
  function desigualdad(a1, a2, b) { // a1 x + a2 y ≤ b con enteros si es posible
    let v = [a1, a2, b];
    for (let k = 1; k <= 72; k++) {
      if (v.every((q) => Math.abs(q * k - Math.round(q * k)) < 1e-6)) { const e = v.map((q) => Math.round(q * k)); const g = mcd(mcd(e[0], e[1]), e[2]) || 1; v = e.map((q) => q / g); break; }
    }
    const t = (c, n, primero) => (Math.abs(c) < 1e-9 ? '' : `${primero ? (c < 0 ? '−' : '') : c < 0 ? ' − ' : ' + '}${Math.abs(Math.abs(c) - 1) < 1e-9 ? '' : racional(Math.abs(c))}${n}`);
    const izq = (t(v[0], 'x', true) + t(v[1], 'y', !t(v[0], 'x', true))) || '0';
    return `${izq} ≤ ${racional(v[2])}`;
  }

  /* ---------- Motor de cortes de Gomory sobre el tableau ---------- */

  const parteFrac = (v) => { const f = v - Math.floor(v + 1e-9); return f < 1e-9 || f > 1 - 1e-9 ? 0 : f; };
  function motorIniciar(P) {
    const A = P.filas.map((f) => [f[0], f[1]]), b = P.filas.map((f) => f[2]);
    let st; for (st of O.simplex(P.c, A, b));
    const m = A.length;
    return {
      T: st.T.map((r) => r.slice()), base: st.base.slice(), nc: 2 + m, m,
      expr: [[1, 0, 0], [0, 1, 0], ...P.filas.map((f) => [-f[0], -f[1], f[2]])],
      nombres: ['x', 'y', ...P.filas.map((_, i) => `s${i + 1}`)],
    };
  }
  const motorSol = (S) => { const x = Array(S.nc).fill(0); S.base.forEach((v, i) => { x[v] = S.T[i][S.nc]; }); return x; };
  const motorZ = (S) => S.T[S.m][S.nc];
  function motorFila(S, modo) {
    let mejor = -1, mf = 0;
    for (let i = 0; i < S.m; i++) {
      const f = parteFrac(S.T[i][S.nc]);
      if (f > 1e-7) { if (modo === 'primera') return i; if (f > mf + 1e-9) { mf = f; mejor = i; } }
    }
    return mejor;
  }
  // Agrega el corte de Gomory de la fila i y reoptimiza con el símplex dual. Devuelve la descripción del corte.
  function motorCortar(S, i) {
    const nc = S.nc, f = [];
    for (let j = 0; j < nc; j++) f.push(parteFrac(S.T[i][j]));
    const f0 = parteFrac(S.T[i][nc]);
    let al = 0, be = 0, ga = -f0;
    f.forEach((v, j) => { al += v * S.expr[j][0]; be += v * S.expr[j][1]; ga += v * S.expr[j][2]; });
    const fila = S.T[i].slice(), basica = S.nombres[S.base[i]];
    S.T.forEach((r) => r.splice(nc, 0, 0));
    S.T.splice(S.m, 0, [...f.map((v) => -v), 1, -f0]);
    S.base.push(nc); S.expr.push([al, be, ga]); S.nombres.push(`c${nc - 1 - S.m + 1}`);
    S.nc = nc + 1; S.m += 1;
    for (let it = 0; it < 100; it++) {
      let r = -1, mn = -1e-9;
      for (let k = 0; k < S.m; k++) if (S.T[k][S.nc] < mn) { mn = S.T[k][S.nc]; r = k; }
      if (r < 0) break;
      let e = -1, mr = Infinity;
      for (let j = 0; j < S.nc; j++) if (S.T[r][j] < -1e-9) { const q = S.T[S.m][j] / -S.T[r][j]; if (q < mr - 1e-12) { mr = q; e = j; } }
      if (e < 0) return { infactible: true };
      const p = S.T[r][e];
      S.T[r] = S.T[r].map((v) => v / p);
      for (let k = 0; k <= S.m; k++) if (k !== r) { const q = S.T[k][e]; if (q !== 0) S.T[k] = S.T[k].map((v, j) => v - q * S.T[r][j]); }
      S.base[r] = e;
    }
    // Restricción en x, y:  −α x − β y ≤ γ  (s_nueva = α x + β y + γ ≥ 0).
    return { a: [-al, -be], b: ga, f, f0, fila, basica };
  }
  // Nombres de columnas con el nuevo corte (c1, c2, …): se rotulan por orden de aparición.
  function nombreCorte(S, k) { return `c${k}`; }
  function termino(c, n, primero) {
    if (Math.abs(c) < 1e-9) return '';
    const a = Math.abs(c), cuerpo = `${Math.abs(a - 1) < 1e-9 ? '' : racional(a) + ' '}${n}`;
    return primero ? (c < 0 ? '−' : '') + cuerpo : (c < 0 ? ' − ' : ' + ') + cuerpo;
  }
  function expresion(coefs, nombres, saltar) {
    let s = '', primero = true;
    coefs.forEach((c, j) => { if (j === saltar) return; const t = termino(c, nombres[j], primero); if (t) { s += t; primero = false; } });
    return s;
  }

  /* ---------- Fig. 1: geometría de un corte ---------- */

  function montarGeometria(cuerpo) {
    let clave = 'clasico', theta = 0, holgura = 0, geo = geometria(PROBLEMAS[clave]), plano = null, hull = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; geo = geometria(PROBLEMAS[v]); faceta(); } });
    const rTheta = ctl.rango({ etiqueta: 'Dirección del corte', min: 0, max: 359, paso: 1, valor: theta, formato: (v) => `${v}°`, alCambiar: (v) => { theta = v; dibujar(); } });
    const rHol = ctl.rango({ etiqueta: 'Desplazamiento del corte', min: -1.5, max: 1.5, paso: 0.05, valor: holgura, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { holgura = v; dibujar(); } });
    ctl.boton('Faceta que separa el óptimo', () => faceta(), { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'relajación tras el corte' },
      { color: VIZ.alfa(C.s2, 0.25), texto: 'zona eliminada' },
      { color: C.s2, texto: 'recta del corte', forma: 'linea' },
      { color: C.s6, texto: 'envoltura convexa entera', forma: 'linea' },
      { color: C.tinta2, texto: 'punto entero factible', forma: 'punto' },
      { color: C.s8, texto: 'punto entero perdido', forma: 'punto' },
      { color: C.s2, texto: 'óptimo relajado original', forma: 'punto' },
      { color: C.s7, texto: 'nuevo óptimo relajado', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El corte es \\(d\\cdot x \\le h\\) con \\(d = (\\cos\\theta, \\sin\\theta)\\). Con desplazamiento 0, \\(h\\) es el mayor \\(d\\cdot p\\) entre los puntos enteros: la recta toca la envoltura y nunca elimina uno. Valores negativos la acercan y pierden puntos; positivos la dejan floja.');

    // Elige la cara de la envoltura que más viola el óptimo relajado.
    function faceta() {
      const P = PROBLEMAS[clave];
      hull = envoltura(geo.pts);
      let mejor = null;
      for (let k = 0; k < hull.length; k++) {
        const p = hull[k], q = hull[(k + 1) % hull.length];
        const d = [q[1] - p[1], p[0] - q[0]], n = Math.hypot(d[0], d[1]);
        if (n < 1e-9) continue;
        const viol = (d[0] * geo.lp.x[0] + d[1] * geo.lp.x[1] - (d[0] * p[0] + d[1] * p[1])) / n;
        if (!mejor || viol > mejor.viol) mejor = { viol, ang: Math.atan2(d[1], d[0]) };
      }
      void P;
      if (mejor && mejor.viol > 1e-9) theta = Math.round(((mejor.ang * 180) / Math.PI + 360) % 360) % 360;
      else theta = 0;
      holgura = 0; rTheta.valor = theta; rTheta.refrescar(); rHol.valor = 0; rHol.refrescar();
      dibujar(true);
    }
    function dibujar(forzar) {
      const P = PROBLEMAS[clave], { ctx } = lienzo;
      if (!hull.length) hull = envoltura(geo.pts);
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: geo.dom[0], xmax: geo.dom[1], ymin: geo.dom[2], ymax: geo.dom[3] }, { etiquetaX: 'x', etiquetaY: 'y' });
      plano.ejes();
      const d = [Math.cos((theta * Math.PI) / 180), Math.sin((theta * Math.PI) / 180)];
      const hMax = Math.max(...geo.pts.map((p) => d[0] * p[0] + d[1] * p[1]));
      const h = hMax + holgura;
      const corte = { a: d, b: h };
      const nueva = O.poligono([...restr(P), corte], CAJA);
      const quitada = O.poligono([...restr(P), { a: [-d[0], -d[1]], b: -h }], CAJA);
      if (quitada.length > 2) { trazo(ctx, plano, quitada); ctx.fillStyle = VIZ.alfa(C.s2, 0.25); ctx.fill(); }
      if (nueva.length > 2) { trazo(ctx, plano, nueva); ctx.fillStyle = VIZ.alfa(C.s1, 0.2); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke(); }
      trazo(ctx, plano, geo.poli); ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      if (hull.length > 1) { ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.s6; ctx.lineWidth = 2; trazo(ctx, plano, hull); ctx.stroke(); ctx.restore(); }
      const seg = segmento(d, h, geo.dom);
      if (seg) { ctx.save(); rect(ctx, plano); ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(plano.sx(seg[0][0]), plano.sy(seg[0][1])); ctx.lineTo(plano.sx(seg[1][0]), plano.sy(seg[1][1])); ctx.stroke(); ctx.restore(); }
      let perdidos = 0;
      for (const p of geo.pts) {
        const perdido = d[0] * p[0] + d[1] * p[1] > h + 1e-9;
        if (perdido) { perdidos++; VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), C.s8, 6, 5); }
        else { ctx.fillStyle = C.tinta2; ctx.beginPath(); ctx.arc(plano.sx(p[0]), plano.sy(p[1]), 3.5, 0, 7); ctx.fill(); }
      }
      const nuevoLP = nueva.length ? O.optimo2d(nueva, P.c) : null;
      if (nuevoLP) VIZ.marcador(ctx, plano.sx(nuevoLP.x[0]), plano.sy(nuevoLP.x[1]), C.s7, 5.5, 1);
      VIZ.marcador(ctx, plano.sx(geo.lp.x[0]), plano.sy(geo.lp.x[1]), C.s2, 6, 3);
      const separa = d[0] * geo.lp.x[0] + d[1] * geo.lp.x[1] > h + 1e-9;
      const valido = perdidos === 0;
      lectura.set([
        ['¿elimina el óptimo relajado?', separa ? 'sí' : 'no'],
        ['puntos enteros perdidos', `${perdidos} de ${geo.pts.length}`],
        ['cota antes', VIZ.fmt(geo.lp.z)],
        ['cota después', nuevoLP ? VIZ.fmt(nuevoLP.z) : '—'],
        ['óptimo entero', geo.ip ? VIZ.fmt(geo.ip.z) : '—'],
      ]);
      registro.textContent = !valido ? `Corte inválido: elimina ${perdidos} punto(s) entero(s) factible(s), así que puede dejar fuera el óptimo entero.`
        : !separa ? 'Corte válido pero inútil: no elimina el óptimo relajado, así que la cota no cambia.'
          : holgura > 1e-9 ? 'Corte válido y flojo: separa el óptimo relajado, pero queda separado de la envoltura; un desplazamiento 0 lo apoya en ella.'
            : `Corte válido y profundo: toca la envoltura entera, elimina el óptimo relajado y baja la cota de ${VIZ.fmt(geo.lp.z)} a ${nuevoLP ? VIZ.fmt(nuevoLP.z) : '—'}.`;
      void forzar;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const p = [Math.round(plano.ix(x)), Math.round(plano.iy(y))];
      const P = PROBLEMAS[clave];
      const ok = P.filas.every(([a1, a2, b]) => a1 * p[0] + a2 * p[1] <= b + 1e-9) && p[0] >= 0 && p[1] >= 0;
      const dd = [Math.cos((theta * Math.PI) / 180), Math.sin((theta * Math.PI) / 180)];
      const h = Math.max(...geo.pts.map((q) => dd[0] * q[0] + dd[1] * q[1])) + holgura;
      const v = dd[0] * p[0] + dd[1] * p[1];
      tip.mostrar(x, y, `punto <b>(${p[0]}, ${p[1]})</b><br>${ok ? 'entero factible' : 'no factible'}<br>d·x = <b>${VIZ.fmt(v, 3)}</b> (corte: ≤ ${VIZ.fmt(h, 3)})<br>${ok && v > h + 1e-9 ? 'eliminado por el corte' : 'se conserva'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    faceta();
  }

  /* ---------- Fig. 2: cortes de Gomory sobre el tableau ---------- */

  function montarGomory(cuerpo) {
    let clave = 'clasico', modo = 'mayor', S = null, cortes = [], mensaje = '', plano = null, geo = null, fin = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Fila fuente del corte', opciones: [['mayor', 'mayor parte fraccionaria'], ['primera', 'primera fila fraccionaria']], valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'región tras los cortes' },
      { color: C.s2, texto: 'último corte', forma: 'linea' },
      { color: C.apagado, texto: 'cortes anteriores', forma: 'linea' },
      { color: C.s2, texto: 'óptimo relajado actual', forma: 'punto' },
      { color: C.s6, texto: 'óptimo entero', forma: 'punto' },
      { color: C.tinta2, texto: 'punto entero factible', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Tableau actual (óptimo de la relajación con los cortes)');
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma una fila con lado derecho fraccionario, forma el corte con las partes fraccionarias de sus coeficientes y reoptimiza con el símplex dual. El corte se traduce a una recta en \\((x, y)\\) usando \\(s_i = b_i - a_i\\cdot x\\).');

    function iniciar() {
      const P = PROBLEMAS[clave];
      S = motorIniciar(P); cortes = []; fin = false; geo = geometria(P);
      mensaje = `Tableau óptimo de la relajación: x = (${motorSol(S).slice(0, 2).map(racional).join(', ')}), z = ${racional(motorZ(S))}. Las variables x e y son fraccionarias.`;
      return (function* () {
        for (;;) {
          const i = motorFila(S, modo);
          if (i < 0) { fin = true; mensaje = `Fin: todas las variables básicas son enteras: x = (${motorSol(S).slice(0, 2).map(racional).join(', ')}), z = ${racional(motorZ(S))}, tras ${cortes.length} corte(s).`; return; }
          if (cortes.length >= 14) { fin = true; mensaje = 'Se alcanzó el límite de 14 cortes sin terminar.'; return; }
          const k = cortes.length + 1;
          const fila = S.T[i].slice(), base = S.nombres[S.base[i]], nombres = S.nombres.slice();
          const c = motorCortar(S, i);
          S.nombres[S.nombres.length - 1] = nombreCorte(S, k);
          if (c.infactible) { fin = true; mensaje = 'El corte volvió infactible la relajación.'; return; }
          c.k = k;
          cortes.push(c);
          const nuevo = motorSol(S);
          const filaTxt = fila.slice(0, nombres.length).map((v, j) => (nombres[j] === base ? 0 : v)).map((v, j) => termino(v, nombres[j], false)).join('');
          mensaje = `Corte ${k}, fila de ${base}: ${base}${filaTxt} = ${racional(fila[fila.length - 1])}. ` +
            `Partes fraccionarias: ${expresion(c.f, nombres, -1)} ≥ ${racional(c.f0)}, o sea ${desigualdad(c.a[0], c.a[1], c.b)} en x, y. ` +
            `Nuevo óptimo relajado: (${nuevo.slice(0, 2).map(racional).join(', ')}), z = ${racional(motorZ(S))}.`;
          yield;
        }
      })();
    }
    function tabla() {
      const nm = S.nombres.slice(0, S.nc);
      const cab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'base'), ...nm.map((t) => VIZ.el('th', null, t)), VIZ.el('th', null, 'lado der.'));
      const fil = [];
      for (let i = 0; i <= S.m; i++) {
        const esZ = i === S.m;
        fil.push(VIZ.el('tr', null,
          VIZ.el('td', { class: 'izq' }, esZ ? 'z' : S.nombres[S.base[i]]),
          ...S.T[i].map((v, j) => {
            const fracc = j === S.nc && !esZ && parteFrac(v) > 1e-7;
            return VIZ.el('td', { style: fracc ? { color: C.s8 } : null }, racional(v));
          })));
      }
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' }, cab, ...fil));
    }
    function dibujar() {
      if (!S) return;
      const P = PROBLEMAS[clave], { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: geo.dom[0], xmax: geo.dom[1], ymin: geo.dom[2], ymax: geo.dom[3] }, { etiquetaX: 'x', etiquetaY: 'y' });
      plano.ejes();
      const poli = O.poligono([...restr(P), ...cortes.map((c) => ({ a: c.a, b: c.b }))], CAJA);
      trazo(ctx, plano, geo.poli); ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      if (poli.length > 2) { trazo(ctx, plano, poli); ctx.fillStyle = VIZ.alfa(C.s1, 0.2); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke(); }
      cortes.forEach((c, k) => {
        const seg = segmento(c.a, c.b, geo.dom);
        if (!seg) return;
        const ultimo = k === cortes.length - 1;
        ctx.save(); rect(ctx, plano); ctx.strokeStyle = ultimo ? C.s2 : C.apagado; ctx.lineWidth = ultimo ? 2.5 : 1.5; if (!ultimo) ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(plano.sx(seg[0][0]), plano.sy(seg[0][1])); ctx.lineTo(plano.sx(seg[1][0]), plano.sy(seg[1][1])); ctx.stroke(); ctx.restore();
      });
      for (const p of geo.pts) { ctx.fillStyle = C.tinta2; ctx.beginPath(); ctx.arc(plano.sx(p[0]), plano.sy(p[1]), 3.5, 0, 7); ctx.fill(); }
      const xs = motorSol(S);
      if (geo.ip) VIZ.marcador(ctx, plano.sx(geo.ip.x[0]), plano.sy(geo.ip.x[1]), C.s6, 6.5, 0);
      VIZ.marcador(ctx, plano.sx(xs[0]), plano.sy(xs[1]), C.s2, 6, 3);
      tabla();
      registro.textContent = mensaje;
      const entero = [xs[0], xs[1]].every((v) => Math.abs(v - Math.round(v)) < 1e-7);
      lectura.set([
        ['cortes agregados', String(cortes.length)],
        ['óptimo relajado', `(${xs.slice(0, 2).map((v) => VIZ.fmt(v, 4)).join(', ')})`],
        ['cota z', VIZ.fmt(motorZ(S))],
        ['óptimo entero', geo.ip ? VIZ.fmt(geo.ip.z) : '—'],
        ['estado', entero ? 'solución entera' : 'fraccionaria'],
      ]);
      void fin;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y) || !S) return tip.ocultar();
      const p = [Math.round(plano.ix(x)), Math.round(plano.iy(y))];
      const P = PROBLEMAS[clave];
      const ok = p[0] >= 0 && p[1] >= 0 && P.filas.every(([a1, a2, b]) => a1 * p[0] + a2 * p[1] <= b + 1e-9);
      const sobreviven = ok && cortes.every((c) => c.a[0] * p[0] + c.a[1] * p[1] <= c.b + 1e-7);
      tip.mostrar(x, y, `punto <b>(${p[0]}, ${p[1]})</b><br>${ok ? `entero factible, z = <b>${VIZ.fmt(valor(P.c, p))}</b><br>${sobreviven ? 'sigue dentro de todos los cortes' : 'ERROR: eliminado'}` : 'no factible'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: cortes frente a ramificación ---------- */

  function cotaGlobal(nodos, inc) {
    let m = -Infinity;
    for (const nd of nodos) if (nd.estado === 'optimo' && !nd.hijos.length && !nd.poda) m = Math.max(m, nd.z);
    if (inc) m = Math.max(m, inc.z);
    return m;
  }
  function serieBB(P, extra, maxNodos = 120) {
    const A = [...P.filas.map((f) => [f[0], f[1]]), ...extra.map((c) => c.a)];
    const b = [...P.filas.map((f) => f[2]), ...extra.map((c) => c.b)];
    const g = O.ramificar(P.c, A, A.map(() => '<='), b, { seleccion: 'mejor', maxNodos });
    const cotas = []; let ultimo = null;
    for (const s of g) { ultimo = s; cotas.push(cotaGlobal(s.nodos, s.incumbente)); }
    return { cotas, nodos: ultimo.nodos.length };
  }
  function serieGomory(P, K) {
    const S = motorIniciar(P), z = [motorZ(S)], cortes = [];
    for (let k = 0; k < K; k++) {
      const i = motorFila(S, 'mayor');
      if (i < 0) return { z, cortes, entero: true };
      const c = motorCortar(S, i);
      if (c.infactible) break;
      cortes.push({ a: c.a, b: c.b }); z.push(motorZ(S));
    }
    return { z, cortes, entero: motorFila(S, 'mayor') < 0 };
  }

  function montarComparacion(cuerpo) {
    let clave = 'tres', raiz = 3, datos = null, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; calcular(); } });
    ctl.rango({ etiqueta: 'Cortes en la raíz (ramifica y corta)', min: 0, max: 8, valor: raiz, alCambiar: (v) => { raiz = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'solo cortes de Gomory', forma: 'linea' },
      { color: C.s2, texto: 'solo ramificación (mejor cota)', forma: 'linea' },
      { color: C.s7, texto: 'cortes en la raíz y luego ramificación', forma: 'linea' },
      { color: C.apagado, texto: 'óptimo entero', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje horizontal: cada corte agregado o cada nodo procesado. Los cortes bajan la cota sin ramificar; la ramificación la baja partiendo el problema. Cambie cuántos cortes se aplican antes de ramificar y observe el tamaño del árbol. Pase el cursor para leer cada iteración.');

    function calcular() {
      const P = PROBLEMAS[clave], geo = geometria(P);
      const gom = serieGomory(P, 16);
      const bb = serieBB(P, []);
      const r = Math.min(raiz, gom.cortes.length);
      const mixto = serieBB(P, gom.cortes.slice(0, r));
      datos = { geo, gom, bb, mixto, r, serieMixta: [...gom.z.slice(0, r), ...mixto.cotas] };
      dibujar();
    }
    function dibujar() {
      if (!datos) return;
      const { ctx } = lienzo, { geo, gom, bb, serieMixta } = datos;
      lienzo.limpiar();
      const N = Math.max(gom.z.length, bb.cotas.length, serieMixta.length) - 1;
      const z0 = geo.lp.z, opt = geo.ip.z;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(N, 1), ymin: Math.floor(opt - 1), ymax: Math.ceil(z0 + 0.5) }, { etiquetaX: 'iteración (corte o nodo)', etiquetaY: 'cota superior', ticksX: VIZ.ticks(0, Math.max(N, 1), 6).filter(Number.isInteger) });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, opt], [Math.max(N, 1), opt]], C.apagado, 1.5, [4, 4]);
      const linea = (v, col) => { VIZ.trazar(ctx, plano, v.map((q, k) => [k, q]), col, 2); v.forEach((q, k) => { if (k === v.length - 1) VIZ.marcador(ctx, plano.sx(k), plano.sy(q), col, 4.5); }); };
      linea(bb.cotas, C.s2);
      linea(gom.z, C.s1);
      linea(serieMixta, C.s7);
      if (hover != null) { ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plano.sx(hover), plano.y1); ctx.lineTo(plano.sx(hover), plano.y0); ctx.stroke(); ctx.restore(); }
      lectura.set([
        ['cota inicial / óptimo', `${VIZ.fmt(z0)} / ${VIZ.fmt(opt)}`],
        ['solo cortes', gom.entero ? `${gom.cortes.length} cortes hasta una solución entera` : `${gom.cortes.length} cortes, aún fraccionaria`],
        ['solo ramificación', `${bb.nodos} nodos`],
        [`${datos.r} cortes + ramificación`, `${datos.mixto.nodos} nodos (z raíz ${VIZ.fmt(gom.z[datos.r])})`],
      ]);
      registro.textContent = `La cota de la raíz es ${VIZ.fmt(z0)} y el óptimo entero ${VIZ.fmt(opt)}. ` +
        (datos.mixto.nodos < bb.nodos ? `Aplicar ${datos.r} cortes antes de ramificar reduce el árbol de ${bb.nodos} a ${datos.mixto.nodos} nodos.` : datos.r === 0 ? 'Con 0 cortes en la raíz solo hay ramificación.' : `Aquí ${datos.r} cortes no reducen el árbol (${bb.nodos} frente a ${datos.mixto.nodos} nodos).`);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !datos || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.round(plano.ix(x)));
      dibujar();
      const f = (v) => (hover < v.length ? VIZ.fmt(v[hover]) : 'terminó');
      tip.mostrar(x, y, `iteración <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'cortes', f(datos.gom.z)) + VIZ.filaTooltip(C.s2, 'ramificación', f(datos.bb.cotas)) + VIZ.filaTooltip(C.s7, 'cortes + ramif.', f(datos.serieMixta)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('cutting-planes', {
    intro: String.raw`
      <p>La relajación lineal de un problema entero suele tener un óptimo fraccionario. Un <strong>plano cortante</strong> (o <em>corte</em>) es una desigualdad nueva que ese punto fraccionario
      viola pero que todo punto entero factible cumple: recorta un pedazo de la región relajada sin perder ninguna solución entera. Se agrega, se vuelve a resolver el LP y se repite.</p>
      <p>Cada corte acerca la región relajada a la <em>envoltura convexa</em> de las soluciones enteras, el conjunto donde el LP daría directamente la respuesta correcta. Los cortes de
      <strong>Gomory</strong> se obtienen mecánicamente de una fila fraccionaria del tableau del símplex; los resolvedores modernos los combinan con la ramificación (<em>branch and cut</em>).</p>`,
    visualizaciones: [
      {
        titulo: 'Geometría de un corte',
        descripcion: 'Gire la dirección del corte: con desplazamiento 0 la recta toca la envoltura entera (verde) y nunca elimina un punto entero. Baje el desplazamiento y empezará a perder puntos (cruces rojas): ese corte ya no es válido. Pulse «Faceta que separa el óptimo» para el corte más profundo.',
        montar: montarGeometria,
      },
      {
        titulo: 'Cortes de Gomory sobre el tableau',
        descripcion: 'Avance un corte por paso: se elige una fila fraccionaria, se forma el corte con las partes fraccionarias y se reoptimiza con el símplex dual. Observe cómo la recta elimina el vértice fraccionario y cómo el tableau vuelve a mostrar valores fraccionarios hasta que todos son enteros. Pruebe «primera fila fraccionaria».',
        montar: montarGomory,
      },
      {
        titulo: 'Cortes frente a ramificación',
        descripcion: 'Compare cómo baja la cota con cortes solos, con ramificación sola y con unos cuantos cortes seguidos de ramificación (branch and cut). Cambie el número de cortes en la raíz y vea cuántos nodos ahorra.',
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>Desigualdades válidas y cortes</h2>
      <p>Sea \(X = \{x \in \mathbb{Z}^n_{\ge 0} : Ax \le b\}\) y \(P = \{x \ge 0 : Ax \le b\}\) su relajación. Una desigualdad \(\pi^\top x \le \pi_0\) es <strong>válida</strong> si la cumplen todos los puntos de \(X\).
      Si además la viola el óptimo relajado \(x^*\), se llama <strong>corte</strong> (<em>plano cortante</em>) para \(x^*\). Agregar desigualdades válidas no cambia \(z_{IP}\) pero sí puede bajar \(z_{LP}\).
      En el límite se obtiene la envoltura convexa \(\operatorname{conv}(X)\), cuyos vértices son enteros (véase <a href="tema.html?id=valid-inequalities">desigualdades válidas y formulaciones fuertes</a>).</p>
      <h2>Corte fraccionario de Gomory</h2>
      <p>Suponga que el problema está en forma estándar con coeficientes enteros, de modo que las holguras también son enteras. Si en el tableau óptimo una variable básica tiene valor fraccionario, su fila es</p>
      \[ x_B + \sum_{j \in N} \bar a_j\, x_j = \bar b, \qquad \bar b \notin \mathbb{Z}. \]
      <p>Sea \(\{v\} = v - \lfloor v \rfloor\). Para todo punto entero factible, \(x_B + \sum \lfloor \bar a_j \rfloor x_j\) es entero y \(\bar b - \lfloor \bar b \rfloor\) es la parte que sobra, de modo que</p>
      \[ \sum_{j \in N} \{\bar a_j\}\, x_j \;\ge\; \{\bar b\}. \]
      <p>Esta es la desigualdad de Gomory. La viola el vértice actual porque ahí todas las \(x_j\) no básicas valen 0 y \(\{\bar b\} > 0\). Como las variables de holgura se expresan con \(x, y\), el corte se traduce a una recta del plano.</p>
      <h2>Algoritmo de planos cortantes</h2>
      <pre><code>resolver la relajación LP; sea x* su óptimo
mientras x* no sea entero:
    elegir una fila con \(\bar b\) fraccionario
    agregar el corte de Gomory de esa fila
    reoptimizar (símplex dual: el tableau sigue siendo óptimo en costos, pero no factible)
devolver x*</code></pre>
      <p>Con una regla de elección adecuada el método termina en un número finito de pasos, aunque en la práctica puede avanzar muy lento (cada corte aporta poco) y generar números grandes.
      Por eso se usa como complemento de la ramificación.</p>
      <h2>Ejemplo resuelto</h2>
      <p>En \(\max\, 5x + 8y\), \(x + y + s_1 = 6\), \(5x + 9y + s_2 = 45\), el tableau óptimo tiene la fila</p>
      \[ y - \tfrac{5}{4}s_1 + \tfrac{1}{4}s_2 = \tfrac{15}{4}. \]
      <p>Las partes fraccionarias son \(\{-\tfrac54\} = \tfrac34\) y \(\{\tfrac14\} = \tfrac14\); \(\{\tfrac{15}{4}\} = \tfrac34\). El corte es \(\tfrac34 s_1 + \tfrac14 s_2 \ge \tfrac34\). Sustituyendo \(s_1 = 6 - x - y\) y \(s_2 = 45 - 5x - 9y\):</p>
      \[ \tfrac34(6 - x - y) + \tfrac14(45 - 5x - 9y) \ge \tfrac34 \;\Longleftrightarrow\; 2x + 3y \le 15. \]
      <p>El óptimo relajado \((2{,}25;\,3{,}75)\) da \(2(2{,}25) + 3(3{,}75) = 15{,}75 &gt; 15\): queda eliminado, y ningún punto entero factible lo viola (por ejemplo \((0,5)\) y \((3,3)\) dan 15). Con el corte, el nuevo óptimo es \((0,5)\), entero, con \(z = 40\): un solo corte cerró toda la brecha.</p>
      <h2>Cortes y ramificación</h2>
      <table>
        <tr><th></th><th>Ramificación</th><th>Cortes</th></tr>
        <tr><td>Qué hace</td><td>divide la región en dos</td><td>recorta la región sin dividirla</td></tr>
        <tr><td>Efecto en la cota</td><td>baja al crecer el árbol</td><td>baja en cada ronda</td></tr>
        <tr><td>Riesgo</td><td>árbol exponencial</td><td>estancamiento y números grandes</td></tr>
      </table>
      <p>La combinación, <em>branch and cut</em>, aplica cortes en la raíz (y a veces en otros nodos) y luego ramifica; véase <a href="tema.html?id=milp-branch-and-bound">Branch and Bound para MILP</a> y
      <a href="tema.html?id=milp-solving-strategies">las estrategias de resolución</a>. Además de Gomory existen cortes de cobertura para la mochila y otros según la estructura del problema;
      todos parten de una relajación como la de <a href="tema.html?id=lp-relaxation">relajación lineal</a>.</p>`,
  });
})();
