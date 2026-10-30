(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: sumar y multiplicar con el sucesor ---------- */

  function montarOperacion(cuerpo) {
    let op = 'suma', a = 3, b = 4, pos = [], texto = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Operación', opciones: [['suma', 'suma: a + S(n) = S(a + n)'], ['prod', 'producto: a · S(n) = a · n + a']], valor: op, alCambiar: (v) => { op = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'a', min: 0, max: 6, valor: a, alCambiar: (v) => { a = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'b', min: 0, max: 6, valor: b, alCambiar: (v) => { b = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'valor actual', forma: 'cuadro' },
      { color: C.tinta, texto: 'valores ya calculados', forma: 'cuadro' },
      { color: C.s2, texto: 'salto del paso', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija a y b y pulse «Un paso»: cada paso aplica la ecuación recursiva una vez más. Todo se reduce a repetir el sucesor.');

    const N = () => Math.max(a + b, a * b, a, 1);
    function iniciar() {
      pos = [op === 'suma' ? a : 0];
      texto = op === 'suma' ? `${a} + 0 = ${a}` : `${a} · 0 = 0`;
      return (function* () {
        for (let j = 1; j <= b; j++) {
          if (op === 'suma') {
            texto += `\n${a} + ${j} = S(${a} + ${j - 1}) = S(${a + j - 1}) = ${a + j}`;
            pos.push(a + j);
          } else {
            texto += `\n${a} · ${j} = ${a} · ${j - 1} + ${a} = ${a * (j - 1)} + ${a} = ${a * j}`;
            pos.push(a * j);
          }
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const n = N() + 1, x0 = 10, cw = (W - 2 * x0) / n, y = 70;
      D.tira(ctx, x0, y, W - 2 * x0, n, (i) => ({
        fondo: i === pos[pos.length - 1] ? C.s1 : pos.includes(i) ? C.tinta : C.neutro,
        texto: n <= 40 && (cw >= 20 || i % 5 === 0) ? String(i) : null,
        tinta: pos.includes(i) ? C.sobre : C.tinta2,
      }), 28);
      for (let k = 1; k < pos.length; k++) {
        const x1 = x0 + (pos[k - 1] + 0.5) * cw, x2 = x0 + (pos[k] + 0.5) * cw;
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y - 2); ctx.quadraticCurveTo((x1 + x2) / 2, y - 40, x2, y - 2); ctx.stroke();
      }
      registro.textContent = texto;
      lectura.set([['a', String(a)], ['b', String(b)], ['valor actual', String(pos[pos.length - 1])], ['pasos hechos', `${pos.length - 1} de ${b}`]]);
    }
    lienzo.alDibujar = () => pos.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: ¿cumple los axiomas? ---------- */

  const AXIOMAS = [
    'Existe un elemento inicial 0',
    'Todo elemento tiene un sucesor S(n)',
    '0 no es sucesor de ningún elemento',
    'S es inyectiva: S(m) = S(n) implica m = n',
    'Inducción: el único conjunto que contiene a 0 y es cerrado bajo S es todo el universo',
  ];
  const linea = (n, y = 0.5) => Array.from({ length: n }, (_, i) => ({ id: i, t: String(i), x: (i + 0.5) / (n + 0.6), y }));
  const ESTR = {
    estandar: {
      nombre: 'ℕ estándar (se corta a la vista)', nodos: linea(6), cont: [5],
      ar: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]], ok: [1, 1, 1, 1, 1],
      motivo: 'Cumple los cinco axiomas: es el modelo que se quiere describir.',
    },
    ciclo: {
      nombre: 'Ciclo de 5 elementos (módulo 5)', nodos: linea(5), cont: [],
      ar: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0, -60]], ok: [1, 1, 0, 1, 1],
      motivo: 'S(4) = 0: el cero es sucesor de 4, así que falla el tercer axioma. Se vuelve al inicio y nunca se avanza.',
    },
    cola: {
      nombre: 'Cadena que vuelve sobre sí misma', nodos: linea(5), cont: [],
      ar: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 2, -60]], ok: [1, 1, 1, 0, 1],
      motivo: 'S(1) = 2 = S(4): dos elementos distintos con el mismo sucesor. Falla la inyectividad.',
    },
    copia: {
      nombre: 'ℕ más una cadena ajena', nodos: [...linea(4, 0.28), ...linea(4, 0.74).map((n) => ({ ...n, id: 10 + n.id, t: 'u' + n.id }))],
      cont: [3, 13], ini: [10],
      ar: [[0, 1], [1, 2], [2, 3], [10, 11], [11, 12], [12, 13]], ok: [1, 1, 1, 1, 0],
      motivo: 'Los axiomas 1 a 4 se cumplen, pero la cadena u no se alcanza desde 0: el conjunto {0, 1, 2, …} contiene a 0 y es cerrado bajo S sin ser todo. Falla la inducción.',
    },
    finita: {
      nombre: 'Cadena finita', nodos: linea(4), cont: [], sinSucesor: [3],
      ar: [[0, 1], [1, 2], [2, 3]], ok: [1, 0, 1, 1, 1],
      motivo: 'El último elemento no tiene sucesor: falla el segundo axioma (S no está definida en todo el universo).',
    },
  };

  function montarAxiomas(cuerpo) {
    let clave = 'estandar', alcanzados = new Set(), frontera = new Set(), terminado = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estructura candidata', opciones: Object.entries(ESTR).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 200 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'alcanzado desde 0 aplicando S', forma: 'punto' },
      { color: C.s2, texto: 'recién alcanzado', forma: 'punto' },
      { color: C.inactivo, texto: 'todavía no alcanzado', forma: 'punto' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Reproducir» para construir, desde 0, todo lo que se alcanza con el sucesor. El quinto axioma exige que no sobre nada.');

    function iniciar() {
      const E = ESTR[clave];
      alcanzados = new Set([0]); frontera = new Set([0]); terminado = false;
      return (function* () {
        yield;
        while (frontera.size) {
          const sig = new Set();
          for (const [u, v] of E.ar) if (frontera.has(u) && !alcanzados.has(v)) { alcanzados.add(v); sig.add(v); }
          frontera = sig;
          yield;
        }
        terminado = true;
      })();
    }
    function pos(E, n) {
      const { ancho: W, alto: H } = lienzo;
      return [28 + n.x * (W - 70), 24 + n.y * (H - 48)];
    }
    function dibujar() {
      const E = ESTR[clave], { ctx } = lienzo;
      lienzo.limpiar();
      const P = new Map(E.nodos.map((n) => [n.id, pos(E, n)]));
      for (const [u, v, curva = 0] of E.ar) {
        const [x1, y1] = P.get(u), [x2, y2] = P.get(v);
        const d = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / d, uy = (y2 - y1) / d;
        if (curva) {
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - curva;
          ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x1, y1 + 14); ctx.quadraticCurveTo(mx, my + 40, x2, y2 + 14); ctx.stroke();
          D.flecha(ctx, x2 + (x1 - x2) * 0.05, y2 + 24, x2, y2 + 15, C.tinta2);
        } else D.flecha(ctx, x1 + ux * 15, y1 + uy * 15, x2 - ux * 15, y2 - uy * 15, C.tinta2);
      }
      for (const id of E.cont) { const [x, y] = P.get(id); D.flecha(ctx, x + 15, y, x + 38, y, C.apagado, 1.5, [3, 3]); D.texto2(ctx, '…', x + 48, y, { color: C.apagado, px: 14 }); }
      for (const id of E.ini || []) { const [x, y] = P.get(id); D.flecha(ctx, x - 38, y, x - 15, y, C.apagado, 1.5, [3, 3]); D.texto2(ctx, '…', x - 48, y, { color: C.apagado, px: 14 }); }
      for (const id of E.sinSucesor || []) { const [x, y] = P.get(id); D.texto2(ctx, '✕', x + 30, y, { color: C.s8, px: 16, peso: 700 }); }
      for (const n of E.nodos) {
        const [x, y] = P.get(n.id);
        ctx.beginPath(); ctx.arc(x, y, 14, 0, 7);
        const al = alcanzados.has(n.id);
        ctx.fillStyle = frontera.has(n.id) ? C.s2 : al ? C.s1 : C.superficie; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = al ? (frontera.has(n.id) ? C.s2 : C.s1) : C.inactivo; ctx.stroke();
        D.texto2(ctx, n.t, x, y + 0.5, { color: al ? C.sobre : C.tinta2, px: 12, peso: 600 });
      }
      lista.replaceChildren(...AXIOMAS.map((t, i) => VIZ.el('div', { style: { color: E.ok[i] ? C.tinta : C.s8 } }, `${E.ok[i] ? '✓' : '✗'} ${i + 1}. ${t}`)));
      registro.textContent = terminado && E.nodos.some((n) => !alcanzados.has(n.id))
        ? `Quedaron sin alcanzar: ${E.nodos.filter((n) => !alcanzados.has(n.id)).map((n) => n.t).join(', ')}.\n${E.motivo}`
        : E.motivo;
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('peano-axioms', {
    intro: String.raw`
      <p>Los números naturales se pueden describir con muy pocas reglas. Se parte de un elemento inicial, el <strong>0</strong>, y de una única operación,
      el <strong>sucesor</strong> \(S\), que toma un número y da el siguiente. Todo natural es 0 con el sucesor aplicado cierta cantidad de veces:
      \(3 = S(S(S(0)))\).</p>
      <p>Las demás operaciones no se postulan: <em>se definen</em> repitiendo el sucesor. Sumar \(b\) es aplicar \(S\) \(b\) veces; multiplicar es sumar repetidamente.
      Esa definición recursiva es lo que permite después demostrar propiedades por inducción.</p>`,
    visualizaciones: [
      {
        titulo: 'Sumar y multiplicar con el sucesor',
        descripcion: 'Cada paso aplica una ecuación recursiva más. Compruebe que la suma avanza de uno en uno y que el producto avanza a saltos de \\(a\\).',
        montar: montarOperacion,
      },
      {
        titulo: '¿Cumple los axiomas de Peano?',
        descripcion: 'Elija una estructura y vea qué axiomas fallan. Reproduzca la construcción desde 0: lo que no se alcanza es la señal de que falla la inducción.',
        montar: montarAxiomas,
      },
    ],
    teoria: String.raw`
      <h2>Los axiomas</h2>
      <p>Una estructura \((N, 0, S)\), con \(0 \in N\) y \(S : N \to N\), es un modelo de los naturales si cumple:</p>
      <ol>
        <li>\(0 \in N\).</li>
        <li>Para todo \(n \in N\), \(S(n) \in N\).</li>
        <li>Para todo \(n\), \(S(n) \neq 0\).</li>
        <li>Si \(S(m) = S(n)\) entonces \(m = n\) (inyectividad).</li>
        <li><strong>Inducción:</strong> si \(A \subseteq N\), \(0 \in A\) y \(n \in A \Rightarrow S(n) \in A\), entonces \(A = N\).</li>
      </ol>
      <p>Los axiomas 3 y 4 impiden que la cadena se cierre en un ciclo o se junte consigo misma; el 5 impide que haya elementos «extra» no alcanzables desde 0.</p>
      <h2>Operaciones por recursión</h2>
      \[ a + 0 = a, \qquad a + S(n) = S(a + n) \]
      \[ a \cdot 0 = 0, \qquad a \cdot S(n) = a \cdot n + a \]
      <p>Con ellas se demuestra, por <a href="tema.html?id=simple-induction">inducción</a>, que la suma es asociativa y conmutativa, que \(0\) es neutro, etc. Por ejemplo,
      \(2 + 2 = 2 + S(S(0)) = S(2 + S(0)) = S(S(2 + 0)) = S(S(2)) = 4\).</p>
      <h2>Unicidad</h2>
      <p>Cualquier dos modelos de Peano (de segundo orden) son isomorfos: la correspondencia \(n \mapsto n\)-ésimo sucesor de 0 es biyectiva y respeta \(S\).
      Por eso se puede hablar de <em>los</em> naturales. Un modelo como «ℕ más una cadena ajena» solo satisface los cuatro primeros axiomas más una versión débil de inducción.</p>
      <p>La construcción con conjuntos de estos mismos números aparece en <a href="tema.html?id=math-structures">Building Mathematical Structures</a>.</p>`,
  });
})();
