/* Tecnologías web (VIZ.web): diagramas de secuencia entre actores (navegador, servidor, DNS…), cajas con texto,
   árboles de nodos para DOM y componentes, y un resaltador mínimo de texto con marcas. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = {};
  VIZ.web = W;

  // Caja redondeada con texto centrado (puede tener varias líneas separadas por \n).
  W.caja = function (ctx, x, y, w, h, texto, { relleno = C.superficie, borde = C.eje, tinta = C.tinta, tam = 11, peso = 500, grosor = 1.5, guiones = null } = {}) {
    ctx.save();
    ctx.fillStyle = relleno; ctx.strokeStyle = borde; ctx.lineWidth = grosor;
    if (guiones) ctx.setLineDash(guiones);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tinta; ctx.font = VIZ.fuente(tam, peso); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lineas = String(texto).split('\n');
    lineas.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 + (i - (lineas.length - 1) / 2) * (tam + 3)));
    ctx.restore();
  };

  // Texto suelto en el canvas.
  W.texto = function (ctx, t, x, y, { color = C.tinta, tam = 11, peso = 400, alinear = 'center', base = 'middle' } = {}) {
    ctx.save();
    ctx.fillStyle = color; ctx.font = VIZ.fuente(tam, peso); ctx.textAlign = alinear; ctx.textBaseline = base;
    ctx.fillText(t, x, y);
    ctx.restore();
  };

  /* Diagrama de secuencia. actores: [{ nombre, color? }]; mensajes: [{ de, a, texto, color?, guiones?, nota? }].
     Dibuja los mensajes 0..hasta (el último resaltado). Devuelve la geometría para tooltips:
     { xs, ys, paso } con la posición de cada actor y de cada mensaje. */
  W.secuencia = function (lienzo, actores, mensajes, hasta, { arriba = 38, paso = 0, tam = 11 } = {}) {
    const { ctx, ancho: Wd, alto: H } = lienzo;
    const n = actores.length, m = Math.max(1, Wd / n);
    const xs = actores.map((_, i) => m * (i + 0.5));
    const dy = paso || Math.min(34, (H - arriba - 10) / Math.max(1, mensajes.length));
    actores.forEach((a, i) => {
      W.caja(ctx, xs[i] - Math.min(m - 8, 92) / 2, 6, Math.min(m - 8, 92), 24, a.nombre, { borde: a.color || C.tinta, tam: Wd < 500 ? 10 : 11, peso: 600 });
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(xs[i], 30); ctx.lineTo(xs[i], H - 4); ctx.stroke(); ctx.setLineDash([]);
    });
    const ys = mensajes.map((_, k) => arriba + 10 + k * dy);
    mensajes.forEach((ms, k) => {
      if (k > hasta) return;
      const y = ys[k], x0 = xs[ms.de], x1 = xs[ms.a], actual = k === hasta;
      const col = ms.color || C.tinta2;
      if (ms.de === ms.a) {
        W.texto(ctx, ms.texto, x0 + 8, y, { color: actual ? C.tinta : C.tinta2, alinear: 'left', tam: tam - 1, peso: actual ? 600 : 400 });
        return;
      }
      VIZ.dist.flecha(ctx, x0, y, x1, y, { color: actual ? col : VIZ.alfa(col, 0.55), ancho: actual ? 2.5 : 1.5, guiones: ms.guiones || null });
      VIZ.dist.etiqueta(ctx, ms.texto, (x0 + x1) / 2, y - 8, { color: actual ? C.tinta : C.tinta2, tam: tam - 1, peso: actual ? 600 : 400 });
    });
    return { xs, ys, dy };
  };

  /* Árbol general. nodo: { id, texto, hijos: [] }. Reparte las hojas por igual y los niveles por la altura.
     est(nodo) devuelve { relleno, borde, tinta, guiones }. Devuelve el arreglo de nodos con posición { x, y, w, h }. */
  W.arbol = function (ctx, raiz, ancho, alto, est = () => ({}), { alturaNodo = 24, margenY = 8, tam = 11 } = {}) {
    const hojas = (n) => (n.hijos && n.hijos.length ? n.hijos.reduce((s, h) => s + hojas(h), 0) : 1);
    const prof = (n) => 1 + (n.hijos && n.hijos.length ? Math.max(...n.hijos.map(prof)) : 0);
    const total = hojas(raiz), niveles = prof(raiz), lista = [];
    const sepY = niveles > 1 ? (alto - 2 * margenY - alturaNodo) / (niveles - 1) : 0;
    let cursor = 0;
    (function poner(n, d) {
      const h = hojas(n), x0 = (cursor / total) * ancho;
      if (!(n.hijos && n.hijos.length)) { n.x = ((cursor + 0.5) / total) * ancho; cursor += 1; } else {
        n.hijos.forEach((c) => poner(c, d + 1));
        n.x = (n.hijos[0].x + n.hijos[n.hijos.length - 1].x) / 2;
      }
      n.y = margenY + d * sepY; n.d = d;
      lista.push(n);
      return x0 + h;
    })(raiz, 0);
    ctx.save();
    ctx.font = VIZ.fuente(tam, 500);
    const unidad = ancho / total;
    for (const n of lista) {
      n.w = Math.min(Math.max(ctx.measureText(n.texto).width + 14, 30), Math.max(36, unidad * 1.9));
      n.h = alturaNodo;
    }
    ctx.restore();
    ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
    for (const n of lista) for (const c of n.hijos || []) {
      ctx.beginPath(); ctx.moveTo(n.x, n.y + n.h); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    for (const n of lista) {
      const e = est(n);
      W.caja(ctx, n.x - n.w / 2, n.y, n.w, n.h, n.texto, { relleno: e.relleno || C.superficie, borde: e.borde || C.eje, tinta: e.tinta || C.tinta, guiones: e.guiones || null, tam, grosor: e.borde ? 2 : 1.5 });
    }
    return lista;
  };

  /* Figura completa de secuencia paso a paso: controles → lienzo → leyenda → registro → lectura → nota.
     o = { actores, mensajes(): lista (puede cambiar con los controles), controles(ctl, reiniciar), leyenda, inicio,
           lectura(hasta, msgs) → pares, nota, velocidad }.  Cada mensaje: { de, a, texto, color?, guiones?, nota }. */
  const DY = 30;
  W.figuraSecuencia = function (cuerpo, o) {
    let msgs = [], hasta = -1;
    const ctl = VIZ.controles(cuerpo);
    if (o.controles) o.controles(ctl, () => rep.reiniciar());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: o.velocidad ?? 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 52 + Math.max(4, msgs.length) * DY });
    if (o.leyenda) VIZ.leyenda(cuerpo, o.leyenda); else cuerpo.dataset.sinLeyenda = 'los actores y mensajes llevan etiqueta directa';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    if (o.nota) VIZ.nota(cuerpo, o.nota);
    function iniciar() {
      msgs = o.mensajes(); hasta = -1;
      lienzo.ajustar(true);
      return (function* () { for (let k = 0; k < msgs.length; k++) { hasta = k; yield; } })();
    }
    function dibujar() {
      lienzo.limpiar();
      W.secuencia(lienzo, o.actores, msgs, hasta, { paso: DY });
      registro.textContent = hasta >= 0 ? (msgs[hasta].nota || msgs[hasta].texto) : (o.inicio || 'Pulse «Un paso» o «Reproducir».');
      lectura.set(o.lectura(hasta, msgs));
    }
    lienzo.alDibujar = () => msgs.length && dibujar();
    rep.reiniciar();
    return { rep, lienzo, ctl };
  };

  // Aplana un árbol en una lista (preorden).
  W.aplanar = function (n, salida = []) {
    salida.push(n);
    (n.hijos || []).forEach((h) => W.aplanar(h, salida));
    return salida;
  };

  // Escapa texto para insertarlo en innerHTML.
  W.esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
})();
