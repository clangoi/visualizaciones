(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  /* ---------- Fig. 1: escala lineal ---------- */

  function montarLineal(cuerpo) {
    const e = { d0: 0, d1: 100, r0: 40, r1: 560, valor: 35, clamp: false, nice: false, tipo: 'lineal' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo', valor: e.tipo, opciones: [['lineal', 'scaleLinear'], ['sqrt', 'scaleSqrt'], ['log', 'scaleLog']], alCambiar: (v) => { e.tipo = v; if (v === 'log' && e.d0 < 1) { e.d0 = 1; r0.valor = 1; } dibujar(); } });
    const r0 = ctl.rango({ etiqueta: 'dominio: mínimo', min: 0, max: 50, valor: e.d0, alCambiar: (v) => { e.d0 = e.tipo === 'log' ? Math.max(1, v) : v; dibujar(); } });
    ctl.rango({ etiqueta: 'dominio: máximo', min: 60, max: 1000, valor: e.d1, alCambiar: (v) => { e.d1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'valor de entrada', min: 0, max: 1000, valor: e.valor, alCambiar: (v) => { e.valor = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'clamp(true)', valor: e.clamp, alCambiar: (v) => { e.clamp = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'nice()', valor: e.nice, alCambiar: (v) => { e.nice = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'dominio (datos)' }, { color: C.s2, texto: 'rango (píxeles)' }, { color: C.s4, texto: 'valor de entrada y su imagen' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el valor de entrada: la flecha muestra a qué píxel va. Ponga un valor fuera del dominio con y sin <code>clamp</code>; con <code>nice</code> el dominio se redondea a números «bonitos».');
    const f = (v, d0, d1, r0, r1) => {
      const t = e.tipo === 'lineal' ? (v - d0) / (d1 - d0) : e.tipo === 'sqrt' ? (Math.sqrt(Math.max(v, 0)) - Math.sqrt(d0)) / (Math.sqrt(d1) - Math.sqrt(d0)) : (Math.log10(Math.max(v, 1e-9)) - Math.log10(d0)) / (Math.log10(d1) - Math.log10(d0));
      const tt = e.clamp ? Math.max(0, Math.min(1, t)) : t;
      return r0 + tt * (r1 - r0);
    };
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      let d0 = e.d0, d1 = e.d1;
      if (e.nice) { const [a, b] = VIZ.ticks(d0, d1, 5).length ? [VIZ.ticks(d0, d1, 5)[0], VIZ.ticks(d0, d1, 5).slice(-1)[0]] : [d0, d1]; d0 = e.tipo === 'log' ? Math.max(1, Math.min(d0, a)) : Math.min(d0, a); d1 = Math.max(d1, b); }
      const x0 = 30, x1 = W - 30;
      const yD = 40, yR = 140;
      ctx.strokeStyle = C.s1; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, yD); ctx.lineTo(x1, yD); ctx.stroke();
      ctx.strokeStyle = C.s2; ctx.beginPath(); ctx.moveTo(x0, yR); ctx.lineTo(x1, yR); ctx.stroke();
      V.rotulo(ctx, 'dominio [' + VIZ.fmt(d0, 3) + ', ' + VIZ.fmt(d1, 3) + ']', x0, 18, { color: C.s1, peso: 600 });
      V.rotulo(ctx, 'rango [' + Math.round(x0) + ', ' + Math.round(x1) + '] px', x0, 164, { color: C.s2, peso: 600 });
      const tks = e.tipo === 'log' ? VIZ.ticksLog(Math.max(d0, 1), d1, 6) : VIZ.ticks(d0, d1, 6);
      const px = (v) => f(v, d0, d1, x0, x1);
      for (const t of tks) {
        const x = px(t); if (x < x0 - 1 || x > x1 + 1) continue;
        ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, yD - 5); ctx.lineTo(x, yD + 5); ctx.stroke();
        V.rotulo(ctx, String(t), x, yD + 16, { alinear: 'center', tam: 10, color: C.apagado });
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yD + 22); ctx.lineTo(x, yR - 6); ctx.stroke();
      }
      const px0 = px(e.valor);
      ctx.strokeStyle = C.s4; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.valor >= d0 && e.valor <= d1 ? px0 : (e.clamp ? px0 : px0), yD); ctx.lineTo(px0, yR); ctx.stroke();
      VIZ.marcador(ctx, px(Math.min(Math.max(e.valor, d0), d1)), yD, C.s4, 5); VIZ.marcador(ctx, px0, yR, C.s4, 5);
      lectura.set([['entrada', VIZ.fmt(e.valor, 4)], ['salida', `${VIZ.fmt(px0, 4)} px`], ['dentro del dominio', e.valor >= d0 && e.valor <= d1 ? 'sí' : e.clamp ? 'no (recortado)' : 'no (extrapola)']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: escala de bandas y ordinal ---------- */

  function montarBandas(cuerpo) {
    const e = { n: 6, pi: 0.2, po: 0.1, tipo: 'banda' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escala', valor: e.tipo, opciones: [['banda', 'scaleBand (barras)'], ['punto', 'scalePoint (puntos)']], alCambiar: (v) => { e.tipo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Categorías', min: 2, max: 12, valor: e.n, alCambiar: (v) => { e.n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'paddingInner', min: 0, max: 0.8, paso: 0.05, valor: e.pi, alCambiar: (v) => { e.pi = v; dibujar(); } });
    ctl.rango({ etiqueta: 'paddingOuter', min: 0, max: 0.8, paso: 0.05, valor: e.po, alCambiar: (v) => { e.po = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'banda de cada categoría (bandwidth)' }, { color: C.s2, texto: 'paso: banda más espacio (step)' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una escala categórica reparte un rango en bandas iguales. Con scalePoint el ancho de banda es cero: cada categoría es un punto.');
    let bandas = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 20, x1 = W - 20, n = e.n, pi = e.tipo === 'punto' ? 1 : e.pi;
      const paso = (x1 - x0) / Math.max(1, n - (e.tipo === 'punto' ? 1 : pi) + 2 * e.po);
      const bw = e.tipo === 'punto' ? 0 : paso * (1 - pi);
      const ini = x0 + (e.tipo === 'punto' ? e.po * paso : e.po * paso);
      bandas = [];
      const rnd = VIZ.semilla(4);
      for (let i = 0; i < n; i++) {
        const x = ini + i * paso, v = 30 + rnd() * 90;
        if (e.tipo === 'banda') { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x, 150 - v, bw, v, [4, 4, 0, 0]); ctx.fill(); }
        else VIZ.marcador(ctx, x, 150 - v, C.s1, 5);
        V.rotulo(ctx, V.CIUDADES[i].slice(0, 3), x + bw / 2, 165, { alinear: 'center', tam: 10 });
        bandas.push({ x: x + bw / 2, i, x0: x, bw });
      }
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, 150.5); ctx.lineTo(x1, 150.5); ctx.stroke();
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2;
      if (n > 1) { ctx.beginPath(); ctx.moveTo(ini, 184); ctx.lineTo(ini + paso, 184); ctx.stroke(); V.rotulo(ctx, 'step = ' + VIZ.fmt(paso, 3), ini + paso / 2, 196, { alinear: 'center', tam: 10, color: C.s2 }); }
      lectura.set([['step', VIZ.fmt(paso, 3)], ['bandwidth', VIZ.fmt(bw, 3)], ['categorías', String(n)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const b = V.cercano(bandas.map((q) => ({ px: q.x, py: 130 })), x, y, 60);
      if (!b) return tip.ocultar();
      tip.mostrar(x, y, `${V.CIUDADES[bandas[bandas.findIndex((q) => q.x === b.px)].i]}: posición <b>${VIZ.fmt(b.px, 3)}</b> px`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('d3-scales-axes', {
    intro: String.raw`
      <p>Una <strong>escala</strong> es una función que convierte valores de los datos (el <em>dominio</em>) en valores visuales (el <em>rango</em>): euros en píxeles, categorías en posiciones, números en colores.
      Un <strong>eje</strong> es la escala hecha visible: sus marcas y rótulos le dicen a la persona cómo leer la posición.</p>
      <p>Separar la escala del dibujo es lo que permite cambiar el tamaño del gráfico, o el rango de datos, sin reescribir nada más.</p>`,
    visualizaciones: [
      { titulo: 'Escala lineal, raíz y logarítmica', descripcion: 'Cambie el dominio, el tipo de escala, clamp y nice, y siga un valor hasta su píxel.', montar: montarLineal },
      { titulo: 'Escalas de bandas para categorías', descripcion: 'Varíe la cantidad de categorías y los dos paddings; compare bandas con puntos.', montar: montarBandas },
    ],
    teoria: String.raw`
      <h2>Escala lineal</h2>
      <p>Con dominio \([d_0, d_1]\) y rango \([r_0, r_1]\):
      \[ f(x) = r_0 + \frac{x - d_0}{d_1 - d_0}\,(r_1 - r_0). \]
      Es afín: conserva proporciones entre diferencias. Su inversa \(f^{-1}\) convierte posición del cursor en dato. Para el eje y de un gráfico el rango suele invertirse, \([h, 0]\), porque en pantalla la \(y\) crece hacia abajo.</p>
      <h2>Otras escalas continuas</h2>
      <table>
        <tr><th>Escala</th><th>Fórmula</th><th>Uso</th></tr>
        <tr><td>potencia/raíz</td><td>\(t = \sqrt{x}\) antes de normalizar</td><td>áreas de círculos: radio ∝ √valor</td></tr>
        <tr><td>logarítmica</td><td>\(t = \log x\)</td><td>datos que cruzan órdenes de magnitud (dominio positivo)</td></tr>
        <tr><td>tiempo</td><td>lineal sobre fechas</td><td>series temporales</td></tr>
      </table>
      <h2>Escalas categóricas</h2>
      <p>Para \(n\) categorías en un rango de ancho \(L\), con <em>paddingInner</em> \(p\) y <em>paddingOuter</em> \(q\), el paso y el ancho de banda son
      \[ \text{step} = \frac{L}{n - p + 2q}, \qquad \text{bandwidth} = \text{step}\,(1 - p). \]
      Una escala <em>ordinal</em> asigna cada categoría a un color de una lista (los 8 colores de la paleta, en orden).</p>
      <h2>Ejes</h2>
      <p>Los marcadores del eje salen de <code>scale.ticks(n)</code>, que elige valores «redondos» (1, 2, 5 × 10<sup>k</sup>) cercanos a \(n\) divisiones. <code>nice()</code> extiende el dominio hasta esos valores.</p>
      <p>Ver también <a href="tema.html?id=svg-transforms-groups">grupos y márgenes</a> y la <a href="tema.html?id=d3-shape-generators">generación de líneas y áreas</a>.</p>`,
  });
})();
