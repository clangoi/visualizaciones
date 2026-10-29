(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  const MODOS = { push: 'push: el que sabe, cuenta', pull: 'pull: cada uno pregunta', pushpull: 'push-pull: intercambian' };

  // Una ronda de anti-entropía: cada nodo contacta a otro al azar. Devuelve los contactos y el nuevo conjunto de actualizados.
  function ronda(sabe, modo, rnd) {
    const n = sabe.length, nuevo = sabe.slice(), contactos = [];
    for (let i = 0; i < n; i++) {
      let j = Math.floor(rnd() * (n - 1)); if (j >= i) j++;
      if (modo === 'push' && !sabe[i]) continue;
      contactos.push([i, j]);
      if ((modo === 'push' || modo === 'pushpull') && sabe[i]) nuevo[j] = true;
      if ((modo === 'pull' || modo === 'pushpull') && sabe[j]) nuevo[i] = true;
    }
    return { nuevo, contactos };
  }

  /* ---------- Fig. 1: rondas de chismes ---------- */

  function montarChismes(cuerpo) {
    const est = { n: 24, modo: 'push', semilla: 1 };
    let pasos, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Intercambio', valor: est.modo, opciones: Object.entries(MODOS), alCambiar: (v) => { est.modo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Réplicas', min: 8, max: 40, valor: est.n, alCambiar: (v) => { est.n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Otra ejecución', () => { est.semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(400, Math.max(300, w * 0.45)) });
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'aún con la versión vieja', forma: 'punto' }, { color: C.s1, texto: 'ya tiene la actualización', forma: 'punto' },
      { color: C.s2, texto: 'la recibió en esta ronda', forma: 'punto' }, { color: C.tenue, texto: 'contacto de esta ronda', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una escritura llega a una sola réplica (anillo). En cada ronda, cada réplica elige a otra al azar.');

    function iniciar() {
      const rnd = VIZ.semilla(est.semilla * 97 + est.n);
      let sabe = new Array(est.n).fill(false); sabe[0] = true;
      pasos = [{ sabe, contactos: [], mensajes: 0 }];
      let msgs = 0;
      for (let r = 0; r < 60 && sabe.some((x) => !x); r++) {
        const res = ronda(sabe, est.modo, rnd);
        msgs += res.contactos.length;
        pasos.push({ sabe: res.nuevo, previo: sabe, contactos: res.contactos, mensajes: msgs });
        sabe = res.nuevo;
      }
      k = 0;
      return (function* () { for (k = 1; k < pasos.length; k++) yield; k = pasos.length - 1; })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ps = pasos[k];
      pos = D.circulo(W, H, est.n, { margen: 24 });
      for (const [a, b] of ps.contactos) { ctx.strokeStyle = C.tenue; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y); ctx.lineTo(pos[b].x, pos[b].y); ctx.stroke(); }
      const r = est.n > 28 ? 7 : 9;
      ps.sabe.forEach((s, i) => {
        const nuevo = s && ps.previo && !ps.previo[i];
        if (i === 0) { ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, r + 4, 0, Math.PI * 2); ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.stroke(); }
        VIZ.marcador(ctx, pos[i].x, pos[i].y, nuevo ? C.s2 : s ? C.s1 : C.inactivo, r);
      });
      const n = ps.sabe.filter(Boolean).length;
      registro.textContent = k === 0 ? 'Solo una réplica tiene la escritura. Las demás devuelven el valor viejo a quien les lea: inconsistencia temporal.'
        : n === est.n ? `Tras ${k} rondas todas las réplicas tienen la escritura: convergieron. log₂ ${est.n} ≈ ${VIZ.fmt(Math.log2(est.n), 3)}.`
          : `Ronda ${k}: ${ps.sabe.filter((s, i) => s && !ps.previo[i]).length} réplicas se enteran; ya son ${n} de ${est.n}.`;
      lectura.set([
        ['ronda', String(k)],
        ['actualizadas', `${n} de ${est.n}`],
        ['mensajes', VIZ.entero(ps.mensajes)],
        ['log₂ n + ln n', VIZ.fmt(Math.log2(est.n) + Math.log(est.n), 3)],
      ]);
    }
    lienzo.alDibujar = () => pasos && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: rondas según n ---------- */

  function montarRondas(cuerpo) {
    let datos = null, plano = null, hover = null, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Repetir', () => { semilla++; medir(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['push', C.s1, 'push'], ['pull', C.s2, 'pull'], ['pushpull', C.s3, 'push-pull']];
    VIZ.leyenda(cuerpo, [...SER.map(([, c, t]) => ({ color: c, texto: t, forma: 'linea' })), { color: C.apagado, texto: 'log₂ n + ln n (push, teoría)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Promedio de 20 ejecuciones por punto, de 16 a 4 096 réplicas. Pase el cursor por el gráfico.');

    function medir() {
      const rnd = VIZ.semilla(semilla * 331);
      datos = [];
      for (let e = 4; e <= 12; e++) {
        const n = 2 ** e, fila = { e, n };
        for (const [modo] of SER) {
          let suma = 0;
          for (let r = 0; r < 20; r++) {
            let sabe = new Array(n).fill(false); sabe[0] = true;
            let rondas = 0;
            while (sabe.some((x) => !x) && rondas < 100) { sabe = ronda(sabe, modo, rnd).nuevo; rondas++; }
            suma += rondas;
          }
          fila[modo] = suma / 20;
        }
        datos.push(fila);
      }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 4, xmax: 12, ymin: 0, ymax: 24 }, { etiquetaX: 'réplicas n (escala log)', etiquetaY: 'rondas hasta que todas la tienen', formatoX: (v) => VIZ.entero(2 ** v), ticksX: [4, 6, 8, 10, 12] });
      plano.ejes();
      VIZ.trazar(ctx, plano, datos.map((d) => [d.e, d.e + Math.log(d.n)]), C.apagado, 1.5, [3, 4]);
      for (const [k, c] of SER) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.e, d[k]]), c, 2);
        for (const d of datos) VIZ.marcador(ctx, plano.sx(d.e), plano.sy(d[k]), c, hover === d ? 5.5 : 3.5);
      }
      const u = datos[datos.length - 1];
      lectura.set([['n', VIZ.entero(u.n)], ...SER.map(([k, , t]) => [t, `${VIZ.fmt(u[k], 3)} rondas`]), ['log₂ n + ln n', VIZ.fmt(u.e + Math.log(u.n), 3)]]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const e = Math.round(plano.ix(x));
      hover = datos.find((d) => d.e === e) || null; dibujar();
      if (hover) tip.mostrar(x, y, `n = <b>${VIZ.entero(hover.n)}</b>` + SER.map(([k, c, t]) => VIZ.filaTooltip(c, t, VIZ.fmt(hover[k], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
  }

  VIZ.registrarTema('eventual-consistency', {
    intro: String.raw`
      <p>Muchos sistemas replicados (DNS, almacenes como Dynamo o Cassandra, cachés de contenido) prefieren responder siempre y rápido, aunque a veces devuelvan un dato
      viejo. Su garantía es la <strong>consistencia eventual</strong>: si dejan de llegar escrituras, todas las réplicas terminan con el mismo valor. Mientras tanto, las
      escrituras se <strong>propagan</strong> en segundo plano.</p>
      <p>Una forma robusta de propagar es la <strong>anti-entropía epidémica</strong> o por <em>chismes</em> (<em>gossip</em>): periódicamente, cada réplica elige otra al azar e
      intercambian lo que saben. Sin coordinador ni topología fija, una actualización llega a todas en un número de rondas logarítmico en el número de réplicas, como una
      epidemia.</p>`,
    visualizaciones: [
      {
        titulo: 'Rondas de chismes',
        descripcion: 'Avance ronda a ronda. Con push el contagio es rápido al principio y lento al final (cuesta encontrar a los últimos); con pull es al revés; push-pull combina ambos.',
        montar: montarChismes,
      },
      {
        titulo: 'Rondas según el número de réplicas',
        descripcion: 'Duplicar las réplicas agrega apenas una ronda o poco más: el crecimiento es logarítmico.',
        montar: montarRondas,
      },
    ],
    teoria: String.raw`
      <h2>Consistencia eventual</h2>
      <p>Si después de cierto momento no hay escrituras nuevas, todas las réplicas llegan al mismo estado. No dice nada de cuándo ni de qué se lee mientras tanto; por eso se
      combina con las <a href="tema.html?id=client-centric-consistency">garantías de sesión</a> o se refuerza con <a href="tema.html?id=quorum-replication">quórums</a>.
      Para converger hacen falta dos cosas: <strong>propagar</strong> todas las escrituras a todas las réplicas y <strong>resolver</strong> las escrituras concurrentes de la misma manera en todas.</p>

      <h2>Propagación</h2>
      <table>
        <tr><th>Técnica</th><th>Idea</th></tr>
        <tr><td>Primaria–respaldo</td><td>Todas las escrituras pasan por una réplica primaria, que las reenvía (de forma síncrona o asíncrona)</td></tr>
        <tr><td>Push / pull</td><td>El que tiene novedades las envía, o cada réplica pregunta periódicamente</td></tr>
        <tr><td>Estado u operaciones</td><td>Se envía el valor final, o la operación para que cada réplica la reaplique</td></tr>
        <tr><td>Chismes</td><td>Intercambios con pares al azar (anti-entropía); los <em>rumores</em> dejan de difundirse cuando muchos contactos ya los conocían</td></tr>
      </table>

      <h2>Análisis del chisme</h2>
      <p>Con push, mientras pocos saben, la cantidad de informados casi se duplica en cada ronda: \(\log_2 n\) rondas para llegar a la mitad. Al final, un nodo no informado se
      salva de una ronda con probabilidad \((1 - 1/n)^{k} \approx e^{-k/n}\) si hay \(k\) informados, y hacen falta del orden de \(\ln n\) rondas más para alcanzar a todos:
      en total \(\log_2 n + \ln n + O(1)\) (Pittel, 1987). Con pull, la fracción de no informados \(p_i\) cae como \(p_{i+1} = p_i^2\) al final, doblemente exponencial: por eso
      push-pull termina en \(\log_3 n + O(\log\log n)\) rondas (Karp et al., 2000).</p>

      <h2>Resolver conflictos</h2>
      <ul>
        <li><strong>Última escritura gana</strong> (LWW) por marca de tiempo: simple, pero pierde escrituras concurrentes.</li>
        <li><strong>Vectores de versión</strong>: detectan escrituras concurrentes (vectores incomparables, como en los <a href="tema.html?id=vector-clocks">relojes vectoriales</a>) y guardan
        ambas versiones para que la aplicación las combine (el carrito de compras de Dynamo).</li>
        <li><strong>CRDT</strong> (tipos de datos replicados libres de conflictos): contadores, conjuntos y registros cuyas operaciones conmutan o cuyo estado forma un semirretículo; cualquier orden de
        mezcla da el mismo resultado, y la convergencia queda garantizada.</li>
      </ul>`,
  });
})();
