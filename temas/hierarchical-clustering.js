(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const ENLACES = [['simple', 'Single linkage'], ['completo', 'Complete linkage'], ['promedio', 'Average linkage'], ['ward', 'Ward']];
  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };

  // Envolvente convexa (cadena monótona) de una lista de puntos {x, y}.
  function envolvente(P) {
    const s = P.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (s.length < 3) return s;
    const cruz = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const inf = [], sup = [];
    for (const p of s) { while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], p) <= 0) inf.pop(); inf.push(p); }
    for (const p of s.slice().reverse()) { while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], p) <= 0) sup.pop(); sup.push(p); }
    return inf.slice(0, -1).concat(sup.slice(0, -1));
  }

  /* ---------- Fig. 1: fusiones y dendrograma ---------- */

  function montarPasos(cuerpo) {
    let enlace = 'promedio', n = 24, semilla = 2, pts = [], F = [], t = 0, cortarEn = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Enlace', opciones: ENLACES, valor: enlace, alCambiar: (v) => { enlace = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Puntos n', min: 6, max: 40, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.35) : Math.min(400, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'fusión del paso actual', forma: 'linea' },
      { color: C.s1, texto: 'grupos ya formados', forma: 'linea' },
      { color: C.tinta, texto: 'dendrograma: altura = distancia de fusión', forma: 'linea' },
      { color: C.s4, texto: 'corte (clic en el dendrograma)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso une los dos grupos más cercanos según el enlace. Haga clic en el dendrograma para cortarlo a esa altura: los grupos que quedan bajo el corte se colorean en el gráfico de puntos.');
    function iniciar() {
      pts = M.datos2d('manchas', n, semilla, { dispersion: 1.6 });
      F = M.aglomerativo(pts.map(M.xy), enlace);
      t = 0; cortarEn = null;
      return (function* () { while (t < F.length) { t++; yield; } })();
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.55 : H;
      // Izquierda: los grupos.
      const pl = planoDatos({ ...lienzo, ancho: wA, alto: hA, ctx });
      pl.ejes();
      const et = cortarEn != null ? M.cortar(F, n, { h: cortarEn }) : M.cortar(F, n, { k: n - t });
      const K = Math.max(...et) + 1;
      ctx.save(); pl.recortar();
      for (let g = 0; g < K; g++) {
        const miembros = pts.filter((_, i) => et[i] === g);
        if (miembros.length < 2) continue;
        const actual = cortarEn == null && t > 0 && (() => { const f = F[t - 1]; const hojas = []; const hijos = new Map(F.map((x) => [x.nuevo, [x.a, x.b]])); (function v(id) { if (id < n) hojas.push(id); else hijos.get(id).forEach(v); })(f.nuevo); return hojas.length === miembros.length && hojas.every((i) => et[i] === g); })();
        const h = envolvente(miembros), col = cortarEn != null ? M.colorGrupo(g) : actual ? C.s2 : C.s1;
        ctx.beginPath(); h.forEach((p, i) => (i ? ctx.lineTo(pl.sx(p.x), pl.sy(p.y)) : ctx.moveTo(pl.sx(p.x), pl.sy(p.y)))); ctx.closePath();
        ctx.fillStyle = VIZ.alfa(col, 0.1); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = actual ? 2.5 : 1.5; ctx.lineJoin = 'round'; ctx.stroke();
      }
      ctx.restore();
      M.dispersion(ctx, pl, pts, { color: (p, i) => (cortarEn != null ? M.colorGrupo(et[i]) : C.tinta2), forma: (p, i) => (cortarEn != null ? et[i] : 0), r: 3.5 });
      // Derecha: dendrograma.
      ctx.save();
      const ox = vertical ? 0 : wA, oy = vertical ? hA + 8 : 0;
      ctx.translate(ox, oy);
      const sub = { ...lienzo, ancho: vertical ? W : W - wA, alto: vertical ? H - hA - 8 : H, ctx };
      const hmax = F[F.length - 1].h * 1.05;
      const pd = VIZ.plano(sub, { xmin: -0.5, xmax: n - 0.5, ymin: 0, ymax: hmax }, { etiquetaY: 'distancia de fusión', ticksX: [], margen: { izq: 48 } });
      pd.ejes();
      const { nodos } = M.dendrograma(F, n);
      F.forEach((f, i) => {
        const a = nodos.get(f.a), b = nodos.get(f.b), col = i === t - 1 ? C.s2 : i < t ? C.tinta : C.tenue;
        VIZ.trazar(ctx, pd, [[a.x, a.h], [a.x, f.h], [b.x, f.h], [b.x, b.h]], col, i === t - 1 ? 2.5 : 1.5);
      });
      if (cortarEn != null) VIZ.trazar(ctx, pd, [[-0.5, cortarEn], [n - 0.5, cortarEn]], C.s4, 2, [5, 4]);
      ctx.restore();
      geo = { pd, ox, oy };
      const f = t ? F[t - 1] : null;
      registro.textContent = cortarEn != null ? `Corte a la altura ${VIZ.fmt(cortarEn, 3)}: quedan ${K} grupos.` : f ? `Paso ${t}: se unen dos grupos a distancia ${VIZ.fmt(f.h, 3)}; el nuevo tiene ${f.tam} puntos.` : 'Al inicio cada punto es su propio grupo.';
      lectura.set([
        ['grupos', String(K)],
        ['fusiones', `${t} / ${n - 1}`],
        ['última altura', f ? VIZ.fmt(f.h, 3) : '—'],
        ['mayor salto entre alturas', VIZ.fmt(Math.max(...F.slice(1).map((x, i) => x.h - F[i].h)), 3)],
      ]);
    }
    lienzo.alDibujar = () => F.length && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.pd.dentro(x - geo.ox, y - geo.oy)) return;
      cortarEn = Math.max(0, geo.pd.iy(y - geo.oy)); t = F.length;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.pd.dentro(x - geo.ox, y - geo.oy)) return tip.ocultar();
      const h = geo.pd.iy(y - geo.oy);
      tip.mostrar(x, y, `altura <b>${VIZ.fmt(h, 3)}</b><br>grupos al cortar aquí <b>${F.filter((f) => f.h > h).length + 1}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'crosshair';
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cuatro enlaces ---------- */

  function montarEnlaces(cuerpo) {
    let tipo = 'lunas', k = 2, semilla = 1, pts = [], F = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; k = v === 'lunas' || v === 'anillos' ? 2 : 3; rK.valor = k; generar(); } });
    const rK = ctl.rango({ etiqueta: 'Grupos k', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 2.6) : Math.round(w * 0.62)) });
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con lunas o anillos solo el enlace simple encadena los puntos a lo largo de cada forma; los otros cortan por la mitad. Con manchas de densidad distinta, el enlace simple une todo en un grupo y deja puntos sueltos.');
    function generar() { pts = M.datos2d(tipo, 140, semilla); F = Object.fromEntries(ENLACES.map(([e]) => [e, M.aglomerativo(pts.map(M.xy), e)])); dibujar(); }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, cols = vertical ? 1 : 2, filas = vertical ? 4 : 2, w = W / cols, h = H / filas;
      const verdad = pts.map((p) => p.g);
      const res = ENLACES.map(([e, nombre], j) => {
        const et = M.cortar(F[e], pts.length, { k });
        ctx.save(); ctx.translate((j % cols) * w, Math.floor(j / cols) * h);
        const pl = planoDatos({ ...lienzo, ancho: w, alto: h, ctx });
        pl.ejes();
        M.dispersion(ctx, pl, pts, { color: (p, i) => M.colorGrupo(et[i]), forma: (p, i) => et[i], r: 3.2 });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(nombre, pl.x1 - 4, pl.y1 + 4);
        ctx.restore();
        return [nombre, M.randAjustado(et, verdad), Math.max(...[...new Set(et)].map((g) => et.filter((x) => x === g).length))];
      });
      leyenda.set(M.leyendaGrupos(k));
      lectura.set(res.map(([nombre, ari, mayor]) => [`${nombre}: ARI · grupo mayor`, `${VIZ.fmt(ari, 2)} · ${mayor}`]));
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    generar();
  }

  VIZ.registrarTema('hierarchical-clustering', {
    intro: String.raw`
      <p>El <strong>clustering aglomerativo jerárquico</strong> (HAC) no entrega una sola partición sino una <strong>jerarquía</strong>
      completa: parte con cada punto como su propio grupo y, en cada paso, une los dos grupos más cercanos, hasta que queda uno solo.</p>
      <p>El resultado se dibuja como un <strong>dendrograma</strong>, un árbol cuya altura marca la distancia a la que se produjo
      cada fusión. Cortarlo a una altura da los grupos. La pregunta clave es cómo medir la distancia entre dos grupos: eso
      es el <strong>enlace</strong> (<em>linkage</em>), y cambia por completo el resultado.</p>`,
    visualizaciones: [
      {
        titulo: 'Fusiones y dendrograma',
        descripcion: 'El algoritmo paso a paso, con el dendrograma creciendo a la derecha. Busque el salto más grande entre alturas: es un buen lugar para cortar.',
        montar: montarPasos,
      },
      {
        titulo: 'Cuatro enlaces sobre los mismos datos',
        descripcion: 'Single, complete, average y Ward cortados en k grupos. El ARI compara con los grupos verdaderos (1 = idénticos, 0 = al azar).',
        montar: montarEnlaces,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>grupos ← {{x₁}, …, {x_n}}
mientras haya más de un grupo:
    (A, B) ← par de grupos con menor D(A, B)
    reemplazar A y B por A ∪ B ;  anotar la altura D(A, B)
    actualizar D(A ∪ B, C) para todo C</code></pre>
      <p>Con una matriz de distancias es \(O(n^3)\) en tiempo y \(O(n^2)\) en memoria; con colas de prioridad, \(O(n^2 \log n)\). Para
      el enlace simple hay algoritmos \(O(n^2)\) (SLINK, o vía el <a href="tema.html?id=mst-clustering">árbol de expansión mínima</a>).</p>
      <h2>Enlaces</h2>
      <table>
        <tr><th>Enlace</th><th>\(D(A, B)\)</th><th>Comportamiento</th></tr>
        <tr><td>Single</td><td>\(\min_{a \in A, b \in B} d(a, b)\)</td><td>formas alargadas; efecto cadena con ruido</td></tr>
        <tr><td>Complete</td><td>\(\max_{a, b} d(a, b)\)</td><td>grupos compactos de diámetro parecido</td></tr>
        <tr><td>Average (UPGMA)</td><td>\(\frac{1}{|A||B|}\sum_{a, b} d(a, b)\)</td><td>intermedio</td></tr>
        <tr><td>Ward</td><td>\(\frac{|A||B|}{|A| + |B|}\lVert \bar a - \bar b\rVert^2\)</td><td>minimiza el aumento de la suma de cuadrados dentro de grupos, como <a href="tema.html?id=kmeans">k-means</a></td></tr>
      </table>
      <p>Todas se actualizan con la fórmula de <strong>Lance–Williams</strong>:</p>
      \[ D(A \cup B, C) = \alpha_A D(A, C) + \alpha_B D(B, C) + \beta D(A, B) + \gamma\,|D(A, C) - D(B, C)|, \]
      <p>por ejemplo single: \(\alpha = \tfrac12, \beta = 0, \gamma = -\tfrac12\); complete: \(\gamma = +\tfrac12\).</p>
      <h2>Dendrograma y corte</h2>
      <p>Para single, complete, average y Ward las alturas son monótonas (cada fusión ocurre a una altura mayor o igual que la
      anterior), así que el dendrograma no tiene cruces. Cortar a la altura \(h\) da los grupos que se formaron por debajo de \(h\).
      Una heurística es cortar donde hay el mayor salto entre alturas consecutivas. La <strong>correlación cofenética</strong> mide
      cuánto respeta el dendrograma las distancias originales.</p>
      <div class="recuadro"><p>Las fusiones son definitivas: un mal paso temprano no se corrige. Por eso HAC es sensible al ruido y a
      empates, y conviene combinarlo con una <a href="tema.html?id=unsupervised-evaluation">evaluación de la estabilidad</a>.</p></div>`,
  });
})();