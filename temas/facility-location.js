(function () {
  'use strict';
  const { color: C } = VIZ;
  // Formato con signo menos tipográfico (U+2212) y ceros numéricos limpios.
  const fm = (v, d) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v, d).replace(/-/g, '−');

  /* ---------- Ayudantes de mapa con la misma escala en x e y ---------- */

  function planoIgual(l, d, m = { izq: 38, der: 12, sup: 12, inf: 26 }) {
    const [x0, x1, y0, y1] = d;
    const aw = l.ancho - m.izq - m.der, ah = l.alto - m.sup - m.inf;
    const s = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    const dw = (aw - s * (x1 - x0)) / 2, dh = (ah - s * (y1 - y0)) / 2;
    return VIZ.plano(l, { xmin: x0, xmax: x1, ymin: y0, ymax: y1 }, { margen: { izq: m.izq + dw, der: m.der + dw, sup: m.sup + dh, inf: m.inf + dh } });
  }
  function muestras(f, d, G = 100) {
    const [x0, x1, y0, y1] = d;
    const v = new Float64Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) v[j * (G + 1) + i] = f(x0 + ((x1 - x0) * i) / G, y1 - ((y1 - y0) * j) / G);
    const ord = Float64Array.from(v).sort();
    return { v, G, q: (p) => ord[Math.min(ord.length - 1, Math.max(0, Math.round(p * (ord.length - 1))))] };
  }
  function imagenGris(m) {
    const { v, G } = m, lo = m.q(0.02), hi = m.q(0.98);
    const off = document.createElement('canvas');
    off.width = off.height = G + 1;
    const o = off.getContext('2d'), img = o.createImageData(G + 1, G + 1);
    for (let k = 0; k < v.length; k++) {
      const rgb = VIZ.enRampa(Math.sqrt(Math.min(1, Math.max(0, (v[k] - lo) / (hi - lo || 1)))), VIZ.rampaGris);
      img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    return off;
  }
  function capaMapa(l, p, f, img, niveles) {
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement('canvas');
    off.width = l.canvas.width; off.height = l.canvas.height;
    const o = off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.imageSmoothingEnabled = true;
    o.drawImage(img, p.x0, p.y1, p.x1 - p.x0, p.y0 - p.y1);
    for (const n of niveles) VIZ.ml.contorno(o, p, f, n, { color: VIZ.alfa(C.tinta2, 0.55), ancho: 1, paso: 4 });
    o.strokeStyle = C.tinta; o.lineWidth = 1;
    o.strokeRect(p.x0 + 0.5, p.y1 + 0.5, p.x1 - p.x0 - 1, p.y0 - p.y1 - 1);
    return off;
  }
  function flecha(ctx, x0, y0, x1, y1, color, w = 2.5) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4));
    ctx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const DOM = [0, 10, 0, 8];
  const METRICAS = {
    cuad: { nombre: 'Distancia euclidiana al cuadrado (centroide)', corto: 'cuadrática', color: C.s1, forma: 0 },
    euc: { nombre: 'Distancia euclidiana (mediana geométrica)', corto: 'euclidiana', color: C.s2, forma: 3 },
    manh: { nombre: 'Distancia manhattan (mediana por coordenada)', corto: 'manhattan', color: C.s3, forma: 1 },
  };
  const OPC_MET = Object.entries(METRICAS).map(([k, v]) => [k, v.nombre]);

  // Clientes compartidos por las dos figuras.
  const estado = { clientes: [], sel: 0, semilla: 1, oyentes: [] };
  function nuevosClientes() {
    const r = VIZ.semilla(estado.semilla * 53 + 7);
    estado.clientes = Array.from({ length: 6 }, () => ({ x: 1 + r() * 8, y: 1 + r() * 6, w: 1 + Math.floor(r() * 4) }));
    estado.sel = 0;
  }
  nuevosClientes();
  const avisar = () => estado.oyentes.forEach((fn) => fn());

  const costo = (m, p, cl = estado.clientes) => cl.reduce((s, c) => {
    const dx = p[0] - c.x, dy = p[1] - c.y;
    return s + c.w * (m === 'cuad' ? dx * dx + dy * dy : m === 'euc' ? Math.hypot(dx, dy) : Math.abs(dx) + Math.abs(dy));
  }, 0);
  const mediana = (vals, pesos) => {
    const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    const mitad = pesos.reduce((s, w) => s + w, 0) / 2;
    let acum = 0;
    for (const i of idx) { acum += pesos[i]; if (acum >= mitad) return vals[i]; }
    return vals[idx[idx.length - 1]];
  };
  function weiszfeldPaso(p, cl = estado.clientes) {
    let a = 0, b = 0, c = 0;
    for (const q of cl) { const d = Math.max(Math.hypot(p[0] - q.x, p[1] - q.y), 1e-12); a += (q.w * q.x) / d; b += (q.w * q.y) / d; c += q.w / d; }
    return [a / c, b / c];
  }
  function optimo(m, cl = estado.clientes) {
    const W = cl.reduce((s, q) => s + q.w, 0);
    if (m === 'cuad') return [cl.reduce((s, q) => s + q.w * q.x, 0) / W, cl.reduce((s, q) => s + q.w * q.y, 0) / W];
    if (m === 'manh') return [mediana(cl.map((q) => q.x), cl.map((q) => q.w)), mediana(cl.map((q) => q.y), cl.map((q) => q.w))];
    let p = optimo('cuad', cl);
    for (let k = 0; k < 800; k++) {
      // Si el iterado cae sobre un cliente, se comprueba la condición de optimalidad allí.
      const en = cl.findIndex((q) => Math.hypot(p[0] - q.x, p[1] - q.y) < 1e-9);
      if (en >= 0 && fuerzaSin(cl, en, p) <= cl[en].w + 1e-9) return p;
      p = weiszfeldPaso(p, cl);
    }
    return p;
  }
  // Norma de Σ_{j≠i} w_j u_j (condición de optimalidad cuando la instalación coincide con el cliente i).
  function fuerzaSin(cl, i, p) {
    let fx = 0, fy = 0;
    cl.forEach((q, j) => { if (j === i) return; const d = Math.hypot(q.x - p[0], q.y - p[1]); if (d > 1e-12) { fx += (q.w * (q.x - p[0])) / d; fy += (q.w * (q.y - p[1])) / d; } });
    return Math.hypot(fx, fy);
  }
  function fuerza(p, cl = estado.clientes) {
    let fx = 0, fy = 0;
    for (const q of cl) { const d = Math.hypot(q.x - p[0], q.y - p[1]); if (d > 1e-12) { fx += (q.w * (q.x - p[0])) / d; fy += (q.w * (q.y - p[1])) / d; } }
    return [fx, fy];
  }
  const radio = (w) => 9 + 2 * w;
  function dibujarClientes(ctx, plano, sel) {
    estado.clientes.forEach((c, i) => {
      const x = plano.sx(c.x), y = plano.sy(c.y);
      ctx.fillStyle = C.tinta; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(x - radio(c.w) / 1.4, y - radio(c.w) / 1.4, (2 * radio(c.w)) / 1.4, (2 * radio(c.w)) / 1.4); ctx.fill(); ctx.stroke();
      if (sel && i === estado.sel) { ctx.strokeStyle = C.s7; ctx.lineWidth = 2.5; ctx.strokeRect(x - radio(c.w) / 1.4 - 4, y - radio(c.w) / 1.4 - 4, (2 * radio(c.w)) / 1.4 + 8, (2 * radio(c.w)) / 1.4 + 8); }
      ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(c.w), x, y + 0.5);
    });
  }
  const clienteCerca = (plano, x, y) => estado.clientes.findIndex((c) => Math.hypot(plano.sx(c.x) - x, plano.sy(c.y) - y) < radio(c.w) + 4);

  /* ---------- Fig. 1: ubicar la instalación según la métrica ---------- */

  function montarUbicacion(cuerpo) {
    let met = 'euc', modo = 'probar', T = [5, 4], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Métrica de distancia', opciones: OPC_MET, valor: met, alCambiar: (v) => { met = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Un clic en vacío…', opciones: [['probar', 'coloca la instalación de prueba'], ['agregar', 'agrega un cliente']], valor: modo, alCambiar: (v) => { modo = v; } });
    const rPeso = ctl.rango({ etiqueta: 'Peso del cliente seleccionado', min: 1, max: 10, valor: estado.clientes[0].w, alCambiar: (v) => { estado.clientes[estado.sel].w = v; avisar(); } });
    ctl.boton('Nuevos clientes', () => { estado.semilla++; nuevosClientes(); rPeso.valor = estado.clientes[0].w; avisar(); }, { primario: true });
    ctl.boton('Quitar cliente seleccionado', () => { if (estado.clientes.length > 2) { estado.clientes.splice(estado.sel, 1); estado.sel = 0; rPeso.valor = estado.clientes[0].w; avisar(); } });
    ctl.boton('Instalación de prueba al óptimo', () => { T = optimo(met); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(260, Math.min(480, w * 0.8)) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'cliente (el número es su peso)', forma: 'cuadro' },
      ...Object.values(METRICAS).map((m) => ({ color: m.color, texto: `óptimo (${m.corto})`, forma: 'punto' })),
      { color: C.tinta2, texto: 'instalación de prueba (arrástrela)', forma: 'linea' },
      { color: C.apagado, texto: 'curvas de nivel del costo de la métrica elegida', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre un cliente o la instalación de prueba (una cruz). Haga clic en un cliente para elegirlo y cambiar su peso; doble clic lo quita. Observe que el óptimo cuadrático (círculo) se deja llevar por los clientes lejanos, el manhattan (cuadrado) cae sobre una coordenada de cliente y el euclidiano (rombo) queda en medio.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, DOM);
      plano.ejes();
      const op = optimo(met), c0 = costo(met, op);
      ctx.save(); plano.recortar();
      const f = (x, y) => costo(met, [x, y]);
      [0.04, 0.1, 0.2, 0.35, 0.55, 0.8, 1.1, 1.5].forEach((k) => VIZ.ml.contorno(ctx, plano, f, c0 * (1 + k), { color: VIZ.alfa(C.tinta2, 0.5), ancho: 1, paso: 6 }));
      ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.6); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      for (const c of estado.clientes) { ctx.beginPath(); ctx.moveTo(plano.sx(T[0]), plano.sy(T[1])); ctx.lineTo(plano.sx(c.x), plano.sy(c.y)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.restore();
      dibujarClientes(ctx, plano, true);
      for (const [k, m] of Object.entries(METRICAS)) { const p = optimo(k); VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), m.color, 6.5, m.forma); }
      VIZ.marcador(ctx, plano.sx(T[0]), plano.sy(T[1]), C.tinta2, 6, 5);
      void W; void H;
      const cT = costo(met, T);
      const o = { cuad: optimo('cuad'), euc: optimo('euc'), manh: optimo('manh') };
      const sep = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      registro.textContent = `Métrica ${METRICAS[met].corto}: el óptimo está en (${fm(op[0], 3)}, ${fm(op[1], 3)}) con costo ${fm(c0, 4)}. La instalación de prueba cuesta ${fm(cT, 4)} (${c0 > 0 ? fm(((cT - c0) / c0) * 100, 3) : '0'} % más).`;
      lectura.set([
        ['costo en la prueba', fm(cT, 4)],
        ['costo óptimo', fm(c0, 4)],
        ['óptimo cuadrático', `(${fm(o.cuad[0], 3)}, ${fm(o.cuad[1], 3)})`],
        ['óptimo euclidiano', `(${fm(o.euc[0], 3)}, ${fm(o.euc[1], 3)})`],
        ['óptimo manhattan', `(${fm(o.manh[0], 3)}, ${fm(o.manh[1], 3)})`],
        ['separación cuad.–euc.', fm(sep(o.cuad, o.euc), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    estado.oyentes.push(dibujar);
    let arr = null;
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano) return;
      const i = clienteCerca(plano, x, y);
      lienzo.canvas.setPointerCapture(ev.pointerId);
      if (i >= 0) { estado.sel = i; rPeso.valor = estado.clientes[i].w; arr = { tipo: 'c', i }; return avisar(); }
      if (!plano.dentro(x, y)) return;
      const p = [plano.ix(x), plano.iy(y)];
      if (modo === 'agregar') { estado.clientes.push({ x: p[0], y: p[1], w: 1 }); estado.sel = estado.clientes.length - 1; rPeso.valor = 1; avisar(); return; }
      T = p; arr = { tipo: 't' }; dibujar();
    });
    lienzo.canvas.addEventListener('pointerup', () => { arr = null; });
    lienzo.canvas.addEventListener('dblclick', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = clienteCerca(plano, x, y);
      if (i >= 0 && estado.clientes.length > 2) { estado.clientes.splice(i, 1); estado.sel = 0; rPeso.valor = estado.clientes[0].w; avisar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano) return;
      const q = [Math.min(DOM[1], Math.max(DOM[0], plano.ix(x))), Math.min(DOM[3], Math.max(DOM[2], plano.iy(y)))];
      if (arr) {
        if (arr.tipo === 'c') { estado.clientes[arr.i].x = q[0]; estado.clientes[arr.i].y = q[1]; avisar(); } else { T = q; dibujar(); }
        return;
      }
      const i = clienteCerca(plano, x, y);
      if (i >= 0) {
        const c = estado.clientes[i], dx = T[0] - c.x, dy = T[1] - c.y;
        return tip.mostrar(x, y, `cliente ${i + 1}<br>posición (${fm(c.x, 3)}, ${fm(c.y, 3)})<br>peso <b>${c.w}</b><br>distancia a la prueba: <b>${fm(met === 'manh' ? Math.abs(dx) + Math.abs(dy) : Math.hypot(dx, dy), 3)}</b>`);
      }
      if (!plano.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `(${fm(plano.ix(x), 3)}, ${fm(plano.iy(y), 3)})<br>costo <b>${fm(costo(met, [plano.ix(x), plano.iy(y)]), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: Weiszfeld frente a descenso de gradiente ---------- */

  function montarWeiszfeld(cuerpo) {
    let metodo = 'weiszfeld', eta = 0.5, S = [8.5, 1.2], x = S.slice(), hist = [], msg = '', plano = null, cstar = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Método', opciones: [['weiszfeld', 'Weiszfeld (pesos 1/d)'], ['gradiente', 'Gradiente con paso fijo']], valor: metodo, alCambiar: (v) => { metodo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Paso η del gradiente', min: 0.05, max: 2, paso: 0.05, valor: eta, formato: (v) => fm(v, 3), alCambiar: (v) => { eta = v; if (metodo === 'gradiente') rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos clientes', () => { estado.semilla++; nuevosClientes(); avisar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(260, Math.min(480, w * 0.8)) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'cliente', forma: 'cuadro' },
      { color: C.s1, texto: 'trayectoria del método', forma: 'linea' },
      { color: C.s4, texto: 'tirón wᵢ·uᵢ de cada cliente', forma: 'linea' },
      { color: C.s8, texto: 'resultante Σ wᵢuᵢ (= −∇f)', forma: 'linea' },
      { color: C.s6, texto: 'óptimo euclidiano', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Exceso de costo f(xₖ) − f* (escala logarítmica)');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.26, altoMin: 170, altoMax: 240 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'f(xₖ) − f*', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el mapa para elegir el punto inicial. Las flechas amarillas son los tirones de los clientes y la roja su suma: se anula en el óptimo (equilibrio de fuerzas). Con gradiente de paso fijo grande el iterado oscila alrededor del óptimo; Weiszfeld converge sin elegir paso.');

    function iniciar() {
      x = S.slice(); hist = [costo('euc', x) - cstar];
      cstar = costo('euc', optimo('euc'));
      hist = [costo('euc', x) - cstar];
      msg = `Inicio en (${fm(x[0], 3)}, ${fm(x[1], 3)}). Costo ${fm(costo('euc', x), 4)}; el óptimo cuesta ${fm(cstar, 4)}.`;
      return (function* () {
        for (let k = 0; k < 120; k++) {
          const F = fuerza(x), nf = Math.hypot(F[0], F[1]);
          const en = estado.clientes.findIndex((q) => Math.hypot(x[0] - q.x, x[1] - q.y) < 1e-6);
          if (en >= 0 && fuerzaSin(estado.clientes, en, x) <= estado.clientes[en].w) { msg = `La instalación está sobre el cliente ${en + 1} y la fuerza de los demás (${fm(fuerzaSin(estado.clientes, en, x), 3)}) no supera su peso (${estado.clientes[en].w}): óptimo en un cliente.`; yield; return; }
          if (nf < 1e-7) { msg = `‖Σ wᵢuᵢ‖ = ${fm(nf, 2)}: equilibrio de fuerzas, óptimo alcanzado.`; yield; return; }
          if (metodo === 'weiszfeld') x = weiszfeldPaso(x);
          else { const W = estado.clientes.reduce((s, q) => s + q.w, 0); x = [x[0] + (eta * F[0]) / W, x[1] + (eta * F[1]) / W]; }
          hist.push(Math.max(costo('euc', x) - cstar, 0));
          msg = `Paso ${k + 1}: ${metodo === 'weiszfeld' ? 'x ← Σ(wᵢcᵢ/dᵢ) / Σ(wᵢ/dᵢ)' : 'x ← x − η∇f/W'}; la fuerza neta pasó a ${fm(Math.hypot(...fuerza(x)), 3)}.`;
          trayectoria.push(x.slice());
          yield;
        }
        msg = 'Se agotaron los 120 pasos.';
      })();
    }
    let trayectoria = [];
    const iniciarOrig = iniciar;
    void iniciarOrig;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, DOM);
      plano.ejes();
      if (!trayectoria.length || (hist.length === 1)) trayectoria = [x.slice()];
      const op = optimo('euc');
      ctx.save(); plano.recortar();
      const f = (a, b) => costo('euc', [a, b]);
      [0.02, 0.05, 0.1, 0.2, 0.35, 0.55, 0.8, 1.1, 1.5].forEach((k) => VIZ.ml.contorno(ctx, plano, f, cstar * (1 + k), { color: VIZ.alfa(C.tinta2, 0.5), ancho: 1, paso: 6 }));
      VIZ.trazar(ctx, plano, [S, ...trayectoria.slice(1)], C.s1, 2);
      trayectoria.forEach(([a, b]) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(plano.sx(a), plano.sy(b), 2.4, 0, 7); ctx.fill(); });
      // Tirones
      const wmax = Math.max(...estado.clientes.map((q) => q.w));
      let fx = 0, fy = 0;
      for (const q of estado.clientes) {
        const d = Math.hypot(q.x - x[0], q.y - x[1]);
        if (d < 1e-9) continue;
        const L = (14 + 30 * q.w / wmax);
        flecha(ctx, plano.sx(x[0]), plano.sy(x[1]), plano.sx(x[0]) + (L * (q.x - x[0])) / d, plano.sy(x[1]) - (L * (q.y - x[1])) / d, C.s4, 2);
        fx += (q.w * (q.x - x[0])) / d; fy += (q.w * (q.y - x[1])) / d;
      }
      const nf = Math.hypot(fx, fy);
      if (nf > 1e-6) flecha(ctx, plano.sx(x[0]), plano.sy(x[1]), plano.sx(x[0]) + (fx / 1) * 6, plano.sy(x[1]) - (fy / 1) * 6, C.s8, 3);
      ctx.restore();
      dibujarClientes(ctx, plano, false);
      VIZ.marcador(ctx, plano.sx(op[0]), plano.sy(op[1]), C.s6, 5.5);
      VIZ.marcador(ctx, plano.sx(x[0]), plano.sy(x[1]), C.tinta2, 5.5, 5);
      registro.textContent = msg;
      lectura.set([
        ['iteración', String(hist.length - 1)],
        ['costo f(x)', fm(costo('euc', x), 5)],
        ['exceso f − f*', fm(Math.max(costo('euc', x) - cstar, 0), 3)],
        ['‖Σ wᵢuᵢ‖ = ‖∇f‖', fm(nf, 3)],
        ['x', `(${fm(x[0], 4)}, ${fm(x[1], 4)})`],
      ]);
      dibujarCosto();
    }
    let plano2 = null;
    function dibujarCosto() {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const n = Math.max(8, hist.length), mx = Math.max(...hist, 1e-6);
      plano2 = VIZ.plano(lienzo2, { xmin: 0, xmax: n - 1, ymin: 1e-10, ymax: mx * 3 }, { logY: true, etiquetaX: 'iteración k', etiquetaY: 'f − f*' });
      plano2.ejes();
      ctx.save(); plano2.recortar();
      VIZ.trazar(ctx, plano2, hist.map((v, k) => [k, Math.max(v, 1e-11)]), C.s1, 2);
      hist.forEach((v, k) => VIZ.marcador(ctx, plano2.sx(k), plano2.sy(Math.max(v, 1e-11)), C.s1, 3));
      ctx.restore();
    }
    // La trayectoria se reinicia junto con el generador.
    const iniciarBase = iniciar;
    void iniciarBase;
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = dibujarCosto;
    estado.oyentes.push(() => { trayectoria = []; rep.reiniciar(); });
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo2.posicion(ev);
      if (!plano2 || !plano2.dentro(mx, my)) return tip2.ocultar();
      const k = Math.round(plano2.ix(mx));
      if (k < 0 || k >= hist.length) return tip2.ocultar();
      tip2.mostrar(mx, my, `k = <b>${k}</b><br>f − f* = <b>${fm(hist[k], 3)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(mx, my)) return;
      S = [plano.ix(mx), plano.iy(my)]; trayectoria = [];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(mx, my)) return tip.ocultar();
      const p = [plano.ix(mx), plano.iy(my)];
      tip.mostrar(mx, my, `(${fm(p[0], 3)}, ${fm(p[1], 3)})<br>costo <b>${fm(costo('euc', p), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('facility-location', {
    intro: String.raw`
      <p>Una empresa debe decidir dónde instalar un almacén, un hospital o una antena para atender a varios clientes repartidos en el plano. Si cada cliente
      pesa distinto (más pedidos, más habitantes) y el costo crece con la distancia, ubicar la instalación es un problema de optimización no lineal sin restricciones en dos variables:
      minimizar la suma ponderada de distancias.</p>
      <p>La respuesta depende de <strong>cómo se mide la distancia</strong>. Con distancias al cuadrado el óptimo es el centroide ponderado, que se deja arrastrar por los clientes lejanos.
      Con distancias euclidianas es la <em>mediana geométrica</em>, más robusta, que no tiene fórmula cerrada pero se calcula con el algoritmo de Weiszfeld. Con distancias
      manhattan (calles en cuadrícula) el problema se separa por coordenadas y el óptimo es la mediana ponderada de cada una.</p>`,
    visualizaciones: [
      {
        titulo: 'Ubicar la instalación según la métrica',
        descripcion: 'Mueva clientes, cambie sus pesos y compare los tres óptimos (círculo, rombo y cuadrado). Arrastre la instalación de prueba y vea su costo frente al óptimo. Pruebe aumentar mucho el peso de un cliente: el óptimo euclidiano se pega a él y el manhattan salta a su coordenada.',
        montar: montarUbicacion,
      },
      {
        titulo: 'Algoritmo de Weiszfeld y equilibrio de fuerzas',
        descripcion: 'Ejecute Weiszfeld paso a paso con los clientes de la figura 1. Las flechas amarillas son los tirones \\(w_i u_i\\) y la roja su suma, que se anula en el óptimo. Cambie a gradiente de paso fijo y suba \\(\\eta\\): el iterado oscila y no converge.',
        montar: montarWeiszfeld,
      },
    ],
    teoria: String.raw`
      <h2>El problema</h2>
      <p>Dados clientes \(c_1,\dots,c_n\in\mathbb{R}^2\) con pesos \(w_i&gt;0\), se busca \(x\in\mathbb{R}^2\) que minimice</p>
      \[ f(x)=\sum_{i=1}^n w_i\, \phi(x-c_i), \]
      <p>donde \(\phi\) es una norma o su cuadrado. Todas las versiones son funciones convexas, de modo que un punto estacionario es mínimo global.</p>

      <h2>Distancia cuadrada: centroide</h2>
      <p>Con \(\phi(d)=\|d\|^2\), \(\nabla f(x)=2\sum w_i(x-c_i)=0\) da</p>
      \[ x^*=\frac{\sum_i w_i c_i}{\sum_i w_i}. \]
      <p>La Hessiana es \(2(\sum w_i)I\succ0\): el mínimo es único. Es el promedio ponderado, sensible a clientes lejanos.</p>

      <h2>Distancia euclidiana: mediana geométrica</h2>
      <p>Con \(\phi(d)=\|d\|\), fuera de los clientes \(\nabla f(x)=\sum_i w_i\dfrac{x-c_i}{\|x-c_i\|}\). La condición \(\nabla f=0\) es un <strong>equilibrio de fuerzas</strong>:
      cada cliente tira con fuerza \(w_i\) hacia él (vector unitario \(u_i\)) y la resultante \(\sum w_iu_i\) debe ser nula (problema de Varignon-Fermat-Weber). Si la instalación coincide con el cliente \(k\), \(f\) no es diferenciable allí y la condición se vuelve</p>
      \[ \Big\| \sum_{i\neq k} w_i u_i \Big\| \le w_k, \]
      <p>es decir, el cliente \(k\) «gana» si los demás no pueden arrancarlo de su sitio. Si no hay empate, el óptimo es único salvo que todos los clientes sean colineales.</p>

      <h3>Algoritmo de Weiszfeld</h3>
      <pre><code>x ← centroide
repetir hasta que ‖Σ wᵢuᵢ‖ &lt; ε:
    dᵢ ← ‖x − cᵢ‖
    x ← (Σ wᵢ cᵢ / dᵢ) / (Σ wᵢ / dᵢ)</code></pre>
      <p>Es un promedio ponderado con pesos \(w_i/d_i\): se obtiene igualando a cero el gradiente con los pesos «congelados». Equivale a un descenso de gradiente con paso variable
      \(1/\sum(w_i/d_i)\), y \(f(x_k)\) decrece monótonamente (es un caso de algoritmo MM). Converge al óptimo salvo que un iterado caiga exactamente sobre un cliente; la figura 2 contrasta esto con el
      <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a> de paso fijo, que en una función no suave como esta no converge: su paso no se achica cerca del óptimo, donde el gradiente tiene norma sin tender a cero en los clientes.</p>

      <h2>Distancia manhattan: mediana</h2>
      <p>Con \(\phi(d)=|d_1|+|d_2|\), el costo se separa: \(f(x)=\sum w_i|x_1-c_{i1}|+\sum w_i|x_2-c_{i2}|\). Cada suma se minimiza en una <em>mediana ponderada</em>: la coordenada \(m\) tal que el peso a cada lado es a lo más la mitad del total.
      Por eso el óptimo manhattan cae sobre las coordenadas de clientes (y puede no ser único si el peso está exactamente a la mitad).</p>

      <h2>Comparación</h2>
      <table>
        <tr><th>Costo</th><th>Óptimo</th><th>Cálculo</th><th>Sensibilidad a clientes lejanos</th></tr>
        <tr><td>\(\sum w_i\|x-c_i\|^2\)</td><td>centroide</td><td>fórmula cerrada</td><td>alta</td></tr>
        <tr><td>\(\sum w_i\|x-c_i\|\)</td><td>mediana geométrica</td><td>Weiszfeld (iterativo)</td><td>media</td></tr>
        <tr><td>\(\sum w_i\|x-c_i\|_1\)</td><td>mediana por coordenada</td><td>ordenar y acumular pesos</td><td>baja</td></tr>
      </table>

      <h2>Conexiones</h2>
      <p>Es un problema sin restricciones cuyo óptimo cumple \(\nabla f=0\), como en las <a href="tema.html?id=unconstrained-optimality-conditions">condiciones de optimalidad</a>; la convexidad de \(f\) garantiza que es global
      (véase <a href="tema.html?id=convex-sets-functions">conjuntos y funciones convexos</a>). Con la métrica manhattan se puede escribir como programa lineal, y con varias instalaciones y asignación de clientes
      aparecen los modelos de <a href="tema.html?id=transportation-problem">transporte</a> y la ubicación discreta con variables binarias (<a href="tema.html?id=problem-classes">LP, ILP, MILP y NLP</a>).</p>`,
  });
})();
