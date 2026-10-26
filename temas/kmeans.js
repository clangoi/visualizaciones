(function () {
  'use strict';
  const { el, color: C } = VIZ;

  const ANCHO = 1.6, ALTO = 1; // dominio de los datos (misma escala en ambos ejes)
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  // Datos compartidos entre las dos figuras.
  const datos = { puntos: [], oyentes: [] };
  const notificar = () => datos.oyentes.forEach((fn) => fn());

  function generar(grupos, n, sigma, semilla) {
    const rnd = VIZ.semilla(semilla);
    const centros = [];
    for (let g = 0; g < grupos; g++) {
      let c, intentos = 0;
      do {
        c = { x: 0.18 + rnd() * (ANCHO - 0.36), y: 0.15 + rnd() * (ALTO - 0.3) };
        intentos++;
      } while (intentos < 60 && centros.some((o) => Math.sqrt(d2(o, c)) < 0.28));
      centros.push(c);
    }
    const pts = [];
    for (let i = 0; i < n; i++) {
      const c = centros[i % grupos];
      const x = c.x + VIZ.normal(rnd) * sigma, y = c.y + VIZ.normal(rnd) * sigma;
      if (x > 0.01 && x < ANCHO - 0.01 && y > 0.01 && y < ALTO - 0.01) pts.push({ x, y, c: -1 });
    }
    datos.puntos = pts;
  }

  function inicializar(pts, k, metodo, rnd = Math.random) {
    if (!pts.length) return [];
    if (metodo === 'uniforme') return Array.from({ length: k }, () => ({ x: rnd() * ANCHO, y: rnd() * ALTO }));
    if (metodo === 'forgy') {
      const idx = [...pts.keys()];
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      return idx.slice(0, k).map((i) => ({ x: pts[i].x, y: pts[i].y }));
    }
    // k-means++: cada nuevo centro se elige con probabilidad proporcional a D(x)².
    const cs = [{ ...pts[Math.floor(rnd() * pts.length)] }];
    const D = pts.map((p) => d2(p, cs[0]));
    while (cs.length < k) {
      const total = D.reduce((a, b) => a + b, 0);
      let r = rnd() * total, i = 0;
      while (i < pts.length - 1 && r > D[i]) { r -= D[i]; i++; }
      cs.push({ x: pts[i].x, y: pts[i].y });
      for (let j = 0; j < pts.length; j++) D[j] = Math.min(D[j], d2(pts[j], cs[cs.length - 1]));
    }
    return cs;
  }

  function asignar(pts, cs) {
    let cambios = 0;
    for (const p of pts) {
      let mejor = 0, dm = Infinity;
      cs.forEach((c, j) => { const d = d2(p, c); if (d < dm) { dm = d; mejor = j; } });
      if (p.c !== mejor) { cambios++; p.c = mejor; }
    }
    return cambios;
  }
  function actualizar(pts, cs) {
    const sx = cs.map(() => 0), sy = cs.map(() => 0), n = cs.map(() => 0);
    for (const p of pts) if (p.c >= 0) { sx[p.c] += p.x; sy[p.c] += p.y; n[p.c]++; }
    return cs.map((c, j) => (n[j] ? { x: sx[j] / n[j], y: sy[j] / n[j] } : { ...c }));
  }
  const inercia = (pts, cs) => pts.reduce((s, p) => s + (p.c >= 0 ? d2(p, cs[p.c]) : 0), 0);

  // Lloyd completo sobre una copia; devuelve la inercia final.
  function lloyd(pts, k, rnd) {
    const copia = pts.map((p) => ({ x: p.x, y: p.y, c: -1 }));
    let cs = inicializar(copia, k, 'kpp', rnd);
    for (let it = 0; it < 100; it++) {
      const cambios = asignar(copia, cs);
      cs = actualizar(copia, cs);
      if (!cambios) break;
    }
    asignar(copia, cs);
    return inercia(copia, cs);
  }

  /* ---------- Fig. 1: algoritmo de Lloyd ---------- */

  function montarLloyd(cuerpo) {
    let grupos = 4, n = 300, sigma = 0.08, semilla = 11;
    let k = 4, metodo = 'kpp', regiones = true;
    let cs = [], historia = [], fase = 'asignar', iter = 0, convergido = false, ultimosCambios = null;
    let anim = null; // interpolación del movimiento de centroides

    function reiniciarCentroides() {
      bucle.detener();
      for (const p of datos.puntos) p.c = -1;
      cs = inicializar(datos.puntos, k, metodo);
      historia = cs.map((c) => [{ ...c }]);
      fase = 'asignar';
      iter = 0;
      convergido = false;
      ultimosCambios = null;
      anim = null;
      dibujar();
    }
    function nuevosDatos() {
      generar(grupos, n, sigma, semilla);
      reiniciarCentroides();
      notificar();
    }

    function paso() {
      if (convergido || !cs.length) return false;
      if (fase === 'asignar') {
        ultimosCambios = asignar(datos.puntos, cs);
        fase = 'actualizar';
        if (ultimosCambios === 0 && iter > 0) { convergido = true; return false; }
      } else {
        const nuevos = actualizar(datos.puntos, cs);
        anim = { desde: cs.map((c) => ({ ...c })), hasta: nuevos, t: 0 };
        cs = nuevos;
        cs.forEach((c, j) => historia[j].push({ ...c }));
        fase = 'asignar';
        iter++;
      }
      return true;
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'k (centroides)', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; reiniciarCentroides(); } });
    ctl.selector({ etiqueta: 'Inicialización', opciones: [['kpp', 'k-means++'], ['forgy', 'Forgy (k puntos al azar)'], ['uniforme', 'Uniforme en el plano']], valor: metodo,
      alCambiar: (v) => { metodo = v; reiniciarCentroides(); } });
    ctl.rango({ etiqueta: 'Grupos reales', min: 1, max: 8, valor: grupos, alCambiar: (v) => { grupos = v; nuevosDatos(); } });
    ctl.rango({ etiqueta: 'Puntos', min: 30, max: 800, paso: 10, valor: n, alCambiar: (v) => { n = v; nuevosDatos(); } });
    ctl.rango({ etiqueta: 'Dispersión σ', min: 0.02, max: 0.25, paso: 0.01, valor: sigma, formato: (v) => v.toFixed(2),
      alCambiar: (v) => { sigma = v; nuevosDatos(); } });
    ctl.casilla({ etiqueta: 'mostrar regiones de Voronoi', valor: regiones, alCambiar: (v) => { regiones = v; dibujar(); } });
    const bPlay = ctl.boton('Ejecutar', () => {
      if (bucle.activo) return bucle.detener();
      if (convergido) reiniciarCentroides();
      bPlay.textContent = 'Pausar';
      espera = 0;
      bucle.iniciar();
    }, { primario: true });
    const bPaso = ctl.boton('Un paso: asignar', () => { bucle.detener(); paso(); dibujar(); });
    ctl.boton('Nuevos centroides', reiniciarCentroides);
    ctl.boton('Nuevos datos', () => { semilla++; nuevosDatos(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: ALTO / ANCHO, altoMax: 560 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para agregar puntos. Con inicialización uniforme o Forgy, repita «Nuevos centroides» varias veces: a veces el algoritmo converge a soluciones claramente peores (mínimos locales).');

    let espera = 0;
    const bucle = VIZ.bucle((dt) => {
      if (anim && anim.t < 1) { anim.t = Math.min(1, anim.t + dt / 350); dibujar(); return true; }
      espera -= dt;
      if (espera > 0) return true;
      espera = 380;
      const sigue = paso();
      dibujar();
      return sigue;
    }, () => { bPlay.textContent = 'Ejecutar'; });

    let fondo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar(C.superficie);
      const sx = (x) => (x / ANCHO) * W, sy = (y) => H - (y / ALTO) * H;
      const pos = cs.map((c, j) => {
        if (!anim || anim.t >= 1) return c;
        const a = anim.desde[j], b = anim.hasta[j], t = 1 - Math.pow(1 - anim.t, 3);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      });
      // Regiones de Voronoi a baja resolución.
      if (regiones && pos.length) {
        const paso = 4, w = Math.ceil(W / paso), h = Math.ceil(H / paso);
        if (!fondo || fondo.width !== w || fondo.height !== h) { fondo = document.createElement('canvas'); fondo.width = w; fondo.height = h; }
        const octx = fondo.getContext('2d');
        const img = octx.createImageData(w, h);
        const rgb = VIZ.series.map((c) => VIZ.rgb(c));
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const q = { x: ((i + 0.5) * paso / W) * ANCHO, y: (1 - (j + 0.5) * paso / H) * ALTO };
            let m = 0, dm = Infinity;
            for (let c = 0; c < pos.length; c++) { const d = d2(q, pos[c]); if (d < dm) { dm = d; m = c; } }
            const o = 4 * (j * w + i), col = rgb[m];
            img.data[o] = 255 + (col[0] - 255) * 0.13;
            img.data[o + 1] = 255 + (col[1] - 255) * 0.13;
            img.data[o + 2] = 255 + (col[2] - 255) * 0.13;
            img.data[o + 3] = 255;
          }
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(fondo, 0, 0, w * paso, h * paso);
      }
      // Puntos
      for (const p of datos.puntos) {
        const col = p.c >= 0 ? VIZ.series[p.c] : '#a9a8a0';
        ctx.fillStyle = col;
        ctx.beginPath();
        VIZ.forma(ctx, sx(p.x), sy(p.y), 3, p.c >= 0 ? p.c : 0);
        ctx.fill();
      }
      // Recorrido de los centroides
      historia.forEach((h, j) => {
        if (h.length < 2) return;
        ctx.strokeStyle = C.tinta;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        h.forEach((c, i) => (i ? ctx.lineTo(sx(c.x), sy(c.y)) : ctx.moveTo(sx(c.x), sy(c.y))));
        ctx.stroke();
        ctx.setLineDash([]);
        void j;
      });
      // Centroides: forma del grupo, contorno oscuro y anillo blanco.
      pos.forEach((c, j) => {
        ctx.save();
        ctx.beginPath();
        VIZ.forma(ctx, sx(c.x), sy(c.y), 9, j);
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.superficie;
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.tinta;
        ctx.stroke();
        ctx.fillStyle = VIZ.series[j];
        ctx.fill();
        ctx.restore();
      });
      ctx.strokeStyle = C.tinta;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      leyenda.set([
        ...cs.map((_, j) => ({ color: VIZ.series[j], texto: `grupo ${j + 1}` })),
        { color: '#a9a8a0', texto: 'sin asignar', forma: 'punto' },
      ]);
      const asignados = datos.puntos.some((p) => p.c >= 0);
      lectura.set([
        ['iteración', String(iter)],
        ['siguiente paso', convergido ? 'convergió' : fase === 'asignar' ? 'asignar' : 'actualizar'],
        ['puntos que cambiaron', ultimosCambios == null ? '—' : String(ultimosCambios)],
        ['inercia J', asignados ? VIZ.fmt(inercia(datos.puntos, cs), 4) : '—'],
        ['n', String(datos.puntos.length)],
      ]);
      bPaso.textContent = convergido ? 'Convergió' : `Un paso: ${fase}`;
      bPaso.disabled = convergido;
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = { x: (x / lienzo.ancho) * ANCHO, y: (1 - y / lienzo.alto) * ALTO, c: -1 };
      datos.puntos.push(p);
      if (cs.length) { convergido = false; fase = 'asignar'; }
      dibujar();
      notificar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const q = { x: (x / lienzo.ancho) * ANCHO, y: (1 - y / lienzo.alto) * ALTO };
      let j = -1, dm = (14 / lienzo.ancho * ANCHO) ** 2;
      cs.forEach((c, i) => { const d = d2(q, c); if (d < dm) { dm = d; j = i; } });
      if (j < 0) return tip.ocultar();
      const tam = datos.puntos.filter((p) => p.c === j).length;
      tip.mostrar(x, y, VIZ.filaTooltip(VIZ.series[j], `centroide ${j + 1}`, '') + `μ = (${cs[j].x.toFixed(3)}, ${cs[j].y.toFixed(3)})<br>${tam} puntos asignados`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'copy';

    generar(grupos, n, sigma, semilla);
    reiniciarCentroides();
  }

  /* ---------- Fig. 2: método del codo ---------- */

  function montarCodo(cuerpo) {
    const KMAX = 10;
    let valores = [], hover = null, pendiente = null;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada k se ejecuta k-means++ cinco veces y se guarda la menor inercia. Se recalcula al cambiar los datos de la figura 1.');

    function calcular() {
      const rnd = VIZ.semilla(5);
      valores = [];
      for (let k = 1; k <= KMAX; k++) {
        let mejor = Infinity;
        for (let r = 0; r < 5; r++) mejor = Math.min(mejor, lloyd(datos.puntos, k, rnd));
        valores.push({ k, J: mejor });
      }
      dibujar();
    }

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      if (!valores.length) return;
      const ymax = valores[0].J * 1.08 || 1;
      plano = VIZ.plano(lienzo, { xmin: 0.5, xmax: KMAX + 0.5, ymin: 0, ymax }, {
        etiquetaX: 'número de grupos k', etiquetaY: 'inercia mínima J(k)',
        ticksX: valores.map((v) => v.k), formatoY: (v) => VIZ.fmt(v, 3),
      });
      plano.ejes();
      VIZ.trazar(ctx, plano, valores.map((v) => [v.k, v.J]), C.s1, 2);
      for (const v of valores) VIZ.marcador(ctx, plano.sx(v.k), plano.sy(v.J), C.s1, hover === v.k ? 6 : 4.5);
      // Codo estimado: máxima distancia a la recta entre el primer y el último punto.
      const a = valores[0], b = valores[valores.length - 1];
      let codo = null, dmax = -1;
      for (const v of valores) {
        const x = (v.k - a.k) / (b.k - a.k), y = (v.J - b.J) / (a.J - b.J || 1);
        const d = Math.abs(x + y - 1) / Math.SQRT2;
        if (d > dmax) { dmax = d; codo = v; }
      }
      if (codo) {
        ctx.strokeStyle = C.tinta;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(plano.sx(codo.k), plano.sy(codo.J), 10, 0, 7); ctx.stroke();
        ctx.fillStyle = C.tinta2;
        ctx.font = VIZ.fuente(11);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`codo ≈ ${codo.k}`, plano.sx(codo.k) + 12, plano.sy(codo.J) - 8);
      }
      lectura.set(valores.slice(0, 6).map((v, i) => [`k = ${v.k}`, i ? `${VIZ.fmt(v.J, 3)} (−${Math.round((1 - v.J / valores[i - 1].J) * 100)} %)` : VIZ.fmt(v.J, 3)]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      const k = Math.round(plano.ix(x));
      const v = valores.find((q) => q.k === k);
      if (!v || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = k;
      dibujar();
      tip.mostrar(x, y, `k = <b>${k}</b><br>J = <b>${VIZ.fmt(v.J, 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });

    datos.oyentes.push(() => { clearTimeout(pendiente); pendiente = setTimeout(calcular, 120); });
    calcular();
  }

  VIZ.registrarTema('kmeans', {
    intro: String.raw`
      <p>El <strong>agrupamiento</strong> busca dividir un conjunto de datos en grupos de elementos parecidos sin conocer
      etiquetas de antemano: es aprendizaje <em>no supervisado</em>. El método k-medias representa cada grupo por un punto, su
      <strong>centroide</strong>, y asigna cada dato al centroide más cercano. Se usa para segmentar clientes, comprimir colores de
      imágenes (cuantización), inicializar otros modelos o simplemente explorar la estructura de unos datos.</p>`,
    visualizaciones: [
      {
        titulo: 'El algoritmo de Lloyd',
        descripcion: 'Alterna dos pasos: <em>asignar</em> cada punto al centroide más cercano y <em>actualizar</em> cada centroide al promedio de sus puntos. El fondo muestra la región de cada centroide; la línea punteada, su recorrido. Cada grupo tiene además una forma distinta.',
        montar: montarLloyd,
      },
      {
        titulo: 'Elegir k: el método del codo',
        descripcion: 'La inercia siempre disminuye al aumentar k; el «codo» marca el punto desde el cual agregar grupos deja de reducirla de forma importante.',
        montar: montarCodo,
      },
    ],
    teoria: String.raw`
      <h2>El problema de optimización</h2>
      <p>Dados \(n\) puntos \(x_1, \dots, x_n \in \mathbb{R}^d\) y un entero \(k\), se buscan una partición \(S_1, \dots, S_k\) y centros
      \(\mu_1, \dots, \mu_k\) que minimicen la <strong>inercia</strong> (suma de cuadrados intra-grupo):</p>
      \[ J(S, \mu) = \sum_{j=1}^{k} \sum_{x_i \in S_j} \|x_i - \mu_j\|^2. \]
      <p>Encontrar el mínimo global es NP-difícil incluso con \(k = 2\) o en el plano, por lo que se usan heurísticas.</p>

      <h2>Algoritmo de Lloyd</h2>
      <p>Es un método de <em>descenso por coordenadas</em>: minimiza \(J\) alternadamente en \(S\) con \(\mu\) fijo y en \(\mu\) con \(S\) fijo.</p>
      <ol>
        <li><strong>Asignación.</strong> Con los centros fijos, lo óptimo es enviar cada punto al centro más cercano:
        \(S_j = \{x_i : \|x_i - \mu_j\| \le \|x_i - \mu_l\|\ \forall l\}\). Esto divide el espacio en celdas de Voronoi.</li>
        <li><strong>Actualización.</strong> Con la partición fija, \(J\) se separa en un término por grupo. Derivando
        \(\sum_{x_i \in S_j}\|x_i - \mu\|^2\) respecto de \(\mu\) e igualando a cero:
        \[ -2\sum_{x_i \in S_j} (x_i - \mu) = 0 \;\Longrightarrow\; \mu_j = \frac{1}{|S_j|}\sum_{x_i \in S_j} x_i. \]
        La media es el punto que minimiza la suma de distancias al cuadrado.</li>
      </ol>
      <p>Como ningún paso puede aumentar \(J\) y hay finitas particiones posibles, el algoritmo <strong>termina siempre</strong> en un
      número finito de iteraciones. Cada iteración cuesta \(O(nkd)\). Pero solo garantiza un mínimo <em>local</em>: el resultado depende
      de la inicialización.</p>

      <h2>Inicialización k-means++</h2>
      <p>Arthur y Vassilvitskii (2007) propusieron elegir el primer centro uniformemente entre los datos y cada siguiente con
      probabilidad proporcional al cuadrado de la distancia al centro más cercano ya elegido:</p>
      \[ \Pr[\text{elegir } x_i] = \frac{D(x_i)^2}{\sum_{l} D(x_l)^2}. \]
      <p>Esto favorece centros alejados entre sí. Con esta inicialización, el valor esperado de \(J\) —incluso antes de ejecutar
      Lloyd— cumple \(\mathbb{E}[J] \le 8(\ln k + 2)\, J^{*}\), donde \(J^{*}\) es el óptimo.</p>

      <h2>Elegir k</h2>
      <p>La inercia óptima \(J^*(k)\) es no creciente en \(k\) y vale 0 cuando \(k = n\), así que no puede minimizarse directamente
      sobre \(k\). El <strong>método del codo</strong> busca el punto donde la curva pasa de caer rápido a caer lento. Alternativas
      más formales son el coeficiente de silueta, el estadístico de brecha (<em>gap statistic</em>) o criterios de información
      sobre un modelo de mezcla.</p>

      <h2>Supuestos implícitos</h2>
      <p>Al usar distancia euclidiana y medias, k-medias asume grupos aproximadamente esféricos, de tamaño y densidad similares.
      Equivale al límite de un modelo de mezcla gaussiana con covarianzas \(\sigma^2 I\) iguales cuando \(\sigma \to 0\). Con grupos
      alargados, anidados o de densidades muy distintas, conviene usar mezclas gaussianas con covarianza completa, DBSCAN o
      agrupamiento espectral. También es sensible a la escala de las variables: es habitual estandarizarlas primero.</p>`,
  });
})();
