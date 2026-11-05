(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;
  const S = V.svg;

  const EASE = {
    lineal: (t) => t,
    cuad: (t) => t * t,
    suave: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    rebote: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  };
  const NOMBRES = [['lineal', 'lineal'], ['cuad', 'aceleración (t²)'], ['suave', 'suave (entrada y salida)'], ['rebote', 'rebote']];

  /* ---------- Fig. 1: una marca y su curva de aceleración ---------- */

  function montarEasing(cuerpo) {
    let tipo = 'suave', dur = 1.5, u = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Curva de aceleración', valor: tipo, opciones: NOMBRES, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Duración', min: 0.3, max: 4, paso: 0.1, valor: dur, formato: (v) => `${v} s`, alCambiar: (v) => { dur = v; } });
    const bucle = VIZ.bucle((dt) => { u += dt / 1000 / dur; if (u >= 1) { u = 1; dibujar(); return false; } dibujar(); return true; });
    ctl.boton('Animar', () => { bucle.detener(); u = 0; bucle.iniciar(); }, { primario: true });
    const svg = V.lienzoSvg(cuerpo, 400, 150);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 160 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'posición f(t) en el tiempo', forma: 'linea' }, { color: C.apagado, texto: 'tiempo transcurrido (t)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Animar». La marca recorre la misma distancia en el mismo tiempo con ritmos distintos; la curva inferior muestra posición frente a tiempo.');
    function dibujar() {
      const f = EASE[tipo], p = f(u);
      svg.replaceChildren(S('line', { x1: 30, y1: 75, x2: 370, y2: 75, stroke: C.eje, 'stroke-width': 2 }), S('circle', { cx: 30, cy: 75, r: 4, fill: C.apagado }), S('circle', { cx: 370, cy: 75, r: 4, fill: C.apagado }),
        S('circle', { cx: 30 + 340 * p, cy: 75, r: 14, fill: C.s2, stroke: C.superficie, 'stroke-width': 2 }));
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: -0.05, ymax: 1.1 }, { etiquetaX: 't / duración', margen: { izq: 40 } });
      plano.ejes();
      const pts = []; for (let k = 0; k <= 100; k++) pts.push([k / 100, f(k / 100)]);
      VIZ.trazar(ctx, plano, pts, C.s2, 2);
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.sx(u), plano.y0); ctx.lineTo(plano.sx(u), plano.y1); ctx.stroke(); ctx.setLineDash([]);
      VIZ.marcador(ctx, plano.sx(u), plano.sy(p), C.s2, 5);
      lectura.set([['t / duración', VIZ.fmt(u, 3)], ['f(t)', VIZ.fmt(p, 3)], ['posición', `${Math.round(30 + 340 * p)} px`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: barras que crecen en cascada ---------- */

  function montarCascada(cuerpo) {
    let retardo = 0.08, tipo = 'suave', u = 0, total = 1;
    const datos = [40, 72, 55, 90, 33, 66, 80, 48];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Retardo entre barras', min: 0, max: 0.2, paso: 0.01, valor: retardo, formato: (v) => `${v} s`, alCambiar: (v) => { retardo = v; } });
    ctl.selector({ etiqueta: 'Curva', valor: tipo, opciones: NOMBRES, alCambiar: (v) => { tipo = v; } });
    const bucle = VIZ.bucle((dt) => { u += dt / 1000; dibujar(); if (u >= total + retardo * datos.length) return false; return true; });
    ctl.boton('Animar', () => { bucle.detener(); u = 0; bucle.iniciar(); }, { primario: true });
    const svg = V.lienzoSvg(cuerpo, 400, 180);
    cuerpo.dataset.sinLeyenda = 'una sola serie, valor rotulado sobre cada barra';
    VIZ.nota(cuerpo, 'El retardo escalonado (<em>stagger</em>) dirige la vista de una barra a la siguiente. Con retardo 0 todas crecen a la vez.');
    function dibujar() {
      svg.replaceChildren(S('line', { x1: 20, y1: 160, x2: 390, y2: 160, stroke: C.eje }));
      datos.forEach((v, i) => {
        const p = EASE[tipo](Math.max(0, Math.min(1, (u - i * retardo) / total)));
        const h = (v / 100) * 140 * p;
        svg.append(S('rect', { x: 30 + i * 44, y: 160 - h, width: 32, height: h, fill: C.s1 }));
        if (p > 0.95) svg.append(S('text', { x: 46 + i * 44, y: 160 - h - 4, 'text-anchor': 'middle' }, v));
      });
    }
    dibujar();
  }

  VIZ.registrarTema('svg-animation', {
    intro: String.raw`
      <p>Animar un gráfico es cambiar un atributo —posición, radio, opacidad, longitud— de manera gradual en el tiempo. Sirve para <strong>explicar un cambio</strong>: que la persona vea de dónde viene cada marca y no solo dónde termina.</p>
      <p>En SVG se puede animar con CSS, con el elemento <code>&lt;animate&gt;</code> o programáticamente: JavaScript calcula, en cada cuadro, el valor intermedio entre el inicio y el fin.</p>`,
    visualizaciones: [
      { titulo: 'Curvas de aceleración', descripcion: 'Anime una marca con cuatro curvas distintas y compare con el gráfico de posición frente a tiempo.', montar: montarEasing },
      { titulo: 'Barras en cascada', descripcion: 'Aumente el retardo entre barras y cambie la curva para ver cómo se guía la atención.', montar: montarCascada },
    ],
    teoria: String.raw`
      <h2>Interpolación en el tiempo</h2>
      <p>Si un atributo va de \(a\) a \(b\) en una duración \(D\), su valor en el instante \(t\) es
      \[ v(t) = a + (b - a)\,f\!\left(\frac{t}{D}\right), \qquad f(0)=0,\ f(1)=1. \]
      La función \(f\) es la <em>curva de aceleración</em> (<em>easing</em>). Con \(f(u)=u\) el movimiento es uniforme; con \(f(u)=u^2\) arranca despacio y acelera; con \(f(u)=3u^2-2u^3\) (<em>smoothstep</em>) acelera y frena suavemente.</p>
      <h2>Bucle de animación</h2>
      <pre><code>function cuadro(ahora):
    u ← (ahora − inicio) / D
    para cada marca: atributo ← interpolar(a, b, f(min(u, 1)))
    si u &lt; 1: pedir el siguiente cuadro (requestAnimationFrame)</code></pre>
      <h2>Tres maneras de animar SVG</h2>
      <table>
        <tr><th>Técnica</th><th>Ventaja</th><th>Límite</th></tr>
        <tr><td>CSS (<code>transition</code>, <code>@keyframes</code>)</td><td>declarativa, el navegador la optimiza</td><td>no anima el atributo <code>d</code> de todos los navegadores por igual</td></tr>
        <tr><td><code>&lt;animate&gt;</code> (SMIL)</td><td>vive dentro del SVG</td><td>poco flexible con datos</td></tr>
        <tr><td>JavaScript</td><td>control total, se liga a los datos</td><td>hay que escribir el bucle</td></tr>
      </table>
      <p><a href="tema.html?id=d3-transitions-interpolation">Las transiciones de D3</a> automatizan el bucle y la interpolación.</p>
      <div class="recuadro"><strong>Cuidado.</strong> Una animación larga o sin relación con los datos distrae. Úsela para mostrar transiciones entre estados, y deje que la persona la omita.</div>`,
  });
})();
