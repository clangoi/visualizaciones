(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const F = (i) => `F${i + 1}`;

  const ESTRATEGIAS = {
    ingenua: 'Ingenua: izquierdo y luego derecho',
    jerarquia: 'Jerarquía: primero el de menor número',
    camarero: 'Camarero: a lo más n − 1 en la mesa',
  };
  const COMER = 2;

  /* Filósofo i usa los tenedores i (izquierdo) y (i + 1) mod n (derecho).
     Estado por filósofo: 'piensa' | 'hambre' | 'come'; dueno[t] = filósofo que tiene el tenedor t, o −1. */
  function crearEstado(n, rnd, sincronizado) {
    return {
      n, t: 0, dueno: new Array(n).fill(-1),
      fil: Array.from({ length: n }, () => ({ estado: sincronizado ? 'hambre' : 'piensa', resta: sincronizado ? 0 : 1 + Math.floor(rnd() * 4), comidas: 0, sentado: false })),
      bloqueo: null, notas: [],
    };
  }

  const tenedores = (s, i, estr) => {
    const izq = i, der = (i + 1) % s.n;
    return estr === 'jerarquia' ? [Math.min(izq, der), Math.max(izq, der)] : [izq, der];
  };

  function paso(s, estr, rnd, sincronizado) {
    s.t++;
    s.notas = [];
    const n = s.n;
    const orden = Array.from({ length: n }, (_, i) => i);
    if (!(sincronizado && s.t === 1)) for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
    for (const i of orden) {
      const f = s.fil[i];
      if (f.estado === 'piensa') {
        if (--f.resta <= 0) { f.estado = 'hambre'; s.notas.push(`${F(i)} tiene hambre`); }
      } else if (f.estado === 'come') {
        if (--f.resta <= 0) {
          for (const t of tenedores(s, i, estr)) s.dueno[t] = -1;
          f.estado = 'piensa'; f.resta = 1 + Math.floor(rnd() * 4); f.sentado = false;
          s.notas.push(`${F(i)} termina y suelta los tenedores`);
        }
      } else {
        if (estr === 'camarero' && !f.sentado) {
          if (s.fil.filter((x) => x.sentado).length >= n - 1) continue;
          f.sentado = true;
        }
        const [a, b] = tenedores(s, i, estr);
        if (s.dueno[a] === -1) { s.dueno[a] = i; s.notas.push(`${F(i)} toma T${a + 1}`); }
        else if (s.dueno[a] === i && s.dueno[b] === -1) {
          s.dueno[b] = i; f.estado = 'come'; f.resta = COMER; f.comidas++;
          s.notas.push(`${F(i)} toma T${b + 1} y come`);
        }
      }
    }
    // Interbloqueo: todos con hambre, cada uno con un tenedor y esperando el otro, que tiene alguien más.
    const esperando = s.fil.map((f, i) => {
      if (f.estado !== 'hambre') return -1;
      const [a, b] = tenedores(s, i, estr);
      const falta = s.dueno[a] === i ? b : a;
      return s.dueno[falta] >= 0 && s.dueno[falta] !== i ? s.dueno[falta] : -1;
    });
    // Busca un ciclo en el grafo de espera.
    for (let i0 = 0; i0 < n && !s.bloqueo; i0++) {
      const visto = new Map();
      let i = i0, k = 0;
      while (i >= 0 && !visto.has(i)) { visto.set(i, k++); i = esperando[i]; }
      if (i >= 0) {
        const ciclo = [];
        let j = i;
        do { ciclo.push(j); j = esperando[j]; } while (j !== i);
        s.bloqueo = { ciclo, esperando };
      }
    }
    return s;
  }

  /* ---------- Fig. 1: la mesa ---------- */

  function montarMesa(cuerpo) {
    const est = { n: 5, estr: 'ingenua', semilla: 2, sincronizado: true };
    let s, rnd;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', valor: est.estr, opciones: Object.entries(ESTRATEGIAS), alCambiar: (v) => { est.estr = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Filósofos', min: 3, max: 8, valor: est.n, alCambiar: (v) => { est.n = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Todos con hambre a la vez', valor: est.sincronizado, alCambiar: (v) => { est.sincronizado = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Otra ejecución', () => { est.semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(430, Math.max(320, w * 0.48)) });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta, texto: 'pensando' },
      { color: C.s4, texto: 'con hambre' },
      { color: C.s6, texto: 'comiendo' },
      { color: C.tinta, texto: 'tenedor tomado', forma: 'linea' },
      { color: C.s8, texto: 'espera circular (interbloqueo)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada filósofo necesita los dos tenedores vecinos para comer y los toma de a uno. Con la estrategia ingenua y todos con hambre a la vez, observe el primer paso.');

    function iniciar() {
      rnd = VIZ.semilla(est.semilla * 97 + est.n);
      s = crearEstado(est.n, rnd, est.sincronizado);
      return (function* () {
        for (let g = 0; g < 400; g++) { paso(s, est.estr, rnd, est.sincronizado); yield; if (s.bloqueo) return; }
      })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 44, n = est.n;
      ctx.fillStyle = C.neutro; ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2); ctx.fill();
      const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
      const pos = Array.from({ length: n }, (_, i) => ({ x: cx + R * Math.cos(ang(i)), y: cy + R * Math.sin(ang(i)) }));
      // Tenedores: el tenedor t está entre el filósofo t − 1 y el t (es el izquierdo de t y el derecho de t − 1).
      for (let t = 0; t < n; t++) {
        const d = s.dueno[t];
        let a = ang(t) - Math.PI / n, rr = R * 0.5;
        if (d >= 0) { a = ang(d) + (d === t ? -0.22 : 0.22) * (5 / n); rr = R * 0.72; }
        const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a), L = 15;
        ctx.strokeStyle = d >= 0 ? C.tinta : C.apagado; ctx.lineWidth = d >= 0 ? 3 : 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - L * Math.cos(a) / 2, y - L * Math.sin(a) / 2); ctx.lineTo(x + L * Math.cos(a) / 2, y + L * Math.sin(a) / 2); ctx.stroke();
        ctx.font = VIZ.fuente(9); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`T${t + 1}`, cx + (rr - 16) * Math.cos(a), cy + (rr - 16) * Math.sin(a));
      }
      if (s.bloqueo) for (const i of s.bloqueo.ciclo) D.mensaje(ctx, pos[i], pos[s.bloqueo.esperando[i]], 20, { color: C.s8, ancho: 2.5, curva: -14 });
      s.fil.forEach((f, i) => {
        D.nodo(ctx, pos[i].x, pos[i].y, F(i), {
          r: 19, relleno: f.estado === 'come' ? C.s6 : f.estado === 'hambre' ? C.s4 : C.superficie, texto: f.estado === 'come' ? C.sobre : C.tinta,
          anillo: s.bloqueo && s.bloqueo.ciclo.includes(i) ? C.s8 : est.estr === 'camarero' && f.sentado && f.estado === 'hambre' ? C.s1 : null,
        });
        D.etiqueta(ctx, `${f.comidas} comida${f.comidas === 1 ? '' : 's'}`, pos[i].x, pos[i].y + (Math.sin(ang(i)) < -0.5 ? -33 : 33), { color: C.tinta2, tam: 10 });
      });
      const total = s.fil.reduce((a, f) => a + f.comidas, 0);
      const com = s.fil.map((f) => f.comidas);
      registro.textContent = s.t === 0 ? 'Todos piensan. Avance paso a paso.'
        : s.bloqueo ? `Paso ${s.t}: interbloqueo. ${s.bloqueo.ciclo.map(F).join(' → ')} → ${F(s.bloqueo.ciclo[0])}: cada uno tiene un tenedor y espera el que tiene el siguiente. Nadie volverá a comer.`
          : `Paso ${s.t}: ${s.notas.length ? s.notas.join('; ') + '.' : 'nadie cambia de estado.'}`;
      lectura.set([
        ['paso', String(s.t)],
        ['comidas', String(total)],
        ['por filósofo', `${Math.min(...com)} a ${Math.max(...com)}`],
        ['interbloqueo', s.bloqueo ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: rendimiento de las estrategias ---------- */

  function montarComparar(cuerpo) {
    let n = 5, datos = null, geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Filósofos', min: 3, max: 8, valor: n, alCambiar: (v) => { n = v; medir(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'ingenua' }, { color: C.s2, texto: 'jerarquía' }, { color: C.s3, texto: 'camarero' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '50 ejecuciones de 300 pasos por estrategia, con tiempos de pensar al azar. Un interbloqueo detiene la ejecución: las comidas que faltan se pierden.');

    function medir() {
      datos = Object.keys(ESTRATEGIAS).map((estr, j) => {
        let comidas = 0, bloqueos = 0, minimo = 0;
        for (let r = 0; r < 50; r++) {
          const rnd = VIZ.semilla(1000 * j + r * 7 + n);
          const s = crearEstado(n, rnd, false);
          for (let t = 0; t < 300 && !s.bloqueo; t++) paso(s, estr, rnd, false);
          if (s.bloqueo) bloqueos++;
          comidas += s.fil.reduce((a, f) => a + f.comidas, 0);
          minimo += Math.min(...s.fil.map((f) => f.comidas));
        }
        return { estr, comidas: comidas / 50, bloqueos: bloqueos / 50, minimo: minimo / 50, color: VIZ.series[j] };
      });
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...datos.map((d) => d.comidas)) * 1.18;
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 3, ymin: 0, ymax }, { etiquetaY: 'comidas en 300 pasos', ticksX: [], formatoX: () => '' });
      plano.ejes();
      geo = { plano };
      const ancho = (plano.sx(1) - plano.sx(0)) * 0.5;
      datos.forEach((d, i) => {
        const x = plano.sx(i + 0.5) - ancho / 2, y0 = plano.sy(0), y1 = plano.sy(d.comidas);
        ctx.fillStyle = hover < 0 || hover === i ? d.color : VIZ.alfa(d.color, 0.45);
        ctx.beginPath(); ctx.roundRect(x, y1, ancho, y0 - y1, [4, 4, 0, 0]); ctx.fill();
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(VIZ.fmt(d.comidas, 3), x + ancho / 2, y1 - 4);
        ctx.textBaseline = 'top'; ctx.fillStyle = d.bloqueos ? C.s8 : C.tinta2; ctx.font = VIZ.fuente(10);
        const pct = Math.round(d.bloqueos * 100);
        ctx.fillText(ancho > 90 ? (pct ? `${pct} % bloqueadas` : 'sin bloqueos') : `${pct} % bloq.`, x + ancho / 2, y0 + 8);
      });
      lectura.set(datos.map((d) => [ESTRATEGIAS[d.estr].split(':')[0], `${VIZ.fmt(d.comidas, 3)} (mín. ${VIZ.fmt(d.minimo, 3)} c/u)`]));
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.plano.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(2, Math.floor(geo.plano.ix(x))));
      dibujar();
      const d = datos[hover];
      tip.mostrar(x, y, `<b>${ESTRATEGIAS[d.estr]}</b><br>comidas promedio <b>${VIZ.fmt(d.comidas, 3)}</b><br>ejecuciones bloqueadas <b>${Math.round(d.bloqueos * 100)} %</b><br>filósofo con menos comidas <b>${VIZ.fmt(d.minimo, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    medir();
    dibujar();
  }

  VIZ.registrarTema('dining-philosophers', {
    intro: String.raw`
      <p>Cinco filósofos se sientan a una mesa redonda; entre cada par hay un tenedor. Para comer, un filósofo necesita los <em>dos</em>
      tenedores vecinos, y los toma de a uno. El problema, planteado por Dijkstra (1965), resume la dificultad de los procesos que necesitan
      <strong>varios recursos exclusivos</strong> a la vez: bases de datos con varios locks, procesos con varios archivos, transacciones
      distribuidas.</p>
      <p>Si todos toman primero el tenedor de su izquierda, puede pasar que todos tengan uno y esperen el otro para siempre: un
      <strong>interbloqueo</strong> (<em>deadlock</em>). Las soluciones rompen alguna de las condiciones necesarias para que ocurra.</p>`,
    visualizaciones: [
      {
        titulo: 'La mesa',
        descripcion: 'Con la estrategia ingenua y «Todos con hambre a la vez», cada uno toma su tenedor izquierdo y se forma la espera circular en rojo. Cambie a jerarquía o camarero: el ciclo ya no puede cerrarse.',
        montar: montarMesa,
      },
      {
        titulo: 'Rendimiento de las estrategias',
        descripcion: 'Comidas totales por estrategia y cuántas ejecuciones terminan bloqueadas. La ingenua se bloquea en algunas ejecuciones y, aun sin bloquearse, come menos porque retiene un tenedor mientras espera el otro. Las otras dos nunca se bloquean.',
        montar: montarComparar,
      },
    ],
    teoria: String.raw`
      <h2>Condiciones de Coffman</h2>
      <p>Un interbloqueo solo puede ocurrir si se cumplen las cuatro a la vez (Coffman, Elphick y Shoshani, 1971):</p>
      <ol>
        <li><strong>Exclusión mutua:</strong> cada tenedor lo usa uno a la vez.</li>
        <li><strong>Retener y esperar:</strong> un filósofo retiene un tenedor mientras espera el otro.</li>
        <li><strong>Sin expropiación:</strong> nadie le quita un tenedor a otro.</li>
        <li><strong>Espera circular:</strong> existe un ciclo \(F_1 \to F_2 \to \dots \to F_k \to F_1\) donde cada uno espera un recurso del siguiente.</li>
      </ol>
      <p>El grafo de espera de la figura dibuja la cuarta: el ciclo rojo es el interbloqueo.</p>

      <h2>Jerarquía de recursos</h2>
      <p>Se numeran los tenedores y cada filósofo toma primero el de menor número. Así el último filósofo toma primero su tenedor <em>derecho</em>.</p>
      <div class="recuadro"><p><strong>Teorema.</strong> Si todos adquieren recursos en orden creciente, no hay espera circular.</p></div>
      <p><strong>Demostración.</strong> En un ciclo, cada \(F_j\) espera un tenedor de número mayor que el que retiene (lo pide después), y ese tenedor lo retiene
      \(F_{j+1}\). Recorriendo el ciclo, los números crecen estrictamente y vuelven al de partida: contradicción.</p>

      <h2>Camarero</h2>
      <p>Un árbitro deja que a lo más \(n - 1\) filósofos intenten comer a la vez. Por el principio del palomar, entre \(n - 1\) filósofos que compiten por
      \(n\) tenedores alguno consigue los dos, come y libera. Rompe la espera circular, pero centraliza la decisión.</p>

      <h2>Otras soluciones</h2>
      <ul>
        <li><strong>Tomar ambos o ninguno</strong> (rompe «retener y esperar»): un filósofo toma los dos atómicamente, con un monitor.</li>
        <li><strong>Chandy–Misra</strong> (1984): tenedores «sucios» y «limpios» que se piden por mensajes; funciona con cualquier número de procesos y
        recursos, de forma totalmente distribuida, y evita la inanición.</li>
        <li><strong>Detección y recuperación</strong>: dejar que ocurra, detectar el ciclo (con el grafo de espera o una
        <a href="tema.html?id=chandy-lamport">instantánea global</a>) y abortar a una víctima.</li>
      </ul>
      <p>Evitar el interbloqueo no basta: con mala suerte, un filósofo puede no comer nunca (<strong>inanición</strong>). La lectura «mín. por filósofo»
      de la figura 2 mide qué tan pareja es cada estrategia. Ver también la <a href="tema.html?id=mutual-exclusion">exclusión mutua</a> con un solo recurso.</p>`,
  });
})();
