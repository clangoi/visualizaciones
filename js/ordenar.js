/* Algoritmos de ordenamiento compartidos y sus figuras (barras animadas y costo frente a n). */
(function () {
  'use strict';
  const { color: C } = VIZ;

  const intercambiar = (a, i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };

  /* Cada algoritmo es un generador que ordena `a` en el lugar,
     acumula conteos en `e` y emite eventos para la animación:
     cmp: índices comparados · mov: índices escritos · piv: pivote · rango: subarreglo activo. */
  const ALGORITMOS = {
    burbuja: {
      nombre: 'Burbuja',
      *fn(a, e) {
        const n = a.length;
        for (let i = 0; i < n - 1; i++) {
          let cambio = false;
          for (let j = 0; j < n - 1 - i; j++) {
            e.comp++;
            yield { cmp: [j, j + 1] };
            if (a[j] > a[j + 1]) {
              intercambiar(a, j, j + 1);
              e.esc += 2;
              cambio = true;
              yield { mov: [j, j + 1] };
            }
          }
          e.listo.add(n - 1 - i);
          if (!cambio) break;
        }
      },
    },
    seleccion: {
      nombre: 'Selección',
      *fn(a, e) {
        const n = a.length;
        for (let i = 0; i < n - 1; i++) {
          let m = i;
          for (let j = i + 1; j < n; j++) {
            e.comp++;
            yield { cmp: [m, j], piv: i };
            if (a[j] < a[m]) m = j;
          }
          if (m !== i) {
            intercambiar(a, i, m);
            e.esc += 2;
            yield { mov: [i, m] };
          }
          e.listo.add(i);
        }
      },
    },
    insercion: {
      nombre: 'Inserción',
      *fn(a, e) {
        for (let i = 1; i < a.length; i++) {
          let j = i;
          while (j > 0) {
            e.comp++;
            yield { cmp: [j - 1, j], rango: [0, i] };
            if (a[j - 1] > a[j]) {
              intercambiar(a, j - 1, j);
              e.esc += 2;
              yield { mov: [j - 1, j], rango: [0, i] };
              j--;
            } else break;
          }
        }
      },
    },
    mezcla: {
      nombre: 'Mezcla (merge sort)',
      *fn(a, e) {
        const aux = a.slice();
        function* ordenar(lo, hi) {
          if (hi <= lo) return;
          const mid = (lo + hi) >> 1;
          yield* ordenar(lo, mid);
          yield* ordenar(mid + 1, hi);
          for (let k = lo; k <= hi; k++) aux[k] = a[k];
          let i = lo, j = mid + 1;
          for (let k = lo; k <= hi; k++) {
            if (i > mid) a[k] = aux[j++];
            else if (j > hi) a[k] = aux[i++];
            else {
              e.comp++;
              yield { cmp: [i, j], rango: [lo, hi] };
              a[k] = aux[j] < aux[i] ? aux[j++] : aux[i++];
            }
            e.esc++;
            yield { mov: [k], rango: [lo, hi] };
          }
        }
        yield* ordenar(0, a.length - 1);
      },
    },
    rapido: {
      nombre: 'Rápido (quicksort)',
      // op.pivote: 'ultimo' | 'aleatorio' | 'mediana3'
      *fn(a, e, op = {}) {
        const estrategia = op.pivote || 'ultimo';
        const rnd = VIZ.semilla(op.semilla || 12345);
        function* elegirPivote(lo, hi) {
          let k = hi;
          if (estrategia === 'aleatorio') k = lo + Math.floor(rnd() * (hi - lo + 1));
          else if (estrategia === 'mediana3' && hi - lo >= 2) {
            const m = (lo + hi) >> 1;
            e.comp += 3;
            yield { cmp: [lo, m, hi], rango: [lo, hi] };
            const tres = [lo, m, hi].sort((x, y) => a[x] - a[y]);
            k = tres[1];
          }
          if (k !== hi) {
            intercambiar(a, k, hi);
            e.esc += 2;
            yield { mov: [k, hi], piv: hi, rango: [lo, hi] };
          }
        }
        function* ordenar(lo, hi) {
          if (lo >= hi) {
            if (lo === hi) e.listo.add(lo);
            return;
          }
          yield* elegirPivote(lo, hi);
          const p = a[hi]; // partición de Lomuto con el pivote al final
          let i = lo;
          for (let j = lo; j < hi; j++) {
            e.comp++;
            yield { cmp: [j, hi], piv: hi, rango: [lo, hi] };
            if (a[j] < p) {
              if (i !== j) {
                intercambiar(a, i, j);
                e.esc += 2;
                yield { mov: [i, j], piv: hi, rango: [lo, hi] };
              }
              i++;
            }
          }
          if (i !== hi) {
            intercambiar(a, i, hi);
            e.esc += 2;
            yield { mov: [i, hi], rango: [lo, hi] };
          }
          e.listo.add(i);
          yield* ordenar(lo, i - 1);
          yield* ordenar(i + 1, hi);
        }
        yield* ordenar(0, a.length - 1);
      },
    },
    monticulo: {
      nombre: 'Montículo (heapsort)',
      *fn(a, e) {
        const n = a.length;
        function* hundir(i, m) {
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let g = i;
            if (l < m) { e.comp++; yield { cmp: [l, g], rango: [0, m - 1] }; if (a[l] > a[g]) g = l; }
            if (r < m) { e.comp++; yield { cmp: [r, g], rango: [0, m - 1] }; if (a[r] > a[g]) g = r; }
            if (g === i) return;
            intercambiar(a, i, g);
            e.esc += 2;
            yield { mov: [i, g], rango: [0, m - 1] };
            i = g;
          }
        }
        for (let i = (n >> 1) - 1; i >= 0; i--) yield* hundir(i, n);
        for (let m = n - 1; m > 0; m--) {
          intercambiar(a, 0, m);
          e.esc += 2;
          e.listo.add(m);
          yield { mov: [0, m] };
          yield* hundir(0, m);
        }
      },
    },
  };
  const CLAVES = Object.keys(ALGORITMOS);

  const DISTRIBUCIONES = [
    ['aleatoria', 'Aleatoria'],
    ['casi', 'Casi ordenada'],
    ['invertida', 'Invertida'],
    ['pocos', 'Pocos valores distintos'],
    ['ordenada', 'Ya ordenada'],
  ];

  function generar(n, tipo, rnd) {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    const barajar = () => { for (let i = n - 1; i > 0; i--) intercambiar(a, i, Math.floor(rnd() * (i + 1))); };
    switch (tipo) {
      case 'aleatoria': barajar(); break;
      case 'casi':
        for (let k = 0; k < Math.max(1, Math.round(n / 12)); k++) {
          const i = Math.floor(rnd() * (n - 3));
          intercambiar(a, i, i + 1 + Math.floor(rnd() * 3));
        }
        break;
      case 'invertida': a.reverse(); break;
      case 'pocos':
        for (let i = 0; i < n; i++) a[i] = Math.ceil(((1 + Math.floor(rnd() * 4)) * n) / 4);
        break;
      default: break;
    }
    return a;
  }

  const NOMBRE_CORTO = (k) => ALGORITMOS[k].nombre.split(' ')[0];

  // Número de inversiones (pares fuera de orden), O(n²): suficiente para n ≤ 200.
  function inversiones(a) {
    let s = 0;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) s++;
    return s;
  }

  /* ---------- Animación de barras ----------
     cfg: { alg, selector, n, tipo, opciones, extras(ctl, api), lecturasExtra(original, a, e) } */
  function animacion(cuerpo, cfg = {}) {
    let alg = cfg.alg || 'rapido', n = cfg.n || 40, tipo = cfg.tipo || 'aleatoria', semilla = 7;
    const opciones = Object.assign({}, cfg.opciones);
    let original = null, a = [], e = null, ev = {};

    const ctl = VIZ.controles(cuerpo);
    if (cfg.selector) {
      ctl.selector({ etiqueta: 'Algoritmo', opciones: Object.keys(ALGORITMOS).map((k) => [k, ALGORITMOS[k].nombre]), valor: alg,
        alCambiar: (v) => { alg = v; rep.reiniciar(); } });
    }
    ctl.selector({ etiqueta: 'Datos iniciales', opciones: DISTRIBUCIONES, valor: tipo,
      alCambiar: (v) => { tipo = v; original = null; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tamaño n', min: 8, max: 160, valor: n, alCambiar: (v) => { n = v; original = null; rep.reiniciar(); } });
    const api = { opciones, reiniciar: () => rep.reiniciar() };
    if (cfg.extras) cfg.extras(ctl, api);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 5, velMax: 12 });
    ctl.boton('Nuevos datos', () => { semilla++; original = null; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: '#a9a8a0', texto: 'sin ordenar' },
      { color: C.s1, texto: 'comparación' },
      { color: C.s2, texto: 'escritura / intercambio' },
      { color: C.s7, texto: 'pivote o posición fija' },
      { color: C.tinta, texto: 'en su posición final' },
    ]);
    const lectura = VIZ.lectura(cuerpo);

    function iniciar() {
      if (!original) original = generar(n, tipo, VIZ.semilla(semilla * 7919 + n));
      a = original.slice();
      e = { comp: 0, esc: 0, pasos: 0, listo: new Set() };
      ev = {};
      const g = ALGORITMOS[alg].fn(a, e, opciones);
      return (function* () {
        for (const x of g) { ev = x; e.pasos++; yield; }
        ev = {};
        for (let i = 0; i < a.length; i++) e.listo.add(i);
      })();
    }

    let geom = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 8, der = 8, sup = 10, inf = 18;
      const paso = (W - izq - der) / a.length;
      const hueco = paso > 7 ? 2 : paso > 3 ? 1 : 0;
      const max = Math.max(...a);
      const base = H - inf;
      geom = { izq, paso };
      if (ev.rango) {
        ctx.fillStyle = C.neutro;
        ctx.fillRect(izq + ev.rango[0] * paso, sup - 4, (ev.rango[1] - ev.rango[0] + 1) * paso, base - sup + 4);
      }
      const cmp = new Set(ev.cmp || []), mov = new Set(ev.mov || []);
      for (let i = 0; i < a.length; i++) {
        const h = Math.max(2, (a[i] / max) * (base - sup));
        let col = '#a9a8a0';
        if (e.listo.has(i)) col = C.tinta;
        if (ev.piv === i) col = C.s7;
        if (cmp.has(i)) col = C.s1;
        if (mov.has(i)) col = C.s2;
        ctx.fillStyle = col;
        const x = izq + i * paso + hueco / 2, w = Math.max(1, paso - hueco);
        ctx.beginPath();
        if (ctx.roundRect && w > 4) ctx.roundRect(x, base - h, w, h, [Math.min(4, w / 2), Math.min(4, w / 2), 0, 0]);
        else ctx.rect(x, base - h, w, h);
        ctx.fill();
      }
      ctx.strokeStyle = C.eje;
      ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - der, base + 0.5); ctx.stroke();
      if (rep && rep.terminado) {
        ctx.font = VIZ.fuente(11);
        ctx.fillStyle = C.tinta2;
        ctx.textBaseline = 'top';
        ctx.fillText('ordenado', izq, base + 4);
      }
      lectura.set([
        ['algoritmo', NOMBRE_CORTO(alg)],
        ['n', String(a.length)],
        ['comparaciones', VIZ.entero(e.comp)],
        ['escrituras', VIZ.entero(e.esc)],
        ['n² / 2', VIZ.entero((a.length * a.length) / 2)],
        ['n log₂ n', VIZ.entero(a.length * Math.log2(a.length))],
        ...(cfg.lecturasExtra ? cfg.lecturasExtra(original, a, e) : []),
      ]);
    }
    lienzo.alDibujar = () => { if (e) dibujar(); };
    lienzo.canvas.addEventListener('pointermove', (ev2) => {
      if (!geom) return;
      const { x, y } = lienzo.posicion(ev2);
      const i = Math.floor((x - geom.izq) / geom.paso);
      if (i < 0 || i >= a.length) return tip.ocultar();
      tip.mostrar(x, y, `posición <b>${i}</b><br>valor <b>${a[i]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
    return api;
  }

  /* ---------- Costo empírico frente a n ----------
     cfg: { series: 'algoritmos' | 'distribuciones', alg, opciones, extras(ctl, api) } */
  function curvas(cuerpo, cfg = {}) {
    const porDistribucion = cfg.series === 'distribuciones';
    const alg = cfg.alg || 'rapido';
    const opciones = Object.assign({}, cfg.opciones);
    let metrica = 'comp', tipo = 'aleatoria', logY = false, hoverN = null;
    const tamanos = [];
    for (let n = 10; n <= 200; n += 10) tamanos.push(n);
    let cache = {};

    const series = porDistribucion
      ? DISTRIBUCIONES.map(([k, t], i) => ({ clave: k, nombre: t, color: VIZ.series[i] }))
      : Object.keys(ALGORITMOS).map((k, i) => ({ clave: k, nombre: NOMBRE_CORTO(k), color: VIZ.series[i] }));

    function medir(algoritmo, distribucion) {
      return tamanos.map((n) => {
        const a = generar(n, distribucion, VIZ.semilla(1000 + n));
        const e = { comp: 0, esc: 0, listo: new Set() };
        const g = ALGORITMOS[algoritmo].fn(a, e, opciones);
        while (!g.next().done);
        return { n, comp: e.comp, esc: e.esc };
      });
    }
    function datos() {
      const clave = porDistribucion ? 'd' : tipo;
      if (cache[clave]) return cache[clave];
      const res = {};
      for (const s of series) res[s.clave] = porDistribucion ? medir(alg, s.clave) : medir(s.clave, tipo);
      return (cache[clave] = res);
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Medida', opciones: [['comp', 'Comparaciones'], ['esc', 'Escrituras al arreglo']], valor: metrica,
      alCambiar: (v) => { metrica = v; dibujar(); } });
    if (!porDistribucion) {
      ctl.selector({ etiqueta: 'Datos iniciales', opciones: DISTRIBUCIONES, valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    }
    ctl.selector({ etiqueta: 'Escala vertical', opciones: [['lin', 'Lineal'], ['log', 'Logarítmica']], valor: 'lin',
      alCambiar: (v) => { logY = v === 'log'; dibujar(); } });
    if (cfg.extras) cfg.extras(ctl, { opciones, recalcular: () => { cache = {}; dibujar(); } });
    const visibles = ctl.casillas(series.map((s) => ({ clave: s.clave, texto: s.nombre, color: s.color })), dibujar);

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...series.map((s) => ({ color: s.color, texto: s.nombre, forma: 'linea' })),
      { color: C.apagado, texto: 'referencias n²/2 y n log₂ n', forma: 'linea' },
    ]);
    VIZ.nota(cuerpo, porDistribucion
      ? 'Cada punto es una ejecución real del algoritmo sobre un arreglo de tamaño n con la distribución indicada. Pase el cursor para leer los valores.'
      : 'Cada punto es una ejecución real del algoritmo sobre un arreglo de tamaño n. Cambie a escala logarítmica para comparar los algoritmos O(n log n) entre sí.');

    let plano = null;
    function dibujar() {
      const D = datos();
      const { ctx } = lienzo;
      lienzo.limpiar();
      let ymax = 1;
      for (const s of series) if (visibles[s.clave]) for (const p of D[s.clave]) ymax = Math.max(ymax, p[metrica]);
      ymax *= 1.05;
      const piso = logY ? 10 : 0;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 200, ymin: piso, ymax: Math.max(ymax, piso * 10) }, {
        logY, etiquetaX: 'tamaño de la entrada n', etiquetaY: metrica === 'comp' ? 'comparaciones' : 'escrituras',
        margen: { izq: 60, der: 74 },
      });
      plano.ejes();
      ctx.save();
      plano.recortar();
      const etiquetas = [];
      for (const [nombre, f] of [['n²/2', (n) => (n * n) / 2], ['n log₂ n', (n) => n * Math.log2(n)]]) {
        const pts = [];
        for (let n = 2; n <= 200; n += 2) pts.push([n, f(n)]);
        VIZ.trazar(ctx, plano, pts, C.apagado, 1, [3, 4]);
        etiquetas.push({ y: plano.sy(f(200)), texto: nombre });
      }
      for (const s of series) {
        if (!visibles[s.clave]) continue;
        VIZ.trazar(ctx, plano, D[s.clave].map((p) => [p.n, Math.max(p[metrica], piso)]), s.color, 2);
        if (hoverN != null) {
          const p = D[s.clave].find((q) => q.n === hoverN);
          VIZ.marcador(ctx, plano.sx(p.n), plano.sy(Math.max(p[metrica], piso)), s.color, 4);
        }
      }
      ctx.restore();
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.apagado;
      for (const et of etiquetas) if (et.y >= plano.y1 && et.y <= plano.y0) ctx.fillText(et.texto, plano.x1 + 6, et.y);
      if (hoverN != null) {
        const x = Math.round(plano.sx(hoverN)) + 0.5;
        ctx.strokeStyle = C.eje;
        ctx.beginPath(); ctx.moveTo(x, plano.y1); ctx.lineTo(x, plano.y0); ctx.stroke();
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hoverN = null; tip.ocultar(); return dibujar(); }
      hoverN = Math.min(200, Math.max(10, Math.round(plano.ix(x) / 10) * 10));
      dibujar();
      const D = datos();
      const filas = series.filter((s) => visibles[s.clave])
        .map((s) => ({ s, v: D[s.clave].find((p) => p.n === hoverN)[metrica] }))
        .sort((p, q) => q.v - p.v)
        .map(({ s, v }) => VIZ.filaTooltip(s.color, s.nombre, VIZ.entero(v)));
      tip.mostrar(x, y, `<div>n = <b>${hoverN}</b></div>${filas.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hoverN = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.orden = { ALGORITMOS, DISTRIBUCIONES, generar, inversiones, animacion, curvas, intercambiar };
})();
