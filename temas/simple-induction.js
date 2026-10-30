(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: el efecto dominó ---------- */

  function montarDomino(cuerpo) {
    const N = 24;
    let base = true, roto = 0, caidas = 0, ultimo = -1, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Caso base: P(0) es verdadero (se empuja la ficha 0)', valor: base, alCambiar: (v) => { base = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Paso roto en k (0 = ninguno)', min: 0, max: N - 2, valor: roto, formato: (v) => (v ? `entre ${v} y ${v + 1}` : 'ninguno'), alCambiar: (v) => { roto = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 6 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'de pie: P(n) aún no demostrada', forma: 'cuadro' },
      { color: C.s2, texto: 'cayendo ahora', forma: 'cuadro' },
      { color: C.tinta, texto: 'caída: P(n) demostrada', forma: 'cuadro' },
      { color: C.s8, texto: 'paso roto: P(k) no implica P(k+1)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La ficha n cae cuando P(n) es verdadera. Active el caso base y reproduzca; luego rompa el paso en algún k y observe hasta dónde llega la cadena.');

    function iniciar() {
      caidas = 0; ultimo = -1;
      mensaje = base ? 'Se empuja la ficha 0 (caso base).' : 'Sin caso base nadie empuja la primera ficha: no cae ninguna.';
      return (function* () {
        if (!base) return;
        caidas = 1; ultimo = 0; yield;
        for (let k = 0; k < N - 1; k++) {
          if (roto === k) { mensaje = `La ficha ${k} cayó, pero no alcanza a la ${k + 1}: el paso falla en k = ${k}.`; return; }
          caidas++; ultimo = k + 1;
          mensaje = `P(${k}) verdadera y P(${k}) ⇒ P(${k + 1}), luego P(${k + 1}).`;
          yield;
        }
        mensaje = 'Cayeron todas las fichas mostradas: P(n) para todo n.';
      })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cw = (W - 20) / N, y = H - 30, w = Math.min(14, cw * 0.55), h = 66;
      for (let i = 0; i < N; i++) {
        const cae = i < caidas, x = 10 + i * cw + cw / 2;
        ctx.save();
        ctx.translate(x + w / 2, y);
        ctx.rotate(cae ? (i === ultimo ? 0.55 : 1.2) : 0);
        ctx.fillStyle = cae ? (i === ultimo ? C.s2 : C.tinta) : C.inactivo;
        ctx.beginPath(); ctx.roundRect(-w, -h, w, h, 2); ctx.fill();
        ctx.restore();
        if (cw >= 16 || i % 4 === 0) D.texto2(ctx, String(i), x, y + 16, { color: C.apagado, px: 10 });
      }
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, y + 0.5); ctx.lineTo(W - 6, y + 0.5); ctx.stroke();
      if (roto) { const x = 10 + (roto + 1) * cw; ctx.strokeStyle = C.s8; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - h - 4); ctx.lineTo(x, y + 4); ctx.stroke(); }
      registro.textContent = mensaje;
      lectura.set([
        ['caso base', base ? 'sí' : 'no'], ['paso roto en', roto ? `k = ${roto}` : 'ninguno'], ['fichas caídas', `${caidas} de ${N}`],
        ['conclusión', base && !roto ? 'P(n) para todo n ≥ 0' : base ? `P(n) solo hasta n = ${roto}` : 'nada se concluye'],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: n² como suma de impares ---------- */

  function montarImpares(cuerpo) {
    let n = 5, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'n', min: 1, max: 12, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.4)), texto: 'capas anteriores (el cuadrado de n − 1)', forma: 'cuadro' },
      { color: C.s2, texto: 'capa nueva: 2n − 1 cuadritos', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada capa en forma de L tiene 2j − 1 cuadritos. Aumente n: el paso inductivo es agregar una L de 2n + 1 a un cuadrado de lado n para obtener uno de lado n + 1.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cs = Math.min((W - 40) / 13, (H - 30) / 13, 30), ox = 20, oy = 14;
      geo = { cs, ox, oy };
      for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) {
        const j = Math.max(f, c) + 1;
        ctx.fillStyle = j === n ? C.s2 : VIZ.css(VIZ.enRampa(0.15 + 0.6 * (j / n)));
        ctx.fillRect(ox + c * cs + 1, oy + f * cs + 1, cs - 2, cs - 2);
      }
      D.texto2(ctx, `n² = ${n * n}`, ox + n * cs + 16, oy + (n * cs) / 2, { alinea: 'left', px: 14, peso: 600 });
      lectura.set([
        ['suma 1 + 3 + … + (2n − 1)', Array.from({ length: n }, (_, j) => 2 * j + 1).reduce((a, b) => a + b, 0) + ''],
        ['n²', String(n * n)], ['capa nueva', `2n − 1 = ${2 * n - 1}`], ['paso inductivo', `${(n - 1) ** 2} + ${2 * n - 1} = ${n * n}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.ox) / geo.cs), f = Math.floor((y - geo.oy) / geo.cs);
      if (c < 0 || f < 0 || c >= n || f >= n) return tip.ocultar();
      const j = Math.max(f, c) + 1;
      tip.mostrar(x, y, `capa <b>${j}</b><br>tiene 2·${j} − 1 = <b>${2 * j - 1}</b> cuadritos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('simple-induction', {
    intro: String.raw`
      <p>La <strong>inducción matemática</strong> permite demostrar que una propiedad vale para <em>todos</em> los números naturales sin revisar uno por uno.
      Se necesitan dos cosas: que la propiedad valga para el primero (el <em>caso base</em>) y que, si vale para un número cualquiera,
      entonces valga para el siguiente (el <em>paso inductivo</em>).</p>
      <p>La imagen clásica es una fila de fichas de dominó: si se empuja la primera y cada ficha derriba a la siguiente, caen todas.
      Cada una de las dos condiciones es indispensable.</p>`,
    visualizaciones: [
      {
        titulo: 'Efecto dominó',
        descripcion: 'Quite el caso base, o rompa el paso en algún punto, y compare hasta dónde llega la demostración. Las dos condiciones se necesitan a la vez.',
        montar: montarDomino,
      },
      {
        titulo: 'n² como suma de impares',
        descripcion: 'Aumente \\(n\\) y vea el cuadrado crecer con una capa en L. Esa capa es exactamente el paso inductivo de \\(1 + 3 + \\cdots + (2n-1) = n^2\\).',
        montar: montarImpares,
      },
    ],
    teoria: String.raw`
      <h2>El principio</h2>
      <div class="recuadro"><strong>Inducción simple.</strong> Sea \(P(n)\) una propiedad de los naturales. Si
      \[ P(0) \quad\text{y}\quad \forall k \ge 0\,\bigl(P(k) \to P(k+1)\bigr), \]
      entonces \(\forall n\,P(n)\).</div>
      <p>Si el caso base es otro número \(n_0\), la conclusión es \(\forall n \ge n_0\,P(n)\). Es la versión como regla del axioma de inducción de
      <a href="tema.html?id=peano-axioms">Peano</a>: tomando \(A = \{n : P(n)\}\), el axioma dice que \(A = \mathbb{N}\).</p>
      <h2>Plantilla de una demostración</h2>
      <ol>
        <li><strong>Caso base:</strong> verificar \(P(0)\) (o \(P(n_0)\)).</li>
        <li><strong>Hipótesis inductiva:</strong> suponer \(P(k)\) para un \(k\) arbitrario.</li>
        <li><strong>Paso inductivo:</strong> demostrar \(P(k+1)\) usando la hipótesis.</li>
        <li><strong>Conclusión:</strong> por inducción, \(P(n)\) para todo \(n\).</li>
      </ol>
      <h2>Ejemplo: suma de impares</h2>
      <p>\(P(n)\): \(1 + 3 + \cdots + (2n-1) = n^2\). Base: \(n=1\), \(1 = 1^2\). Paso: si \(\sum_{i=1}^{k}(2i-1) = k^2\), entonces
      \[ \sum_{i=1}^{k+1}(2i-1) = k^2 + (2k+1) = (k+1)^2. \]
      Geométricamente, \(2k+1\) es el número de cuadritos de la capa en L.</p>
      <h2>Por qué es válida</h2>
      <p>Si \(P\) no valiera siempre, por el <a href="tema.html?id=well-ordering">buen orden</a> habría un menor contraejemplo \(m\). Como \(P(0)\) vale, \(m \ge 1\), y \(P(m-1)\) vale por minimalidad;
      el paso inductivo daría \(P(m)\): contradicción. Más ejemplos, con desigualdades y divisibilidad, en <a href="tema.html?id=induction-proofs">Induction Proofs</a>.</p>`,
  });
})();
