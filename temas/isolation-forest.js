(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  // c(n): largo medio de un camino sin éxito en un árbol binario de búsqueda con n datos.
  const H = (i) => Math.log(i) + 0.5772156649;
  const cn = (n) => (n > 2 ? 2 * H(n - 1) - (2 * (n - 1)) / n : n === 2 ? 1 : 0);
  function datos(semilla) {
    const pts = M.datos2d('manchas', 200, semilla, { dispersion: 0.9 });
    const rnd = VIZ.semilla(semilla + 50);
    for (let i = 0; i < 8; i++) pts.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, g: -1 });
    return pts;
  }
  // Árbol de aislamiento sobre la submuestra idx, con altura máxima lim.
  function arbol(pts, idx, rnd, lim, prof = 0) {
    if (prof >= lim || idx.length <= 1) return { n: idx.length };
    const eje = rnd() < 0.5 ? 'x' : 'y', v = idx.map((i) => pts[i][eje]), a = Math.min(...v), b = Math.max(...v);
    if (a === b) return { n: idx.length };
    const corte = a + rnd() * (b - a);
    return { eje, corte, izq: arbol(pts, idx.filter((i) => pts[i][eje] < corte), rnd, lim, prof + 1), der: arbol(pts, idx.filter((i) => pts[i][eje] >= corte), rnd, lim, prof + 1) };
  }
  function largo(nd, p, prof = 0) {
    if (!nd.eje) return prof + cn(nd.n);
    return largo(p[nd.eje] < nd.corte ? nd.izq : nd.der, p, prof + 1);
  }
  function bosque(pts, t, psi, semilla) {
    const rnd = VIZ.semilla(semilla), lim = Math.ceil(Math.log2(psi)), arboles = [];
    for (let k = 0; k < t; k++) arboles.push(arbol(pts, M.barajar(pts.map((_, i) => i), rnd).slice(0, psi), rnd, lim));
    const c = cn(psi);
    return { arboles, puntaje: (p) => 2 ** (-M.media(arboles.map((a) => largo(a, p))) / c) };
  }
  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.1 * a, xmax: 1.1 * a, ymin: -1.1, ymax: 1.1 } }); };

  /* ---------- Fig. 1: aislar un punto ---------- */

  function montarAislar(cuerpo) {
    let semilla = 1, pts = datos(semilla), objetivo = pts.length - 1, arbolN = 1, est = null, historia = [], B = null;
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Otro árbol', () => { arbolN++; rep.reiniciar(); });
    ctl.boton('Nuevos datos', () => { semilla++; pts = datos(semilla); objetivo = pts.length - 1; historia = []; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'punto que se quiere aislar', forma: 'punto' },
      { color: C.s1, texto: 'puntos que siguen en su región', forma: 'punto' },
      { color: C.inactivo, texto: 'puntos ya separados', forma: 'punto' },
      { color: C.tinta, texto: 'cortes al azar', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un punto para aislarlo. Cada corte elige un eje al azar y un valor al azar dentro de la región actual; se sigue hasta que el punto queda solo. Compare cuántos cortes necesita un punto suelto y uno del centro de una mancha.');
    function iniciar() {
      const rnd = VIZ.semilla(semilla * 1000 + arbolN * 7 + objetivo);
      est = { caja: [-1.1, 1.1, -1.1, 1.1], vivos: pts.map((_, i) => i), cortes: [], prof: 0 };
      return (function* () {
        while (est.vivos.length > 1) {
          const eje = rnd() < 0.5 ? 'x' : 'y', v = est.vivos.map((i) => pts[i][eje]), a = Math.min(...v), b = Math.max(...v);
          if (a === b) break;
          const corte = a + rnd() * (b - a), [x0, x1, y0, y1] = est.caja;
          est.cortes.push(eje === 'x' ? [[corte, y0], [corte, y1]] : [[x0, corte], [x1, corte]]);
          const izq = pts[objetivo][eje] < corte;
          est.vivos = est.vivos.filter((i) => (pts[i][eje] < corte) === izq);
          if (eje === 'x') est.caja = izq ? [x0, corte, y0, y1] : [corte, x1, y0, y1]; else est.caja = izq ? [x0, x1, y0, corte] : [x0, x1, corte, y1];
          est.prof++;
          yield;
        }
        historia.push(est.prof);
      })();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      const [x0, x1, y0, y1] = est.caja;
      ctx.save(); pl.recortar();
      ctx.fillStyle = C.neutro; ctx.fillRect(pl.sx(x0), pl.sy(y1), pl.sx(x1) - pl.sx(x0), pl.sy(y0) - pl.sy(y1));
      est.cortes.forEach((c, i) => VIZ.trazar(ctx, pl, c, i === est.cortes.length - 1 ? C.s2 : C.tinta, i === est.cortes.length - 1 ? 2.5 : 1.2));
      ctx.restore();
      const vivos = new Set(est.vivos);
      M.dispersion(ctx, pl, pts, { color: (p, i) => (i === objetivo ? C.s2 : vivos.has(i) ? C.s1 : C.inactivo), r: (p, i) => (i === objetivo ? 6 : 3.5) });
      registro.textContent = est.vivos.length > 1 ? `Corte ${est.prof}: quedan ${est.vivos.length} puntos en la región del objetivo.` : `Aislado tras ${est.prof} cortes.`;
      if (!B || B.pts !== pts) { B = bosque(pts, 100, 256, 7); B.pts = pts; }
      lectura.set([
        ['cortes en este árbol', String(est.prof)],
        ['promedio de árboles vistos', historia.length ? `${VIZ.fmt(M.media(historia), 3)} (${historia.length})` : '—'],
        ['c(n) con n = ' + pts.length, VIZ.fmt(cn(pts.length), 3)],
        ['puntaje s con 100 árboles', VIZ.fmt(B.puntaje(pts[objetivo]), 3)],
      ]);
    }
    lienzo.alDibujar = () => est && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m >= 0) { objetivo = m; historia = []; rep.reiniciar(); }
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el mapa de puntajes ---------- */

  function montarMapa(cuerpo) {
    let t = 100, psi = 64, cont = 0.05, semilla = 1, pts = datos(semilla), B = null, s = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Árboles t', min: 1, max: 200, valor: t, alCambiar: (v) => { t = v; }, alSoltar: () => calcular() });
    ctl.rango({ etiqueta: 'Submuestra ψ', min: 8, max: 208, paso: 8, valor: psi, alCambiar: (v) => { psi = v; }, alSoltar: () => calcular() });
    ctl.rango({ etiqueta: 'Contaminación', min: 0.01, max: 0.2, paso: 0.01, valor: cont, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { cont = v; dibujar(); } });
    ctl.boton('Nuevo bosque', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'puntaje s ≈ 0,4 (normal)' },
      { color: VIZ.css(VIZ.enRampa(0.95)), texto: 's cercano a 1 (anómalo)' },
      { color: C.s8, texto: 'marcados como atípicos', forma: 'linea' },
      { color: C.tinta, texto: 'dato', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El fondo es el puntaje s(x) que daría el bosque a un punto en cada lugar. Con un solo árbol el mapa es de bloques; al promediar muchos se suaviza. Pase el cursor para leer s.');
    function calcular() { B = bosque(pts, t, Math.min(psi, pts.length), semilla); s = pts.map(B.puntaje); dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      const paso = 7;
      for (let px = pl.x0; px < pl.x1; px += paso) for (let py = pl.y1; py < pl.y0; py += paso) {
        const v = B.puntaje({ x: pl.ix(px + paso / 2), y: pl.iy(py + paso / 2) });
        ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.max(0, Math.min(1, (v - 0.35) / 0.4))));
        ctx.globalAlpha = 0.55; ctx.fillRect(px, py, paso, paso); ctx.globalAlpha = 1;
      }
      pl.ejes();
      const umbral = M.cuantil(s, 1 - cont);
      M.dispersion(ctx, pl, pts, { color: () => C.tinta, r: 3, anillo: (p, i) => (s[i] >= umbral ? C.s8 : null) });
      const plantados = pts.map((p, i) => [p, i]).filter(([p]) => p.g < 0).map(([, i]) => i);
      lectura.set([
        ['umbral de puntaje', VIZ.fmt(umbral, 3)],
        ['marcados', String(s.filter((v) => v >= umbral).length)],
        ['atípicos plantados detectados', `${plantados.filter((i) => s[i] >= umbral).length} de ${plantados.length}`],
        ['altura máxima de cada árbol', String(Math.ceil(Math.log2(Math.min(psi, pts.length))))],
      ]);
    }
    lienzo.alDibujar = () => B && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const p = { x: pl.ix(x), y: pl.iy(y) };
      tip.mostrar(x, y, `s(x) = <b>${VIZ.fmt(B.puntaje(p), 3)}</b><br>largo medio <b>${VIZ.fmt(M.media(B.arboles.map((a) => largo(a, p))), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('isolation-forest', {
    intro: String.raw`
      <p>Los métodos de distancia o densidad describen cómo son los datos normales y marcan lo que no encaja.
      <strong>Isolation Forest</strong> (Liu, Ting y Zhou, 2008) invierte la idea: en vez de perfilar lo normal, intenta
      <strong>aislar</strong> cada punto con cortes al azar. Los atípicos son pocos y distintos, así que quedan solos tras muy pocos cortes.</p>
      <p>Repetirlo con muchos árboles y promediar la profundidad a la que se aísla cada punto da un puntaje de anomalía rápido,
      que no calcula ninguna distancia y escala bien a muchos datos.</p>`,
    visualizaciones: [
      {
        titulo: 'Aislar un punto',
        descripcion: 'Cortes aleatorios hasta que el punto elegido queda solo en su región. Pulse «Otro árbol» varias veces para ver cómo varía la profundidad.',
        montar: montarAislar,
      },
      {
        titulo: 'El mapa de puntajes',
        descripcion: 'El puntaje de anomalía del bosque en todo el plano. Pruebe t = 1 y t = 200, y una submuestra ψ pequeña.',
        montar: montarMapa,
      },
    ],
    teoria: String.raw`
      <h2>Árbol de aislamiento</h2>
      <pre><code>iTree(X, prof, lím):
    si prof ≥ lím o |X| ≤ 1: devolver hoja(|X|)
    q ← atributo al azar
    p ← valor uniforme entre min(X_q) y max(X_q)
    devolver nodo(q, p, iTree({x : x_q &lt; p}, prof + 1, lím), iTree({x : x_q ≥ p}, prof + 1, lím))</code></pre>
      <p>Cada árbol se construye sobre una <strong>submuestra</strong> de tamaño \(\psi\) (típicamente 256) con altura límite
      \(\lceil \log_2 \psi \rceil\): no hace falta seguir dividiendo lo que claramente es normal.</p>
      <h2>Profundidad de aislamiento y puntaje</h2>
      <p>La longitud del camino \(h(x)\) es el número de aristas desde la raíz hasta la hoja de \(x\), más una corrección \(c(m)\) si la
      hoja tiene \(m\) puntos sin separar. Se normaliza con el largo esperado de una búsqueda sin éxito en un árbol binario de búsqueda:</p>
      \[ c(n) = 2H(n-1) - \frac{2(n-1)}{n}, \qquad H(i) \approx \ln i + 0{,}5772, \]
      \[ s(x, \psi) = 2^{-\,\mathbb{E}[h(x)] / c(\psi)}. \]
      <ul>
        <li>\(s \to 1\): se aísla mucho antes de lo esperado → anomalía.</li>
        <li>\(s \approx 0{,}5\) o menos para todos: no hay anomalías claras.</li>
      </ul>
      <h2>Por qué funciona</h2>
      <p>Un corte uniforme en \([\min, \max]\) cae con mayor probabilidad en los huecos grandes. Un punto lejos del resto queda separado
      por cualquier corte que caiga en el hueco que lo rodea, así que su profundidad esperada es pequeña. La submuestra reduce el
      <em>enmascaramiento</em> (muchos atípicos juntos que se protegen entre sí) y el <em>swamping</em> (normales marcados por estar cerca de atípicos).</p>
      <h2>Costo y límites</h2>
      <p>Entrenar cuesta \(O(t\, \psi \log \psi)\) y puntuar \(n\) datos \(O(n\, t \log \psi)\): lineal en \(n\). Al cortar solo en paralelo a
      los ejes, el mapa tiene artefactos en cruz; la variante <em>Extended Isolation Forest</em> usa hiperplanos con orientación al azar.
      Al ser global, puede pasar por alto atípicos locales que <a href="tema.html?id=local-outlier-factor">LOF</a> sí encuentra.</p>`,
  });
})();