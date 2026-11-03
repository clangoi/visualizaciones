(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => '$' + VIZ.fmt(v, 3);

  /* ---------- Fig. 1: productividad frente a riesgo ---------- */

  // M: minutos de la tarea hecha a mano; g: minutos en pedir y generar; vf: parte de M que cuesta verificar a fondo;
  // h: probabilidad base de un error grave del modelo; c: costo de un error que llega al cliente; rw: parte de M que cuesta rehacer.
  const CASOS = [
    { n: 'Redactar correos', M: 20, g: 3, vf: 0.35, h: 0.05, c: 30, rw: 0.5 },
    { n: 'Resumir reuniones', M: 30, g: 2, vf: 0.3, h: 0.08, c: 60, rw: 0.5 },
    { n: 'Atención por chat', M: 10, g: 1, vf: 0.2, h: 0.1, c: 150, rw: 0.6 },
    { n: 'Generar código', M: 90, g: 8, vf: 0.5, h: 0.15, c: 400, rw: 0.5 },
    { n: 'Informe financiero', M: 120, g: 10, vf: 0.7, h: 0.2, c: 2000, rw: 0.5 },
    { n: 'Opinión legal', M: 180, g: 10, vf: 0.9, h: 0.25, c: 8000, rw: 0.5 },
  ];
  const DETECCION = 0.85; // fracción de errores que la verificación humana atrapa

  function montarRiesgo(cuerpo) {
    let L = 0.3, f = 1, tolExp = 1.7, sel = 0, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Verificación humana de cada resultado', min: 0, max: 1, paso: 0.05, valor: L, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { L = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tendencia del modelo a inventar', min: 0.25, max: 2, paso: 0.05, valor: f, formato: (v) => `×${VIZ.fmt(v, 3)}`, alCambiar: (v) => { f = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pérdida tolerable por tarea', min: 0, max: 3.5, paso: 0.1, valor: tolExp, formato: (v) => dinero(10 ** v), alCambiar: (v) => { tolExp = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CASOS.map((k, i) => ({ color: VIZ.series[i], texto: k.n, forma: 'punto' })).concat([
      { color: C.tinta, texto: 'pérdida tolerable', forma: 'linea' },
      { color: C.apagado, texto: 'trayectoria: verificación de 0 a 100 %', forma: 'linea' },
    ]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada trayectoria muestra qué ocurre al verificar de 0 a 100 %: se avanza hacia menos riesgo pero también hacia menos tiempo ahorrado. Haga clic en un caso para ver su cálculo. Se considera viable un caso que ahorra al menos 20 % del tiempo y queda bajo la pérdida tolerable.');

    const tiempo = (k, l) => k.g + l * k.vf * k.M + k.h * f * l * DETECCION * k.rw * k.M;
    const ahorro = (k, l) => 1 - tiempo(k, l) / k.M;
    const riesgo = (k, l) => k.h * f * (1 - l * DETECCION) * k.c;
    const viable = (k) => ahorro(k, L) >= 0.2 && riesgo(k, L) <= 10 ** tolExp;

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -0.3, xmax: 1, ymin: 0.5, ymax: 5000 }, {
        logY: true, etiquetaX: 'tiempo ahorrado por tarea', etiquetaY: 'pérdida esperada por errores no detectados',
        formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: dinero,
      });
      pl.ejes();
      const tol = pl.sy(10 ** tolExp);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.x0, tol); ctx.lineTo(pl.x1, tol); ctx.stroke();
      const x20 = pl.sx(0.2);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x20, pl.y1); ctx.lineTo(x20, pl.y0); ctx.stroke(); ctx.restore();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('20 % ahorrado', x20 + 4, pl.y1 + 12);
      CASOS.forEach((k, i) => {
        const tray = [];
        for (let j = 0; j <= 20; j++) tray.push([ahorro(k, j / 20), Math.max(0.5, riesgo(k, j / 20))]);
        VIZ.trazar(ctx, pl, tray, VIZ.alfa(VIZ.series[i], 0.45), 2);
      });
      CASOS.forEach((k, i) => {
        const x = pl.sx(ahorro(k, L)), y = pl.sy(Math.max(0.5, riesgo(k, L)));
        if (i === sel) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke(); }
        VIZ.marcador(ctx, x, y, VIZ.series[i], i === hover ? 8 : 6.5, i);
        if (viable(k)) { ctx.font = VIZ.fuente(11, 700); ctx.fillStyle = C.s6; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('✓', x, y - 10); }
      });
      const k = CASOS[sel];
      registro.textContent = `${k.n}: a mano ${k.M} min; con IA, ${k.g} min para generar + ${VIZ.fmt(L * k.vf * k.M, 3)} min de verificación + ${VIZ.fmt(k.h * f * L * DETECCION * k.rw * k.M, 3)} min de rehacer = ${VIZ.fmt(tiempo(k, L), 3)} min (${VIZ.fmt(ahorro(k, L) * 100, 3)} % menos). Errores sin detectar: ${VIZ.fmt(k.h * f * (1 - L * DETECCION) * 100, 3)} % × ${dinero(k.c)} = ${dinero(riesgo(k, L))}.`;
      const v = CASOS.filter(viable);
      lectura.set([
        ['casos viables', `${v.length} de ${CASOS.length}`],
        ['tiempo ahorrado (caso elegido)', `${VIZ.fmt(ahorro(k, L) * 100, 3)} %`],
        ['errores sin detectar', `${VIZ.fmt(k.h * f * (1 - L * DETECCION) * 100, 3)} %`],
        ['pérdida esperada', dinero(riesgo(k, L))],
        ['sin verificar (L = 0)', dinero(riesgo(k, 0))],
        ['mejor caso', v.length ? v.reduce((a, b) => (ahorro(b, L) > ahorro(a, L) ? b : a)).n : 'ninguno'],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    const cerca = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = -1, dm = 14;
      CASOS.forEach((k, i) => { const d = Math.hypot(pl.sx(ahorro(k, L)) - x, pl.sy(Math.max(0.5, riesgo(k, L))) - y); if (d < dm) { dm = d; mejor = i; } });
      return { i: mejor, x, y };
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { i, x, y } = cerca(ev);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const k = CASOS[i];
      tip.mostrar(x, y, `<b>${k.n}</b><br>ahorro <b>${VIZ.fmt(ahorro(k, L) * 100, 3)} %</b><br>pérdida esperada <b>${dinero(riesgo(k, L))}</b>` + VIZ.filaTooltip(viable(k) ? C.s6 : C.s8, viable(k) ? 'viable' : 'no viable', null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { if (!pl) return; const { i } = cerca(ev); if (i >= 0) { sel = i; dibujar(); } });
    dibujar();
  }

  /* ---------- Fig. 2: un modelo de lenguaje en miniatura ---------- */

  const CORPUS = [
    'el cliente solicita un reembolso por el pedido atrasado.',
    'el cliente recibe una respuesta amable en el chat.',
    'el equipo revisa el informe antes de enviarlo al cliente.',
    'el equipo de soporte responde el correo del cliente en una hora.',
    'la empresa publica el informe de ventas cada mes.',
    'la empresa revisa el contrato con el proveedor antes de firmarlo.',
    'el proveedor envía la factura al equipo de finanzas.',
    'el equipo de finanzas revisa la factura antes de pagarla.',
    'el gerente aprueba el presupuesto del proyecto cada trimestre.',
    'el gerente revisa el informe de ventas del trimestre.',
    'el sistema registra el pedido del cliente en la base de datos.',
    'el sistema envía una respuesta automática al cliente.',
    'el cliente recibe la factura por correo cada mes.',
    'el proyecto cumple el presupuesto y el plazo del contrato.',
    'la empresa aprueba el reembolso del cliente en una hora.',
    'el equipo de soporte registra el reclamo en el sistema.',
  ];
  const INI = '<s>';
  const FRASES = CORPUS.map((s) => s.replace('.', ' .').split(' '));
  const TRIGRAMAS = new Set();
  const modelo = [new Map(), new Map(), new Map()]; // contexto de 0, 1 y 2 palabras → conteos de la siguiente
  for (const fr of FRASES) {
    const t = [INI, INI, ...fr];
    for (let i = 2; i < t.length; i++) {
      TRIGRAMAS.add(`${t[i - 2]} ${t[i - 1]} ${t[i]}`);
      for (let k = 0; k <= 2; k++) {
        const ctx = t.slice(i - k, i).join(' ');
        if (!modelo[k].has(ctx)) modelo[k].set(ctx, new Map());
        const m = modelo[k].get(ctx);
        m.set(t[i], (m.get(t[i]) || 0) + 1);
      }
    }
  }
  const ORACIONES = new Set(CORPUS);

  function montarGenerar(cuerpo) {
    let orden = 1, T = 1, semilla = 1, tokens = [], apoyo = [], dist = [], elegido = '', ent = [], pl = null, hover = -1;
    const NOMBRES = ['unigrama (ninguna palabra previa)', 'bigrama (1 palabra previa)', 'trigrama (2 palabras previas)'];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Palabras de contexto', min: 0, max: 2, paso: 1, valor: orden, formato: (v) => NOMBRES[v], alCambiar: (v) => { orden = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Temperatura (azar al elegir)', min: 0.2, max: 3, paso: 0.1, valor: T, alCambiar: (v) => { T = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Otra oración', () => { semilla++; rep.reiniciar(); });
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const lienzo = VIZ.lienzo(cuerpo, { alto: 8 * 26 + 24 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'palabra elegida en este paso', forma: 'cuadro' },
      { color: C.inactivo, texto: 'otra candidata', forma: 'cuadro' },
      { color: C.s6, texto: 'ficha: tres palabras seguidas que existen en el corpus', forma: 'cuadro' },
      { color: C.s8, texto: 'ficha: combinación nueva, nadie la escribió antes', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El «modelo» solo cuenta qué palabra sigue a qué contexto en 16 oraciones de una empresa y sortea la siguiente. Con 0 palabras de contexto suena a ruido; con 2 copia el corpus; con 1 suena fluido pero inventa combinaciones: eso es una alucinación en miniatura. Pase el cursor sobre una barra para ver su conteo.');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 7919 + orden * 13);
      tokens = []; apoyo = []; dist = []; elegido = ''; ent = [];
      registro.textContent = `Modelo de ${NOMBRES[orden]}. Pulse «Un paso» para sortear la primera palabra.`;
      return (function* () {
        for (let paso = 0; paso < 22; paso++) {
          const prev = [INI, INI, ...tokens];
          const ctx = prev.slice(prev.length - orden).join(' ');
          const cuentas = [...modelo[orden].get(ctx).entries()];
          const pesos = cuentas.map(([, c]) => c ** (1 / T));
          const tot = pesos.reduce((s, x) => s + x, 0);
          dist = cuentas.map(([w, c], i) => ({ w, c, p: pesos[i] / tot })).sort((a, b) => b.p - a.p);
          let r = rnd() * tot, e = dist[0];
          for (const d of dist) { r -= d.p * tot; if (r <= 0) { e = d; break; } }
          elegido = e.w;
          ent.push(-dist.reduce((s, d) => s + (d.p > 0 ? d.p * Math.log2(d.p) : 0), 0));
          const tri = `${prev[prev.length - 2]} ${prev[prev.length - 1]} ${e.w}`;
          tokens.push(e.w); apoyo.push(TRIGRAMAS.has(tri));
          registro.textContent = `Contexto «${ctx || '(ninguno)'}»: ${dist.length} candidatas. Se sortea «${e.w}» con probabilidad ${VIZ.fmt(e.p * 100, 3)} %.`;
          yield;
          if (e.w === '.') { registro.textContent += ' Fin de la oración.'; return; }
        }
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      fichas.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'Oración:'),
        ...(tokens.length ? tokens.map((t, i) => VIZ.ficha(t, { color: apoyo[i] ? C.s6 : C.s8 })) : [VIZ.el('span', { class: 'fichas-vacio' }, '(vacía)')]));
      const filas = dist.slice(0, 8), alto = 26, izq = 96, der = 56, y0 = 12;
      pl = { filas, alto, izq, der, y0 };
      const maxp = Math.max(0.01, ...filas.map((d) => d.p));
      ctx.font = VIZ.fuente(12); ctx.textBaseline = 'middle';
      filas.forEach((d, i) => {
        const y = y0 + i * alto, w = (d.p / maxp) * (W - izq - der);
        ctx.fillStyle = C.tinta; ctx.textAlign = 'right';
        ctx.fillText(d.w === '.' ? '(punto final)' : d.w, izq - 8, y + alto / 2);
        ctx.fillStyle = d.w === elegido && tokens.length ? C.s2 : C.inactivo;
        if (i === hover) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.7);
        ctx.beginPath(); ctx.roundRect(izq, y + 3, Math.max(2, w), alto - 6, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left';
        ctx.fillText(`${VIZ.fmt(d.p * 100, 3)} %`, izq + Math.max(2, w) + 6, y + alto / 2);
      });
      if (!filas.length) { ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText('Pulse «Un paso» o «Reproducir» para generar palabras.', 8, 24); }
      const n = tokens.length, ap = apoyo.filter(Boolean).length;
      const frase = tokens.join(' ').replace(' .', '.');
      const fin = tokens[n - 1] === '.';
      lectura.set([
        ['palabras generadas', String(n)],
        ['respaldo en el corpus', n ? `${Math.round((100 * ap) / n)} %` : '—'],
        ['opciones en este paso', String(dist.length || '—')],
        ['incertidumbre media', ent.length ? `${VIZ.fmt(ent.reduce((s, x) => s + x, 0) / ent.length, 3)} bits` : '—'],
        ['¿oración existente?', fin ? (ORACIONES.has(frase) ? 'copia textual' : 'oración nueva') : '—'],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      const i = Math.floor((y - pl.y0) / pl.alto);
      const nuevo = i >= 0 && i < pl.filas.length && x >= pl.izq ? i : -1;
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (nuevo < 0) return tip.ocultar();
      const d = pl.filas[nuevo];
      tip.mostrar(x, y, `<b>${d.w}</b><br>apareció <b>${d.c}</b> ${d.c === 1 ? 'vez' : 'veces'} tras este contexto<br>probabilidad <b>${VIZ.fmt(d.p * 100, 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('generative-ai-business', {
    intro: String.raw`
      <p>La <strong>IA generativa</strong> produce contenido nuevo (texto, código, imágenes) a partir de lo que aprendió de enormes cantidades de ejemplos. En las organizaciones ya se usa para redactar correos, resumir reuniones, escribir código, atender clientes y preparar borradores de informes. Su promesa es productividad: pasar de una hoja en blanco a un borrador en segundos.</p>
      <p>Su costo oculto es la <strong>verificación</strong>. Un modelo de lenguaje elige la palabra más plausible, no la más verdadera, y por eso puede escribir con total seguridad algo falso (una <em>alucinación</em>). Cuanto más caro sea un error, más tiempo hay que gastar revisando, y el ahorro se reduce. Estas figuras muestran ese intercambio y un modelo de lenguaje diminuto que permite ver de dónde sale.</p>`,
    visualizaciones: [
      {
        titulo: 'Productividad frente a riesgo',
        descripcion: 'Suba la verificación humana y vea cómo cada caso se mueve hacia menos riesgo y menos tiempo ahorrado. Pruebe bajar la pérdida tolerable: los casos de alto impacto, como la opinión legal, dejan de ser viables aunque ahorren tiempo.',
        montar: montarRiesgo,
      },
      {
        titulo: 'Un modelo de lenguaje en miniatura',
        descripcion: 'Genere una oración palabra por palabra con 0, 1 o 2 palabras de contexto y observe las probabilidades de cada paso. Con un contexto la oración suena bien pero puede ser nueva (fichas rojas); con dos copia el corpus (fichas verdes).',
        montar: montarGenerar,
      },
    ],
    teoria: String.raw`
      <h2>Usos y su perfil de riesgo</h2>
      <table>
        <tr><th>Uso</th><th>Qué gana</th><th>Qué se verifica</th><th>Riesgo si falla</th></tr>
        <tr><td>Redactar correos y textos</td><td>borrador inmediato</td><td>tono y datos</td><td>bajo</td></tr>
        <tr><td>Atención al cliente</td><td>respuesta 24/7</td><td>políticas y promesas</td><td>medio: reputación</td></tr>
        <tr><td>Generar código</td><td>menos escritura repetitiva</td><td>pruebas y seguridad</td><td>medio a alto</td></tr>
        <tr><td>Informes financieros o legales</td><td>estructura y primer análisis</td><td>cada cifra y cada cita</td><td>alto: multas, demandas</td></tr>
      </table>
      <h2>Modelo de productividad con verificación</h2>
      <p>Sea \(M\) el tiempo de hacer la tarea a mano, \(g\) el de pedirla y generarla, \(v\) la parte de \(M\) que cuesta verificar a fondo, \(L\) la fracción de resultados que se verifica, \(h\) la probabilidad de un error grave, \(d\) la fracción de errores que la verificación detecta y \(r\) la parte de \(M\) que cuesta rehacer. El tiempo con IA y la pérdida esperada son</p>
      \[ T(L) = g + L\,v\,M + h\,L\,d\,r\,M, \qquad R(L) = h\,(1 - L d)\,c . \]
      <p>El ahorro es \(1 - T/M\). Verificar más reduce \(R\) linealmente pero también reduce el ahorro: el equilibrio depende de \(c\), el costo de un error no detectado.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Código: \(M = 90\), \(g = 8\), \(v = 0{,}5\), \(h = 0{,}15\), \(r = 0{,}5\), \(d = 0{,}85\), \(c = 400\). Sin verificar, \(T = 8\) min (ahorro 91 %) pero \(R = 0{,}15 \cdot 400 = 60\) por tarea. Con \(L = 1\): \(T = 8 + 45 + 0{,}15 \cdot 0{,}85 \cdot 45 \approx 58{,}7\) min (ahorro 35 %) y \(R = 0{,}15 \cdot 0{,}15 \cdot 400 = 9\). Se cambian 56 puntos de ahorro por una pérdida casi siete veces menor.</p></div>
      <h2>Cómo genera texto un modelo de lenguaje</h2>
      <p>Un modelo de \(k\) palabras de contexto estima \(P(w_t \mid w_{t-k}, \dots, w_{t-1})\) y sortea la siguiente palabra. El que muestra la figura cuenta frecuencias en un corpus de 16 oraciones; los modelos reales usan <a href="tema.html?id=attention-mechanism">redes con atención</a> en lugar de conteos y miles de millones de palabras, pero el mecanismo de producir una palabra por vez, según probabilidades, es el mismo (ver <a href="tema.html?id=next-token-prediction">predicción del siguiente token</a> y <a href="tema.html?id=autoregressive-generation">generación autorregresiva</a>). La <em>temperatura</em> \(T\) reescala las probabilidades:</p>
      \[ p_i = \frac{c_i^{1/T}}{\sum_j c_j^{1/T}} . \]
      <p>Con \(T\) baja gana siempre la palabra más frecuente (texto repetitivo); con \(T\) alta las candidatas se igualan (texto errático). Ninguna de las dos garantiza verdad: el modelo es fluido por construcción, no veraz.</p>
      <h2>Gestión del riesgo</h2>
      <ul>
        <li>Verifique de acuerdo con el costo del error, no con la fluidez del texto.</li>
        <li>Reduzca alucinaciones con fuentes controladas (recuperación de documentos de la empresa) y citas comprobables.</li>
        <li>No ingrese datos confidenciales a servicios externos: vea <a href="tema.html?id=ai-adoption-risks">riesgos de adoptar IA</a>.</li>
        <li>Mida el efecto real en tiempo y calidad antes de generalizarlo: <a href="tema.html?id=intelligent-automation">automatización inteligente</a>.</li>
      </ul>`,
  });
})();
