(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const VAL = [C.s1, C.s2]; // 0 azul, 1 naranjo
  const P = (p) => `P${p + 1}`;

  // Los traidores intentan partir al grupo: dicen 0 a los procesos pares y 1 a los impares.
  const mentira = (destino) => destino % 2;

  /* Algoritmo Phase King (Berman, Garay y Perry): f + 1 fases de dos rondas; el rey de la fase k es el proceso k. */
  function simular(n, f, ini, traidores) {
    const leal = (p) => !traidores.has(p);
    const v = ini.slice();
    const pasos = [{ tipo: 'inicio', v: v.slice() }];
    for (let k = 0; k <= f; k++) {
      const maj = new Array(n).fill(null), mult = new Array(n).fill(null);
      for (let p = 0; p < n; p++) {
        if (!leal(p)) continue;
        let unos = 0;
        for (let q = 0; q < n; q++) unos += leal(q) ? v[q] : mentira(p);
        maj[p] = unos > n - unos ? 1 : 0;
        mult[p] = Math.max(unos, n - unos);
      }
      pasos.push({ tipo: 'r1', fase: k, v: v.slice(), maj, mult });
      const delRey = new Array(n).fill(null), guarda = new Array(n).fill(null);
      for (let p = 0; p < n; p++) {
        if (!leal(p)) continue;
        delRey[p] = leal(k) ? maj[k] : mentira(p);
        guarda[p] = mult[p] > n / 2 + f;
        v[p] = guarda[p] ? maj[p] : delRey[p];
      }
      pasos.push({ tipo: 'r2', fase: k, v: v.slice(), maj, mult, delRey, guarda });
    }
    pasos.push({ tipo: 'fin', v: v.slice() });
    return pasos;
  }

  function montar(cuerpo) {
    const est = { n: 9, f: 2, traidores: new Set([0, 4]), semilla: 3, modo: 'valor' };
    let ini = [], pasos, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Traidores tolerados f', min: 1, max: 3, valor: est.f, alCambiar: (v) => { est.f = v; ajustarN(); rep.reiniciar(); } });
    const rN = ctl.rango({ etiqueta: 'Procesos n', min: 5, max: 13, valor: est.n, alCambiar: (v) => { est.n = v; ajustarN(); nuevos(); } });
    ctl.selector({ etiqueta: 'Clic en un proceso', valor: est.modo, opciones: [['valor', 'cambia su valor inicial'], ['traidor', 'lo vuelve traidor o leal']], alCambiar: (v) => { est.modo = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });
    ctl.boton('Valores al azar', () => { est.semilla++; nuevos(); });
    function ajustarN() {
      if (est.n <= 4 * est.f) { est.n = 4 * est.f + 1; rN.valor = est.n; }
      est.traidores = new Set([...est.traidores].filter((t) => t < est.n));
    }

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(440, Math.max(320, w * 0.5)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'valor 0' }, { color: C.s2, texto: 'valor 1' },
      { color: C.s8, texto: 'traidor', forma: 'punto' }, { color: C.s7, texto: 'rey de la fase', forma: 'punto' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los traidores dicen 0 a unos y 1 a otros para dividir al grupo. La tabla muestra, por fase, la mayoría vista, su multiplicidad y el nuevo valor.');

    function nuevos() {
      const rnd = VIZ.semilla(est.semilla * 37 + est.n);
      ini = Array.from({ length: est.n }, () => (rnd() < 0.5 ? 1 : 0));
      rep.reiniciar();
    }

    function iniciar() {
      pasos = simular(est.n, est.f, ini, est.traidores);
      k = 0;
      return (function* () { for (k = 1; k < pasos.length; k++) yield; k = pasos.length - 1; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ps = pasos[k];
      pos = D.circulo(W, H, est.n, { margen: 42 });
      const rr = est.n > 10 ? 14 : 16;
      const rey = ps.fase != null ? ps.fase : -1;
      // Ronda 2: el rey envía su mayoría a todos. Ronda 1: se dibujan solo las mentiras de los traidores.
      if (ps.tipo === 'r2') {
        for (let p = 0; p < est.n; p++) if (p !== rey && ps.delRey[p] != null) D.mensaje(ctx, pos[rey], pos[p], rr, { color: VAL[ps.delRey[p]], ancho: 1.8 });
      } else if (ps.tipo === 'r1') {
        for (const t of est.traidores) for (let p = 0; p < est.n; p++) if (p !== t && !est.traidores.has(p)) D.mensaje(ctx, pos[t], pos[p], rr, { color: VIZ.alfa(VAL[mentira(p)], 0.7), ancho: 1.2, curva: 6 });
      }
      for (let p = 0; p < est.n; p++) {
        const traidor = est.traidores.has(p);
        const val = ps.v[p];
        D.nodo(ctx, pos[p].x, pos[p].y, P(p), {
          r: rr, tam: 11, relleno: traidor ? C.neutro : VAL[val], texto: traidor ? C.s8 : C.sobre,
          borde: traidor ? C.s8 : C.tinta, anillo: p === rey ? C.s7 : null,
        });
        let bajo = '';
        if (traidor) bajo = 'traidor';
        else if (ps.tipo === 'r1') bajo = `may ${ps.maj[p]} ×${ps.mult[p]}`;
        else if (ps.tipo === 'r2') bajo = ps.guarda[p] ? 'conserva' : 'sigue al rey';
        if (p === rey) bajo = (bajo ? bajo + ' · ' : '') + 'rey';
        if (bajo) D.etiqueta(ctx, bajo, pos[p].x, pos[p].y + rr + 12, { color: traidor ? C.s8 : p === rey ? C.s7 : C.tinta2, tam: 10 });
      }
      // Tabla por fase.
      const leales = Array.from({ length: est.n }, (_, p) => p).filter((p) => !est.traidores.has(p));
      const cab = [el('th', { class: 'izq' }, 'proceso'), el('th', null, 'inicial')];
      for (let f = 0; f <= est.f; f++) cab.push(el('th', null, `fase ${f + 1} (rey ${P(f)})`));
      const filas = leales.map((p) => {
        const celdas = [el('td', { class: 'izq' }, P(p)), el('td', { style: { color: VAL[ini[p]], fontWeight: 600 } }, String(ini[p]))];
        for (let f = 0; f <= est.f; f++) {
          const r2 = pasos.find((x) => x.tipo === 'r2' && x.fase === f);
          const idx = pasos.indexOf(r2);
          if (idx > k) { celdas.push(el('td', { style: { color: C.apagado } }, '·')); continue; }
          celdas.push(el('td', null, `${r2.maj[p]}×${r2.mult[p]} → `, el('b', { style: { color: VAL[r2.v[p]] } }, String(r2.v[p])), r2.guarda[p] ? '' : ' (rey)'));
        }
        return el('tr', null, celdas);
      });
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' }, el('tr', null, cab), filas));
      const vals = new Set(leales.map((p) => ps.v[p]));
      const umbral = est.n / 2 + est.f;
      registro.textContent = ps.tipo === 'inicio' ? `${est.n} procesos, ${est.traidores.size} traidor${est.traidores.size === 1 ? '' : 'es'}; se tolera f = ${est.f} porque n > 4f. Habrá ${est.f + 1} fases, con reyes ${Array.from({ length: est.f + 1 }, (_, i) => P(i)).join(', ')}.`
        : ps.tipo === 'r1' ? `Fase ${ps.fase + 1}, ronda 1: todos difunden su valor. Cada leal calcula la mayoría que ve y cuántas veces aparece.`
          : ps.tipo === 'r2' ? `Fase ${ps.fase + 1}, ronda 2: el rey ${P(rey)}${est.traidores.has(rey) ? ' (traidor) envía valores contradictorios' : ` envía su mayoría ${ps.delRey.find((x) => x != null)}`}. Quien vio su mayoría más de n/2 + f = ${VIZ.fmt(umbral)} veces la conserva; los demás adoptan el valor del rey.`
            : `Fin: los leales ${vals.size === 1 ? `deciden ${[...vals][0]}` : 'no coinciden'}.${est.traidores.size > est.f ? ` Hay ${est.traidores.size} traidores y el algoritmo solo tolera ${est.f}.` : ''}`;
      lectura.set([
        ['fase', ps.fase != null ? `${ps.fase + 1} de ${est.f + 1}` : ps.tipo === 'fin' ? 'terminado' : '—'],
        ['rey', rey >= 0 ? `${P(rey)}${est.traidores.has(rey) ? ' (traidor)' : ''}` : '—'],
        ['umbral n/2 + f', VIZ.fmt(umbral)],
        ['leales de acuerdo', vals.size === 1 ? 'sí' : 'no'],
        ['mensajes', VIZ.entero((est.f + 1) * (est.n * (est.n - 1) + est.n - 1))],
      ]);
    }
    lienzo.alDibujar = () => pasos && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 22);
      if (i < 0) return;
      if (est.modo === 'traidor') { if (est.traidores.has(i)) est.traidores.delete(i); else est.traidores.add(i); }
      else ini[i] = 1 - ini[i];
      rep.reiniciar();
    });
    nuevos();
  }

  VIZ.registrarTema('phase-king', {
    intro: String.raw`
      <p>El algoritmo de los <a href="tema.html?id=byzantine-generals">generales bizantinos</a> OM(m) envía una cantidad exponencial de mensajes.
      <strong>Phase King</strong> (Berman, Garay y Perry, 1989) resuelve el <strong>consenso bizantino</strong> binario con mensajes polinomiales,
      a cambio de pedir más procesos honestos: \(n &gt; 4f\) para tolerar \(f\) traidores.</p>
      <p>La idea es turnarse un líder, el <strong>rey</strong>. En cada fase todos votan, y quien ve una mayoría abrumadora la conserva; quien
      duda adopta lo que dice el rey. Con \(f + 1\) fases, al menos un rey es honesto, y basta un rey honesto para que todos los leales queden de
      acuerdo para siempre.</p>`,
    visualizaciones: [
      {
        titulo: 'Fases y reyes',
        descripcion: 'Avance ronda a ronda. Con el rey traidor de la primera fase, los leales pueden quedar divididos; observe la primera fase con rey leal: después de ella todos coinciden.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>v ← valor inicial (0 o 1)
para k ← 1 hasta f + 1:
    ronda 1:  difundir v;  recibir los n valores
              maj ← valor más frecuente;  mult ← su número de apariciones
    ronda 2:  si soy el proceso k (el rey): difundir maj
              si mult &gt; n/2 + f:  v ← maj
              si no:              v ← valor recibido del rey
decidir v</code></pre>
      <p>Usa \(2(f+1)\) rondas y \(O(f n^2)\) mensajes de un bit.</p>

      <h2>Corrección (con \(n &gt; 4f\))</h2>
      <p><strong>Persistencia.</strong> Si al empezar una fase todos los leales tienen el valor \(v\), cada leal recibe \(v\) al menos
      \(n - f\) veces, y \(n - f &gt; n/2 + f\) porque \(n &gt; 4f\). Todos conservan \(v\), diga lo que diga el rey.</p>
      <p><strong>Fase con rey leal.</strong> Sea \(k\) una fase cuyo rey es leal. Si ningún leal conserva su mayoría, todos adoptan el valor del rey y
      coinciden. Si un leal \(p\) conserva \(maj_p = v\), es porque vio \(v\) más de \(n/2 + f\) veces, de las cuales más de \(n/2\) vienen de leales.
      Entonces todo leal, incluido el rey, ve \(v\) más de \(n/2\) veces y tiene mayoría \(v\): los que conservan conservan \(v\), y los que siguen al rey
      reciben \(v\).</p>
      <div class="recuadro"><p>Como hay \(f + 1\) reyes distintos y a lo más \(f\) traidores, alguna fase tiene rey leal. Desde ella los leales coinciden y,
      por persistencia, siguen coincidiendo: <strong>acuerdo</strong>. Si todos los leales empiezan con el mismo valor, la persistencia lo conserva desde la
      primera fase: <strong>validez</strong>.</p></div>

      <h2>Comparación</h2>
      <table>
        <tr><th>Algoritmo</th><th>Procesos</th><th>Rondas</th><th>Mensajes</th></tr>
        <tr><td>OM(f)</td><td>\(n &gt; 3f\)</td><td>\(f+1\)</td><td>\(O(n^{f+1})\)</td></tr>
        <tr><td>Phase King</td><td>\(n &gt; 4f\)</td><td>\(2(f+1)\)</td><td>\(O(f n^2)\)</td></tr>
        <tr><td>Phase Queen</td><td>\(n &gt; 4f\)</td><td>\(2(f+1)\)</td><td>\(O(f n^2)\)</td></tr>
      </table>
      <p>La cota \(f + 1\) en el número de rondas es inevitable para algoritmos deterministas, incluso con solo fallas de caída. Con \(n &gt; 3f\) también
      existen algoritmos polinomiales, más complejos (Garay y Moses, 1993).</p>`,
  });
})();
