(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: captura y burbujeo ---------- */

  const NIVELES = ['document', 'abuelo', 'padre', 'hijo'];
  const OPCIONES = [['nada', 'sin listener'], ['burbuja', 'listener (burbuja)'], ['captura', 'listener (captura)'], ['stop', 'listener + stopPropagation()']];

  function montarPropagacion(cuerpo) {
    const conf = { abuelo: 'burbuja', padre: 'burbuja', hijo: 'burbuja' };
    let objetivo = 3, paso = -1, secuencia = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    for (const k of ['abuelo', 'padre', 'hijo']) ctl.selector({ etiqueta: k, valor: conf[k], opciones: OPCIONES, alCambiar: (v) => { conf[k] = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'fase de captura (de arriba abajo)' }, { color: C.s2, texto: 'objetivo' }, { color: C.s6, texto: 'burbujeo (de abajo arriba)' }, { color: C.s4, texto: 'listener que se ejecuta' }, { color: C.s8, texto: 'propagación detenida' }]);
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un cuadro para disparar un <code>click</code> sobre él. Configure listeners y vea el orden de ejecución: captura hacia abajo, objetivo, burbujeo hacia arriba.');

    function iniciar() {
      paso = -1; secuencia = [];
      const ruta = NIVELES.slice(0, objetivo + 1);
      const fases = [];
      ruta.slice(0, -1).forEach((n, i) => fases.push({ n, i, fase: 'captura' }));
      fases.push({ n: ruta[ruta.length - 1], i: objetivo, fase: 'objetivo' });
      ruta.slice(0, -1).reverse().forEach((n) => fases.push({ n, i: NIVELES.indexOf(n), fase: 'burbujeo' }));
      let detenido = false;
      for (const f of fases) {
        if (detenido) break;
        const c = f.n === 'document' ? 'nada' : conf[f.n];
        const ejecuta = f.fase === 'objetivo' ? c !== 'nada' : f.fase === 'captura' ? c === 'captura' : (c === 'burbuja' || c === 'stop');
        secuencia.push({ ...f, ejecuta, para: ejecuta && c === 'stop' });
        if (ejecuta && c === 'stop') detenido = true;
      }
      return (function* () { for (let k = 0; k < secuencia.length; k++) { paso = k; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      geo = [];
      NIVELES.slice(1).forEach((n, d) => {
        const i = d + 1, x = 8 + d * 34, y = 8 + d * 22, w = Wd - 16 - d * 68, h = H - 16 - d * 44;
        const act = secuencia[paso] && secuencia[paso].n === n, f = act ? secuencia[paso] : null;
        const col = !f ? C.eje : f.fase === 'captura' ? C.s1 : f.fase === 'burbujeo' ? C.s6 : C.s2;
        ctx.fillStyle = f ? VIZ.alfa(col, 0.14) : C.superficie; ctx.strokeStyle = col; ctx.lineWidth = f ? 3 : 1.5;
        if (i === objetivo && !f) { ctx.strokeStyle = C.s2; ctx.setLineDash([5, 3]); }
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        const c = conf[n];
        W.texto(ctx, `${n}${c !== 'nada' ? ` · ${c === 'stop' ? 'stopPropagation' : c}` : ''}`, x + 8, y + 12, { tam: 10, peso: 600, alinear: 'left', color: f && f.ejecuta ? C.tinta : C.tinta2 });
        if (f && f.ejecuta) W.caja(ctx, x + w - 78, y + 3, 72, 18, f.para ? 'STOP' : 'ejecuta', { borde: f.para ? C.s8 : C.s4, relleno: VIZ.alfa(f.para ? C.s8 : C.s4, 0.3), tam: 10 });
        geo.push({ i, x, y, w, h });
      });
      lista.replaceChildren(...secuencia.map((f, k) => el('div', { class: k === paso ? 'activa' : null }, `${k + 1}. ${f.n} — ${f.fase}${f.ejecuta ? (f.para ? ' → handler + stopPropagation()' : ' → handler') : ' (sin handler)'}`)));
      const f = secuencia[paso];
      registro.textContent = !f ? `Objetivo: «${NIVELES[objetivo]}». Pulse «Un paso» para recorrer la propagación.` : `${f.fase === 'captura' ? 'Captura: el evento baja' : f.fase === 'objetivo' ? 'Fase de objetivo: el elemento clicado' : 'Burbujeo: el evento sube'} por ${f.n}${f.ejecuta ? ' y su listener se ejecuta' : ''}${f.para ? '; stopPropagation() impide que siga' : ''}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = [...geo].reverse().find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (g) { objetivo = g.i; rep.reiniciar(); }
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: eventos reales de un formulario ---------- */

  function montarFormulario(cuerpo) {
    const registroEv = [];
    let prevenir = true, envios = 0;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Escriba aquí (campo real)', valor: '' });
    ctl.casilla({ etiqueta: 'el handler llama a preventDefault()', valor: true, alCambiar: (v) => { prevenir = v; } });
    ctl.boton('Enviar formulario', () => enviar(), { primario: true });
    ctl.boton('Limpiar registro', () => { registroEv.length = 0; mostrar(); });
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Este campo es real: escriba, borre, salga de él y vuelva. Cada evento que el navegador dispara aparece abajo (el más reciente primero).');
    const input = campo.input;

    function anotar(tipo, detalle) { registroEv.unshift({ tipo, detalle }); if (registroEv.length > 12) registroEv.pop(); mostrar(); }
    function mostrar() {
      lista.replaceChildren(...(registroEv.length ? registroEv.map((e, k) => el('div', { class: k === 0 ? 'activa' : null }, `${e.tipo.padEnd(8)} ${e.detalle}`)) : [el('div', null, 'sin eventos todavía')]));
      lectura.set([['eventos registrados', String(registroEv.length)], ['valor actual', `«${input.value}»`], ['envíos', String(envios)]]);
    }
    for (const t of ['focus', 'blur']) input.addEventListener(t, () => anotar(t, t === 'focus' ? 'el campo recibe el foco' : 'el campo pierde el foco'));
    input.addEventListener('keydown', (e) => anotar('keydown', `tecla «${e.key}»`));
    input.addEventListener('input', () => anotar('input', `valor = «${input.value}» (en cada cambio)`));
    input.addEventListener('change', () => anotar('change', `valor confirmado = «${input.value}» (al salir del campo)`));
    function enviar() {
      envios++;
      anotar('submit', prevenir ? 'preventDefault(): la página NO se recarga; el script valida y envía con fetch' : 'sin preventDefault(): el navegador recarga la página y se pierde el estado');
      registro.textContent = prevenir ? 'El manejador toma el control del envío: puede validar y mostrar errores sin recargar.' : 'Sin preventDefault() el navegador haría su acción por omisión: enviar el formulario y recargar la página.';
    }
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    mostrar();
  }

  VIZ.registrarTema('dom-events', {
    intro: String.raw`
      <p>Una página interactiva es una página que <strong>reacciona</strong>: un clic, una tecla, un envío de formulario. El navegador convierte cada acción en un <em>evento</em>
      y avisa a los <em>listeners</em> registrados con <code>addEventListener</code>.</p>
      <p>Un clic sobre un botón también es un clic sobre su contenedor y sobre todos sus ancestros: el evento <strong>viaja</strong> por el árbol del DOM.
      Entender ese viaje (captura, objetivo, burbujeo) permite usar <em>delegación de eventos</em> y evitar errores sutiles.</p>`,
    visualizaciones: [
      { titulo: 'Propagación de un evento', descripcion: 'Haga clic en distintos cuadros y configure listeners de captura, de burbuja o con <code>stopPropagation()</code>: observe el orden de ejecución.', montar: montarPropagacion },
      { titulo: 'Eventos de un formulario real', descripcion: 'Escriba en el campo y salga de él; compare <code>input</code> con <code>change</code> y pruebe el envío con y sin <code>preventDefault()</code>.', montar: montarFormulario },
    ],
    teoria: String.raw`
      <h2>Fases de un evento</h2>
      <pre><code>1. captura   : window → document → … → padre del objetivo   (de arriba abajo)
2. objetivo  : el elemento que recibió la acción
3. burbujeo  : padre → … → document → window                  (de abajo arriba)</code></pre>
      <p>Por omisión <code>addEventListener(tipo, f)</code> escucha en el burbujeo; con <code>{ capture: true }</code> escucha en la captura. Para una ruta de profundidad \(d\) hay a lo más \(2d + 1\) invocaciones posibles.</p>
      <h2>Herramientas del objeto evento</h2>
      <ul>
        <li><code>event.target</code>: el elemento donde se originó; <code>event.currentTarget</code>: el que tiene el listener.</li>
        <li><code>event.stopPropagation()</code>: corta el viaje; <code>event.preventDefault()</code>: cancela la acción por omisión (enviar, seguir un enlace).</li>
      </ul>
      <h2>Delegación</h2>
      <p>En vez de registrar un listener por cada elemento de una lista de \(n\) ítems, se registra uno solo en el contenedor y se mira <code>event.target</code>. Cuesta \(O(1)\) listeners en lugar de \(O(n)\) y funciona con ítems agregados después.</p>
      <h2>Formularios</h2>
      <p><code>input</code> se dispara con cada cambio (validar mientras se escribe); <code>change</code>, al confirmar. El evento <code>submit</code> pertenece al <code>&lt;form&gt;</code>: un manejador típico llama <code>preventDefault()</code>, valida y envía los datos con <code>fetch</code>.</p>
      <div class="recuadro">Los eventos son la entrada de toda interfaz dinámica; en <a href="tema.html?id=component-tree-props">React</a> se declaran como propiedades (<code>onClick</code>) y el sistema los delega por usted.</div>`,
  });
})();
