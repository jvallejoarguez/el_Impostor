import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public')
const WORDS_PATH = path.join(ROOT, 'worker', 'src', 'words.json')
// Hand-edited clue ideas per secret word: { related: [10–12], hint: why the hint fits, bluffs: [3] }.
const RELATED_PATH = path.join(ROOT, 'scripts', 'related-words.json')
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
    summary: 'Ibai, AuronPlay, Rubius y protagonistas del streaming español con referencias para fans.',
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
const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f'’]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const wordPath = (category, word) => `/palabras-para-el-impostor/${category.slug}/${slugify(word.word)}/`

// Common nouns read lowercase mid-sentence ("palabras relacionadas con glaciar"); names keep their capitals.
const COMMON_NOUN_CATEGORIES = new Set(['animales', 'comida', 'lugares', 'objetos', 'naturaleza', 'cultura', 'profesiones', 'deportes', 'ficcion', 'ciencia', 'emociones'])
const PROPER_NOUNS = new Set(['Navidad', 'Carnaval', 'Día de Muertos', 'ADN', 'Saturno'])
const COMMON_NOUNS = new Set(['Reguetón', 'Salsa', 'Bachata', 'Bossa nova', 'Penalti', 'Panenka', 'Falso nueve', 'Gol olímpico', 'Chilena', 'Tiki-taka'])
const inSentence = (word) => (COMMON_NOUN_CATEGORIES.has(word.category) && !PROPER_NOUNS.has(word.word)) || COMMON_NOUNS.has(word.word)
  ? word.word.toLocaleLowerCase('es')
  : word.word

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
    <link rel="stylesheet" href="/consent.css?v=party2" />
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
    <link rel="stylesheet" href="/seo.css?v=party2" />
    <link href="/fonts/fonts.css?v=party2" rel="stylesheet" />
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
      <strong>El Impostor</strong> · Juego de palabras online gratis para 3–16 personas.
      <span class="footer-links"><a href="/?create=1">Crear sala</a> · <a href="/como-jugar/">Reglas</a> · <a href="/palabras-para-el-impostor/">Todas las palabras</a> · <a href="/jugar-en-discord-y-twitch/">Discord y Twitch</a> · <a href="/privacidad/">Datos y privacidad</a></span>
    </footer>`
}

function categoryPage(category, words) {
  const canonical = `${BASE_URL}/palabras-para-el-impostor/${category.slug}/`
  const title = `Palabras ${category.phrase} para jugar al impostor: 20 ideas con pistas`
  const heading = `Palabras ${category.phrase} para jugar al impostor`
  const description = `20 palabras ${category.phrase} para jugar al impostor, de fáciles a difíciles y con una pista para el impostor. Úsalas en papel o en una sala online gratis, cada uno en su móvil.`
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
                <th scope="row">${word.person ? html(word.word) : `<a href="${wordPath(category, word)}">${html(word.word)}</a>`}</th>
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
        <h1>${html(heading)}</h1>
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
        <p>La dificultad aumenta de forma gradual. La pista es la ayuda opcional que puede ver el impostor si el anfitrión activa esa regla; también sirve como ejemplo del nivel de sutileza que buscamos. Pulsa una palabra para ver más pistas relacionadas con ella.</p>
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
  const title = 'Palabras para jugar al impostor: 400 ideas fáciles y difíciles'
  const description = '400 palabras para jugar al impostor en 20 temas (animales, comida, fútbol, streamers, cine…), de fáciles a difíciles y con pista para el impostor. Gratis y sin registro.'
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
        <h1>Palabras para jugar al impostor</h1>
        <p class="lead">Palabras conocidas, pistas menos obvias y dificultad gradual. Hemos ordenado el catálogo que usa el juego para que puedas elegir una temática, preparar una partida o inspirarte antes de crear una sala.</p>
        <div class="cta-row">
          <a class="btn primary" href="/?create=1">Jugar ahora</a>
          <a class="btn" href="#categorias">Explorar categorías</a>
        </div>
        <nav class="topic-links" aria-label="Listas rápidas">
          <a class="topic-link" href="/palabras-para-el-impostor/faciles/">Palabras fáciles</a>
          <a class="topic-link" href="/palabras-para-el-impostor/dificiles/">Palabras difíciles</a>
          <a class="topic-link" href="/que-decir-si-eres-el-impostor/">Qué decir si eres el impostor</a>
        </nav>
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
          <span>PALABRA</span><strong>AURONPLAY</strong>
          <span>PISTA SUTIL</span><strong>TORTILLALAND</strong>
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
        <div><span class="card-kicker">Todo preparado</span><h2>Elige categorías y empieza</h2><p>El servidor reparte la palabra y el rol en privado. Solo necesitas compartir el enlace con 3–16 personas.</p></div>
        <a class="btn primary" href="/?create=1">Crear sala gratis</a>
      </section>
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

// One list per difficulty, across every category: "palabras difíciles para jugar al impostor".
const LEVELS = {
  faciles: { label: 'Fácil', name: 'fáciles', lead: 'Palabras que todo el mundo conoce, ideales para la primera partida, para jugar con peques o para explicar las reglas. Hay muchas formas de dar una pista, así que nadie se queda en blanco.' },
  dificiles: { label: 'Difícil', name: 'difíciles', lead: 'Palabras con menos asociaciones evidentes: obligan a dar pistas más finas y le ponen las cosas difíciles al impostor. Funcionan mejor con un grupo que ya ha jugado varias rondas.' },
}

function levelPage(slug, wordsByCategory) {
  const level = LEVELS[slug]
  const canonical = `${BASE_URL}/palabras-para-el-impostor/${slug}/`
  const picked = categories.flatMap((category) => wordsByCategory.get(category.id)
    .map((word, index) => ({ ...word, category, difficulty: difficultyFor(index) }))
    .filter((word) => word.difficulty === level.label))
  const title = `Palabras ${level.name} para jugar al impostor: ${picked.length} ideas con pistas`
  const heading = `Palabras ${level.name} para jugar al impostor`
  const description = `${picked.length} palabras ${level.name} para jugar al impostor, de 20 temas distintos y con una pista para el impostor. Gratis, en papel o en una sala online.`
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'El Impostor', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Palabras para El Impostor', item: `${BASE_URL}/palabras-para-el-impostor/` },
          { '@type': 'ListItem', position: 3, name: heading, item: canonical },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'es',
        dateModified: GUIDES_MODIFIED,
        mainEntity: { '@type': 'ItemList', numberOfItems: picked.length, itemListElement: picked.map((word, index) => ({ '@type': 'ListItem', position: index + 1, name: word.word })) },
      },
    ],
  }
  const rows = picked.map((word) => `
              <tr>
                <th scope="row">${word.person ? html(word.word) : `<a href="${wordPath(word.category, word)}">${html(word.word)}</a>`}</th>
                <td><span class="hint-chip">${html(word.hint)}</span></td>
                <td><a href="/palabras-para-el-impostor/${word.category.slug}/">${html(word.category.label)}</a></td>
              </tr>`).join('')
  const other = slug === 'faciles' ? 'dificiles' : 'faciles'
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
        <span aria-current="page">${html(level.name[0].toUpperCase() + level.name.slice(1))}</span>
      </nav>

      <section class="hero compact-hero">
        <span class="eyebrow">${picked.length} ideas · 20 temas</span>
        <h1>${html(heading)}</h1>
        <p class="lead">${html(level.lead)}</p>
        <div class="cta-row">
          <a class="btn primary" href="/?create=1">Jugar gratis online</a>
          <a class="btn" href="/palabras-para-el-impostor/${other}/">Ver palabras ${LEVELS[other].name}</a>
        </div>
      </section>

      <section class="section prose">
        <h2>Lista de palabras ${html(level.name)} con pista</h2>
        <p>La pista es la ayuda opcional que puede ver el impostor si el anfitrión la activa. También te sirve de ejemplo: relacionada con la palabra, pero sin regalarla.</p>
        <div class="table-wrap">
          <table class="words-table">
            <caption>Palabras ${html(level.name)} para jugar al impostor, por tema</caption>
            <thead><tr><th scope="col">Palabra secreta</th><th scope="col">Pista para el impostor</th><th scope="col">Tema</th></tr></thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section callout">
        <div>
          <span class="card-kicker">Sin papel ni tarjetas</span>
          <h2>Juega con estas palabras online</h2>
          <p>Crea una sala gratis, comparte el enlace por WhatsApp y cada persona ve su papel en su móvil. El juego reparte la palabra y elige al impostor por ti.</p>
        </div>
        <a class="btn primary" href="/?create=1">Crear sala gratis</a>
      </section>

      <section class="section">
        <h2>Más ideas para tu partida</h2>
        <div class="topic-links">
          <a class="topic-link" href="/que-decir-si-eres-el-impostor/">Qué decir si eres el impostor</a>
          <a class="topic-link" href="/palabras-para-el-impostor/">Todas las categorías</a>
          <a class="topic-link" href="/como-jugar/">Reglas del juego</a>
        </div>
      </section>
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

// "Qué decir si eres el impostor" / "palabras comodín": advice for both roles.
const WILDCARDS = [
  ['Grande', 'Casi todo puede ser grande o pequeño, y nadie te lo discutirá.'],
  ['Clásico', 'Encaja con comidas, lugares, películas, canciones y personas.'],
  ['Recuerdo', 'Suena personal y obliga a los demás a imaginarse algo.'],
  ['Color', 'Todo tiene uno; parece que estás pensando en el aspecto.'],
  ['Caro', 'Sirve para objetos, viajes, comida, fichajes y marcas.'],
  ['Ruido', 'Animales, lugares, deportes, música: casi todo suena.'],
  ['Verano', 'Una estación conecta con playa, comida, deporte y viajes.'],
  ['Familia', 'Funciona con casas, comidas, películas y profesiones.'],
  ['Rápido', 'Animales, coches, deportes, juegos y hasta emociones.'],
  ['Peligro', 'Animales, lugares, ciencia y aventuras: da credibilidad.'],
]
function tipsPage() {
  const canonical = `${BASE_URL}/que-decir-si-eres-el-impostor/`
  const title = 'Qué decir si eres el impostor: 10 palabras comodín y trucos'
  const heading = 'Qué decir si eres el impostor'
  const description = 'Te ha tocado ser el impostor y no sabes la palabra: 10 palabras comodín, cómo usar las pistas de los demás y qué errores te delatan. También, cómo pillar al impostor.'
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'El Impostor', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: heading, item: canonical },
        ],
      },
      { '@type': 'Article', headline: title, description, url: canonical, inLanguage: 'es', dateModified: GUIDES_MODIFIED, author: { '@type': 'Organization', name: 'El Impostor' } },
    ],
  }
  const wildcards = WILDCARDS.map(([word, why]) => `
            <li><strong>${html(word)}</strong> ${html(why)}</li>`).join('')
  return `<!DOCTYPE html>
<html lang="es">
  <head>${head({ title, description, canonical, schema })}
  </head>
  <body>
    ${siteHeader()}
    <main class="wrap">
      <nav class="breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Qué decir si eres el impostor</span></nav>

      <section class="hero compact-hero">
        <span class="eyebrow">Guía rápida</span>
        <h1>${html(heading)}</h1>
        <p class="lead">Todos tienen la palabra menos tú. Tu objetivo es dar una pista creíble, sin comprometerte, y aguantar hasta la votación. Estas ideas funcionan igual en papel que en una sala online.</p>
        <div class="cta-row">
          <a class="btn primary" href="/?create=1">Practicar en una sala gratis</a>
          <a class="btn" href="/palabras-para-el-impostor/">Ver palabras para jugar</a>
        </div>
      </section>

      <section class="section prose">
        <h2>1. Antes de tu turno, escucha</h2>
        <p>Si no te toca empezar, las pistas de los demás son tu mejor información. Busca lo que tienen en común: si alguien dice «arena» y otro «sol», el tema probablemente es playa, verano o vacaciones. Tu pista debe sonar al mismo tema sin repetir ninguna de las anteriores.</p>

        <h2>2. Palabras comodín que encajan con casi todo</h2>
        <p>Cuando no tienes ni idea, usa una palabra amplia que se pueda relacionar con muchas cosas. Úsalas con calma y solo una vez por partida: si las encadenas, el grupo se dará cuenta.</p>
        <ul class="wildcards">${wildcards}
        </ul>

        <h2>3. Si te toca empezar</h2>
        <p>Empezar sin saber la palabra da miedo, pero también es una ventaja: nadie puede comparar tu pista con otras. Elige una sensación o un momento en vez de un objeto concreto, por ejemplo «nervios», «domingo» o «infancia». Una pista vaga en la primera ronda es normal.</p>

        <h2>4. Cómo usar la pista del impostor</h2>
        <p>Si el anfitrión activa la pista, recibes una palabra relacionada con la secreta. No la digas tal cual: muchos jugadores la reconocerán. Da un paso hacia un lado. Si tu pista es «correa», no digas «perro» ni «correa»; prueba con «paseo» o «parque».</p>

        <h2>5. Errores que delatan al impostor</h2>
        <ul>
          <li>Repetir con otra palabra lo que ya dijo alguien.</li>
          <li>Tardar mucho más que el resto en contestar.</li>
          <li>Ser siempre demasiado general, ronda tras ronda.</li>
          <li>Cambiar de tema en el debate o acusar demasiado pronto.</li>
        </ul>

        <h2>6. Si tienes la palabra: cómo pillar al impostor</h2>
        <p>Da pistas que solo entiende quien conoce la palabra, sin ser tan obvio que el impostor la adivine. Fíjate en quién copia el estilo de las pistas anteriores, quién responde tarde y quién se queda en lo genérico. En el debate, pide a cada sospechoso que explique su pista: el impostor suele dudar.</p>
      </section>

      <section class="section callout">
        <div>
          <span class="card-kicker">Ponlo a prueba</span>
          <h2>Juega al impostor online con tus amigos</h2>
          <p>Gratis y sin registro. Crea una sala, comparte el enlace y cada persona juega desde su móvil.</p>
        </div>
        <a class="btn primary" href="/?create=1">Crear sala gratis</a>
      </section>

      <section class="section">
        <h2>Más ideas para tu partida</h2>
        <div class="topic-links">
          <a class="topic-link" href="/palabras-para-el-impostor/faciles/">Palabras fáciles</a>
          <a class="topic-link" href="/palabras-para-el-impostor/dificiles/">Palabras difíciles</a>
          <a class="topic-link" href="/como-jugar/">Reglas del juego</a>
        </div>
      </section>
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

// Discord calls and Twitch streams: how to play, streamer mode, custom words.
const STREAM_FAQ = [
  ['¿Se puede jugar a El Impostor en Discord?', 'Sí. Crea una sala en juegoimpostor.app, pega el enlace en tu servidor o en el chat de voz y cada persona entra desde su navegador, en el ordenador o en el móvil. Habláis por la llamada de Discord y el juego reparte las palabras en privado.'],
  ['¿Hay que descargar algo o crear una cuenta?', 'No. Funciona en el navegador, es gratis y no pide registro: solo un nombre para la partida.'],
  ['¿Cuántas personas pueden jugar?', 'De 3 a 16 jugadores por sala. Con grupos grandes, la pantalla de juego cambia a una cuadrícula para que se lean bien todos los nombres y pistas.'],
  ['¿Cómo evito que el chat de Twitch vea mi palabra o el código de la sala?', 'Activa el modo streamer en la sala de espera. Oculta el código, el QR y el enlace en pantalla, quita el código de la barra de direcciones y deja tu rol tapado: lo ves manteniendo pulsado. El sonido del reparto es el mismo para todos, así que tampoco te delata.'],
  ['¿Puedo usar palabras propias de mi comunidad?', 'Sí. El anfitrión puede escribir hasta 100 palabras (bromas internas, nombres del servidor, un tema) y jugar solo con ellas o mezcladas con las 400 del juego. El resto del grupo solo ve cuántas hay.'],
  ['¿Es un buen juego para jugar con viewers?', 'Funciona mejor con un grupo que habla en voz: tú y tus amigos o mods en la llamada, y el chat intentando adivinar quién es el impostor mientras dais pistas. Cada ronda dura unos minutos y las votaciones dan muchos momentos para el directo.'],
]
function streamPage() {
  const canonical = `${BASE_URL}/jugar-en-discord-y-twitch/`
  const title = 'El Impostor en Discord y Twitch: juego para jugar con amigos en llamada'
  const heading = 'Juega a El Impostor en Discord y en directo'
  const description = 'Juego de palabras gratis para jugar con amigos en una llamada de Discord o en directo en Twitch: de 3 a 16 jugadores, sin descargas, con modo streamer y palabras propias.'
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'El Impostor', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: heading, item: canonical },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: STREAM_FAQ.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
      },
    ],
  }
  const faq = STREAM_FAQ.map(([question, answer]) => `
        <details class="faq"><summary>${html(question)}</summary><p>${html(answer)}</p></details>`).join('')
  return `<!DOCTYPE html>
<html lang="es">
  <head>${head({ title, description, canonical, schema })}
  </head>
  <body>
    ${siteHeader()}
    <main class="wrap">
      <nav class="breadcrumbs" aria-label="Migas de pan"><a href="/">Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Discord y Twitch</span></nav>

      <section class="hero compact-hero">
        <span class="eyebrow">Gratis · 3 a 16 jugadores · Sin descargas</span>
        <h1>${html(heading)}</h1>
        <p class="lead">El Impostor es un juego de palabras para jugar con amigos en una llamada: todos reciben la misma palabra menos uno, el impostor, que tiene que disimular. Funciona en el navegador del ordenador o del móvil, así que encaja en cualquier noche de Discord o directo de Twitch.</p>
        <div class="cta-row">
          <a class="btn primary" href="/?create=1">Crear sala gratis</a>
          <a class="btn" href="/como-jugar/">Ver las reglas</a>
        </div>
      </section>

      <section class="section prose">
        <h2>Cómo jugar en una llamada de Discord</h2>
        <ol>
          <li>Una persona crea la sala en juegoimpostor.app y elige categorías o escribe palabras propias.</li>
          <li>Pega el enlace de invitación en el canal de texto de tu servidor.</li>
          <li>Cada jugador lo abre en su navegador y escribe su nombre. Seguís hablando por el canal de voz.</li>
          <li>El juego reparte la palabra en privado, marca los turnos de pistas y lleva la votación.</li>
        </ol>
        <p>No hace falta compartir pantalla: cada persona ve su papel en su propio dispositivo.</p>

        <h2>Para streamers: modo streamer</h2>
        <p>Actívalo en la sala de espera antes de empezar. Oculta el código de la sala, el QR y el enlace, quita el código de la barra de direcciones y tapa tu rol: lo ves manteniendo pulsada la tarjeta. Así puedes enseñar la partida entera en directo sin que el chat se cuele en la sala ni vea tu palabra.</p>
        <p>Idea para el chat: deja que los viewers voten en el chat de Twitch quién creen que es el impostor antes de la votación de la sala.</p>

        <h2>Palabras propias para tu comunidad</h2>
        <p>Como anfitrión puedes escribir hasta 100 palabras: memes del servidor, nombres de la comunidad, juegos que jugáis juntos. Elige jugar solo con ellas o mezclarlas con las 400 palabras del juego en 20 categorías, entre ellas <a href="/palabras-para-el-impostor/streamers/">streamers</a>, <a href="/palabras-para-el-impostor/videojuegos/">videojuegos</a> y <a href="/palabras-para-el-impostor/youtubers/">youtubers</a>.</p>

        <h2>Mensaje para tu servidor</h2>
        <p>Cópialo, añade tu enlace de sala y publícalo en tu canal de anuncios:</p>
        <blockquote class="copy-message">🕵️ Noche de El Impostor en el canal de voz. Todos tienen la palabra menos uno: dad pistas, debatid y votad quién finge. Entrad desde el navegador, sin descargas: [pega aquí el enlace de la sala]</blockquote>
      </section>

      <section class="section prose">
        <h2>Preguntas frecuentes</h2>${faq}
      </section>

      <section class="section callout">
        <div>
          <span class="card-kicker">Listo en un minuto</span>
          <h2>Crea la sala y pega el enlace en Discord</h2>
          <p>Gratis, sin registro y para 3 a 16 personas.</p>
        </div>
        <a class="btn primary" href="/?create=1">Crear sala gratis</a>
      </section>
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

// One page per secret word: "palabras relacionadas con glaciar para jugar al impostor".
function wordPage(category, words, index, clues) {
  const word = words[index]
  const name = inSentence(word)
  const categoryPath = `/palabras-para-el-impostor/${category.slug}/`
  const canonical = `${BASE_URL}${wordPath(category, word)}`
  const title = `Palabras relacionadas con ${name} para jugar al impostor`
  const quoted = (items) => items.map((item) => `«${item}»`)
  const description = `${clues.related.length} pistas para ${name} en el juego del impostor, como ${quoted(clues.related.slice(0, 3)).join(', ')}. Con la pista del impostor explicada y tres faroles si no sabes la palabra.`
  const pool = words.filter((item) => !item.person)
  const at = pool.indexOf(word)
  const siblings = [1, 2, 3, 4].map((step) => pool[(at + step) % pool.length])
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'El Impostor', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Palabras para El Impostor', item: `${BASE_URL}/palabras-para-el-impostor/` },
          { '@type': 'ListItem', position: 3, name: category.label, item: `${BASE_URL}${categoryPath}` },
          { '@type': 'ListItem', position: 4, name: word.word, item: canonical },
        ],
      },
      {
        '@type': 'Article',
        headline: title,
        description,
        url: canonical,
        inLanguage: 'es',
        dateModified: LAST_MODIFIED,
        isPartOf: { '@type': 'WebSite', name: 'El Impostor', url: `${BASE_URL}/` },
        author: { '@type': 'Organization', name: 'El Impostor' },
      },
    ],
  }
  const related = clues.related.map((item) => `
          <li>${html(item)}</li>`).join('')
  const siblingLinks = siblings.map((item) => `<a class="topic-link" href="${wordPath(category, item)}">${html(item.word)}</a>`).join('')
  const play = category.label.toLocaleLowerCase('es')

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
        <a href="${categoryPath}">${html(category.label)}</a><span aria-hidden="true">/</span>
        <span aria-current="page">${html(word.word)}</span>
      </nav>

      <section class="hero compact-hero">
        <span class="eyebrow">${html(category.label)} · ${difficultyFor(index)}</span>
        <h1>${html(title)}</h1>
        <p class="lead">Te ha tocado ${html(name)} y no sabes qué decir. Estas pistas demuestran que conoces la palabra sin ponérselo fácil al impostor.</p>
        <div class="cta-row">
          <a class="btn primary" href="/?category=${encodeURIComponent(category.id)}">Jugar con ${html(play)}</a>
          <a class="btn" href="${categoryPath}">Ver las 20 palabras</a>
        </div>
      </section>

      <section class="section prose">
        <h2>${clues.related.length} palabras relacionadas con ${html(name)}</h2>
        <p>Van de la más evidente a la más sutil. Elige una que nadie haya dicho todavía: en la primera ronda, cuanto más sutil, mejor; si te acusan, guarda una más clara para defenderte.</p>
        <ul class="word-list">${related}
        </ul>
      </section>

      <section class="editorial-grid">
        <article class="card">
          <span class="card-kicker">Pista del impostor</span>
          <h2>«${html(word.hint)}»</h2>
          <p>${html(clues.hint)}</p>
          <p>Si el anfitrión activa la pista, el impostor ve «${html(word.hint)}» en lugar de la palabra. No la repitas: le confirmarías que va bien encaminado.</p>
        </article>
        <article class="card">
          <span class="card-kicker">Si eres el impostor</span>
          <h2>Tres faroles seguros</h2>
          <p>Si sospechas que la palabra es ${html(name)} pero no estás seguro, di algo amplio que encaje también con otras palabras ${html(category.phrase)}: ${html(quoted(clues.bluffs).join(', ').replace(/, (?=[^,]*$)/, ' o '))}.</p>
          <p><a href="/que-decir-si-eres-el-impostor/">Más trucos para el impostor</a></p>
        </article>
      </section>

      <section class="section callout">
        <div>
          <span class="card-kicker">Sin papel ni tarjetas</span>
          <h2>Juega con ${html(play)} online</h2>
          <p>Crea una sala gratis, comparte el enlace y cada persona ve su papel en su móvil. El juego reparte la palabra y elige al impostor por ti.</p>
        </div>
        <a class="btn primary" href="/?category=${encodeURIComponent(category.id)}">Crear sala con ${html(play)}</a>
      </section>

      <section class="section">
        <h2>Más palabras ${html(category.phrase)}</h2>
        <div class="topic-links">${siblingLinks}<a class="topic-link" href="${categoryPath}">Las 20 palabras ${html(category.phrase)}</a></div>
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

  const clues = JSON.parse(await readFile(RELATED_PATH, 'utf8'))
  // Real people (marked "person" in words.json) stay in the game but get no clue page:
  // a dozen published associations per person can't be kept accurate.
  const cluedWords = words.filter((item) => !item.person)
  for (const { word } of cluedWords) {
    const entry = clues[word]
    if (!entry) throw new Error(`Missing related words for: ${word}`)
    if (entry.related.length < 10 || entry.related.length > 12) throw new Error(`${word} needs 10–12 related words`)
    if (entry.bluffs.length !== 3 || !entry.hint) throw new Error(`${word} needs a hint explanation and 3 bluffs`)
  }
  const stale = Object.keys(clues).filter((word) => !cluedWords.some((item) => item.word === word))
  if (stale.length) throw new Error(`Related words for words without a clue page: ${stale.join(', ')}`)

  await emit('palabras-para-el-impostor/index.html', hubPage(wordsByCategory))
  for (const category of categories) {
    await emit(
      path.join('palabras-para-el-impostor', category.slug, 'index.html'),
      categoryPage(category, wordsByCategory.get(category.id)),
    )
    const categoryWords = wordsByCategory.get(category.id)
    for (const [index, word] of categoryWords.entries()) {
      if (word.person) continue
      await emit(path.join(wordPath(category, word), 'index.html'), wordPage(category, categoryWords, index, clues[word.word]))
    }
  }

  for (const slug of Object.keys(LEVELS)) {
    await emit(path.join('palabras-para-el-impostor', slug, 'index.html'), levelPage(slug, wordsByCategory))
  }
  await emit(path.join('que-decir-si-eres-el-impostor', 'index.html'), tipsPage())
  await emit(path.join('jugar-en-discord-y-twitch', 'index.html'), streamPage())

  const staticUrls = [
    { loc: '/', modified: GUIDES_MODIFIED },
    { loc: '/juego-impostor-online/', modified: GUIDES_MODIFIED },
    { loc: '/como-jugar/', modified: GUIDES_MODIFIED },
    { loc: '/palabras-para-el-impostor/', modified: GUIDES_MODIFIED },
    { loc: '/palabras-para-el-impostor/faciles/', modified: GUIDES_MODIFIED },
    { loc: '/palabras-para-el-impostor/dificiles/', modified: GUIDES_MODIFIED },
    { loc: '/que-decir-si-eres-el-impostor/', modified: GUIDES_MODIFIED },
    { loc: '/jugar-en-discord-y-twitch/', modified: GUIDES_MODIFIED },
    ...categories.map((category) => ({
      loc: `/palabras-para-el-impostor/${category.slug}/`,
      modified: GUIDES_MODIFIED,
    })),
    ...categories.flatMap((category) => wordsByCategory.get(category.id).filter((word) => !word.person).map((word) => ({
      loc: wordPath(category, word),
      modified: LAST_MODIFIED,
    }))),
  ]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map(({ loc, modified }) => `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n    <lastmod>${modified}</lastmod>\n  </url>`).join('\n')}
</urlset>
`
  await emit('sitemap.xml', sitemap)
  console.log(`${CHECK_ONLY ? 'Verified' : 'Generated'} ${categories.length + Object.keys(LEVELS).length + cluedWords.length + 4} SEO files from ${words.length} words.`)
}

await main()
