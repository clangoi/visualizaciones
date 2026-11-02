(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Proceso de pedidos con las actividades renombradas a letras para que el grafo quepa en pantallas pequeñas.
  const LETRA = { 'Registrar pedido': 'a', 'Verificar stock': 'b', 'Reponer stock': 'c', 'Preparar envío': 'd', 'Emitir factura': 'e', 'Cobrar al contado': 'f', 'Enviar recordatorio': 'g', 'Despachar': 'h' };
  const NOMBRE = Object.fromEntries(Object.entries(LETRA).map(([k, v]) => [v, k]));
  function logPedidos(n, semilla, ruido) {
    const log = P.simular(P.procesos.pedidos.arbol, n, semilla, { ruido });
    log.forEach((c) => c.eventos.forEach((e) => { e.act = LETRA[e.act] || e.act; }));
    return log;
  }
  const leyendaNombres = (cuerpo, nombres) => {
    const e = VIZ.el('div', { class: 'lista-mono' }, VIZ.el('div', null, Object.entries(nombres).map(([k, v]) => `${k} = ${v}`).join('  ·  ')));
    cuerpo.appendChild(e);
    return e;
  };

  // Medidas del Heuristic Miner calculadas sobre el DFG del registro.
  function medidas(log) {
    const d = P.dfg(log);
    const aba = new Map();
    for (const c of log) {
      const t = P.trazaDe(c);
      for (let i = 0; i + 2 < t.length; i++) if (t[i] === t[i + 2] && t[i] !== t[i + 1]) { const k = t[i] + t[i + 1]; aba.set(k, (aba.get(k) || 0) + 1); }
    }
    const n = d.n;
    const dep = (a, b) => { const x = n(a, b), z = n(b, a); return (x - z) / (x + z + 1); };
    const auto = (a) => n(a, a) / (n(a, a) + 1);
    const abaN = (a, b) => aba.get(a + b) || 0;
    const dos = (a, b) => { const s = abaN(a, b) + abaN(b, a); return s / (s + 1); };
    return { d, acts: d.acts, n, dep, auto, dos, abaN };
  }
  const f2 = (v) => VIZ.fmt(Math.round(v * 100) / 100, 3);

  // Distancia de un punto a un segmento (para detectar el cursor sobre una arista).
  function distSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }

  /* ---------- Fig. 1: matriz de dependencias ---------- */

  function montarMatriz(cuerpo) {
    let n = 120, ruido = 0.1, semilla = 1, sel = null, M = null, geo = null, ordenados = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos', min: 20, max: 400, paso: 20, valor: n, alCambiar: (v) => { n = v; nuevo(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.3, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; nuevo(); } });
    ctl.boton('Nuevo registro', () => { semilla++; nuevo(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.92, altoMin: 320, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'a ⇒ b cercano a 1: b depende de a' },
      { color: VIZ.css(VIZ.enRampa(0.3)), texto: 'dependencia débil' },
      { color: C.neutro, borde: C.eje, texto: 'cero o negativo (b ⇒ a es la relación fuerte)' },
    ]);
    leyendaNombres(cuerpo, NOMBRE);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda (fila a, columna b) para ver cómo se calcula a ⇒ b con los conteos |a&gt;b| y |b&gt;a|. La diagonal muestra la medida de bucle de longitud 1.');

    function nuevo() {
      M = medidas(logPedidos(n, semilla, ruido));
      dibujar();
    }
    const celdaDe = (x, y) => {
      if (!geo) return null;
      const j = Math.floor((x - geo.ox) / geo.t), i = Math.floor((y - geo.oy) / geo.t);
      return i >= 0 && j >= 0 && i < M.acts.length && j < M.acts.length ? [M.acts[i], M.acts[j]] : null;
    };
    const texto = (a, b) => {
      if (a === b) return `${a} ⇒ ${a} = |${a}&gt;${a}| / (|${a}&gt;${a}| + 1) = ${M.n(a, a)} / ${M.n(a, a) + 1} = <b>${f2(M.auto(a))}</b>`;
      const x = M.n(a, b), z = M.n(b, a);
      return `${a} ⇒ ${b} = (|${a}&gt;${b}| − |${b}&gt;${a}|) / (|${a}&gt;${b}| + |${b}&gt;${a}| + 1) = (${x} − ${z}) / ${x + z + 1} = <b>${f2(M.dep(a, b))}</b>`;
    };
    function dibujar() {
      if (!M) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const k = M.acts.length, ox = 30, oy = 28, t = Math.min((W - ox - 4) / k, (H - oy - 4) / k);
      geo = { ox, oy, t };
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = VIZ.fuente(11, 600);
      ctx.fillStyle = C.apagado;
      ctx.fillText('b →', ox + (k * t) / 2, 8);
      M.acts.forEach((a, i) => {
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 600);
        ctx.fillText(a, ox + (i + 0.5) * t, oy - 9);
        ctx.fillText(a, ox - 12, oy + (i + 0.5) * t);
      });
      ctx.save(); ctx.translate(8, oy + (k * t) / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(11, 600); ctx.fillText('a ↓', 0, 0); ctx.restore();
      M.acts.forEach((a, i) => M.acts.forEach((b, j) => {
        const v = a === b ? M.auto(a) : M.dep(a, b);
        const x = ox + j * t, y = oy + i * t;
        const fuerte = v > 0.55;
        ctx.fillStyle = v > 0.001 ? VIZ.css(VIZ.enRampa(Math.min(1, v))) : C.neutro;
        ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
        if (a === b && v <= 0.001) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, t - 3, t - 3); }
        ctx.fillStyle = v > 0.001 ? (fuerte ? C.sobre : C.tinta) : C.apagado;
        ctx.font = VIZ.fuente(t > 40 ? 11 : 9, 500);
        ctx.fillText(v === 0 ? '0' : f2(v), x + t / 2, y + t / 2);
      }));
      if (sel) {
        const i = M.acts.indexOf(sel[0]), j = M.acts.indexOf(sel[1]);
        ctx.strokeStyle = C.s2; ctx.lineWidth = 3;
        ctx.strokeRect(ox + j * t + 1.5, oy + i * t + 1.5, t - 3, t - 3);
      }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      registro.innerHTML = sel ? texto(sel[0], sel[1]) : 'Haga clic en una celda para ver su cálculo.';
      const fuertes = [], ambos = [];
      for (const a of M.acts) for (const b of M.acts) {
        if (a === b) continue;
        if (M.dep(a, b) >= 0.9) fuertes.push([a, b]);
        if (a < b && M.n(a, b) > 0 && M.n(b, a) > 0) ambos.push([a, b]);
      }
      ordenados = fuertes;
      lectura.set([
        ['eventos', VIZ.entero(M.d.frec.size ? [...M.d.frec.values()].reduce((s, v) => s + v, 0) : 0)],
        ['pares con a ⇒ b ≥ 0,9', String(fuertes.length)],
        ['pares vistos en ambos órdenes', `${ambos.length}: ${ambos.map(([a, b]) => a + b).join(' ') || '—'}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const c = celdaDe(x, y); if (c) { sel = c; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = celdaDe(x, y);
      if (!c) return tip.ocultar();
      const [a, b] = c;
      tip.mostrar(x, y, `<b>${a}</b> ${NOMBRE[a]} → <b>${b}</b> ${NOMBRE[b]}<br>|${a}&gt;${b}| = <b>${M.n(a, b)}</b>, |${b}&gt;${a}| = <b>${M.n(b, a)}</b><br>${a} ⇒ ${b} = <b>${f2(a === b ? M.auto(a) : M.dep(a, b))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevo();
  }

  /* ---------- Fig. 2: umbrales y filtrado de ruido ---------- */

  // Dependencias verdaderas: las del registro limpio de referencia (300 casos, sin ruido).
  const REF = (() => {
    const m = medidas(logPedidos(300, 77, 0));
    const aristas = [];
    for (const a of m.acts) for (const b of m.acts) if (a !== b && m.dep(a, b) >= 0.5) aristas.push([a, b]);
    return { aristas, set: new Set(aristas.map(([a, b]) => a + b)), acts: m.acts, pos: P.disponer(m.acts, aristas) };
  })();

  function montarUmbral(cuerpo) {
    let n = 120, ruido = 0.12, semilla = 2, tau = 0.3, nu = 1, M = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de dependencia', min: 0, max: 0.98, paso: 0.02, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Frecuencia mínima |a>b|', min: 1, max: 30, paso: 1, valor: nu, alCambiar: (v) => { nu = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.4, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; nuevo(); } });
    ctl.boton('Nuevo registro', () => { semilla++; nuevo(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'dependencia verdadera conservada', forma: 'linea' },
      { color: C.s8, texto: 'arista espuria conservada (ruido)', forma: 'linea' },
      { color: C.tenue, texto: 'dependencia verdadera perdida', forma: 'linea' },
    ]);
    leyendaNombres(cuerpo, NOMBRE);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con umbral 0 el grafo conserva casi todo el DFG, incluidas las aristas que solo existen por el ruido (rojo). Suba el umbral hasta que desaparezcan sin perder (gris) las dependencias reales. El número sobre cada arista (en pantallas anchas) es a ⇒ b. Pase el cursor o toque una arista para ver sus conteos.');

    function nuevo() { M = medidas(logPedidos(n, semilla, ruido)); dibujar(); }
    let lineas = [];
    function dibujar() {
      if (!M) return;
      lienzo.limpiar();
      const maxN = Math.max(1, ...M.d.aristas.map((e) => e.n));
      const nodos = REF.acts.map((a) => ({ id: a, tipo: 'act', etiqueta: a }));
      const aristas = [];
      let espurias = 0, ciertas = 0;
      for (const a of REF.acts) for (const b of REF.acts) {
        if (a === b) continue;
        const cnt = M.n(a, b), dp = M.dep(a, b), verdadera = REF.set.has(a + b);
        const conserva = cnt >= nu && dp >= tau && cnt > 0;
        if (conserva) {
          verdadera ? ciertas++ : espurias++;
          aristas.push({ de: a, a: b, etiqueta: lienzo.ancho >= 520 ? f2(dp) : undefined, ancho: 1.5 + 3 * cnt / maxN, color: verdadera ? C.tinta : C.s8, colorTexto: verdadera ? C.tinta2 : C.s8 });
        } else if (verdadera) aristas.push({ de: a, a: b, color: C.tenue, guiones: true });
      }
      geo = P.dibujarGrafo(lienzo, nodos, aristas, REF.pos, { margenX: 30, margenY: 30 });
      lineas = geo.lineas;
      const perdidas = REF.aristas.length - ciertas;
      registro.textContent = `Se conservan ${ciertas + espurias} aristas con a ⇒ b ≥ ${VIZ.fmt(tau, 2)} y |a>b| ≥ ${nu}: ${ciertas} verdaderas y ${espurias} espurias; se pierden ${perdidas} de las ${REF.aristas.length} dependencias verdaderas.`;
      lectura.set([
        ['pares a>b observados', String(M.d.aristas.length)],
        ['aristas conservadas', String(ciertas + espurias)],
        ['espurias conservadas', String(espurias)],
        ['verdaderas perdidas', `${perdidas} de ${REF.aristas.length}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = null, dm = 9;
      for (const l of lineas) { if (!l.p1 || l.p1 === l.p2) continue; const dd = distSeg(x, y, l.p1, l.p2); if (dd < dm) { dm = dd; mejor = l.e; } }
      if (!mejor) return tip.ocultar();
      const a = mejor.de, b = mejor.a;
      tip.mostrar(x, y, `<b>${a}</b> → <b>${b}</b><br>|${a}&gt;${b}| = <b>${M.n(a, b)}</b>, |${b}&gt;${a}| = <b>${M.n(b, a)}</b><br>${a} ⇒ ${b} = <b>${f2(M.dep(a, b))}</b><br>${REF.set.has(a + b) ? 'está en el proceso real' : 'no está en el proceso real'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevo();
  }

  /* ---------- Fig. 3: construcción paso a paso y bucles cortos ---------- */

  const A = P.act;
  const ARBOL_RECLAMOS = P.sec(A('Recibir'), A('Clasificar'), P.bucle(A('Investigar'), A('Pedir datos'), 0.4), P.bucle(A('Anotar'), P.tau(), 0.35),
    P.xor([A('Aprobar'), A('Rechazar')], [0.5, 0.5]), A('Cerrar'));
  const LET3 = { Recibir: 'a', Clasificar: 'b', Investigar: 'c', 'Pedir datos': 'd', Anotar: 'e', Aprobar: 'f', Rechazar: 'g', Cerrar: 'h' };
  const NOM3 = Object.fromEntries(Object.entries(LET3).map(([k, v]) => [v, k]));

  function montarPasos(cuerpo) {
    let semilla = 3, tau = 0.8, M = null, cand = [], aceptadas = [], hechos = [], pos = null, geoDfg = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de dependencia', min: 0.3, max: 0.98, paso: 0.02, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevo registro', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 290, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'dependencia aceptada', forma: 'linea' },
      { color: C.s2, texto: 'candidata que se evalúa ahora', forma: 'linea' },
      { color: C.s3, texto: 'bucle corto aceptado (longitud 1 o 2)', forma: 'linea' },
    ]);
    leyendaNombres(cuerpo, NOM3);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Use «Un paso» para ver cada decisión. Primero se evalúan las aristas a ≠ b por frecuencia; c y d se alternan, así que c ⇒ d y d ⇒ c quedan cerca de 0 y se rechazan, pero el bucle de longitud 2 (c ⇄ d) se acepta después. e tiene un bucle sobre sí misma (longitud 1). Baje el umbral y observe qué más entra.');

    function iniciar() {
      const log = P.simular(ARBOL_RECLAMOS, 120, semilla, { espera: 5 });
      log.forEach((c) => c.eventos.forEach((e) => { e.act = LET3[e.act]; }));
      M = medidas(log);
      const edges = M.d.aristas.filter((e) => e.de !== e.a).sort((x, z) => z.n - x.n || (x.de + x.a).localeCompare(z.de + z.a));
      cand = edges.map((e) => ({ tipo: 'dep', de: e.de, a: e.a }));
      for (const a of M.acts) if (M.n(a, a) > 0) cand.push({ tipo: 'auto', de: a, a });
      for (const a of M.acts) for (const b of M.acts) if (a < b && M.abaN(a, b) + M.abaN(b, a) > 0) cand.push({ tipo: 'dos', de: a, a: b });
      aceptadas = []; hechos = [];
      pos = P.disponer(M.acts, M.d.aristas.map((e) => [e.de, e.a]));
      return (function* () {
        for (const c of cand) {
          let v, ok, txt;
          if (c.tipo === 'dep') {
            v = M.dep(c.de, c.a); ok = v >= tau;
            txt = `${c.de} ⇒ ${c.a} = (${M.n(c.de, c.a)} − ${M.n(c.a, c.de)}) / ${M.n(c.de, c.a) + M.n(c.a, c.de) + 1} = ${f2(v)}`;
          } else if (c.tipo === 'auto') {
            v = M.auto(c.de); ok = v >= tau;
            txt = `${c.de} ⇒ ${c.de} = ${M.n(c.de, c.de)} / ${M.n(c.de, c.de) + 1} = ${f2(v)}   (bucle de longitud 1)`;
          } else {
            const s = M.abaN(c.de, c.a) + M.abaN(c.a, c.de);
            v = M.dos(c.de, c.a); ok = v >= tau;
            txt = `${c.de} ⇒₂ ${c.a} = (${M.abaN(c.de, c.a)} + ${M.abaN(c.a, c.de)}) / ${s + 1} = ${f2(v)}   (bucle de longitud 2)`;
          }
          hechos.push({ c, ok, txt, v });
          if (ok) aceptadas.push(c);
          yield;
        }
      })();
    }
    function dibujar() {
      if (!M) return;
      lienzo.limpiar();
      const actual = hechos[hechos.length - 1];
      const nodos = M.acts.map((a) => ({ id: a, tipo: 'act', etiqueta: a }));
      const aristas = [];
      for (const c of aceptadas) {
        if (c.tipo === 'dos') { aristas.push({ de: c.de, a: c.a, color: C.s3, ancho: 2.5 }, { de: c.a, a: c.de, color: C.s3, ancho: 2.5 }); }
        else aristas.push({ de: c.de, a: c.a, color: c.tipo === 'auto' ? C.s3 : C.tinta, ancho: 2.5 });
      }
      if (actual) {
        const c = actual.c;
        if (!actual.ok) aristas.push({ de: c.de, a: c.a, color: C.s2, guiones: true, ancho: 2.5 });
        else aristas.forEach((e) => { if ((e.de === c.de && e.a === c.a) || (c.tipo === 'dos' && e.de === c.a && e.a === c.de)) { e.color = C.s2; } });
      }
      P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: 34, margenY: 34 });
      lista.replaceChildren(...hechos.slice(-9).map((h, i, arr) => VIZ.el('div', { class: i === arr.length - 1 ? 'activa' : null },
        VIZ.el('span', { style: { color: h.ok ? C.s6 : C.s8 } }, h.ok ? '✓ ' : '✗ '), h.txt)));
      registro.textContent = actual
        ? `${actual.txt}: ${actual.ok ? 'supera' : 'no supera'} el umbral ${VIZ.fmt(tau, 2)}, ${actual.ok ? 'se agrega la dependencia.' : 'se descarta.'}`
        : `Hay ${cand.length} candidatas por evaluar (aristas a>b, bucles de longitud 1 y de longitud 2). Pulse Un paso.`;
      lectura.set([
        ['candidatas evaluadas', `${hechos.length} de ${cand.length}`],
        ['dependencias aceptadas', String(aceptadas.filter((c) => c.tipo === 'dep').length)],
        ['bucles de longitud 1', String(aceptadas.filter((c) => c.tipo === 'auto').length)],
        ['bucles de longitud 2', String(aceptadas.filter((c) => c.tipo === 'dos').length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('heuristic-miner', {
    intro: String.raw`
      <p>El <strong>Heuristic Miner</strong> descubre un modelo mirando <em>cuántas veces</em> ocurre cada cosa, no solo si ocurrió. Para cada par
      de actividades \(a, b\) compara cuántas veces \(b\) sigue directamente a \(a\) con cuántas veces \(a\) sigue a \(b\), y resume la
      diferencia en una <em>medida de dependencia</em> entre \(-1\) y \(1\). Una arista que aparece pocas veces, o casi tanto en un sentido como en el
      otro, queda con una medida baja y se descarta.</p>
      <p>Por eso tolera ruido y casos incompletos, donde el <a href="tema.html?id=alpha-algorithm">algoritmo Alfa</a> se rompe con una sola traza rara.
      El costo es que el resultado es un grafo de dependencias que hay que convertir después en un modelo con compuertas
      (<a href="tema.html?id=flexible-heuristics-miner">Flexible Heuristics Miner</a>).</p>`,
    visualizaciones: [
      {
        titulo: 'Matriz de medidas de dependencia',
        descripcion: 'Cada celda es \\(a \\Rightarrow b\\). Observe que a → b es fuerte y b → a negativa, y que d y e (paralelas) quedan cerca de 0. Pruebe subir el ruido y haga clic en una celda para ver el cálculo.',
        montar: montarMatriz,
      },
      {
        titulo: 'Umbrales y filtrado de ruido',
        descripcion: 'Suba el umbral de dependencia y vea desaparecer las aristas rojas del ruido antes que las reales; con ruido alto pruebe también la frecuencia mínima.',
        montar: montarUmbral,
      },
      {
        titulo: 'Evaluar candidatas y bucles cortos',
        descripcion: 'Recorra paso a paso las candidatas: las aristas se aceptan o rechazan por su medida, y los bucles de longitud 1 y 2 usan sus propias medidas. Baje el umbral para ver qué se cuela.',
        montar: montarPasos,
      },
    ],
    teoria: String.raw`
      <h2>Frecuencias de sucesión directa</h2>
      <p>Sea \(L\) un registro de eventos. Se escribe \(|a >_L b|\) para el número de veces que \(b\) sigue <em>inmediatamente</em> a \(a\) en las trazas
      de \(L\) (las mismas cuentas del <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>) y \(|a|\) para la frecuencia de \(a\).</p>
      <h2>Medidas de dependencia</h2>
      \[ a \Rightarrow_L b \;=\; \frac{|a >_L b| - |b >_L a|}{|a >_L b| + |b >_L a| + 1}. \]
      <ul>
        <li>Es cercana a \(1\) cuando \(b\) sigue a \(a\) muchas veces y casi nunca al revés: dependencia causal fiable.</li>
        <li>Es cercana a \(0\) cuando ambos órdenes ocurren (actividades <em>paralelas</em>) o cuando hay muy pocas observaciones.</li>
        <li>El \(+1\) del denominador penaliza la poca evidencia: con una sola observación la medida es \(1/2\), con diez es \(10/11 \approx 0{,}91\).</li>
      </ul>
      <p>Bucles cortos:</p>
      \[ a \Rightarrow_L a = \frac{|a >_L a|}{|a >_L a| + 1}, \qquad a \Rightarrow^2_L b = \frac{|a b a| + |b a b|}{|a b a| + |b a b| + 1}, \]
      <p>donde \(|aba|\) cuenta las apariciones consecutivas de \(a, b, a\). En un bucle \(a \rightleftarrows b\) ambas sucesiones directas ocurren, por lo que
      \(a \Rightarrow b \approx 0\) y se necesita la segunda medida.</p>
      <h2>Algoritmo</h2>
      <pre><code>entrada: registro L, umbrales τ_dep, ν_frec (y τ_bucle)
D ← {}                                    // aristas del grafo de dependencias
para cada par (a, b) con a ≠ b y |a &gt; b| &gt; 0:
    si |a &gt; b| ≥ ν_frec y a ⇒ b ≥ τ_dep:  D ← D ∪ {(a, b)}
para cada actividad a:
    si a ⇒ a ≥ τ_bucle:                   D ← D ∪ {(a, a)}
para cada par (a, b) con |aba| + |bab| &gt; 0:
    si a ⇒² b ≥ τ_bucle:                  D ← D ∪ {(a, b), (b, a)}
devolver D                                // luego: splits y joins (C-Net)</code></pre>
      <h2>Ejemplo y lectura del umbral</h2>
      <p>Si en 120 casos \(a\) precede directamente a \(b\) 118 veces y \(b\) precede a \(a\) 0 veces, \(a \Rightarrow b = 118/119 \approx 0{,}99\).
      Si una traza ruidosa invierte el par una vez, \(b > a\) vale 1 y la medida pasa a \(117/120 \approx 0{,}98\): sigue sobre cualquier umbral razonable.
      En cambio una arista espuria que aparece 3 veces vale \(3/4 = 0{,}75\) y cae con \(\tau = 0{,}8\).</p>
      <div class="recuadro"><p><strong>Compromiso:</strong> un umbral alto da modelos simples y precisos, pero pierde ramas poco frecuentes
      (menor <em>fitness</em>); uno bajo conserva todo, ruido incluido. No hay valor universal: se ajusta mirando el modelo y
      midiendo <a href="tema.html?id=fitness-precision">fitness y precisión</a>.</p></div>
      <h2>Conexiones</h2>
      <ul>
        <li>Aborda el problema del ruido que muestra <a href="tema.html?id=noise-and-incompleteness">Noise and Incompleteness</a> y las <a href="tema.html?id=alpha-limitations">limitaciones de Alfa</a>.</li>
        <li>El paso siguiente, con compuertas XOR/AND, es el <a href="tema.html?id=flexible-heuristics-miner">Flexible Heuristics Miner</a>.</li>
        <li>Compárelo con el corte recursivo del <a href="tema.html?id=inductive-miner">Inductive Miner</a> y con el <a href="tema.html?id=split-miner">Split Miner</a>, que filtra por percentil.</li>
      </ul>`,
  });
})();
