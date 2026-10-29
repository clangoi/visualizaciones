(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.grafo;

  /* ---------- Simulaciones (sobre listas de adyacencia de enteros) ---------- */

  // Inundación con TTL: devuelve los pasos [{ envios: [[u, v]], alcanzados, hallado }].
  function inundar(ady, origen, ttl, tiene) {
    const visto = new Set([origen]);
    let frontera = [{ v: origen, de: -1 }], hallado = tiene(origen) ? 0 : -1, mensajes = 0;
    const pasos = [];
    for (let t = 1; t <= ttl && frontera.length; t++) {
      const envios = [], nueva = [];
      for (const { v, de } of frontera) for (const w of ady[v]) {
        if (w === de) continue;
        envios.push([v, w]);
        mensajes++;
        if (!visto.has(w)) { visto.add(w); nueva.push({ v: w, de: v }); if (hallado < 0 && tiene(w)) hallado = t; }
      }
      frontera = nueva;
      pasos.push({ envios, visto: new Set(visto), frontera: nueva.map((x) => x.v), hallado, mensajes });
    }
    return { pasos, hallado, mensajes, visitados: visto.size };
  }

  // k caminantes al azar; se detienen todos cuando uno encuentra el recurso (o se agota el TTL).
  function caminar(ady, origen, k, ttl, tiene, rnd) {
    let pos = new Array(k).fill(origen), prev = new Array(k).fill(-1);
    const visto = new Set([origen]);
    let hallado = tiene(origen) ? 0 : -1, mensajes = 0;
    const pasos = [];
    for (let t = 1; t <= ttl && hallado < 0; t++) {
      const envios = [];
      for (let j = 0; j < k; j++) {
        const op = ady[pos[j]].length > 1 ? ady[pos[j]].filter((w) => w !== prev[j]) : ady[pos[j]];
        const w = op[Math.floor(rnd() * op.length)];
        envios.push([pos[j], w]);
        mensajes++;
        prev[j] = pos[j]; pos[j] = w;
        visto.add(w);
        if (hallado < 0 && tiene(w)) hallado = t;
      }
      pasos.push({ envios, visto: new Set(visto), frontera: pos.slice(), hallado, mensajes });
    }
    return { pasos, hallado, mensajes, visitados: visto.size };
  }

  /* ---------- Fig. 1: la búsqueda en un grafo pequeño ---------- */

  function montarBusqueda(cuerpo) {
    const est = { alg: 'flood', ttl: 4, k: 3, copias: 2, semilla: 4, origen: 0 };
    let g, ady, copias, res, k = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Método', valor: est.alg, opciones: [['flood', 'Inundación (flooding)'], ['walk', 'Caminatas aleatorias']], alCambiar: (v) => { est.alg = v; rTTL.valor = est.ttl = v === 'flood' ? 4 : 12; rep.reiniciar(); } });
    const rTTL = ctl.rango({ etiqueta: 'TTL (saltos máximos)', min: 1, max: 20, valor: est.ttl, alCambiar: (v) => { est.ttl = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Caminantes k', min: 1, max: 8, valor: est.k, alCambiar: (v) => { est.k = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Copias del recurso', min: 1, max: 5, valor: est.copias, alCambiar: (v) => { est.copias = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nueva red', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 320, altoMax: 470 });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nodo que ya recibió la consulta', forma: 'punto' },
      { color: C.s4, texto: 'frontera / posición de un caminante', forma: 'punto' },
      { color: C.s2, texto: 'mensajes de este paso', forma: 'linea' },
      { color: C.s6, texto: 'tiene una copia del recurso', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para que la consulta parta desde él. Los mensajes duplicados también cuentan: es el costo real en la red.');

    function nuevo() {
      g = G.generar({ n: 22, grado: 3.2, semilla: est.semilla * 3 + 1 });
      ady = G.adyacencia(g).map((l) => l.map((x) => x.v));
      est.origen = Math.min(est.origen, g.nodos.length - 1);
      ubicarCopias();
      rep.reiniciar();
    }

    // Copias al azar, de preferencia a distancia ≥ 3 del origen para que la búsqueda tenga que trabajar.
    function ubicarCopias() {
      const rnd = VIZ.semilla(est.semilla * 71 + est.origen);
      const dist = new Array(ady.length).fill(Infinity), cola = [est.origen];
      dist[est.origen] = 0;
      for (let h = 0; h < cola.length; h++) for (const w of ady[cola[h]]) if (dist[w] === Infinity) { dist[w] = dist[cola[h]] + 1; cola.push(w); }
      let cand = dist.map((d, v) => v).filter((v) => dist[v] >= 3 && dist[v] < Infinity);
      if (cand.length < est.copias) cand = dist.map((d, v) => v).filter((v) => v !== est.origen);
      copias = new Set();
      while (copias.size < Math.min(est.copias, cand.length)) copias.add(cand[Math.floor(rnd() * cand.length)]);
    }

    function iniciar() {
      const tiene = (v) => copias.has(v);
      res = est.alg === 'flood' ? inundar(ady, est.origen, est.ttl, tiene) : caminar(ady, est.origen, est.k, est.ttl, tiene, VIZ.semilla(est.semilla * 13 + est.k));
      k = 0;
      return (function* () { for (k = 1; k <= res.pasos.length; k++) yield; k = res.pasos.length; })();
    }

    function dibujar() {
      lienzo.limpiar();
      const ps = k > 0 ? res.pasos[k - 1] : null;
      const actuales = new Set((ps ? ps.envios : []).map(([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`)));
      const visto = ps ? ps.visto : new Set([est.origen]);
      const front = new Set(ps ? ps.frontera : [est.origen]);
      const L = (i) => g.nodos[i].etiqueta;
      geo = G.dibujar(lienzo, g, {
        arista: (a) => (actuales.has(a.u < a.v ? `${a.u}-${a.v}` : `${a.v}-${a.u}`) ? { color: C.s2, ancho: 3 } : { color: C.eje }),
        nodo: (i) => {
          const est2 = {};
          if (copias.has(i)) { est2.relleno = C.s6; est2.texto = C.sobre; }
          else if (front.has(i) && k > 0) { est2.relleno = C.s4; }
          else if (visto.has(i)) { est2.relleno = VIZ.alfa(C.s1, 0.35); }
          if (i === est.origen) est2.anillo = C.s1;
          else if (copias.has(i) && visto.has(i)) est2.anillo = C.s6;
          return est2;
        },
      });
      const hallado = ps ? ps.hallado : -1;
      if (!ps) registro.textContent = `El nodo ${L(est.origen)} busca un recurso que tienen ${[...copias].map(L).join(', ')}.`;
      else if (est.alg === 'flood') registro.textContent = `Paso ${k}: ${ps.envios.length} mensajes; cada nodo alcanzado en el paso anterior reenvía a todos sus vecinos salvo al que se lo envió.${hallado >= 0 ? ` Recurso encontrado en el paso ${hallado}.` : ''}`;
      else registro.textContent = `Paso ${k}: cada caminante salta a un vecino al azar (evitando volver atrás).${hallado >= 0 ? ` ¡Un caminante encontró el recurso en el paso ${hallado}! Todos se detienen.` : ''}`;
      if (k === res.pasos.length && hallado < 0) registro.textContent += ' Se agotó el TTL sin encontrarlo.';
      lectura.set([
        ['paso', `${k} de ${res.pasos.length}`],
        ['mensajes', String(ps ? ps.mensajes : 0)],
        ['nodos visitados', `${visto.size} de ${g.nodos.length}`],
        ['encontrado', hallado >= 0 ? `sí, paso ${hallado}` : 'aún no'],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i < 0) return;
      est.origen = i;
      ubicarCopias();
      rep.reiniciar();
    });
    nuevo();
  }

  /* ---------- Fig. 2: éxito frente a costo ---------- */

  // Grafo aleatorio no estructurado: anillo (para asegurar conexión) más d enlaces al azar por nodo.
  function redAleatoria(n, d, rnd) {
    const ady = Array.from({ length: n }, () => new Set());
    const unir = (a, b) => { if (a !== b) { ady[a].add(b); ady[b].add(a); } };
    for (let i = 0; i < n; i++) unir(i, (i + 1) % n);
    for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) unir(i, Math.floor(rnd() * n));
    return ady.map((s) => [...s]);
  }

  function montarCosto(cuerpo) {
    let rep = 0.01, semilla = 1, datos = null, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Nodos con copia', valor: '0.01', opciones: [['0.005', '0,5 %'], ['0.01', '1 %'], ['0.02', '2 %'], ['0.05', '5 %']], alCambiar: (v) => { rep = +v; medir(); dibujar(); } });
    ctl.boton('Repetir', () => { semilla++; medir(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'inundación (etiqueta: TTL)', forma: 'linea' },
      { color: C.s2, texto: '16 caminantes (etiqueta: TTL)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Red de 1 000 nodos con grado medio cercano a 6; 300 consultas desde nodos al azar por punto. Pase el cursor por un punto.');

    function medir() {
      const rnd = VIZ.semilla(semilla * 523);
      const n = 1000;
      const ady = redAleatoria(n, 2, rnd);
      const copias = new Set();
      while (copias.size < Math.max(1, Math.round(rep * n))) copias.add(Math.floor(rnd() * n));
      const tiene = (v) => copias.has(v);
      const serie = (f, ttls) => ttls.map((ttl) => {
        let exito = 0, msg = 0;
        for (let q = 0; q < 300; q++) { const r = f(Math.floor(rnd() * n), ttl); if (r.hallado >= 0) exito++; msg += r.mensajes; }
        return { ttl, exito: exito / 300, msg: msg / 300 };
      });
      datos = {
        flood: serie((o, ttl) => inundar(ady, o, ttl, tiene), [1, 2, 3, 4, 5, 6]),
        walk: serie((o, ttl) => caminar(ady, o, 16, ttl, tiene, rnd), [1, 2, 4, 8, 16, 32, 64, 128]),
      };
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0.5, xmax: 4.5, ymin: 0, ymax: 1.05 },
        { etiquetaX: 'mensajes por consulta (escala log)', etiquetaY: 'tasa de éxito', formatoX: (v) => VIZ.entero(10 ** v), ticksX: [1, 2, 3, 4], formatoY: (v) => `${Math.round(v * 100)} %` });
      plano.ejes();
      for (const [clave, col] of [['flood', C.s1], ['walk', C.s2]]) {
        const pts = datos[clave].map((d) => [Math.log10(Math.max(1, d.msg)), d.exito]);
        VIZ.trazar(ctx, plano, pts, col, 2);
        let ultima = null;
        datos[clave].forEach((d, i) => {
          const [x, y] = pts[i];
          const px = plano.sx(x), py = plano.sy(y) + (clave === 'flood' ? -10 : 14);
          VIZ.marcador(ctx, plano.sx(x), plano.sy(y), col, hover === d ? 6 : 4, clave === 'walk' ? 1 : 0);
          if (ultima && Math.hypot(px - ultima[0], py - ultima[1]) < 16) return; // etiqueta que chocaría: queda el tooltip
          ultima = [px, py];
          ctx.font = VIZ.fuente(10); ctx.fillStyle = col; ctx.textAlign = 'center';
          ctx.fillText(String(d.ttl), px, py);
        });
      }
      const mejor = (clave, meta) => datos[clave].find((d) => d.exito >= meta);
      const f90 = mejor('flood', 0.9), w90 = mejor('walk', 0.9);
      lectura.set([
        ['inundación: 90 % de éxito con', f90 ? `${VIZ.entero(f90.msg)} mensajes` : 'no se alcanza'],
        ['caminatas: 90 % de éxito con', w90 ? `${VIZ.entero(w90.msg)} mensajes` : 'no se alcanza'],
        ['ahorro', f90 && w90 ? `${VIZ.fmt(f90.msg / w90.msg, 3)}×` : '—'],
      ]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      let mejor = null, dm = 18, nombre = '';
      for (const [clave, t] of [['flood', 'inundación'], ['walk', 'caminatas']]) for (const d of datos[clave]) {
        const dd = Math.hypot(plano.sx(Math.log10(Math.max(1, d.msg))) - x, plano.sy(d.exito) - y);
        if (dd < dm) { dm = dd; mejor = d; nombre = t; }
      }
      hover = mejor;
      dibujar();
      if (mejor) tip.mostrar(x, y, `${nombre}, TTL <b>${mejor.ttl}</b><br>éxito <b>${Math.round(mejor.exito * 100)} %</b><br>mensajes <b>${VIZ.entero(mejor.msg)}</b>`);
      else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
    dibujar();
  }

  VIZ.registrarTema('flooding-random-walk', {
    intro: String.raw`
      <p>En una red P2P <strong>no estructurada</strong> (Gnutella, redes ad hoc, redes de sensores) los nodos se conectan sin ningún orden y
      nadie sabe dónde está cada recurso: a diferencia de una <a href="tema.html?id=chord-dht">DHT</a>, no hay forma de calcular quién lo tiene.
      Hay que salir a buscarlo.</p>
      <p>La <strong>inundación</strong> reenvía la consulta a todos los vecinos, que la reenvían a los suyos, hasta agotar un tiempo de vida (TTL).
      Encuentra el recurso por el camino más corto, pero el número de mensajes crece como el número de nodos a distancia TTL, con muchos
      duplicados. Las <strong>caminatas aleatorias</strong> envían en cambio unos pocos mensajes que saltan a un vecino al azar: tardan más,
      pero cuestan mucho menos.</p>`,
    visualizaciones: [
      {
        titulo: 'Inundación y caminatas paso a paso',
        descripcion: 'Avance paso a paso y compare el contador de mensajes. Con inundación, observe cuántos mensajes llegan a nodos que ya habían recibido la consulta.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Éxito frente a costo',
        descripcion: 'Cada punto es un TTL. Para la misma tasa de éxito, las caminatas aleatorias usan del orden de diez veces menos mensajes que la inundación, sobre todo cuando el recurso es raro.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Inundación</h2>
      <pre><code>al recibir la consulta q con ttl desde u:
    si ya vi q: descartar
    si tengo el recurso: responder por el camino inverso
    si ttl &gt; 1: reenviar (q, ttl − 1) a todos mis vecinos salvo u</code></pre>
      <p>En un grafo de grado \(d\), los nodos a distancia \(\le t\) crecen como \((d-1)^t\), y cada uno reenvía \(d - 1\) mensajes: el costo es
      \(\Theta\big((d-1)^{t}\big)\) hasta saturar la red, cuando se acerca a \(2|E|\) por consulta. El TTL justo es difícil de elegir: si es corto, falla con
      recursos raros; si es largo, inunda toda la red. La <em>búsqueda por anillos expansivos</em> reintenta con TTL 1, 2, 4, …</p>

      <h2>Caminatas aleatorias</h2>
      <p>Con \(k\) caminantes que se detienen al encontrar el recurso, el costo es \(k\) mensajes por paso. Si una fracción \(\rho\) de los nodos tiene
      una copia y la caminata visita nodos casi independientes, la probabilidad de no encontrarla en \(T\) pasos con \(k\) caminantes es</p>
      \[ \Pr[\text{fallo}] \approx (1 - \rho)^{kT}, \qquad \mathbb{E}[\text{mensajes}] \approx \frac{1}{\rho}. \]
      <p>El costo depende de la rareza del recurso, no del tamaño de la red. Lv, Cao, Cohen, Li y Shenker (2002) midieron que 16–64 caminantes con
      verificación periódica reducen el tráfico en uno o dos órdenes de magnitud respecto de la inundación, con tasas de éxito parecidas.</p>

      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>Inundación</th><th>Caminatas aleatorias</th></tr>
        <tr><td>Mensajes</td><td>\(O((d-1)^{TTL})\), con duplicados</td><td>\(k \cdot\) pasos</td></tr>
        <tr><td>Latencia</td><td>Mínima: la distancia más corta</td><td>Mayor: \(\approx 1/(k\rho)\) pasos</td></tr>
        <tr><td>Recursos populares</td><td>Muy caro para lo que se necesita</td><td>Muy barato</td></tr>
        <tr><td>Recursos raros</td><td>Exige TTL alto</td><td>Exige muchos pasos</td></tr>
      </table>
      <p>La <a href="tema.html?id=probe-echo">exploración probe/echo</a> es una inundación sin TTL que además devuelve información al iniciador.</p>`,
  });
})();
