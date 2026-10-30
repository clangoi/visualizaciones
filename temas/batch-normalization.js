(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  function histograma(ctx, x, y, w, h, v, lo, hi, color, titulo, B = 28) {
    const cuenta = new Array(B).fill(0);
    v.forEach((q) => { const i = Math.floor(((q - lo) / (hi - lo)) * B); if (i >= 0 && i < B) cuenta[i]++; });
    const top = Math.max(...cuenta, 1), bw = w / B;
    ctx.fillStyle = color;
    cuenta.forEach((n, i) => { const bh = (n / top) * (h - 16); ctx.beginPath(); ctx.roundRect(x + i * bw + 0.5, y + h - bh, bw - 1, bh, [2, 2, 0, 0]); ctx.fill(); });
    ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x, y + h + 0.5); ctx.lineTo(x + w, y + h + 0.5); ctx.stroke();
    ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(titulo, x, y - 2);
    ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center';
    [lo, (lo + hi) / 2, hi].forEach((t, i) => { ctx.textAlign = i === 0 ? 'left' : i === 2 ? 'right' : 'center'; ctx.fillText(VIZ.fmt(t, 2).replace('-', '−'), x + (i * w) / 2, y + h + 4); });
  }

  /* ---------- Fig. 1: normalizar un mini-lote ---------- */

  function montarLote(cuerpo) {
    let mu0 = 2, sd0 = 1.8, gamma = 1, beta = 0, act = 'sigmoide', semilla = 1, z = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Media de z antes de normalizar', min: -4, max: 4, paso: 0.1, valor: mu0, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { mu0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Desviación de z', min: 0.2, max: 4, paso: 0.1, valor: sd0, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { sd0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'γ (escala aprendida)', min: 0.2, max: 3, paso: 0.1, valor: gamma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { gamma = v; dibujar(); } });
    ctl.rango({ etiqueta: 'β (desplazamiento aprendido)', min: -2, max: 2, paso: 0.1, valor: beta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { beta = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Activación', opciones: ['sigmoide', 'tanh', 'relu'].map((k) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; dibujar(); } });
    ctl.boton('Otro mini-lote', () => { semilla++; muestrear(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 400 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'z: suma ponderada de la neurona', forma: 'cuadro' }, { color: C.s1, texto: 'y = γ·ẑ + β tras normalizar', forma: 'cuadro' }, { color: C.s6, texto: 'activación f(y)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Si z llega descentrada o muy dispersa, la sigmoide se satura y casi no pasa gradiente. Normalizar el mini-lote a media 0 y varianza 1 deja los valores en la zona útil; γ y β se aprenden para que la red recupere la escala que necesite.');
    function muestrear() { const r = VIZ.semilla(semilla * 13); z = Array.from({ length: 256 }, () => VIZ.normal(r)); }
    function dibujar() {
      if (!z.length) return;
      const { ctx, ancho: W } = lienzo, A = DL.ACT[act];
      lienzo.limpiar();
      const zr = z.map((q) => mu0 + sd0 * q);
      const mu = zr.reduce((s, v) => s + v, 0) / zr.length, sd = Math.sqrt(zr.reduce((s, v) => s + (v - mu) ** 2, 0) / zr.length + 1e-5);
      const y = zr.map((v) => gamma * ((v - mu) / sd) + beta);
      const sin = zr.map(A.f), con = y.map(A.f);
      const ancho = W - 24, alto = 80, sat = (v) => (act === 'relu' ? v.filter((q) => q === 0).length : v.filter((q) => Math.abs(act === 'tanh' ? q : 2 * q - 1) > 0.95).length) / v.length;
      histograma(ctx, 12, 8, ancho, alto, zr, -8, 8, C.s2, 'z (antes de normalizar)');
      histograma(ctx, 12, 8 + (alto + 36), ancho, alto, y, -8, 8, C.s1, 'y = γ·ẑ + β (después)');
      histograma(ctx, 12, 8 + 2 * (alto + 36), ancho, alto, con, act === 'sigmoide' ? 0 : act === 'tanh' ? -1 : 0, act === 'relu' ? 8 : 1, C.s6, `f(y) con ${A.nombre}`);
      registro.textContent = `Antes: media ${VIZ.fmt(mu, 2)}, desviación ${VIZ.fmt(sd, 2)}. Después: media ${VIZ.fmt(beta, 2)}, desviación ${VIZ.fmt(gamma, 2)}. ${act === 'relu' ? 'Neuronas apagadas (salida 0)' : 'Neuronas saturadas'}: ${VIZ.fmt(100 * sat(sin), 3)} % sin normalizar frente a ${VIZ.fmt(100 * sat(con), 3)} % con ella.`;
      lectura.set([['media y desviación de z', `${VIZ.fmt(mu, 2)} · ${VIZ.fmt(sd, 2)}`], ['media y desviación de y', `${VIZ.fmt(beta, 2)} · ${VIZ.fmt(gamma, 2)}`], [act === 'relu' ? 'apagadas sin BN' : 'saturadas sin BN', `${VIZ.fmt(100 * sat(sin), 3)} %`], [act === 'relu' ? 'apagadas con BN' : 'saturadas con BN', `${VIZ.fmt(100 * sat(con), 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    muestrear(); dibujar();
  }

  /* ---------- Fig. 2: estadísticas de las activaciones a lo largo de una red profunda ---------- */

  function montarProfunda(cuerpo) {
    let act = 'tanh', escala = 1.6, bn = true, semilla = 1, res = null, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Activación', opciones: ['tanh', 'sigmoide', 'relu'].map((k) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; calcular(); } });
    ctl.rango({ etiqueta: 'Escala de los pesos (× estándar)', min: 0.3, max: 3, paso: 0.1, valor: escala, formato: (v) => `× ${VIZ.fmt(v, 2)}`, alCambiar: (v) => { escala = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'sin normalización por lotes', forma: 'linea' }, { color: C.s1, texto: 'con normalización por lotes', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Una red de 12 capas de 64 neuronas con pesos aleatorios, 128 ejemplos. Se muestra la desviación estándar de las activaciones en cada capa (escala log). Sin normalización, una escala de pesos algo distinta de la ideal basta para que la señal explote o se extinga; con ella, cada capa recibe una entrada bien escalada.');
    function calcular() {
      const r = VIZ.semilla(semilla * 7 + 1), n = 64, B = 128, A = DL.ACT[act];
      const corre = (usarBN) => {
        let a = Array.from({ length: B }, () => Array.from({ length: n }, () => VIZ.normal(r))), sds = [];
        const r2 = VIZ.semilla(semilla * 7 + 1); // mismos pesos con y sin BN
        for (let l = 0; l < 12; l++) {
          const W = Array.from({ length: n }, () => Array.from({ length: n }, () => VIZ.normal(r2) * Math.sqrt((act === 'relu' ? 2 : 1) / n) * escala));
          let z = a.map((x) => W.map((f) => f.reduce((s, w, i) => s + w * x[i], 0)));
          if (usarBN) for (let j = 0; j < n; j++) { const col = z.map((q) => q[j]), mu = col.reduce((s, v) => s + v, 0) / B, sd = Math.sqrt(col.reduce((s, v) => s + (v - mu) ** 2, 0) / B + 1e-5); z.forEach((q) => { q[j] = (q[j] - mu) / sd; }); }
          a = z.map((q) => q.map(A.f));
          const flat = a.flat(), mu = flat.reduce((s, v) => s + v, 0) / flat.length;
          sds.push({ sd: Math.sqrt(flat.reduce((s, v) => s + (v - mu) ** 2, 0) / flat.length), sat: act === 'relu' ? flat.filter((v) => v === 0).length / flat.length : flat.filter((v) => Math.abs(act === 'tanh' ? v : 2 * v - 1) > 0.95).length / flat.length });
        }
        return sds;
      };
      res = { sin: corre(false), con: corre(true) };
      dibujar();
    }
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 12, ymin: 1e-6, ymax: 1e4 }, { logY: true, etiquetaX: 'capa', etiquetaY: 'desviación de las activaciones', ticksX: Array.from({ length: 12 }, (_, i) => i + 1), formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      [['sin', C.s2], ['con', C.s1]].forEach(([k, c]) => VIZ.trazar(ctx, pl, res[k].map((q, i) => [i + 1, Math.max(q.sd, 1e-6)]), c, 2.5));
      if (hover > 0) [['sin', C.s2], ['con', C.s1]].forEach(([k, c]) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(res[k][hover - 1].sd, 1e-6)), c, 4));
      ctx.restore();
      const u = (k) => res[k][11];
      registro.textContent = `En la capa 12, la desviación es ${VIZ.fmt(u('sin').sd, 2)} sin normalizar y ${VIZ.fmt(u('con').sd, 2)} con ella; ${act === 'relu' ? 'neuronas apagadas' : 'neuronas saturadas'}: ${VIZ.fmt(100 * u('sin').sat, 3)} % frente a ${VIZ.fmt(100 * u('con').sat, 3)} %.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res) { hover = -1; tip.ocultar(); return; }
      hover = Math.max(1, Math.min(12, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `capa <b>${hover}</b>` + VIZ.filaTooltip(C.s2, 'sin BN', VIZ.fmt(res.sin[hover - 1].sd, 3)) + VIZ.filaTooltip(C.s1, 'con BN', VIZ.fmt(res.con[hover - 1].sd, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('batch-normalization', {
    intro: String.raw`
      <p>Durante el entrenamiento, los valores que recibe cada capa cambian a medida que cambian las capas anteriores. Si se descentran o se vuelven muy dispersos, las activaciones se saturan y el gradiente se pierde.</p>
      <p><strong>Batch Normalization</strong> corrige esto: antes de la activación, normaliza cada neurona usando la media y la desviación de su mini-lote, y luego deja que la red recupere la escala y el desplazamiento que necesite mediante dos parámetros aprendidos, \(\gamma\) y \(\beta\).
      Permite tasas de aprendizaje mayores, hace menos crítica la inicialización y suele regularizar levemente.</p>`,
    visualizaciones: [
      { titulo: 'Normalizar un mini-lote', descripcion: 'Descentre \\(z\\), aumente su dispersión y vea cómo se satura la activación; luego mire cómo el lote normalizado vuelve a la zona útil. Mueva \\(\\gamma\\) y \\(\\beta\\).', montar: montarLote },
      { titulo: 'Una red profunda con y sin normalización', descripcion: 'Mire la desviación de las activaciones capa a capa. Cambie la escala de los pesos y la activación y compare con la normalización por lotes.', montar: montarProfunda },
    ],
    teoria: String.raw`
      <h2>La transformación</h2>
      <p>Para un mini-lote \(\mathcal{B}\) de \(m\) valores \(z_1,\dots,z_m\) de una neurona:</p>
      \[ \mu_\mathcal{B}=\frac1m\sum_i z_i,\quad \sigma_\mathcal{B}^2=\frac1m\sum_i (z_i-\mu_\mathcal{B})^2,\quad \hat z_i=\frac{z_i-\mu_\mathcal{B}}{\sqrt{\sigma_\mathcal{B}^2+\varepsilon}},\quad y_i=\gamma\,\hat z_i+\beta. \]
      <p>Si la red lo necesita, puede aprender \(\gamma=\sqrt{\sigma_\mathcal{B}^2+\varepsilon}\) y \(\beta=\mu_\mathcal{B}\) y deshacer la normalización: no se pierde capacidad expresiva.</p>
      <h2>En entrenamiento y en inferencia</h2>
      <ul>
        <li><strong>Entrenamiento:</strong> se usan las estadísticas del mini-lote, y se mantiene un promedio móvil \(\mu_{\text{run}}\leftarrow(1-\alpha)\mu_{\text{run}}+\alpha\mu_\mathcal{B}\) (igual para la varianza).</li>
        <li><strong>Inferencia:</strong> se usan las estadísticas acumuladas, para que la salida de un ejemplo no dependa de los demás del lote.</li>
      </ul>
      <h2>Gradiente</h2>
      <p>La retropropagación atraviesa también \(\mu_\mathcal{B}\) y \(\sigma_\mathcal{B}\), de modo que el gradiente de cada ejemplo depende del lote completo; esto es lo que hace que la normalización dé una leve regularización.</p>
      <div class="recuadro"><p>Por qué ayuda sigue discutiéndose: se explicó como reducción del <em>covariate shift</em> interno, pero la evidencia apunta a que suaviza la superficie de pérdida y permite pasos más grandes. Con lotes muy pequeños o secuencias, se prefieren variantes (<em>Layer Norm</em>, <em>Group Norm</em>), que normalizan sin depender del lote; <em>Layer Norm</em> es la que usan los <a href="tema.html?id=transformer-block">Transformers</a>.</p></div>
      <p>Véase también <a href="tema.html?id=weight-initialization">Weight Initialization</a> y <a href="tema.html?id=activation-functions">Activation Functions</a>.</p>`,
  });
})();
