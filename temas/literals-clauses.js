(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: cláusulas sobre un cubo ---------- */

  const VARS = ['p', 'q', 'r'];

  function montarCubo(cuerpo) {
    let clausulas = [], sel = -1, vs = [], geo = null, error = '';
    const INI = 'p ∨ q; ¬p ∨ r; ¬q ∨ ¬r';
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { etiqueta: 'Cláusulas separadas por «;» (variables p, q, r)', valor: INI, simbolos: ['¬', '∨', ';'], alCambiar: () => leer() });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 90 + 1.5 * Math.min(150, (w - 150) / 1.6) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'modelo: satisface todas las cláusulas', forma: 'punto' },
      { color: C.inactivo, texto: 'descartada por alguna cláusula', forma: 'punto' },
      { color: C.s8, texto: 'arista que una cláusula falsifica', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada vértice del cubo es una valuación de p, q, r. Cada cláusula de dos literales descarta una arista (dos vértices): la que falsifica sus dos literales. Haga clic en un vértice para ver qué cláusulas lo descartan.');

    function leer() {
      const partes = campo.valor.split(';').map((s) => s.trim()).filter(Boolean);
      const nuevas = [];
      for (const t of partes) {
        const r = D.analizar(t);
        if (r.error) { error = `Cláusula «${t}»: ${r.error}.`; return dibujar(); }
        if (D.vars(r.ast).some((v) => !VARS.includes(v))) { error = `Use solo las variables p, q, r (en «${t}»).`; return dibujar(); }
        nuevas.push({ txt: D.texto(r.ast), ast: r.ast });
      }
      clausulas = nuevas; error = ''; dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      vs = D.valuaciones(VARS);
      const s = Math.min(150, (W - 150) / 1.6), x0 = (W - s * 1.5) / 2, y0 = 40, off = s * 0.5;
      const pos = (v) => [x0 + (v.q ? 0 : s) + (v.r ? 0 : off), y0 + (v.p ? 0 : s) + (v.r ? off : 0)];
      const viola = vs.map((v) => clausulas.map((c, i) => (D.evalua(c.ast, v) ? -1 : i)).filter((i) => i >= 0));
      const idx = (v) => vs.indexOf(v);
      geo = vs.map((v) => ({ v, xy: pos(v) }));
      for (const a of vs) for (const b of vs) {
        if (idx(a) >= idx(b)) continue;
        const dif = VARS.filter((x) => a[x] !== b[x]);
        if (dif.length !== 1) continue;
        const falsa = clausulas.some((c, i) => viola[idx(a)].includes(i) && viola[idx(b)].includes(i));
        ctx.strokeStyle = falsa ? C.s8 : C.tenue; ctx.lineWidth = falsa ? 3.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(...pos(a)); ctx.lineTo(...pos(b)); ctx.stroke();
      }
      geo.forEach(({ v, xy }, i) => {
        const modelo = viola[i].length === 0;
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 13, 0, 7); ctx.fillStyle = modelo ? C.s6 : C.inactivo; ctx.fill();
        if (i === sel) { ctx.lineWidth = 3; ctx.strokeStyle = C.s2; ctx.stroke(); }
        D.texto2(ctx, VARS.map((x) => (v[x] ? 'V' : 'F')).join(''), xy[0], xy[1] + 28, { px: 11, color: C.tinta2 });
      });
      const nm = viola.filter((x) => !x.length).length;
      registro.textContent = error || (sel >= 0 ? (viola[sel].length ? `${D.valTexto(vs[sel], VARS)} falsifica: ${viola[sel].map((i) => `{${clausulas[i].txt.replace(/ ∨ /g, ', ')}}`).join(' y ')}.` : `${D.valTexto(vs[sel], VARS)} es un modelo: hace verdaderas las ${clausulas.length} cláusulas.`) : 'Haga clic en un vértice.');
      lectura.set([['cláusulas', String(clausulas.length)], ['modelos', `${nm} de 8`], ['formato conjunto', clausulas.length ? '{' + clausulas.map((c) => `{${c.txt.replace(/ ∨ /g, ', ')}}`).join(', ') + '}' : '∅']]);
    }
    lienzo.alDibujar = () => clausulas.length >= 0 && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = geo.findIndex((g) => Math.hypot(g.xy[0] - x, g.xy[1] - y) <= 16);
      sel = i; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.hypot(q.xy[0] - x, q.xy[1] - y) <= 16);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, D.valTexto(g.v, VARS));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    leer();
  }

  /* ---------- Fig. 2: cada cláusula descarta una región ---------- */

  function montarEncogimiento(cuerpo) {
    let n = 8, semilla = 1, ys = [], pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variables n', min: 4, max: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.boton('Nuevo muestreo', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'modelos que sobreviven (contados)', forma: 'linea' }, { color: C.apagado, texto: 'esperado: 2ⁿ·(7/8)ᵐ', forma: 'linea' }, { color: C.s8, texto: 'primer m sin modelos', forma: 'punto' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada cláusula de 3 literales deja sin modelo a 1/8 de las asignaciones: se descartan las que falsifican los tres literales. Al agregar cláusulas al azar, la nube de modelos se achica geométricamente hasta desaparecer.');

    function calcular() {
      const rnd = VIZ.semilla(semilla * 131 + n), N = 1 << n, vivo = new Uint8Array(N).fill(1);
      ys = [N];
      for (let m = 1; m <= 6 * n; m++) {
        const vs = new Set();
        while (vs.size < 3) vs.add(Math.floor(rnd() * n));
        const lit = [...vs].map((v) => [v, rnd() < 0.5]);
        let cuenta = 0;
        for (let a = 0; a < N; a++) {
          if (vivo[a] && lit.every(([v, pos]) => (((a >> v) & 1) === 1) === !pos)) vivo[a] = 0;
          cuenta += vivo[a];
        }
        ys.push(cuenta);
      }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const N = 1 << n, M = ys.length - 1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: M, ymin: 0.5, ymax: N * 1.3 }, { logY: true, etiquetaX: 'cláusulas añadidas m', etiquetaY: 'modelos' });
      pl.ejes();
      VIZ.trazar(ctx, pl, ys.map((_, m) => [m, N * (7 / 8) ** m]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, ys.map((y, m) => [m, Math.max(y, 0.5)]), C.s1, 2);
      const m0 = ys.findIndex((y) => y === 0);
      if (m0 >= 0) { VIZ.marcador(ctx, pl.sx(m0), pl.sy(0.5), C.s8, 5); D.texto2(ctx, 'sin modelos', pl.sx(m0) + 8, pl.sy(0.5) - 12, { alinea: 'left', color: C.s8, px: 11, peso: 600 }); }
      lectura.set([['asignaciones', String(N)], ['cláusulas hasta quedar sin modelos', m0 < 0 ? `más de ${M}` : String(m0)], ['razón m/n en ese punto', m0 < 0 ? '—' : VIZ.fmt(m0 / n, 3)], ['modelos tras 3n cláusulas', String(ys[Math.min(M, 3 * n)])]]);
    }
    lienzo.alDibujar = () => ys.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const m = Math.max(0, Math.min(ys.length - 1, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `m = <b>${m}</b> cláusulas<br>modelos <b>${ys[m]}</b><br>esperado <b>${VIZ.fmt((1 << n) * (7 / 8) ** m, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('literals-clauses', {
    intro: String.raw`
      <p>Casi todos los programas que resuelven SAT trabajan con fórmulas de una forma muy regular. Un <strong>literal</strong> es una variable o su negación (\(p\), \(\neg p\)); una <strong>cláusula</strong> es una disyunción de literales
      (\(p \lor \neg q \lor r\)); y una fórmula en <strong>forma normal conjuntiva</strong> (CNF) es una conjunción de cláusulas.</p>
      <p>Pensar en cláusulas ayuda a ver el espacio de soluciones: cada una <em>prohíbe</em> una región de valuaciones —las que falsifican todos sus literales—, y las soluciones son las que sobreviven a todas las prohibiciones.</p>`,
    visualizaciones: [
      {
        titulo: 'Cláusulas sobre un cubo',
        descripcion: 'Con tres variables, las 8 valuaciones son los vértices de un cubo. Escriba cláusulas y vea qué aristas se prohíben y qué vértices quedan como modelos.',
        montar: montarCubo,
      },
      {
        titulo: 'Cada cláusula descarta una región',
        descripcion: 'Agregue cláusulas aleatorias de tres literales y vea cómo el número de modelos cae casi exponencialmente, hasta que no queda ninguno.',
        montar: montarEncogimiento,
      },
    ],
    teoria: String.raw`
      <h2>Notación</h2>
      <table>
        <tr><th>Objeto</th><th>Definición</th><th>Ejemplo</th></tr>
        <tr><td>Literal</td><td>\(p\) o \(\neg p\)</td><td>\(\neg q\)</td></tr>
        <tr><td>Cláusula</td><td>disyunción de literales; se escribe como conjunto</td><td>\(\{p, \neg q, r\}\)</td></tr>
        <tr><td>Cláusula vacía</td><td>\(\Box\): no tiene ningún literal, es insatisfacible</td><td>\(\{\}\)</td></tr>
        <tr><td>CNF</td><td>conjunción de cláusulas; se escribe como conjunto de conjuntos</td><td>\(\{\{p,q\},\{\neg p, r\}\}\)</td></tr>
      </table>
      <h2>Qué descarta una cláusula</h2>
      <p>Una cláusula con \(k\) literales sobre \(n\) variables tiene exactamente una asignación de los \(k\) literales que la falsifica; de las \(2^n\) valuaciones, falsifica \(2^{n-k}\) y satisface \(2^n - 2^{n-k}\). Una cláusula de 3 literales deja sin modelo a \(1/8\) del espacio.
      Para cláusulas «independientes» el número esperado de modelos de \(m\) cláusulas es \(2^n\,(7/8)^m\), que llega a 1 cuando \(m \approx 5{,}19\,n\); la transición real se da antes, en \(m \approx 4{,}27\,n\) (ver <a href="tema.html?id=satisfiability">Satisfiability</a>).</p>
      <h2>Por qué CNF</h2>
      <ul>
        <li>Toda fórmula es equivalente a una CNF (ver <a href="tema.html?id=cnf-dnf">CNF &amp; DNF Transformation</a>).</li>
        <li>Una CNF es verdadera si cada cláusula tiene algún literal verdadero: una condición local, fácil de propagar.</li>
        <li>La regla de <a href="tema.html?id=resolution-rule">resolución</a> opera directamente sobre cláusulas.</li>
      </ul>`,
  });
})();
