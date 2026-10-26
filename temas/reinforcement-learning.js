(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Mundo de celdas (gridworld) ----------
     '.' libre, '#' muro, 'S' inicio, número = estado terminal con esa recompensa al salir. */
  const ESCENARIOS = {
    clasico: { nombre: 'Clásico 4 × 3', mapa: [['.', '.', '.', '1'], ['.', '#', '.', '-1'], ['S', '.', '.', '.']] },
    puente: { nombre: 'Puente', mapa: [['#', '-10', '-10', '-10', '-10', '-10', '#'], ['1', 'S', '.', '.', '.', '.', '10'], ['#', '-10', '-10', '-10', '-10', '-10', '#']] },
    acantilado: { nombre: 'Acantilado', mapa: [['.', '.', '.', '.', '.', '.', '.', '.'], ['.', '.', '.', '.', '.', '.', '.', '.'], ['.', '.', '.', '.', '.', '.', '.', '.'], ['S', '-10', '-10', '-10', '-10', '-10', '-10', '10']] },
  };
  const ACC = [[-1, 0, '↑'], [0, 1, '→'], [1, 0, '↓'], [0, -1, '←']];

  function mundo(clave) {
    const mapa = ESCENARIOS[clave].mapa, F = mapa.length, K = mapa[0].length;
    const celdas = [];
    let inicio = 0;
    mapa.forEach((fila, f) => fila.forEach((t, c) => {
      const i = f * K + c;
      celdas.push({ f, c, muro: t === '#', terminal: /^-?\d+$/.test(t), r: /^-?\d+$/.test(t) ? +t : 0 });
      if (t === 'S') inicio = i;
    }));
    const mover = (i, a) => {
      const f = celdas[i].f + ACC[a][0], c = celdas[i].c + ACC[a][1];
      if (f < 0 || f >= F || c < 0 || c >= K || celdas[f * K + c].muro) return i;
      return f * K + c;
    };
    // Con probabilidad 1 − ruido va donde quiere; con ruido/2 a cada lado perpendicular.
    const transiciones = (i, a, ruido) => [[mover(i, a), 1 - ruido], [mover(i, (a + 1) % 4), ruido / 2], [mover(i, (a + 3) % 4), ruido / 2]].filter((t) => t[1] > 0);
    return { F, K, celdas, inicio, transiciones };
  }

  // Dibuja la cuadrícula; relleno(i) y contenido(i, x, y, lado) personalizan cada celda.
  function cuadricula(lienzo, m, o) {
    const { ctx, ancho: W, alto: H } = lienzo;
    lienzo.limpiar();
    const lado = Math.floor(Math.min((W - 20) / m.K, (H - 10) / m.F));
    const x0 = Math.round((W - lado * m.K) / 2), y0 = 5;
    m.celdas.forEach((cel, i) => {
      const x = x0 + cel.c * lado, y = y0 + cel.f * lado;
      if (cel.muro) { ctx.fillStyle = C.tinta; ctx.fillRect(x, y, lado, lado); return; }
      o.contenido(i, x, y, lado);
      ctx.strokeStyle = C.rejilla;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, lado - 1, lado - 1);
      if (cel.terminal) { ctx.strokeStyle = cel.r > 0 ? C.s6 : C.s8; ctx.lineWidth = 3; ctx.strokeRect(x + 3, y + 3, lado - 6, lado - 6); }
    });
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, lado * m.K - 1, lado * m.F - 1);
    return { x0, y0, lado };
  }
  // Color con signo: verde para valores positivos, rojo para negativos.
  const colorValor = (v, escala) => (v >= 0 ? VIZ.alfa(C.s6, Math.min(0.75, (0.7 * v) / escala)) : VIZ.alfa(C.s8, Math.min(0.75, (-0.7 * v) / escala)));
  const altoMundo = (m) => (w) => Math.min(420, Math.floor((w - 20) / m.K) * m.F + 10);

  /* ---------- Fig. 1: iteración de valores ---------- */

  function montarIteracion(cuerpo) {
    let esc = 'clasico', gamma = 0.9, ruido = 0.2, vida = 0, m = mundo(esc), V = [], iter = 0, delta = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', opciones: Object.entries(ESCENARIOS).map(([k, e]) => [k, e.nombre]), valor: esc, alCambiar: (v) => { esc = v; m = mundo(esc); lienzo.ajustar(true); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Descuento γ', min: 0.1, max: 0.99, paso: 0.01, valor: gamma, formato: (v) => v.toFixed(2), alCambiar: (v) => { gamma = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido de las acciones', min: 0, max: 0.6, paso: 0.05, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Recompensa por paso', min: -2, max: 0.5, paso: 0.05, valor: vida, formato: (v) => v.toFixed(2), alCambiar: (v) => { vida = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => altoMundo(m)(w) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.5), texto: 'V(s) > 0' },
      { color: VIZ.alfa(C.s8, 0.5), texto: 'V(s) < 0' },
      { color: C.superficie, borde: C.s6, texto: 'salida con premio' },
      { color: C.superficie, borde: C.s8, texto: 'salida con castigo' },
      { color: C.tinta, texto: 'muro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso es una iteración: todas las celdas se actualizan a la vez con la ecuación de Bellman. Las flechas son la política voraz respecto de los valores actuales. Pase el cursor sobre una celda para ver sus valores Q.');

    const Q = (i, a, Vv) => m.transiciones(i, a, ruido).reduce((s, [j, p]) => s + p * (vida + gamma * Vv[j]), 0);
    function iniciar() {
      V = m.celdas.map(() => 0); iter = 0; delta = 0;
      return (function* () {
        for (iter = 1; iter <= 200; iter++) {
          const nuevo = m.celdas.map((cel, i) => (cel.muro ? 0 : cel.terminal ? cel.r : Math.max(...ACC.map((_, a) => Q(i, a, V)))));
          delta = Math.max(...nuevo.map((v, i) => Math.abs(v - V[i])));
          V = nuevo;
          yield;
          if (delta < 1e-4) return;
        }
      })();
    }
    let geo = null;
    function dibujar() {
      const escala = Math.max(1, ...V.map(Math.abs));
      const { ctx } = lienzo;
      geo = cuadricula(lienzo, m, {
        contenido: (i, x, y, lado) => {
          const cel = m.celdas[i];
          ctx.fillStyle = colorValor(V[i], escala);
          ctx.fillRect(x, y, lado, lado);
          ctx.fillStyle = C.tinta;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = VIZ.fuente(lado >= 70 ? 13 : 10, 500);
          ctx.fillText(VIZ.fmt(V[i], 3), x + lado / 2, y + lado / 2 + (cel.terminal ? 0 : lado * 0.18));
          if (!cel.terminal && iter > 0) {
            const qs = ACC.map((_, a) => Q(i, a, V)), mejor = qs.indexOf(Math.max(...qs));
            ctx.font = VIZ.fuente(Math.max(12, lado * 0.28), 600);
            ctx.fillText(ACC[mejor][2], x + lado / 2, y + lado * 0.36);
          }
          if (i === m.inicio && lado >= 40) { ctx.font = VIZ.fuente(9); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText('inicio', x + 4, y + 9); }
        },
      });
      registro.textContent = iter === 0 ? 'V₀ = 0 en todas las celdas.' : delta < 1e-4 ? `Convergió en ${iter} iteraciones: los valores ya no cambian y la política es óptima.`
        : `Iteración ${iter}: la información de las recompensas se propaga una celda más lejos en cada iteración.`;
      lectura.set([
        ['iteración', String(iter)],
        ['máx |Vₖ − Vₖ₋₁|', iter ? VIZ.fmt(delta, 3) : '—'],
        ['V(inicio)', VIZ.fmt(V[m.inicio] || 0, 3)],
        ['horizonte efectivo', VIZ.fmt(1 / (1 - gamma), 3)],
      ]);
    }
    lienzo.alDibujar = () => V.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.x0) / geo.lado), f = Math.floor((y - geo.y0) / geo.lado);
      if (c < 0 || f < 0 || c >= m.K || f >= m.F) return tip.ocultar();
      const i = f * m.K + c, cel = m.celdas[i];
      if (cel.muro) return tip.ocultar();
      tip.mostrar(x, y, cel.terminal ? `salida: recompensa <b>${cel.r}</b>` : `V = <b>${VIZ.fmt(V[i], 4)}</b>` + ACC.map((a, k) => `<br>Q(s, ${a[2]}) = ${VIZ.fmt(Q(i, k, V), 4)}`).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: Q-learning ---------- */

  function montarQ(cuerpo) {
    let esc = 'clasico', eps = 0.3, alfa = 0.5, gamma = 0.9, ruido = 0.2, vida = 0, semilla = 1;
    let m = mundo(esc), Qt = [], s = 0, pasos = 0, episodios = 0, retorno = 0, desc = 1, pasosEp = 0, retornos = [], ultima = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', opciones: Object.entries(ESCENARIOS).map(([k, e]) => [k, e.nombre]), valor: esc, alCambiar: (v) => { esc = v; m = mundo(esc); lienzo.ajustar(true); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Exploración ε', min: 0, max: 1, paso: 0.05, valor: eps, formato: (v) => v.toFixed(2), alCambiar: (v) => { eps = v; } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje α', min: 0.05, max: 1, paso: 0.05, valor: alfa, formato: (v) => v.toFixed(2), alCambiar: (v) => { alfa = v; } });
    ctl.rango({ etiqueta: 'Ruido de las acciones', min: 0, max: 0.6, paso: 0.05, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; } });
    ctl.rango({ etiqueta: 'Recompensa por paso', min: -2, max: 0.5, paso: 0.05, valor: vida, formato: (v) => v.toFixed(2), alCambiar: (v) => { vida = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 10 });
    ctl.boton('Nueva semilla', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => altoMundo(m)(w) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Retorno de cada episodio');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.22, altoMin: 120, altoMax: 170 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.5), texto: 'Q(s, a) > 0' },
      { color: VIZ.alfa(C.s8, 0.5), texto: 'Q(s, a) < 0' },
      { color: C.s2, texto: 'agente', forma: 'punto' },
      { color: C.s1, texto: 'retorno por episodio', forma: 'linea' },
      { color: C.tinta, texto: 'promedio de los últimos 20', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda se divide en cuatro triángulos, uno por acción, coloreados según Q(s, a). El agente no conoce el modelo: solo ve las transiciones que vive. Suba la velocidad para ver cientos de episodios.');

    const elegir = (i, rnd) => {
      if (rnd() < eps) return Math.floor(rnd() * 4);
      const q = Qt[i], mx = Math.max(...q);
      const mejores = [0, 1, 2, 3].filter((a) => q[a] === mx);
      return mejores[Math.floor(rnd() * mejores.length)];
    };
    function iniciar() {
      Qt = m.celdas.map(() => [0, 0, 0, 0]);
      s = m.inicio; pasos = 0; episodios = 0; retorno = 0; desc = 1; pasosEp = 0; retornos = []; ultima = null;
      const rnd = VIZ.semilla(semilla * 977);
      return (function* () {
        while (pasos < 20000) {
          const cel = m.celdas[s];
          pasos++; pasosEp++;
          if (cel.terminal) {
            // La única acción en una salida es salir: recompensa r y fin del episodio.
            for (let a = 0; a < 4; a++) Qt[s][a] += alfa * (cel.r - Qt[s][a]);
            retorno += desc * cel.r;
            retornos.push(retorno);
            ultima = `Episodio ${episodios + 1}: sale con recompensa ${cel.r} tras ${pasosEp} pasos (retorno descontado ${VIZ.fmt(retorno, 3)}).`;
            episodios++;
            s = m.inicio; retorno = 0; desc = 1; pasosEp = 0;
            yield;
            continue;
          }
          const a = elegir(s, rnd);
          // El entorno elige el resultado según el ruido.
          const ts = m.transiciones(s, a, ruido);
          let u = rnd(), sig = ts[0][0];
          for (const [j, p] of ts) { if (u < p) { sig = j; break; } u -= p; }
          const objetivo = vida + gamma * Math.max(...Qt[sig]);
          const antes = Qt[s][a];
          Qt[s][a] += alfa * (objetivo - Qt[s][a]);
          retorno += desc * vida;
          desc *= gamma;
          ultima = `Desde (${cel.f}, ${cel.c}) intenta ${ACC[a][2]} y llega a (${m.celdas[sig].f}, ${m.celdas[sig].c}). Q(s, ${ACC[a][2]}): ${VIZ.fmt(antes, 3)} → ${VIZ.fmt(Qt[s][a], 3)}.`;
          s = sig;
          if (pasosEp > 300) { retornos.push(retorno); episodios++; s = m.inicio; retorno = 0; desc = 1; pasosEp = 0; }
          yield;
        }
      })();
    }
    let geo = null;
    function dibujar() {
      const escala = Math.max(1, ...Qt.flat().map(Math.abs));
      const { ctx } = lienzo;
      geo = cuadricula(lienzo, m, {
        contenido: (i, x, y, lado) => {
          const cel = m.celdas[i], cx = x + lado / 2, cy = y + lado / 2;
          if (cel.terminal) {
            ctx.fillStyle = colorValor(Qt[i][0], escala);
            ctx.fillRect(x, y, lado, lado);
          } else {
            const esq = [[x, y], [x + lado, y], [x + lado, y + lado], [x, y + lado]];
            ACC.forEach((_, a) => {
              const [p, q] = [esq[a], esq[(a + 1) % 4]];
              ctx.fillStyle = colorValor(Qt[i][a], escala);
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...p); ctx.lineTo(...q); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = C.rejilla; ctx.lineWidth = 0.75; ctx.stroke();
            });
            if (lado >= 64) {
              ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              const off = lado * 0.32;
              [[0, -off], [off, 0], [0, off], [-off, 0]].forEach(([dx, dy], a) => ctx.fillText(VIZ.fmt(Qt[i][a], 2), cx + dx, cy + dy));
            }
          }
          if (cel.terminal) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(VIZ.fmt(Qt[i][0], 3), cx, cy); }
          if (i === s) VIZ.marcador(ctx, cx, cy, C.s2, Math.max(5, lado * 0.14));
        },
      });
      // Curva de aprendizaje
      const c2 = l2.ctx;
      l2.limpiar();
      const ult = retornos.slice(-300), base = retornos.length - ult.length;
      const lo = Math.min(-1, ...ult), hi = Math.max(1, ...ult);
      const p2 = VIZ.plano(l2, { xmin: base, xmax: Math.max(base + 20, retornos.length), ymin: lo, ymax: hi }, { margen: { izq: 44, inf: 22, sup: 8 } });
      p2.ejes();
      VIZ.trazar(c2, p2, ult.map((r, k) => [base + k + 1, r]), VIZ.alfa(C.s1, 0.6), 1);
      const prom = ult.map((_, k) => { const v = ult.slice(Math.max(0, k - 19), k + 1); return [base + k + 1, v.reduce((a, b) => a + b, 0) / v.length]; });
      VIZ.trazar(c2, p2, prom, C.tinta, 2);
      registro.textContent = ultima || 'Q = 0 en todas partes: el agente empieza explorando al azar.';
      lectura.set([
        ['pasos', VIZ.entero(pasos)],
        ['episodios', VIZ.entero(episodios)],
        ['retorno medio (últimos 20)', prom.length ? VIZ.fmt(prom[prom.length - 1][1], 3) : '—'],
        ['máx Q en el inicio', VIZ.fmt(Math.max(...Qt[m.inicio]), 3)],
      ]);
    }
    lienzo.alDibujar = () => Qt.length && dibujar();
    l2.alDibujar = () => Qt.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.x0) / geo.lado), f = Math.floor((y - geo.y0) / geo.lado);
      if (c < 0 || f < 0 || c >= m.K || f >= m.F) return tip.ocultar();
      const i = f * m.K + c;
      if (m.celdas[i].muro) return tip.ocultar();
      tip.mostrar(x, y, ACC.map((a, k) => `Q(s, ${a[2]}) = <b>${VIZ.fmt(Qt[i][k], 4)}</b>`).join('<br>'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('reinforcement-learning', {
    intro: String.raw`
      <p>En el <strong>aprendizaje por refuerzo</strong> no hay ejemplos con la respuesta correcta. Hay un <strong>agente</strong>
      que observa el estado de su entorno, elige una acción, recibe una <strong>recompensa</strong> y pasa a otro estado. Su objetivo
      es aprender una <strong>política</strong> —qué hacer en cada estado— que maximice la recompensa acumulada a largo plazo. Es el
      enfoque de <strong>control de agentes basado en aprendizaje</strong>: robots que aprenden a caminar, programas que aprenden a
      jugar, sistemas que aprenden a decidir.</p>
      <p>Si se conoce el modelo del entorno (probabilidades de transición y recompensas), la política óptima se puede
      <em>calcular</em> con <strong>iteración de valores</strong>. Si no se conoce, hay que aprenderla probando:
      <strong>Q-learning</strong> estima el valor de cada acción a partir de la experiencia, equilibrando explorar y aprovechar
      lo aprendido.</p>`,
    visualizaciones: [
      {
        titulo: 'Iteración de valores',
        descripcion: 'Con el modelo conocido, los valores se propagan desde las salidas. En el puente, pruebe ruido 0 frente a 0.2: con acciones inciertas, cruzar deja de valer la pena. Una recompensa por paso negativa apura al agente.',
        montar: montarIteracion,
      },
      {
        titulo: 'Q-learning',
        descripcion: 'Sin conocer el modelo, el agente aprende de sus propias transiciones. Con ε = 0 puede quedar atrapado en la primera salida que encuentre; con ε alto explora mucho pero rinde peor. En el acantilado aprende a alejarse del borde.',
        montar: montarQ,
      },
    ],
    teoria: String.raw`
      <h2>Procesos de decisión de Markov</h2>
      <p>Un MDP es una tupla \((S, A, T, R, \gamma)\): estados, acciones, probabilidades de transición
      \(T(s, a, s') = P(s' \mid s, a)\), recompensas \(R(s, a, s')\) y un factor de descuento \(0 \le \gamma &lt; 1\). La propiedad de
      Markov dice que el futuro depende solo del estado actual. Una política \(\pi : S \to A\) se evalúa por el
      <strong>retorno</strong> esperado</p>
      \[ V^\pi(s) = \mathbb{E}\Big[\sum_{t \ge 0} \gamma^t R(s_t, a_t, s_{t+1}) \ \Big|\ s_0 = s,\ a_t = \pi(s_t)\Big]. \]
      <p>El descuento hace finita la suma y prefiere recompensas cercanas; \(1/(1-\gamma)\) es un horizonte efectivo.</p>

      <h2>Ecuaciones de Bellman</h2>
      <p>Los valores óptimos \(V^*(s) = \max_\pi V^\pi(s)\) y \(Q^*(s, a)\) (valor de hacer \(a\) en \(s\) y luego actuar
      óptimamente) satisfacen</p>
      \[ Q^*(s, a) = \sum_{s'} T(s, a, s') \big[ R(s, a, s') + \gamma V^*(s') \big], \qquad V^*(s) = \max_a Q^*(s, a), \]
      <p>y la política óptima es voraz respecto de ellos: \(\pi^*(s) = \arg\max_a Q^*(s, a)\).</p>

      <h2>Iteración de valores</h2>
      <pre><code>V₀(s) ← 0 para todo s
repetir k = 0, 1, 2, …:
    para cada s:  V_{k+1}(s) ← max_a Σ_{s'} T(s,a,s') [R(s,a,s') + γ V_k(s')]
hasta que max_s |V_{k+1}(s) − V_k(s)| &lt; ε</code></pre>
      <div class="recuadro"><strong>Convergencia.</strong> El operador de Bellman \(B\) es una contracción en norma infinito:
      \(\lVert BV - BU \rVert_\infty \le \gamma \lVert V - U \rVert_\infty\). Por el teorema del punto fijo de Banach, \(V_k \to V^*\)
      desde cualquier inicio, con error que decrece como \(\gamma^k\). \(V_k(s)\) es el valor óptimo con horizonte de \(k\)
      pasos.</div>
      <p>Cada iteración cuesta \(O(|S|^2 |A|)\). La alternativa, <em>iteración de políticas</em>, alterna evaluar una política
      exactamente y mejorarla de forma voraz, y suele necesitar menos iteraciones.</p>

      <h2>Aprender sin modelo: Q-learning</h2>
      <p>Si \(T\) y \(R\) son desconocidos, el agente estima \(Q\) con las transiciones \((s, a, r, s')\) que observa
      (Watkins, 1989):</p>
      \[ Q(s, a) \leftarrow Q(s, a) + \alpha \Big[ \underbrace{r + \gamma \max_{a'} Q(s', a')}_{\text{objetivo}} - Q(s, a) \Big]. \]
      <p>Es una versión muestreada de la ecuación de Bellman: un promedio móvil que reemplaza la suma sobre \(s'\) por la
      muestra que ocurrió (diferencias temporales). Es <em>off-policy</em>: aprende \(Q^*\) aunque se comporte de otra forma. Converge
      a \(Q^*\) si todas las parejas \((s, a)\) se visitan infinitas veces y \(\alpha\) decrece adecuadamente
      (\(\sum \alpha_t = \infty\), \(\sum \alpha_t^2 &lt; \infty\)).</p>

      <h2>Exploración y aprovechamiento</h2>
      <p>Con la política <strong>ε-voraz</strong>, el agente hace una acción al azar con probabilidad \(\varepsilon\) y la mejor
      conocida en otro caso. Sin explorar puede quedarse con una política mediocre para siempre; explorando demasiado, actúa mal
      mientras aprende. Es usual partir con \(\varepsilon\) alto y reducirlo con el tiempo.</p>

      <h2>Más allá de las tablas</h2>
      <p>Con muchos estados, la tabla \(Q\) se reemplaza por una función aproximada \(Q(s, a; \theta)\). DQN (Mnih et al., 2015)
      usa una <a href="tema.html?id=neural-networks">red convolucional</a> que lee los píxeles de la pantalla y aprendió a jugar
      decenas de juegos de Atari. Los métodos de gradiente de política aprenden \(\pi\) directamente y son la base del control de
      robots y del ajuste de modelos de lenguaje con retroalimentación humana. La planificación con modelo conecta con la
      <a href="tema.html?id=heuristic-search">búsqueda heurística</a>, y los juegos de varios agentes con
      <a href="tema.html?id=multi-agent-search">Multi-Agent Search</a>.</p>`,
  });
})();
