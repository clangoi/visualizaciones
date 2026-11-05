(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const COND = { color: 'Un rasgo: color distinto', forma: 'Un rasgo: forma distinta', conj: 'Conjunción: color y forma a la vez' };

  /* ---------- Fig. 1: búsqueda visual cronometrada ---------- */

  function montarBusqueda(cuerpo) {
    let cond = 'color', n = 24, items = [], inicio = 0, resuelto = false, ronda = 0, mensaje = '';
    const datos = {}; // 'cond|n' → tiempos
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de búsqueda', valor: cond, opciones: Object.entries(COND), alCambiar: (v) => { cond = v; nueva(); } });
    ctl.rango({ etiqueta: 'Cantidad de marcas', min: 8, max: 80, paso: 8, valor: n, alCambiar: (v) => { n = v; nueva(); } });
    ctl.boton('Nueva prueba', () => nueva(), { primario: true });
    ctl.boton('Borrar tiempos', () => { for (const k in datos) delete datos[k]; nueva(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const grafico = VIZ.lienzo(cuerpo, { altoFn: () => 170 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'un rasgo: color', forma: 'linea' }, { color: C.s2, texto: 'un rasgo: forma', forma: 'linea' }, { color: C.s7, texto: 'conjunción', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic lo más rápido posible en la marca distinta (naranja redonda; cuadrada azul; o naranja cuadrada entre azules cuadradas y naranjas redondas). Abajo se grafica su tiempo medio según la cantidad de marcas: plano si el rasgo «salta a la vista».');
    function nueva() {
      const rnd = VIZ.semilla(Date.now() % 100000 + ronda++);
      items = [];
      const W = lienzo.ancho, H = lienzo.alto, filas = Math.ceil(Math.sqrt(n * H / W)), cols = Math.ceil(n / filas);
      const celdas = Array.from({ length: filas * cols }, (_, i) => i).sort(() => rnd() - 0.5).slice(0, n);
      const t = Math.floor(rnd() * n);
      celdas.forEach((c, i) => {
        const x = ((c % cols) + 0.5) * (W / cols) + (rnd() - 0.5) * 8, y = (Math.floor(c / cols) + 0.5) * (H / filas) + (rnd() - 0.5) * 6;
        let col = C.s1, forma = 0;
        if (cond === 'color') { if (i === t) col = C.s2; }
        else if (cond === 'forma') { if (i === t) forma = 1; }
        else { const a = i % 2 === 0; col = a ? C.s2 : C.s1; forma = a ? 0 : 1; if (i === t) { col = C.s2; forma = 1; } }
        items.push({ x, y, col, forma, objetivo: i === t });
      });
      resuelto = false; mensaje = 'Busque la marca distinta…';
      dibujar(); inicio = performance.now();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      items.forEach((q) => { ctx.fillStyle = q.col; ctx.beginPath(); VIZ.forma(ctx, q.x, q.y, 7, q.forma); ctx.fill(); if (resuelto && q.objetivo) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 14, 0, 6.3); ctx.stroke(); } });
      registro.textContent = mensaje;
      graficar();
    }
    function graficar() {
      const { ctx } = grafico;
      grafico.limpiar();
      const plano = VIZ.plano(grafico, { xmin: 8, xmax: 80, ymin: 0, ymax: 3 }, { etiquetaX: 'cantidad de marcas', etiquetaY: 'tiempo medio (s)' });
      plano.ejes();
      const cols = { color: C.s1, forma: C.s2, conj: C.s7 };
      for (const c of Object.keys(COND)) {
        const pts = [];
        for (let m = 8; m <= 80; m += 8) { const a = datos[`${c}|${m}`]; if (a && a.length) pts.push([m, Math.min(3, a.reduce((s, v) => s + v, 0) / a.length / 1000)]); }
        if (pts.length > 1) VIZ.trazar(grafico.ctx, plano, pts, cols[c], 2);
        pts.forEach(([x, y]) => VIZ.marcador(ctx, plano.sx(x), plano.sy(y), cols[c], 4));
      }
    }
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      if (resuelto) return;
      const { x, y } = lienzo.posicion(ev);
      const q = items.find((m) => Math.hypot(m.x - x, m.y - y) < 12);
      if (!q) return;
      if (!q.objetivo) { mensaje = 'Esa no es: siga buscando.'; return dibujar(); }
      const t = performance.now() - inicio;
      (datos[`${cond}|${n}`] ||= []).push(t);
      resuelto = true; mensaje = `Encontrada en ${VIZ.fmt(t / 1000, 3)} s con ${n} marcas.`; dibujar();
    });
    lienzo.alDibujar = () => items.length && dibujar();
    grafico.alDibujar = graficar;
    nueva();
  }

  /* ---------- Fig. 2: rasgos que saltan a la vista ---------- */

  const RASGOS = [
    ['Color', (ctx, x, y, o) => { ctx.fillStyle = o ? C.s2 : C.s1; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill(); }],
    ['Tamaño', (ctx, x, y, o) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(x, y, o ? 9 : 5, 0, 6.3); ctx.fill(); }],
    ['Orientación', (ctx, x, y, o) => { ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; const a = o ? 0.9 : 0; ctx.beginPath(); ctx.moveTo(x - 6 * Math.cos(a), y - 6 * Math.sin(a) - 0 * 1); ctx.lineTo(x + 6 * Math.cos(a), y + 6 * Math.sin(a)); ctx.stroke(); }],
    ['Cierre', (ctx, x, y, o) => { ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5.5, o ? 0.6 : 0, o ? 5.7 : 6.3); ctx.stroke(); }],
    ['Luminancia', (ctx, x, y, o) => { ctx.fillStyle = o ? C.tinta : C.inactivo; ctx.fillRect(x - 5, y - 5, 10, 10); }],
    ['Movimiento (simulado: estela)', (ctx, x, y, o) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.3); ctx.fill(); if (o) { ctx.fillStyle = VIZ.alfa(C.s1, 0.35); ctx.beginPath(); ctx.arc(x - 6, y, 4.5, 0, 6.3); ctx.arc(x - 11, y, 4.5, 0, 6.3); ctx.fill(); } }],
  ];

  function montarRasgos(cuerpo) {
    let mostrar = false, semilla = 1, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Mostrar dónde está la marca distinta', valor: false, alCambiar: (v) => { mostrar = v; dibujar(); } });
    ctl.boton('Otra posición', () => { semilla++; generar(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 520 : 260) });
    cuerpo.dataset.sinLeyenda = 'cada panel nombra su rasgo';
    VIZ.nota(cuerpo, 'En cada panel hay una marca distinta. Intente encontrarla sin buscar una por una: en estos rasgos lo hacemos casi al instante, y el tiempo no crece con la cantidad de marcas.');
    function generar() { const r = VIZ.semilla(semilla * 7); pos = RASGOS.map(() => ({ t: Math.floor(r() * 30), j: Array.from({ length: 30 }, () => [r() - 0.5, r() - 0.5]) })); }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cols = W < 520 ? 2 : 3, pw = W / cols, ph = W < 520 ? 160 : 130, nc = 6, nf = 5;
      RASGOS.forEach(([nombre, f], k) => {
        const ox = (k % cols) * pw, oy = Math.floor(k / cols) * ph;
        ctx.strokeStyle = C.rejilla; ctx.strokeRect(ox + 4.5, oy + 4.5, pw - 9, ph - 9);
        V.rotulo(ctx, nombre, ox + 10, oy + 14, { tam: 10, peso: 600 });
        for (let i = 0; i < 30; i++) {
          const x = ox + 18 + ((i % nc) + 0.5) * ((pw - 36) / nc) + pos[k].j[i][0] * 8, y = oy + 28 + (Math.floor(i / nc) + 0.5) * ((ph - 42) / nf) + pos[k].j[i][1] * 6;
          f(ctx, x, y, i === pos[k].t);
          if (mostrar && i === pos[k].t) { ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.3); ctx.stroke(); }
        }
      });
    }
    lienzo.alDibujar = () => pos.length && dibujar();
    generar(); dibujar();
  }

  VIZ.registrarTema('preattentive-processing', {
    intro: String.raw`
      <p>Algunas diferencias visuales se detectan en una fracción de segundo, <strong>antes de que dirijamos la atención</strong>: una marca roja entre cien grises «salta» a la vista. Otras exigen buscar con la mirada, una por una. Lo primero es <em>procesamiento preatencional</em>.</p>
      <p>Para una visualización, esto indica qué canal usar para resaltar lo importante y por qué combinar dos rasgos para buscar un objetivo funciona mal.</p>`,
    visualizaciones: [
      { titulo: 'Búsqueda visual cronometrada', descripcion: 'Encuentre la marca distinta con distintos rasgos y cantidades de marcas; su tiempo medio se grafica según la cantidad.', montar: montarBusqueda },
      { titulo: 'Rasgos preatentivos', descripcion: 'Seis rasgos que destacan una marca entre distractores; busque la distinta y luego compruebe.', montar: montarRasgos },
    ],
    teoria: String.raw`
      <h2>Búsqueda en paralelo y en serie</h2>
      <p>Si el objetivo se distingue por un solo rasgo, el tiempo de búsqueda es prácticamente <em>independiente</em> del número \(n\) de distractores (búsqueda en paralelo):
      \[ T(n) \approx a + b\,n, \quad b \approx 0. \]
      Si el objetivo se define por la <strong>conjunción</strong> de rasgos (rojo <em>y</em> cuadrado), hay que examinar las marcas una a una: \(b > 0\), típicamente 20–50 ms por marca, y el tiempo crece linealmente con \(n\).</p>
      <h2>Rasgos preatentivos</h2>
      <p>Tono de color, luminancia, tamaño, orientación, curvatura, cierre o encierro, movimiento y parpadeo, profundidad estereoscópica. Funcionan en la medida en que el valor del objetivo está <em>lejos</em> de los distractores y los distractores son <em>homogéneos</em>.</p>
      <h2>Reglas de diseño</h2>
      <ul>
        <li>Para resaltar una marca, use <strong>un</strong> canal con valor único (un solo color vivo entre grises).</li>
        <li>No sature: si todo está resaltado, nada lo está.</li>
        <li>Evite que el resaltado dependa de la combinación de dos canales.</li>
        <li>Los canales de identidad (tono, forma) permiten encontrar; los de magnitud permiten además comparar.</li>
      </ul>
      <div class="recuadro"><strong>Límite.</strong> El color es potente pero no sirve a un 8 % de los varones con daltonismo: refuerce con forma o tamaño (ver <a href="tema.html?id=color-channels-hsl">color</a>).</div>
      <p>Cómo se agrupan las marcas una vez vistas: <a href="tema.html?id=gestalt-grouping">principios de Gestalt</a>.</p>`,
  });
})();
