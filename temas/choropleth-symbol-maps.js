(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  // Región ficticia dividida en 20 rectángulos de áreas muy distintas (partición recursiva con semilla fija).
  function crearRegiones() {
    const r = VIZ.semilla(12), res = [];
    function partir(x, y, w, h, idx) {
      if (idx.length === 1) { res.push({ x, y, w, h, id: idx[0] }); return; }
      const k = Math.floor(idx.length / 2), f = 0.3 + 0.4 * r();
      if (w >= h) { partir(x, y, w * f, h, idx.slice(0, k)); partir(x + w * f, y, w * (1 - f), h, idx.slice(k)); } else { partir(x, y, w, h * f, idx.slice(0, k)); partir(x, y + h * f, w, h * (1 - f), idx.slice(k)); }
    }
    partir(0, 0, 1, 1, Array.from({ length: 20 }, (_, i) => i));
    res.sort((a, b) => a.id - b.id);
    res.forEach((q, i) => {
      q.area = q.w * q.h * 1000;                      // «km²» relativos
      q.pob = Math.round(Math.exp(10.2 + 0.45 * VIZ.normal(r)) / 1000) * 1000;
      const norte = 1 - (q.y + q.h / 2);              // más casos por habitante hacia el norte
      q.tasa = 40 + 140 * norte + 25 * VIZ.normal(r);
      q.casos = Math.round((q.pob * q.tasa) / 1e5);
      q.nombre = `Región ${i + 1}`;
    });
    return res;
  }
  const REG = crearRegiones();

  function cortes(valores, k, metodo) {
    const s = [...valores].sort((a, b) => a - b), mn = s[0], mx = s[s.length - 1], c = [];
    for (let i = 1; i < k; i++) c.push(metodo === 'iguales' ? mn + ((mx - mn) * i) / k : s[Math.floor((s.length * i) / k)]);
    return c;
  }
  const clase = (v, c) => c.filter((q) => v >= q).length;

  /* ---------- Fig. 1: mapa coroplético ---------- */

  function montarCoropletico(cuerpo) {
    const e = { medida: 'casos', metodo: 'iguales', k: 5 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Variable pintada', valor: e.medida, opciones: [['casos', 'número de casos (conteo)'], ['tasa', 'casos por 100 000 habitantes (tasa)']], alCambiar: (v) => { e.medida = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Corte de clases', valor: e.metodo, opciones: [['iguales', 'intervalos iguales'], ['cuantiles', 'cuantiles (misma cantidad de regiones)']], alCambiar: (v) => { e.metodo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Clases', min: 3, max: 7, valor: e.k, alCambiar: (v) => { e.k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El conteo de casos sigue a la población, no al riesgo: pinta oscuras las regiones grandes en habitantes. La tasa muestra el gradiente real (más casos por habitante al norte). Pase el cursor por una región.');
    let hit = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const v = REG.map((q) => q[e.medida]), c = cortes(v, e.k, e.metodo);
      const col = (i) => VIZ.css(VIZ.enRampa(i / (e.k - 1)));
      const ox = 8, oy = 8, w = W - 16, h = H - 16;
      hit = [];
      REG.forEach((q, i) => {
        const x = ox + q.x * w, y = oy + q.y * h, ww = q.w * w, hh = q.h * h;
        ctx.fillStyle = col(clase(q[e.medida], c)); ctx.fillRect(x, y, ww, hh);
        ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.strokeRect(x, y, ww, hh);
        if (ww > 40 && hh > 22) V.rotulo(ctx, String(i + 1), x + ww / 2, y + hh / 2, { alinear: 'center', tam: 10, peso: 600, color: clase(q[e.medida], c) > e.k / 2 ? C.sobre : C.tinta });
        hit.push({ x, y, w: ww, h: hh, i });
      });
      const lim = [Math.min(...v), ...c, Math.max(...v)];
      leyenda.set(Array.from({ length: e.k }, (_, i) => ({ color: col(i), texto: `${VIZ.fmt(lim[i], 3)} – ${VIZ.fmt(lim[i + 1], 3)}` })));
      const conteoClase = Array.from({ length: e.k }, (_, i) => v.filter((q) => clase(q, c) === i).length);
      const corr = (() => { const a = REG.map((q) => q.pob), b = REG.map((q) => q.casos), ma = a.reduce((s, x) => s + x) / 20, mb = b.reduce((s, x) => s + x) / 20; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < 20; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); })();
      registro.textContent = e.medida === 'casos' ? 'Conteo: la correlación entre casos y población es alta, por lo que el mapa refleja sobre todo cuánta gente vive en cada región.' : 'Tasa: se divide por la población y se elimina ese efecto; ahora el color sí informa del riesgo.';
      lectura.set([['regiones por clase', conteoClase.join(' · ')], ['correlación casos–población', VIZ.fmt(corr, 3)], ['clases', String(e.k)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hit, x, y); if (!h) return tip.ocultar(); const q = REG[h.i]; tip.mostrar(x, y, `<b>${q.nombre}</b><br>población ${VIZ.entero(q.pob)}<br>casos <b>${VIZ.entero(q.casos)}</b> · tasa <b>${VIZ.fmt(q.tasa, 3)}</b> /100 000<br>área ${VIZ.fmt(q.area, 3)}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: mapa de símbolos proporcionales ---------- */

  function montarSimbolos(cuerpo) {
    const e = { escala: 'area', fondo: true, orden: true };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tamaño del círculo', valor: e.escala, opciones: [['area', 'área proporcional al valor (correcto)'], ['radio', 'radio proporcional al valor (exagera)']], alCambiar: (v) => { e.escala = v; dibujar(); } });
    ctl.casillas([{ clave: 'fondo', texto: 'Mostrar las regiones', activo: true }, { clave: 'orden', texto: 'Dibujar los grandes primero', activo: true }], (s) => { Object.assign(e, s); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'casos (tamaño del círculo)' }, { color: C.neutro, texto: 'región', borde: C.eje }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Comparar la región de más casos con la de menos: la razón de áreas dibujadas debe coincidir con la razón de valores. Con radio proporcional, la razón se eleva al cuadrado.');
    let hit = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ox = 8, oy = 8, w = W - 16, h = H - 16, mx = Math.max(...REG.map((q) => q.casos)), rmax = Math.min(w, h) * 0.12;
      if (e.fondo) REG.forEach((q) => { ctx.fillStyle = C.neutro; ctx.fillRect(ox + q.x * w, oy + q.y * h, q.w * w, q.h * h); ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.strokeRect(ox + q.x * w + 0.5, oy + q.y * h + 0.5, q.w * w, q.h * h); });
      const radio = (v) => (e.escala === 'area' ? rmax * Math.sqrt(v / mx) : rmax * (v / mx));
      const lista = REG.map((q, i) => ({ q, i })).sort((a, b) => (e.orden ? b.q.casos - a.q.casos : a.i - b.i));
      hit = [];
      lista.forEach(({ q, i }) => { const cx = ox + (q.x + q.w / 2) * w, cy = oy + (q.y + q.h / 2) * h, r = radio(q.casos); ctx.fillStyle = VIZ.alfa(C.s2, 0.7); ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill(); ctx.stroke(); hit.push({ px: cx, py: cy, i, r }); });
      const mayor = REG.reduce((a, b) => (b.casos > a.casos ? b : a)), menor = REG.reduce((a, b) => (b.casos < a.casos ? b : a));
      const razonValor = mayor.casos / menor.casos, razonArea = (radio(mayor.casos) / radio(menor.casos)) ** 2;
      let solapes = 0; for (let i = 0; i < hit.length; i++) for (let j = i + 1; j < hit.length; j++) if (Math.hypot(hit[i].px - hit[j].px, hit[i].py - hit[j].py) < hit[i].r + hit[j].r) solapes++;
      registro.textContent = e.escala === 'area' ? 'El área del círculo es proporcional al valor: la razón dibujada coincide con la real.' : `Con radio proporcional, un valor ${VIZ.fmt(razonValor, 3)} veces mayor se dibuja con un área ${VIZ.fmt(razonArea, 3)} veces mayor.`;
      lectura.set([['razón de valores (mayor ÷ menor)', `${VIZ.fmt(razonValor, 3)}×`], ['razón de áreas dibujadas', `${VIZ.fmt(razonArea, 3)}×`], ['pares de círculos solapados', String(solapes)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.cercano(hit, x, y, 16); if (!c) return tip.ocultar(); const q = REG[c.i]; tip.mostrar(x, y, `<b>${q.nombre}</b><br>casos <b>${VIZ.entero(q.casos)}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('choropleth-symbol-maps', {
    intro: String.raw`
      <p>Cuando los datos tienen una ubicación, el mapa es la codificación natural. Hay dos grandes familias: el mapa <strong>coroplético</strong> pinta cada región con un color según su valor, y el mapa de <strong>símbolos proporcionales</strong> coloca sobre cada región una marca (un círculo) cuyo tamaño codifica el valor.</p>
      <p>Cada uno tiene su trampa. El coroplético da más peso visual a las regiones grandes; los símbolos pueden taparse entre sí y se leen mal si el tamaño no está bien escalado.</p>`,
    visualizaciones: [
      { titulo: 'Mapa coroplético: conteo frente a tasa', descripcion: 'Pinte las regiones por número de casos y por tasa, y cambie el método y el número de clases.', montar: montarCoropletico },
      { titulo: 'Símbolos proporcionales', descripcion: 'Cambie el escalado del círculo y el orden de dibujo; compare la razón de valores con la razón de áreas.', montar: montarSimbolos },
    ],
    teoria: String.raw`
      <h2>Coroplético</h2>
      <p>Los valores se agrupan en \(k\) clases y cada clase recibe un color de una rampa ordenada. Dos decisiones:</p>
      <ul>
        <li><strong>Qué se pinta.</strong> Se deben pintar <em>valores normalizados</em> (tasas, densidades, porcentajes), no conteos: un conteo \(c_i = \text{tasa}_i \cdot \text{pob}_i\) refleja el tamaño de la población. La tasa por 100 000 es \(t_i = 10^5\,c_i/\text{pob}_i\).</li>
        <li><strong>Cómo se cortan las clases.</strong> <em>Intervalos iguales</em> (\(\Delta = (\max - \min)/k\)) conservan la escala pero pueden dejar clases vacías si hay atípicos; <em>cuantiles</em> reparten las regiones por igual y dan un mapa «equilibrado», a costa de agrupar valores muy distintos.</li>
      </ul>
      <h2>Sesgo del área</h2>
      <p>En un mapa el área de una región no tiene nada que ver con su población ni con su importancia, pero domina la percepción: una región grande y poco poblada se ve más que varias pequeñas y densas. Alternativas: cartogramas, mapas de teselas o símbolos proporcionales.</p>
      <h2>Símbolos proporcionales</h2>
      <p>Si el valor es \(v\) y el valor máximo \(v_{\max}\) se dibuja con radio \(r_{\max}\), el radio correcto es
      \[ r(v) = r_{\max}\sqrt{\frac{v}{v_{\max}}}, \]
      de modo que el área \(\pi r^2\) sea proporcional a \(v\). Escalar el radio linealmente multiplica la razón por \(r^2\): un valor 4 veces mayor se vería 16 veces mayor. Aun así, la percepción subestima las áreas (ver <a href="tema.html?id=perceptual-accuracy">ley de Stevens</a>), por lo que se acompañan de una leyenda con círculos de referencia.</p>
      <p>Para evitar la oclusión se dibujan los símbolos grandes primero, con transparencia y borde claro. La elección entre ambos tipos se resume en <a href="tema.html?id=chart-selection">selección de gráficos</a>; los datos espaciales como tipo en <a href="tema.html?id=dataset-types">tipos de conjuntos de datos</a>.</p>`,
  });
})();
