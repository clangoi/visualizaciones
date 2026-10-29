(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  const TOPICOS = ['clima', 'bolsa', 'tránsito'];
  const COLOR_TOPICO = { clima: C.s1, bolsa: C.s2, 'tránsito': C.s3 };
  const CIUDADES = ['Santiago', 'Lima', 'Bogotá'];

  // Cada suscriptor tiene un tópico y, además, un filtro de contenido más fino sobre ese tópico.
  const SUSCRIPTORES = [
    { nombre: 'S1', topico: 'clima', texto: 'clima ∧ temp > 28', f: (e) => e.topico === 'clima' && e.valor > 28 },
    { nombre: 'S2', topico: 'clima', texto: 'clima ∧ ciudad = Lima', f: (e) => e.topico === 'clima' && e.ciudad === 'Lima' },
    { nombre: 'S3', topico: 'bolsa', texto: 'bolsa ∧ variación < −2', f: (e) => e.topico === 'bolsa' && e.valor < -2 },
    { nombre: 'S4', topico: 'tránsito', texto: 'tránsito ∧ ciudad = Santiago', f: (e) => e.topico === 'tránsito' && e.ciudad === 'Santiago' },
    { nombre: 'S5', topico: 'bolsa', texto: 'bolsa (todo)', f: (e) => e.topico === 'bolsa' },
  ];

  function eventoAzar(rnd) {
    const topico = TOPICOS[Math.floor(rnd() * 3)], ciudad = CIUDADES[Math.floor(rnd() * 3)];
    const valor = topico === 'clima' ? 15 + Math.round(rnd() * 20) : topico === 'bolsa' ? Math.round((rnd() * 8 - 4) * 10) / 10 : Math.round(rnd() * 60);
    return { topico, ciudad, valor };
  }
  const textoEvento = (e) => `${e.topico} · ${e.ciudad} · ${e.topico === 'clima' ? `temp ${e.valor}` : e.topico === 'bolsa' ? `variación ${String(e.valor).replace('-', '−')}` : `demora ${e.valor} min`}`;

  /* ---------- Fig. 1: filtros por tópico y por contenido ---------- */

  function montarFiltros(cuerpo) {
    const est = { modo: 'topico' };
    let rnd = VIZ.semilla(7), ultimo = null, stats;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'El broker filtra', valor: est.modo, opciones: [['topico', 'por tópico'], ['contenido', 'por contenido']], alCambiar: (v) => { est.modo = v; reiniciar(); } });
    ctl.boton('Publicar un evento', () => publicar(1), { primario: true });
    ctl.boton('Publicar 100', () => publicar(100));
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 330 : 300) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'clima' }, { color: C.s2, texto: 'bolsa' }, { color: C.s3, texto: 'tránsito' },
      { color: C.s6, texto: 'entrega útil (cumple el filtro fino)', forma: 'punto' },
      { color: C.s8, texto: 'entrega inútil (el suscriptor la descarta)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los publicadores no conocen a los suscriptores ni al revés: solo hablan con el broker.');

    function reiniciar() { rnd = VIZ.semilla(7); ultimo = null; stats = { pub: 0, ent: 0, utiles: 0, inutiles: 0 }; dibujar(); }
    function publicar(k) {
      for (let i = 0; i < k; i++) {
        const e = eventoAzar(rnd);
        const recibe = SUSCRIPTORES.map((s) => (est.modo === 'topico' ? s.topico === e.topico : s.f(e)));
        stats.pub++;
        recibe.forEach((r, j) => { if (r) { stats.ent++; if (SUSCRIPTORES[j].f(e)) stats.utiles++; else stats.inutiles++; } });
        ultimo = { e, recibe, pub: Math.floor(rnd() * 2) };
      }
      dibujar();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const pubs = [{ x: 40, y: H * 0.3 }, { x: 40, y: H * 0.7 }];
      const broker = { x: angosto ? W * 0.36 : W * 0.38, y: H / 2 };
      const xs = angosto ? W - 30 : W * 0.68;
      const subs = SUSCRIPTORES.map((_, j) => ({ x: xs, y: 30 + (j * (H - 60)) / (SUSCRIPTORES.length - 1) }));
      if (ultimo) {
        const col = COLOR_TOPICO[ultimo.e.topico];
        const pp = pubs[ultimo.pub], fx = broker.x - 38, fy = broker.y + ((pp.y - broker.y) * 0.25);
        const L = Math.hypot(fx - pp.x, fy - pp.y);
        D.flecha(ctx, pp.x + ((fx - pp.x) / L) * 19, pp.y + ((fy - pp.y) / L) * 19, fx, fy, { color: col, ancho: 2.5 });
        ultimo.recibe.forEach((r, j) => {
          if (!r) return;
          D.mensaje(ctx, broker, subs[j], 18, { color: col, ancho: 2.2 });
        });
      }
      pubs.forEach((p, i) => D.nodo(ctx, p.x, p.y, `P${i + 1}`, { r: 17 }));
      ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(broker.x - 36, broker.y - 22, 72, 44, 6); ctx.fill(); ctx.stroke();
      ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('broker', broker.x, broker.y);
      if (ultimo) D.etiqueta(ctx, textoEvento(ultimo.e), broker.x, broker.y - 38, { color: COLOR_TOPICO[ultimo.e.topico], borde: COLOR_TOPICO[ultimo.e.topico], tam: 10 });
      SUSCRIPTORES.forEach((s, j) => {
        const p = subs[j];
        const r = ultimo && ultimo.recibe[j];
        const util = r && s.f(ultimo.e);
        D.nodo(ctx, p.x, p.y, s.nombre, { r: 17, relleno: r ? (util ? C.s6 : C.s8) : C.superficie, texto: r ? C.sobre : C.tinta, anillo: COLOR_TOPICO[s.topico] });
        const filtro = est.modo === 'topico' ? s.topico : s.texto;
        if (angosto) D.etiqueta(ctx, filtro, p.x - 26, p.y, { color: C.tinta2, tam: 10, alinear: 'right' });
        else D.etiqueta(ctx, filtro, p.x + 28, p.y, { color: C.tinta2, tam: 11, alinear: 'left' });
      });
      if (!ultimo) registro.textContent = `Cada suscriptor se registró en el broker con ${est.modo === 'topico' ? 'un tópico' : 'un predicado sobre el contenido'}. Publique eventos.`;
      else {
        const n = ultimo.recibe.filter(Boolean).length;
        const inut = ultimo.recibe.filter((r, j) => r && !SUSCRIPTORES[j].f(ultimo.e)).length;
        registro.textContent = `«${textoEvento(ultimo.e)}» llega a ${n} suscriptor${n === 1 ? '' : 'es'}.${inut ? ` ${inut} lo descarta${inut > 1 ? 'n' : ''}: el tópico coincide pero el contenido no le interesa.` : ''}`;
      }
      lectura.set([
        ['eventos', String(stats.pub)],
        ['entregas', String(stats.ent)],
        ['útiles', String(stats.utiles)],
        ['inútiles', String(stats.inutiles)],
        ['precisión', stats.ent ? `${Math.round((100 * stats.utiles) / stats.ent)} %` : '—'],
      ]);
    }
    lienzo.alDibujar = () => stats && dibujar();
    reiniciar();
  }

  /* ---------- Fig. 2: red de brokers ---------- */

  // Árbol de 7 brokers (B1 raíz) con suscriptores colgando de las hojas.
  const ARBOL = { nodos: [[0.5, 0.12], [0.25, 0.45], [0.75, 0.45], [0.12, 0.8], [0.38, 0.8], [0.62, 0.8], [0.88, 0.8]], aristas: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]] };
  const SUBS_BROKER = { 3: ['clima'], 4: ['bolsa'], 5: ['clima', 'tránsito'], 6: [] };

  function montarRed(cuerpo) {
    const est = { topico: 'clima', origen: 3, modo: 'filtro' };
    let pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tópico del evento', valor: est.topico, opciones: TOPICOS.map((t) => [t, t]), alCambiar: (v) => { est.topico = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Enrutamiento', valor: est.modo, opciones: [['filtro', 'según las suscripciones'], ['inundar', 'inundación a todos los brokers']], alCambiar: (v) => { est.modo = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 300 : 320) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'el evento viaja por este enlace', forma: 'linea' },
      { color: C.s1, texto: 'broker donde se publica', forma: 'punto' },
      { color: C.s6, texto: 'broker con suscriptores interesados', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un broker para publicar desde él. Bajo cada hoja, los tópicos de sus suscriptores locales.');

    const vecinos = (b) => ARBOL.aristas.filter(([a, c]) => a === b || c === b).map(([a, c]) => (a === b ? c : a));
    // ¿Hay suscriptores del tópico en el subárbol de c visto desde b? (tabla de enrutamiento del broker b para el enlace b–c)
    function interesa(b, c, t) {
      const visto = new Set([b]), pila = [c];
      while (pila.length) { const x = pila.pop(); if (visto.has(x)) continue; visto.add(x); if ((SUBS_BROKER[x] || []).includes(t)) return true; vecinos(x).forEach((y) => pila.push(y)); }
      return false;
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      pos = ARBOL.nodos.map(([x, y]) => ({ x: 30 + x * (W - 60), y: 20 + y * (H - 60) }));
      // Recorrido del evento desde el origen.
      const usados = [];
      const visto = new Set([est.origen]), cola = [est.origen];
      while (cola.length) {
        const b = cola.shift();
        for (const c of vecinos(b)) {
          if (visto.has(c)) continue;
          if (est.modo === 'filtro' && !interesa(b, c, est.topico)) continue;
          visto.add(c); usados.push([b, c]); cola.push(c);
        }
      }
      for (const [a, b] of ARBOL.aristas) {
        const u = usados.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
        if (u) D.mensaje(ctx, pos[u[0]], pos[u[1]], 18, { color: C.s2, ancho: 3 });
        else { ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y); ctx.lineTo(pos[b].x, pos[b].y); ctx.stroke(); }
      }
      const interesados = Object.entries(SUBS_BROKER).filter(([, l]) => l.includes(est.topico)).map(([b]) => +b);
      pos.forEach((p, i) => {
        D.nodo(ctx, p.x, p.y, `B${i + 1}`, { r: 18, relleno: i === est.origen ? C.s1 : interesados.includes(i) ? C.s6 : visto.has(i) ? VIZ.alfa(C.s2, 0.2) : C.superficie, texto: i === est.origen || interesados.includes(i) ? C.sobre : C.tinta });
        if (SUBS_BROKER[i]) D.etiqueta(ctx, SUBS_BROKER[i].length ? SUBS_BROKER[i].join(', ') : 'sin suscriptores', p.x, p.y + 32, { color: C.tinta2, tam: 10 });
      });
      const inundar = ARBOL.aristas.length;
      const inutiles = [...visto].filter((b) => !interesados.includes(b) && b !== est.origen && !usados.some(([x]) => x === b)).length;
      registro.textContent = est.modo === 'filtro'
        ? `Cada broker solo reenvía por los enlaces detrás de los cuales alguien se suscribió a «${est.topico}». El evento usa ${usados.length} de ${inundar} enlaces.`
        : `Con inundación el evento recorre los ${inundar} enlaces y llega a todos los brokers, aunque ${inutiles} no ${inutiles === 1 ? 'tiene' : 'tienen'} a quién entregarlo.`;
      lectura.set([
        ['mensajes', String(usados.length)],
        ['con inundación', String(inundar)],
        ['brokers interesados', String(interesados.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 24);
      if (i >= 0) { est.origen = i; dibujar(); }
    });
    dibujar();
  }

  VIZ.registrarTema('pub-sub', {
    intro: String.raw`
      <p>En el modelo <strong>publicación/suscripción</strong> los emisores (<em>publishers</em>) no envían mensajes a destinatarios concretos:
      publican <strong>eventos</strong>, y los receptores (<em>subscribers</em>) declaran qué eventos les interesan. Un intermediario, el
      <strong>broker</strong>, empareja unos con otros. Ninguno conoce al otro, ni necesita estar conectado al mismo tiempo: el desacoplamiento es en
      espacio, en tiempo y en sincronización.</p>
      <p>Es la base de las arquitecturas <strong>orientadas a eventos</strong> (Kafka, RabbitMQ, MQTT, Google Pub/Sub): un servicio anuncia
      «pedido creado» y otros reaccionan sin que el primero sepa cuántos ni cuáles son. La pregunta central es cuán expresivas son las
      suscripciones y cuánto cuesta evaluarlas.</p>`,
    visualizaciones: [
      {
        titulo: 'Filtros por tópico y por contenido',
        descripcion: 'Publique 100 eventos con cada tipo de filtro y compare la precisión. Por tópico, el broker solo mira la etiqueta del evento y los suscriptores reciben eventos que luego descartan.',
        montar: montarFiltros,
      },
      {
        titulo: 'Una red de brokers',
        descripcion: 'Con muchos brokers, las suscripciones se propagan por la red y cada broker reenvía un evento solo hacia donde hay interesados. Compare con la inundación.',
        montar: montarRed,
      },
    ],
    teoria: String.raw`
      <h2>Desacoplamiento</h2>
      <table>
        <tr><th>Dimensión</th><th>Significado</th></tr>
        <tr><td>Espacio</td><td>El publicador no sabe quiénes ni cuántos son los suscriptores.</td></tr>
        <tr><td>Tiempo</td><td>Pueden no estar activos a la vez si el broker almacena los eventos (comunicación persistente).</td></tr>
        <tr><td>Sincronización</td><td>Publicar no bloquea; la entrega es asíncrona (con <em>callbacks</em>).</td></tr>
      </table>
      <p>Comparada con <a href="tema.html?id=rpc">RPC</a>, que acopla a cliente y servidor en los tres sentidos, la mensajería orientada a eventos facilita
      agregar consumidores sin tocar a los productores, a cambio de perder el control explícito del flujo.</p>

      <h2>Expresividad de las suscripciones</h2>
      <ul>
        <li><strong>Por tópico</strong> (canal): el evento lleva una etiqueta, a veces jerárquica (<code>clima/chile/santiago</code>). Emparejar es buscar en una tabla: \(O(1)\).</li>
        <li><strong>Por contenido</strong>: la suscripción es un predicado sobre los atributos (\(\text{temp} &gt; 28 \land \text{ciudad} = \text{Lima}\)). Más precisa, pero emparejar
        un evento cuesta en el peor caso \(O(\#\text{suscripciones})\); se usan índices por atributo y árboles de decisión compartidos.</li>
        <li><strong>Por tipo</strong>: los eventos son objetos y se filtra por su clase.</li>
      </ul>
      <p>Si una fracción \(p\) de los eventos de un tópico satisface el filtro fino de un suscriptor, por tópico recibe \(1/p\) eventos por cada útil.</p>

      <h2>Enrutamiento entre brokers</h2>
      <p>En una red acíclica de brokers, cada uno mantiene, por enlace, el conjunto de suscripciones de los clientes que están «detrás». Un evento se reenvía por un
      enlace solo si satisface alguna de ellas (<em>filtrado en la red</em>, como en SIENA o Hermes). Las suscripciones se agregan con <strong>cobertura</strong>:
      si \(s_1\) cubre a \(s_2\) (todo evento que satisface \(s_2\) satisface \(s_1\)), basta propagar \(s_1\). La alternativa más simple, inundar todos los eventos,
      cuesta \(|B| - 1\) mensajes por evento sin importar el interés.</p>

      <h2>Garantías</h2>
      <p>Los brokers ofrecen entrega <em>a lo más una vez</em>, <em>al menos una vez</em> (con acuses y reintentos, lo que obliga a consumidores idempotentes) o
      <em>exactamente una vez</em> dentro de su propio sistema; y orden FIFO por publicador o por partición. Un orden total entre todos los suscriptores requiere
      <a href="tema.html?id=totally-ordered-multicast">multicast totalmente ordenado</a>.</p>`,
  });
})();
