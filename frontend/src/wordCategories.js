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
]

export function wordCategoryLabel(id) {
  return WORD_CATEGORIES.find(category => category.id === id)?.label ?? "Todas"
}
