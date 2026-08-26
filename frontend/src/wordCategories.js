export const WORD_CATEGORIES = [
  { id: "all", label: "Todas" },
  { id: "animales", label: "Animales" },
  { id: "comida", label: "Comida" },
  { id: "lugares", label: "Lugares" },
  { id: "objetos", label: "Objetos" },
  { id: "naturaleza", label: "Naturaleza" },
  { id: "cultura", label: "Cultura" },
  { id: "profesiones", label: "Oficios" },
  { id: "deportes", label: "Deportes" },
  { id: "ficcion", label: "Ficción" },
  { id: "ciencia", label: "Ciencia" },
  { id: "streamers", label: "Streamers" },
  { id: "youtubers", label: "YouTubers" },
  { id: "tiktokers", label: "TikTokers" },
  { id: "videojuegos", label: "Videojuegos" },
  { id: "libros", label: "Libros" },
  { id: "cine_series", label: "Cine y series" },
  { id: "musica", label: "Música" },
  { id: "futbol", label: "Fútbol" },
  { id: "creadores_latam", label: "Creadores LATAM" },
  { id: "emociones", label: "Emociones" },
]

export function wordCategoryLabel(id) {
  return WORD_CATEGORIES.find(category => category.id === id)?.label ?? "Todas"
}

export function normalizeWordCategories(value) {
  const raw = Array.isArray(value) ? value : [value]
  const ids = new Set(WORD_CATEGORIES.map(category => category.id))
  const filtered = raw.filter(id => typeof id === "string" && ids.has(id))
  if (filtered.length === 0 || filtered.includes("all")) return ["all"]
  return [...new Set(filtered)]
}

export function wordCategoriesLabel(value) {
  const categories = normalizeWordCategories(value)
  if (categories.includes("all")) return "Todas"
  if (categories.length === 1) return wordCategoryLabel(categories[0])
  return `${categories.length} categorías`
}
