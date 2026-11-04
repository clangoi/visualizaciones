(function () {
  'use strict';
  const { color: C } = VIZ;

  function binom(n, k, p) { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c * p ** k * (1 - p) ** (n - k); }

  function montarMux(cuerpo) {
    let N = 35, p = 10, cap = 10, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Usuarios N', min: 2, max: 80, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Fracción del tiempo que transmite cada uno', min: 1, max: 50, valor: p, formato: (v) => v + ' %', alCambiar: (v) => { p = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Usuarios que caben con circuitos', min: 2, max: 30, valor: cap, alCambiar: (v) => { cap = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'probabilidad de k usuarios activos a la vez' }, { color: C.s8, texto: 'k mayor que la capacidad (cola o pérdida)' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un enlace da servicio a «cap» usuarios simultáneos. Con circuitos reservados solo caben «cap» usuarios; con paquetes caben N si rara vez hay más de «cap» activos a la vez.');
    const P = (k) => binom(N, k, p / 100);
    let geo;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const kmax = Math.min(N, Math.max(cap + 8, Math.ceil(N * p / 100 * 2.5) + 4)), izq = 44, base = H - 34, bw = (W - izq - 10) / (kmax + 1);
      const mx = Math.max(...Array.from({ length: kmax + 1 }, (_, k) => P(k))); geo = { izq, bw, kmax };
      for (let k = 0; k <= kmax; k++) {
        const h = (P(k) / mx) * (base - 18); ctx.fillStyle = k > cap ? C.s8 : C.s1;
        ctx.beginPath(); ctx.roundRect(izq + k * bw + 1, base - h, bw - 2, h, [3, 3, 0, 0]); ctx.fill();
      }
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - 10, base + 0.5); ctx.stroke();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let k = 0; k <= kmax; k += kmax > 20 ? 2 : 1) ctx.fillText(String(k), izq + k * bw + bw / 2, base + 6);
      ctx.textAlign = 'right'; ctx.fillText('usuarios activos a la vez', W - 10, base + 20); ctx.textAlign = 'left'; ctx.fillText('probabilidad', 4, 2);
      let exceso = 0; for (let k = cap + 1; k <= N; k++) exceso += P(k);
      lectura.set([['usuarios con circuitos', String(cap)], ['usuarios con paquetes', String(N)], ['activos en promedio', VIZ.fmt((N * p) / 100, 3)], ['P(más de «cap» activos)', exceso < 1e-4 ? '< 0,01 %' : `${VIZ.fmt(exceso * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), k = Math.floor((x - geo.izq) / geo.bw);
      if (k >= 0 && k <= geo.kmax) tip.mostrar(x, y, `<b>${k}</b> activos<br>probabilidad ${VIZ.fmt(P(k) * 100, 3)} %`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarAlmacenaReenvia(cuerpo) {
    let L = 12000, pk = 3000, saltos = 3, R = 1000, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Mensaje (bits)', min: 1000, max: 24000, paso: 1000, valor: L, alCambiar: (v) => { L = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño de paquete (bits)', min: 500, max: 24000, paso: 500, valor: pk, alCambiar: (v) => { pk = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Enlaces en el camino', min: 1, max: 6, valor: saltos, alCambiar: (v) => { saltos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 60 + 6 * 22 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'paquete transmitiéndose por cada enlace (1 000 bits/ms)' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada router recibe el paquete completo antes de reenviarlo. Dividir el mensaje en paquetes permite que los enlaces trabajen en paralelo (como una línea de montaje).');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const np = Math.ceil(L / pk), tp = pk / R, total = (np + saltos - 1) * tp, totalUno = saltos * (L / R);
      const izq = 62, esc = (W - izq - 12) / Math.max(total, totalUno);
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      for (let h = 0; h < saltos; h++) {
        const y = 14 + h * 22; ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText('enlace ' + (h + 1), izq - 6, y + 9);
        for (let i = 0; i < np; i++) { const t0 = (h + i) * tp; ctx.fillStyle = VIZ.series[i % 8]; ctx.fillRect(izq + t0 * esc, y, Math.max(1, tp * esc - 1), 18); }
      }
      const yb = 14 + saltos * 22 + 6;
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(izq, yb); ctx.lineTo(izq + total * esc, yb); ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(`${VIZ.fmt(total, 3)} ms con ${np} paquetes`, izq, yb + 14);
      lectura.set([['paquetes', String(np)], ['tiempo con paquetes', `${VIZ.fmt(total, 3)} ms`], ['sin dividir (mensaje entero)', `${VIZ.fmt(totalUno, 3)} ms`], ['aceleración', `${VIZ.fmt(totalUno / total, 3)}×`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('packet-switching', {
    intro: String.raw`
      <p>Una red de computadores es un conjunto de <em>hosts</em> conectados por <em>enlaces</em> (cobre, fibra, radio) a través de <em>routers</em> y <em>switches</em>. Hay dos formas de repartir los enlaces: <strong>conmutación de circuitos</strong>, que reserva una porción del enlace para cada comunicación (como la telefonía clásica), y <strong>conmutación de paquetes</strong>, donde los datos se cortan en paquetes que comparten los enlaces según se necesitan.</p>
      <p>La de paquetes aprovecha que el tráfico viene a ráfagas (<em>multiplexación estadística</em>): casi nunca todos transmiten a la vez.</p>`,
    visualizaciones: [
      { titulo: 'Multiplexación estadística', descripcion: 'Con 35 usuarios que transmiten el 10 % del tiempo, un enlace para 10 sirve casi siempre. Suba la fracción de actividad y vea crecer la probabilidad de congestión.', montar: montarMux },
      { titulo: 'Almacenar y reenviar', descripcion: 'Divida un mensaje en paquetes más pequeños y compare el tiempo de entrega con enviarlo entero por varios enlaces.', montar: montarAlmacenaReenvia },
    ],
    teoria: String.raw`
      <h2>Circuitos frente a paquetes</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Circuitos</th><th class="izq">Paquetes</th></tr>
      <tr><td class="izq">recursos</td><td class="izq">reservados durante toda la llamada</td><td class="izq">según demanda</td></tr>
      <tr><td class="izq">si el usuario calla</td><td class="izq">el recurso se desperdicia</td><td class="izq">otros lo aprovechan</td></tr>
      <tr><td class="izq">congestión</td><td class="izq">llamada bloqueada al inicio</td><td class="izq">retardo y pérdida de paquetes</td></tr>
      <tr><td class="izq">ejemplo</td><td class="izq">telefonía clásica</td><td class="izq">Internet</td></tr></table>
      <h2>Cuántos usuarios caben</h2>
      <p>Con \(N\) usuarios activos cada uno con probabilidad \(p\), el número de activos a la vez es binomial:</p>
      \[ P(k \text{ activos}) = \binom{N}{k} p^k (1-p)^{N-k}. \]
      <p>Un enlace de 1 Mbps con usuarios de 100 kbps al 10 %: con circuitos caben 10; con paquetes, 35 usuarios hacen que la probabilidad de más de 10 activos simultáneos sea inferior a 0,04 %.</p>
      <h2>Almacenar y reenviar</h2>
      <p>Cada router recibe el paquete completo antes de reenviarlo. Un paquete de \(L\) bits por \(h\) enlaces de velocidad \(R\) tarda \(h\,L/R\). Si el mensaje de \(M\) bits se parte en \(n\) paquetes de \(L = M/n\) bits, se superponen las transmisiones:</p>
      \[ T = \left(n + h - 1\right)\frac{M}{nR}. \]
      <p>Con \(M = 12\,000\) bits, \(h = 3\), \(R = 1\) Mbps: entero 36 ms; en 4 paquetes, 15 ms. Los <a href="tema.html?id=network-delays">retardos</a> y el <a href="tema.html?id=layering-encapsulation">modelo de capas</a> completan la visión.</p>`,
  });
})();
