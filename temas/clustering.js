(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const DOM = { xmin: -1.15, xmax: 1.15, ymin: -1.15, ymax: 1.15 };
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  const DATOS = [['manchas', 'Manchas de distinto tamaño'], ['alargadas', 'Grupos alargados'], ['lunas', 'Dos lunas'], ['circulos', 'Círculos concéntricos']];
  function generar(tipo, semilla) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd), X = [], y = [];
    const pon = (x, yy, c) => { if (Math.abs(x) < 1.1 && Math.abs(yy) < 1.1) { X.push([x, yy]); y.push(c); } };
    if (tipo === 'manchas') {
      const g = [[-0.5, 0.45, 0.22, 140], [0.45, 0.5, 0.07, 50], [0.35, -0.45, 0.12, 90]];
      g.forEach(([mx, my, s, n], c) => { for (let i = 0; i < n; i++) pon(mx + N() * s, my + N() * s, c); });
    } else if (tipo === 'alargadas') {
      // Elongadas en la dirección (0,8; 0,6) y separadas en la perpendicular (−0,6; 0,8).
      for (let c = 0; c < 3; c++) for (let i = 0; i < 90; i++) {
        const t = N() * 0.4, e = N() * 0.05, cx = (c - 1) * 0.42 * -0.6, cy = (c - 1) * 0.42 * 0.8;
        pon(cx + t * 0.8 - e * 0.6, cy + t * 0.6 + e * 0.8, c);
      }
    } else if (tipo === 'lunas') {
      for (let i = 0; i < 260; i++) {
        const c = i % 2, t = rnd() * Math.PI, s = 0.06;
        if (c) pon(0.35 - 0.7 * Math.cos(t) + N() * s, 0.15 - 0.7 * Math.sin(t) + N() * s, 1);
        else pon(-0.35 + 0.7 * Math.cos(t) + N() * s, -0.15 + 0.7 * Math.sin(t) + N() * s, 0);
      }
    } else {
      for (let i = 0; i < 280; i++) { const c = i % 2, t = rnd() * 2 * Math.PI, r = (c ? 0.3 : 0.85) + N() * 0.05; pon(r * Math.cos(t), r * Math.sin(t), c); }
    }
    return { X, y };
  }

  /* ---------- Algoritmos ---------- */

  function kmeansPP(X, k, rnd) {
    const cs = [X[Math.floor(rnd() * X.length)].slice()], D = X.map((p) => d2(p, cs[0]));
    while (cs.length < k) {
      const tot = D.reduce((a, b) => a + b, 0);
      let r = rnd() * tot, i = 0;
      while (i < X.length - 1 && r > D[i]) { r -= D[i]; i++; }
      cs.push(X[i].slice());
      X.forEach((p, j) => { D[j] = Math.min(D[j], d2(p, cs[cs.length - 1])); });
    }
    return cs;
  }
  const asignar = (X, cs) => X.map((p) => { let m = 0; cs.forEach((c, j) => { if (d2(p, c) < d2(p, cs[m])) m = j; }); return m; });
  function kmeans(X, k, semilla) {
    let cs = kmeansPP(X, k, VIZ.semilla(semilla)), et = [];
    for (let it = 0; it < 100; it++) {
      et = asignar(X, cs);
      const nuevos = cs.map((c, j) => { const g = X.filter((_, i) => et[i] === j); return g.length ? P.media(g) : c; });
      if (nuevos.every((c, j) => d2(c, cs[j]) < 1e-14)) break;
      cs = nuevos;
    }
    return { et, centros: cs };
  }

  // Mezcla gaussiana: estado { pi, mu, S }, pasos E y M separados para poder animarlos.
  function gmmInicial(X, k, semilla) {
    const mu = kmeansPP(X, k, VIZ.semilla(semilla));
    return { pi: mu.map(() => 1 / k), mu, S: mu.map(() => [[0.04, 0], [0, 0.04]]), R: null };
  }
  function pasoE(X, g) {
    const dens = g.mu.map((m, k) => P.gauss2(m, g.S[k]));
    let ll = 0;
    g.R = X.map((p) => {
      const v = dens.map((f, k) => g.pi[k] * f(p[0], p[1])), s = v.reduce((a, b) => a + b, 0) || 1e-300;
      ll += Math.log(s);
      return v.map((t) => t / s);
    });
    g.ll = ll / X.length;
  }
  function pasoM(X, g) {
    const K = g.mu.length, n = X.length;
    for (let k = 0; k < K; k++) {
      const Nk = g.R.reduce((s, r) => s + r[k], 0) + 1e-9;
      const mu = [0, 0];
      X.forEach((p, i) => { mu[0] += (g.R[i][k] * p[0]) / Nk; mu[1] += (g.R[i][k] * p[1]) / Nk; });
      const S = [[1e-4, 0], [0, 1e-4]];
      X.forEach((p, i) => {
        const a = p[0] - mu[0], b = p[1] - mu[1], r = g.R[i][k] / Nk;
        S[0][0] += r * a * a; S[0][1] += r * a * b; S[1][1] += r * b * b;
      });
      S[1][0] = S[0][1];
      g.pi[k] = Nk / n; g.mu[k] = mu; g.S[k] = S;
    }
  }
  function gmm(X, k, semilla) {
    const g = gmmInicial(X, k, semilla);
    let prev = -Infinity;
    for (let it = 0; it < 200; it++) { pasoE(X, g); if (Math.abs(g.ll - prev) < 1e-7) break; prev = g.ll; pasoM(X, g); }
    return { et: g.R.map((r) => r.indexOf(Math.max(...r))), g };
  }
  function dbscan(X, eps, minPts) {
    const n = X.length, et = new Array(n).fill(-2), e2 = eps * eps; // −2 sin visitar, −1 ruido
    const vecinos = (i) => { const v = []; for (let j = 0; j < n; j++) if (d2(X[i], X[j]) <= e2) v.push(j); return v; };
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (et[i] !== -2) continue;
      const v = vecinos(i);
      if (v.length < minPts) { et[i] = -1; continue; }
      et[i] = c;
      const cola = v.filter((j) => j !== i);
      while (cola.length) {
        const j = cola.pop();
        if (et[j] === -1) et[j] = c;
        if (et[j] !== -2) continue;
        et[j] = c;
        const vj = vecinos(j);
        if (vj.length >= minPts) cola.push(...vj);
      }
      c++;
    }
    return { et };
  }
  // Enlace simple: árbol de expansión mínima (Prim) y corte de sus k − 1 aristas más largas.
  function enlaceSimple(X, k) {
    const n = X.length, en = new Array(n).fill(false), dmin = new Array(n).fill(Infinity), padre = new Array(n).fill(-1), aristas = [];
    dmin[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!en[i] && (u < 0 || dmin[i] < dmin[u])) u = i;
      en[u] = true;
      if (padre[u] >= 0) aristas.push([padre[u], u, Math.sqrt(dmin[u])]);
      for (let v = 0; v < n; v++) if (!en[v]) { const d = d2(X[u], X[v]); if (d < dmin[v]) { dmin[v] = d; padre[v] = u; } }
    }
    aristas.sort((a, b) => a[2] - b[2]);
    const raiz = [...Array(n).keys()], buscar = (i) => (raiz[i] === i ? i : (raiz[i] = buscar(raiz[i])));
    for (const [a, b] of aristas.slice(0, n - k)) raiz[buscar(a)] = buscar(b);
    const ids = new Map();
    return { et: X.map((_, i) => { const r = buscar(i); if (!ids.has(r)) ids.set(r, ids.size); return ids.get(r); }) };
  }

  // Índice de Rand ajustado entre dos particiones (el ruido de DBSCAN cuenta como un grupo).
  function ari(a, b) {
    const n = a.length, tabla = new Map(), fa = new Map(), fb = new Map();
    for (let i = 0; i < n; i++) {
      const k = `${a[i]}|${b[i]}`;
      tabla.set(k, (tabla.get(k) || 0) + 1); fa.set(a[i], (fa.get(a[i]) || 0) + 1); fb.set(b[i], (fb.get(b[i]) || 0) + 1);
    }
    const c2 = (m) => (m * (m - 1)) / 2, suma = (M) => [...M.values()].reduce((s, m) => s + c2(m), 0);
    const sij = suma(tabla), sa = suma(fa), sb = suma(fb), esp = (sa * sb) / c2(n), max = (sa + sb) / 2;
    return max === esp ? 1 : (sij - esp) / (max - esp);
  }

  /* ---------- Fig. 1: comparación ---------- */

  function montarComparacion(cuerpo) {
    let tipo = 'manchas', alg = 'kmeans', k = 3, eps = 0.1, minPts = 5, semilla = 2;
    let datos = generar(tipo, semilla), res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: DATOS, valor: tipo, alCambiar: (v) => { tipo = v; datos = generar(tipo, semilla); calcular(); } });
    ctl.selector({ etiqueta: 'Algoritmo', opciones: [['kmeans', 'k-means'], ['gmm', 'Mezcla gaussiana (EM)'], ['dbscan', 'DBSCAN'], ['simple', 'Jerárquico, enlace simple']], valor: alg,
      alCambiar: (v) => { alg = v; calcular(); } });
    ctl.rango({ etiqueta: 'Grupos k (k-means, EM, enlace)', min: 2, max: 6, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Radio ε (DBSCAN)', min: 0.03, max: 0.3, paso: 0.01, valor: eps, formato: (v) => v.toFixed(2), alCambiar: (v) => { eps = v; calcular(); } });
    ctl.rango({ etiqueta: 'Vecinos mínimos (DBSCAN)', min: 2, max: 15, valor: minPts, alCambiar: (v) => { minPts = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos = generar(tipo, semilla); calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 480 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El color es el grupo encontrado, sin usar las etiquetas reales. k-means corta las lunas y los círculos por la mitad; DBSCAN y el enlace simple siguen la forma, pero el enlace simple une grupos a través de un puente de puntos.');

    function calcular() {
      if (alg === 'kmeans') res = kmeans(datos.X, k, semilla);
      else if (alg === 'gmm') res = gmm(datos.X, k, semilla);
      else if (alg === 'dbscan') res = dbscan(datos.X, eps, minPts);
      else res = enlaceSimple(datos.X, k);
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂', margen: { izq: 40 } });
      plano.ejes();
      if (alg === 'gmm') res.g.mu.forEach((m, j) => P.elipse(ctx, plano, m, res.g.S[j], 2, { color: VIZ.series[j % 8], ancho: 1.5, guiones: [5, 4] }));
      if (alg === 'dbscan') {
        ctx.save(); ctx.strokeStyle = VIZ.alfa(C.eje, 0.6); ctx.lineWidth = 1;
        const r = plano.sx(eps) - plano.sx(0);
        const i = datos.X.length >> 1;
        ctx.beginPath(); ctx.arc(plano.sx(datos.X[i][0]), plano.sy(datos.X[i][1]), r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      datos.X.forEach((p, i) => {
        const e = res.et[i];
        VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), e < 0 ? C.inactivo : VIZ.series[e % 8], e < 0 ? 2.5 : 3.5, e < 0 ? 0 : e);
      });
      if (res.centros) res.centros.forEach((c, j) => VIZ.marcador(ctx, plano.sx(c[0]), plano.sy(c[1]), C.tinta, 6, j));
      const grupos = new Set(res.et.filter((e) => e >= 0)).size, ruido = res.et.filter((e) => e < 0).length;
      leyenda.set([
        { color: VIZ.series[0], texto: 'cada color es un grupo encontrado (forma = segunda codificación)', forma: 'punto' },
        ...(alg === 'dbscan' ? [{ color: C.inactivo, texto: 'ruido (DBSCAN)', forma: 'punto' }, { color: C.eje, texto: 'radio ε alrededor de un punto', forma: 'linea' }] : []),
        ...(alg === 'kmeans' ? [{ color: C.tinta, texto: 'centroide', forma: 'punto' }] : []),
        ...(alg === 'gmm' ? [{ color: C.eje, texto: 'elipse 2σ de cada componente', forma: 'linea' }] : []),
      ]);
      lectura.set([
        ['grupos encontrados', String(grupos)],
        ['grupos reales', String(new Set(datos.y).size)],
        ['puntos de ruido', String(ruido)],
        ['Rand ajustado', ari(res.et, datos.y).toFixed(3)],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 9;
      datos.X.forEach((p, i) => { const d = Math.hypot(plano.sx(p[0]) - x, plano.sy(p[1]) - y); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return tip.ocultar();
      const e = res.et[m];
      tip.mostrar(x, y, `${e < 0 ? 'ruido' : `grupo <b>${e + 1}</b>`}<br>clase real <b>${datos.y[m] + 1}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: EM paso a paso ---------- */

  function montarEM(cuerpo) {
    let k = 3, semilla = 4, datos = generar('alargadas', 3), g = null, fase = 'E', it = 0, historia = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: DATOS, valor: 'alargadas', alCambiar: (v) => { datos = generar(v, 3); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Componentes k', min: 1, max: 6, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Otra inicialización', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 480 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.series[0], texto: 'color del punto: componente más responsable (opacidad = responsabilidad)', forma: 'punto' },
      { color: C.eje, texto: 'elipses 1σ y 2σ de cada componente', forma: 'linea' },
      { color: C.tinta, texto: 'media de cada componente', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El paso E reparte cada punto entre las componentes; el paso M mueve y deforma cada elipse hacia los puntos que se le asignaron. La log-verosimilitud nunca baja. Pruebe varias inicializaciones: a veces se queda en un óptimo local.');

    function iniciar() {
      g = gmmInicial(datos.X, k, semilla); fase = 'E'; it = 0; historia = [];
      return (function* () {
        for (it = 1; it <= 100; it++) {
          pasoE(datos.X, g); fase = 'E'; historia.push(g.ll);
          yield;
          if (historia.length > 1 && Math.abs(historia[historia.length - 1] - historia[historia.length - 2]) < 1e-6) { fase = 'fin'; return; }
          pasoM(datos.X, g); fase = 'M';
          yield;
        }
      })();
    }
    function dibujar() {
      if (!g) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂', margen: { izq: 40 } });
      plano.ejes();
      datos.X.forEach((p, i) => {
        if (!g.R) return VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), C.inactivo, 3.5);
        const r = g.R[i], j = r.indexOf(Math.max(...r));
        VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), VIZ.alfa(VIZ.series[j % 8], 0.25 + 0.75 * r[j]), 3.5, j);
      });
      ctx.save(); plano.recortar();
      g.mu.forEach((m, j) => {
        P.elipse(ctx, plano, m, g.S[j], 1, { color: VIZ.series[j % 8], ancho: 2 });
        P.elipse(ctx, plano, m, g.S[j], 2, { color: VIZ.series[j % 8], ancho: 1.2, guiones: [4, 4] });
      });
      ctx.restore();
      g.mu.forEach((m, j) => VIZ.marcador(ctx, plano.sx(m[0]), plano.sy(m[1]), C.tinta, 5.5, j));
      registro.textContent = !g.R ? `Inicialización: ${k} medias con k-means++, covarianzas esféricas y pesos iguales.`
        : fase === 'E' ? `Iteración ${it}, paso E: responsabilidades r_ik = π_k N(x_i | μ_k, Σ_k) / Σ_j π_j N(x_i | μ_j, Σ_j).`
          : fase === 'M' ? `Iteración ${it}, paso M: cada π_k, μ_k y Σ_k se recalcula como promedio ponderado por r_ik.`
            : `Convergió en ${it} iteraciones: la log-verosimilitud dejó de cambiar.`;
      lectura.set([
        ['iteración', String(it)],
        ['log-verosimilitud media', historia.length ? historia[historia.length - 1].toFixed(4) : '—'],
        ['pesos de las componentes', g.pi.map((v) => v.toFixed(2)).join(', ')],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('clustering', {
    intro: String.raw`
      <p><strong>Agrupar</strong> (<em>clustering</em>) es encontrar grupos en datos sin etiquetas: objetos parecidos entre sí y
      distintos de los de otros grupos. No hay una única respuesta correcta, porque «parecido» y «grupo» se pueden definir de muchas
      maneras, y cada algoritmo trae su propia definición.</p>
      <p><a href="tema.html?id=kmeans">k-means</a> busca grupos compactos alrededor de un centro; las <strong>mezclas gaussianas</strong>
      admiten grupos elípticos de distinto tamaño; <strong>DBSCAN</strong> define un grupo como una región densa y deja fuera el ruido;
      el <a href="tema.html?id=unsupervised-learning">agrupamiento jerárquico</a> de enlace simple encadena vecinos cercanos.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuatro algoritmos sobre los mismos datos',
        descripcion: 'Elija un conjunto de datos y un algoritmo. El índice de Rand ajustado compara los grupos con las clases reales: 1 es acuerdo perfecto y 0, el de una partición al azar.',
        montar: montarComparacion,
      },
      {
        titulo: 'Mezcla gaussiana con EM, paso a paso',
        descripcion: 'El algoritmo EM alterna un paso E, que reparte cada punto entre las componentes, y un paso M, que reajusta cada gaussiana.',
        montar: montarEM,
      },
    ],
    teoria: String.raw`
      <h2>Mezclas gaussianas y EM</h2>
      <p>El modelo supone que cada punto viene de una de \(K\) gaussianas, elegida con probabilidad \(\pi_k\):</p>
      \[ p(x) = \sum_{k=1}^{K} \pi_k\, \mathcal{N}(x \mid \mu_k, \Sigma_k). \]
      <p>Maximizar la verosimilitud directamente es difícil porque no se sabe de qué componente viene cada punto. El algoritmo
      <strong>EM</strong> (Dempster, Laird y Rubin, 1977) alterna:</p>
      <pre><code>repetir hasta que la log-verosimilitud no cambie:
    E:  r_ik ← π_k N(x_i | μ_k, Σ_k) / Σ_j π_j N(x_i | μ_j, Σ_j)
    M:  N_k ← Σ_i r_ik
        π_k ← N_k / n
        μ_k ← Σ_i r_ik x_i / N_k
        Σ_k ← Σ_i r_ik (x_i − μ_k)(x_i − μ_k)ᵀ / N_k</code></pre>
      <p>Cada iteración aumenta (o deja igual) la log-verosimilitud, pero puede converger a un máximo local: se repite con varias
      inicializaciones. Si las covarianzas se fijan en \(\sigma^2 I\) y \(\sigma \to 0\), las responsabilidades se vuelven 0 o 1 y EM se
      convierte en k-means.</p>
      <h2>DBSCAN</h2>
      <p>Un punto es <em>núcleo</em> si tiene al menos \(\text{minPts}\) vecinos a distancia \(\le \varepsilon\). Un grupo es el conjunto de
      núcleos conectados por cadenas de vecinos, más los puntos de borde que alcanzan; lo demás es <em>ruido</em>. Encuentra grupos de
      cualquier forma y su número sale solo, pero un único \(\varepsilon\) no sirve si los grupos tienen densidades muy distintas.
      Cuesta \(O(n^2)\), o \(O(n \log n)\) con un índice espacial.</p>
      <h2>Enlace simple</h2>
      <p>Une siempre los dos grupos con los puntos más cercanos. Equivale a construir el árbol de expansión mínima
      (<a href="tema.html?id=prim">Prim</a> o <a href="tema.html?id=kruskal">Kruskal</a>) y cortar sus \(k - 1\) aristas más largas. Sigue
      formas alargadas, pero sufre el <em>efecto cadena</em>: un puente de pocos puntos une dos grupos.</p>
      <h2>Comparación</h2>
      <table>
        <tr><th>Algoritmo</th><th>Grupo</th><th>Parámetros</th><th>Costo</th></tr>
        <tr><td>k-means</td><td>esférico, alrededor de un centro</td><td>\(k\)</td><td>\(O(nkt)\)</td></tr>
        <tr><td>mezcla gaussiana</td><td>elíptico, con solapamiento suave</td><td>\(k\)</td><td>\(O(nkd^2t)\)</td></tr>
        <tr><td>DBSCAN</td><td>región densa de cualquier forma</td><td>\(\varepsilon\), minPts</td><td>\(O(n^2)\)</td></tr>
        <tr><td>enlace simple</td><td>cadena de vecinos</td><td>\(k\) o altura de corte</td><td>\(O(n^2)\)</td></tr>
      </table>
      <h2>Evaluar un agrupamiento</h2>
      <p>Si se conocen las clases verdaderas, el <strong>índice de Rand ajustado</strong> cuenta los pares de puntos en que ambas
      particiones coinciden (juntos en las dos o separados en las dos), corregido para que una partición al azar dé 0. Sin etiquetas
      se usan criterios internos como el coeficiente de silueta, o para las mezclas, criterios de información (BIC) que penalizan
      el número de parámetros al elegir \(k\).</p>`,
  });
})();
