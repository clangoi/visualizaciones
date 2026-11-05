(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const ENC = [['pos', 'Posición en escala común'], ['lon', 'Longitud (barras sin base común)'], ['ang', 'Ángulo (sectores de un círculo)'], ['area', 'Área (círculos)']];

  /* ---------- Fig. 1: experimento al estilo Cleveland y McGill ---------- */

  function montarExperimento(cuerpo) {
    let enc = 'pos', semilla = 1, par = null, est = 50, resultados = { pos: [], lon: [], ang: [], area: [] };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Codificación', valor: enc, opciones: ENC, alCambiar: (v) => { enc = v; nueva(); } });
    const r = ctl.rango({ etiqueta: 'Estimación (% de la mayor)', min: 5, max: 100, valor: est, formato: (v) => `${v} %`, alCambiar: (v) => { est = v; } });
    ctl.boton('Responder', () => {
      const real = par.menor / par.mayor * 100, err = Math.log2(Math.abs(est - real) + 1 / 8);
      resultados[enc].push({ err, real, est });
      revelar = true; dibujar();
    }, { primario: true });
    ctl.boton('Nueva pregunta', () => nueva());
    ctl.boton('Borrar resultados', () => { resultados = { pos: [], lon: [], ang: [], area: [] }; nueva(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'las dos marcas que debe comparar' }, { color: C.tinta2, texto: 'marcas de relleno' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Estime, sin medir, qué porcentaje de la marca mayor es la menor. Responda varias veces con cada codificación: el error medio (en bits, como en el estudio original) se acumula abajo.');
    let revelar = false;
    function nueva() {
      const rnd = VIZ.semilla(semilla++ * 53 + 5);
      const mayor = 50 + Math.round(rnd() * 40), menor = Math.round(mayor * (0.15 + rnd() * 0.75));
      par = { mayor, menor, otros: Array.from({ length: 3 }, () => Math.round(15 + rnd() * 70)), pos: Math.floor(rnd() * 5) };
      revelar = false; est = 50; r.valor = 50; dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const vals = [...par.otros]; vals.splice(par.pos, 0, par.mayor); vals.splice((par.pos + 2) % 5, 0, par.menor);
      const iMay = vals.indexOf(par.mayor), iMen = vals.lastIndexOf(par.menor);
      const marcaI = (v, i) => (i === iMay || i === iMen ? C.s2 : C.tinta2);
      const paso = (W - 40) / vals.length, base = 200;
      vals.forEach((v, i) => {
        const cx = 20 + paso * (i + 0.5), col = marcaI(v, i);
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
        if (enc === 'pos') { ctx.beginPath(); ctx.arc(cx, base - v * 1.7, 5, 0, 6.3); ctx.fill(); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(20, base + 0.5); ctx.lineTo(W - 20, base + 0.5); ctx.stroke(); }
        else if (enc === 'lon') { const y = 8 + (i % 2) * 30; ctx.fillRect(cx - 8, base - v * 1.5 - y * 0.0 - (i % 3) * 14, 16, v * 1.5); }
        else if (enc === 'ang') { const R = Math.min(paso / 2 - 4, 46), cy = 110, a = (v / 100) * Math.PI * 1.7; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + a); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(cx, 110, Math.sqrt(v / 100) * Math.min(paso / 2 - 2, 46), 0, 6.3); ctx.fill(); }
        if (revelar && (i === iMay || i === iMen)) V.rotulo(ctx, String(v), cx, enc === 'pos' ? base - v * 1.7 - 14 : 210, { alinear: 'center', tam: 11, peso: 700, color: C.tinta });
      });
      const prom = (a) => (a.length ? VIZ.fmt(a.reduce((s, q) => s + q.err, 0) / a.length, 3) : '—');
      lectura.set(ENC.map(([k, t]) => [t.split(' (')[0], `${prom(resultados[k])} bits (${resultados[k].length})`]));
      const u = resultados[enc][resultados[enc].length - 1];
      registro.textContent = revelar && u ? `Real: ${VIZ.fmt(u.real, 3)} %; su estimación: ${u.est} %. Error: ${VIZ.fmt(u.err, 3)} bits.` : 'Compare las dos marcas naranjas y elija un porcentaje.';
    }
    lienzo.alDibujar = () => par && dibujar();
    nueva();
  }

  /* ---------- Fig. 2: ley de potencia de Stevens ---------- */

  const MODAL = { lon: ['Longitud', 1.0], area: ['Área', 0.7], vol: ['Volumen', 0.6], brillo: ['Brillo', 0.5] };

  function montarStevens(cuerpo) {
    let mod = 'area', ratio = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Magnitud física', valor: mod, opciones: Object.entries(MODAL).map(([k, v]) => [k, `${v[0]} (β ≈ ${v[1]})`]), alCambiar: (v) => { mod = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Razón física entre la mayor y la menor', min: 1, max: 10, paso: 0.1, valor: ratio, formato: (v) => `${VIZ.fmt(v, 2)}×`, alCambiar: (v) => { ratio = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 480 : 270) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'percepción ψ = φ^β', forma: 'linea' }, { color: C.apagado, texto: 'percepción exacta (β = 1)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con β menor que 1 la razón percibida es menor que la real: un círculo con área 4 veces mayor se percibe solo unas 2,6 veces mayor. Por eso las áreas subestiman diferencias.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const b = MODAL[mod][1], angosto = W < 560, pw = angosto ? W : W * 0.5;
      // Panel izquierdo: las dos figuras
      const cy = angosto ? 90 : H / 2, cx1 = pw * 0.3, cx2 = pw * 0.7;
      const medida = (v, k) => (mod === 'lon' ? k * v : mod === 'area' ? k * Math.sqrt(v) : mod === 'vol' ? k * Math.cbrt(v) : k * Math.sqrt(v));
      ctx.fillStyle = C.tinta2;
      if (mod === 'lon') { ctx.fillRect(cx1 - 6, cy + 40 - 14 * 1, 12, 14); ctx.fillStyle = C.s1; ctx.fillRect(cx2 - 6, cy + 40 - 14 * ratio, 12, 14 * ratio); }
      else if (mod === 'brillo') { ctx.fillStyle = VIZ.alfa(C.tinta, 0.2); ctx.beginPath(); ctx.arc(cx1, cy, 36, 0, 6.3); ctx.fill(); ctx.fillStyle = VIZ.alfa(C.tinta, Math.min(1, 0.2 * ratio)); ctx.beginPath(); ctx.arc(cx2, cy, 36, 0, 6.3); ctx.fill(); }
      else { const k = 22; ctx.beginPath(); ctx.arc(cx1, cy, medida(1, k), 0, 6.3); ctx.fill(); ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(cx2, cy, medida(ratio, k), 0, 6.3); ctx.fill(); }
      V.rotulo(ctx, 'referencia', cx1, cy + 62, { alinear: 'center', tam: 10 }); V.rotulo(ctx, `${VIZ.fmt(ratio, 2)}× en lo físico`, cx2, cy + 62, { alinear: 'center', tam: 10 });
      // Panel derecho: curva ψ = φ^β
      const x0 = angosto ? 40 : pw + 40, x1 = W - 20, y0 = angosto ? H - 40 : H - 36, y1 = angosto ? 190 : 22;
      const sx = V.lin(0, 10, x0, x1), sy = V.lin(0, 10, y0, y1);
      ctx.strokeStyle = C.eje; ctx.strokeRect(x0 + 0.5, y1 + 0.5, x1 - x0, y0 - y1);
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(10), sy(10)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const f = i / 10, p = Math.pow(f, b) * Math.pow(10, 1 - b); i ? ctx.lineTo(sx(f), sy(p)) : ctx.moveTo(sx(f), sy(p)); } ctx.stroke();
      const per = Math.pow(ratio, b);
      VIZ.marcador(ctx, sx(ratio), sy(Math.pow(ratio, b) * Math.pow(10, 1 - b)), C.s1, 5);
      V.rotulo(ctx, 'razón física', (x0 + x1) / 2, y0 + 18, { alinear: 'center', tam: 10, color: C.apagado }); V.rotulo(ctx, 'razón percibida (escala relativa)', x0, y1 - 8, { tam: 10, color: C.apagado });
      lectura.set([['exponente β', String(b)], ['razón física', `${VIZ.fmt(ratio, 3)}×`], ['razón percibida', `${VIZ.fmt(per, 3)}×`], ['subestimación', `${VIZ.fmt((1 - per / ratio) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('perceptual-accuracy', {
    intro: String.raw`
      <p>Las personas no leemos todas las propiedades visuales con la misma precisión. Comparar la posición de dos puntos sobre una misma línea base es fácil y exacto; comparar el área de dos círculos o el ángulo de dos sectores es difícil y sesgado.</p>
      <p>Esa diferencia se midió con experimentos: Cleveland y McGill (1984) pidieron estimar razones entre marcas con distintas codificaciones, y ordenaron los canales por el error cometido. Aquí puede repetir una versión del experimento.</p>`,
    visualizaciones: [
      { titulo: 'Estime razones con cuatro codificaciones', descripcion: 'Estime el porcentaje de la marca menor respecto de la mayor y compare su error medio entre codificaciones; responda al menos cinco veces cada una.', montar: montarExperimento },
      { titulo: 'La ley de potencia de Stevens', descripcion: 'Elija una magnitud y una razón física; vea cuánto se subestima la diferencia percibida.', montar: montarStevens },
    ],
    teoria: String.raw`
      <h2>Jerarquía de precisión</h2>
      <p>Según el estudio de Cleveland y McGill, de más a menos preciso:</p>
      <ol>
        <li>posición sobre una escala común,</li>
        <li>posición sobre escalas no alineadas,</li>
        <li>longitud, dirección y ángulo,</li>
        <li>área,</li>
        <li>volumen, curvatura,</li>
        <li>luminancia y saturación del color.</li>
      </ol>
      <p>En su experimento el error se medía como \(\log_2\bigl(|\text{estimado} - \text{real}| + \tfrac{1}{8}\bigr)\), y los canales mejores producían menos bits de error. Es la métrica de la figura 1.</p>
      <h2>Ley de Stevens</h2>
      <p>La magnitud percibida \(\psi\) de un estímulo físico \(\varphi\) sigue, con buena aproximación, una ley de potencia:
      \[ \psi = k\,\varphi^{\beta}. \]
      Con \(\beta \approx 1\) (longitud) la percepción es fiel; con \(\beta \approx 0{,}7\) (área) y \(\approx 0{,}6\) (volumen) se subestiman las diferencias. Para que el área percibida refleje una razón \(r\) hace falta compensar: usar un radio proporcional a \(\sqrt{r}\) no basta, porque la percepción comprime aún más.</p>
      <div class="recuadro"><strong>Consecuencia.</strong> Para magnitudes precisas use posición o longitud con una base común. Reserve área y color para cantidades que no requieren comparación exacta. Ver <a href="tema.html?id=marks-and-channels">marcas y canales</a>.</div>
      <h2>Conexiones</h2>
      <p>La base común de las barras es lo que las vuelve exactas; el uso de áreas se ve en los <a href="tema.html?id=choropleth-symbol-maps">mapas de símbolos proporcionales</a>.</p>`,
  });
})();
