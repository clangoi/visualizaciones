(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* Superficies de pérdida: valor, gradiente, dominio y valores por defecto. */
  const FUNCIONES = {
    cuadratica: {
      nombre: 'Cuadrática mal condicionada',
      dominio: [-4, 4, -4, 4],
      inicio: [-3.5, 2.8],
      fmin: 0,
      defectos: { eta: 0.08, beta: 0.8, etaAdam: 0.15, iter: 80 },
      crear(k) {
        const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
        return {
          f: (x, y) => { const u = c * x + s * y, v = -s * x + c * y; return 0.5 * (u * u + k * v * v); },
          g: (x, y) => { const u = c * x + s * y, v = -s * x + c * y; return [u * c - k * v * s, u * s + k * v * c]; },
        };
      },
    },
    rosenbrock: {
      nombre: 'Rosenbrock (valle curvo)',
      dominio: [-2, 2, -1, 3],
      inicio: [-1.6, 2.6],
      fmin: 0,
      defectos: { eta: 0.0015, beta: 0.9, etaAdam: 0.05, iter: 400 },
      crear: () => ({
        f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
        g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
      }),
    },
    himmelblau: {
      nombre: 'Himmelblau (cuatro mínimos)',
      dominio: [-5, 5, -5, 5],
      inicio: [-0.3, -0.8],
      fmin: 0,
      defectos: { eta: 0.01, beta: 0.8, etaAdam: 0.1, iter: 150 },
      crear: () => ({
        f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
        g: (x, y) => [4 * x * (x * x + y - 11) + 2 * (x + y * y - 7), 2 * (x * x + y - 11) + 4 * y * (x + y * y - 7)],
      }),
    },
  };

  const METODOS = [
    { clave: 'gd', nombre: 'Gradiente', color: C.s1 },
    { clave: 'momento', nombre: 'Momento', color: C.s2 },
    { clave: 'nesterov', nombre: 'Nesterov', color: C.s3 },
    { clave: 'adam', nombre: 'Adam', color: C.s7 },
  ];

  function optimizar(metodo, F, x0, p) {
    let x = x0[0], y = x0[1];
    let vx = 0, vy = 0, mx = 0, my = 0, sx = 0, sy = 0;
    const tray = [[x, y]], perdida = [F.f(x, y)];
    let diverge = false;
    for (let t = 1; t <= p.iter; t++) {
      if (metodo === 'gd') {
        const [gx, gy] = F.g(x, y);
        x -= p.eta * gx; y -= p.eta * gy;
      } else if (metodo === 'momento') {
        const [gx, gy] = F.g(x, y);
        vx = p.beta * vx - p.eta * gx; vy = p.beta * vy - p.eta * gy;
        x += vx; y += vy;
      } else if (metodo === 'nesterov') {
        const [gx, gy] = F.g(x + p.beta * vx, y + p.beta * vy);
        vx = p.beta * vx - p.eta * gx; vy = p.beta * vy - p.eta * gy;
        x += vx; y += vy;
      } else {
        const [gx, gy] = F.g(x, y);
        const b1 = 0.9, b2 = 0.999;
        mx = b1 * mx + (1 - b1) * gx; my = b1 * my + (1 - b1) * gy;
        sx = b2 * sx + (1 - b2) * gx * gx; sy = b2 * sy + (1 - b2) * gy * gy;
        const c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
        x -= (p.etaAdam * (mx / c1)) / (Math.sqrt(sx / c2) + 1e-8);
        y -= (p.etaAdam * (my / c1)) / (Math.sqrt(sy / c2) + 1e-8);
      }
      const fv = F.f(x, y);
      if (!Number.isFinite(fv) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) { diverge = true; break; }
      tray.push([x, y]);
      perdida.push(fv);
    }
    return { tray, perdida, diverge };
  }

  /* Curvas de nivel por cuadrados marchantes sobre una malla (G+1)×(G+1). */
  function contornos(vals, G, nivel) {
    const segs = [];
    const v = (i, j) => vals[j * (G + 1) + i];
    const t = (a, b) => (nivel - a) / (b - a);
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        const caso = (a > nivel ? 8 : 0) | (b > nivel ? 4 : 0) | (c > nivel ? 2 : 0) | (d > nivel ? 1 : 0);
        if (caso === 0 || caso === 15) continue;
        const arriba = () => [i + t(a, b), j], derecha = () => [i + 1, j + t(b, c)];
        const abajo = () => [i + t(d, c), j + 1], izquierda = () => [i, j + t(a, d)];
        switch (caso) {
          case 1: case 14: segs.push([izquierda(), abajo()]); break;
          case 2: case 13: segs.push([abajo(), derecha()]); break;
          case 3: case 12: segs.push([izquierda(), derecha()]); break;
          case 4: case 11: segs.push([arriba(), derecha()]); break;
          case 6: case 9: segs.push([arriba(), abajo()]); break;
          case 7: case 8: segs.push([izquierda(), arriba()]); break;
          case 5: segs.push([arriba(), derecha()], [izquierda(), abajo()]); break;
          case 10: segs.push([izquierda(), arriba()], [abajo(), derecha()]); break;
          default: break;
        }
      }
    }
    return segs;
  }

  // Estado compartido entre las dos figuras.
  const estado = {
    funcion: 'cuadratica', kappa: 10, inicio: null,
    eta: 0.08, beta: 0.8, etaAdam: 0.15, iter: 80,
    visibles: { gd: true, momento: true, nesterov: true, adam: true },
    resultados: {}, oyentes: [],
  };
  const notificar = () => estado.oyentes.forEach((fn) => fn());
  function recalcular() {
    const def = FUNCIONES[estado.funcion];
    const F = def.crear(estado.kappa);
    estado.F = F;
    for (const m of METODOS) estado.resultados[m.clave] = optimizar(m.clave, F, estado.inicio || def.inicio, estado);
    notificar();
  }

  /* ---------- Fig. 1: superficie y trayectorias ---------- */

  function montarSuperficie(cuerpo) {
    const ctl = VIZ.controles(cuerpo);
    const formatoLog = (v) => VIZ.fmt(Math.pow(10, v), 3);
    const sFuncion = ctl.selector({ etiqueta: 'Función de pérdida', opciones: Object.entries(FUNCIONES).map(([k, f]) => [k, f.nombre]), valor: estado.funcion,
      alCambiar: (v) => {
        estado.funcion = v;
        estado.inicio = null;
        const d = FUNCIONES[v].defectos;
        Object.assign(estado, d);
        sEta.valor = Math.log10(d.eta); sBeta.valor = d.beta; sAdam.valor = Math.log10(d.etaAdam); sIter.valor = d.iter;
        sKappa.input.disabled = v !== 'cuadratica';
        prepararFondo();
        recalcular();
      } });
    void sFuncion;
    const sKappa = ctl.rango({ etiqueta: 'Condicionamiento κ (cuadrática)', min: 1, max: 50, valor: estado.kappa,
      alCambiar: (v) => { estado.kappa = v; prepararFondo(); recalcular(); } });
    const sEta = ctl.rango({ etiqueta: 'Tasa de aprendizaje η', min: -4, max: 0, paso: 0.05, valor: Math.log10(estado.eta), formato: formatoLog,
      alCambiar: (v) => { estado.eta = Math.pow(10, v); recalcular(); } });
    const sBeta = ctl.rango({ etiqueta: 'Momento β', min: 0, max: 0.99, paso: 0.01, valor: estado.beta, formato: (v) => v.toFixed(2),
      alCambiar: (v) => { estado.beta = v; recalcular(); } });
    const sAdam = ctl.rango({ etiqueta: 'η de Adam', min: -3, max: 0, paso: 0.05, valor: Math.log10(estado.etaAdam), formato: formatoLog,
      alCambiar: (v) => { estado.etaAdam = Math.pow(10, v); recalcular(); } });
    const sIter = ctl.rango({ etiqueta: 'Iteraciones', min: 5, max: 1000, paso: 5, valor: estado.iter,
      alCambiar: (v) => { estado.iter = v; recalcular(); } });
    estado.visibles = ctl.casillas(METODOS.map((m) => ({ clave: m.clave, texto: m.nombre, color: m.color })), notificar);
    const bAnim = ctl.boton('Animar', () => animar(), { primario: true });
    ctl.boton('Punto inicial por defecto', () => { estado.inicio = null; recalcular(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.72, altoMax: 620 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...METODOS.map((m) => ({ color: m.color, texto: m.nombre, forma: 'linea' })),
      { color: C.tinta, texto: 'punto inicial', forma: 'punto' },
      { color: C.superficie, borde: C.apagado, texto: 'pérdida baja' },
      { color: VIZ.rampaGris[5], texto: 'pérdida alta' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la superficie para elegir otro punto inicial. En la cuadrática, suba η por encima de 2/κ para ver cómo el gradiente diverge en la dirección de mayor curvatura.');

    let fondo = null, segmentos = [], G = 140;
    function prepararFondo() {
      const def = FUNCIONES[estado.funcion];
      const F = def.crear(estado.kappa);
      const [x0, x1, y0, y1] = def.dominio;
      const vals = new Float64Array((G + 1) * (G + 1));
      let vmin = Infinity, vmax = -Infinity;
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const x = x0 + ((x1 - x0) * i) / G, y = y1 - ((y1 - y0) * j) / G;
          const v = Math.log1p(Math.max(0, F.f(x, y) - def.fmin));
          vals[j * (G + 1) + i] = v;
          if (v < vmin) vmin = v;
          if (v > vmax) vmax = v;
        }
      }
      const off = document.createElement('canvas');
      off.width = off.height = G + 1;
      const octx = off.getContext('2d');
      const img = octx.createImageData(G + 1, G + 1);
      for (let k = 0; k < vals.length; k++) {
        const rgb = VIZ.enRampa((vals[k] - vmin) / (vmax - vmin), VIZ.rampaGris);
        img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      fondo = off;
      segmentos = [];
      for (let L = 1; L <= 16; L++) segmentos.push(...contornos(vals, G, vmin + ((vmax - vmin) * L) / 17));
    }

    let plano = null, progreso = 1, hover = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const def = FUNCIONES[estado.funcion];
      const [x0, x1, y0, y1] = def.dominio;
      plano = VIZ.plano(lienzo, { xmin: x0, xmax: x1, ymin: y0, ymax: y1 }, { margen: { izq: 40, inf: 28, sup: 10, der: 10 } });
      plano.ejes();
      const ax = plano.x0, ay = plano.y1, aw = plano.x1 - plano.x0, ah = plano.y0 - plano.y1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fondo, ax, ay, aw, ah);
      // Curvas de nivel
      ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.45);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const [[ia, ja], [ib, jb]] of segmentos) {
        ctx.moveTo(ax + (ia / G) * aw, ay + (ja / G) * ah);
        ctx.lineTo(ax + (ib / G) * aw, ay + (jb / G) * ah);
      }
      ctx.stroke();
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1;
      ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);

      ctx.save();
      plano.recortar();
      for (const m of METODOS) {
        if (!estado.visibles[m.clave]) continue;
        const r = estado.resultados[m.clave];
        const n = Math.max(1, Math.ceil(r.tray.length * progreso));
        const pts = r.tray.slice(0, n);
        // Anillo blanco bajo la línea para separarla del fondo y de otras trayectorias.
        VIZ.trazar(ctx, plano, pts, VIZ.alfa(C.superficie, 0.85), 4.5);
        VIZ.trazar(ctx, plano, pts, m.color, 2);
        if (pts.length < 120) for (const [x, y] of pts.slice(1)) {
          ctx.fillStyle = m.color;
          ctx.beginPath(); ctx.arc(plano.sx(x), plano.sy(y), 2, 0, 7); ctx.fill();
        }
        const [ux, uy] = pts[pts.length - 1];
        VIZ.marcador(ctx, plano.sx(ux), plano.sy(uy), m.color, 5, METODOS.indexOf(m));
      }
      const ini = estado.inicio || def.inicio;
      VIZ.marcador(ctx, plano.sx(ini[0]), plano.sy(ini[1]), C.tinta, 5.5);
      ctx.restore();

      lectura.set(METODOS.filter((m) => estado.visibles[m.clave]).map((m) => {
        const r = estado.resultados[m.clave];
        const fin = r.perdida[r.perdida.length - 1];
        let k = r.perdida.findIndex((v) => v - def.fmin < 1e-6);
        return [m.nombre, r.diverge ? `diverge en t=${r.tray.length}` : `f = ${VIZ.fmt(fin, 3)}${k >= 0 ? ` · <10⁻⁶ en t=${k}` : ''}`];
      }));
    }
    lienzo.alDibujar = () => { if (fondo) dibujar(); };

    let tAnim = 0;
    const bucle = VIZ.bucle((dt) => {
      tAnim += dt;
      progreso = Math.min(1, tAnim / 2500);
      dibujar();
      return progreso < 1;
    }, () => { bAnim.disabled = false; progreso = 1; });
    function animar() { tAnim = 0; progreso = 0; bAnim.disabled = true; bucle.iniciar(); }

    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      estado.inicio = [plano.ix(x), plano.iy(y)];
      recalcular();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; return tip.ocultar(); }
      hover = [plano.ix(x), plano.iy(y)];
      const [gx, gy] = estado.F.g(hover[0], hover[1]);
      tip.mostrar(x, y, `(${hover[0].toFixed(2)}, ${hover[1].toFixed(2)})<br>f = <b>${VIZ.fmt(estado.F.f(hover[0], hover[1]), 4)}</b><br>‖∇f‖ = ${VIZ.fmt(Math.hypot(gx, gy), 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'crosshair';

    estado.oyentes.push(() => { if (!bucle.activo) progreso = 1; dibujar(); });
    sKappa.input.disabled = estado.funcion !== 'cuadratica';
    prepararFondo();
    recalcular();
  }

  /* ---------- Fig. 2: pérdida por iteración ---------- */

  function montarPerdida(cuerpo) {
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, METODOS.map((m) => ({ color: m.color, texto: m.nombre, forma: 'linea' })));
    VIZ.nota(cuerpo, 'Esta figura comparte los parámetros de la figura 1. En escala logarítmica, una convergencia lineal (geométrica) aparece como una recta descendente cuya pendiente es log ρ.');

    let plano = null, hover = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      if (!estado.F) return;
      const def = FUNCIONES[estado.funcion];
      let ymin = Infinity, ymax = -Infinity, tmax = 1;
      for (const m of METODOS) {
        if (!estado.visibles[m.clave]) continue;
        for (const v of estado.resultados[m.clave].perdida) {
          const d = Math.max(v - def.fmin, 1e-16);
          ymin = Math.min(ymin, d); ymax = Math.max(ymax, d);
        }
        tmax = Math.max(tmax, estado.resultados[m.clave].perdida.length - 1);
      }
      if (!Number.isFinite(ymin)) { ymin = 1e-6; ymax = 1; }
      ymin = Math.max(ymin, 1e-16);
      ymax = Math.min(Math.max(ymax * 2, ymin * 100), 1e12);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: estado.iter, ymin, ymax }, { logY: true, etiquetaX: 'iteración t', etiquetaY: 'f(xₜ) − f*' });
      plano.ejes();
      ctx.save();
      plano.recortar();
      for (const m of METODOS) {
        if (!estado.visibles[m.clave]) continue;
        const r = estado.resultados[m.clave];
        VIZ.trazar(ctx, plano, r.perdida.map((v, t) => [t, Math.max(v - def.fmin, 1e-16)]), m.color, 2);
        if (r.diverge) {
          const t = r.perdida.length - 1;
          ctx.fillStyle = m.color;
          ctx.font = VIZ.fuente(11, 500);
          ctx.fillText('✕ diverge', plano.sx(t) + 6, plano.y1 + 12);
        }
        if (hover != null && hover < r.perdida.length) VIZ.marcador(ctx, plano.sx(hover), plano.sy(Math.max(r.perdida[hover] - def.fmin, 1e-16)), m.color, 4);
      }
      if (hover != null) {
        const x = Math.round(plano.sx(hover)) + 0.5;
        ctx.strokeStyle = C.eje;
        ctx.beginPath(); ctx.moveTo(x, plano.y1); ctx.lineTo(x, plano.y0); ctx.stroke();
      }
      ctx.restore();
      void tmax;
    }
    lienzo.alDibujar = dibujar;
    estado.oyentes.push(dibujar);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(estado.iter, Math.round(plano.ix(x))));
      dibujar();
      const def = FUNCIONES[estado.funcion];
      const filas = METODOS.filter((m) => estado.visibles[m.clave]).map((m) => {
        const r = estado.resultados[m.clave];
        return VIZ.filaTooltip(m.color, m.nombre, hover < r.perdida.length ? VIZ.fmt(r.perdida[hover] - def.fmin, 3) : '—');
      });
      tip.mostrar(x, y, `t = <b>${hover}</b>${filas.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('descenso-gradiente', {
    intro: String.raw`
      <p>Entrenar un modelo de aprendizaje automático consiste, casi siempre, en minimizar una <strong>función de pérdida</strong>
      \(f(\theta)\) que mide cuánto se equivoca el modelo con parámetros \(\theta\). El gradiente \(\nabla f(\theta)\) apunta en la
      dirección de máximo crecimiento, así que dar pequeños pasos en la dirección contraria hace bajar la pérdida.</p>
      <p>La dificultad está en el tamaño del paso: demasiado pequeño y el avance es lentísimo; demasiado grande y el método
      oscila o diverge. Los métodos con <em>momento</em> y los <em>adaptativos</em> como Adam modifican la regla básica para
      avanzar más rápido en valles estrechos y alargados, que son muy comunes en la práctica.</p>`,
    visualizaciones: [
      {
        titulo: 'Trayectorias sobre la superficie de pérdida',
        descripcion: 'Fondo: valor de la pérdida (más oscuro = mayor) con sus curvas de nivel. Cada línea es la trayectoria de un optimizador desde el mismo punto inicial.',
        montar: montarSuperficie,
      },
      {
        titulo: 'Convergencia',
        descripcion: 'Distancia al valor óptimo \\(f(x_t) - f^*\\) en cada iteración, en escala logarítmica.',
        montar: montarPerdida,
      },
    ],
    teoria: String.raw`
      <h2>Descenso de gradiente</h2>
      <p>La regla de actualización con tasa de aprendizaje \(\eta &gt; 0\) es</p>
      \[ x_{t+1} = x_t - \eta\, \nabla f(x_t). \]
      <p>Se justifica con la aproximación de Taylor de primer orden: \(f(x - \eta \nabla f) \approx f(x) - \eta \|\nabla f(x)\|^2\), que
      es menor que \(f(x)\) para \(\eta\) suficientemente pequeño. Si \(\nabla f\) es \(L\)-Lipschitz (\(f\) es \(L\)-<em>suave</em>), con
      \(\eta = 1/L\) se garantiza el descenso</p>
      \[ f(x_{t+1}) \le f(x_t) - \frac{1}{2L}\|\nabla f(x_t)\|^2. \]

      <h2>El caso cuadrático y el condicionamiento</h2>
      <p>Para \(f(x) = \tfrac{1}{2} x^\top A x\) con \(A\) simétrica definida positiva y valores propios \(0 &lt; \lambda_{\min} \le \dots \le \lambda_{\max}\),
      la iteración es lineal: \(x_{t+1} = (I - \eta A)\, x_t\). En la base de vectores propios cada componente evoluciona de forma independiente,</p>
      \[ x_{t+1}^{(i)} = (1 - \eta\lambda_i)\, x_t^{(i)}, \]
      <p>así que el método converge si y solo si \(|1 - \eta \lambda_i| &lt; 1\) para todo \(i\), es decir, \(\eta &lt; 2/\lambda_{\max}\).
      La mejor tasa uniforme se obtiene con \(\eta^* = 2/(\lambda_{\min} + \lambda_{\max})\) y da</p>
      \[ \|x_t\| \le \left(\frac{\kappa - 1}{\kappa + 1}\right)^{t} \|x_0\|, \qquad \kappa = \frac{\lambda_{\max}}{\lambda_{\min}}. \]
      <p>El <strong>número de condición</strong> \(\kappa\) gobierna la velocidad: se necesitan \(O(\kappa \log(1/\varepsilon))\) iteraciones.
      En la figura, la cuadrática tiene valores propios \(1\) y \(\kappa\); con \(\kappa\) grande el gradiente zigzaguea entre las
      paredes del valle mientras avanza muy lento a lo largo de él.</p>

      <h2>Momento (bola pesada)</h2>
      <p>Polyak propuso acumular una «velocidad» que promedia los gradientes recientes:</p>
      \[ v_{t+1} = \beta v_t - \eta \nabla f(x_t), \qquad x_{t+1} = x_t + v_{t+1}. \]
      <p>Las componentes que cambian de signo (el zigzag) se cancelan y las persistentes se acumulan. Con los parámetros óptimos para
      una cuadrática, la tasa mejora a \(\frac{\sqrt{\kappa} - 1}{\sqrt{\kappa} + 1}\): se necesitan \(O(\sqrt{\kappa}\log(1/\varepsilon))\)
      iteraciones.</p>

      <h2>Gradiente acelerado de Nesterov</h2>
      <p>Evalúa el gradiente en el punto hacia el que el momento ya está llevando la iteración:</p>
      \[ v_{t+1} = \beta v_t - \eta \nabla f(x_t + \beta v_t), \qquad x_{t+1} = x_t + v_{t+1}. \]
      <p>Esa «mirada adelante» corrige antes los excesos. Para funciones convexas \(L\)-suaves alcanza \(f(x_t) - f^* = O(1/t^2)\),
      frente a \(O(1/t)\) del gradiente simple, y Nesterov demostró que esa tasa es óptima para métodos de primer orden.</p>

      <h2>Adam</h2>
      <p>Adam (Kingma y Ba, 2015) mantiene promedios exponenciales del gradiente y de su cuadrado, coordenada a coordenada:</p>
      \[
      \begin{aligned}
      m_t &amp;= \beta_1 m_{t-1} + (1-\beta_1)\, g_t, &amp; \hat m_t &amp;= m_t / (1 - \beta_1^t), \\
      s_t &amp;= \beta_2 s_{t-1} + (1-\beta_2)\, g_t^2, &amp; \hat s_t &amp;= s_t / (1 - \beta_2^t), \\
      x_{t+1} &amp;= x_t - \eta\, \frac{\hat m_t}{\sqrt{\hat s_t} + \epsilon}.
      \end{aligned}
      \]
      <p>Dividir por \(\sqrt{\hat s_t}\) normaliza la escala de cada coordenada, de modo que el paso tiene tamaño cercano a \(\eta\)
      independientemente de la magnitud del gradiente. Esto lo hace robusto a malos condicionamientos alineados con los ejes, y es
      la razón por la que su \(\eta\) se elige en una escala distinta. Los valores usados aquí son \(\beta_1 = 0.9\), \(\beta_2 = 0.999\) y
      \(\epsilon = 10^{-8}\).</p>

      <h2>Funciones no convexas</h2>
      <p>La función de Rosenbrock \(f(x,y) = (1-x)^2 + 100(y - x^2)^2\) tiene un único mínimo en \((1,1)\) en el fondo de un valle
      parabólico estrecho; su hessiana allí tiene \(\kappa \approx 2500\). La de Himmelblau tiene cuatro mínimos locales con \(f = 0\):
      el mínimo al que se llega depende del punto inicial y del método. En general, en problemas no convexos el descenso de gradiente
      solo garantiza llegar a un punto estacionario, \(\|\nabla f\| \to 0\).</p>`,
  });
})();
