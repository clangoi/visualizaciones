(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: principios de agrupamiento ---------- */

  function montarPrincipios(cuerpo) {
    const e = { p: 'proximidad', v: 0.5 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Principio', valor: e.p, opciones: [['proximidad', 'Proximidad'], ['similitud', 'Similitud'], ['conexion', 'Conexión'], ['encierro', 'Encierro'], ['cierre', 'Cierre'], ['continuidad', 'Continuidad']], alCambiar: (v) => { e.p = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Intensidad del factor', min: 0, max: 1, paso: 0.05, valor: e.v, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { e.v = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 330 });
    cuerpo.dataset.sinLeyenda = 'los colores solo refuerzan el principio mostrado; la explicación está en el registro';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'La rejilla es idéntica en todos los casos; lo único que cambia es el factor de agrupamiento. Con intensidad 0 vea la rejilla sin agrupar; súbala y observe qué se ve como «filas» o «columnas».');
    const TXT = {
      proximidad: 'Proximidad: las marcas cercanas se ven como un grupo. Al separar las columnas, la rejilla se ve como filas… o al revés.',
      similitud: 'Similitud: las marcas parecidas (color, forma) se agrupan aunque no estén juntas.',
      conexion: 'Conexión: una línea que une marcas las agrupa con más fuerza que la proximidad o el color.',
      encierro: 'Encierro: un contorno común agrupa lo que contiene, aunque las marcas estén separadas.',
      cierre: 'Cierre: el cerebro completa contornos con huecos pequeños y ve una figura entera.',
      continuidad: 'Continuidad: las marcas que siguen una curva suave se ven como una sola trayectoria.',
    };
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const nf = 5, nc = 8, cx = W / 2, cy = H / 2, dx0 = Math.min(40, (W - 60) / nc), dy0 = Math.min(40, (H - 40) / nf);
      const v = e.v;
      const pos = (f, c) => {
        let x = cx + (c - (nc - 1) / 2) * dx0, y = cy + (f - (nf - 1) / 2) * dy0;
        if (e.p === 'proximidad') x += (c < 4 ? -1 : 1) * v * 24;
        return [x, y];
      };
      if (e.p === 'continuidad') {
        const R = (t) => [W * 0.1 + t * W * 0.8, H / 2 + Math.sin(t * Math.PI * 2) * H * 0.28], R2 = (t) => [W * 0.1 + t * W * 0.8, H / 2 - Math.sin(t * Math.PI * 2) * H * 0.28];
        for (const f of [R, R2]) for (let i = 0; i <= 14; i++) { const [x, y] = f(i / 14); ctx.fillStyle = f === R ? C.s1 : C.s2; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill(); }
        ctx.strokeStyle = C.tenue; ctx.lineWidth = 1.5; ctx.setLineDash([2, 4]);
        for (const f of [R, R2]) { ctx.beginPath(); for (let i = 0; i <= 60; i++) { const [x, y] = f(i / 60); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.globalAlpha = v; ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.setLineDash([]);
      } else if (e.p === 'cierre') {
        const R = Math.min(H, W) * 0.34, hueco = (1 - v) * 0.9 + 0.05;
        [[cx - R * 1.4, cy, C.s1], [cx + R * 1.4, cy, C.s2]].forEach(([x, y, col], k) => { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); if (k === 0) ctx.arc(x, y, R, hueco, Math.PI * 2 - hueco); else { ctx.rect(x - R, y - R, 2 * R, 2 * R); } ctx.stroke(); if (k === 1) { ctx.fillStyle = C.superficie; ctx.fillRect(x - R * 0.2 - 4, y - R - 4, R * 0.4 + 8, 8 + hueco * 12); } });
      } else {
        const filas = [];
        for (let f = 0; f < nf; f++) for (let c = 0; c < nc; c++) filas.push([f, c]);
        if (e.p === 'encierro') { ctx.strokeStyle = VIZ.alfa(C.s3, v); ctx.lineWidth = 2.5; for (let g = 0; g < 2; g++) { const [x0, y0] = pos(0, g * 4), [x1, y1] = pos(nf - 1, g * 4 + 3); ctx.beginPath(); ctx.roundRect(x0 - 16, y0 - 16, x1 - x0 + 32, y1 - y0 + 32, 10); ctx.stroke(); } }
        if (e.p === 'conexion') { ctx.strokeStyle = VIZ.alfa(C.s3, v); ctx.lineWidth = 3; for (let f = 0; f < nf; f++) for (let c = 0; c < nc - 1; c += 2) { const [x0, y0] = pos(f, c), [x1, y1] = pos(f, c + 1); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } }
        filas.forEach(([f, c]) => {
          const [x, y] = pos(f, c); let col = C.tinta2, forma = 0;
          if (e.p === 'similitud') { const alt = f % 2 === 0; col = alt ? (v > 0.05 ? C.s1 : C.tinta2) : (v > 0.05 ? C.s2 : C.tinta2); ctx.globalAlpha = 0.4 + 0.6 * v; forma = v > 0.5 ? (alt ? 0 : 1) : 0; }
          ctx.fillStyle = col; ctx.beginPath(); VIZ.forma(ctx, x, y, 5, forma); ctx.fill(); ctx.globalAlpha = 1;
        });
      }
      registro.textContent = TXT[e.p];
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: agrupar en un gráfico de dispersión ---------- */

  function montarDispersion(cuerpo) {
    const e = { color: false, encierro: false, cerca: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas([{ clave: 'color', texto: 'Color por grupo', activo: false }, { clave: 'encierro', texto: 'Contorno por grupo', activo: false }, { clave: 'cerca', texto: 'Separar los grupos en el espacio', activo: false }], (s) => { Object.assign(e, s); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'grupo A' }, { color: C.s2, texto: 'grupo B' }, { color: C.s3, texto: 'grupo C' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Sin ninguna ayuda, ¿cuántos grupos ve? Active cada señal por separado: el color, el contorno y la distancia entre grupos son tres maneras distintas de llevar al lector a la misma conclusión.');
    const rnd = VIZ.semilla(8);
    const PTS = Array.from({ length: 45 }, (_, i) => { const g = i % 3; const c = [[30, 35], [55, 62], [75, 30]][g]; return { g, x: c[0] + VIZ.normal(rnd) * 9, y: c[1] + VIZ.normal(rnd) * 9, i }; });
    let pts = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 100 }, { etiquetaX: 'atributo 1', etiquetaY: 'atributo 2' });
      plano.ejes();
      const COL = [C.s1, C.s2, C.s3];
      const P = PTS.map((p) => ({ ...p, x: e.cerca ? p.x + (p.g - 1) * 10 : 50 + (p.x - 50) * 0.8, y: p.y }));
      if (e.encierro) for (let g = 0; g < 3; g++) { const q = P.filter((p) => p.g === g), mx = q.reduce((s, p) => s + p.x, 0) / q.length, my = q.reduce((s, p) => s + p.y, 0) / q.length, r = Math.max(...q.map((p) => Math.hypot(p.x - mx, p.y - my))) * 1.1; ctx.strokeStyle = COL[g]; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(plano.sx(mx), plano.sy(my), Math.abs(plano.sx(r) - plano.sx(0)), Math.abs(plano.sy(r) - plano.sy(0)), 0, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); }
      pts = P.map((p) => ({ px: plano.sx(p.x), py: plano.sy(p.y), g: p.g, i: p.i }));
      pts.forEach((p) => { VIZ.marcador(ctx, p.px, p.py, e.color ? COL[p.g] : C.tinta2, 4.5); });
      registro.textContent = [e.color && 'color', e.encierro && 'encierro', e.cerca && 'proximidad'].filter(Boolean).length ? `Señales de agrupamiento activas: ${[e.color && 'similitud (color)', e.encierro && 'encierro (contorno)', e.cerca && 'proximidad (distancia)'].filter(Boolean).join(', ')}.` : 'Sin señales: los puntos se perciben como una sola nube.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const p = V.cercano(pts, x, y, 10); if (!p) return tip.ocultar(); tip.mostrar(x, y, `punto ${p.i} · grupo ${'ABC'[p.g]}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('gestalt-grouping', {
    intro: String.raw`
      <p>La psicología de la <strong>Gestalt</strong> estudió cómo el cerebro organiza lo que ve en conjuntos, sin que nadie se lo pida: dos puntos juntos «van juntos», una línea que los une los liga, un contorno los encierra. Esas reglas de agrupamiento rigen cómo se lee una visualización.</p>
      <p>Usarlas bien permite mostrar relaciones sin etiquetas; ignorarlas crea relaciones falsas, como agrupar por cercanía cosas que no tienen nada en común.</p>`,
    visualizaciones: [
      { titulo: 'Seis principios de agrupamiento', descripcion: 'Elija un principio y varíe su intensidad sobre la misma rejilla de puntos.', montar: montarPrincipios },
      { titulo: 'Agrupar marcas en un gráfico', descripcion: 'Active el color, el contorno y la separación espacial para llevar a la misma conclusión por tres vías.', montar: montarDispersion },
    ],
    teoria: String.raw`
      <h2>Principios</h2>
      <table>
        <tr><th>Principio</th><th>Regla</th><th>Uso en visualización</th></tr>
        <tr><td>proximidad</td><td>lo cercano se agrupa</td><td>espacio entre grupos de barras; paneles</td></tr>
        <tr><td>similitud</td><td>lo parecido se agrupa</td><td>color o forma por categoría</td></tr>
        <tr><td>conexión</td><td>lo conectado se agrupa</td><td>líneas, aristas en grafos</td></tr>
        <tr><td>encierro</td><td>lo contenido se agrupa</td><td>regiones, tarjetas, contornos</td></tr>
        <tr><td>cierre</td><td>se completan contornos incompletos</td><td>ejes y marcos mínimos</td></tr>
        <tr><td>continuidad</td><td>se siguen trayectorias suaves</td><td>series de línea que se cruzan</td></tr>
      </table>
      <h2>Jerarquía de fuerza</h2>
      <p>Cuando varios principios compiten, los experimentos indican este orden aproximado de fuerza: conexión \(>\) encierro \(>\) proximidad \(>\) similitud. Una línea entre dos puntos distantes los une más que un mismo color.</p>
      <h2>Por qué importa</h2>
      <ul>
        <li>Los <em>espacios en blanco</em> son una herramienta: separan sin dibujar bordes.</li>
        <li>La leyenda debe estar <em>cerca</em> de lo que explica; si no, se agrupa con otra cosa.</li>
        <li>Alinear elementos relacionados reduce el esfuerzo visual (ver <a href="tema.html?id=dashboard-layout-design">diseño de dashboards</a>).</li>
      </ul>
      <div class="recuadro"><strong>Cuidado.</strong> En un gráfico de dispersión, el color agrupa pero también compite con la posición: si el color no corresponde a una categoría real, crea grupos que no existen.</div>
      <p>La búsqueda y la detección de grupos se complementa con el <a href="tema.html?id=preattentive-processing">procesamiento preatencional</a>.</p>`,
  });
})();
