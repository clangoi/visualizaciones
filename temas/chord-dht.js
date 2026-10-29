(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;

  /* ---------- Anillo de Chord ---------- */

  // ¿x ∈ (a, b] en el anillo módulo M? (con a = b el intervalo es el anillo completo)
  const enIntervalo = (x, a, b, M, cerradoDer = true) => {
    const d = (y) => (y - a + M) % M;
    if (a === b) return cerradoDer || x !== a;
    return cerradoDer ? d(x) > 0 && d(x) <= d(b) : d(x) > 0 && d(x) < d(b);
  };

  // nodos: ids ordenados. Devuelve el sucesor de k (primer nodo con id ≥ k, circularmente).
  function sucesor(nodos, k) {
    let lo = 0, hi = nodos.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (nodos[m] < k) lo = m + 1; else hi = m; }
    return nodos[lo % nodos.length];
  }

  function crear(m, N, semilla) {
    const M = 2 ** m, rnd = VIZ.semilla(semilla);
    const ids = new Set();
    while (ids.size < Math.min(N, M)) ids.add(Math.floor(rnd() * M));
    const nodos = [...ids].sort((a, b) => a - b);
    const dedos = new Map(nodos.map((n) => [n, Array.from({ length: m }, (_, i) => {
      const inicio = (n + 2 ** i) % M;
      return { inicio, nodo: sucesor(nodos, inicio) };
    })]));
    return { m, M, nodos, dedos };
  }

  // Búsqueda iterativa desde n: lista de saltos [n, n1, …] y el responsable final.
  function buscar(r, n, k) {
    const camino = [n];
    for (let g = 0; g < 64; g++) {
      const suc = r.dedos.get(n)[0].nodo;
      if (n === k || enIntervalo(k, n, suc, r.M)) {
        const resp = n === k ? n : suc;
        if (resp !== n) camino.push(resp);
        return { camino, responsable: resp };
      }
      // Dedo más cercano que precede a k.
      let sig = suc;
      const f = r.dedos.get(n);
      for (let i = r.m - 1; i >= 0; i--) if (enIntervalo(f[i].nodo, n, k, r.M, false)) { sig = f[i].nodo; break; }
      camino.push(sig);
      n = sig;
    }
    return { camino, responsable: n };
  }

  /* ---------- Fig. 1: búsqueda paso a paso ---------- */

  function montarBusqueda(cuerpo) {
    const est = { m: 6, N: 10, semilla: 3, clave: 50 };
    let r, origen, s = null, geo = null;
    const azar = VIZ.semilla(77);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Bits m', min: 4, max: 8, valor: est.m, formato: (v) => `${v} (${2 ** v})`,
      alCambiar: (v) => { est.m = v; est.clave = Math.min(est.clave, 2 ** v - 1); nClave.valor = est.clave; nClave.input.max = 2 ** v - 1; nuevo(); } });
    ctl.rango({ etiqueta: 'Nodos N', min: 3, max: 32, valor: est.N, alCambiar: (v) => { est.N = v; nuevo(); } });
    const nClave = ctl.numero({ etiqueta: 'Clave buscada', min: 0, max: 2 ** est.m - 1, valor: est.clave,
      alCambiar: (v) => { est.clave = Math.max(0, Math.min(2 ** est.m - 1, Math.round(v) || 0)); nClave.valor = est.clave; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos nodos', () => { est.semilla++; nuevo(); });
    ctl.boton('Clave al azar', () => { est.clave = Math.floor(azar() * r.M); nClave.valor = est.clave; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(520, Math.max(330, w * 0.62)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nodo que tiene la consulta', forma: 'punto' },
      { color: C.s2, texto: 'salto realizado', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.45), texto: 'dedos del nodo actual', forma: 'linea' },
      { color: C.s4, texto: 'clave buscada', forma: 'cuadro' },
      { color: C.s6, texto: 'nodo responsable: sucesor(clave)', forma: 'punto' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para que la búsqueda parta de él. La tabla muestra los dedos del nodo que tiene la consulta.');

    function nuevo() {
      r = crear(est.m, est.N, est.semilla * 101 + est.m);
      origen = r.nodos[0];
      rep.reiniciar();
    }

    function iniciar() {
      const res = buscar(r, origen, est.clave);
      s = { camino: [origen], actual: origen, res, fin: false };
      s.mensaje = `El nodo ${origen} quiere saber quién guarda la clave ${est.clave}. Responsable: el primer nodo con id ≥ ${est.clave} en el anillo.`;
      return (function* () {
        for (let h = 1; h < res.camino.length; h++) {
          const n = res.camino[h - 1], sig = res.camino[h];
          const suc = r.dedos.get(n)[0].nodo;
          s.camino.push(sig);
          s.actual = sig;
          if (sig === res.responsable && (est.clave === sig || enIntervalo(est.clave, n, suc, r.M))) {
            s.mensaje = `${est.clave} ∈ (${n}, ${suc}]: el sucesor de ${n} es el responsable. La consulta llega a ${sig}.`;
          } else {
            const i = r.dedos.get(n).findIndex((f) => f.nodo === sig);
            s.mensaje = `${est.clave} ∉ (${n}, ${suc}]. El dedo más lejano que no pasa de la clave es el ${i + 1} (${n} + ${2 ** i} → ${sig}): se salta a ${sig}.`;
          }
          yield;
        }
        s.fin = true;
        s.mensaje = `Encontrado en ${res.camino.length - 1} salto${res.camino.length === 2 ? '' : 's'}: el nodo ${res.responsable} guarda la clave ${est.clave}.`;
      })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 40;
      const ang = (id) => -Math.PI / 2 + (2 * Math.PI * id) / r.M;
      const pt = (id, rr = R) => ({ x: cx + rr * Math.cos(ang(id)), y: cy + rr * Math.sin(ang(id)) });
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // Marcas de identificadores
      const cada = r.M <= 32 ? 1 : r.M <= 64 ? 2 : r.M / 32;
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let id = 0; id < r.M; id += cada) {
        const a = pt(id, R - 3), b = pt(id, R + 3);
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const id of [0, r.M / 4, r.M / 2, (3 * r.M) / 4]) { const p = pt(id, R - 16); ctx.fillText(String(id), p.x, p.y); }
      // Clave
      const pk = pt(est.clave);
      ctx.fillStyle = C.s4; ctx.fillRect(pk.x - 5, pk.y - 5, 10, 10);
      const pkl = pt(est.clave, R - 36);
      D.etiqueta(ctx, `k=${est.clave}`, pkl.x, pkl.y, { color: C.tinta, borde: C.s4, tam: 10 });
      // Dedos del nodo actual
      const actual = s ? s.actual : origen;
      const vistos = new Set();
      for (const f of r.dedos.get(actual)) {
        if (f.nodo === actual || vistos.has(f.nodo)) continue;
        vistos.add(f.nodo);
        const a = pt(actual), b = pt(f.nodo);
        D.flecha(ctx, a.x, a.y, b.x, b.y, { color: VIZ.alfa(C.s1, 0.45), ancho: 1.2, guiones: [4, 3] });
      }
      // Camino
      if (s) for (let h = 1; h < s.camino.length; h++) {
        const a = pt(s.camino[h - 1]), b = pt(s.camino[h]);
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        D.mensaje(ctx, a, b, 6, { color: C.s2, ancho: 3, curva: Math.min(26, L * 0.12) });
      }
      // Nodos
      geo = [];
      const rn = r.nodos.length > 20 ? 5 : 7;
      ctx.font = VIZ.fuente(11, 500);
      r.nodos.forEach((id) => {
        const p = pt(id);
        geo[id] = p;
        const responsable = s && s.fin && id === s.res.responsable;
        const col = responsable ? C.s6 : id === actual ? C.s1 : s && s.camino.includes(id) ? C.s2 : C.tinta;
        VIZ.marcador(ctx, p.x, p.y, col, id === actual || responsable ? rn + 2 : rn);
        if (id === origen) { ctx.beginPath(); ctx.arc(p.x, p.y, rn + 6, 0, Math.PI * 2); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke(); }
        const q = pt(id, R + 17);
        ctx.fillStyle = col === C.tinta ? C.tinta2 : col;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(id), q.x, q.y);
      });
      // Tabla de dedos
      const filas = r.dedos.get(actual).map((f, i) => el('tr', { class: s && s.camino.length > 1 && s.camino[s.camino.indexOf(actual) + 1] === f.nodo && !s.fin ? 'activa' : null },
        el('td', null, String(i + 1)), el('td', null, `${actual} + ${2 ** i}`), el('td', null, String(f.inicio)), el('td', null, String(f.nodo))));
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th', null, 'i'), el('th', null, 'n + 2^(i−1)'), el('th', null, 'inicio'), el('th', null, `dedo de ${actual}`)), filas));
      registro.textContent = s ? s.mensaje : '';
      lectura.set([
        ['saltos', String(s ? s.camino.length - 1 : 0)],
        ['nodos N', String(r.nodos.length)],
        ['log₂ N', VIZ.fmt(Math.log2(r.nodos.length), 3)],
        ['responsable', String(sucesor(r.nodos, est.clave))],
        ['claves por nodo (media)', VIZ.fmt(r.M / r.nodos.length, 3)],
      ]);
    }
    lienzo.alDibujar = () => r && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(geo, x, y, 16);
      if (i >= 0) { origen = i; rep.reiniciar(); }
    });
    nuevo();
  }

  /* ---------- Fig. 2: saltos según N ---------- */

  function montarSaltos(cuerpo) {
    let semilla = 1, datos = [], hover = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Repetir con otros nodos', () => { semilla++; medir(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'saltos promedio medidos', forma: 'linea' },
      { color: C.s2, texto: 'percentil 95', forma: 'linea' },
      { color: C.apagado, texto: '½ log₂ N (teoría)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Identificadores de 20 bits y 300 búsquedas de claves al azar desde nodos al azar por cada N; se cuenta también el último salto, del predecesor al responsable. Pase el cursor por el gráfico.');

    function medir() {
      const rnd = VIZ.semilla(semilla * 7919);
      datos = [];
      for (let e = 1; e <= 11; e++) {
        const N = 2 ** e;
        const r = crear(20, N, semilla * 31 + e);
        const saltos = [];
        for (let q = 0; q < 300; q++) {
          const n = r.nodos[Math.floor(rnd() * N)], k = Math.floor(rnd() * r.M);
          saltos.push(buscar(r, n, k).camino.length - 1);
        }
        saltos.sort((a, b) => a - b);
        datos.push({ e, N, media: saltos.reduce((s, v) => s + v, 0) / saltos.length, p95: saltos[Math.floor(0.95 * saltos.length)] });
      }
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 11, ymin: 0, ymax: 12 },
        { etiquetaX: 'nodos N (escala log)', etiquetaY: 'saltos por búsqueda', formatoX: (v) => String(2 ** v), ticksX: [1, 3, 5, 7, 9, 11] });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[1, 0.5], [11, 5.5]], C.apagado, 1.5, [3, 4]);
      ctx.font = VIZ.fuente(11); ctx.fillStyle = C.apagado; ctx.textAlign = 'right';
      ctx.fillText('½ log₂ N', plano.sx(11) - 4, plano.sy(5.5) + 16);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.e, d.p95]), C.s2, 2);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.e, d.media]), C.s1, 2);
      for (const d of datos) {
        VIZ.marcador(ctx, plano.sx(d.e), plano.sy(d.media), C.s1, hover === d ? 5.5 : 4);
        VIZ.marcador(ctx, plano.sx(d.e), plano.sy(d.p95), C.s2, hover === d ? 5.5 : 3.5, 1);
      }
      if (hover) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plano.sx(hover.e) + 0.5, plano.y1); ctx.lineTo(plano.sx(hover.e) + 0.5, plano.y0); ctx.stroke();
      }
      const u = datos[datos.length - 1];
      lectura.set([
        ['N máximo', VIZ.entero(u.N)],
        ['saltos promedio', VIZ.fmt(u.media, 3)],
        ['½ log₂ N', VIZ.fmt(u.e / 2, 3)],
        ['percentil 95', String(u.p95)],
        ['cota log₂ N', String(u.e)],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const e = Math.round(plano.ix(x));
      hover = datos.find((d) => d.e === e) || null;
      dibujar();
      if (hover) tip.mostrar(x, y, `N = <b>${VIZ.entero(hover.N)}</b>` + VIZ.filaTooltip(C.s1, 'promedio', VIZ.fmt(hover.media, 3)) +
        VIZ.filaTooltip(C.s2, 'percentil 95', hover.p95) + VIZ.filaTooltip(C.apagado, '½ log₂ N', VIZ.fmt(hover.e / 2, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
    dibujar();
  }

  VIZ.registrarTema('chord-dht', {
    intro: String.raw`
      <p>Una <strong>tabla de hash distribuida</strong> (DHT) reparte pares clave–valor entre miles de nodos sin ningún servidor
      central, y permite encontrar el dueño de cualquier clave con pocos mensajes. <strong>Chord</strong> (Stoica et al., 2001) lo hace
      con una idea geométrica: nodos y claves reciben identificadores de \(m\) bits en un mismo anillo, y cada clave pertenece al
      primer nodo que la sigue en el sentido del reloj, su <em>sucesor</em>.</p>
      <p>Para no recorrer el anillo nodo por nodo, cada nodo guarda \(m\) atajos, los <strong>dedos</strong>: el sucesor de \(n + 1\),
      de \(n + 2\), de \(n + 4\), …, de \(n + 2^{m-1}\). Cada salto por el dedo adecuado al menos reduce a la mitad la distancia que
      falta, así que una búsqueda toma \(O(\log N)\) saltos.</p>`,
    visualizaciones: [
      {
        titulo: 'Búsqueda en el anillo',
        descripcion: 'Avance paso a paso: en cada salto el nodo actual usa el dedo más lejano que no sobrepasa la clave. Pruebe con m = 8 y 32 nodos, y con claves cercanas y lejanas al origen.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Saltos según el número de nodos',
        descripcion: 'Promedio y percentil 95 de saltos para N entre 2 y 2048. El promedio crece con la misma pendiente que \\(\\tfrac12 \\log_2 N\\): cada vez que N se duplica, medio salto más.',
        montar: montarSaltos,
      },
    ],
    teoria: String.raw`
      <h2>Hashing consistente</h2>
      <p>Con una función de hash \(h\) se asigna a cada nodo el identificador \(h(\text{IP})\) y a cada clave \(h(\text{clave})\), ambos en
      \(\{0, \dots, 2^m - 1\}\). La clave \(k\) se guarda en \(\text{sucesor}(k)\), el primer nodo con identificador \(\ge k\) módulo \(2^m\).</p>
      <p>Cuando un nodo entra o sale, solo cambian de dueño las claves del arco entre él y su predecesor: en promedio \(K/N\) de las \(K\)
      claves, en lugar de casi todas como ocurriría con \(h(k) \bmod N\). Con alta probabilidad cada nodo guarda \(O\big(\tfrac{K}{N}\log N\big)\)
      claves; con \(O(\log N)\) <em>nodos virtuales</em> por máquina la carga se equilibra a \(O(K/N)\).</p>

      <h2>Tabla de dedos y búsqueda</h2>
      <p>El nodo \(n\) guarda, para \(i = 1, \dots, m\), el dedo \(\text{finger}[i] = \text{sucesor}(n + 2^{i-1})\). El primer dedo es su sucesor.</p>
      <pre><code>buscar_sucesor(n, k):
    mientras k ∉ (n, sucesor(n)]:
        n ← dedo_previo_más_cercano(n, k)
    devolver sucesor(n)

dedo_previo_más_cercano(n, k):
    para i ← m hasta 1:
        si finger[i] ∈ (n, k):  devolver finger[i]
    devolver n</code></pre>

      <h2>Cantidad de saltos</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Con \(N\) nodos ubicados al azar, una búsqueda toma \(O(\log N)\) saltos con alta
      probabilidad; en promedio, cerca de \(\tfrac12 \log_2 N\).</p></div>
      <p><strong>Idea.</strong> Sea \(d\) la distancia (en identificadores) del nodo actual \(n\) a la clave, con \(2^{i-1} \le d &lt; 2^i\). El dedo
      \(i\) apunta al sucesor de \(n + 2^{i-1}\), que está antes de la clave. Saltar ahí deja una distancia \(&lt; d - 2^{i-1} \le d/2\).
      Tras \(\log_2 N\) saltos la distancia es \(\le 2^m/N\), y en un arco de ese largo hay \(O(\log N)\) nodos con alta probabilidad
      (en promedio, uno). Como cada salto cubre al azar entre la mitad y toda la distancia restante, en promedio se corrige la mitad de
      los bits que faltan: de ahí el \(\tfrac12\).</p>

      <h2>Mantenimiento</h2>
      <ul>
        <li><strong>Entrada:</strong> el nuevo nodo busca su sucesor y toma de él las claves que ahora le corresponden.</li>
        <li><strong>Estabilización:</strong> cada nodo pregunta periódicamente a su sucesor por el predecesor de este y corrige su puntero;
        los dedos se refrescan con búsquedas. Mientras tanto, las búsquedas siguen siendo correctas usando solo sucesores, aunque más lentas.</li>
        <li><strong>Fallas:</strong> cada nodo guarda una lista de \(r = O(\log N)\) sucesores; si fallan nodos de forma independiente con
        probabilidad \(\tfrac12\), el anillo sigue conectado con alta probabilidad.</li>
      </ul>
      <p>Otras DHT cambian la geometría: Pastry y Kademlia usan prefijos de identificadores y la distancia XOR; CAN, un toro de \(d\)
      dimensiones. Sobre una red sin estructura, la alternativa es <a href="tema.html?id=flooding-random-walk">inundar o caminar al azar</a>.</p>`,
  });
})();
