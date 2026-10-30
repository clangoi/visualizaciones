(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Métricas definidas por recursión estructural ---------- */

  const MET = {
    prof: {
      nombre: 'profundidad', base: () => 0, un: (a) => 1 + a, bin: (a, b) => 1 + Math.max(a, b),
      reglaUn: (a, v) => `prof(¬A) = 1 + prof(A) = 1 + ${a} = ${v}`, reglaBin: (a, b, v) => `prof(A ∘ B) = 1 + máx(${a}, ${b}) = ${v}`, reglaBase: 'prof(p) = 0',
    },
    tam: {
      nombre: 'tamaño (nodos)', base: () => 1, un: (a) => 1 + a, bin: (a, b) => 1 + a + b,
      reglaUn: (a, v) => `tam(¬A) = 1 + tam(A) = 1 + ${a} = ${v}`, reglaBin: (a, b, v) => `tam(A ∘ B) = 1 + ${a} + ${b} = ${v}`, reglaBase: 'tam(p) = 1',
    },
    hojas: {
      nombre: 'número de hojas', base: () => 1, un: (a) => a, bin: (a, b) => a + b,
      reglaUn: (a, v) => `hojas(¬A) = hojas(A) = ${v}`, reglaBin: (a, b, v) => `hojas(A ∘ B) = ${a} + ${b} = ${v}`, reglaBase: 'hojas(p) = 1',
    },
    conect: {
      nombre: 'conectivos binarios', base: () => 0, un: (a) => a, bin: (a, b) => 1 + a + b,
      reglaUn: (a, v) => `bin(¬A) = bin(A) = ${v}`, reglaBin: (a, b, v) => `bin(A ∘ B) = 1 + ${a} + ${b} = ${v}`, reglaBase: 'bin(p) = 0',
    },
  };

  /* ---------- Fig. 1: de las hojas a la raíz ---------- */

  function montarRecursion(cuerpo) {
    let clave = 'tam', ast = D.leer('(p ∧ ¬q) → (r ∨ p)'), orden = [], valores = new Map(), k = 0, mensaje = '', error = '';
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: 'p ∧ ¬q → r ∨ p', alCambiar: (r) => { if (r.error) { error = D.mensaje(campo.valor, r); return mostrarError(); } error = ''; ast = r.ast; lienzo.ajustar(true); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Función', opciones: Object.entries(MET).map(([c, v]) => [c, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'nodo que se calcula en este paso', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta, texto: 'valor ya calculado (se muestra debajo)', forma: 'cuadro' },
      { color: C.neutro, borde: C.inactivo, texto: 'pendiente', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El cálculo va de las hojas hacia la raíz: cada nodo se resuelve cuando ya se conoce el valor de sus hijos. Cambie la fórmula o la función.');

    function mostrarError() { registro.textContent = error; }
    function iniciar() {
      orden = []; valores = new Map(); k = 0; mensaje = '';
      const M = MET[clave];
      (function post(a) {
        D.hijos(a).forEach(post);
        orden.push(a);
      })(ast);
      return (function* () {
        for (const a of orden) {
          const h = D.hijos(a).map((x) => valores.get(x));
          let v, txt;
          if (h.length === 0) { v = M.base(); txt = M.reglaBase.replace('p', D.etiqueta(a)); }
          else if (h.length === 1) { v = M.un(h[0]); txt = M.reglaUn(h[0], v).replace('¬', D.etiqueta(a)); }
          else { v = M.bin(h[0], h[1]); txt = M.reglaBin(h[0], h[1], v).replace('∘', D.etiqueta(a)); }
          valores.set(a, v); k++; mensaje = `${D.texto(a)}:  ${txt}`;
          yield;
        }
      })();
    }
    function dibujar() {
      lienzo.limpiar();
      const ultimo = k ? orden[k - 1] : null;
      D.arbol(lienzo, ast, {
        relleno: (r) => (r.n === ultimo ? VIZ.alfa(C.s2, 0.3) : valores.has(r.n) ? C.superficie : C.neutro),
        borde: (r) => (r.n === ultimo ? C.s2 : valores.has(r.n) ? C.tinta : C.inactivo),
        anillo: (r) => (r.n === ultimo ? C.s2 : null),
        nota: (r) => (valores.has(r.n) ? String(valores.get(r.n)) : null),
      });
      registro.textContent = error || mensaje || 'Pulse «Un paso» para empezar por la primera hoja.';
      lectura.set([['fórmula', D.texto(ast)], ['función', MET[clave].nombre], ['nodos calculados', `${k} de ${orden.length}`], ['valor en la raíz', valores.has(ast) ? String(valores.get(ast)) : '—']]);
    }
    lienzo.alDibujar = () => orden.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cotas entre profundidad y tamaño ---------- */

  function montarCotas(cuerpo) {
    let maxProf = 6, soloBin = false, semilla = 1, burbujas = [], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Profundidad máxima', min: 2, max: 8, valor: maxProf, alCambiar: (v) => { maxProf = v; muestrear(); } });
    ctl.casilla({ etiqueta: 'Solo conectivos binarios (sin ¬)', valor: soloBin, alCambiar: (v) => { soloBin = v; muestrear(); } });
    ctl.boton('Nuevo muestreo', () => { semilla++; muestrear(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'fórmulas aleatorias (el área indica cuántas)', forma: 'punto' },
      { color: C.apagado, texto: 'cotas: profundidad + 1 ≤ tamaño ≤ 2^(profundidad + 1) − 1', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada burbuja es un par (profundidad, tamaño) que aparece en 600 fórmulas generadas al azar. Todas quedan entre las dos curvas de trazos: una cadena de ¬ y un árbol binario completo son los extremos.');

    function muestrear() {
      const rnd = VIZ.semilla(semilla * 977 + maxProf);
      const cuenta = new Map();
      const ops = soloBin ? ['and', 'or', 'imp', 'iff'] : ['and', 'or', 'imp', 'iff', 'not', 'not'];
      for (let i = 0; i < 600; i++) {
        const a = D.aleatoria(rnd, ['p', 'q', 'r'], 1 + Math.floor(rnd() * maxProf), ops);
        const key = `${D.prof(a)}|${D.tam(a)}`;
        cuenta.set(key, (cuenta.get(key) || 0) + 1);
      }
      burbujas = [...cuenta].map(([k, c]) => { const [d, t] = k.split('|').map(Number); return { d, t, c }; });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: -0.5, xmax: 8.5, ymin: 0.8, ymax: 600 }, { logY: true, etiquetaX: 'profundidad', etiquetaY: 'tamaño', ticksX: [0, 1, 2, 3, 4, 5, 6, 7, 8], formatoX: (v) => String(v) });
      plano.ejes();
      const xs = Array.from({ length: 9 }, (_, i) => i);
      VIZ.trazar(ctx, plano, xs.map((d) => [d, 2 ** (d + 1) - 1]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, xs.map((d) => [d, d + 1]), C.apagado, 1.5, [3, 4]);
      D.texto2(ctx, '2^(d+1) − 1', plano.sx(6.8), plano.sy(2 ** 7.8) - 10, { color: C.apagado, px: 10.5, alinea: 'left' });
      D.texto2(ctx, 'd + 1', plano.sx(8.5) - 4, plano.sy(10), { color: C.apagado, px: 10.5, alinea: 'right' });
      for (const b of burbujas) {
        const r = 3 + 1.4 * Math.sqrt(b.c);
        ctx.beginPath(); ctx.arc(plano.sx(b.d), plano.sy(b.t), r, 0, 7);
        ctx.fillStyle = VIZ.alfa(C.s1, 0.55); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.s1; ctx.stroke();
      }
      const maxT = Math.max(...burbujas.map((b) => b.t)), maxD = Math.max(...burbujas.map((b) => b.d));
      lectura.set([['pares distintos', String(burbujas.length)], ['profundidad máxima vista', String(maxD)], ['tamaño máximo visto', String(maxT)], ['cota superior para esa profundidad', String(2 ** (maxD + 1) - 1)]]);
    }
    lienzo.alDibujar = () => burbujas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const b = burbujas.find((q) => Math.hypot(plano.sx(q.d) - x, plano.sy(q.t) - y) <= 3 + 1.4 * Math.sqrt(q.c) + 3);
      if (!b) return tip.ocultar();
      tip.mostrar(x, y, `profundidad <b>${b.d}</b><br>tamaño <b>${b.t}</b><br><b>${b.c}</b> fórmulas`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    muestrear();
  }

  VIZ.registrarTema('expression-metrics', {
    intro: String.raw`
      <p>Dos medidas describen la forma de una fórmula o expresión: su <strong>tamaño</strong> (cuántos símbolos o nodos tiene) y su <strong>profundidad</strong> (cuán anidada está).
      Se calculan siguiendo la estructura: el valor de un nodo sale de los valores de sus hijos.</p>
      <p>Ese estilo de definición se llama <strong>recursión estructural</strong>. Es seguro —siempre termina porque las partes son más pequeñas que el todo— y es la base de casi todo lo que se hace con árboles sintácticos: evaluar, traducir, simplificar.</p>`,
    visualizaciones: [
      {
        titulo: 'De las hojas a la raíz',
        descripcion: 'Escriba una fórmula, elija una función y avance paso a paso: cada nodo se calcula con la ecuación recursiva correspondiente a su conectivo.',
        montar: montarRecursion,
      },
      {
        titulo: 'Cotas entre profundidad y tamaño',
        descripcion: 'Fórmulas aleatorias dibujadas por (profundidad, tamaño). Quite las negaciones y compruebe que se pegan a la curva superior; con ellas, aparecen cadenas más largas.',
        montar: montarCotas,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea \(\varphi\) una fórmula proposicional (ver <a href="tema.html?id=wff">fórmulas bien formadas</a>). Con \(\circ\) cualquier conectivo binario:</p>
      <table>
        <tr><th></th><th>átomo \(p\)</th><th>\(\neg A\)</th><th>\(A \circ B\)</th></tr>
        <tr><td>tamaño</td><td>\(1\)</td><td>\(1 + \operatorname{tam}(A)\)</td><td>\(1 + \operatorname{tam}(A) + \operatorname{tam}(B)\)</td></tr>
        <tr><td>profundidad</td><td>\(0\)</td><td>\(1 + \operatorname{prof}(A)\)</td><td>\(1 + \max(\operatorname{prof}(A), \operatorname{prof}(B))\)</td></tr>
        <tr><td>hojas</td><td>\(1\)</td><td>\(\operatorname{hojas}(A)\)</td><td>\(\operatorname{hojas}(A) + \operatorname{hojas}(B)\)</td></tr>
      </table>
      <h2>Cotas</h2>
      <p>Por inducción estructural, para toda fórmula \(\varphi\):</p>
      \[ \operatorname{prof}(\varphi) + 1 \;\le\; \operatorname{tam}(\varphi) \;\le\; 2^{\operatorname{prof}(\varphi)+1} - 1. \]
      <p>La cota inferior se alcanza con una cadena de negaciones sobre un átomo; la superior, con un árbol binario completo. La demostración de la cota superior es un ejemplo típico: la hipótesis para los dos hijos da
      \(\operatorname{tam}(A \circ B) \le 1 + 2(2^{d}-1) = 2^{d+1} - 1\), con \(d\) la mayor profundidad entre los hijos.</p>
      <h2>Por qué importa</h2>
      <p>La profundidad acota el costo de evaluar una fórmula por recursión (la pila de llamadas crece como \(\operatorname{prof}\)); el tamaño acota el trabajo total. Una transformación a
      <a href="tema.html?id=cnf-dnf">forma normal</a> puede volver exponencial el tamaño, aunque la profundidad crezca poco.
      Estas propiedades se prueban con <a href="tema.html?id=structural-induction">inducción estructural</a>.</p>`,
  });
})();
