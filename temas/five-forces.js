(function () {
  'use strict';
  const { color: C } = VIZ;

  // Intensidad de cada fuerza de 1 (débil) a 5 (fuerte). Los valores de las industrias son supuestos didácticos.
  const FUERZAS = [
    { n: 'Rivalidad', largo: 'Rivalidad entre competidores', q: 'Más competidores parecidos, crecimiento lento o costos fijos altos intensifican la guerra de precios.' },
    { n: 'Entrantes', largo: 'Amenaza de nuevos entrantes', q: 'Economías de escala, marca, capital y acceso a canales levantan barreras; si bajan, entra más gente.' },
    { n: 'Sustitutos', largo: 'Amenaza de sustitutos', q: 'Productos de otra categoría que cumplen la misma función limitan el precio máximo.' },
    { n: 'Clientes', largo: 'Poder de negociación de clientes', q: 'Pocos compradores grandes, información de precios y bajo costo de cambio dan poder al cliente.' },
    { n: 'Proveedores', largo: 'Poder de negociación de proveedores', q: 'Pocos proveedores, insumos únicos o alto costo de cambio dan poder al proveedor.' },
  ];
  const INDUSTRIAS = {
    aerolineas: { n: 'Aerolíneas', v: [5, 3, 3, 4, 4] },
    super: { n: 'Supermercados', v: [4, 3, 2, 4, 3] },
    streaming: { n: 'Video por streaming', v: [5, 3, 3, 3, 4] },
    agua: { n: 'Agua potable regulada', v: [1, 1, 2, 2, 2] },
    saas: { n: 'Software para nichos', v: [3, 3, 2, 3, 2] },
  };
  const atractivo = (v) => (5 - v.reduce((q, x) => q + x, 0) / v.length) / 4;
  const etiquetaAtr = (a) => (a >= 0.65 ? 'atractiva' : a >= 0.4 ? 'moderada' : 'poco atractiva');
  const pct = (v) => `${Math.round(v * 100)} %`;

  // Radar de cinco ejes (la rivalidad arriba). series: [{ v, color, relleno, guion }]. Devuelve la geometría.
  function radar(lienzo, series) {
    const { ctx, ancho: W, alto: H } = lienzo;
    lienzo.limpiar();
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W / 2 - (W < 520 ? 52 : 90), H / 2 - 34);
    const ang = (k) => -Math.PI / 2 + (2 * Math.PI * k) / 5;
    const pt = (k, v) => [cx + Math.cos(ang(k)) * R * (v / 5), cy + Math.sin(ang(k)) * R * (v / 5)];
    for (let r = 1; r <= 5; r++) {
      ctx.beginPath(); FUERZAS.forEach((_, k) => { const [x, y] = pt(k, r); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.strokeStyle = r === 5 ? C.eje : C.rejilla; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let r = 1; r <= 5; r++) ctx.fillText(String(r), cx + 4, cy - (R * r) / 5 + 1);
    FUERZAS.forEach((f, k) => {
      const [x, y] = pt(k, 5); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      const c = Math.cos(ang(k)), s = Math.sin(ang(k));
      ctx.font = VIZ.fuente(W < 520 ? 10 : 12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = Math.abs(c) < 0.2 ? 'center' : c > 0 ? 'left' : 'right'; ctx.textBaseline = s < -0.5 ? 'bottom' : s > 0.5 ? 'top' : 'middle';
      ctx.fillText(f.n, cx + c * (R + 10), cy + s * (R + 10));
    });
    series.forEach((s) => {
      ctx.beginPath(); s.v.forEach((v, k) => { const [x, y] = pt(k, v); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      if (s.relleno) { ctx.fillStyle = VIZ.alfa(s.color, 0.2); ctx.fill(); }
      ctx.save(); if (s.guion) ctx.setLineDash([5, 4]); ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
      s.v.forEach((v, k) => { const [x, y] = pt(k, v); VIZ.marcador(ctx, x, y, s.color, 4.5); });
    });
    return { cx, cy, R, ang, pt };
  }

  /* ---------- Fig. 1: calificar las cinco fuerzas ---------- */

  function montarCalificar(cuerpo) {
    let v = INDUSTRIAS.aerolineas.v.slice(), geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Industria de partida', opciones: Object.entries(INDUSTRIAS).map(([k, x]) => [k, x.n]), valor: 'aerolineas', alCambiar: (k) => { v = INDUSTRIAS[k].v.slice(); sync(); } });
    const rs = FUERZAS.map((f, k) => ctl.rango({ etiqueta: f.largo, min: 1, max: 5, valor: v[k], formato: (x) => ['', 'muy débil', 'débil', 'media', 'fuerte', 'muy fuerte'][x], alCambiar: (x) => { v[k] = x; dibujar(); } }));
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'intensidad de cada fuerza (5 = la más hostil para la rentabilidad)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva los controles o haga clic sobre un eje del gráfico (cerca del centro = débil, en el borde = fuerte). Cuanto más pequeño el polígono, más rentable puede ser la industria. Pase el cursor sobre un eje para ver qué lo intensifica.');
    const sync = () => { rs.forEach((r, k) => { r.valor = v[k]; }); dibujar(); };

    function dibujar() {
      geo = radar(lienzo, [{ v, color: C.s1, relleno: true }]);
      const a = atractivo(v), mx = v.indexOf(Math.max(...v)), media = v.reduce((q, x) => q + x, 0) / 5;
      if (hover >= 0) { const [x, y] = geo.pt(hover, v[hover]); VIZ.marcador(lienzo.ctx, x, y, C.s2, 7); }
      registro.textContent = `Intensidad media ${VIZ.fmt(media, 3)} de 5 → atractivo = (5 − ${VIZ.fmt(media, 3)}) / 4 = ${pct(a)}: industria ${etiquetaAtr(a)}. La fuerza que más presiona es ${FUERZAS[mx].largo.toLowerCase()} (${v[mx]}).`;
      lectura.set([['atractivo', pct(a)], ['intensidad media', VIZ.fmt(media, 3)], ['fuerza dominante', FUERZAS[mx].n], ['fuerzas fuertes (≥ 4)', String(v.filter((x) => x >= 4).length)], ['veredicto', etiquetaAtr(a)]]);
    }
    const eje = (x, y) => {
      if (!geo) return -1;
      const dx = x - geo.cx, dy = y - geo.cy, d = Math.hypot(dx, dy);
      if (d < 8 || d > geo.R + 26) return -1;
      let mejor = -1, md = Math.PI;
      for (let k = 0; k < 5; k++) { let q = Math.abs(Math.atan2(dy, dx) - geo.ang(k)); if (q > Math.PI) q = 2 * Math.PI - q; if (q < md) { md = q; mejor = k; } }
      return md < 0.45 ? mejor : -1;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), k = eje(x, y);
      if (k < 0) return;
      v[k] = Math.max(1, Math.min(5, Math.round((Math.hypot(x - geo.cx, y - geo.cy) / geo.R) * 5)));
      sync();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), k = eje(x, y);
      if (k !== hover) { hover = k; dibujar(); }
      if (k < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${FUERZAS[k].largo}</b><br>intensidad <b>${v[k]}</b> de 5<br>${FUERZAS[k].q}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: efecto de una tecnología ---------- */

  // Cambio de intensidad en cada fuerza cuando la tecnología se generaliza en la industria (supuestos didácticos).
  const TECNO = {
    web: { n: 'Internet y comercio electrónico', d: [0.6, 0.9, 0.4, 1, -0.3], why: 'Baja las barreras de entrada y permite comparar precios al instante: los clientes ganan poder.' },
    plat: { n: 'Plataforma con efectos de red', d: [-0.4, -1, -0.3, -0.5, 0.4], why: 'Cuantos más usuarios, más valor: levanta barreras y fideliza, aunque los dueños de la plataforma concentran poder sobre quienes la usan.' },
    nube: { n: 'Nube y software como servicio', d: [0.3, 0.8, 0.2, 0.2, -0.6], why: 'Sin inversión inicial en infraestructura, entrar es barato; y hay más proveedores para elegir.' },
    ia: { n: 'Automatización e IA', d: [-0.2, -0.4, 0.2, -0.3, -0.5], why: 'Exige datos y escala para aprovecharla (barrera), reduce la dependencia de insumos laborales y abre sustitutos.' },
    datos: { n: 'Datos propios de clientes', d: [-0.3, -0.4, -0.3, -0.8, 0], why: 'Conocer al cliente permite personalizar y subir el costo de cambio: el cliente tiene menos poder.' },
    edi: { n: 'Intercambio electrónico con proveedores', d: [0, 0, 0, 0, -0.9], why: 'Abastecerse en un mercado digital con ofertas comparables reduce la dependencia de un proveedor.' },
  };

  function montarTecnologia(cuerpo) {
    let ind = 'aerolineas', tec = 'web', adop = 1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Industria', opciones: Object.entries(INDUSTRIAS).map(([k, x]) => [k, x.n]), valor: ind, alCambiar: (k) => { ind = k; dibujar(); } });
    ctl.selector({ etiqueta: 'Tecnología', opciones: Object.entries(TECNO).map(([k, x]) => [k, x.n]), valor: tec, alCambiar: (k) => { tec = k; dibujar(); } });
    ctl.rango({ etiqueta: 'Grado de adopción en la industria', min: 0, max: 1.5, paso: 0.1, valor: adop, formato: (x) => `${Math.round(x * 100)} %`, alCambiar: (x) => { adop = x; dibujar(); } });
    const lr = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 280, altoMax: 400 });
    const tipR = VIZ.tooltip(lr);
    VIZ.subtitulo(cuerpo, 'Cambio de intensidad por fuerza');
    const lb = VIZ.lienzo(cuerpo, { altoFn: () => 5 * 30 + 24 });
    const tipB = VIZ.tooltip(lb);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'antes de la tecnología', forma: 'linea' }, { color: C.s2, texto: 'después' },
      { color: C.s8, texto: 'la fuerza se intensifica' }, { color: C.s6, texto: 'la fuerza se debilita' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Compare el polígono punteado (antes) con el naranja (después). El efecto de una misma tecnología cambia de signo según la fuerza: algunas barreras suben y otras caen. Una tecnología que mejora el atractivo de la industria no lo hace necesariamente para usted: si todos la adoptan, nadie gana ventaja.');

    const despues = () => INDUSTRIAS[ind].v.map((x, k) => Math.max(1, Math.min(5, x + TECNO[tec].d[k] * adop)));
    function dibujar() {
      const a = INDUSTRIAS[ind].v, b = despues();
      radar(lr, [{ v: a, color: C.apagado, guion: true }, { v: b, color: C.s2, relleno: true }]);
      const { ctx, ancho: W } = lb;
      lb.limpiar(); geo = [];
      const x0 = W < 520 ? 80 : 110, mid = x0 + (W - x0 - 20) / 2, esc = (W - x0 - 30) / 2 / 2;
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(mid + 0.5, 4); ctx.lineTo(mid + 0.5, 5 * 30 + 4); ctx.stroke();
      FUERZAS.forEach((f, k) => {
        const d = b[k] - a[k], y = 8 + k * 30, w = d * esc;
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(f.n, x0 - 8, y + 10);
        ctx.fillStyle = d > 0 ? C.s8 : C.s6; ctx.beginPath(); ctx.roundRect(Math.min(mid, mid + w), y, Math.max(2, Math.abs(w)), 20, 3); ctx.fill();
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta; ctx.textAlign = d >= 0 ? 'left' : 'right'; ctx.fillText((d > 0 ? '+' : '') + VIZ.fmt(d, 2), mid + w + (d >= 0 ? 5 : -5), y + 10);
        geo.push({ y0: y, y1: y + 20, k, d });
      });
      const A = atractivo(a), B = atractivo(b), mayor = geo.reduce((m, g) => (Math.abs(g.d) > Math.abs(m.d) ? g : m), geo[0]);
      registro.textContent = `${TECNO[tec].n} en ${INDUSTRIAS[ind].n.toLowerCase()}: atractivo ${pct(A)} → ${pct(B)}. ${TECNO[tec].why}`;
      lectura.set([['atractivo antes', pct(A)], ['atractivo después', pct(B)], ['cambio', `${B >= A ? '+' : '−'}${Math.abs(Math.round((B - A) * 100))} puntos`], ['fuerza que más cambia', mayor.d ? FUERZAS[mayor.k].n : 'ninguna'], ['veredicto', etiquetaAtr(B)]]);
    }
    lr.alDibujar = dibujar; lb.alDibujar = dibujar;
    lr.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lr.posicion(ev), a = INDUSTRIAS[ind].v, b = despues();
      const cx = lr.ancho / 2, cy = lr.alto / 2 + 6, R = Math.min(lr.ancho / 2 - (lr.ancho < 520 ? 52 : 90), lr.alto / 2 - 34);
      let mejor = -1, md = 22 * 22;
      FUERZAS.forEach((_, k) => { const an = -Math.PI / 2 + (2 * Math.PI * k) / 5, px = cx + Math.cos(an) * R * (b[k] / 5), py = cy + Math.sin(an) * R * (b[k] / 5); const q = (px - x) ** 2 + (py - y) ** 2; if (q < md) { md = q; mejor = k; } });
      if (mejor < 0) return tipR.ocultar();
      tipR.mostrar(x, y, `<b>${FUERZAS[mejor].largo}</b>` + VIZ.filaTooltip(C.apagado, 'antes', VIZ.fmt(a[mejor], 3)) + VIZ.filaTooltip(C.s2, 'después', VIZ.fmt(b[mejor], 3)));
    });
    lr.canvas.addEventListener('pointerleave', () => tipR.ocultar());
    lb.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lb.posicion(ev), g = geo.find((t) => y >= t.y0 && y <= t.y1);
      if (!g) return tipB.ocultar();
      tipB.mostrar(x, y, `<b>${FUERZAS[g.k].largo}</b><br>${g.d > 0 ? 'se intensifica' : g.d < 0 ? 'se debilita' : 'sin cambio'}: ${g.d > 0 ? '+' : ''}${VIZ.fmt(g.d, 2)}<br>${FUERZAS[g.k].q}`);
    });
    lb.canvas.addEventListener('pointerleave', () => tipB.ocultar());
    dibujar();
  }

  VIZ.registrarTema('five-forces', {
    intro: String.raw`
      <p>El modelo de las <strong>cinco fuerzas</strong> de Michael Porter explica por qué unas industrias son más rentables que otras. La rentabilidad media de un sector depende de cinco presiones: la rivalidad entre competidores, la amenaza de nuevos entrantes, la amenaza de productos sustitutos, el poder de negociación de los clientes y el de los proveedores. Cuanto más fuertes son, más del valor creado se lo llevan otros y menos queda en la industria.</p>
      <p>La tecnología de información modifica estas fuerzas: abarata la entrada, vuelve transparentes los precios, crea plataformas con efectos de red y habilita sustitutos. Calificar las fuerzas antes y después de una tecnología ayuda a decidir si conviene adoptarla, defenderse de ella o aprovecharla.</p>`,
    visualizaciones: [
      {
        titulo: 'Califique las cinco fuerzas de una industria',
        descripcion: 'Parta de una industria y cambie las intensidades con los controles o haciendo clic sobre un eje. Compare aerolíneas (polígono grande, poco atractiva) con agua potable regulada (polígono pequeño) y busque qué fuerza explica la diferencia.',
        montar: montarCalificar,
      },
      {
        titulo: 'Qué hace una tecnología con el equilibrio',
        descripcion: 'Elija una industria y una tecnología y varíe el grado de adopción. Observe qué fuerzas suben (rojo) y cuáles bajan (verde): internet intensifica clientes y entrantes; una plataforma con efectos de red hace lo contrario.',
        montar: montarTecnologia,
      },
    ],
    teoria: String.raw`
      <h2>Las cinco fuerzas</h2>
      <ul>
        <li><strong>Rivalidad entre competidores:</strong> mayor con muchos rivales de tamaño parecido, crecimiento lento, costos fijos altos o productos poco diferenciados.</li>
        <li><strong>Nuevos entrantes:</strong> depende de las barreras de entrada (economías de escala, capital, marca, acceso a canales, regulación).</li>
        <li><strong>Sustitutos:</strong> productos distintos que cumplen la misma función y fijan un techo al precio.</li>
        <li><strong>Poder de los clientes:</strong> alto con pocos compradores grandes, bajo costo de cambio e información completa de precios.</li>
        <li><strong>Poder de los proveedores:</strong> alto con pocos proveedores, insumos únicos o alto costo de cambio.</li>
      </ul>
      <h2>Puntaje de atractivo</h2>
      <p>Si cada fuerza se califica con una intensidad \(f_k \in \{1, \dots, 5\}\), un índice simple de atractivo de la industria es</p>
      \[ A = \frac{5 - \bar f}{4}, \qquad \bar f = \frac{1}{5} \sum_{k=1}^{5} f_k, \]
      <p>que vale 100 % cuando las cinco fuerzas son mínimas y 0 % cuando son máximas. Es un resumen didáctico: no mide rentabilidad, solo ordena industrias según la presión que reciben.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Aerolíneas con \(f = (5, 3, 3, 4, 4)\): \(\bar f = 3{,}8\) y \(A = (5 - 3{,}8)/4 = 30\,\%\). Agua potable regulada con \(f = (1, 1, 2, 2, 2)\): \(\bar f = 1{,}6\) y \(A = 85\,\%\). Si internet se generaliza en las aerolíneas con los efectos de la figura (la rivalidad y los clientes llegan al tope de 5), \(\bar f\) pasa a \(4{,}2\) y \(A\) cae a 20 %.</p></div>
      <h2>Efecto de la tecnología</h2>
      <table>
        <tr><th>Tecnología</th><th>Fuerzas que tiende a intensificar</th><th>Fuerzas que tiende a debilitar</th></tr>
        <tr><td>Internet y comercio electrónico</td><td>Clientes, entrantes, rivalidad</td><td>Proveedores</td></tr>
        <tr><td>Plataformas con efectos de red</td><td>Proveedores (los que dependen de ellas)</td><td>Entrantes, clientes, rivalidad</td></tr>
        <tr><td>Nube y SaaS</td><td>Entrantes, rivalidad</td><td>Proveedores</td></tr>
        <tr><td>Datos propios y personalización</td><td>—</td><td>Clientes, entrantes, sustitutos</td></tr>
      </table>
      <p>Los cambios de la figura son supuestos didácticos. Lo importante: la tecnología no es buena o mala para la industria, sino para quien la use mejor, porque cuando todos la adoptan, el beneficio se traspasa al cliente.</p>
      <h2>Conexiones</h2>
      <p>Las cinco fuerzas miran la industria; la <a href="tema.html?id=value-chain">cadena de valor</a> mira la empresa. De ambas nacen las <a href="tema.html?id=competitive-strategies">estrategias competitivas</a>. El efecto de una plataforma en entrantes y clientes se profundiza en <a href="tema.html?id=platforms-network-effects">plataformas digitales y efectos de red</a>, y la decisión de qué tecnología comprar se evalúa en <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>.</p>`,
  });
})();
