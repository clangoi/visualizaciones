(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarResolucion(cuerpo) {
    const base = (iter, cache) => cache
      ? [{ de: 0, a: 1, texto: '¿www.uc.cl?', color: C.s1, expl: 'El programa pregunta al resolvedor local.' }, { de: 1, a: 1, texto: 'respuesta en caché', color: C.s2, expl: 'El resolvedor ya conoce la respuesta (aún no vence su TTL): 0 consultas externas.' }, { de: 1, a: 0, texto: '200.89.1.5', color: C.s2 }]
      : iter
        ? [{ de: 0, a: 1, texto: '¿www.uc.cl?', color: C.s1, expl: 'El host pregunta a su resolvedor (recursivo para él).' },
          { de: 1, a: 2, texto: '¿www.uc.cl?', color: C.s3, expl: 'El resolvedor consulta un servidor raíz.' }, { de: 2, a: 1, texto: 'pregunte a los TLD «.cl»', color: C.s3, expl: 'La raíz no sabe la respuesta pero indica quién es responsable de «.cl» (referencia).' },
          { de: 1, a: 3, texto: '¿www.uc.cl?', color: C.s4, expl: 'El resolvedor consulta al servidor de «.cl».' }, { de: 3, a: 1, texto: 'pregunte a ns.uc.cl', color: C.s4 },
          { de: 1, a: 4, texto: '¿www.uc.cl?', color: C.s7, expl: 'Consulta al servidor autoritativo de uc.cl.' }, { de: 4, a: 1, texto: '200.89.1.5 (TTL 300)', color: C.s7, expl: 'El servidor autoritativo da la respuesta con su TTL; el resolvedor la guarda en caché.' },
          { de: 1, a: 0, texto: '200.89.1.5', color: C.s2, expl: 'El resolvedor responde al host.' }]
        : [{ de: 0, a: 1, texto: '¿www.uc.cl?', color: C.s1, expl: 'El host pregunta a su resolvedor.' }, { de: 1, a: 2, texto: '¿www.uc.cl?', color: C.s3, expl: 'Consulta recursiva: el resolvedor pide a la raíz que resuelva todo.' },
          { de: 2, a: 3, texto: '¿www.uc.cl?', color: C.s4, expl: 'La raíz consulta, a su vez, a «.cl».' }, { de: 3, a: 4, texto: '¿www.uc.cl?', color: C.s7, expl: '«.cl» consulta a uc.cl.' },
          { de: 4, a: 3, texto: '200.89.1.5', color: C.s7 }, { de: 3, a: 2, texto: '200.89.1.5', color: C.s4 }, { de: 2, a: 1, texto: '200.89.1.5', color: C.s3, expl: 'La respuesta vuelve por la cadena inversa; la carga recae en los servidores altos.' }, { de: 1, a: 0, texto: '200.89.1.5', color: C.s2 }];
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Host', 'Resolvedor', 'Raíz', '.cl (TLD)', 'uc.cl (autoritativo)'],
      etiquetaCaso: 'Consulta',
      casos: [{ id: 'it', nombre: 'Iterativa (lo habitual)', msgs: () => base(true, false) }, { id: 're', nombre: 'Recursiva', msgs: () => base(false, false) }, { id: 'ca', nombre: 'Con respuesta en caché', msgs: () => base(true, true) }],
      leyenda: [{ color: C.s1, texto: 'host' }, { color: C.s3, texto: 'raíz' }, { color: C.s4, texto: 'TLD' }, { color: C.s7, texto: 'autoritativo' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['consultas externas', String(c.id === 'ca' ? 0 : 3)], ['TTL de la respuesta', '300 s']],
    });
  }

  function montarCache(cuerpo) {
    let ttl = 60, nombres = 100, sem = 1, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Nombres distintos consultados', min: 10, max: 1000, paso: 10, valor: nombres, alCambiar: (v) => { nombres = v; dibujar(); } });
    ctl.boton('Nuevo tráfico', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'consultas respondidas desde la caché', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un resolvedor atiende 5 000 consultas durante una hora, con nombres de popularidad desigual (unos pocos concentran casi todo el tráfico). Un TTL mayor sube la tasa de aciertos, pero tarda más en propagar cambios.');
    let datos, plano;
    function simular(T) {
      const rnd = VIZ.semilla(sem * 71 + nombres), exp = Array(nombres).fill(-1); let hits = 0; const N = 5000;
      const pesos = Array.from({ length: nombres }, (_, i) => 1 / (i + 1)), tot = pesos.reduce((a, b) => a + b, 0);
      for (let q = 0; q < N; q++) {
        const t = (q / N) * 3600; let u = rnd() * tot, i = 0; while (u > pesos[i] && i < nombres - 1) { u -= pesos[i]; i++; }
        if (exp[i] > t) hits++; else exp[i] = t + T;
      }
      return hits / N;
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const Ts = [1, 5, 10, 30, 60, 120, 300, 600, 1200, 3600]; datos = Ts.map((T) => [T, simular(T)]);
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 3600, ymin: 0, ymax: 1 }, { logX: false, etiquetaX: 'TTL (s, escala log)', etiquetaY: 'tasa de aciertos', formatoY: (v) => `${Math.round(v * 100)} %`, ticksX: [] });
      const px = (T) => plano.x0 + (Math.log10(T) / Math.log10(3600)) * (plano.x1 - plano.x0);
      plano.ejes();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      [1, 10, 60, 600, 3600].forEach((T) => ctx.fillText(T >= 60 ? `${T / 60 >= 1 && T < 3600 ? T / 60 + ' min' : '1 h'}` : T + ' s', px(T), plano.y0 + 7));
      VIZ.trazar(ctx, { sx: px, sy: plano.sy }, datos, C.s1, 2.5);
      datos.forEach(([T, h]) => VIZ.marcador(ctx, px(T), plano.sy(h), C.s1, 3.5));
      dibujar.px = px;
      const d60 = datos.find((d) => d[0] === 60)[1];
      lectura.set([['TTL 60 s', `${VIZ.fmt(d60 * 100, 3)} %`], ['TTL 1 h', `${VIZ.fmt(datos[9][1] * 100, 3)} %`], ['consultas externas con TTL 60 s', VIZ.entero(5000 * (1 - d60))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!datos || !dibujar.px) return;
      const j = datos.reduce((a, d, i) => (Math.abs(dibujar.px(d[0]) - x) < Math.abs(dibujar.px(datos[a][0]) - x) ? i : a), 0);
      if (Math.abs(dibujar.px(datos[j][0]) - x) < 20) tip.mostrar(x, y, `TTL <b>${datos[j][0]}</b> s<br>aciertos ${VIZ.fmt(datos[j][1] * 100, 3)} %`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dns-hierarchy-caching', {
    intro: String.raw`
      <p>Las personas usan nombres (<code>www.uc.cl</code>) y las redes usan direcciones IP. El <strong>DNS</strong> (<em>Domain Name System</em>) es la base de datos distribuida que traduce unos en otras. Ningún servidor la tiene entera: está organizada en una <strong>jerarquía</strong> (raíz, dominios de primer nivel como «.cl» o «.com», y servidores autoritativos de cada organización).</p>
      <p>Un <strong>resolvedor</strong> recorre esa jerarquía por el usuario y guarda las respuestas en una <strong>caché</strong> durante un tiempo de vida (TTL), de modo que la mayoría de las consultas no salen del resolvedor.</p>`,
    visualizaciones: [
      { titulo: 'Resolver un nombre', descripcion: 'Compare la resolución iterativa, la recursiva y una respuesta guardada en caché. Cuente los mensajes de cada una.', montar: montarResolucion },
      { titulo: 'El efecto del TTL', descripcion: 'Un TTL mayor sube la tasa de aciertos de la caché. Cambie el número de nombres distintos.', montar: montarCache },
    ],
    teoria: String.raw`
      <h2>Jerarquía y registros</h2>
      <table class="tabla-datos"><tr><th class="izq">Registro</th><th class="izq">Contenido</th></tr>
      <tr><td class="izq">A / AAAA</td><td class="izq">dirección IPv4 / IPv6 del nombre</td></tr><tr><td class="izq">NS</td><td class="izq">servidor autoritativo del dominio</td></tr>
      <tr><td class="izq">CNAME</td><td class="izq">nombre alias de otro</td></tr><tr><td class="izq">MX</td><td class="izq">servidor de correo del dominio (ver <a href="tema.html?id=email-protocols">correo</a>)</td></tr></table>
      <h2>Iterativa y recursiva</h2>
      <p>En la consulta <strong>iterativa</strong>, cada servidor responde con una referencia («pregunte a este otro») y el resolvedor hace todo el recorrido. En la <strong>recursiva</strong> cada servidor consulta al siguiente por cuenta del anterior, cargando más trabajo a los servidores altos. En la práctica el host hace una consulta recursiva a su resolvedor y este hace consultas iterativas.</p>
      <h2>Caché</h2>
      <p>Si los nombres se consultan con popularidad tipo Zipf (el \(i\)-ésimo más popular con probabilidad \(\propto 1/i\)), unos pocos nombres concentran la mayor parte del tráfico y la tasa de aciertos sube rápido con el TTL. Cada nombre falla una vez por TTL, de modo que con \(n\) nombres y \(Q\) consultas por hora se esperan a lo más \(n \cdot 3600/\text{TTL}\) fallas.</p>
      <p>El tiempo medio de resolución es \(h\,t_{\text{caché}} + (1-h)\,t_{\text{completa}}\). El TTL es un compromiso entre eficiencia y actualidad (cambios de dirección tardan hasta un TTL en verse). DNS usa normalmente <a href="tema.html?id=sockets-client-server">UDP</a> en el puerto 53 y pasa a TCP si la respuesta es grande. Es el primer paso antes de abrir una conexión <a href="tema.html?id=http-latency">HTTP</a>.</p>`,
  });
})();
