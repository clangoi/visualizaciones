(function () {
  'use strict';
  const { color: C } = VIZ;

  const colorClave = (v, K) => VIZ.css(VIZ.enRampa(0.15 + (0.8 * v) / Math.max(1, K - 1)));
  const textoSobre = (v, K) => ((0.15 + (0.8 * v) / Math.max(1, K - 1)) > 0.45 ? C.sobre : C.tinta);

  // Celda con valor; `marca` dibuja un borde naranjo grueso.
  function celda(ctx, x, y, w, h, texto, { fondo = C.superficie, tinta = C.tinta, marca = false, sub = null } = {}) {
    ctx.fillStyle = fondo;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = marca ? C.s2 : C.eje;
    ctx.lineWidth = marca ? 3 : 1;
    ctx.strokeRect(x + (marca ? 1.5 : 0.5), y + (marca ? 1.5 : 0.5), w - (marca ? 3 : 1), h - (marca ? 3 : 1));
    if (texto == null) return;
    ctx.fillStyle = tinta;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = VIZ.fuente(w > 30 ? 13 : 11, 500);
    ctx.fillText(texto, x + w / 2 - (sub ? 3 : 0), y + h / 2);
    if (sub) {
      ctx.font = VIZ.fuente(9);
      ctx.fillText(sub, x + w / 2 + 7, y + h / 2 + 5);
    }
  }

  /* ---------- Fig. 1: counting sort ---------- */

  function montarConteo(cuerpo) {
    let n = 14, K = 6, semilla = 2;
    let A = [], Cc = [], B = [], ev = {}, fase = '';

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Elementos n', min: 4, max: 20, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Claves 0..k−1, k =', min: 2, max: 10, valor: K, alCambiar: (v) => { K = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 250 });
    VIZ.leyenda(cuerpo, [
      { color: colorClave(0, 2), texto: 'clave pequeña' },
      { color: colorClave(1, 2), texto: 'clave grande' },
      { color: C.superficie, borde: C.s2, texto: 'posiciones involucradas en el paso actual' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    const nota = VIZ.nota(cuerpo, '');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 131 + n * 7 + K);
      const vistos = new Array(K).fill(0);
      A = Array.from({ length: n }, () => {
        const v = Math.floor(rnd() * K);
        return { v, tag: 'abcdefghijklmnopqrstuvwxyz'[vistos[v]++] };
      });
      Cc = new Array(K).fill(0);
      B = new Array(n).fill(null);
      ev = {};
      fase = 'inicio';
      return (function* () {
        fase = 'contar';
        for (let i = 0; i < n; i++) { Cc[A[i].v]++; ev = { a: i, c: A[i].v }; yield; }
        fase = 'acumular';
        for (let v = 1; v < K; v++) { Cc[v] += Cc[v - 1]; ev = { c: v, c2: v - 1 }; yield; }
        fase = 'colocar';
        for (let i = n - 1; i >= 0; i--) {
          const v = A[i].v;
          Cc[v]--;
          B[Cc[v]] = A[i];
          ev = { a: i, c: v, b: Cc[v] };
          yield;
        }
        fase = 'fin';
        ev = {};
      })();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 92;
      const w = Math.min(46, (W - izq - 10) / Math.max(n, K));
      const h = 34;
      const fila = (y, etiqueta, sub) => {
        ctx.fillStyle = C.tinta;
        ctx.font = VIZ.fuente(12, 500);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(etiqueta, 4, y + h / 2 - 6);
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(10);
        ctx.fillText(sub, 4, y + h / 2 + 8);
      };
      const indices = (y, m) => {
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(9);
        ctx.textAlign = 'center';
        for (let i = 0; i < m; i++) ctx.fillText(String(i), izq + i * w + w / 2, y + h + 9);
      };
      fila(10, 'A', 'entrada');
      A.forEach((x, i) => celda(ctx, izq + i * w, 10, w - 2, h, String(x.v), { fondo: colorClave(x.v, K), tinta: textoSobre(x.v, K), marca: ev.a === i, sub: x.tag }));
      indices(10, n);
      fila(92, 'C', fase === 'acumular' || fase === 'colocar' || fase === 'fin' ? 'posiciones' : 'conteos');
      Cc.forEach((c, v) => celda(ctx, izq + v * w, 92, w - 2, h, String(c), { marca: ev.c === v || ev.c2 === v }));
      ctx.fillStyle = C.apagado;
      ctx.font = VIZ.fuente(9);
      ctx.textAlign = 'center';
      for (let v = 0; v < K; v++) ctx.fillText(`clave ${v}`, izq + v * w + w / 2, 92 + h + 9);
      fila(174, 'B', 'salida');
      B.forEach((x, i) => celda(ctx, izq + i * w, 174, w - 2, h, x ? String(x.v) : null,
        x ? { fondo: colorClave(x.v, K), tinta: textoSobre(x.v, K), marca: ev.b === i, sub: x.tag } : { marca: ev.b === i }));
      indices(174, n);

      const textos = {
        inicio: 'Presione «Reproducir» o «Un paso».',
        contar: 'Fase 1 · contar: C[clave] cuenta cuántas veces aparece cada clave.',
        acumular: 'Fase 2 · sumas prefijo: C[v] ← C[v] + C[v−1]; ahora C[v] es la cantidad de elementos con clave ≤ v.',
        colocar: 'Fase 3 · colocar: recorriendo A de derecha a izquierda, cada elemento va a B[C[clave] − 1] y C[clave] disminuye. Recorrer hacia atrás preserva el orden de los iguales (las letras).',
        fin: 'Listo: B está ordenado y los elementos con la misma clave conservan su orden original (a, b, c…): el algoritmo es estable.',
      };
      nota.textContent = textos[fase] || '';
      lectura.set([['n', String(n)], ['k', String(K)], ['fase', fase], ['operaciones ≈ 2n + k', String(2 * n + K)]]);
    }
    lienzo.alDibujar = () => { if (A.length) dibujar(); };
    rep.reiniciar();
  }

  /* ---------- Fig. 2: radix sort LSD ---------- */

  function montarRadix(cuerpo) {
    let n = 12, d = 3, semilla = 5;
    let seq = [], baldes = [], pasada = 0, ev = {}, fase = '';
    const digito = (x, p) => Math.floor(x / 10 ** p) % 10;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Elementos n', min: 4, max: 16, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Dígitos d', min: 1, max: 4, valor: d, alCambiar: (v) => { d = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 330 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'dígito que se usa en la pasada actual' }, { color: C.superficie, borde: C.s1, texto: 'elemento que se está moviendo' }]);
    const lectura = VIZ.lectura(cuerpo);
    const nota = VIZ.nota(cuerpo, '');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 17 + n + d * 1000);
      seq = Array.from({ length: n }, () => Math.floor(rnd() * 10 ** d));
      baldes = Array.from({ length: 10 }, () => []);
      pasada = 0;
      ev = {};
      fase = 'inicio';
      return (function* () {
        for (pasada = 0; pasada < d; pasada++) {
          fase = 'distribuir';
          const resto = seq.slice();
          for (let i = 0; i < resto.length; i++) {
            const x = resto[i];
            baldes[digito(x, pasada)].push(x);
            seq = resto.slice(i + 1);
            ev = { balde: digito(x, pasada), x };
            yield;
          }
          fase = 'recolectar';
          seq = [].concat(...baldes);
          baldes = Array.from({ length: 10 }, () => []);
          ev = {};
          yield;
        }
        pasada = d - 1;
        fase = 'fin';
      })();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const w = Math.min(64, (W - 8) / 16);
      const numero = (x, cx, cy, resaltar) => {
        const s = String(x).padStart(d, '0');
        ctx.font = VIZ.fuente(w > 50 ? 13 : 11, 500);
        const cw = ctx.measureText('0').width;
        const x0 = cx - (cw * d) / 2;
        for (let k = 0; k < d; k++) {
          const p = d - 1 - k;
          ctx.fillStyle = p === pasada && fase !== 'fin' && fase !== 'inicio' ? C.s2 : p < pasada || fase === 'fin' ? C.tinta : C.apagado;
          ctx.textAlign = 'left';
          ctx.fillText(s[k], x0 + k * cw, cy);
        }
        if (resaltar) {
          ctx.strokeStyle = C.s1;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - w / 2 + 3, cy - 12, w - 6, 24);
        }
      };
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11);
      ctx.textAlign = 'left';
      ctx.fillText(fase === 'fin' ? 'resultado ordenado' : 'secuencia actual', 4, 12);
      const ox = (W - w * Math.max(seq.length, 1)) / 2;
      seq.forEach((x, i) => {
        ctx.strokeStyle = C.eje;
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + i * w + 2.5, 30.5, w - 5, 28);
        numero(x, ox + i * w + w / 2, 45, false);
      });
      // Baldes
      const bw = (W - 8) / 10;
      const yB = 92;
      for (let b = 0; b < 10; b++) {
        const x = 4 + b * bw;
        ctx.fillStyle = ev.balde === b ? VIZ.alfa(C.s2, 0.12) : C.neutro;
        ctx.fillRect(x + 2, yB, bw - 4, 210);
        ctx.fillStyle = C.tinta2;
        ctx.font = VIZ.fuente(11, 500);
        ctx.textAlign = 'center';
        ctx.fillText(String(b), x + bw / 2, yB + 214 + 8);
        baldes[b].forEach((v, k) => numero(v, x + bw / 2, yB + 14 + k * 24, ev.x === v && k === baldes[b].length - 1));
      }
      const textos = {
        inicio: 'Radix sort ordena por el dígito menos significativo primero, usando en cada pasada un ordenamiento estable (aquí, distribuir en 10 baldes).',
        distribuir: `Pasada ${pasada + 1}: cada número va al balde de su dígito de las ${['unidades', 'decenas', 'centenas', 'unidades de mil'][pasada]}, en el orden en que aparece.`,
        recolectar: 'Se recolectan los baldes del 0 al 9, respetando el orden dentro de cada uno.',
        fin: `Tras ${d} pasadas la secuencia está ordenada.`,
      };
      nota.textContent = textos[fase] || '';
      lectura.set([['n', String(n)], ['dígitos d', String(d)], ['pasada', fase === 'inicio' ? '—' : `${Math.min(pasada + 1, d)} de ${d}`], ['costo Θ(d(n + 10))', String(d * (n + 10))]]);
    }
    lienzo.alDibujar = () => { if (seq) dibujar(); };
    rep.reiniciar();
  }

  VIZ.registrarTema('linear-sorting', {
    intro: String.raw`
      <p>Ningún algoritmo que ordene <em>comparando</em> elementos puede bajar de \(\Omega(n\log n)\) comparaciones. Pero si las claves
      son enteros en un rango acotado, se puede ordenar <strong>sin comparar</strong>: usando las claves directamente como índices de
      un arreglo. Así se obtienen algoritmos de tiempo lineal como <strong>counting sort</strong>, <strong>radix sort</strong> y
      <strong>bucket sort</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Counting sort',
        descripcion: 'Las letras pequeñas distinguen elementos con la misma clave según su orden original. Observe que en la salida conservan ese orden.',
        montar: montarConteo,
      },
      {
        titulo: 'Radix sort (dígito menos significativo primero)',
        descripcion: 'En cada pasada los números se distribuyen en 10 baldes según un dígito y se recolectan en orden. Como cada pasada es estable, al terminar la última los números quedan ordenados.',
        montar: montarRadix,
      },
    ],
    teoria: String.raw`
      <h2>La cota que no aplica</h2>
      <p>La cota \(\Omega(n\log n)\) proviene de modelar el algoritmo como un árbol de decisión cuyas preguntas son comparaciones
      \(a_i \le a_j\), con \(n!\) hojas. Counting sort no hace esas preguntas: lee el valor de la clave y lo usa como dirección de
      memoria. Por eso no contradice la cota; opera en otro modelo de cómputo.</p>

      <h2>Counting sort</h2>
      <p>Para \(n\) claves enteras en \(\{0, \dots, k-1\}\):</p>
      <ol>
        <li>\(C[v] \leftarrow\) número de elementos con clave \(v\). Costo \(\Theta(n + k)\).</li>
        <li>Sumas prefijo: \(C[v] \leftarrow C[v] + C[v-1]\). Ahora \(C[v] = |\{i : a_i \le v\}|\). Costo \(\Theta(k)\).</li>
        <li>Para \(i = n-1, \dots, 0\): \(C[a_i] \leftarrow C[a_i] - 1\) y \(B[C[a_i]] \leftarrow a_i\). Costo \(\Theta(n)\).</li>
      </ol>
      \[ T(n, k) = \Theta(n + k). \]
      <p>Es lineal cuando \(k = O(n)\), pero no conviene si el rango es enorme (ordenar 10 números de 64 bits). Recorrer la entrada
      de derecha a izquierda en el paso 3 lo hace <strong>estable</strong>: elementos con la misma clave quedan en el mismo orden
      relativo que en la entrada. Usa \(\Theta(n + k)\) memoria extra.</p>

      <h2>Radix sort</h2>
      <p>Para claves de \(d\) dígitos en base \(b\), radix sort LSD aplica un ordenamiento estable por cada dígito, del menos al más
      significativo.</p>
      <p><strong>Corrección</strong> (por inducción en las pasadas): tras la pasada \(p\), la secuencia está ordenada según los \(p\)
      dígitos menos significativos. En la pasada \(p+1\), dos números con distinto dígito \(p+1\) quedan en el orden correcto por ese
      dígito; si tienen el mismo, la estabilidad conserva el orden previo, que es correcto por hipótesis inductiva.</p>
      <p>Con counting sort en cada pasada:</p>
      \[ T = \Theta\big(d\,(n + b)\big). \]
      <p>Para \(n\) enteros de \(w\) bits, agrupar los bits en dígitos de \(r\) bits da \(d = w/r\) pasadas en base \(b = 2^r\).
      Eligiendo \(r \approx \log_2 n\) se obtiene \(\Theta(wn/\log n)\): para \(w = O(\log n)\) (enteros acotados por un polinomio
      en \(n\)) el costo es \(\Theta(n)\).</p>

      <h2>Bucket sort</h2>
      <p>Si las claves son reales distribuidos uniformemente en \([0,1)\), se reparten en \(n\) baldes \([i/n, (i+1)/n)\), se ordena cada
      balde con inserción y se concatenan. Si \(n_i\) es el tamaño del balde \(i\), con \(n_i \sim \text{Binomial}(n, 1/n)\):</p>
      \[ \mathbb{E}\big[T\big] = \Theta(n) + \sum_{i=0}^{n-1} O\big(\mathbb{E}[n_i^2]\big) = \Theta(n) + n \cdot O\!\left(2 - \tfrac{1}{n}\right) = \Theta(n). \]
      <p>El tiempo lineal es <em>esperado</em> y depende de la hipótesis de uniformidad; en el peor caso todos caen en un balde.</p>`,
  });
})();
