(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const sig = (z) => 1 / (1 + Math.exp(-z));

  /* ---------- Fig. 1: grafo de cómputo paso a paso ---------- */

  function montarGrafo(cuerpo) {
    let x = [1, 0.5], y = 1, eta = 0.5, semilla = 3, w = null, iter = 0;
    let est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Entrada x₁', min: -2, max: 2, paso: 0.1, valor: x[0], formato: (v) => v.toFixed(1), alCambiar: (v) => { x[0] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Entrada x₂', min: -2, max: 2, paso: 0.1, valor: x[1], formato: (v) => v.toFixed(1), alCambiar: (v) => { x[1] = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Objetivo y', opciones: [['1', '1'], ['0', '0']], valor: '1', alCambiar: (v) => { y = +v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje η', min: 0.05, max: 3, paso: 0.05, valor: eta, formato: (v) => v.toFixed(2), alCambiar: (v) => { eta = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos pesos', () => { semilla++; pesos(); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.46, altoMin: 300, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'pasada hacia adelante: activación a', forma: 'punto' },
      { color: C.s2, texto: 'pasada hacia atrás: δ = ∂L/∂z y ∂L/∂w', forma: 'punto' },
      { color: C.s7, texto: 'cálculo del paso actual', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada «Un paso» calcula un solo número. Después de actualizar los pesos, «Reiniciar» vuelve a empezar con los pesos nuevos: la pérdida baja de una vuelta a la siguiente.');

    function pesos() {
      const rnd = VIZ.semilla(semilla);
      const r = () => Math.round(VIZ.normal(rnd) * 100) / 100;
      w = { W1: [[r(), r()], [r(), r()]], b1: [0, 0], W2: [r(), r()], b2: 0 };
      iter = 0;
    }
    // Estado visible: qué valores ya se calcularon.
    function iniciar() {
      est = { z1: [null, null], a1: [null, null], z2: null, a2: null, L: null, d2: null, d1: [null, null], gW2: [null, null], gW1: [[null, null], [null, null]], foco: null, msg: '' };
      est.msg = `Entrada x = (${x[0].toFixed(2)}, ${x[1].toFixed(2)}), objetivo y = ${y}. Pérdida de entropía cruzada L = −[y ln ŷ + (1 − y) ln(1 − ŷ)].`;
      return (function* () {
        for (let j = 0; j < 2; j++) {
          est.z1[j] = w.W1[j][0] * x[0] + w.W1[j][1] * x[1] + w.b1[j];
          est.a1[j] = sig(est.z1[j]);
          est.foco = `h${j}`;
          est.msg = `h${j + 1}: z = ${w.W1[j][0]}·${x[0].toFixed(2)} + ${w.W1[j][1]}·${x[1].toFixed(2)} + ${w.b1[j].toFixed(2)} = ${est.z1[j].toFixed(3)};  a = σ(z) = ${est.a1[j].toFixed(3)}`;
          yield;
        }
        est.z2 = w.W2[0] * est.a1[0] + w.W2[1] * est.a1[1] + w.b2;
        est.a2 = sig(est.z2);
        est.foco = 'o';
        est.msg = `Salida: z = ${w.W2[0]}·${est.a1[0].toFixed(3)} + ${w.W2[1]}·${est.a1[1].toFixed(3)} + ${w.b2.toFixed(2)} = ${est.z2.toFixed(3)};  ŷ = σ(z) = ${est.a2.toFixed(3)}`;
        yield;
        est.L = -(y * Math.log(est.a2) + (1 - y) * Math.log(1 - est.a2));
        est.foco = 'L';
        est.msg = `Pérdida: L = ${est.L.toFixed(4)}. Ahora se recorre el grafo al revés.`;
        yield;
        est.d2 = est.a2 - y;
        est.foco = 'o';
        est.msg = `δ_salida = ∂L/∂z = ŷ − y = ${est.a2.toFixed(3)} − ${y} = ${est.d2.toFixed(3)}  (sigmoide con entropía cruzada se simplifica así).`;
        yield;
        for (let j = 0; j < 2; j++) {
          est.gW2[j] = est.d2 * est.a1[j];
          est.foco = `w2${j}`;
          est.msg = `∂L/∂w = δ_salida · a(h${j + 1}) = ${est.d2.toFixed(3)} · ${est.a1[j].toFixed(3)} = ${est.gW2[j].toFixed(4)}`;
          yield;
        }
        for (let j = 0; j < 2; j++) {
          est.d1[j] = est.d2 * w.W2[j] * est.a1[j] * (1 - est.a1[j]);
          est.foco = `h${j}`;
          est.msg = `δ(h${j + 1}) = δ_salida · w · σ′(z) = ${est.d2.toFixed(3)} · ${w.W2[j]} · ${(est.a1[j] * (1 - est.a1[j])).toFixed(3)} = ${est.d1[j].toFixed(4)}  (regla de la cadena)`;
          yield;
        }
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          est.gW1[j][i] = est.d1[j] * x[i];
          est.foco = `w1${j}${i}`;
          est.msg = `∂L/∂w(x${i + 1}→h${j + 1}) = δ(h${j + 1}) · x${i + 1} = ${est.d1[j].toFixed(4)} · ${x[i].toFixed(2)} = ${est.gW1[j][i].toFixed(4)}`;
          yield;
        }
        // Comprobación con diferencias finitas sobre un peso.
        const perdida = (W) => {
          const a = [0, 1].map((j) => sig(W.W1[j][0] * x[0] + W.W1[j][1] * x[1] + W.b1[j]));
          const o = sig(W.W2[0] * a[0] + W.W2[1] * a[1] + W.b2);
          return -(y * Math.log(o) + (1 - y) * Math.log(1 - o));
        };
        const h = 1e-5, mas = JSON.parse(JSON.stringify(w)), menos = JSON.parse(JSON.stringify(w));
        mas.W1[0][0] += h; menos.W1[0][0] -= h;
        const num = (perdida(mas) - perdida(menos)) / (2 * h);
        est.foco = null;
        est.msg = `Comprobación numérica de ∂L/∂w(x1→h1): (L(w + ε) − L(w − ε)) / 2ε = ${num.toFixed(6)}; retropropagación dio ${est.gW1[0][0].toFixed(6)}.`;
        yield;
        // Actualización.
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) w.W1[j][i] = Math.round((w.W1[j][i] - eta * est.gW1[j][i]) * 1000) / 1000;
          w.b1[j] -= eta * est.d1[j];
          w.W2[j] = Math.round((w.W2[j] - eta * est.gW2[j]) * 1000) / 1000;
        }
        w.b2 -= eta * est.d2;
        iter++;
        est.foco = 'todo';
        est.msg = `Actualización w ← w − η·∂L/∂w con η = ${eta}. Pérdida con los pesos nuevos: ${perdida(w).toFixed(4)} (antes ${est.L.toFixed(4)}).`;
      })();
    }

    function dibujar() {
      if (!est) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const r = Math.min(30, W / 18);
      const N = {
        x0: [W * 0.08, H * 0.3], x1: [W * 0.08, H * 0.72], h0: [W * 0.4, H * 0.3], h1: [W * 0.4, H * 0.72], o: [W * 0.7, H * 0.5], L: [W * 0.9, H * 0.5],
      };
      const arista = (a, b, peso, grad, foco, t = 0.42) => {
        const [x1, y1] = N[a], [x2, y2] = N[b];
        ctx.save();
        ctx.strokeStyle = foco ? C.s7 : grad != null ? C.s2 : C.eje;
        ctx.lineWidth = foco ? 3 : 1.5 + Math.min(3, Math.abs(peso));
        ctx.beginPath(); ctx.moveTo(x1 + r, y1); ctx.lineTo(x2 - r, y2); ctx.stroke();
        const mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
        ctx.font = VIZ.fuente(11);
        ctx.textAlign = 'center';
        ctx.fillStyle = C.superficie;
        ctx.fillRect(mx - 26, my - 20, 52, grad != null ? 32 : 16);
        ctx.fillStyle = C.tinta2;
        ctx.fillText(`w ${VIZ.fmt(peso, 3)}`, mx, my - 8);
        if (grad != null) { ctx.fillStyle = C.s2; ctx.fillText(`∂ ${VIZ.fmt(grad, 3)}`, mx, my + 7); }
        ctx.restore();
      };
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) arista(`x${i}`, `h${j}`, w.W1[j][i], est.gW1[j][i], est.foco === `w1${j}${i}`, i === j ? 0.5 : 0.24);
      for (let j = 0; j < 2; j++) arista(`h${j}`, 'o', w.W2[j], est.gW2[j], est.foco === `w2${j}`);
      ctx.save(); ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(N.o[0] + r, N.o[1]); ctx.lineTo(N.L[0] - r, N.L[1]); ctx.stroke(); ctx.restore();
      const nodo = (k, titulo, a, d, cuadrado) => {
        const [cx, cy] = N[k], foco = est.foco === k || est.foco === 'todo';
        ctx.save();
        ctx.fillStyle = a != null ? C.s1 : C.superficie;
        ctx.strokeStyle = foco ? C.s7 : a != null ? C.s1 : C.inactivo;
        ctx.lineWidth = foco ? 3.5 : 1.5;
        ctx.beginPath();
        if (cuadrado) ctx.rect(cx - r, cy - r * 0.8, 2 * r, 1.6 * r); else ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = VIZ.fuente(Math.max(10, r * 0.4), 500);
        ctx.fillStyle = a != null ? C.sobre : C.apagado;
        ctx.fillText(a != null ? VIZ.fmt(a, 3) : '?', cx, cy);
        ctx.font = VIZ.fuente(11);
        ctx.fillStyle = C.tinta2;
        ctx.fillText(titulo, cx, cy - r - 10);
        if (d != null) { ctx.fillStyle = C.s2; ctx.font = VIZ.fuente(11, 500); ctx.fillText(`δ ${VIZ.fmt(d, 3)}`, cx, cy + r + 12); }
        ctx.restore();
      };
      nodo('x0', 'x₁', x[0]); nodo('x1', 'x₂', x[1]);
      nodo('h0', 'h₁ = σ(z)', est.a1[0], est.d1[0]); nodo('h1', 'h₂ = σ(z)', est.a1[1], est.d1[1]);
      nodo('o', 'ŷ = σ(z)', est.a2, est.d2);
      nodo('L', `L (y = ${y})`, est.L, null, true);
      registro.textContent = est.msg;
      lectura.set([
        ['salida ŷ', est.a2 != null ? est.a2.toFixed(4) : '—'],
        ['pérdida L', est.L != null ? est.L.toFixed(4) : '—'],
        ['actualizaciones hechas', String(iter)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    pesos();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: gradientes que se desvanecen o explotan ---------- */

  function montarDesvanecimiento(cuerpo) {
    let L = 10, act = 'sigmoide', init = 'xavier', ancho = 16, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capas ocultas', min: 2, max: 30, valor: L, alCambiar: (v) => { L = v; calcular(); } });
    ctl.selector({ etiqueta: 'Activación', opciones: [['sigmoide', 'Sigmoide'], ['tanh', 'Tangente hiperbólica'], ['relu', 'ReLU']], valor: act, alCambiar: (v) => { act = v; calcular(); } });
    ctl.selector({ etiqueta: 'Inicialización de pesos', opciones: [['pequena', 'Pequeña: σ = 0,1'], ['xavier', 'Xavier: σ = √(1/n)'], ['he', 'He: σ = √(2/n)'], ['grande', 'Grande: σ = 1']], valor: init,
      alCambiar: (v) => { init = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'norma del gradiente ∂L/∂W de cada capa', forma: 'linea' },
      { color: C.s1, texto: 'desviación estándar de las activaciones', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico; la capa 1 es la más cercana a la entrada. Con sigmoide el gradiente cae unas 4 veces por capa (σ′ ≤ 1/4). ReLU con inicialización de He lo mantiene casi constante; con σ = 1 explota.');

    let filas = [], plano = null;
    function calcular() {
      const capas = [4, ...new Array(L).fill(ancho), 1];
      const net = P.red(capas, act, semilla), rnd = VIZ.semilla(semilla * 7 + 1);
      net.W.forEach((Wl, l) => {
        const n = capas[l], s = init === 'pequena' ? 0.1 : init === 'xavier' ? Math.sqrt(1 / n) : init === 'he' ? Math.sqrt(2 / n) : 1;
        Wl.forEach((f) => f.forEach((_, k) => { f[k] = VIZ.normal(rnd) * s; }));
      });
      const nl = net.W.length, norma = new Array(nl).fill(0), sd = new Array(nl).fill(0), B = 64;
      for (let b = 0; b < B; b++) {
        const x = Array.from({ length: 4 }, () => VIZ.normal(rnd)), yv = rnd() < 0.5 ? 0 : 1;
        const c = P.adelante(net, x), g = P.retro(net, c, yv);
        for (let l = 0; l < nl; l++) {
          norma[l] += Math.sqrt(g.gW[l].flat().reduce((s, v) => s + v * v, 0)) / B;
          const a = c.a[l + 1], m = a.reduce((s, v) => s + v, 0) / a.length;
          sd[l] += Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) / B;
        }
      }
      filas = norma.map((v, l) => ({ capa: l + 1, g: v, sd: sd[l] })).slice(0, nl - 1);
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const vals = filas.flatMap((f) => [f.g, f.sd]).filter((v) => v > 0);
      const ymin = Math.max(1e-30, Math.min(...vals) / 3), ymax = Math.max(...vals) * 3;
      plano = VIZ.plano(lienzo, { xmin: 0.5, xmax: filas.length + 0.5, ymin, ymax }, { logY: true, etiquetaX: 'capa oculta (1 = junto a la entrada)', margen: { izq: 58 },
        formatoY: (v) => `10^${Math.round(Math.log10(v))}`, ticksX: filas.length <= 15 ? filas.map((f) => f.capa) : undefined });
      plano.ejes();
      VIZ.trazar(ctx, plano, filas.map((f) => [f.capa, Math.max(ymin, f.sd)]), C.s1, 2);
      VIZ.trazar(ctx, plano, filas.map((f) => [f.capa, Math.max(ymin, f.g)]), C.s2, 2.5);
      for (const f of filas) { VIZ.marcador(ctx, plano.sx(f.capa), plano.sy(Math.max(ymin, f.g)), C.s2, 3.5); VIZ.marcador(ctx, plano.sx(f.capa), plano.sy(Math.max(ymin, f.sd)), C.s1, 3, 1); }
      const ult = filas[filas.length - 1], pri = filas[0];
      lectura.set([
        ['gradiente en la capa 1', VIZ.fmt(pri.g, 3)],
        [`gradiente en la capa ${ult.capa}`, VIZ.fmt(ult.g, 3)],
        ['razón capa 1 / última', VIZ.fmt(pri.g / ult.g, 3)],
        ['factor medio por capa', VIZ.fmt(Math.pow(pri.g / ult.g, 1 / Math.max(1, filas.length - 1)), 3)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const f = filas[Math.round(plano.ix(x)) - 1];
      if (!f) return tip.ocultar();
      tip.mostrar(x, y, `capa <b>${f.capa}</b>` + VIZ.filaTooltip(C.s2, 'gradiente', VIZ.fmt(f.g, 3)) + VIZ.filaTooltip(C.s1, 'activaciones', VIZ.fmt(f.sd, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('backpropagation', {
    intro: String.raw`
      <p>Entrenar una red neuronal es ajustar sus pesos para bajar una pérdida, y para eso hace falta la derivada de la pérdida respecto
      de <em>cada</em> peso. La <strong>retropropagación</strong> (Rumelhart, Hinton y Williams, 1986) las calcula todas con dos
      recorridos del grafo de cómputo: uno hacia adelante, que evalúa la red, y otro hacia atrás, que aplica la regla de la cadena
      reutilizando lo calculado.</p>
      <p>Cuesta lo mismo que unas pocas evaluaciones de la red, sin importar cuántos pesos tenga. Pero al multiplicar derivadas capa
      tras capa, el gradiente puede achicarse o crecer exponencialmente con la profundidad: el problema que frenó durante años el
      <a href="tema.html?id=deep-learning">aprendizaje profundo</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Retropropagación en un grafo de cómputo',
        descripcion: 'Una red con dos entradas, dos neuronas ocultas y una salida. Avance de a un cálculo: primero las activaciones (azul), después los gradientes (naranjo) y al final la actualización.',
        montar: montarGrafo,
      },
      {
        titulo: 'Gradientes que se desvanecen',
        descripcion: 'Norma del gradiente de cada capa de una red profunda recién inicializada, promediada sobre 64 ejemplos. Combine activación e inicialización.',
        montar: montarDesvanecimiento,
      },
    ],
    teoria: String.raw`
      <h2>Notación</h2>
      <p>Para la capa \(l\): \(z^{(l)} = W^{(l)} a^{(l-1)} + b^{(l)}\) y \(a^{(l)} = \varphi(z^{(l)})\), con \(a^{(0)} = x\). La pérdida \(L\) depende
      de la salida \(a^{(L)}\). Se define el error de cada neurona como \(\delta^{(l)} = \partial L / \partial z^{(l)}\).</p>
      <h2>Las cuatro ecuaciones</h2>
      \[ \delta^{(L)} = \nabla_{a} L \odot \varphi'(z^{(L)}), \qquad
         \delta^{(l)} = \big(W^{(l+1)\top} \delta^{(l+1)}\big) \odot \varphi'(z^{(l)}), \]
      \[ \frac{\partial L}{\partial W^{(l)}} = \delta^{(l)}\, a^{(l-1)\top}, \qquad \frac{\partial L}{\partial b^{(l)}} = \delta^{(l)}. \]
      <p>Con salida sigmoide y entropía cruzada, \(\delta^{(L)} = \hat y - y\): la derivada de la sigmoide se cancela con la del logaritmo.</p>
      <h2>Algoritmo</h2>
      <pre><code>adelante:  para l ← 1 hasta L:  z⁽ˡ⁾ ← W⁽ˡ⁾ a⁽ˡ⁻¹⁾ + b⁽ˡ⁾;  a⁽ˡ⁾ ← φ(z⁽ˡ⁾)   (guardar z y a)
atrás:     δ⁽ᴸ⁾ ← ∂L/∂a⁽ᴸ⁾ ⊙ φ′(z⁽ᴸ⁾)
           para l ← L hasta 1:
               ∂L/∂W⁽ˡ⁾ ← δ⁽ˡ⁾ a⁽ˡ⁻¹⁾ᵀ;   ∂L/∂b⁽ˡ⁾ ← δ⁽ˡ⁾
               si l &gt; 1:  δ⁽ˡ⁻¹⁾ ← (W⁽ˡ⁾ᵀ δ⁽ˡ⁾) ⊙ φ′(z⁽ˡ⁻¹⁾)
actualizar: W ← W − η ∂L/∂W</code></pre>
      <p>Es diferenciación automática en <em>modo reverso</em>: cada nodo del grafo solo necesita saber derivar su propia operación.
      Calcular el gradiente completo cuesta un múltiplo constante (2 a 3 veces) de evaluar la red, mientras que las diferencias finitas
      necesitarían una evaluación por peso. Las diferencias finitas sirven, eso sí, para <em>comprobar</em> una implementación.</p>
      <h2>Desvanecimiento y explosión</h2>
      <p>Desarrollando la recursión, el error que llega a la capa \(l\) es un producto de \(L - l\) factores
      \(W^{(k)\top} \operatorname{diag}(\varphi'(z^{(k)}))\). Si su tamaño típico es menor que 1, \(\delta^{(l)}\) decae exponencialmente; si es mayor,
      crece exponencialmente.</p>
      <ul>
        <li>La sigmoide tiene \(\varphi' \le 1/4\): con pesos de tamaño moderado, cada capa divide el gradiente por 4 o más.</li>
        <li>ReLU tiene derivada 0 o 1 y no satura en la zona positiva.</li>
        <li>La inicialización de Xavier (\(\operatorname{Var} W = 1/n\)) mantiene la varianza de las activaciones con tanh; la de He
        (\(2/n\)) compensa que ReLU anula la mitad de las entradas.</li>
        <li>La normalización por lotes, las conexiones residuales (\(a^{(l)} = a^{(l-1)} + F(a^{(l-1)})\)) y en redes recurrentes las compuertas
        de LSTM mantienen un camino por el que el gradiente fluye sin multiplicarse.</li>
      </ul>`,
  });
})();
