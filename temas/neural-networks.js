(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const M = VIZ.ml;

  /* ---------- Fig. 1: el perceptrón ---------- */

  function montarPerceptron(cuerpo) {
    let tipo = 'lineal', semilla = 3, pts = [], w = [0, 0, 0], epoca = 0, actualizaciones = 0, errores = 0, actual = null, corrigio = false, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: [['lineal', 'Separable linealmente'], ['manchas', 'Dos manchas (con superposición)'], ['xor', 'XOR']], valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 420 });
    VIZ.leyenda(cuerpo, [
      ...M.leyendaClases(2, ['y = −1', 'y = +1']),
      { color: C.tinta, texto: 'frontera w·x + b = 0', forma: 'linea' },
      { color: C.superficie, borde: C.s2, texto: 'ejemplo que se revisa', forma: 'punto' },
      { color: C.superficie, borde: C.s8, texto: 'mal clasificado: se corrige w', forma: 'punto' },
      { color: C.s7, texto: 'vector w', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso revisa un ejemplo. Si está bien clasificado no pasa nada; si no, se suma y·x a los pesos y la frontera gira hacia él.');

    function datos() { pts = M.datos(tipo, 40, tipo === 'manchas' ? 0.3 : 0.05, semilla * 3); rep.reiniciar(); }
    const s = (q) => w[0] * q.x + w[1] * q.y + w[2];
    function iniciar() {
      w = [0, 0, 0]; epoca = 0; actualizaciones = 0; errores = 0; actual = null; corrigio = false;
      mensaje = 'Los pesos parten en cero.';
      return (function* () {
        for (epoca = 1; epoca <= 30; epoca++) {
          errores = 0;
          for (const q of pts) {
            actual = q;
            const y = q.c ? 1 : -1;
            corrigio = y * s(q) <= 0;
            if (corrigio) {
              w = [w[0] + y * q.x, w[1] + y * q.y, w[2] + y];
              errores++; actualizaciones++;
              mensaje = `Época ${epoca}: el ejemplo (${VIZ.fmt(q.x, 2)}, ${VIZ.fmt(q.y, 2)}) con y = ${y > 0 ? '+1' : '−1'} estaba mal clasificado: w ← w ${y > 0 ? '+' : '−'} x.`;
            } else mensaje = `Época ${epoca}: el ejemplo (${VIZ.fmt(q.x, 2)}, ${VIZ.fmt(q.y, 2)}) ya está bien clasificado.`;
            yield;
          }
          if (!errores) { actual = null; mensaje = `Convergió: en la época ${epoca} no hubo errores. ${actualizaciones} correcciones en total.`; return; }
        }
        actual = null;
        mensaje = 'Tras 30 épocas sigue habiendo errores: los datos no son separables linealmente y el perceptrón no converge.';
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const p = M.plano(lienzo);
      if (w.some((v) => v)) M.regiones(ctx, p, (x, y) => M.sigmoide(4 * (w[0] * x + w[1] * y + w[2])), { intensidad: 0.2 });
      p.ejes();
      ctx.save();
      p.recortar();
      if (w[0] || w[1]) {
        M.contorno(ctx, p, (x, y) => w[0] * x + w[1] * y + w[2], 0, { color: C.tinta, ancho: 2.5 });
        const n = Math.hypot(w[0], w[1]), e = 0.5 / n;
        const x0 = p.sx(0), y0 = p.sy(0), x1 = p.sx(w[0] * e), y1 = p.sy(w[1] * e);
        ctx.strokeStyle = C.s7; ctx.fillStyle = C.s7; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        const a = Math.atan2(y1 - y0, x1 - x0);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4)); ctx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4)); ctx.fill();
      }
      ctx.restore();
      M.puntos(ctx, p, pts, { anillo: (q) => (q === actual ? (corrigio ? C.s8 : C.s2) : null) });
      registro.textContent = mensaje;
      lectura.set([
        ['época', String(epoca)],
        ['correcciones', String(actualizaciones)],
        ['errores en la época', String(errores)],
        ['w', `(${VIZ.fmt(w[0], 3)}, ${VIZ.fmt(w[1], 3)})`],
        ['b', VIZ.fmt(w[2], 3)],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    datos();
  }

  /* ---------- Fig. 2: perceptrón multicapa ---------- */

  const ACT = {
    tanh: { f: Math.tanh, d: (a) => 1 - a * a },
    relu: { f: (z) => (z > 0 ? z : 0), d: (a) => (a > 0 ? 1 : 0) },
  };

  function crearRed(tam, rnd) {
    const capas = [];
    for (let l = 1; l < tam.length; l++) {
      const esc = Math.sqrt(2 / (tam[l - 1] + tam[l]));
      capas.push({
        W: Array.from({ length: tam[l] }, () => Array.from({ length: tam[l - 1] }, () => VIZ.normal(rnd) * esc)),
        b: new Array(tam[l]).fill(0),
      });
    }
    // Estado de Adam
    for (const c of capas) {
      c.mW = c.W.map((f) => f.map(() => 0)); c.vW = c.W.map((f) => f.map(() => 0));
      c.mb = c.b.map(() => 0); c.vb = c.b.map(() => 0);
    }
    return capas;
  }
  function adelante(red, act, x) {
    const as = [x];
    red.forEach((c, l) => {
      const a = as[l], ult = l === red.length - 1;
      as.push(c.W.map((f, i) => { let z = c.b[i]; for (let j = 0; j < f.length; j++) z += f[j] * a[j]; return ult ? M.sigmoide(z) : ACT[act].f(z); }));
    });
    return as;
  }
  function epocaAdam(red, act, pts, eta, t) {
    const gW = red.map((c) => c.W.map((f) => f.map(() => 0))), gb = red.map((c) => c.b.map(() => 0));
    let perdida = 0;
    for (const q of pts) {
      const as = adelante(red, act, [q.x, q.y]);
      const p = as[as.length - 1][0];
      perdida -= q.c ? Math.log(Math.max(1e-12, p)) : Math.log(Math.max(1e-12, 1 - p));
      let delta = [p - q.c]; // derivada de la entropía cruzada respecto de z de salida
      for (let l = red.length - 1; l >= 0; l--) {
        const a = as[l], c = red[l];
        for (let i = 0; i < delta.length; i++) { gb[l][i] += delta[i]; for (let j = 0; j < a.length; j++) gW[l][i][j] += delta[i] * a[j]; }
        if (l > 0) delta = a.map((aj, j) => { let s = 0; for (let i = 0; i < delta.length; i++) s += c.W[i][j] * delta[i]; return s * ACT[act].d(aj); });
      }
    }
    const n = pts.length, b1 = 0.9, b2 = 0.999;
    const paso = (val, g, m, v, i, j) => {
      const gr = g / n;
      m[i][j] = b1 * m[i][j] + (1 - b1) * gr;
      v[i][j] = b2 * v[i][j] + (1 - b2) * gr * gr;
      return val - (eta * (m[i][j] / (1 - Math.pow(b1, t)))) / (Math.sqrt(v[i][j] / (1 - Math.pow(b2, t))) + 1e-8);
    };
    red.forEach((c, l) => {
      c.W = c.W.map((f, i) => f.map((v, j) => paso(v, gW[l][i][j], c.mW, c.vW, i, j)));
      const mb = [c.mb], vb = [c.vb];
      c.b = c.b.map((v, i) => paso(v, gb[l][i], mb, vb, 0, i));
    });
    return perdida / n;
  }

  function montarMLP(cuerpo) {
    let tipo = 'circulos', ocultas = 6, nCapas = 1, act = 'tanh', eta = 0.03, semilla = 1;
    let tr = [], va = [], red = null, epoca = 0, hist = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS.filter(([k]) => k !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; datos(); } });
    ctl.rango({ etiqueta: 'Neuronas por capa oculta', min: 1, max: 16, valor: ocultas, alCambiar: (v) => { ocultas = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Capas ocultas', min: 1, max: 2, valor: nCapas, alCambiar: (v) => { nCapas = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Activación', opciones: [['tanh', 'tanh'], ['relu', 'ReLU']], valor: act, alCambiar: (v) => { act = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje (Adam)', min: 0.005, max: 0.1, paso: 0.005, valor: eta, formato: (v) => v.toFixed(3), alCambiar: (v) => { eta = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); });

    const cols = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const a = el('div'), b = el('div');
    cols.append(a, b);
    VIZ.subtitulo(a, 'Salida de la red y frontera P = 0.5');
    const l1 = VIZ.lienzo(a, { proporcion: 0.85, altoMin: 260, altoMax: 380 });
    VIZ.subtitulo(b, 'Pesos de la red');
    const l2 = VIZ.lienzo(b, { proporcion: 0.5, altoMin: 170, altoMax: 220 });
    VIZ.subtitulo(b, 'Pérdida por época');
    const l3 = VIZ.lienzo(b, { proporcion: 0.3, altoMin: 120, altoMax: 150 });
    VIZ.leyenda(cuerpo, [
      ...M.leyendaClases(2, ['y = 0', 'y = 1']),
      { color: C.s1, texto: 'peso positivo', forma: 'linea' },
      { color: C.s8, texto: 'peso negativo', forma: 'linea' },
      { color: C.tinta, texto: 'pérdida de entrenamiento', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso son 10 épocas de retropropagación con todos los ejemplos. El grosor de cada conexión es proporcional al valor absoluto de su peso.');

    function datos() { ({ entrenamiento: tr, validacion: va } = M.partir(M.datos(tipo, 200, 0.2, semilla * 11), 0.7, semilla)); rep.reiniciar(); }
    const tam = () => [2, ...new Array(nCapas).fill(ocultas), 1];
    const prob = (x, y) => { const as = adelante(red, act, [x, y]); return as[as.length - 1][0]; };
    const exact = (pts) => pts.filter((q) => (prob(q.x, q.y) > 0.5 ? 1 : 0) === q.c).length / pts.length;
    function iniciar() {
      red = crearRed(tam(), VIZ.semilla(semilla * 101 + ocultas * 7 + nCapas));
      epoca = 0;
      hist = [];
      return (function* () {
        for (let k = 0; k < 300; k++) {
          let L = 0;
          for (let e = 0; e < 10; e++) { epoca++; L = epocaAdam(red, act, tr, eta, epoca); }
          hist.push([epoca, L]);
          yield;
        }
      })();
    }
    function dibujar() {
      if (!red) return;
      let ctx = l1.ctx;
      l1.limpiar();
      const p1 = M.plano(l1);
      M.regiones(ctx, p1, prob);
      p1.ejes();
      if (epoca) M.contorno(ctx, p1, prob, 0.5, { color: C.tinta, ancho: 2 });
      M.puntos(ctx, p1, tr, { r: 3.2 });
      M.puntos(ctx, p1, va, { r: 3.2, hueco: () => true });

      // Diagrama de la red
      ctx = l2.ctx;
      l2.limpiar();
      const T = tam(), W = l2.ancho, H = l2.alto;
      const pos = T.map((n, l) => Array.from({ length: n }, (_, i) => ({ x: 24 + (l * (W - 48)) / (T.length - 1), y: H / 2 + (i - (n - 1) / 2) * Math.min(22, (H - 24) / Math.max(1, n - 1 || 1)) })));
      const maxW = Math.max(0.01, ...red.flatMap((c) => c.W.flat().map(Math.abs)));
      red.forEach((c, l) => c.W.forEach((f, i) => f.forEach((v, j) => {
        ctx.strokeStyle = v > 0 ? C.s1 : C.s8;
        ctx.globalAlpha = 0.25 + 0.75 * Math.abs(v) / maxW;
        ctx.lineWidth = 0.5 + 3.5 * Math.abs(v) / maxW;
        ctx.beginPath(); ctx.moveTo(pos[l][j].x, pos[l][j].y); ctx.lineTo(pos[l + 1][i].x, pos[l + 1][i].y); ctx.stroke();
      })));
      ctx.globalAlpha = 1;
      pos.forEach((capa, l) => capa.forEach((q) => {
        ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.stroke();
      }));
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center';
      ctx.fillText('entrada', pos[0][0].x, H - 4);
      ctx.fillText('salida', pos[T.length - 1][0].x, H - 4);

      ctx = l3.ctx;
      l3.limpiar();
      const p3 = VIZ.plano(l3, { xmin: 0, xmax: Math.max(200, epoca), ymin: 0, ymax: 0.8 }, { margen: { izq: 40, inf: 22, sup: 8 } });
      p3.ejes();
      VIZ.trazar(ctx, p3, [[0, Math.LN2], ...hist], C.tinta, 2);

      const params = red.reduce((s, c) => s + c.W.length * c.W[0].length + c.b.length, 0);
      registro.textContent = epoca === 0 ? 'Pesos iniciales al azar: la salida es casi constante.'
        : `Época ${epoca}: cada neurona oculta dibuja una frontera ${act === 'relu' ? 'quebrada' : 'suave'}; la capa de salida las combina.`;
      lectura.set([
        ['época', String(epoca)],
        ['pérdida', hist.length ? VIZ.fmt(hist[hist.length - 1][1], 3) : VIZ.fmt(Math.LN2, 3)],
        ['exactitud entrenamiento', `${Math.round(100 * exact(tr))} %`],
        ['exactitud validación', `${Math.round(100 * exact(va))} %`],
        ['parámetros', String(params)],
      ]);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar; l3.alDibujar = dibujar;
    datos();
  }

  /* ---------- Fig. 3: la convolución ---------- */

  const N = 12, K3 = 3, NO = N - 2, NP = NO / 2;
  const IMAGENES = {
    L: (f, c) => (c >= 3 && c <= 4 && f >= 2 && f <= 9) || (f >= 8 && f <= 9 && c >= 3 && c <= 8),
    cuadro: (f, c) => f >= 3 && f <= 8 && c >= 3 && c <= 8 && (f <= 4 || f >= 7 || c <= 4 || c >= 7),
    diagonal: (f, c) => Math.abs(f - c) <= 1,
    cruz: (f, c) => (f >= 5 && f <= 6) || (c >= 5 && c <= 6),
  };
  const KERNELS = {
    vertical: { nombre: 'Borde vertical', k: [[1, 0, -1], [1, 0, -1], [1, 0, -1]] },
    horizontal: { nombre: 'Borde horizontal', k: [[1, 1, 1], [0, 0, 0], [-1, -1, -1]] },
    diagonal: { nombre: 'Diagonal', k: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] },
    laplaciano: { nombre: 'Laplaciano (contornos)', k: [[0, -1, 0], [-1, 4, -1], [0, -1, 0]] },
    promedio: { nombre: 'Desenfoque (promedio)', k: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]] },
  };

  function montarConvolucion(cuerpo) {
    let imagen = 'L', kernel = 'vertical', relu = true, img = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: [['L', 'Letra L'], ['cuadro', 'Cuadrado'], ['diagonal', 'Diagonal'], ['cruz', 'Cruz']], valor: imagen, alCambiar: (v) => { imagen = v; cargar(); } });
    ctl.selector({ etiqueta: 'Filtro (kernel 3 × 3)', opciones: Object.entries(KERNELS).map(([c, v]) => [c, v.nombre]), valor: kernel, alCambiar: (v) => { kernel = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Aplicar ReLU', valor: relu, alCambiar: (v) => { relu = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 10 });

    const geo = () => {
      const W = lienzo ? lienzo.ancho : 600, gaps = 4 * 22;
      const cel = Math.max(7, Math.min(22, Math.floor((W - gaps) / (N + K3 + NO + NP))));
      return { cel, x: [10, 10 + N * cel + 22, 10 + (N + K3) * cel + 44, 10 + (N + K3 + NO) * cel + 66], y: 22 };
    };
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const g = Math.max(7, Math.min(22, Math.floor((w - 88) / (N + K3 + NO + NP)))); return 22 + N * g + 12; } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'píxel encendido' },
      { color: VIZ.alfa(C.s1, 0.7), texto: 'respuesta positiva' },
      { color: VIZ.alfa(C.s8, 0.7), texto: 'respuesta negativa' },
      { color: C.superficie, borde: C.s2, texto: 'campo receptivo y salida actual' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un píxel de la imagen para encenderlo o apagarlo. Con «Reproducir» la ventana de 3 × 3 recorre la imagen; «Hasta el final» calcula todo el mapa.');

    function cargar() {
      img = Array.from({ length: N }, (_, f) => Array.from({ length: N }, (_, c) => (IMAGENES[imagen](f, c) ? 1 : 0)));
      rep.reiniciar();
    }
    const conv = (f, c) => { let s = 0; const kk = KERNELS[kernel].k; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += kk[i][j] * img[f + i][c + j]; return s; };
    let salida = [];
    function iniciar() {
      salida = Array.from({ length: NO }, () => new Array(NO).fill(null));
      k = -1;
      return (function* () {
        for (k = 0; k < NO * NO; k++) { const f = Math.floor(k / NO), c = k % NO; salida[f][c] = conv(f, c); yield; }
        k = NO * NO;
      })();
    }
    const valor = (v) => (v == null ? null : relu ? Math.max(0, v) : v);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const g = geo(), cel = g.cel, kk = KERNELS[kernel].k;
      const titulo = (t, x) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, 14); };
      const maxAbs = Math.max(1e-9, ...salida.flat().filter((v) => v != null).map((v) => Math.abs(valor(v))));
      const celda = (x, y, v, escala, borde = C.rejilla) => {
        ctx.fillStyle = v == null ? C.neutro : v > 0 ? VIZ.alfa(C.s1, 0.15 + 0.85 * Math.min(1, v / escala)) : v < 0 ? VIZ.alfa(C.s8, 0.15 + 0.85 * Math.min(1, -v / escala)) : C.superficie;
        ctx.fillRect(x, y, cel, cel);
        ctx.strokeStyle = borde; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cel - 1, cel - 1);
      };
      // Entrada
      titulo(`entrada ${N}×${N}`, g.x[0]);
      for (let f = 0; f < N; f++) for (let c = 0; c < N; c++) {
        ctx.fillStyle = img[f][c] ? C.tinta : C.superficie;
        ctx.fillRect(g.x[0] + c * cel, g.y + f * cel, cel, cel);
        ctx.strokeStyle = C.rejilla; ctx.strokeRect(g.x[0] + c * cel + 0.5, g.y + f * cel + 0.5, cel - 1, cel - 1);
      }
      // Kernel
      titulo('filtro', g.x[1]);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        celda(g.x[1] + j * cel, g.y + i * cel, kk[i][j], Math.max(...kk.flat().map(Math.abs)));
        if (cel >= 18) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Number.isInteger(kk[i][j]) ? String(kk[i][j]).replace('-', '−') : '⅑', g.x[1] + j * cel + cel / 2, g.y + i * cel + cel / 2); }
      }
      // Mapa de activación
      titulo(`mapa ${NO}×${NO}`, g.x[2]);
      for (let f = 0; f < NO; f++) for (let c = 0; c < NO; c++) celda(g.x[2] + c * cel, g.y + f * cel, valor(salida[f] && salida[f][c]), maxAbs);
      // Max-pooling 2 × 2
      titulo(`máx 2×2 → ${NP}×${NP}`, g.x[3]);
      for (let f = 0; f < NP; f++) for (let c = 0; c < NP; c++) {
        const vs = [salida[2 * f][2 * c], salida[2 * f][2 * c + 1], salida[2 * f + 1][2 * c], salida[2 * f + 1][2 * c + 1]];
        celda(g.x[3] + c * cel, g.y + f * cel, vs.some((v) => v == null) ? null : Math.max(...vs.map(valor)), maxAbs);
      }
      // Ventana actual
      if (k >= 0 && k < NO * NO) {
        const f = Math.floor(k / NO), c = k % NO;
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5;
        ctx.strokeRect(g.x[0] + c * cel, g.y + f * cel, 3 * cel, 3 * cel);
        ctx.strokeRect(g.x[2] + c * cel, g.y + f * cel, cel, cel);
        const v = salida[f][c];
        registro.textContent = `Posición (${f}, ${c}): suma de los 9 productos píxel × peso = ${VIZ.fmt(v, 3)}` + (relu ? `; tras ReLU, ${VIZ.fmt(Math.max(0, v), 3)}.` : '.');
      } else registro.textContent = k >= NO * NO ? `Mapa completo: el filtro «${KERNELS[kernel].nombre}» responde fuerte donde la imagen se parece a él.` : 'Pulse «Un paso» o «Reproducir» para deslizar el filtro.';
      lectura.set([
        ['pesos del filtro', '9 + 1 sesgo'],
        ['salidas del mapa', String(NO * NO)],
        ['capa densa equivalente', `${VIZ.entero(N * N * NO * NO)} pesos`],
        ['campo receptivo tras el pooling', '4 × 4 píxeles'],
      ]);
    }
    lienzo.alDibujar = () => img.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo();
      const c = Math.floor((x - g.x[0]) / g.cel), f = Math.floor((y - g.y) / g.cel);
      if (f < 0 || c < 0 || f >= N || c >= N) return;
      img[f][c] = 1 - img[f][c];
      const termino = k >= NO * NO;
      rep.reiniciar();
      if (termino) { while (rep.paso()); dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo();
      const c = Math.floor((x - g.x[2]) / g.cel), f = Math.floor((y - g.y) / g.cel);
      if (f < 0 || c < 0 || f >= NO || c >= NO || salida[f][c] == null) return tip.ocultar();
      tip.mostrar(x, y, `salida (${f}, ${c}) = <b>${VIZ.fmt(valor(salida[f][c]), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    cargar();
  }

  VIZ.registrarTema('neural-networks', {
    intro: String.raw`
      <p>Una <strong>red neuronal</strong> es una composición de funciones simples. La unidad básica, la <strong>neurona</strong>,
      calcula una suma ponderada de sus entradas y le aplica una función no lineal. El <strong>perceptrón</strong> (Rosenblatt,
      1958) es una sola neurona con salida ±1: un clasificador lineal con una regla de aprendizaje muy simple.</p>
      <p>Una sola neurona solo dibuja fronteras rectas. Apilando capas —el <strong>perceptrón multicapa</strong> (MLP)— la red
      aprende sus propios atributos intermedios y puede aproximar cualquier función continua; sus pesos se ajustan con
      <strong>retropropagación</strong> y descenso de gradiente. Las <strong>redes convolucionales</strong> (CNN) agregan una
      idea clave para imágenes: el mismo filtro pequeño se aplica en todas las posiciones.</p>`,
    visualizaciones: [
      {
        titulo: 'El perceptrón',
        descripcion: 'Con datos separables, el perceptrón termina tras un número finito de correcciones. Con XOR o con clases superpuestas nunca deja de corregir: una frontera recta no basta.',
        montar: montarPerceptron,
      },
      {
        titulo: 'Perceptrón multicapa',
        descripcion: 'Entrene la red en XOR o en círculos: con una neurona oculta falla, con unas pocas basta. Pruebe ReLU (fronteras poligonales) frente a tanh (curvas suaves) y muchas neuronas con pocos datos.',
        montar: montarMLP,
      },
      {
        titulo: 'La convolución',
        descripcion: 'Un filtro de 3 × 3 recorre la imagen y produce un mapa que se enciende donde aparece el patrón. El max-pooling reduce el mapa conservando la respuesta más fuerte de cada bloque.',
        montar: montarConvolucion,
      },
    ],
    teoria: String.raw`
      <h2>El perceptrón</h2>
      <p>Predice \(\hat y = \text{signo}(w^\top x + b)\). Con \(y_i \in \{-1, +1\}\), la regla de aprendizaje es:</p>
      <pre><code>w ← 0;  b ← 0
repetir hasta una época sin errores:
    para cada ejemplo (x_i, y_i):
        si y_i (w·x_i + b) ≤ 0:
            w ← w + y_i x_i;   b ← b + y_i</code></pre>
      <div class="recuadro"><strong>Teorema de convergencia</strong> (Novikoff, 1962). Si \(\lVert x_i \rVert \le R\) y existe
      \(w^*\) unitario con \(y_i\, w^{*\top} x_i \ge \gamma &gt; 0\) para todo \(i\), el perceptrón hace a lo más
      \((R/\gamma)^2\) correcciones. Cada corrección aumenta \(w^\top w^*\) en al menos \(\gamma\) y \(\lVert w \rVert^2\) en a lo más
      \(R^2\); tras \(k\) correcciones, \(k\gamma \le w^\top w^* \le \lVert w \rVert \le \sqrt{k}\,R\).</div>
      <p>Si los datos no son separables, no converge. Minsky y Papert (1969) mostraron que no puede aprender XOR, lo que frenó la
      investigación por más de una década.</p>

      <h2>Perceptrón multicapa</h2>
      <p>Con capas \(\ell = 1, \dots, L\):</p>
      \[ a^{(0)} = x, \qquad z^{(\ell)} = W^{(\ell)} a^{(\ell-1)} + b^{(\ell)}, \qquad a^{(\ell)} = g\big(z^{(\ell)}\big), \]
      <p>con \(g\) no lineal (tanh, ReLU \(= \max(0, z)\)) en las capas ocultas y sigmoide o softmax en la salida. Sin \(g\) no lineal,
      la composición sería otra función lineal. El <strong>teorema de aproximación universal</strong> (Cybenko, 1989; Hornik, 1991)
      asegura que una sola capa oculta con suficientes neuronas aproxima cualquier función continua en un compacto; la profundidad
      permite hacerlo con muchas menos neuronas.</p>

      <h2>Retropropagación</h2>
      <p>La pérdida (entropía cruzada) se minimiza con descenso de gradiente. La regla de la cadena aplicada de la salida hacia la
      entrada da, con \(\delta^{(\ell)} = \partial J / \partial z^{(\ell)}\):</p>
      \[ \delta^{(L)} = a^{(L)} - y, \qquad \delta^{(\ell)} = \big(W^{(\ell+1)\top} \delta^{(\ell+1)}\big) \odot g'\big(z^{(\ell)}\big),
         \qquad \frac{\partial J}{\partial W^{(\ell)}} = \delta^{(\ell)} a^{(\ell-1)\top}. \]
      <p>Calcular todos los gradientes cuesta lo mismo que una pasada hacia adelante (diferenciación automática en modo reverso).
      La pérdida no es convexa, pero en la práctica variantes como Adam encuentran buenos mínimos. Contra el sobreajuste se usan
      regularización, <em>dropout</em> y detención temprana con un conjunto de validación.</p>

      <h2>Redes convolucionales</h2>
      <p>Una capa convolucional aplica un filtro \(K\) de \(k \times k\) en todas las posiciones:</p>
      \[ S(i, j) = \sum_{m=0}^{k-1} \sum_{n=0}^{k-1} K(m, n)\, I(i + m, j + n) + b. \]
      <p>(Estrictamente es una correlación cruzada; en aprendizaje profundo se le llama convolución.) Dos ideas la hacen eficiente:
      <strong>conectividad local</strong> (cada salida mira solo una ventana) y <strong>pesos compartidos</strong> (el mismo filtro en
      todas partes). Una imagen de \(12 \times 12\) con un filtro de \(3 \times 3\) usa 10 parámetros; una capa densa con las
      mismas entradas y salidas usaría 14 400. Además, desplazar la imagen desplaza el mapa (equivarianza a traslaciones).</p>
      <p>Una CNN alterna convoluciones (con muchos filtros, cuyos pesos se <em>aprenden</em> por retropropagación), no linealidades
      ReLU y <strong>pooling</strong> (máximo o promedio en bloques), que reduce la resolución y agranda el <em>campo receptivo</em>:
      las primeras capas detectan bordes, las siguientes texturas y partes, las últimas objetos. Al final, capas densas o un
      promedio global clasifican. LeNet (1998) leía dígitos; AlexNet (2012) inició la era del aprendizaje profundo en visión.</p>`,
  });
})();
