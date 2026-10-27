/* Imágenes pequeñas para los temas de visión: escenas sintéticas en escala de grises o color,
   dibujo píxel a píxel, filtros, morfología binaria y componentes conexas.
   Una imagen es { w, h, d } con d: Float32Array de w·h valores en [0, 1] (y d de 3·w·h si c = 3). */
(function () {
  'use strict';
  const { color: C } = VIZ;

  const crear = (w, h, v = 0, c = 1) => ({ w, h, c, d: new Float32Array(w * h * c).fill(v) });
  const copia = (im) => ({ w: im.w, h: im.h, c: im.c, d: new Float32Array(im.d) });
  const recortar01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ---------- Escenas sintéticas ---------- */

  // Escena en grises. tipo: 'monedas' (discos claros), 'celulas' (manchas suaves), 'texto' (trazos oscuros sobre claro).
  // op: { ruido (σ), iluminacion (gradiente de fondo ∈ [0, 1]), contraste }
  function escena(tipo, w, h, semilla, op = {}) {
    const rnd = VIZ.semilla(semilla);
    const ruido = op.ruido ?? 0.05, ilum = op.iluminacion ?? 0, contraste = op.contraste ?? 0.45;
    const im = crear(w, h);
    const fondo = (x, y) => 0.22 + ilum * 0.45 * (x / w + 0.4 * y / h);
    const objetos = [];
    const cuantos = tipo === 'celulas' ? 9 : 7;
    for (let k = 0, intentos = 0; k < cuantos && intentos < 400; intentos++) {
      const r = (tipo === 'celulas' ? 0.06 : 0.07 + rnd() * 0.06) * Math.min(w, h) * (tipo === 'celulas' ? 1 + rnd() : 1.4);
      const o = { x: r + 1 + rnd() * (w - 2 * r - 2), y: r + 1 + rnd() * (h - 2 * r - 2), r, b: contraste * (0.8 + 0.4 * rnd()) };
      if (objetos.some((p) => Math.hypot(p.x - o.x, p.y - o.y) < p.r + o.r + 2)) continue;
      objetos.push(o); k++;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = fondo(x, y);
      for (const o of objetos) {
        const d = Math.hypot(x + 0.5 - o.x, y + 0.5 - o.y) / o.r;
        if (tipo === 'celulas') v += o.b * Math.exp(-3 * d * d);
        else if (d < 1) v += o.b * (1 - 0.25 * d * d);
      }
      if (tipo === 'texto') v = 1.05 - v;
      im.d[y * w + x] = recortar01(v + VIZ.normal(rnd) * ruido);
    }
    im.objetos = objetos;
    return im;
  }

  // Escena binaria con formas: rectángulo con un agujero, disco, anillo, una barra delgada y granos sueltos.
  function formas(w, h, semilla = 1, { granos = 12 } = {}) {
    const rnd = VIZ.semilla(semilla);
    const b = crear(w, h);
    const pon = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) b.d[y * w + x] = 1; };
    const sx = w / 40, sy = h / 40;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = (x + 0.5) / sx, Y = (y + 0.5) / sy;
      const rect = X > 3 && X < 17 && Y > 4 && Y < 17 && !(X > 8 && X < 11 && Y > 9 && Y < 12);
      const disco = Math.hypot(X - 29, Y - 10) < 6.5;
      const r = Math.hypot(X - 10, Y - 29);
      const anillo = r < 7 && r > 3.6;
      const barra = X > 21 && X < 37 && Math.abs(Y - 0.35 * X - 19) < 1.6;
      if (rect || disco || anillo || barra) b.d[y * w + x] = 1;
    }
    for (let k = 0; k < granos; k++) {
      const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      pon(x, y);
      if (rnd() < 0.4) pon(x + 1, y);
    }
    // Picaduras dentro de las formas (ruido de sal y pimienta).
    for (let k = 0; k < granos / 2; k++) b.d[Math.floor(rnd() * h) * w + Math.floor(rnd() * w)] = 0;
    return b;
  }

  // Escena en color: regiones de colores distintos con un gradiente suave y ruido. Devuelve una imagen de 3 canales.
  const COLORES_ESCENA = [[0.85, 0.35, 0.2], [0.25, 0.55, 0.85], [0.3, 0.7, 0.35], [0.92, 0.8, 0.3], [0.55, 0.35, 0.7], [0.82, 0.8, 0.74]];
  function escenaColor(w, h, semilla, { ruido = 0.04, gradiente = 0.15 } = {}) {
    const rnd = VIZ.semilla(semilla);
    const im = crear(w, h, 0, 3);
    const semillas = Array.from({ length: 7 }, (_, k) => ({ x: rnd() * w, y: rnd() * h, k: k % COLORES_ESCENA.length }));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = 0, dm = Infinity;
      semillas.forEach((s, j) => { const d = (x - s.x) ** 2 + (y - s.y) ** 2 * 1.3; if (d < dm) { dm = d; m = j; } });
      const col = COLORES_ESCENA[semillas[m].k], g = gradiente * (x / w - 0.5);
      for (let c = 0; c < 3; c++) im.d[3 * (y * w + x) + c] = recortar01(col[c] + g + VIZ.normal(rnd) * ruido);
    }
    return im;
  }

  /* ---------- Dibujo ---------- */

  // Pinta la imagen en un canvas auxiliar de w × h y la escala sin suavizado.
  // op.modo: 'gris' | 'binaria' | 'color'; op.pixel(i) → [r, g, b] (0–255) o null para sobrescribir un píxel.
  const auxiliar = document.createElement('canvas');
  function dibujar(ctx, im, x, y, ancho, alto, op = {}) {
    const { w, h } = im;
    auxiliar.width = w; auxiliar.height = h;
    const actx = auxiliar.getContext('2d');
    const datos = actx.createImageData(w, h), px = datos.data;
    const tinta = VIZ.rgb(C.tinta), sup = VIZ.rgb(C.superficie);
    const modo = op.modo || (im.c === 3 ? 'color' : 'gris');
    for (let i = 0; i < w * h; i++) {
      let rgb = op.pixel ? op.pixel(i) : null;
      if (!rgb) {
        if (modo === 'color') rgb = [im.d[3 * i] * 255, im.d[3 * i + 1] * 255, im.d[3 * i + 2] * 255];
        else if (modo === 'binaria') rgb = im.d[i] > 0.5 ? tinta : sup;
        else { const v = im.d[i] * 255; rgb = [v, v, v]; }
      }
      px[4 * i] = rgb[0]; px[4 * i + 1] = rgb[1]; px[4 * i + 2] = rgb[2]; px[4 * i + 3] = 255;
    }
    actx.putImageData(datos, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(auxiliar, x, y, ancho, alto);
    if (op.rejilla && ancho / w >= 7) {
      ctx.strokeStyle = VIZ.alfa(C.eje, 0.6);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i <= w; i++) { const X = x + (i * ancho) / w; ctx.moveTo(X, y); ctx.lineTo(X, y + alto); }
      for (let j = 0; j <= h; j++) { const Y = y + (j * alto) / h; ctx.moveTo(x, Y); ctx.lineTo(x + ancho, Y); }
      ctx.stroke();
    }
    if (op.borde !== false) {
      ctx.strokeStyle = C.eje;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ancho - 1, alto - 1);
    }
    ctx.restore();
  }

  // Reparte k paneles cuadrados (proporción w/h de la imagen) en una fila o en dos si no caben.
  function paneles(lienzo, k, proporcion = 1, { sep = 14, rotulo = 18 } = {}) {
    const W = lienzo.ancho;
    const columnas = W < 520 && k > 2 ? Math.ceil(k / 2) : k;
    const filas = Math.ceil(k / columnas);
    const ancho = (W - sep * (columnas - 1)) / columnas, alto = ancho / proporcion;
    return { columnas, filas, ancho, alto, alturaTotal: filas * (alto + rotulo) + (filas - 1) * sep,
      pos: (i) => ({ x: (i % columnas) * (ancho + sep), y: Math.floor(i / columnas) * (alto + rotulo + sep) + rotulo }) };
  }
  function rotulo(ctx, texto, x, y) {
    ctx.save();
    ctx.font = VIZ.fuente(11);
    ctx.fillStyle = C.tinta2;
    ctx.textBaseline = 'bottom';
    ctx.fillText(texto, x, y - 5);
    ctx.restore();
  }

  /* ---------- Filtros ---------- */

  const en = (im, x, y) => im.d[Math.min(im.h - 1, Math.max(0, y)) * im.w + Math.min(im.w - 1, Math.max(0, x))];

  function convolucionar(im, K) {
    const r = (K.length - 1) / 2, out = crear(im.w, im.h);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) s += K[j + r][i + r] * en(im, x + i, y + j);
      out.d[y * im.w + x] = s;
    }
    return out;
  }
  // Suavizado gaussiano separable.
  function gauss(im, sigma) {
    if (sigma <= 0) return copia(im);
    const r = Math.ceil(3 * sigma), k = [];
    let s = 0;
    for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); s += v; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    const tmp = crear(im.w, im.h), out = crear(im.w, im.h);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += k[i + r] * en(im, x + i, y);
      tmp.d[y * im.w + x] = v;
    }
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += k[i + r] * en(tmp, x, y + i);
      out.d[y * im.w + x] = v;
    }
    return out;
  }
  // Gradiente por diferencias centrales: { gx, gy, mag, ang } (ang ∈ (−π, π], y hacia abajo).
  function gradiente(im) {
    const n = im.w * im.h, gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n), ang = new Float32Array(n);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const i = y * im.w + x;
      gx[i] = (en(im, x + 1, y) - en(im, x - 1, y)) / 2;
      gy[i] = (en(im, x, y + 1) - en(im, x, y - 1)) / 2;
      mag[i] = Math.hypot(gx[i], gy[i]);
      ang[i] = Math.atan2(gy[i], gx[i]);
    }
    return { gx, gy, mag, ang };
  }

  function histograma(im, bins = 256) {
    const hst = new Array(bins).fill(0);
    for (const v of im.d) hst[Math.min(bins - 1, Math.floor(v * bins))]++;
    return hst;
  }
  function umbralizar(im, t) {
    const b = crear(im.w, im.h);
    for (let i = 0; i < im.d.length; i++) b.d[i] = im.d[i] > t ? 1 : 0;
    return b;
  }

  /* ---------- Morfología binaria ---------- */

  // Elemento estructurante como lista de desplazamientos [dx, dy].
  function elemento(tipo, r = 1) {
    const es = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (tipo === 'cruz' && dx !== 0 && dy !== 0) continue;
      if (tipo === 'disco' && dx * dx + dy * dy > r * r + 0.5) continue;
      if (tipo === 'horizontal' && dy !== 0) continue;
      es.push([dx, dy]);
    }
    return es;
  }
  const val = (b, x, y, fuera = 0) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? fuera : b.d[y * b.w + x]);
  function dilatar(b, es) {
    const out = crear(b.w, b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (!b.d[y * b.w + x]) continue;
      for (const [dx, dy] of es) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < b.w && Y < b.h) out.d[Y * b.w + X] = 1; }
    }
    return out;
  }
  function erosionar(b, es) {
    const out = crear(b.w, b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      let todo = 1;
      for (const [dx, dy] of es) if (!val(b, x + dx, y + dy)) { todo = 0; break; }
      out.d[y * b.w + x] = todo;
    }
    return out;
  }
  const abrir = (b, es) => dilatar(erosionar(b, es), es);
  const cerrar = (b, es) => erosionar(dilatar(b, es), es);
  function combinar(a, b, f) {
    const out = crear(a.w, a.h);
    for (let i = 0; i < a.d.length; i++) out.d[i] = f(a.d[i] > 0.5, b.d[i] > 0.5) ? 1 : 0;
    return out;
  }
  const union = (a, b) => combinar(a, b, (p, q) => p || q);
  const interseccion = (a, b) => combinar(a, b, (p, q) => p && q);
  // Perímetro: píxeles del objeto con algún vecino de fondo en la vecindad 4.
  const perimetro = (b) => combinar(b, erosionar(b, elemento('cruz', 1)), (p, q) => p && !q);

  // Componentes conexas por recorrido en anchura. Devuelve { etiqueta: Int32Array (−1 = fondo), n, areas }.
  function etiquetar(b, vecindad = 8, valor = 1) {
    const { w, h } = b, et = new Int32Array(w * h).fill(-1), areas = [];
    const V = vecindad === 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let n = 0;
    const cola = new Int32Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (et[s] >= 0 || (b.d[s] > 0.5 ? 1 : 0) !== valor) continue;
      let ini = 0, fin = 0, area = 0;
      cola[fin++] = s; et[s] = n;
      while (ini < fin) {
        const i = cola[ini++], x = i % w, y = (i / w) | 0;
        area++;
        for (const [dx, dy] of V) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const j = Y * w + X;
          if (et[j] < 0 && (b.d[j] > 0.5 ? 1 : 0) === valor) { et[j] = n; cola[fin++] = j; }
        }
      }
      areas.push(area);
      n++;
    }
    return { etiqueta: et, n, areas };
  }
  // Relleno de agujeros: el fondo que no se alcanza desde el borde de la imagen pasa a ser objeto.
  function rellenar(b) {
    const { etiqueta, n } = etiquetar(b, 4, 0), tocaBorde = new Array(n).fill(false);
    for (let x = 0; x < b.w; x++) { for (const y of [0, b.h - 1]) { const e = etiqueta[y * b.w + x]; if (e >= 0) tocaBorde[e] = true; } }
    for (let y = 0; y < b.h; y++) { for (const x of [0, b.w - 1]) { const e = etiqueta[y * b.w + x]; if (e >= 0) tocaBorde[e] = true; } }
    const out = copia(b);
    for (let i = 0; i < out.d.length; i++) if (etiqueta[i] >= 0 && !tocaBorde[etiqueta[i]]) out.d[i] = 1;
    return out;
  }
  // Limpieza: elimina los objetos con menos de `minimo` píxeles.
  function limpiar(b, minimo) {
    const { etiqueta, areas } = etiquetar(b, 8, 1), out = copia(b);
    for (let i = 0; i < out.d.length; i++) if (etiqueta[i] >= 0 && areas[etiqueta[i]] < minimo) out.d[i] = 0;
    return out;
  }
  // Esqueletización de Zhang y Suen. Como generador: cada `yield` entrega { sub, borrados } de una subiteración.
  function* esqueletoPasos(b) {
    const im = copia(b), { w, h } = im;
    const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : im.d[y * w + x] > 0.5 ? 1 : 0);
    for (let it = 0; it < 200; it++) {
      let cambios = 0;
      for (const sub of [0, 1]) {
        const borrar = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (!P(x, y)) continue;
          const v = [P(x, y - 1), P(x + 1, y - 1), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1), P(x - 1, y + 1), P(x - 1, y), P(x - 1, y - 1)];
          const B = v.reduce((a, c) => a + c, 0);
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let k = 0; k < 8; k++) if (!v[k] && v[(k + 1) % 8]) A++;
          if (A !== 1) continue;
          const [p2, , p4, , p6, , p8] = v;
          if (sub === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          borrar.push(y * w + x);
        }
        for (const i of borrar) im.d[i] = 0;
        cambios += borrar.length;
        yield { imagen: im, sub, iteracion: it + 1, borrados: borrar };
      }
      if (!cambios) return;
    }
  }
  function esqueleto(b) {
    let ultimo = { imagen: copia(b) };
    for (const p of esqueletoPasos(b)) ultimo = p;
    return copia(ultimo.imagen);
  }

  const contar = (b) => b.d.reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0);

  VIZ.img = {
    crear, copia, escena, formas, escenaColor, dibujar, paneles, rotulo, en, convolucionar, gauss, gradiente, histograma, umbralizar,
    elemento, dilatar, erosionar, abrir, cerrar, union, interseccion, perimetro, etiquetar, rellenar, limpiar, esqueletoPasos, esqueleto, contar,
  };
})();
