(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  function datos() {
    const rnd = VIZ.semilla(11);
    return Array.from({ length: 40 }, (_, i) => {
      const edad = 23 + Math.floor(rnd() * 42);
      const ingreso = Math.max(450, Math.round(400 + (edad - 22) * 45 + VIZ.normal(rnd) * 380 + (rnd() < 0.08 ? 3500 : 0)));
      return { i, edad, ingreso };
    });
  }
  const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const desv = (v) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2))); };
  const corr = (a, b) => { const ma = media(a), mb = media(b); return media(a.map((x, i) => (x - ma) * (b[i] - mb))) / (desv(a) * desv(b)); };

  const TECNICAS = {
    ninguna: { nombre: 'ninguna', param: null },
    ruido: { nombre: 'ruido aditivo', param: ['desviación del ruido', 0, 1500, 50, 400, (v) => `$${VIZ.entero(v)} mil`] },
    micro: { nombre: 'microagregación', param: ['tamaño de grupo k', 2, 10, 1, 3, (v) => String(v)] },
    tope: { nombre: 'recorte superior (top-coding)', param: ['percentil del tope', 50, 100, 1, 90, (v) => `p${v}`] },
    swap: { nombre: 'intercambio de rangos (swapping)', param: ['distancia máxima de rango', 0, 20, 1, 5, (v) => `${v} posiciones`] },
    redondeo: { nombre: 'redondeo', param: ['múltiplo', 50, 2000, 50, 500, (v) => `$${VIZ.entero(v)} mil`] },
  };

  function aplicar(tec, par, D, semilla) {
    const v = D.map((d) => d.ingreso);
    const rnd = VIZ.semilla(semilla);
    if (tec === 'ruido') return v.map((x) => Math.round(x + VIZ.normal(rnd) * par));
    if (tec === 'micro') {
      const orden = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), out = [...v];
      for (let g = 0; g < orden.length; g += par) {
        let grupo = orden.slice(g, g + par);
        if (orden.length - (g + par) < par && orden.length - (g + par) > 0) { grupo = orden.slice(g); g = orden.length; }
        const m = Math.round(media(grupo.map((z) => z[0])));
        grupo.forEach(([, i]) => { out[i] = m; });
      }
      return out;
    }
    if (tec === 'tope') {
      const s = [...v].sort((a, b) => a - b), t = s[Math.min(s.length - 1, Math.floor((par / 100) * s.length))];
      return v.map((x) => Math.min(x, t));
    }
    if (tec === 'swap') {
      const orden = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), out = [...v], usado = new Set();
      for (let r = 0; r < orden.length; r++) {
        if (usado.has(r)) continue;
        const cands = [];
        for (let s = r + 1; s <= Math.min(orden.length - 1, r + par); s++) if (!usado.has(s)) cands.push(s);
        if (!cands.length) continue;
        const s = cands[Math.floor(rnd() * cands.length)];
        usado.add(r); usado.add(s);
        out[orden[r][1]] = orden[s][0]; out[orden[s][1]] = orden[r][0];
      }
      return out;
    }
    if (tec === 'redondeo') return v.map((x) => Math.round(x / par) * par);
    return v;
  }

  function montarTecnicas(cuerpo) {
    const D = datos();
    let tec = 'micro', par = 3, semilla = 1, hover = null, rango = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Técnica sobre el ingreso', valor: tec, opciones: Object.entries(TECNICAS).map(([k, t]) => [k, t.nombre]),
      alCambiar: (v) => { tec = v; armarParametro(); dibujar(); },
    });
    let campo = null;
    function armarParametro() {
      if (campo) campo.remove();
      campo = null;
      const p = TECNICAS[tec].param;
      if (!p) return;
      par = p[4];
      rango = ctl.rango({ etiqueta: p[0], min: p[1], max: p[2], paso: p[3], valor: par, formato: p[5], alCambiar: (v) => { par = v; dibujar(); } });
      campo = rango.input.closest('.campo');
    }
    ctl.boton('Nueva semilla de ruido', () => { semilla++; dibujar(); });
    armarParametro();
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.apagado, texto: 'valor original', forma: 'punto' },
      { color: C.s1, texto: 'valor publicado', forma: 'punto' },
      { color: C.s8, texto: 'publicado = original (se puede enlazar)', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un punto. Compare cuánto cambian la media, la desviación y la correlación con la edad, y cuántos valores siguen exactos.');
    let plano = null, pub = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pub = aplicar(tec, par, D, semilla);
      plano = VIZ.plano(lienzo, { xmin: 20, xmax: 67, ymin: 0, ymax: 6500 }, { etiquetaX: 'edad', etiquetaY: 'ingreso mensual (miles de $)', formatoY: (v) => VIZ.entero(v) });
      plano.ejes();
      D.forEach((d, i) => {
        const x = plano.sx(d.edad);
        ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, plano.sy(d.ingreso)); ctx.lineTo(x, plano.sy(pub[i])); ctx.stroke();
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.fillStyle = C.superficie;
        ctx.beginPath(); ctx.arc(x, plano.sy(d.ingreso), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      D.forEach((d, i) => VIZ.marcador(ctx, plano.sx(d.edad), plano.sy(pub[i]), pub[i] === d.ingreso ? C.s8 : C.s1, hover === i ? 6 : 4));
      const orig = D.map((d) => d.ingreso), edades = D.map((d) => d.edad);
      const exactos = pub.filter((x, i) => x === orig[i]).length;
      const cerca = pub.filter((x, i) => Math.abs(x - orig[i]) <= 0.02 * orig[i]).length;
      lectura.set([
        ['media original / publicada', `${VIZ.entero(media(orig))} / ${VIZ.entero(media(pub))}`],
        ['desviación original / publicada', `${VIZ.entero(desv(orig))} / ${VIZ.entero(desv(pub))}`],
        ['correlación con la edad', `${VIZ.fmt(corr(edades, orig), 2)} → ${VIZ.fmt(corr(edades, pub), 2)}`],
        ['valores exactos', `${exactos} de ${D.length}`],
        ['a menos de 2 %', `${cerca} de ${D.length}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano) return;
      let mejor = -1, md = 10;
      D.forEach((d, i) => { const dd = Math.hypot(plano.sx(d.edad) - x, plano.sy(pub[i]) - y); if (dd < md) { md = dd; mejor = i; } });
      hover = mejor >= 0 ? mejor : null; dibujar();
      if (mejor < 0) return tip.ocultar();
      tip.mostrar(x, y, `edad ${D[mejor].edad}<br>original <b>${VIZ.entero(D[mejor].ingreso)}</b><br>publicado <b>${VIZ.entero(pub[mejor])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('tecnicas-privacidad', {
    intro: String.raw`
      <p>Entre suprimir una columna y publicarla tal cual hay muchas <strong>técnicas de control de revelación</strong>: agregar ruido,
      reemplazar valores por promedios de grupos, intercambiar valores entre registros, recortar los extremos o redondear. Todas pagan
      privacidad con utilidad, pero de formas distintas: unas conservan la media, otras la distribución, otras las correlaciones.</p>
      <p>Elegir bien exige saber qué análisis se hará con los datos. Un ingreso con ruido sirve para estimar el promedio regional, pero no
      para estudiar a los millonarios; un ingreso con tope protege a los millonarios, pero sesga la media hacia abajo.</p>`,
    visualizaciones: [
      {
        titulo: 'Técnicas sobre una columna',
        descripcion: 'Ingreso de 40 personas según su edad. Aplique cada técnica y compare la utilidad (media, desviación, correlación) con el riesgo (valores que siguen siendo exactos).',
        montar: montarTecnicas,
      },
    ],
    teoria: String.raw`
      <h2>Catálogo</h2>
      <table>
        <tr><th>Técnica</th><th>Qué hace</th><th>Conserva</th><th>Rompe</th></tr>
        <tr><td>ruido aditivo</td><td>\(x' = x + e,\ e \sim \mathcal N(0, \sigma^2)\)</td><td>la media</td><td>la varianza (sube en \(\sigma^2\)) y los valores exactos</td></tr>
        <tr><td>microagregación</td><td>ordenar, agrupar de a \(k\), reemplazar por la media del grupo</td><td>la media; da k-anonimato en esa variable</td><td>la varianza (baja)</td></tr>
        <tr><td>recorte superior</td><td>\(x' = \min(x, t)\)</td><td>casi todo salvo la cola</td><td>la media y la cola alta</td></tr>
        <tr><td>intercambio</td><td>permutar valores entre registros de rango cercano</td><td>la distribución marginal exacta</td><td>las relaciones con otras columnas</td></tr>
        <tr><td>redondeo</td><td>\(x' = m \cdot \text{round}(x/m)\)</td><td>la forma general</td><td>la precisión</td></tr>
        <tr><td>enmascaramiento</td><td>ocultar parte del valor (12.***.***-5)</td><td>el formato</td><td>casi toda la información</td></tr>
        <tr><td>tokenización / cifrado</td><td>reemplazar por un token o cifrar</td><td>la igualdad (sirve para juntar)</td><td>todo cálculo sobre el valor</td></tr>
      </table>

      <h2>Utilidad y riesgo</h2>
      <p>Para el ruido aditivo independiente, la media muestral no tiene sesgo y \(\operatorname{Var}(x') = \operatorname{Var}(x) + \sigma^2\),
      así que la correlación con otra variable \(y\) se atenúa:</p>
      \[ \rho(x', y) = \rho(x, y)\cdot\frac{\sigma_x}{\sqrt{\sigma_x^2 + \sigma^2}}. \]
      <p>Por eso los institutos de estadística publican el \(\sigma\) usado, para que los analistas corrijan. Medir el riesgo es más difícil:
      se usan la proporción de registros que un atacante enlazaría correctamente por cercanía (<em>record linkage</em>) y los intervalos donde
      el valor original queda con alta probabilidad.</p>
      <div class="recuadro">Ninguna de estas técnicas da por sí sola una garantía formal. Con parámetros elegidos con cuidado, el ruido
      gaussiano o laplaciano sí la da: es la <a href="tema.html?id=privacidad-diferencial">privacidad diferencial</a>. La microagregación
      sobre los cuasi-identificadores da <a href="tema.html?id=k-anonimato">k-anonimato</a>.</div>

      <h2>Técnicas sobre el sistema, no sobre los datos</h2>
      <ul>
        <li><strong>Minimización</strong>: no recolectar lo que no se usa (principio de proporcionalidad de la
        <a href="tema.html?id=ley-21719">Ley 21.719</a>).</li>
        <li><strong>Control de acceso y vistas</strong> que exponen solo lo necesario (<a href="tema.html?id=seguridad">seguridad</a>).</li>
        <li><strong>Cifrado</strong> en reposo y en tránsito, y cifrado homomórfico o cómputo multipartito para calcular sin ver los datos.</li>
        <li><strong>Aprendizaje federado</strong>: el modelo viaja a los datos, no los datos al modelo.</li>
        <li><strong><a href="tema.html?id=datos-sinteticos">Datos sintéticos</a></strong>: publicar registros falsos con las mismas propiedades.</li>
      </ul>`,
  });
})();
