(function () {
  'use strict';
  const { color: C } = VIZ;

  // Hash entero (mezclador de 32 bits) a [0, 1).
  function h(x) {
    let v = Math.imul(x, 0x9e3779b1);
    v ^= v >>> 16; v = Math.imul(v, 0x85ebca6b);
    v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16;
    return (v >>> 0) / 4294967296;
  }
  // Posiciones de los servidores (con v nodos virtuales) ordenadas en el anillo.
  function anillo(servidores, v) {
    const pts = [];
    for (const s of servidores) for (let k = 0; k < v; k++) pts.push({ p: h(s * 7919 + k * 104729 + 13), s });
    return pts.sort((a, b) => a.p - b.p);
  }
  function duenio(pts, x) {
    let lo = 0, hi = pts.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].p < x) lo = m + 1; else hi = m; }
    return pts[lo % pts.length].s;
  }

  /* ---------- Fig. 1: agregar y quitar servidores ---------- */

  function montarAnillo(cuerpo) {
    const est = { servidores: [0, 1, 2, 3], v: 1, claves: 80 };
    let antes = null, movidas = new Set(), movidasMod = 0, ultimoCambio = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Nodos virtuales por servidor', min: 1, max: 16, valor: est.v, alCambiar: (v) => { est.v = v; antes = null; movidas = new Set(); ultimoCambio = ''; dibujar(); } });
    ctl.boton('Agregar servidor', () => cambiar(() => { const libre = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !est.servidores.includes(i)); if (libre != null) est.servidores.push(libre); }), { primario: true });
    ctl.boton('Quitar un servidor', () => cambiar(() => { if (est.servidores.length > 2) est.servidores.splice(1, 1); }));
    ctl.boton('Reiniciar', () => { est.servidores = [0, 1, 2, 3]; antes = null; movidas = new Set(); ultimoCambio = ''; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(420, Math.max(320, w * 0.45)) });
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los cuadrados son servidores (o sus nodos virtuales) y los puntos, claves; cada clave pertenece al primer servidor siguiente en sentido horario. Las claves con anillo cambiaron de dueño en el último cambio.');

    const claves = () => Array.from({ length: est.claves }, (_, i) => h(500000 + i));
    function cambiar(f) {
      const pts0 = anillo(est.servidores, est.v), n0 = est.servidores.slice();
      antes = claves().map((x) => duenio(pts0, x));
      const modAntes = claves().map((x) => n0[Math.floor(x * 1e6) % n0.length]);
      f();
      const pts1 = anillo(est.servidores, est.v);
      movidas = new Set(claves().map((x, i) => (duenio(pts1, x) !== antes[i] ? i : -1)).filter((i) => i >= 0));
      movidasMod = claves().filter((x, i) => est.servidores[Math.floor(x * 1e6) % est.servidores.length] !== modAntes[i]).length;
      ultimoCambio = est.servidores.length > n0.length ? 'agregar' : est.servidores.length < n0.length ? 'quitar' : '';
      dibujar();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 30;
      const pt = (x, r = R) => ({ x: cx + r * Math.cos(-Math.PI / 2 + x * 2 * Math.PI), y: cy + r * Math.sin(-Math.PI / 2 + x * 2 * Math.PI) });
      const pts = anillo(est.servidores, est.v);
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      const col = (s) => VIZ.series[s % 8];
      const carga = {};
      claves().forEach((x, i) => {
        const s = duenio(pts, x);
        carga[s] = (carga[s] || 0) + 1;
        const p = pt(x, R - 14);
        if (movidas.has(i)) { ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.fillStyle = col(s); ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
      });
      for (const q of pts) {
        const p = pt(q.p);
        ctx.fillStyle = col(q.s); ctx.strokeStyle = C.superficie; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(p.x - 6, p.y - 6, 12, 12); ctx.fill(); ctx.stroke();
      }
      ley.set(est.servidores.map((s) => ({ color: col(s), texto: `S${s + 1}: ${carga[s] || 0} claves` })));
      const n = est.servidores.length;
      const cargas = est.servidores.map((s) => carga[s] || 0);
      registro.textContent = !ultimoCambio ? `${n} servidores con ${est.v} nodo${est.v > 1 ? 's' : ''} virtual${est.v > 1 ? 'es' : ''} cada uno. Agregue o quite un servidor.`
        : `Al ${ultimoCambio} un servidor cambiaron de dueño ${movidas.size} de ${est.claves} claves (≈ 1/${ultimoCambio === 'agregar' ? n : n + 1} = ${Math.round(est.claves / (ultimoCambio === 'agregar' ? n : n + 1))}). Con hash mod n habrían cambiado ${movidasMod}.`;
      lectura.set([
        ['servidores', String(n)],
        ['claves movidas', ultimoCambio ? String(movidas.size) : '—'],
        ['con hash mod n', ultimoCambio ? String(movidasMod) : '—'],
        ['carga máx. / promedio', VIZ.fmt(Math.max(...cargas) / (est.claves / n), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: desequilibrio según nodos virtuales ---------- */

  function montarEquilibrio(cuerpo) {
    let n = 10, datos = null, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Servidores', min: 3, max: 50, valor: n, alCambiar: (v) => { n = v; medir(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'carga del servidor más cargado / promedio', forma: 'linea' }, { color: C.s2, texto: 'fracción del anillo: máx / promedio', forma: 'linea' }, { color: C.apagado, texto: 'reparto perfecto', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '10 000 claves y 10 repeticiones con servidores ubicados al azar por cada cantidad de nodos virtuales. Pase el cursor por el gráfico.');

    function medir() {
      const vs = [1, 2, 4, 8, 16, 32, 64, 128, 256];
      const claves = Array.from({ length: 10000 }, (_, i) => h(900000 + i));
      datos = vs.map((v) => {
        let mx = 0, fr = 0;
        for (let r = 0; r < 10; r++) {
          const servidores = Array.from({ length: n }, (_, i) => i + r * 100);
          const pts = anillo(servidores, v);
          const c = new Map();
          for (const x of claves) { const s = duenio(pts, x); c.set(s, (c.get(s) || 0) + 1); }
          mx += Math.max(...c.values()) / (claves.length / n);
          const arco = new Map();
          pts.forEach((q, i) => { const prev = i ? pts[i - 1].p : pts[pts.length - 1].p - 1; arco.set(q.s, (arco.get(q.s) || 0) + q.p - prev); });
          fr += Math.max(...arco.values()) * n;
        }
        return { v, max: mx / 10, frac: fr / 10 };
      });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(2, ...datos.map((d) => d.frac)) * 1.08;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 8, ymin: 0, ymax }, { etiquetaX: 'nodos virtuales por servidor (escala log)', etiquetaY: 'máximo / promedio', formatoX: (x) => String(2 ** x), ticksX: [0, 2, 4, 6, 8] });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, 1], [8, 1]], C.apagado, 1.5, [3, 4]);
      const x = (d) => Math.log2(d.v);
      VIZ.trazar(ctx, plano, datos.map((d) => [x(d), d.frac]), C.s2, 2);
      VIZ.trazar(ctx, plano, datos.map((d) => [x(d), d.max]), C.s1, 2);
      for (const d of datos) { VIZ.marcador(ctx, plano.sx(x(d)), plano.sy(d.max), C.s1, hover === d ? 5.5 : 3.5); VIZ.marcador(ctx, plano.sx(x(d)), plano.sy(d.frac), C.s2, hover === d ? 5.5 : 3.5, 1); }
      lectura.set([
        ['con 1 nodo virtual', `${VIZ.fmt(datos[0].max, 3)}× el promedio`],
        ['con 256', `${VIZ.fmt(datos[datos.length - 1].max, 3)}×`],
        ['ln n (esperado sin virtuales)', VIZ.fmt(Math.log(n), 3)],
      ]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const v = 2 ** Math.round(plano.ix(x));
      hover = datos.find((d) => d.v === v) || null; dibujar();
      if (hover) tip.mostrar(x, y, `<b>${hover.v}</b> nodos virtuales` + VIZ.filaTooltip(C.s1, 'carga máx./prom.', VIZ.fmt(hover.max, 3)) + VIZ.filaTooltip(C.s2, 'arco máx./prom.', VIZ.fmt(hover.frac, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
  }

  VIZ.registrarTema('consistent-hashing', {
    intro: String.raw`
      <p>Para repartir \(K\) claves entre \(n\) servidores, lo obvio es \(h(k) \bmod n\). Funciona hasta que cambia \(n\): al agregar o quitar un servidor casi todas las claves cambian de
      dueño, y una caché distribuida pierde de golpe casi todo su contenido.</p>
      <p>El <strong>hashing consistente</strong> (Karger et al., 1997) ubica claves <em>y servidores</em> en un mismo anillo con la función de hash; cada clave pertenece al primer servidor
      que la sigue. Al agregar un servidor solo se mueven las claves del arco que le toca, en promedio \(K/n\). Es la idea detrás de <a href="tema.html?id=chord-dht">Chord</a>, Dynamo,
      Cassandra y los balanceadores de carga de las CDN.</p>`,
    visualizaciones: [
      {
        titulo: 'Agregar y quitar servidores',
        descripcion: 'Agregue un servidor y cuente las claves con anillo: solo las del arco que tomó. Compare con hash mod n. Con un nodo virtual los arcos son muy desiguales; súbalos y la carga se empareja.',
        montar: montarAnillo,
      },
      {
        titulo: 'Desequilibrio según los nodos virtuales',
        descripcion: 'Con un solo punto por servidor, el más cargado recibe varias veces el promedio. Con cientos de nodos virtuales por servidor, el reparto se acerca al ideal.',
        montar: montarEquilibrio,
      },
    ],
    teoria: String.raw`
      <h2>Cuántas claves se mueven</h2>
      <p>Con \(h(k) \bmod n\), al pasar de \(n\) a \(n+1\) servidores una clave conserva su dueño solo si \(h(k) \bmod n = h(k) \bmod (n+1)\), lo que ocurre para una fracción
      \(\approx 1/(n+1)\) de las claves: se mueven casi todas. Con hashing consistente, el servidor nuevo toma un arco cuyo largo esperado es \(1/(n+1)\) del anillo y solo esas claves
      cambian de dueño, todas hacia él:</p>
      \[ \mathbb{E}[\text{claves movidas}] = \frac{K}{n+1}, \]
      <p>que es el mínimo posible para quedar equilibrado.</p>

      <h2>Equilibrio y nodos virtuales</h2>
      <p>Con \(n\) puntos al azar en el anillo, los arcos tienen largo aproximadamente exponencial de media \(1/n\), y el mayor mide \(\Theta\big(\tfrac{\log n}{n}\big)\): el servidor más
      cargado recibe del orden de \(\ln n\) veces el promedio. Si cada servidor se ubica en \(v\) puntos (<strong>nodos virtuales</strong>), su carga es la suma de \(v\) arcos y la desviación
      relativa cae como \(1/\sqrt{v}\); con \(v = \Theta(\log n)\) el desequilibrio es una constante. Los nodos virtuales también permiten dar más puntos a los servidores más potentes y
      repartir la carga de uno que cae entre muchos, en vez de cargársela entera al siguiente.</p>

      <h2>Variantes</h2>
      <ul>
        <li><strong>Rendezvous hashing</strong> (HRW): cada clave va al servidor con mayor \(h(k, s)\). Mismas propiedades sin anillo, a costo \(O(n)\) por búsqueda.</li>
        <li><strong>Jump consistent hash</strong> (Google): sin memoria y \(O(\log n)\), para servidores numerados de 0 a \(n-1\).</li>
        <li><strong>Con cotas de carga</strong>: si un servidor supera \((1+\varepsilon)\) veces el promedio, la clave pasa al siguiente.</li>
      </ul>
      <p>Para encontrar el sucesor sin conocer todo el anillo, cada nodo guarda atajos: es lo que hace <a href="tema.html?id=chord-dht">Chord</a>.</p>`,
  });
})();
