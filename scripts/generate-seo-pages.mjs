import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public')
const WORDS_PATH = path.join(ROOT, 'worker', 'src', 'words.json')
const BASE_URL = 'https://juegoimpostor.app'
const LAST_MODIFIED = '2026-10-15'
// Home and the two guides gained crawlable copy and head fixes on this date.
const GUIDES_MODIFIED = '2026-10-15'
const CHECK_ONLY = process.argv.includes('--check')

const categories = [
  {
    id: 'animales',
    label: 'Animales',
    phrase: 'de animales',
    slug: 'animales',
    summary: 'Desde perro y pingüino hasta ajolote y camaleón: una categoría visual que funciona con cualquier grupo.',
    intro: 'Los animales son una de las mejores categorías para aprender a jugar: todo el mundo reconoce los ejemplos fáciles, pero cada palabra admite pistas sobre hábitat, movimiento, carácter, sonido o cultura popular.',
    clue: 'Alterna hábitat, comportamiento y una asociación cultural. Para “león”, “trono” deja claro que sabes la respuesta sin regalar “melena” al impostor.',
    avoid: 'Evita decir la especie, su sonido exacto o una parte anatómica exclusiva en el primer turno. Esas pistas cierran demasiado pronto el abanico.',
  },
  {
    id: 'comida',
    label: 'Comida',
    phrase: 'de comida',
    slug: 'comida',
    summary: 'Platos de España y América Latina, sabores internacionales y pistas que no se limitan a enumerar ingredientes.',
    intro: 'La comida genera partidas muy sociales porque cada palabra conecta con sabores, momentos, lugares y recuerdos. La selección mezcla platos universales con referencias de España y América Latina.',
    clue: 'Habla del momento o del ritual, no solo del ingrediente. “Domingo” para paella o “debate” para arepa abren conversación sin convertir la pista en una receta.',
    avoid: 'No uses el ingrediente principal cuando solo encaja con un plato. También conviene acordar variantes regionales antes de discutir si una respuesta es válida.',
  },
  {
    id: 'lugares',
    label: 'Lugares',
    phrase: 'de lugares',
    slug: 'lugares',
    summary: 'Sitios cotidianos y escenarios extraños para describir sensaciones, rutinas y recuerdos sin decir dónde estás.',
    intro: 'Los lugares permiten pistas especialmente humanas: qué haces allí, cómo suena, cuánto tiempo pasas o qué emoción provoca. Por eso funcionan bien tanto con principiantes como con grupos expertos.',
    clue: 'Describe una experiencia secundaria. “Despedida” para aeropuerto es más sutil que “avión”, y “coro” para estadio demuestra contexto sin nombrar el deporte.',
    avoid: 'Evita el objeto más obvio del lugar —libros, médicos, cuadros— durante la primera vuelta. Guarda la pista directa para defenderte si te acusan.',
  },
  {
    id: 'objetos',
    label: 'Objetos',
    phrase: 'de objetos',
    slug: 'objetos',
    summary: 'Objetos diarios y herramientas curiosas con suficientes funciones, formas y recuerdos para despistar.',
    intro: 'Los objetos son concretos, pero no tienen por qué ser fáciles. Una buena pista puede apuntar a su uso, a una situación en la que falta o a la sensación que produce, sin describir su forma literal.',
    clue: 'Busca una consecuencia o una escena: “olvido” para paraguas y “ansiedad” para reloj cuentan algo real sin definir el objeto.',
    avoid: 'No describas color, material y función a la vez. Una acumulación de rasgos convierte una pista sutil en una adivinanza resuelta.',
  },
  {
    id: 'naturaleza',
    label: 'Naturaleza',
    phrase: 'de naturaleza',
    slug: 'naturaleza',
    summary: 'Fenómenos, paisajes y ecosistemas para pasar de partidas accesibles a rondas realmente exigentes.',
    intro: 'Naturaleza ofrece imágenes potentes y varios niveles de dificultad. Los conceptos conocidos sirven para empezar; fenómenos como monzón o bioluminiscencia exigen un grupo con más vocabulario.',
    clue: 'Usa efectos, escalas o metáforas. “Lento” para glaciar apunta a su ritmo y “ciudad” para coral evita la asociación marina más obvia.',
    avoid: 'No elijas tecnicismos que solo conozca una persona. La dificultad debe venir de comunicar con sutileza, no de un examen de ciencias.',
  },
  {
    id: 'cultura',
    label: 'Cultura',
    phrase: 'de cultura',
    slug: 'cultura',
    summary: 'Fiestas, artes y fenómenos de internet para grupos con referencias compartidas.',
    intro: 'Esta categoría cruza celebraciones, artes escénicas, literatura visual e internet. Funciona mejor cuando el grupo comparte un contexto cultural amplio y disfruta justificando asociaciones inesperadas.',
    clue: 'Señala una convención: “cuarta pared” para teatro o “plantilla” para meme. Son pistas reconocibles para quien sabe, pero difíciles de explotar sin contexto.',
    avoid: 'Evita nombres de obras o artistas que conviertan la respuesta en automática. En grupos internacionales, comprueba que la referencia no sea exclusivamente local.',
  },
  {
    id: 'profesiones',
    label: 'Profesiones',
    phrase: 'de profesiones',
    slug: 'profesiones',
    summary: 'Oficios conocidos y especializados descritos por sus decisiones, rutinas y herramientas menos evidentes.',
    intro: 'Las profesiones se entienden rápido, pero obligan a elegir entre herramienta, entorno, habilidad o responsabilidad. Las palabras difíciles amplían el juego sin depender de celebridades o modas.',
    clue: 'Habla de la decisión que toma esa persona. “Fuente” para periodista y “precedente” para abogada son más interesantes que nombrar su herramienta visible.',
    avoid: 'No uses uniforme, lugar de trabajo y objeto típico en una misma pista. Si el oficio es raro, permite una segunda ronda antes de votar.',
  },
  {
    id: 'deportes',
    label: 'Deportes',
    phrase: 'de deportes',
    slug: 'deportes',
    summary: 'Deportes universales y disciplinas olímpicas menos obvias con pistas sobre reglas, ritmo y estrategia.',
    intro: 'Deportes funciona especialmente bien con grupos competitivos. La lista evita limitarse al material deportivo y propone asociaciones con estrategia, tiempos muertos, gestos y tradiciones.',
    clue: 'Piensa en una regla o un momento: “silencio” para tenis, “campana” para boxeo o “tercer tiempo” para rugby separan a quien conoce el deporte de quien improvisa.',
    avoid: 'No menciones pelota, red o pista si es la asociación inmediata. Asegúrate de que las disciplinas difíciles sean conocidas por todo el grupo.',
  },
  {
    id: 'ficcion',
    label: 'Ficción',
    phrase: 'de ficción',
    slug: 'ficcion',
    summary: 'Criaturas, arquetipos y conceptos fantásticos para construir pistas con reglas narrativas.',
    intro: 'La ficción libera al grupo de los datos exactos: cada palabra tiene mitos, reglas, debilidades y versiones distintas. Esa ambigüedad genera debates memorables y buenas coartadas.',
    clue: 'Usa una regla narrativa. “Invitación” para vampiro y “calendario” para hombre lobo son precisas sin describir colmillos ni luna llena.',
    avoid: 'Evita citar la película o saga más famosa de manera directa. Si existen versiones contradictorias del mito, acepta una explicación razonable.',
  },
  {
    id: 'ciencia',
    label: 'Ciencia',
    phrase: 'de ciencia',
    slug: 'ciencia',
    summary: 'Conceptos científicos con dificultad gradual y pistas basadas en comportamiento, no en definiciones de manual.',
    intro: 'Ciencia es una categoría exigente que funciona cuando el grupo comparte curiosidad, no necesariamente formación. Empieza con objetos y fenómenos conocidos y sube hacia ideas abstractas.',
    clue: 'Relaciona el concepto con una propiedad inesperada: “coincidencia” para eclipse o “costumbre” para gravedad son defendibles y no parecen una definición escolar.',
    avoid: 'No conviertas la partida en un examen. Si alguien no reconoce una palabra, cambia de ronda sin penalizar y reserva el tramo difícil para grupos expertos.',
  },
  {
    id: 'streamers',
    label: 'Streamers',
    phrase: 'de streamers',
    slug: 'streamers',
    summary: 'Ibai, Rubius, TheGrefg y protagonistas del streaming español con referencias para fans.',
    intro: 'El formato de Adivina el Impostor ha encontrado una audiencia enorme entre streamers. Esta lista reúne nombres muy reconocibles y participantes o figuras cercanas a las ediciones virales.',
    clue: 'Una serie, evento o muletilla suele funcionar mejor que el país o la plataforma. “Velada” para Ibai y “Troncos” para Perxitaa dejan margen al farol.',
    avoid: 'No uses el nombre real, la primera letra o una pareja pública. Esta categoría solo es justa si el grupo sigue a creadores parecidos.',
  },
  {
    id: 'youtubers',
    label: 'YouTubers',
    phrase: 'de YouTubers',
    slug: 'youtubers',
    summary: 'Canales de entretenimiento, divulgación, viajes y gaming para públicos distintos.',
    intro: 'YouTube mezcla generaciones y nichos muy diferentes. La lista combina gaming, entretenimiento, divulgación, música y viajes para que el anfitrión pueda adaptar las rondas a su grupo.',
    clue: 'Menciona un formato recurrente, una idea visual o un tema del canal. “Pizarra” para QuantumFracture es más elegante que decir “física”.',
    avoid: 'No supongas que popular significa universal. Selecciona esta categoría solo cuando el grupo comparta hábitos de YouTube.',
  },
  {
    id: 'tiktokers',
    label: 'TikTokers',
    phrase: 'de TikTokers',
    slug: 'tiktokers',
    summary: 'Creadores de vídeo corto, humor, fotografía, comida y lifestyle con referencias reconocibles.',
    intro: 'TikTok cambia rápido, así que esta categoría prioriza perfiles con formatos muy definidos. Las mejores pistas apuntan al tipo de vídeo o a una referencia recurrente, no al número de seguidores.',
    clue: 'Piensa en el formato: “perspectiva” para Jordi Koalitic o “bocado” para Peldanyos permiten que los fans se reconozcan sin delatar el nombre.',
    avoid: 'No uses tendencias de una sola semana ni datos personales. Revisa antes que todos conozcan al menos la mayoría de nombres seleccionados.',
  },
  {
    id: 'videojuegos',
    label: 'Videojuegos',
    phrase: 'de videojuegos',
    slug: 'videojuegos',
    summary: 'Éxitos multijugador, clásicos modernos y juegos de culto descritos con mecánicas y recuerdos.',
    intro: 'Videojuegos es ideal para Discord y grupos gamers. La selección mezcla títulos masivos con experiencias de culto, de modo que la dificultad depende del conocimiento compartido y de la sutileza.',
    clue: 'Usa una mecánica lateral: “hipoteca” para Animal Crossing, “economía” para Valorant o “sobres” para EA Sports FC prueban conocimiento sin nombrar un personaje.',
    avoid: 'No menciones al protagonista, la consola o una palabra incluida en el título. Quita los juegos de culto si alguien del grupo no los conoce.',
  },
  {
    id: 'libros',
    label: 'Libros',
    phrase: 'de libros',
    slug: 'libros',
    summary: 'Fantasía, clásicos universales y literatura hispanoamericana con pistas que premian haber leído la obra.',
    intro: 'Libros genera rondas magníficas entre lectores porque una pista puede referirse a estructura, atmósfera, personaje o símbolo. Incluimos éxitos recientes y clásicos en español.',
    clue: 'Elige un motivo secundario: “capítulos” para Rayuela, “sótano” para El Aleph o “cuaderno” para La casa de los espíritus son sutiles pero justificables.',
    avoid: 'No cites un personaje del título ni la adaptación más conocida. Confirma que las obras difíciles forman parte de las lecturas compartidas.',
  },
  {
    id: 'cine_series',
    label: 'Cine y series',
    phrase: 'de cine y series',
    slug: 'cine-y-series',
    summary: 'Películas y series populares, de culto y en español con pistas basadas en escenas y símbolos.',
    intro: 'Cine y series ofrece referencias visuales inmediatas y conversaciones muy rápidas. La mezcla va de títulos familiares a obras que exigen atención a detalles concretos.',
    clue: 'Busca una escena, objeto o regla interna: “escalera” para Parásitos, “chasquido” para Avengers o “treinta y tres” para Dark recompensan a quien conoce la obra.',
    avoid: 'No digas un actor, personaje principal o parte del título. Separa cine de culto si el grupo prefiere referencias masivas.',
  },
  {
    id: 'musica',
    label: 'Música',
    phrase: 'de música',
    slug: 'musica',
    summary: 'Artistas hispanos, estrellas globales y géneros para convertir referencias musicales en pistas de una palabra.',
    intro: 'Música combina artistas muy conocidos con géneros que suben la dificultad. Las asociaciones pueden venir de una canción, una estética, un directo o una característica sonora.',
    clue: 'Usa una etapa o un detalle: “Eras” para Taylor Swift, “Bernabéu” para Duki o “Cali” para salsa son reconocibles sin tararear la respuesta.',
    avoid: 'No cantes una melodía ni digas parte de una letra. En artistas, evita el país o una colaboración que revele demasiado.',
  },
  {
    id: 'futbol',
    label: 'Fútbol',
    phrase: 'de fútbol',
    slug: 'futbol',
    summary: 'Clubes, estrellas, reglas y conceptos tácticos del fútbol de España y América Latina.',
    intro: 'El impostor futbolero ya es un formato propio. Esta selección cruza clubes y jugadores globales con referencias de Argentina, México y Chile, además de conceptos tácticos para expertos.',
    clue: 'Una cifra, gesto o idea táctica funciona mejor que el escudo: “doce” para Boca, “304” para Lamine Yamal y “vacío” para falso nueve abren discusión.',
    avoid: 'No uses colores de camiseta, ciudad o rival directo en la primera ronda. Mezcla conceptos tácticos solo si todos siguen fútbol con cierta frecuencia.',
  },
  {
    id: 'creadores_latam',
    label: 'Creadores LATAM',
    phrase: 'de creadores latinoamericanos',
    slug: 'creadores-latinoamericanos',
    summary: 'Referentes de México, Argentina, Colombia, Chile, Venezuela, Ecuador, El Salvador y la comunidad latina de streaming.',
    intro: 'El juego se comparte a ambos lados del Atlántico. Esta categoría da espacio propio a creadores latinoamericanos, en lugar de tratarlos como una nota al pie de una lista española.',
    clue: 'Usa equipos, comunidades o formatos: “Pío” para Rivers, “Army” para Coscu y “Aniquiladores” para JuanSGuarnizo son pistas para fans, no descripciones genéricas.',
    avoid: 'No uses la nacionalidad como única pista y no mezcles nombres que el grupo nunca haya visto. Lo divertido es reconocer referencias, no adivinar por descarte geográfico.',
  },
  {
    id: 'emociones',
    label: 'Emociones',
    phrase: 'de emociones',
    slug: 'emociones',
    summary: 'Conceptos abstractos para expertos: se describen con gestos, momentos y consecuencias, no con sinónimos.',
    intro: 'Emociones es nuestra categoría más estratégica. Todas las palabras son conocidas, pero carecen de una forma visible; obliga al grupo a pensar en situaciones, reacciones físicas y matices.',
    clue: 'Da una escena o consecuencia: “casi” para frustración, “todavía” para esperanza y “archivo” para resentimiento crean pistas abiertas pero coherentes.',
    avoid: 'No uses un sinónimo directo ni representes la emoción de forma exagerada. Con principiantes, mezcla esta lista con categorías concretas.',
  },
]

const difficultyFor = (index) => index < 7 ? 'Fácil' : index < 14 ? 'Media' : 'Difícil'
const difficultyClass = (difficulty) => difficulty === 'Fácil' ? 'easy' : difficulty === 'Media' ? 'medium' : 'hard'

function html(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function jsonLd(value) {
  return JSON.stringify(value, null, 2).replaceAll('<', '\\u003c')
}

function head({ title, description, canonical, type = 'article', schema }) {
  return `
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/consent.css?v=party1" />
    <script src="/consent.js" defer></script>
    <script src="/visit.js?v=admin1" defer></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${html(title)}</title>
    <meta name="description" content="${html(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="es" href="${canonical}" />
    <link rel="alternate" hreflang="x-default" href="${canonical}" />
    <meta property="og:site_name" content="El Impostor" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:type" content="${type}" />
    <meta property="og:title" content="${html(title)}" />
    <meta property="og:description" content="${html(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${BASE_URL}/og-image-v3.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="El Impostor, juego de palabras online gratis" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${html(title)}" />
    <meta name="twitter:description" content="${html(description)}" />
    <meta name="twitter:image" content="${BASE_URL}/og-image-v3.png" />
    <meta name="twitter:image:alt" content="El Impostor, juego de palabras online gratis" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/seo.css?v=party1" />
    <link href="/fonts/fonts.css?v=party1" rel="stylesheet" />
    <script type="application/ld+json">${jsonLd(schema)}</script>`
}

function siteHeader() {
  return `<header class="wrap topbar">
      <a class="brand" href="/">El Impostor</a>
      <nav class="nav" aria-label="Guías">
        <a href="/palabras-para-el-impostor/">Palabras</a>
        <a href="/como-jugar/">Cómo jugar</a>
        <a href="/juego-impostor-online/">Juego online</a>
      </nav>
    </header>`
}

function siteFooter() {
  return `<footer class="wrap footer">
      <strong>El Impostor</strong> · Juego de palabras online gratis para 3–12 personas.
      <span class="footer-links"><a href="/?create=1">Crear sala</a> · <a href="/como-jugar/">Reglas</a> · <a href="/palabras-para-el-impostor/">Todas las palabras</a> · <a href="/privacidad/">Datos y privacidad</a></span>
    </footer>`
}

function categoryPage(category, words) {
  const canonical = `${BASE_URL}/palabras-para-el-impostor/${category.slug}/`
  const title = `20 palabras ${category.phrase} para El Impostor`
  const description = `20 palabras ${category.phrase} para jugar a El Impostor, con pistas sutiles, dificultad gradual y consejos para una ronda equilibrada.`
  const enriched = words.map((word, index) => ({ ...word, difficulty: difficultyFor(index) }))
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'El Impostor', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Palabras para El Impostor', item: `${BASE_URL}/palabras-para-el-impostor/` },
          { '@type': 'ListItem', position: 3, name: category.label, item: canonical },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'es',
        dateModified: LAST_MODIFIED,
        isPartOf: { '@type': 'WebSite', name: 'El Impostor', url: `${BASE_URL}/` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: enriched.length,
          itemListElement: enriched.map((word, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: word.word,
            description: `Pista sutil: ${word.hint}. Dificultad: ${word.difficulty}.`,
          })),
        },
      },
    ],
  }
  const rows = enriched.map((word, index) => `
              <tr>
                <td class="row-number">${index + 1}</td>
                <th scope="row">${html(word.word)}</th>
                <td><span class="hint-chip">${html(word.hint)}</span></td>
                <td><span class="difficulty ${difficultyClass(word.difficulty)}">${word.difficulty}</span></td>
              </tr>`).join('')
  const related = categories
    .filter((item) => item.id !== category.id)
    .sort((a, b) => {
      const featured = ['creadores_latam', 'futbol', 'cine_series', 'emociones']
      return featured.indexOf(a.id) - featured.indexOf(b.id)
    })
    .slice(0, 5)
    .map((item) => `<a class="topic-link" href="/palabras-para-el-impostor/${item.slug}/">${html(item.label)}</a>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
  <head>${head({ title, description, canonical, schema })}
  </head>
  <body>
    ${siteHeader()}
    <main class="wrap">
      <nav class="breadcrumbs" aria-label="Migas de pan">
        <a href="/">Inicio</a><span aria-hidden="true">/</span>
        <a href="/palabras-para-el-impostor/">Palabras</a><span aria-hidden="true">/</span>
        <span aria-current="page">${html(category.label)}</span>
      </nav>

      <section class="hero compact-hero">
        <span class="eyebrow">Categoría · 20 ideas</span>
        <h1>${html(title)}</h1>
        <p class="lead">${html(category.intro)}</p>
        <div class="cta-row">
          <a class="btn primary" href="/?category=${encodeURIComponent(category.id)}">Jugar con ${html(category.label.toLocaleLowerCase('es'))}</a>
          <a class="btn" href="/palabras-para-el-impostor/">Ver 400 palabras</a>
        </div>
      </section>

      <section class="stats" aria-label="Resumen de la lista">
        <div><strong>20</strong><span>palabras</span></div>
        <div><strong>7</strong><span>fáciles</span></div>
        <div><strong>7</strong><span>medias</span></div>
        <div><strong>6</strong><span>difíciles</span></div>
      </section>

      <section class="section prose">
        <h2>Lista de palabras y pistas sutiles</h2>
        <p>La dificultad aumenta de forma gradual. La pista es la ayuda opcional que puede ver el impostor si el anfitrión activa esa regla; también sirve como ejemplo del nivel de sutileza que buscamos.</p>
        <div class="table-wrap">
          <table class="words-table">
            <caption>Palabras ${html(category.phrase)} ordenadas por dificultad</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Palabra secreta</th><th scope="col">Pista sutil</th><th scope="col">Nivel</th></tr></thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
      </section>

      <section class="editorial-grid">
        <article class="card">
          <span class="card-kicker">Estrategia</span>
          <h2>Cómo dar una buena pista</h2>
          <p>${html(category.clue)}</p>
        </article>
        <article class="card">
          <span class="card-kicker">Equilibrio</span>
          <h2>Qué conviene evitar</h2>
          <p>${html(category.avoid)}</p>
        </article>
      </section>

      <section class="section callout">
        <div>
          <span class="card-kicker">Del listado a la partida</span>
          <h2>Juega online sin preparar tarjetas</h2>
          <p>El enlace prepara una sala con ${html(category.label.toLocaleLowerCase('es'))}. Escribe tu nombre e invita al grupo. Después puedes combinar categorías y elegir si el impostor recibe una pista. Cada persona ve su papel en privado.</p>
        </div>
        <a class="btn primary" href="/?category=${encodeURIComponent(category.id)}">Crear sala con ${html(category.label.toLocaleLowerCase('es'))}</a>
      </section>

      <section class="section">
        <h2>Explora otras categorías</h2>
        <div class="topic-links">${related}</div>
      </section>
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

function hubPage(wordsByCategory) {
  const canonical = `${BASE_URL}/palabras-para-el-impostor/`
  const title = '400 palabras para El Impostor: categorías y pistas'
  const description = '400 palabras para jugar a El Impostor en 20 categorías, con pistas sutiles y dificultad: animales, fútbol, streamers, comida, cine y más.'
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'El Impostor', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Palabras para El Impostor', item: canonical },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'es',
        dateModified: LAST_MODIFIED,
        isPartOf: { '@type': 'WebSite', name: 'El Impostor', url: `${BASE_URL}/` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: categories.length,
          itemListElement: categories.map((category, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: category.label,
            url: `${canonical}${category.slug}/`,
          })),
        },
      },
    ],
  }
  const cards = categories.map((category, index) => {
    const items = wordsByCategory.get(category.id)
    const samples = items.slice(0, 5).map((word) => `<span>${html(word.word)}</span>`).join('')
    return `<article class="category-card" style="--card-index:${index}">
          <div class="category-card-top"><span class="category-number">${String(index + 1).padStart(2, '0')}</span><span>20 palabras</span></div>
          <h2><a href="/palabras-para-el-impostor/${category.slug}/">${html(category.label)}</a></h2>
          <p>${html(category.summary)}</p>
          <div class="sample-words" aria-label="Ejemplos">${samples}</div>
          <a class="text-link" href="/palabras-para-el-impostor/${category.slug}/">Ver palabras y pistas <span aria-hidden="true">→</span></a>
        </article>`
  }).join('\n        ')

  return `<!DOCTYPE html>
<html lang="es">
  <head>${head({ title, description, canonical, type: 'website', schema })}
  </head>
  <body>
    ${siteHeader()}
    <main class="wrap">
      <nav class="breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Palabras</span></nav>

      <section class="hero">
        <span class="eyebrow">Actualizado · 20 categorías</span>
        <h1>400 palabras para El Impostor</h1>
        <p class="lead">Palabras conocidas, pistas menos obvias y dificultad gradual. Hemos ordenado el catálogo que usa el juego para que puedas elegir una temática, preparar una partida o inspirarte antes de crear una sala.</p>
        <div class="cta-row">
          <a class="btn primary" href="/?create=1">Jugar ahora</a>
          <a class="btn" href="#categorias">Explorar categorías</a>
        </div>
      </section>

      <section class="stats" aria-label="Resumen del catálogo">
        <div><strong>400</strong><span>palabras</span></div>
        <div><strong>20</strong><span>categorías</span></div>
        <div><strong>3</strong><span>niveles</span></div>
        <div><strong>0 €</strong><span>para jugar</span></div>
      </section>

      <section class="section prose">
        <span class="card-kicker">Criterio editorial</span>
        <h2>Qué hace buena una palabra para el juego del impostor</h2>
        <p>Una palabra justa es conocida por el grupo y permite varios caminos de pista: una escena, una sensación, una función, un contraste o un recuerdo. Si solo existe una asociación evidente, el primer jugador regala la respuesta; si nadie conoce el término, todos parecen impostores.</p>
        <div class="principles">
          <div><strong>Conocida</strong><span>No exige buscar una definición.</span></div>
          <div><strong>Flexible</strong><span>Admite al menos cuatro ángulos.</span></div>
          <div><strong>Concreta</strong><span>Permite detectar pistas vacías.</span></div>
          <div><strong>Compartida</strong><span>Encaja con la cultura del grupo.</span></div>
        </div>
      </section>

      <section class="section" id="categorias">
        <span class="card-kicker">Elige tu temática</span>
        <h2>20 categorías de palabras</h2>
        <p class="section-intro">Cada página incluye 20 palabras ordenadas de fácil a difícil, su pista sutil y consejos específicos para que la ronda no se rompa.</p>
        <div class="category-catalog">${cards}
        </div>
      </section>

      <section class="section creator-feature">
        <div>
          <span class="card-kicker">Del streaming a tu grupo</span>
          <h2>Ibai, AuronPlay y el boom de Adivina el Impostor</h2>
          <p>El formato ha saltado a audiencias masivas con partidas de Ibai. En la edición con AuronPlay también participaron Perxitaa, Polispol y Saara Ismael; varias de sus palabras —Minecraft, México, Harry Potter o TheGrefg— muestran por qué las referencias compartidas crean rondas tan rápidas.</p>
          <p>También ampliamos el catálogo con una categoría propia para creadores de América Latina: Luisito Comunica, Alejo Igoa, Germán Garmendia, Fernanfloo, Rivers, JuanSGuarnizo, Ari Gameplays, Coscu, Davoo Xeneize, La Cobra y más.</p>
          <div class="topic-links">
            <a class="topic-link" href="/palabras-para-el-impostor/streamers/">Streamers</a>
            <a class="topic-link" href="/palabras-para-el-impostor/creadores-latinoamericanos/">Creadores LATAM</a>
            <a class="topic-link" href="/palabras-para-el-impostor/futbol/">Impostor futbolero</a>
          </div>
        </div>
        <aside class="quote-card" aria-label="Ejemplos de pistas">
          <span>PALABRA</span><strong>IBAI</strong>
          <span>PISTA SUTIL</span><strong>VELADA</strong>
          <span>PALABRA</span><strong>PERXITAA</strong>
          <span>PISTA SUTIL</span><strong>TRONCOS</strong>
        </aside>
      </section>

      <section class="editorial-grid">
        <article class="card">
          <span class="card-kicker">Si sois nuevos</span>
          <h2>Empieza por lo concreto</h2>
          <p>Animales, comida, lugares y objetos reducen los bloqueos. Elige varias categorías para que el impostor no deduzca el tema antes de escuchar una sola pista.</p>
        </article>
        <article class="card">
          <span class="card-kicker">Si ya domináis</span>
          <h2>Sube la ambigüedad</h2>
          <p>Emociones, ciencia, ficción y cultura son difíciles sin depender de palabras desconocidas. La complejidad está en justificar una pista, no en memorizar datos.</p>
        </article>
      </section>

      <section class="section prose faq">
        <span class="card-kicker">Respuestas rápidas</span>
        <h2>Preguntas sobre palabras y pistas</h2>
        <details><summary>¿Cuántas palabras necesito para una partida?</summary><p>Una por partida. Con 20 palabras por categoría puedes repetir temática sin que el grupo anticipe la respuesta.</p></details>
        <details><summary>¿Cuál es la mejor categoría para empezar?</summary><p>Animales, comida, lugares u objetos. Son conceptos compartidos y permiten pistas desde varios ángulos.</p></details>
        <details><summary>¿La pista es para todos o solo para el impostor?</summary><p>En nuestro juego todos los jugadores normales conocen la palabra y su pista. El anfitrión decide si el impostor recibe también esa ayuda sutil.</p></details>
        <details><summary>¿Cómo hago una palabra más difícil sin volverla rara?</summary><p>Elige una palabra conocida y prohíbe sus asociaciones más directas. “Aeropuerto” sigue siendo universal, pero “despedida” genera mejor debate que “avión”.</p></details>
      </section>

      <section class="section callout">
        <div><span class="card-kicker">Todo preparado</span><h2>Elige categorías y empieza</h2><p>El servidor reparte la palabra y el rol en privado. Solo necesitas compartir el enlace con 3–12 personas.</p></div>
        <a class="btn primary" href="/?create=1">Crear sala gratis</a>
      </section>
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

async function emit(relativePath, content) {
  const target = path.join(PUBLIC_DIR, relativePath)
  if (CHECK_ONLY) {
    let current = ''
    try { current = await readFile(target, 'utf8') } catch {}
    if (current !== content) throw new Error(`SEO page out of date: ${relativePath}`)
    return
  }
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, 'utf8')
}

async function main() {
  const words = JSON.parse(await readFile(WORDS_PATH, 'utf8'))
  const wordsByCategory = new Map(categories.map((category) => [
    category.id,
    words.filter((word) => word.category === category.id),
  ]))

  for (const category of categories) {
    const categoryWords = wordsByCategory.get(category.id)
    if (categoryWords.length !== 20) {
      throw new Error(`${category.id} must contain exactly 20 words; found ${categoryWords.length}`)
    }
  }
  const known = new Set(categories.map((category) => category.id))
  const unknown = [...new Set(words.map((word) => word.category).filter((id) => !known.has(id)))]
  if (unknown.length) throw new Error(`Missing SEO metadata for: ${unknown.join(', ')}`)

  await emit('palabras-para-el-impostor/index.html', hubPage(wordsByCategory))
  for (const category of categories) {
    await emit(
      path.join('palabras-para-el-impostor', category.slug, 'index.html'),
      categoryPage(category, wordsByCategory.get(category.id)),
    )
  }

  const staticUrls = [
    { loc: '/', modified: GUIDES_MODIFIED },
    { loc: '/juego-impostor-online/', modified: GUIDES_MODIFIED },
    { loc: '/como-jugar/', modified: GUIDES_MODIFIED },
    { loc: '/palabras-para-el-impostor/', modified: LAST_MODIFIED },
    ...categories.map((category) => ({
      loc: `/palabras-para-el-impostor/${category.slug}/`,
      modified: LAST_MODIFIED,
    })),
  ]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map(({ loc, modified }) => `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n    <lastmod>${modified}</lastmod>\n  </url>`).join('\n')}
</urlset>
`
  await emit('sitemap.xml', sitemap)
  console.log(`${CHECK_ONLY ? 'Verified' : 'Generated'} ${categories.length + 2} SEO files from ${words.length} words.`)
}

await main()
