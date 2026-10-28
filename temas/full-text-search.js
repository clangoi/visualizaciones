(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  const DOCS = [
    'Las bases de datos relacionales usan SQL para las consultas.',
    'Un índice invertido acelera la búsqueda de texto completo.',
    'Las consultas de texto usan un índice invertido.',
    'La privacidad de los datos personales es un derecho.',
    'Los motores de búsqueda ordenan los documentos por relevancia.',
    'SQL permite consultar datos con índices B+.',
    'Un buscador de texto ignora las palabras vacías.',
  ];
  const VACIAS = new Set(['la', 'las', 'el', 'los', 'de', 'un', 'una', 'por', 'para', 'con', 'es', 'y', 'en', 'a']);
  const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Raíz muy simple para español: quita el plural, la terminación verbal y la vocal final.
  function raiz(t) {
    const quitar = (x, sufs) => { for (const suf of sufs) if (x.length > suf.length + 3 && x.endsWith(suf)) return x.slice(0, -suf.length); return x; };
    return quitar(quitar(quitar(t, ['es', 's']), ['ar', 'er', 'ir']), ['a', 'o', 'e']);
  }

  function tokenizar(texto, o) {
    let toks = texto.split(/[^\p{L}\p{N}+]+/u).filter(Boolean).map((t, i) => ({ t, pos: i }));
    if (o.min) toks = toks.map((x) => ({ ...x, t: x.t.toLowerCase() }));
    if (o.tildes) toks = toks.map((x) => ({ ...x, t: sinTildes(x.t) }));
    if (o.vacias) toks = toks.filter((x) => !VACIAS.has(x.t.toLowerCase()));
    if (o.raiz) toks = toks.map((x) => ({ ...x, t: raiz(x.t) }));
    return toks;
  }

  function montarIndice(cuerpo) {
    const o = { min: true, tildes: true, vacias: true, raiz: true };
    let consulta = 'consultas SQL', op = 'and';
    let listas = [], punteros = [], resultado = [], terminos = [], mensaje = '', indice = new Map();
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Consulta', valor: consulta, alCambiar: (v) => { consulta = v; rep.reiniciar(); }, alEnter: (v) => { consulta = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Operador', valor: op, opciones: [['and', 'AND (todos los términos)'], ['or', 'OR (alguno)']], alCambiar: (v) => { op = v; rep.reiniciar(); } });
    ctl.casillas([
      { clave: 'min', texto: 'minúsculas', activo: o.min },
      { clave: 'tildes', texto: 'quitar tildes', activo: o.tildes },
      { clave: 'vacias', texto: 'quitar palabras vacías', activo: o.vacias },
      { clave: 'raiz', texto: 'reducir a la raíz', activo: o.raiz },
    ], (e) => { Object.assign(o, e); rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const docs = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(docs);
    VIZ.subtitulo(cuerpo, 'Listas de postings de los términos de la consulta');
    const postings = el('div');
    cuerpo.appendChild(postings);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'documento bajo el puntero' },
      { color: C.s6, texto: 'documento en el resultado' },
      { color: C.inactivo, texto: 'ya superado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    VIZ.subtitulo(cuerpo, 'Índice invertido completo');
    const tabla = el('div', { class: 'caja-desplazable caja-alta' });
    cuerpo.appendChild(tabla);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escriba una consulta y pulse Enter. Desactive la normalización y vea cómo «consultas» y «consultar» dejan de coincidir.');

    function construir() {
      indice = new Map();
      DOCS.forEach((d, i) => tokenizar(d, o).forEach(({ t, pos }) => {
        if (!indice.has(t)) indice.set(t, new Map());
        const m = indice.get(t);
        if (!m.has(i)) m.set(i, []);
        m.get(i).push(pos);
      }));
    }
    function iniciar() {
      construir();
      terminos = [...new Set(tokenizar(consulta, o).map((x) => x.t))];
      listas = terminos.map((t) => (indice.has(t) ? [...indice.get(t).keys()] : []));
      punteros = listas.map(() => 0); resultado = [];
      mensaje = terminos.length ? `Términos normalizados: ${terminos.join(', ')}. ${op === 'and' ? 'Intersección' : 'Unión'} de ${listas.length} listas ordenadas.` : 'La consulta quedó vacía tras la normalización.';
      return (function* () {
        if (!listas.length) return;
        if (op === 'and') {
          while (punteros.every((p, k) => p < listas[k].length)) {
            const vals = punteros.map((p, k) => listas[k][p]);
            const mx = Math.max(...vals);
            if (vals.every((v) => v === mx)) {
              resultado.push(mx);
              mensaje = `Todos los punteros están en d${mx + 1}: va al resultado y avanzan todos.`;
              yield;
              punteros = punteros.map((p) => p + 1);
            } else {
              mensaje = `Punteros en ${vals.map((v) => `d${v + 1}`).join(', ')}: los que están bajo d${mx + 1} avanzan (ese documento no puede estar en todas las listas).`;
              yield;
              punteros = punteros.map((p, k) => (listas[k][p] < mx ? p + 1 : p));
            }
          }
          mensaje = `Una lista se agotó: no puede haber más coincidencias. Resultado: ${resultado.map((d) => `d${d + 1}`).join(', ') || 'ninguno'}.`;
        } else {
          while (punteros.some((p, k) => p < listas[k].length)) {
            const vals = punteros.map((p, k) => (p < listas[k].length ? listas[k][p] : Infinity));
            const mn = Math.min(...vals);
            resultado.push(mn);
            mensaje = `El menor bajo los punteros es d${mn + 1}: va al resultado y avanzan las listas que lo tienen.`;
            yield;
            punteros = punteros.map((p, k) => (listas[k][p] === mn ? p + 1 : p));
          }
          mensaje = `Todas las listas se agotaron. Resultado: ${resultado.map((d) => `d${d + 1}`).join(', ')}.`;
        }
      })();
    }
    function dibujar() {
      const enRes = new Set(resultado);
      docs.replaceChildren(...DOCS.map((d, i) => el('div', { class: enRes.has(i) ? 'activa' : null }, `d${i + 1}  ${tokenizar(d, o).map((x) => x.t).join(' ')}`)));
      postings.replaceChildren(...terminos.map((t, k) => {
        const fila = el('div', { class: 'fichas' }, el('span', { class: 'fichas-titulo' }, `${t}:`));
        if (!listas[k].length) fila.appendChild(el('span', { class: 'fichas-vacio' }, '(no aparece)'));
        listas[k].forEach((d, j) => {
          const bajo = j === punteros[k], pasado = j < punteros[k];
          fila.appendChild(VIZ.ficha(`d${d + 1}`, enRes.has(d) ? { color: C.s6, fondo: C.s6, tinta: C.sobre } : bajo ? { color: C.s1, tinta: C.s1 } : pasado ? { color: C.inactivo, tinta: C.inactivo } : {}));
        });
        return fila;
      }));
      registro.textContent = mensaje;
      const filas = [...indice].sort((a, b) => a[0].localeCompare(b[0])).map(([t, m]) => [t, m.size, [...m].map(([d, ps]) => `d${d + 1}:${ps.join(',')}`).join('  ')]);
      tabla.replaceChildren(B.tabla(B.rel('índice', ['término', 'df', 'postings (documento:posiciones)'], filas), { titulo: false, fila: (f) => (terminos.includes(f['término']) ? C.s1 : null) }));
      const tokens = DOCS.reduce((s, d) => s + tokenizar(d, o).length, 0);
      lectura.set([
        ['términos distintos', String(indice.size)],
        ['tokens indexados', String(tokens)],
        ['comparaciones', String(punteros.reduce((s, p) => s + p, 0))],
        ['documentos encontrados', String(resultado.length)],
      ]);
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('full-text-search', {
    intro: String.raw`
      <p>Buscar «consultas SQL» con <code>LIKE '%consultas%'</code> obliga a leer cada fila y cada carácter, no encuentra «consultar» y no
      sabe qué resultado es mejor. La <strong>búsqueda de texto completo</strong> resuelve las tres cosas: normaliza el texto en
      <em>términos</em>, los guarda en un <strong>índice invertido</strong> y responde consultas combinando listas ordenadas.</p>
      <p>Un índice invertido es el índice de un libro: para cada término, la lista de documentos (y posiciones) donde aparece. Es la
      estructura detrás de Elasticsearch, Lucene, los motores web y el tipo <code>tsvector</code> de PostgreSQL.</p>`,
    visualizaciones: [
      {
        titulo: 'Índice invertido y consultas booleanas',
        descripcion: 'Siete documentos cortos, su índice y una consulta. Avance para ver la intersección (AND) o la unión (OR) de las listas de postings con un puntero por lista.',
        montar: montarIndice,
      },
    ],
    teoria: String.raw`
      <h2>Del texto a los términos</h2>
      <pre><code>texto → tokens        separar por espacios y puntuación
      → minúsculas, sin tildes
      → quitar palabras vacías («de», «la», «un»: aparecen en todo)
      → raíz (stemming) o lema   «consultas», «consultar» → «consult»</code></pre>
      <p>La consulta pasa por <em>el mismo</em> análisis que los documentos; si no, los términos no coinciden. Cada paso aumenta la
      exhaustividad (encuentra más) a riesgo de la precisión: «datos» y «dato» se unen, pero también «general» y «generar».</p>

      <h2>El índice invertido</h2>
      <p>Para cada término \(t\): su frecuencia de documentos \(\text{df}(t)\) y su <strong>lista de postings</strong>, ordenada por
      identificador de documento, con las posiciones donde aparece. El vocabulario se guarda en un B+ o en un autómata (FST) para buscar
      prefijos; las listas se comprimen con diferencias entre identificadores consecutivos y códigos de largo variable.</p>
      <h3>Intersección</h3>
      <pre><code>intersectar(L₁, L₂):
    i ← 0; j ← 0; R ← []
    mientras i &lt; |L₁| y j &lt; |L₂|:
        si L₁[i] = L₂[j]:  R.agregar(L₁[i]); i ← i + 1; j ← j + 1
        si no, si L₁[i] &lt; L₂[j]:  i ← i + 1
        si no:  j ← j + 1
    devolver R</code></pre>
      <p>Cuesta \(O(|L_1| + |L_2|)\). Con varias listas conviene intersectar primero las más cortas (los términos más raros). Con
      <em>punteros de salto</em> o búsqueda galopante se baja a \(O(|L_1| \log(|L_2|/|L_1|))\) cuando una lista es mucho más corta.</p>
      <h3>Frases</h3>
      <p>«índice invertido» exige que ambos términos estén en el documento <em>y</em> en posiciones consecutivas: se intersectan las listas y
      luego, en cada documento común, las listas de posiciones con desfase 1.</p>

      <h2>En una base relacional</h2>
      <pre><code>ALTER TABLE docs ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', texto)) STORED;
CREATE INDEX ON docs USING GIN (tsv);
SELECT * FROM docs WHERE tsv @@ to_tsquery('spanish', 'consultas &amp; sql');</code></pre>
      <p>El índice GIN de PostgreSQL es un índice invertido. Ordenar los resultados por relevancia es el tema de
      <a href="tema.html?id=retrieval">recuperación de información</a>.</p>`,
  });
})();
