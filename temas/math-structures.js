(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: los naturales como conjuntos ---------- */

  const conj = (k) => (k === 0 ? '∅' : '{' + Array.from({ length: k }, (_, j) => conj(j)).join(', ') + '}');

  function montarVonNeumann(cuerpo) {
    let n = 5, sel = 4, nodos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Hasta el número', min: 2, max: 8, valor: n, alCambiar: (v) => { n = v; sel = Math.min(sel, n); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'elementos del número elegido (j ∈ k)', forma: 'linea' },
      { color: C.s2, texto: 'sucesor: S(k) = k ∪ {k}', forma: 'linea' },
      { color: C.s6, texto: 'número elegido', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un número para ver, como conjunto, quiénes son sus elementos. Cada número es el conjunto de todos los anteriores.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 28, dx = (W - 2 * x0) / n, y = 140;
      nodos = Array.from({ length: n + 1 }, (_, k) => ({ k, x: x0 + k * dx }));
      for (let j = 0; j < sel; j++) {
        const a = nodos[j].x, b = nodos[sel].x;
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a, y - 16); ctx.quadraticCurveTo((a + b) / 2, y - 16 - 14 * (sel - j) - 20, b, y - 16); ctx.stroke();
      }
      for (let k = 0; k < n; k++) D.flecha(ctx, nodos[k].x + 18, y + 26, nodos[k + 1].x - 18, y + 26, C.s2, 1.5);
      for (const o of nodos) {
        D.caja(ctx, o.x - 15, y - 15, 30, 30, String(o.k), { relleno: o.k === sel ? C.s6 : C.superficie, borde: o.k === sel ? C.s6 : o.k < sel ? C.s1 : C.eje, ancho: 2, tinta: o.k === sel ? C.sobre : C.tinta, radio: 15 });
        D.texto2(ctx, o.k === 0 ? '∅' : '', o.x, y + 46, { color: C.apagado, px: 11 });
      }
      registro.textContent = nodos.slice(0, Math.min(n, 5) + 1).map((o) => `${o.k} = ${conj(o.k)}`).join('\n') + (n > 5 ? '\n…' : '');
      lectura.set([['número elegido', String(sel)], ['|k| (cuántos elementos)', String(sel)], ['sus elementos', sel ? `0 … ${sel - 1}` : 'ninguno'], ['k ∈ m ⇔ k < m', 'por construcción']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x } = lienzo.posicion(ev);
      const o = nodos.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m));
      sel = o.k; dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: los enteros como parejas de naturales ---------- */

  function montarEnteros(cuerpo) {
    let P = [5, 2], Q = [1, 4], turno = 0, geo = null;
    const M = 8;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Restablecer', () => { P = [5, 2]; Q = [1, 4]; turno = 0; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'pareja P y su clase', forma: 'cuadro' },
      { color: C.s2, texto: 'pareja Q y su clase', forma: 'cuadro' },
      { color: C.s6, texto: 'P + Q = (a + c, b + d)', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una pareja (a, b) representa el entero a − b. Haga clic en dos puntos (el primero fija P, el segundo Q, y así alternando): todas las parejas de una misma diagonal son el mismo entero.');
    const ent = (p) => p[0] - p[1];
    const mm = (v) => String(v).replace('-', '−');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(W - 60, H - 50), cs = lado / (M + 1), ox = 40, oy = H - 34;
      geo = { cs, ox, oy };
      const X = (a) => ox + (a + 0.5) * cs, Y = (b) => oy - (b + 0.5) * cs;
      for (const [p, c] of [[P, C.s1], [Q, C.s2]]) {
        const d = ent(p);
        ctx.strokeStyle = VIZ.alfa(c, 0.5); ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(X(Math.max(d, 0)), Y(Math.max(-d, 0))); ctx.lineTo(X(Math.min(M, M + d)), Y(Math.min(M, M - d))); ctx.stroke();
      }
      for (let a = 0; a <= M; a++) for (let b = 0; b <= M; b++) {
        ctx.beginPath(); ctx.arc(X(a), Y(b), 3, 0, 7); ctx.fillStyle = C.inactivo; ctx.fill();
      }
      const S = [P[0] + Q[0], P[1] + Q[1]];
      for (const [p, c, t] of [[P, C.s1, 'P'], [Q, C.s2, 'Q'], [S, C.s6, 'P+Q']]) {
        if (p[0] > M || p[1] > M) continue;
        VIZ.marcador(ctx, X(p[0]), Y(p[1]), c, 6.5);
        D.texto2(ctx, t, X(p[0]) + 10, Y(p[1]) - 12, { alinea: 'left', color: c, px: 11, peso: 700 });
      }
      for (let i = 0; i <= M; i += 2) { D.texto2(ctx, String(i), X(i), oy + 16, { color: C.apagado, px: 10.5 }); D.texto2(ctx, String(i), ox - 12, Y(i), { color: C.apagado, px: 10.5 }); }
      D.texto2(ctx, 'a', X(M) + 14, oy + 16, { color: C.tinta2, px: 11 });
      D.texto2(ctx, 'b', ox - 12, Y(M) - 14, { color: C.tinta2, px: 11 });
      lectura.set([
        ['P', `(${P[0]}, ${P[1]}) = ${mm(ent(P))}`], ['Q', `(${Q[0]}, ${Q[1]}) = ${mm(ent(Q))}`],
        ['P + Q', `(${S[0]}, ${S[1]}) = ${mm(ent(S))}`], ['parejas de la clase de P', `${M + 1 - Math.abs(ent(P))} en la figura`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const celda = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const a = Math.round((x - geo.ox) / geo.cs - 0.5), b = Math.round((geo.oy - y) / geo.cs - 0.5);
      return a >= 0 && a <= M && b >= 0 && b <= M ? [a, b] : null;
    };
    lienzo.canvas.addEventListener('click', (ev) => {
      const c = celda(ev);
      if (!c) return;
      if (turno === 0) P = c; else Q = c;
      turno ^= 1; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const c = celda(ev);
      if (!c) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      tip.mostrar(x, y, `(${c[0]}, ${c[1]}) representa <b>${mm(ent(c))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('math-structures', {
    intro: String.raw`
      <p>En matemáticas casi todo se construye a partir de conjuntos. Los naturales son conjuntos (cada número es el conjunto de los anteriores), los enteros son parejas de naturales,
      los racionales son parejas de enteros, y así sucesivamente. No hace falta aceptar nada nuevo: solo se <em>define</em> cada estructura con las anteriores.</p>
      <p>Construir en vez de postular tiene una ventaja: cada propiedad de la nueva estructura se demuestra a partir de las anteriores, y la base de todo es el conjunto vacío.</p>`,
    visualizaciones: [
      {
        titulo: 'Los naturales como conjuntos',
        descripcion: 'Elija un número y vea que sus elementos son exactamente los números menores. Observe cómo el sucesor agrega al propio número como elemento.',
        montar: montarVonNeumann,
      },
      {
        titulo: 'Los enteros como parejas',
        descripcion: 'Marque dos parejas y sume sus componentes. Compruebe que parejas distintas de una misma diagonal producen el mismo resultado: la suma está bien definida.',
        montar: montarEnteros,
      },
    ],
    teoria: String.raw`
      <h2>Naturales de von Neumann</h2>
      \[ 0 = \varnothing, \qquad S(n) = n \cup \{n\}. \]
      <p>Así \(1 = \{\varnothing\}\), \(2 = \{\varnothing, \{\varnothing\}\}\), y en general \(n = \{0, 1, \dots, n-1\}\). Resultan tres coincidencias útiles: \(|n| = n\), \(m \in n \iff m &lt; n\) y
      \(m \subseteq n \iff m \le n\). Con esta definición se verifican los <a href="tema.html?id=peano-axioms">axiomas de Peano</a>.</p>
      <h2>Los enteros como clases de equivalencia</h2>
      <p>En \(\mathbb{N} \times \mathbb{N}\) se identifican dos parejas cuando representan la misma diferencia:</p>
      \[ (a, b) \sim (c, d) \iff a + d = b + c. \]
      <p>\(\mathbb{Z}\) es el conjunto de las clases \([(a,b)]\). Las operaciones se definen sobre representantes:</p>
      \[ [(a,b)] + [(c,d)] = [(a+c,\; b+d)], \qquad [(a,b)] \cdot [(c,d)] = [(ac+bd,\; ad+bc)]. \]
      <p>Hay que comprobar que el resultado <em>no depende del representante elegido</em> (bien definida): si \((a,b) \sim (a',b')\) entonces \((a+c, b+d) \sim (a'+c, b'+d)\), porque
      \((a+c) + (b'+d) = (b+d) + (a'+c)\) se obtiene sumando \(c+d\) a ambos lados de \(a + b' = b + a'\).</p>
      <h2>El patrón general</h2>
      <p>La misma idea —tomar pares y cocientar por una relación de equivalencia— da los racionales: \(\mathbb{Q} = (\mathbb{Z} \times (\mathbb{Z}\setminus\{0\}))/\!\sim\), con \((p,q) \sim (r,s) \iff ps = qr\).
      Los conjuntos y relaciones de la <a href="tema.html?id=sets-subsets">sección anterior</a> son suficientes para todo esto.</p>`,
  });
})();
