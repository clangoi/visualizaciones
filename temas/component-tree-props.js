(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: flujo de datos y re-renderizado ---------- */

  function montarFlujo(cuerpo) {
    const est = { item: 1, memo: false };
    let hechos = [false, false, false], renders = new Set(), fase = 0, total = 0, nodos = [];
    const arbolDef = () => ({ id: 'App', texto: 'App', hijos: [{ id: 'Header', texto: 'Header', hijos: [] }, { id: 'Lista', texto: 'Lista', hijos: [0, 1, 2].map((i) => ({ id: `Item${i}`, texto: `Item ${i + 1}`, hijos: [] })) }, { id: 'Resumen', texto: 'Resumen', hijos: [] }] });
    const raiz = arbolDef();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Elemento que se marca', valor: String(est.item), opciones: [['0', 'Item 1'], ['1', 'Item 2'], ['2', 'Item 3']], alCambiar: (v) => { est.item = +v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'React.memo en los componentes', valor: false, alCambiar: (v) => { est.memo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 250 : 230) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'evento (sube por callbacks)' }, { color: C.s1, texto: 'se vuelve a renderizar' }, { color: C.s6, texto: 'estado actualizado' }, { color: C.eje, texto: 'no se renderiza' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los <b>datos bajan</b> como props; los <b>eventos suben</b> como funciones. Active <code>React.memo</code> y compare cuántos componentes se vuelven a renderizar.');

    const ACT = ['Haga clic en «Un paso»: el usuario marcará un elemento.', 'El clic ocurre en el Item: se llama a la función onToggle que recibió como prop.', 'La función sube hasta App, que es la dueña del estado: setHechos(…) cambia el estado.', 'App se renderiza de nuevo con el estado nuevo.', 'React renderiza los hijos cuyas props cambiaron (o todos, si no hay memo).'];
    function cambian() {
      const ids = ['App', 'Lista', `Item${est.item}`, 'Resumen'];
      if (!est.memo) ids.push('Header', 'Item0', 'Item1', 'Item2');
      return new Set(ids);
    }
    function iniciar() {
      hechos = [false, false, false]; renders = new Set(); fase = 0; total = 0;
      return (function* () {
        fase = 1; yield;
        fase = 2; yield;
        fase = 3; hechos[est.item] = true; renders = new Set(['App']); total = 1; yield;
        fase = 4; renders = cambian(); total = renders.size; yield;
      })();
    }
    function dibujar() {
      lienzo.limpiar();
      nodos = W.arbol(lienzo.ctx, raiz, lienzo.ancho, lienzo.alto, (n) => {
        if (fase >= 3 && n.id === 'App') return { relleno: VIZ.alfa(C.s6, 0.25), borde: C.s6 };
        if (fase >= 3 && renders.has(n.id)) return { relleno: VIZ.alfa(C.s1, 0.25), borde: C.s1 };
        if (fase >= 1 && fase < 3 && n.id === `Item${est.item}`) return { relleno: VIZ.alfa(C.s2, 0.25), borde: C.s2 };
        return {};
      }, { alturaNodo: 28, tam: lienzo.ancho < 600 ? 10 : 11 });
      if (fase === 2) {
        const it = nodos.find((n) => n.id === `Item${est.item}`), lis = nodos.find((n) => n.id === 'Lista'), app = nodos.find((n) => n.id === 'App');
        VIZ.dist.flecha(lienzo.ctx, it.x, it.y, lis.x, lis.y + lis.h, { color: C.s2, ancho: 2.5 });
        VIZ.dist.flecha(lienzo.ctx, lis.x, lis.y, app.x, app.y + app.h, { color: C.s2, ancho: 2.5 });
      }
      registro.textContent = ACT[fase];
      lectura.set([['estado de App', `[${hechos.map((h) => (h ? '✔' : '·')).join(' ')}]`], ['componentes renderizados', fase >= 3 ? `${total} de ${nodos.length}` : '—'], ['memo', est.memo ? 'activo' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = nodos.find((q) => x >= q.x - q.w / 2 && x <= q.x + q.w / 2 && y >= q.y && y <= q.y + q.h);
      if (!n) return tip.ocultar();
      const props = { App: 'sin props (guarda el estado)', Header: 'titulo', Lista: 'items, onToggle', Resumen: 'hechos' }[n.id] || 'item, onToggle';
      tip.mostrar(x, y, `<b>${n.texto}</b><br>props: ${props}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: formulario controlado y renderizado condicional ---------- */

  function montarControlado(cuerpo) {
    let nombre = '', mayus = false, renders = 1;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: '<input value={nombre} onChange=…>', valor: nombre });
    ctl.casilla({ etiqueta: 'el manejador convierte a mayúsculas', valor: false, alCambiar: (v) => { mayus = v; actualizar(nombre); } });
    ctl.boton('Borrar estado', () => actualizar(''));
    const salida = el('div', { class: 'fichas' });
    cuerpo.appendChild(el('pre', { class: 'codigo-bdd' }, 'function Saludo() {\n  const [nombre, setNombre] = useState("");\n  return (\n    <>\n      <input value={nombre} onChange={e => setNombre(e.target.value)} />\n      {nombre ? <h2>Hola, {nombre}</h2> : <p>Escriba su nombre</p>}\n    </>\n  );\n}'));
    cuerpo.appendChild(salida);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El campo es <em>controlado</em>: lo que muestra siempre sale del estado. Escriba y observe cómo cada tecla provoca un nuevo renderizado.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function actualizar(v) {
      nombre = mayus ? v.toUpperCase() : v; campo.valor = nombre; renders++; mostrar();
    }
    campo.input.addEventListener('input', () => actualizar(campo.input.value));
    function mostrar() {
      salida.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Resultado:'), nombre ? VIZ.ficha(`<h2>Hola, ${nombre}</h2>`, { color: C.s6, fondo: VIZ.alfa(C.s6, 0.2) }) : VIZ.ficha('<p>Escriba su nombre</p>', { color: C.inactivo }));
      registro.textContent = nombre ? 'El estado no está vacío: el operador ternario elige la primera rama.' : 'El estado está vacío: se renderiza la rama alternativa.';
      lectura.set([['estado nombre', `"${nombre}"`], ['renderizados', String(renders)], ['rama', nombre ? 'Hola, …' : 'indicación']]);
    }
    mostrar();
  }

  VIZ.registrarTema('component-tree-props', {
    intro: String.raw`
      <p>React construye una interfaz como un <strong>árbol de componentes</strong>: funciones que reciben datos (<em>props</em>) y devuelven una descripción de lo que debe verse (JSX).
      Un componente pequeño se reutiliza, se compone dentro de otros y se prueba por separado.</p>
      <p>Lo que cambia con el tiempo es el <strong>estado</strong>. La regla central es el flujo <em>unidireccional</em>: los datos bajan por las props y los eventos suben por callbacks hasta el componente que posee el estado. React vuelve a renderizar lo afectado: la interfaz es una función del estado.</p>`,
    visualizaciones: [
      { titulo: 'Datos que bajan, eventos que suben', descripcion: 'Avance paso a paso desde el clic en un elemento hasta el nuevo renderizado. Active <code>React.memo</code> y cuente qué componentes se evitan.', montar: montarFlujo },
      { titulo: 'Formulario controlado y renderizado condicional', descripcion: 'Escriba en el campo: el valor sale del estado y una expresión condicional decide qué mostrar. Active la conversión a mayúsculas.', montar: montarControlado },
    ],
    teoria: String.raw`
      <h2>La interfaz como función</h2>
      \[ \text{UI} = f(\text{estado},\ \text{props}). \]
      <p>El componente no modifica el DOM; devuelve una descripción. Si no cambia el estado ni las props, el resultado es el mismo. Esa pureza permite a React decidir cuándo y qué actualizar (ver <a href="tema.html?id=virtual-dom-reconciliation">reconciliación</a>).</p>
      <h2>Props y estado</h2>
      <table>
        <tr><th></th><th>Props</th><th>Estado</th></tr>
        <tr><td>Quién lo define</td><td>el componente padre</td><td>el propio componente</td></tr>
        <tr><td>¿Se puede modificar?</td><td>no (solo lectura)</td><td>sí, con <code>setState</code></td></tr>
        <tr><td>Cambiarlo provoca</td><td>re-render del hijo</td><td>re-render del componente y sus hijos</td></tr>
      </table>
      <h2>Dónde poner el estado</h2>
      <p>Si dos componentes necesitan el mismo dato, el estado se «eleva» al ancestro común más cercano y se pasa hacia abajo. Pasar datos por muchos niveles intermedios se llama <em>prop drilling</em>; se alivia con composición (<code>children</code>) o contexto.</p>
      <h2>Renderizado condicional y listas</h2>
      <pre><code>{cargando ? &lt;Spinner /&gt; : &lt;Lista items={items} /&gt;}
{error &amp;&amp; &lt;Aviso mensaje={error} /&gt;}
{items.map(i =&gt; &lt;Item key={i.id} item={i} /&gt;)}</code></pre>
      <p>Cada elemento de una lista necesita una <code>key</code> estable. En un árbol de \(n\) componentes, un cambio de estado en la raíz re-renderiza hasta \(n\) funciones; por eso conviene mantener el estado lo más cerca posible de quien lo usa.</p>`,
  });
})();
