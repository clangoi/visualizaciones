(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  /* ---------- Fig. 1: la cadena que generan unas reglas ---------- */

  const REGLAS = { m1: ['k → k + 1', (k) => k + 1], m2: ['k → k + 2', (k) => k + 2], m3: ['k → k + 3', (k) => k + 3], m5: ['k → k + 5', (k) => k + 5], d2: ['k → 2k', (k) => 2 * k] };
  const TOPE = 40;

  function montarReglas(cuerpo) {
    let reglas = { m1: false, m2: true, m3: false, m5: false, d2: false }, b1 = 0, dosBases = false, b2 = 1;
    let gen = new Map(), actual = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Caso base n₀', min: 0, max: 8, valor: b1, alCambiar: (v) => { b1 = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Agregar un segundo caso base', valor: dosBases, alCambiar: (v) => { dosBases = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Segundo caso base', min: 0, max: 8, valor: b2, alCambiar: (v) => { b2 = v; rep.reiniciar(); } });
    ctl.casillas(Object.entries(REGLAS).map(([c, [t]]) => ({ clave: c, texto: t, activo: reglas[c] })), (e) => { reglas = { ...e }; rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 4 * Math.min(40, (w - 20) / 10) + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'alcanzado en una generación anterior', forma: 'cuadro' },
      { color: C.s2, texto: 'alcanzado en esta generación', forma: 'cuadro' },
      { color: C.inactivo, texto: 'no alcanzado todavía', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El conjunto alcanzado es el menor que contiene a los casos base y es cerrado bajo las reglas. Con +2 y base 0 solo llegan los pares; agregue +3 o una segunda base.');

    function iniciar() {
      gen = new Map([[b1, 0]]);
      if (dosBases) gen.set(b2, 0);
      actual = 0;
      return (function* () {
        yield;
        for (let g = 1; g <= TOPE; g++) {
          let nuevo = false;
          for (const [k, gk] of [...gen]) {
            if (gk !== g - 1) continue;
            for (const [c, [, f]] of Object.entries(REGLAS)) if (reglas[c]) { const v = f(k); if (v < TOPE && !gen.has(v)) { gen.set(v, g); nuevo = true; } }
          }
          if (!nuevo) return;
          actual = g;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cw = Math.min(40, (W - 20) / 10), x0 = (W - 10 * cw) / 2;
      geo = { cw, x0 };
      for (let f = 0; f < 4; f++) {
        D.tira(ctx, x0, f * cw + 4, 10 * cw, 10, (i) => {
          const n = f * 10 + i, g = gen.get(n);
          return g === undefined ? { fondo: C.neutro, texto: n, tinta: C.apagado } : { fondo: g === actual && actual > 0 ? C.s2 : C.tinta, texto: n, tinta: C.sobre };
        }, cw - 2);
      }
      let primero = -1;
      for (let n = 0; n < TOPE; n++) if (!gen.has(n)) { primero = n; break; }
      lectura.set([['alcanzados', `${gen.size} de ${TOPE}`], ['generación actual', String(actual)], ['primer natural no alcanzado', primero < 0 ? 'ninguno' : String(primero)], ['reglas activas', Object.entries(reglas).filter(([, v]) => v).map(([c]) => REGLAS[c][0]).join(' · ') || 'ninguna']]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.x0) / geo.cw), f = Math.floor((y - 4) / geo.cw), n = f * 10 + c;
      if (c < 0 || c > 9 || f < 0 || f > 3) return tip.ocultar();
      const g = gen.get(n);
      tip.mostrar(x, y, `<b>${n}</b>: ${g === undefined ? 'no alcanzado' : g === 0 ? 'caso base' : `generación ${g}`}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: estampillas de a y b pesos ---------- */

  function montarEstampillas(cuerpo) {
    let a = 3, b = 5, geo = null;
    const N = 60;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Estampilla a', min: 2, max: 9, valor: a, alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Estampilla b', min: 2, max: 11, valor: b, alCambiar: (v) => { b = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 6 * Math.min(40, (w - 20) / 10) + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'se puede pagar exactamente', forma: 'cuadro' },
      { color: C.inactivo, texto: 'no se puede', forma: 'cuadro' },
      { color: C.s8, texto: 'mayor monto imposible', forma: 'cuadro' },
      { color: C.s6, texto: 'casos base: a montos seguidos', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'n es alcanzable si n − a o n − b lo es. Cuando a montos consecutivos son alcanzables (los casos base), el paso k → k + a los lleva a todos los que siguen.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const R = Array(N).fill(false);
      R[0] = true;
      for (let n = 1; n < N; n++) R[n] = (n >= a && R[n - a]) || (n >= b && R[n - b]);
      const coprimos = gcd(a, b) === 1;
      let L = -1; for (let n = 0; n < N; n++) if (!R[n]) L = n;
      const ini = coprimos ? L + 1 : -1;
      const cw = Math.min(40, (W - 20) / 10), x0 = (W - 10 * cw) / 2;
      geo = { cw, x0 };
      for (let f = 0; f < 6; f++) {
        D.tira(ctx, x0, f * cw + 4, 10 * cw, 10, (i) => {
          const n = f * 10 + i;
          const base = coprimos && n >= ini && n < ini + a;
          return { fondo: R[n] ? C.s1 : C.neutro, texto: n, tinta: R[n] ? C.sobre : C.apagado, borde: n === L && coprimos ? C.s8 : base ? C.s6 : null };
        }, cw - 2);
      }
      registro.textContent = coprimos
        ? `Con estampillas de ${a} y ${b}, el mayor monto imposible es ${L} = ${a}·${b} − ${a} − ${b}. Desde ${ini} hay ${a} montos seguidos alcanzables; sumando ${a} se llega a todos los siguientes.`
        : `mcd(${a}, ${b}) = ${gcd(a, b)} > 1: solo se pagan múltiplos de ${gcd(a, b)}, así que infinitos montos son imposibles.`;
      lectura.set([['mcd(a, b)', String(gcd(a, b))], ['mayor monto imposible', coprimos ? String(L) : 'no existe'], ['fórmula ab − a − b', coprimos ? String(a * b - a - b) : '—'], ['todo n ≥', coprimos ? String(ini) : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.x0) / geo.cw), f = Math.floor((y - 4) / geo.cw), n = f * 10 + c;
      if (c < 0 || c > 9 || f < 0 || f > 5) return tip.ocultar();
      const R = [];
      for (let m = 0; m <= n; m++) R[m] = m === 0 || (m >= a && R[m - a]) || (m >= b && R[m - b]);
      let txt = 'no se puede';
      if (R[n]) { let i = 0; for (; i * a <= n; i++) if (R[n - i * a] && (n - i * a) % b === 0) { txt = `${i}·${a} + ${(n - i * a) / b}·${b}`; break; } }
      tip.mostrar(x, y, `<b>${n}</b> = ${txt}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('inductive-chains', {
    intro: String.raw`
      <p>Una demostración por inducción es una <strong>cadena</strong>: unos casos base de los que se parte y una regla que, de cada eslabón, lleva al siguiente.
      Las cadenas no tienen por qué avanzar de uno en uno. Una regla «\(k \to k+2\)» necesita dos casos base; una regla «\(k \to 2k\)» solo alcanza potencias de dos a partir del 1.</p>
      <p>Pensar en lo que <em>alcanza</em> la cadena aclara qué casos base hacen falta y por qué. Es también la forma de entender los conjuntos definidos por reglas.</p>`,
    visualizaciones: [
      {
        titulo: 'La cadena que generan unas reglas',
        descripcion: 'Elija casos base y reglas, y reproduzca las generaciones. Pruebe «+2» con base 0, luego agregue base 1, y «+2» y «+3» juntas.',
        montar: montarReglas,
      },
      {
        titulo: 'Estampillas de a y b',
        descripcion: 'Montos que se pueden pagar con estampillas de dos valores. Busque el mayor monto imposible y la racha de casos base que permite inducir desde ahí.',
        montar: montarEstampillas,
      },
    ],
    teoria: String.raw`
      <h2>Qué casos base necesita cada regla</h2>
      <p>Si el paso demuestra \(P(k) \to P(k+d)\), la inducción cubre los \(n \equiv r \pmod d\) para cada caso base \(r\). Hacen falta \(d\) casos base consecutivos para cubrir todas las clases de resto.
      Con la regla \(P(k) \to P(k+2)\), por ejemplo, hay que probar tanto \(P(0)\) como \(P(1)\).</p>
      <table>
        <tr><th>Regla del paso</th><th>Casos base necesarios</th><th>Conclusión</th></tr>
        <tr><td>\(P(k) \to P(k+1)\)</td><td>\(P(n_0)\)</td><td>\(P(n)\) para \(n \ge n_0\)</td></tr>
        <tr><td>\(P(k) \to P(k+2)\)</td><td>\(P(n_0)\) y \(P(n_0+1)\)</td><td>\(P(n)\) para \(n \ge n_0\)</td></tr>
        <tr><td>\(P(k) \to P(2k)\)</td><td>\(P(1)\)</td><td>\(P(2^j)\) para todo \(j\), nada más</td></tr>
      </table>
      <h2>Estampillas y el problema de Frobenius</h2>
      <p>Con estampillas de valores coprimos \(a, b\), el mayor monto que no se puede pagar es
      \[ g(a,b) = ab - a - b. \]
      Para \(a=3, b=5\): \(g = 7\). La prueba de que todo \(n \ge 8\) se puede pagar es inducción con tres casos base (\(8 = 3+5,\ 9 = 3\cdot 3,\ 10 = 2\cdot 5\)) y el paso \(P(k) \to P(k+3)\).
      Si \(\gcd(a,b) &gt; 1\) solo se alcanzan múltiplos del mcd.</p>
      <h2>Conjuntos definidos por reglas</h2>
      <p>La figura 1 construye el menor conjunto que contiene a las bases y es cerrado bajo las reglas: es lo que formaliza la sección siguiente, en
      <a href="tema.html?id=inductive-sets">Inductively Defined Sets</a>. Cuando el paso necesita varios casos anteriores a la vez se usa la
      <a href="tema.html?id=strong-induction">inducción fuerte</a>.</p>`,
  });
})();
