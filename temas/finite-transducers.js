(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  // Transductor: estados, transiciones [q, entrada, salida, q'] y salida final por estado (se agrega al terminar).
  const TR = {
    incremento: {
      nombre: 'Incrementar un binario (bit menos significativo primero)', alf: ['0', '1'], palabra: '1011', det: true,
      nombres: ['llevo', 'sin'], ini: 0, fin: { 0: '1', 1: '' },
      t: [[0, '0', '1', 1], [0, '1', '0', 0], [1, '0', '0', 1], [1, '1', '1', 1]],
      pos: [[0, 0.5], [1, 0.5]], nota: 'Lee los bits desde el menos significativo; «llevo» propaga el acarreo. Si al terminar queda acarreo, escribe un 1 final.',
    },
    paridad: {
      nombre: 'Paridad acumulada de los unos', alf: ['0', '1'], palabra: '110101', det: true,
      nombres: ['par', 'impar'], ini: 0, fin: { 0: '', 1: '' },
      t: [[0, '0', '0', 0], [0, '1', '1', 1], [1, '0', '1', 1], [1, '1', '0', 0]],
      pos: [[0, 0.5], [1, 0.5]], nota: 'Tras cada símbolo escribe la paridad de los unos leídos hasta ese momento: un transductor que conserva la longitud.',
    },
    comprimir: {
      nombre: 'Comprimir «aa» en «A»', alf: ['a', 'b'], palabra: 'aaabaa', det: true,
      nombres: ['libre', 'una a'], ini: 0, fin: { 0: '', 1: 'a' },
      t: [[0, 'a', '', 1], [0, 'b', 'b', 0], [1, 'a', 'A', 0], [1, 'b', 'ab', 0]],
      pos: [[0, 0.5], [1, 0.5]], nota: 'Retiene una «a» pendiente: si llega otra escribe A; si llega b, suelta la a y la b. La salida puede ser más corta que la entrada.',
    },
    ambiguo: {
      nombre: 'No determinista: cada a se escribe x o y', alf: ['a', 'b'], palabra: 'aba', det: false,
      nombres: ['q'], ini: 0, fin: { 0: '' },
      t: [[0, 'a', 'x', 0], [0, 'a', 'y', 0], [0, 'b', 'b', 0]],
      pos: [[0.5, 0.5]], nota: 'Una misma entrada puede tener varias salidas: el transductor define una relación, no una función. Aquí hay 2^(cantidad de a) traducciones; la figura 1 sigue la primera alternativa y la 2 las lista todas.',
    },
  };
  const CLAVES = Object.keys(TR);

  function grafo(T) {
    return A.construir({ n: T.nombres.length, nombres: T.nombres, alf: [], ini: [T.ini], fin: [], trans: T.t.map(([q, a, o, p]) => [q, `${a}/${o || 'ε'}`, p]), pos: T.pos });
  }
  // Todas las salidas posibles (hasta un tope).
  function traducir(T, w, tope = 64) {
    let est = [{ q: T.ini, out: '' }];
    for (const c of w) {
      const sig = [];
      for (const e of est) for (const [q, a, o, p] of T.t) if (q === e.q && a === c) sig.push({ q: p, out: e.out + o });
      est = sig.slice(0, tope * 4);
      if (!est.length) break;
    }
    return est.map((e) => e.out + T.fin[e.q]).filter((s, i, a) => a.indexOf(s) === i).slice(0, tope);
  }
  const todas = (alf, max) => { const r = ['']; let niv = ['']; for (let l = 1; l <= max; l++) { const s = []; for (const w of niv) for (const c of alf) s.push(w + c); r.push(...s); niv = s; } return r; };

  /* ---------- Fig. 1: ejecutar un transductor ---------- */

  function montarEjecucion(cuerpo) {
    let k = 'incremento', palabra = TR[k].palabra, pos = 0, est = [], salida = '', ultimo = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Transductor', opciones: CLAVES.map((c) => [c, TR[c].nombre]), valor: k, alCambiar: (v) => { k = v; palabra = TR[k].palabra; campo.valor = palabra; nota.innerHTML = TR[k].nota; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'Entrada', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, ''); rep.reiniciar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, ''); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado actual' },
      { color: C.s2, texto: 'transición y salida recién escritas', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'símbolos de salida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const nota = VIZ.nota(cuerpo, TR[k].nota);

    function iniciar() {
      const T = TR[k], chars = [...palabra].filter((c) => T.alf.includes(c));
      pos = 0; salida = ''; ultimo = null; est = [T.ini];
      return (function* () {
        for (const c of chars) {
          const q = est[est.length - 1], tr = T.t.find((x) => x[0] === q && x[1] === c);
          if (!tr) { ultimo = { sin: true, c }; yield; return; }
          est.push(tr[3]); salida += tr[2]; pos++; ultimo = { tr, c };
          yield;
        }
        salida += T.fin[est[est.length - 1]]; pos++; ultimo = { fin: true };
        yield;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, T = TR[k], chars = [...palabra].filter((c) => T.alf.includes(c)), q = est[est.length - 1];
      lienzo.limpiar();
      const celda = Math.max(16, Math.min(28, Math.floor((W - 90) / Math.max(4, chars.length + 2)))), x0 = 70;
      const fila = (txt, y, etiqueta, relleno, borde, actual) => {
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(etiqueta, x0 - 8, y + celda / 2);
        [...txt].forEach((ch, i) => {
          const leida = actual == null || i < actual;
          ctx.fillStyle = relleno(i, leida); ctx.strokeStyle = borde(i, leida); ctx.lineWidth = actual === i ? 3 : 1.5;
          ctx.fillRect(x0 + i * celda, y, celda, celda); ctx.strokeRect(x0 + i * celda + 0.5, y + 0.5, celda - 1, celda - 1);
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(14, celda - 6), 600); ctx.textAlign = 'center'; ctx.fillText(ch, x0 + i * celda + celda / 2, y + celda / 2 + 0.5);
        });
      };
      fila(chars.join(''), 12, 'entrada', (i, l) => (l ? C.neutro : C.superficie), (i) => (i === pos ? C.s2 : C.rejilla), Math.min(pos, chars.length));
      fila(salida, 12 + celda + 14, 'salida', () => VIZ.alfa(C.s6, 0.28), () => C.s6, null);
      const idx = q;
      geo = A.dibujar(lienzo, grafo(T), {
        caja: { x: 0, y: 12 + celda * 2 + 36, w: W, h: lienzo.alto - 12 - celda * 2 - 36 }, maxEtiqueta: 14,
        nodo: (i) => (i === idx ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 3 } : null),
        arista: (de, a, sims) => (ultimo && ultimo.tr && ultimo.tr[0] === de && ultimo.tr[3] === a && sims.includes(`${ultimo.tr[1]}/${ultimo.tr[2] || 'ε'}`) ? { color: C.s2, ancho: 3 } : null),
      });
      const fin = ultimo && ultimo.fin;
      registro.textContent = !ultimo ? 'Pulse «Un paso»: en cada paso el transductor lee un símbolo y escribe una (posiblemente vacía) cadena de salida.'
        : ultimo.sin ? `No hay transición para «${ultimo.c}» desde ${T.nombres[q]}: se detiene sin producir salida completa.`
          : fin ? `Fin de la entrada: se agrega la salida final del estado ${T.nombres[q]} («${T.fin[q] || 'ε'}»). Resultado: «${salida || 'ε'}».`
            : `Lee «${ultimo.c}» en ${T.nombres[ultimo.tr[0]]}, escribe «${ultimo.tr[2] || 'ε'}» y pasa a ${T.nombres[ultimo.tr[3]]}.`;
      lectura.set([['entrada', chars.join('') || 'ε'], ['salida', salida || 'ε'], ['estado', T.nombres[q]], ['|entrada| → |salida|', `${chars.length} → ${salida.length}`]]);
    }
    lienzo.alDibujar = () => est.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la función completa ---------- */

  function montarTabla(cuerpo) {
    let k = 'incremento', n = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Transductor', opciones: CLAVES.map((c) => [c, TR[c].nombre]), valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud de la entrada', min: 0, max: 5, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una entrada de la longitud elegida y su(s) traducción(es). Observe si el transductor conserva la longitud, si es inyectivo y, en el no determinista, cuántas salidas tiene cada entrada.');
    function dibujar() {
      const T = TR[k], ws = todas(T.alf, n).filter((w) => w.length === n);
      const filas = ws.map((w) => ({ w, s: traducir(T, w) }));
      tabla.replaceChildren(VIZ.el('tr', null, ['Entrada', 'Salida(s)', 'Largo de salida'].map((t) => VIZ.el('th', null, t))),
        ...filas.slice(0, 32).map((f) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, f.w || 'ε'), VIZ.el('td', { class: 'izq' }, f.s.slice(0, 6).map((s) => s || 'ε').join(' · ') + (f.s.length > 6 ? ` … (${f.s.length})` : '')), VIZ.el('td', null, f.s.length ? [...new Set(f.s.map((s) => s.length))].join(', ') : '—'))));
      const salidas = filas.map((f) => f.s[0]).filter((s) => s !== undefined);
      const inyectivo = T.det && new Set(salidas).size === salidas.length;
      const mismoLargo = filas.every((f) => f.s.every((s) => s.length === n));
      registro.textContent = T.det ? `Función de entradas a salidas: ${mismoLargo ? 'conserva la longitud' : 'no conserva la longitud'}; ${inyectivo ? 'es inyectiva en esta longitud' : 'no es inyectiva (hay entradas distintas con la misma salida)'}.` : `Relación: una entrada puede tener varias salidas (aquí ${Math.max(...filas.map((f) => f.s.length))} como máximo).`;
      lectura.set([['entradas', String(ws.length)], ['determinista', T.det ? 'sí' : 'no'], ['conserva longitud', mismoLargo ? 'sí' : 'no'], ['inyectivo (esta longitud)', T.det ? (inyectivo ? 'sí' : 'no') : '—'], ['filas mostradas', String(Math.min(32, ws.length))]]);
    }
    dibujar();
  }

  VIZ.registrarTema('finite-transducers', {
    intro: String.raw`
      <p>Un autómata responde sí o no. Un <strong>transductor finito</strong> hace algo más útil: además de leer una palabra, <em>escribe</em> otra. Cada transición lleva una etiqueta «entrada / salida», y la traducción de la palabra es la concatenación de las salidas del camino.</p>
      <p>Con memoria finita se pueden sumar uno a un número binario, reemplazar símbolos, comprimir repeticiones o normalizar texto. Son la base de los analizadores morfológicos, de la normalización de texto y de buena parte de los circuitos secuenciales.</p>`,
    visualizaciones: [
      {
        titulo: 'Leer y escribir a la vez',
        descripcion: 'Ejecute un transductor paso a paso y mire cómo crece la cinta de salida. Pruebe «incrementar» con 111 (acarreo hasta el final) y «comprimir» con aaaa.',
        montar: montarEjecucion,
      },
      {
        titulo: 'La traducción de todas las entradas',
        descripcion: 'Tabla de entradas de una longitud y su salida. Compruebe qué transductores conservan la longitud, cuáles son inyectivos y cuándo una entrada tiene varias salidas.',
        montar: montarTabla,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un transductor finito es \(T = (Q, \Sigma, \Gamma, \delta, q_0, \omega)\) con alfabeto de entrada \(\Sigma\), de salida \(\Gamma\), transiciones \(\delta \subseteq Q \times \Sigma \times \Gamma^* \times Q\) y una <em>salida final</em> \(\omega : Q \to \Gamma^*\) (que se escribe al terminar). La traducción de \(w = a_1 \cdots a_n\) es \(y_1 \cdots y_n\,\omega(q_n)\) para un camino \(q_0 \xrightarrow{a_1/y_1} q_1 \cdots q_{n-1} \xrightarrow{a_n/y_n} q_n\).</p>
      <p>Así \(T\) define una <strong>relación</strong> \(R_T \subseteq \Sigma^* \times \Gamma^*\), llamada relación racional.</p>
      <h2>Variantes</h2>
      <table>
        <tr><th>Tipo</th><th>Característica</th></tr>
        <tr><td>Máquina de Mealy</td><td>salida de exactamente un símbolo por transición: conserva la longitud (tiempo real)</td></tr>
        <tr><td>Máquina de Moore</td><td>la salida depende solo del estado</td></tr>
        <tr><td>Transductor secuencial</td><td>determinista en la entrada: define una función; con salida final es «subsecuencial»</td></tr>
        <tr><td>Transductor no determinista</td><td>define una relación; puede dar varias salidas o ninguna</td></tr>
      </table>
      <h2>Propiedades</h2>
      <ul>
        <li>La imagen \(T(L)\) de un lenguaje regular y la imagen inversa \(T^{-1}(L')\) de un regular son regulares.</li>
        <li>La relación racional es cerrada bajo composición y unión, pero <strong>no</strong> bajo intersección. Equivalencia de dos transductores no deterministas es indecidible; para los secuenciales es decidible.</li>
        <li>Toda función racional es subsecuencial si y solo si cumple la <em>propiedad de los gemelos</em> (Choffrut).</li>
        <li>Un transductor puede ser mucho menos legible que el autómata sin salida: el análisis léxico (<a href="tema.html?id=lexical-analysis">Lexical Analysis &amp; Tokens</a>) es en esencia un transductor que traduce caracteres en tokens.</li>
      </ul>
      <div class="recuadro"><p><strong>Ejemplo: incremento binario.</strong> Con dos estados («llevo», «sin») y entrada con el bit menos significativo primero: \(\text{llevo} \xrightarrow{0/1} \text{sin}\), \(\text{llevo} \xrightarrow{1/0} \text{llevo}\), y en «sin» los bits se copian. Si termina en «llevo», \(\omega\) escribe un 1 final. Corre en tiempo lineal y memoria constante.</p></div>`,
  });
})();
