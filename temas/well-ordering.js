(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: el mínimo de un subconjunto ---------- */

  const primo = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const CASOS = {
    pares: { univ: 'ℕ', nombre: 'ℕ · los pares mayores que 10', lo: 0, hi: 29, en: (x) => x % 2 === 0 && x > 10, min: 12 },
    sie: { univ: 'ℕ', nombre: 'ℕ · los múltiplos de 7', lo: 0, hi: 29, en: (x) => x % 7 === 0, min: 0 },
    cuad: { univ: 'ℕ', nombre: 'ℕ · los n con n² > 200', lo: 0, hi: 29, en: (x) => x * x > 200, min: 15 },
    primos: { univ: 'ℕ', nombre: 'ℕ · los primos mayores que 20', lo: 0, hi: 29, en: (x) => x > 20 && primo(x), min: 23 },
    vacio: { univ: 'ℕ', nombre: 'ℕ · el conjunto vacío', lo: 0, hi: 29, en: () => false, min: null, vacio: true },
    zneg: { univ: 'ℤ', nombre: 'ℤ · los enteros negativos', lo: -15, hi: 14, en: (x) => x < 0, min: null },
    zcota: { univ: 'ℤ', nombre: 'ℤ · los x ≥ −5', lo: -15, hi: 14, en: (x) => x >= -5, min: -5 },
    zcuad: { univ: 'ℤ', nombre: 'ℤ · los x con x² < 30', lo: -15, hi: 14, en: (x) => x * x < 30, min: -5 },
    denso: { univ: 'ℚ', nombre: 'Racionales · el intervalo (0, 1]', denso: true, min: null },
  };

  function montarMinimo(cuerpo) {
    let clave = 'pares';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Subconjunto', opciones: Object.entries(CASOS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 170 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'elemento del subconjunto', forma: 'cuadro' },
      { color: C.s6, texto: 'mínimo', forma: 'cuadro' },
      { color: C.s8, texto: 'cadena descendente sin fin', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En ℕ todo subconjunto no vacío tiene mínimo. Cambie a ℤ o a los racionales y busque subconjuntos que no lo tengan.');

    function dibujar() {
      const K = CASOS[clave], { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (K.denso) {
        const x0 = 30, x1 = W - 30, X = (v) => x0 + v * (x1 - x0), y = 70;
        ctx.strokeStyle = C.s1; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(X(0.02), y); ctx.lineTo(X(1), y); ctx.stroke();
        ctx.beginPath(); ctx.arc(X(0), y, 6, 0, 7); ctx.fillStyle = C.superficie; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.s1; ctx.stroke();
        ctx.beginPath(); ctx.arc(X(1), y, 6, 0, 7); ctx.fillStyle = C.s1; ctx.fill();
        for (let j = 0; j <= 5; j++) {
          const v = 2 ** -j;
          D.texto2(ctx, j === 0 ? '1' : j === 1 ? '1/2' : `1/${2 ** j}`, X(v), y + 26, { px: 10.5, color: C.tinta2 });
          if (j) D.flecha(ctx, X(2 ** -(j - 1)) - 5, y - 18 - j * 2, X(v) + 5, y - 18 - j * 2, C.s8, 1.5);
        }
        D.texto2(ctx, '0 no pertenece', X(0), y + 26, { px: 10.5, color: C.apagado });
        registro.textContent = 'Para cualquier x del intervalo, x/2 también está y es menor: 1 > 1/2 > 1/4 > 1/8 > … nunca termina. No hay mínimo.';
        lectura.set([['universo', 'ℚ'], ['¿tiene mínimo?', 'no'], ['por qué', 'siempre hay otro menor']]);
        return;
      }
      const n = K.hi - K.lo + 1, x0 = 10, w = W - 2 * x0;
      D.tira(ctx, x0, 60, w, n, (i) => {
        const v = K.lo + i, dentro = K.en(v);
        return { fondo: v === K.min ? C.s6 : dentro ? C.s1 : C.neutro, texto: cw0 >= 13 && (cw0 >= 20 || v % 5 === 0) ? String(v).replace('-', '−') : null, tinta: dentro ? C.sobre : C.apagado };
      }, 30);
      if (K.univ === 'ℤ' && K.min === null) {
        D.flecha(ctx, x0 + 40, 44, x0 + 2, 44, C.s8, 2);
        D.texto2(ctx, '−1, −2, −3, … sin fin', x0 + 48, 44, { alinea: 'left', color: C.s8, px: 11 });
      }
      if (K.min != null) D.texto2(ctx, `mínimo = ${String(K.min).replace('-', '−')}`, x0 + (K.min - K.lo + 0.5) * (w / n), 112, { color: C.s6, px: 12, peso: 600 });
      D.texto2(ctx, K.univ === 'ℕ' ? 'se muestran 0 … 29 (el conjunto sigue)' : 'se muestran −15 … 14 (el universo sigue en ambos sentidos)', x0, 142, { alinea: 'left', color: C.apagado, px: 11 });
      registro.textContent = K.vacio
        ? 'El conjunto vacío no tiene elementos y por tanto no tiene mínimo: el principio habla de subconjuntos no vacíos.'
        : K.min != null
          ? `Hay un elemento que es menor o igual que todos los demás: ${String(K.min).replace('-', '−')}.`
          : 'Para cada elemento hay otro menor del conjunto: no existe mínimo. El orden de ℤ no es un buen orden.';
      lectura.set([['universo', K.univ], ['¿tiene mínimo?', K.min != null ? 'sí' : 'no'], ['mínimo', K.min != null ? String(K.min).replace('-', '−') : '—']]);
    }
    let cw0 = 20;
    lienzo.alDibujar = () => { cw0 = (lienzo.ancho - 20) / 30; dibujar(); };
    dibujar();
  }

  /* ---------- Fig. 2: cadenas descendentes ---------- */

  const PROC = {
    euclides: { nombre: 'Euclides: (a, b) → (b, a mod b); medida: b', ayuda: 'b baja estrictamente porque a mod b < b' },
    mitad: { nombre: 'n → ⌊n/2⌋', ayuda: 'n baja a menos de la mitad' },
    resta: { nombre: 'n → n − 3 mientras n ≥ 3', ayuda: 'cada paso resta 3' },
    collatz: { nombre: 'Collatz: par → n/2, impar → 3n + 1', ayuda: 'a veces sube: no hay medida decreciente conocida' },
    racional: { nombre: 'x → x/2 en los racionales positivos', ayuda: 'baja siempre, y nunca llega a un mínimo' },
  };

  function montarDescenso(cuerpo) {
    let proc = 'euclides', n = 252, m = 105, ys = [], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: Object.entries(PROC).map(([k, v]) => [k, v.nombre]), valor: proc, alCambiar: (v) => { proc = v; calcular(); } });
    ctl.numero({ etiqueta: 'n (o a)', min: 1, max: 999, valor: n, alCambiar: (v) => { n = Math.max(1, Math.round(v) || 1); calcular(); } });
    ctl.numero({ etiqueta: 'b (solo Euclides)', min: 0, max: 999, valor: m, alCambiar: (v) => { m = Math.max(0, Math.round(v) || 0); calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 220, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'la medida baja respecto del paso anterior', forma: 'cuadro' },
      { color: C.s8, texto: 'la medida sube', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La medida es un natural. Si siempre baja, el proceso debe detenerse: no puede existir una cadena descendente infinita de naturales.');

    function calcular() {
      ys = [];
      const MAX = 60;
      if (proc === 'euclides') { let a = n, b = m; ys.push(b); while (b > 0 && ys.length < MAX) { [a, b] = [b, a % b]; ys.push(b); } }
      else if (proc === 'mitad') { let x = n; ys.push(x); while (x > 0 && ys.length < MAX) { x = Math.floor(x / 2); ys.push(x); } }
      else if (proc === 'resta') { let x = n; ys.push(x); while (x >= 3 && ys.length < MAX) { x -= 3; ys.push(x); } }
      else if (proc === 'collatz') { let x = n; ys.push(x); while (x !== 1 && ys.length < MAX) { x = x % 2 ? 3 * x + 1 : x / 2; ys.push(x); } }
      else { let x = 1; ys.push(x); while (ys.length < 20) { x /= 2; ys.push(x); } }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...ys) * 1.1 || 1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: ys.length, ymin: 0, ymax }, { etiquetaX: 'paso', etiquetaY: 'medida', ticksX: ys.map((_, i) => i + 0.5).filter((_, i) => i % Math.ceil(ys.length / 12) === 0), formatoX: (v) => String(Math.round(v - 0.5)) });
      plano.ejes();
      const bw = (plano.x1 - plano.x0) / ys.length;
      ys.forEach((v, i) => {
        const h = (v / ymax) * (plano.y0 - plano.y1);
        ctx.fillStyle = i > 0 && v >= ys[i - 1] && proc !== 'racional' ? C.s8 : C.tinta;
        ctx.beginPath(); ctx.roundRect(plano.x0 + i * bw + 1, plano.y0 - h, Math.max(1, bw - 2), Math.max(1, h), [3, 3, 0, 0]); ctx.fill();
      });
      const sube = ys.some((v, i) => i > 0 && v > ys[i - 1]);
      const fin = proc === 'racional' ? 'no termina' : ys.length >= 60 ? 'sin terminar en 60 pasos' : 'termina';
      registro.textContent = `${PROC[proc].ayuda}.${proc === 'racional' ? ' Los racionales positivos no tienen mínimo: esta cadena puede seguir indefinidamente.' : ''}`;
      lectura.set([['pasos', String(ys.length - 1)], ['valor final', VIZ.fmt(ys[ys.length - 1])], ['¿sube alguna vez?', sube ? 'sí' : 'no'], ['resultado', fin]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const i = Math.floor((x - plano.x0) / ((plano.x1 - plano.x0) / ys.length));
      if (i < 0 || i >= ys.length) return tip.ocultar();
      tip.mostrar(x, y, `paso <b>${i}</b><br>medida <b>${VIZ.fmt(ys[i])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('well-ordering', {
    intro: String.raw`
      <p>El <strong>principio del buen orden</strong> afirma algo que parece obvio: si un conjunto de números naturales tiene al menos un elemento, entonces tiene un
      elemento <em>más pequeño</em>. Basta con bajar de uno en uno hasta que no se pueda más.</p>
      <p>Es obvio solo para los naturales. En los enteros hay subconjuntos que bajan para siempre, y en los racionales positivos también. Esa propiedad especial es la que
      garantiza que los algoritmos con una «medida que decrece» terminan, y es equivalente a la inducción.</p>`,
    visualizaciones: [
      {
        titulo: 'El mínimo de un subconjunto',
        descripcion: 'Cambie de subconjunto y de universo: en ℕ siempre aparece un mínimo (salvo en el vacío); en ℤ y en los racionales hay subconjuntos que no lo tienen.',
        montar: montarMinimo,
      },
      {
        titulo: 'Cadenas descendentes y terminación',
        descripcion: 'Si una medida natural baja en cada paso, el proceso termina. Pruebe Euclides con distintos \\(a, b\\) y compare con Collatz, que no garantiza descenso.',
        montar: montarDescenso,
      },
    ],
    teoria: String.raw`
      <h2>Enunciado</h2>
      <div class="recuadro"><strong>Principio del buen orden.</strong> Todo subconjunto no vacío \(A \subseteq \mathbb{N}\) tiene un mínimo: un \(m \in A\) con \(m \le a\) para todo \(a \in A\).</div>
      <p>Un orden con esta propiedad se llama <em>buen orden</em>. Equivale a decir que no existe una sucesión infinita estrictamente decreciente \(a_0 &gt; a_1 &gt; a_2 &gt; \cdots\) de naturales.</p>
      <h2>Por qué ℤ y ℚ⁺ no lo cumplen</h2>
      <p>En \(\mathbb{Z}\), el conjunto \(\{x : x &lt; 0\}\) no tiene mínimo porque \(-n-1 &lt; -n\). En \(\mathbb{Q}^{+}\), el conjunto \(\{x : x &gt; 0\}\) tampoco: \(x/2 &lt; x\).</p>
      <h2>Terminación de algoritmos</h2>
      <p>Para probar que un algoritmo termina se busca una <em>función de medida</em> \(\mu\) del estado a \(\mathbb{N}\) que decrece estrictamente en cada paso. En el algoritmo de Euclides,
      \(\mu(a,b) = b\) y \(a \bmod b &lt; b\); por buen orden, la cadena de valores se detiene, y se detiene en \(b = 0\). En Collatz no se conoce una medida así: es un problema abierto.</p>
      <h2>Equivalencia con la inducción</h2>
      <p>Si el buen orden vale y \(P(0)\), \(P(k) \Rightarrow P(k+1)\) se cumplen, el conjunto de contraejemplos \(\{n : \neg P(n)\}\) no puede tener mínimo \(m\):
      \(m \ne 0\) por el caso base y \(P(m-1)\) valdría por minimalidad, lo que implicaría \(P(m)\). Luego es vacío. El recíproco se prueba con
      <a href="tema.html?id=simple-vs-strong">inducción fuerte</a>.</p>`,
  });
})();
