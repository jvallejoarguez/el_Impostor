# El Impostor

Juego de palabras y deducción social en español para jugar con amigos desde el navegador. Todos reciben la misma palabra secreta menos uno, el impostor, que tiene que disimular mientras el grupo da pistas y vota.

**Jugar:** https://juegoimpostor.app

- Salas privadas de 3 a 16 personas; cada una ve su rol en su móvil. Se entra por enlace o QR, sin cuenta ni instalación.
- Modo un solo móvil para pasarlo de mano en mano.
- 400 palabras en 20 categorías, revisadas para España y Latinoamérica, y palabras propias.
- Modo streamer para Twitch y Discord.
- Sin anuncios.

## Cómo está hecho

- `frontend/`: React 18 + Vite, publicado en Cloudflare Pages.
- `worker/`: Cloudflare Worker. Cada sala es un Durable Object con WebSockets hibernables; el servidor decide todas las transiciones y los tiempos de turno y votación son alarms del Durable Object.
- `shared/`: avatares, consentimiento y medición propia con consentimiento previo.

El protocolo y las reglas de arquitectura están en [`CLAUDE.md`](CLAUDE.md); el despliegue, en [`docs/deployment.md`](docs/deployment.md).

## Desarrollo local

Requiere Node 20+.

```bash
npm install
npm run dev   # worker en :8787 y frontend en :3000
```

Abre http://localhost:3000 en tres pestañas para simular tres jugadores.

```bash
npm test
npm run test:browser
```

## Licencia

El código está bajo la licencia [MIT](LICENSE). La música de `frontend/public/music/` usa la Pixabay Content License y las fuentes de `frontend/public/fonts/` la SIL Open Font License (ver sus créditos y licencias en cada carpeta); no están cubiertas por la licencia MIT.
