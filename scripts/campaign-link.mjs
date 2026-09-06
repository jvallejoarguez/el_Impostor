import { cleanAttribution } from '../shared/engagement.js'

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=')
  if (index < 1) throw new Error('Usa source=instagram medium=organic_social campaign=septiembre content=clip01 [category=animales]')
  return [arg.slice(0, index), arg.slice(index + 1)]
}))
const attribution = cleanAttribution(args)
for (const key of ['source', 'medium', 'campaign', 'content']) {
  if (!args[key] || attribution[key] !== args[key]) throw new Error(`${key}: usa de 1 a 64 letras, números, guiones o guiones bajos.`)
}
const url = new URL('https://juegoimpostor.app/')
if (args.category) {
  const { readFile } = await import('node:fs/promises')
  const words = JSON.parse(await readFile(new URL('../worker/src/words.json', import.meta.url), 'utf8'))
  if (!words.some(word => word.category === args.category)) throw new Error('Categoría no reconocida.')
  url.searchParams.set('category', args.category)
}
for (const key of ['source', 'medium', 'campaign', 'content']) url.searchParams.set(`utm_${key}`, attribution[key])
console.log(url.href)
