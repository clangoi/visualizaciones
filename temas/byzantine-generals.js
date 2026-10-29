(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const VAL = { A: { color: C.s2, nombre: 'atacar' }, R: { color: C.s1, nombre: 'retirarse' } };
  const nombre = (i) => (i === 0 ? 'C' : `T${i}`);

  // Un traidor dice «atacar» a unos y «retirarse» a otros (según la paridad del destinatario): la estrategia que más confunde.
  const mentira = (a) => (a % 2 === 0 ? 'A' : 'R');
  function mayoria(vals) {
    const a = vals.filter((v) => v === 'A').length;
    return a > vals.length - a ? 'A' : 'R'; // empate → retirarse (valor por defecto)
  }

  /* OM(m) de Lamport, Shostak y Pease. Registra los mensajes por ronda y devuelve la decisión de cada teniente. */
  function om(m, cmd, tenientes, v, traidores, ronda, msgs) {
    const recibido = {};
    for (const l of tenientes) {
      const val = traidores.has(cmd) ? mentira(l) : v;
      recibido[l] = val;
      msgs.push({ ronda, de: cmd, a: l, v: val });
    }
    if (m === 0) return { dec: recibido, vectores: null, recibido };
    const sub = {};
    for (const j of tenientes) sub[j] = om(m - 1, j, tenientes.filter((x) => x !== j), recibido[j], traidores, ronda + 1, msgs).dec;
    const dec = {}, vectores = {};
    for (const l of tenientes) {
      vectores[l] = tenientes.map((j) => (j === l ? recibido[l] : sub[j][l]));
      dec[l] = mayoria(vectores[l]);
    }
    return { dec, vectores, recibido };
  }

  function montar(cuerpo) {
    const est = { n: 4, m: 1, valor: 'A', traidores: new Set([3]) };
    let res, msgs, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Generales n', min: 3, max: 7, valor: est.n, alCambiar: (v) => { est.n = v; est.traidores = new Set([...est.traidores].filter((t) => t < v)); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Algoritmo', valor: '1', opciones: [['1', 'OM(1): tolera 1 traidor'], ['2', 'OM(2): tolera 2 traidores']], alCambiar: (v) => { est.m = +v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'El comandante ordena', valor: 'A', opciones: [['A', 'atacar'], ['R', 'retirarse']], alCambiar: (v) => { est.valor = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(440, Math.max(320, w * 0.5)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'atacar' },
      { color: C.s1, texto: 'retirarse' },
      { color: C.s8, texto: 'traidor', forma: 'punto' },
      { color: C.eje, texto: 'varios valores en un mismo enlace', forma: 'linea' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un general (también el comandante C) para volverlo traidor o leal. Cada ronda se muestra completa.');

    function iniciar() {
      msgs = [];
      const tenientes = Array.from({ length: est.n - 1 }, (_, i) => i + 1);
      res = om(est.m, 0, tenientes, est.valor, est.traidores, 1, msgs);
      k = 0;
      return (function* () { for (k = 1; k <= est.m + 2; k++) yield; k = est.m + 2; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      pos = D.circulo(W, H, est.n, { margen: 42 });
      const rr = 18;
      const ronda = Math.min(k, est.m + 1);
      // Mensajes de la ronda, agrupados por par.
      if (k >= 1 && k <= est.m + 1) {
        const pares = new Map();
        for (const x of msgs) if (x.ronda === ronda) {
          const c = `${x.de}-${x.a}`;
          if (!pares.has(c)) pares.set(c, { de: x.de, a: x.a, vals: [] });
          pares.get(c).vals.push(x.v);
        }
        for (const p of pares.values()) {
          const uno = p.vals.every((v) => v === p.vals[0]);
          D.mensaje(ctx, pos[p.de], pos[p.a], rr, {
            color: uno ? VAL[p.vals[0]].color : C.eje, ancho: uno ? 2 : 1.5, curva: 9,
            texto: p.vals.length > 1 ? `×${p.vals.length}` : null, colorTexto: C.tinta2, enMedio: 0.62,
          });
        }
      }
      const fin = k > est.m + 1;
      for (let i = 0; i < est.n; i++) {
        const traidor = est.traidores.has(i);
        const dec = i === 0 ? (traidor ? null : est.valor) : fin ? res.dec[i] : k >= 1 ? res.recibido[i] : null;
        D.nodo(ctx, pos[i].x, pos[i].y, nombre(i), {
          r: rr, relleno: dec ? VIZ.alfa(VAL[dec].color, i === 0 || fin ? 1 : 0.35) : C.superficie,
          texto: dec && (i === 0 || fin) ? C.sobre : C.tinta, anillo: traidor ? C.s8 : null, borde: traidor ? C.s8 : C.tinta,
        });
        const bajo = traidor ? 'traidor' : i === 0 ? 'comandante' : fin ? `decide ${VAL[res.dec[i]].nombre}` : '';
        if (bajo) D.etiqueta(ctx, bajo, pos[i].x, pos[i].y + rr + 14, { color: traidor ? C.s8 : C.tinta2, tam: 10 });
      }
      // Tabla de vectores.
      const tenientes = Array.from({ length: est.n - 1 }, (_, i) => i + 1);
      const celda = (v) => el('td', { style: { color: VAL[v].color, fontWeight: 600 } }, v === 'A' ? 'A' : 'R');
      const filas = tenientes.map((l) => el('tr', null,
        el('td', { class: 'izq' }, `${nombre(l)}${est.traidores.has(l) ? ' (traidor)' : ''}`),
        ...(fin || k >= est.m + 1 ? res.vectores[l].map(celda) : tenientes.map(() => el('td', { style: { color: C.apagado } }, '·'))),
        fin ? celda(res.dec[l]) : el('td', { style: { color: C.apagado } }, '·')));
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, el('th', { class: 'izq' }, 'teniente'), ...tenientes.map((j) => el('th', null, `v(${nombre(j)})`)), el('th', null, 'mayoría')), filas));
      const leales = tenientes.filter((l) => !est.traidores.has(l));
      const acuerdo = leales.every((l) => res.dec[l] === res.dec[leales[0]]);
      const validez = est.traidores.has(0) || leales.every((l) => res.dec[l] === est.valor);
      const t = est.traidores.size;
      const enRonda = msgs.filter((x) => x.ronda === ronda).length;
      if (k === 0) registro.textContent = `${t} traidor${t === 1 ? '' : 'es'} entre ${est.n} generales. OM(${est.m}) usa ${est.m + 1} rondas.`;
      else if (!fin) registro.textContent = ronda === 1
        ? `Ronda 1: el comandante envía su orden a los ${est.n - 1} tenientes${est.traidores.has(0) ? ', pero es traidor y manda órdenes contradictorias' : ''}.`
        : `Ronda ${ronda}: cada teniente reenvía a los demás lo que recibió en la ronda anterior (${enRonda} mensajes). Los traidores mienten.`;
      else registro.textContent = `${acuerdo ? 'Acuerdo' : 'Sin acuerdo'}: los tenientes leales decidieron ${[...new Set(leales.map((l) => VAL[res.dec[l]].nombre))].join(' y ')}. ` +
        (est.n > 3 * t ? (t <= est.m ? 'Con n > 3m y a lo más m traidores, OM(m) siempre funciona.' : `Hay más traidores que los ${est.m} que tolera OM(${est.m}).`)
          : `Con n = ${est.n} ≤ 3·${t}, ningún algoritmo puede garantizar el acuerdo.`);
      lectura.set([
        ['ronda', `${Math.min(k, est.m + 1)} de ${est.m + 1}`],
        ['mensajes', String(msgs.filter((x) => x.ronda <= Math.min(k, est.m + 1)).length)],
        ['acuerdo (IC1)', fin ? (acuerdo ? 'sí' : 'no') : '—'],
        ['validez (IC2)', fin ? (validez ? 'sí' : 'no') : '—'],
        ['n > 3·traidores', est.n > 3 * t ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 24);
      if (i < 0) return;
      if (est.traidores.has(i)) est.traidores.delete(i); else est.traidores.add(i);
      rep.reiniciar();
    });
    rep.reiniciar();
  }

  VIZ.registrarTema('byzantine-generals', {
    intro: String.raw`
      <p>Varios generales rodean una ciudad y deben ponerse de acuerdo, solo con mensajeros, en atacar o retirarse. Si atacan algunos y otros no,
      es un desastre. El problema: algunos generales son <strong>traidores</strong> y pueden mentir, decir cosas distintas a cada uno o no decir nada.
      Es la metáfora de Lamport, Shostak y Pease (1982) para las <strong>fallas bizantinas</strong>: procesos que se comportan de manera
      arbitraria, por errores de hardware, software corrupto o ataques.</p>
      <p>Un comandante envía una orden a sus tenientes. Se pide que (IC1) todos los leales decidan lo mismo y (IC2) si el comandante es leal,
      decidan su orden. El resultado sorprendente es que con mensajes orales esto es posible si y solo si los traidores son menos de un tercio.</p>`,
    visualizaciones: [
      {
        titulo: 'El algoritmo OM(m)',
        descripcion: 'Avance ronda a ronda y lea la tabla: cada teniente junta lo que le dijo el comandante y lo que cada otro teniente dice haber recibido, y toma la mayoría. Pruebe n = 3 con un traidor: no hay acuerdo posible. Con n = 4 sí.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Supuestos</h2>
      <ul>
        <li>Todo mensaje enviado se entrega correctamente, y el receptor sabe quién lo envió (mensajes «orales»).</li>
        <li>La ausencia de un mensaje se detecta (sistema síncrono) y se reemplaza por un valor por defecto, «retirarse».</li>
        <li>Hay \(n\) generales y a lo más \(m\) traidores, que pueden coludirse.</li>
      </ul>

      <h2>Algoritmo OM(m)</h2>
      <pre><code>OM(0):
    el comandante envía su valor a cada teniente
    cada teniente usa el valor recibido (o «retirarse» si no recibió nada)

OM(m), m &gt; 0:
    el comandante envía su valor a cada teniente;  sea vi lo que recibe el teniente i
    cada teniente i actúa como comandante en OM(m − 1) enviando vi a los otros n − 2
    el teniente i decide mayoría(vi, v1, …, vn−1), donde vj es lo que i obtuvo de OM(m − 1) con j como comandante</code></pre>

      <h2>Corrección</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Si \(n &gt; 3m\), OM(m) satisface IC1 e IC2 con a lo más \(m\) traidores.</p></div>
      <p><strong>Lema (validez).</strong> Si el comandante es leal, hay a lo más \(k\) traidores y \(n &gt; 2k + m\), OM(m) hace que todos los
      tenientes leales decidan el valor \(v\) del comandante. Por inducción en \(m\): para \(m = 0\) es inmediato. Para \(m &gt; 0\), cada teniente leal
      \(j\) recibe \(v\) y lo reenvía con OM(m − 1) entre \(n - 1 &gt; 2k + (m-1)\) generales, así que por hipótesis todos los leales obtienen
      \(v_j = v\). Como \(n - 1 &gt; 2k\), los tenientes leales son mayoría y la mayoría de cada vector es \(v\).</p>
      <p><strong>Acuerdo.</strong> Si el comandante es leal, sale del lema con \(k = m\), pues \(n &gt; 3m = 2k + m\). Si es traidor, quedan a lo más \(m-1\)
      traidores entre los tenientes y \(n - 1 &gt; 3(m-1)\); por inducción, OM(m − 1) da a todos los leales el mismo vector, y por lo tanto la misma mayoría.</p>

      <h2>Imposibilidad con un tercio</h2>
      <p>Con tres generales y un traidor no hay solución. Si el comandante dice «atacar» a T1 y T2 dice a T1 «el comandante me dijo retirarse», T1 no puede
      distinguir este escenario del escenario en que el comandante es leal pero T2 miente; en un caso debe decidir atacar (IC2) y en el otro, coincidir con T2.
      El argumento se generaliza agrupando generales: con \(n \le 3m\) no existe ningún algoritmo determinista (Pease, Shostak y Lamport, 1980).</p>

      <h2>Costo</h2>
      <p>OM(m) usa \(m + 1\) rondas, que es el mínimo posible (Fischer y Lynch, 1982), pero
      \[ (n-1) + (n-1)(n-2) + \dots + (n-1)(n-2)\cdots(n-m-1) = O(n^{m+1}) \]
      mensajes. Con <strong>mensajes firmados</strong> (un traidor no puede falsificar la firma de un leal), el algoritmo SM(m) funciona para cualquier
      número de traidores. El algoritmo <a href="tema.html?id=phase-king">Phase King</a> logra consenso con mensajes polinomiales. Los sistemas
      modernos (PBFT, Tendermint, HotStuff) usan \(n = 3f + 1\) réplicas y quórums de \(2f + 1\).</p>`,
  });
})();
