(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: casos ---------- */

  const CASOS = {
    tienda: {
      nombre: 'Una tienda en línea guarda dirección y compras para despachar',
      base: 'ejecución de un contrato', sensible: false,
      principios: ['finalidad', 'proporcionalidad', 'seguridad'],
      bien: 'Puede tratar los datos necesarios para cumplir la compra sin pedir un consentimiento aparte.',
      riesgo: 'Usar el historial de compras para perfilar y vender publicidad es otra finalidad: necesita su propia base de licitud.',
    },
    marketing: {
      nombre: 'La misma tienda quiere enviar publicidad por correo',
      base: 'consentimiento (o interés legítimo, evaluado caso a caso)', sensible: false,
      principios: ['licitud y lealtad', 'transparencia e información', 'finalidad'],
      bien: 'Con consentimiento libre, específico e informado, o tras ponderar un interés legítimo, puede hacerlo.',
      riesgo: 'La persona puede oponerse en cualquier momento al tratamiento con fines de marketing directo.',
    },
    clinica: {
      nombre: 'Una clínica comparte fichas con investigadores',
      base: 'consentimiento o una excepción legal para investigación, con resguardos', sensible: true,
      principios: ['finalidad', 'proporcionalidad', 'confidencialidad', 'seguridad'],
      bien: 'Los datos de salud son sensibles: lo recomendable es entregar datos anonimizados o seudonimizados y solo lo necesario.',
      riesgo: 'Entregar fichas con RUT «porque son investigadores» vulnera la proporcionalidad; quitar el RUT sin más no anonimiza (vea re-identificación).',
    },
    filtracion: {
      nombre: 'Una empresa sufre una filtración de su base de clientes',
      base: '— (incidente de seguridad)', sensible: false,
      principios: ['seguridad', 'responsabilidad'],
      bien: 'Debe reportar la vulneración a la Agencia por los medios más expeditos y, si hay datos sensibles o de riesgo, comunicarla a los afectados.',
      riesgo: 'Ocultar el incidente o no haber adoptado medidas de seguridad apropiadas agrava la infracción.',
    },
    acceso: {
      nombre: 'Un cliente pide saber qué datos suyos tiene un banco',
      base: '— (ejercicio de derechos)', sensible: false,
      principios: ['transparencia e información', 'responsabilidad'],
      bien: 'Es el derecho de acceso: el banco debe responder dentro del plazo legal e informar qué datos tiene, de dónde vienen y para qué los usa.',
      riesgo: 'No responder, o cobrar por una solicitud ordinaria, es una infracción.',
    },
    algoritmo: {
      nombre: 'Un sistema rechaza créditos de forma automática',
      base: 'contrato o consentimiento, con garantías adicionales', sensible: false,
      principios: ['transparencia e información', 'calidad', 'lealtad'],
      bien: 'La persona tiene derecho a no quedar sujeta a decisiones basadas solo en tratamiento automatizado que la afecten significativamente, con excepciones y resguardos como la intervención humana.',
      riesgo: 'Un modelo entrenado con datos inexactos o sesgados vulnera además el principio de calidad.',
    },
  };
  const PRINCIPIOS = ['licitud y lealtad', 'finalidad', 'proporcionalidad', 'calidad', 'responsabilidad', 'seguridad', 'transparencia e información', 'confidencialidad'];

  function montarCasos(cuerpo) {
    let caso = 'clinica';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Caso', valor: caso, opciones: Object.entries(CASOS).map(([k, c]) => [k, c.nombre]), alCambiar: (v) => { caso = v; dibujar(); } });
    const fichas = el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'principio en juego en este caso' },
      { color: C.s8, texto: 'involucra datos sensibles' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Casos simplificados con fines de estudio; no son asesoría legal. Para un caso real consulte el texto de la ley y las instrucciones de la Agencia.');
    function dibujar() {
      const c = CASOS[caso];
      fichas.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Principios:'),
        ...PRINCIPIOS.map((p) => VIZ.ficha(p, c.principios.includes(p) ? { color: C.s1, fondo: C.s1, tinta: C.sobre } : { color: C.inactivo, tinta: C.inactivo })),
        ...(c.sensible ? [VIZ.ficha('datos sensibles', { color: C.s8, fondo: C.s8, tinta: C.sobre })] : []));
      registro.textContent = `${c.bien}\nCuidado: ${c.riesgo}`;
      lectura.set([['base de licitud', c.base], ['¿dato sensible?', c.sensible ? 'sí' : 'no'], ['principios en juego', String(c.principios.length)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: escala de multas ---------- */

  const TOPES = [['leve', 5000, C.s4], ['grave', 10000, C.s2], ['gravísima', 20000, C.s8]];

  function montarMultas(cuerpo) {
    let utm = 69000, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Valor de la UTM (ajústelo al mes vigente)', min: 60000, max: 80000, paso: 500, valor: utm, formato: (v) => `$${VIZ.entero(v)}`, alCambiar: (v) => { utm = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 200, altoMax: 280 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, TOPES.map(([t, , c]) => ({ color: c, texto: `infracción ${t}` })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Topes máximos por categoría según el texto publicado; la multa concreta se gradúa según la gravedad, el daño, la reincidencia y la colaboración.');
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 90, fh = (H - 20) / TOPES.length, max = 20000;
      geo = [];
      TOPES.forEach(([t, u, c], i) => {
        const angosto = W < 560, y = 10 + i * fh, w = ((W - izq - (angosto ? 90 : 220)) * u) / max;
        B.texto(ctx, t, izq - 10, y + fh / 2, { alinear: 'right', px: 12, color: C.tinta });
        ctx.fillStyle = hover === i ? VIZ.alfa(c, 0.75) : c;
        ctx.beginPath(); ctx.roundRect(izq, y + fh * 0.2, w, fh * 0.6, [0, 4, 4, 0]); ctx.fill();
        B.texto(ctx, angosto ? `${VIZ.entero(u)} UTM` : `${VIZ.entero(u)} UTM ≈ $${VIZ.entero((u * utm) / 1e6)} millones`, izq + w + 8, y + fh / 2, { px: 11 });
        geo.push({ y, h: fh, i });
      });
      lectura.set(TOPES.map(([t, u]) => [`tope ${t}`, `$${VIZ.entero(u * utm)}`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => y >= q.y && y < q.y + q.h);
      hover = g ? g.i : null; dibujar();
      if (!g) return tip.ocultar();
      const [t, u] = TOPES[g.i];
      tip.mostrar(x, y, `infracción <b>${t}</b><br>hasta ${VIZ.entero(u)} UTM<br>≈ $${VIZ.entero(u * utm)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('ley-21719', {
    intro: String.raw`
      <p>La <strong>Ley 21.719</strong>, publicada en diciembre de 2024, reemplaza en lo sustancial a la antigua Ley 19.628 sobre protección
      de la vida privada y acerca a Chile a estándares como el Reglamento General de Protección de Datos europeo. Crea la <strong>Agencia
      de Protección de Datos Personales</strong>, con facultades para fiscalizar y sancionar, y fija principios, bases de licitud, derechos de
      los titulares y un régimen de infracciones.</p>
      <p>Para quien diseña bases de datos, la ley se traduce en decisiones técnicas: qué columnas recolectar, cuánto tiempo guardarlas, quién
      puede verlas, cómo responder a una solicitud de acceso o supresión y qué hacer ante una filtración.</p>
      <div class="recuadro">Esta página resume la ley con fines de estudio y no es asesoría legal. Su entrada en vigencia está fijada para
      el 1 de diciembre de 2026, pero a octubre de 2026 se tramita en el Senado un proyecto para postergarla un año. Verifique siempre el
      texto vigente en la Biblioteca del Congreso Nacional (bcn.cl) y las instrucciones de la Agencia.</div>`,
    visualizaciones: [
      {
        titulo: 'Casos y principios',
        descripcion: 'Seis situaciones típicas. Para cada una, qué base de licitud aplica, qué principios están en juego y dónde está el riesgo.',
        montar: montarCasos,
      },
      {
        titulo: 'Escala de infracciones',
        descripcion: 'Topes de las multas por categoría de infracción, en UTM y en pesos según el valor de la UTM que elija.',
        montar: montarMultas,
      },
    ],
    teoria: String.raw`
      <h2>Conceptos</h2>
      <ul>
        <li><strong>Dato personal</strong>: información sobre una persona natural identificada o identificable. Incluye los
        <a href="tema.html?id=tipos-atributos">cuasi-identificadores</a>.</li>
        <li><strong>Datos sensibles</strong>: entre otros, los de salud, origen étnico o racial, vida u orientación sexual, convicciones
        religiosas o políticas, afiliación sindical, y datos biométricos o genéticos. Tienen reglas reforzadas.</li>
        <li><strong>Responsable</strong>: quien decide los fines y medios del tratamiento. <strong>Encargado</strong>: quien trata datos por
        cuenta del responsable (por ejemplo, un proveedor de nube).</li>
        <li><strong>Anonimización</strong> y <strong>seudonimización</strong>: la ley las distingue; los datos seudonimizados siguen siendo
        datos personales (vea <a href="tema.html?id=de-identificacion">de-identificación</a>).</li>
      </ul>

      <h2>Principios</h2>
      <table>
        <tr><th>Principio</th><th>En términos de bases de datos</th></tr>
        <tr><td>licitud y lealtad</td><td>tener una base legal para cada tratamiento</td></tr>
        <tr><td>finalidad</td><td>usar los datos solo para fines explícitos y compatibles con los declarados</td></tr>
        <tr><td>proporcionalidad</td><td>recolectar solo las columnas necesarias y guardarlas solo el tiempo necesario</td></tr>
        <tr><td>calidad</td><td>datos exactos y actualizados (restricciones de integridad, procesos de corrección)</td></tr>
        <tr><td>responsabilidad</td><td>poder demostrar el cumplimiento: registros, políticas, evaluaciones de impacto</td></tr>
        <tr><td>seguridad</td><td>medidas técnicas y organizativas apropiadas al riesgo (<a href="tema.html?id=seguridad">seguridad</a>)</td></tr>
        <tr><td>transparencia e información</td><td>informar qué se trata, para qué y con quién se comparte</td></tr>
        <tr><td>confidencialidad</td><td>el deber de reserva de quienes acceden a los datos</td></tr>
      </table>

      <h2>Bases de licitud</h2>
      <p>El tratamiento es lícito con el <strong>consentimiento</strong> del titular (libre, informado, específico e inequívoco, y revocable)
      o cuando se basa en otra fuente legal, como la ejecución de un contrato, el cumplimiento de una obligación legal, el interés legítimo
      del responsable (ponderado frente a los derechos del titular) o el ejercicio de funciones públicas.</p>

      <h2>Derechos del titular</h2>
      <p>Acceso, rectificación, supresión, oposición, portabilidad y bloqueo (a veces abreviados ARCOP), además del derecho a no ser objeto
      de decisiones basadas únicamente en tratamiento automatizado que produzcan efectos significativos. El responsable debe responder las
      solicitudes en un plazo breve fijado por la ley; en el diseño, eso exige poder encontrar <em>todas</em> las filas de una persona,
      incluidos respaldos, réplicas y tablas derivadas.</p>

      <h2>Incidentes e infracciones</h2>
      <p>Las vulneraciones de seguridad deben reportarse a la Agencia y, en ciertos casos, a los afectados. Las infracciones se clasifican en
      leves, graves y gravísimas, con multas de hasta 5 000, 10 000 y 20 000 UTM respectivamente, y montos mayores ligados a los ingresos
      para empresas reincidentes que no son de menor tamaño. Existe un registro de sanciones y la posibilidad de adoptar modelos de
      prevención de infracciones que se consideran al graduar la multa.</p>
      <p>Las técnicas de esta sección (<a href="tema.html?id=anonimizacion">anonimización</a>,
      <a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a>,
      <a href="tema.html?id=tecnicas-privacidad">técnicas de privacidad</a>) son formas concretas de cumplir los principios de
      proporcionalidad y seguridad.</p>`,
  });
})();
