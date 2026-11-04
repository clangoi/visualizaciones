(function () {
  'use strict';
  const { color: C } = VIZ;

  const ZONAS = ['Programa', 'Biblioteca', 'Núcleo'];
  const LLAMADAS = {
    open: { n: 2, args: 'ruta, banderas', ret: 'descriptor de archivo', trabajo: 'busca la ruta en el sistema de archivos, comprueba permisos y crea una entrada en la tabla de archivos abiertos' },
    read: { n: 0, args: 'fd, búfer, n', ret: 'bytes leídos', trabajo: 'copia datos del archivo (o los pide al disco) al búfer del proceso' },
    write: { n: 1, args: 'fd, búfer, n', ret: 'bytes escritos', trabajo: 'copia datos del búfer al archivo o dispositivo' },
    fork: { n: 57, args: '(ninguno)', ret: 'pid del hijo (0 en el hijo)', trabajo: 'duplica el proceso: nuevo PCB y copia perezosa del espacio de direcciones' },
    execve: { n: 59, args: 'ruta, argv, envp', ret: 'no vuelve si tiene éxito', trabajo: 'reemplaza el espacio de direcciones por el del nuevo programa' },
    exit: { n: 60, args: 'código', ret: 'no vuelve', trabajo: 'libera los recursos del proceso y avisa al padre' },
  };

  function montarLlamada(cuerpo) {
    let nom = 'read', k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Llamada', opciones: Object.keys(LLAMADAS).map((x) => [x, x + '()']), valor: nom, alCambiar: (v) => { nom = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'código del programa' }, { color: C.s2, texto: 'biblioteca (envoltorio)' }, { color: C.s3, texto: 'núcleo' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El número de la llamada es el índice en la tabla de llamadas del núcleo; el programa nunca salta directamente a código del núcleo.');
    const pasos = () => {
      const c = LLAMADAS[nom];
      return [
        [0, `El programa llama a ${nom}(${c.args}) como a cualquier función.`],
        [1, `El envoltorio de la biblioteca carga el número ${c.n} en el registro de la llamada y los argumentos en los registros siguientes.`],
        [1, 'Ejecuta la instrucción de trampa (syscall): la CPU pasa a modo núcleo y salta al punto de entrada.'],
        [2, `El núcleo consulta tabla_de_llamadas[${c.n}] y despacha al manejador de ${nom}.`],
        [2, `El manejador valida los argumentos (punteros, permisos) y ${c.trabajo}.`],
        [2, `Deja el resultado (${c.ret}) en un registro y vuelve a modo usuario.`],
        [1, 'El envoltorio convierte un resultado negativo en errno y devuelve −1, o devuelve el valor.'],
        [0, `${nom}() retorna al programa.`],
      ];
    };
    function iniciar() { k = 0; return (function* () { for (let j = 1; j <= 8; j++) { k = j; yield; } })(); }
    function dibujar() {
      const p = pasos();
      lienzo.limpiar();
      VIZ.sor.flujo(lienzo, ZONAS, p.map(([z]) => ({ z })), k);
      registro.textContent = k ? `${k}. ${p[k - 1][1]}` : 'Pulse «Un paso» para comenzar.';
      lectura.set([['número', String(LLAMADAS[nom].n)], ['argumentos', LLAMADAS[nom].args], ['devuelve', LLAMADAS[nom].ret]]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  function montarCosto(cuerpo) {
    let B = 64, c = 300, hover = null;
    const N = 4096; // bytes a escribir
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del búfer B (bytes)', min: 0, max: 8, paso: 1, valor: 6, formato: (v) => String(2 ** v), alCambiar: (v) => { B = 2 ** v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de una llamada (ns)', min: 100, max: 2000, paso: 100, valor: c, alCambiar: (v) => { c = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'un write por byte', forma: 'linea' }, { color: C.s1, texto: 'write de B bytes', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escribir n bytes: sin búfer cuesta n llamadas; con búfer de B bytes, ⌈n/B⌉ llamadas más el costo de copiar (1 ns por byte).');
    const sin = (n) => (n * (c + 1)) / 1000, con = (n) => (Math.ceil(n / B) * c + n) / 1000; // µs
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: N, ymin: 0, ymax: sin(N) * 1.05 }, { etiquetaX: 'bytes escritos', etiquetaY: 'tiempo (µs)' });
      plano.ejes();
      const pts = (f) => Array.from({ length: 65 }, (_, i) => [(i * N) / 64, f((i * N) / 64)]);
      VIZ.trazar(ctx, plano, pts(sin), C.s8, 2);
      VIZ.trazar(ctx, plano, pts(con), C.s1, 2);
      if (hover != null) { VIZ.marcador(ctx, plano.sx(hover), plano.sy(sin(hover)), C.s8, 4); VIZ.marcador(ctx, plano.sx(hover), plano.sy(con(hover)), C.s1, 4); }
      lectura.set([['llamadas sin búfer', VIZ.entero(N)], ['llamadas con búfer', VIZ.entero(Math.ceil(N / B))], ['tiempo sin búfer', `${VIZ.fmt(sin(N), 3)} µs`], ['tiempo con búfer', `${VIZ.fmt(con(N), 3)} µs`], ['aceleración', `${VIZ.fmt(sin(N) / con(N), 3)}×`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.round(plano.ix(x)); dibujar();
      tip.mostrar(x, y, `<b>${VIZ.entero(hover)}</b> bytes` + VIZ.filaTooltip(C.s8, 'sin búfer', VIZ.fmt(sin(hover), 3) + ' µs') + VIZ.filaTooltip(C.s1, 'con búfer', VIZ.fmt(con(hover), 3) + ' µs'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('system-calls', {
    intro: String.raw`
      <p>Una <strong>llamada al sistema</strong> es la puerta por la que un programa pide un servicio al núcleo: abrir un archivo, crear un proceso, enviar datos por la red.
      Para el programador parece una función más (<code>read</code>, <code>fork</code>), pero por dentro cruza la frontera entre <a href="tema.html?id=kernel-user-mode">modo usuario y modo núcleo</a>.</p>
      <p>Como cada cruce tiene un costo, los programas y las bibliotecas agrupan el trabajo: leer o escribir en bloques en vez de byte a byte.</p>`,
    visualizaciones: [
      { titulo: 'Anatomía de una llamada', descripcion: 'Elija una llamada y recorra su camino: envoltorio, trampa, tabla de llamadas, manejador y retorno.', montar: montarLlamada },
      { titulo: 'El costo de cruzar al núcleo', descripcion: 'Compare escribir byte a byte con escribir por bloques. Mueva el tamaño del búfer y el costo de cada llamada.', montar: montarCosto },
    ],
    teoria: String.raw`
      <h2>Interfaz</h2>
      <p>El sistema ofrece unas cientos de llamadas, agrupadas por función: procesos (<code>fork</code>, <code>exec</code>, <code>wait</code>, <code>exit</code>), archivos (<code>open</code>,
      <code>read</code>, <code>write</code>, <code>close</code>), memoria (<code>mmap</code>, <code>brk</code>), comunicación (<code>pipe</code>, <code>socket</code>) y control de dispositivos. Los programas
      rara vez las invocan directo: usan la biblioteca estándar (libc), que además aporta búferes.</p>
      <h2>Mecanismo</h2>
      <pre><code>envoltorio read(fd, buf, n):
    rax ← 0                  # número de la llamada
    rdi, rsi, rdx ← fd, buf, n
    syscall                  # trampa: modo núcleo
    si rax &lt; 0:  errno ← −rax;  devolver −1
    devolver rax</code></pre>
      <p>El núcleo indexa su tabla con el número, <strong>valida todos los argumentos</strong> (un puntero malo no debe permitir leer memoria ajena) y vuelve con el resultado.</p>
      <h2>Modelo de costo</h2>
      <p>Si una llamada cuesta \(c\) y copiar un byte \(b\), escribir \(n\) bytes con un búfer de \(B\) bytes cuesta</p>
      \[ T(n) = \left\lceil \frac{n}{B} \right\rceil c + n\,b, \]
      <p>frente a \(n(c+b)\) sin búfer. Con \(c \gg b\) la aceleración tiende a \(B\) hasta que el término \(nb\) domina. Este es el motivo de <code>fwrite</code> frente a <code>write</code> y del
      <a href="tema.html?id=io-buffering">doble búfer</a> en la E/S.</p>`,
  });
})();
