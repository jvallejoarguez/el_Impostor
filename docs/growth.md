# Medición, invitaciones y feedback

## Qué incorpora

- Invitación por WhatsApp con texto según el número de personas que faltan; QR generado localmente, sin servicio externo. Los enlaces llevan el código y la fuente, de modo que entrar no exige transcribirlo.
- Resultados compartidos enlazan a crear una nueva sala. Una sala terminada no acepta nuevos jugadores: enviar su código frustraba a los nuevos visitantes. «Jugar con otro grupo» conserva el nombre y abre la creación de una sala nueva.
- Pregunta de valoración opcional bajo las acciones del resultado, como máximo una vez cada 24 horas por navegador. Las preferencias y la disponibilidad del almacenamiento pueden reducir el número de preguntas. «Otra partida» sigue siendo la acción principal.
- Acceso a problemas, ideas y palabras desde todas las pantallas. Al salir explícitamente de la primera sala tras al menos 20 segundos sin jugar, se ofrece una pregunta opcional en el inicio; no bloquea la salida. También se limita a una al día.
- Confirmación solo después de guardar la opinión; errores recuperables y reintentos con el mismo identificador para evitar duplicados.

## Activación en producción

**Activo desde el 6 de septiembre de 2026** en https://juegoimpostor.app. Worker y frontend desplegados; `INSIGHTS_READ_TOKEN` configurado. La copia local de la clave está en `.local/insights-token`, fuera de Git y con permisos de lectura/escritura solo para el propietario. `npm run --silent insights -- 7` ya funciona desde este equipo.

Verificación de producción: invitación por enlace con QR y WhatsApp, partida completa con tres navegadores, opinión guardada y recuperada mediante el informe privado, acceso sin clave rechazado (401), atribución correcta y ausencia de duplicados al recargar resultados. El informe incluye una partida y una opinión de prueba técnica identificadas con la campaña `activation_1788714916844` (`source=verification`, `medium=qa`); no interpretarlas como feedback o captación de jugadores reales.

El push de Git no despliega este proyecto. Desplegar el Worker antes de Pages con `npm run deploy:worker` y `npm run deploy:frontend`, como indica `docs/deployment.md`. La migración `v2` añade `ENGAGEMENT`; no cambia la clase ni los datos de las salas. La ingesta funciona en cuanto se despliega el Worker, sin un proveedor externo ni una clave pública.

El informe requiere una clave privada de al menos 32 caracteres. Para configurarla una sola vez, desde la raíz y con Wrangler autenticado:

```bash
mkdir -p .local
# No ejecutar de nuevo sobre una clave que ya esté configurada.
(umask 077; openssl rand -hex 32 > .local/insights-token)
npx wrangler secret put INSIGHTS_READ_TOKEN --config worker/wrangler.toml --env production < .local/insights-token
```

`.local/`, `.env*` y `worker/.dev.vars*` están ignorados en Git. La clave nunca debe ponerse en una variable `VITE_`, en una URL o en el frontend. Si ya existe `INSIGHTS_READ_TOKEN`, usar esa clave; cambiarla requiere actualizar ambos sitios. El secreto ya está configurado en producción: los pasos de creación anteriores son una referencia para una instalación nueva, no deben repetirse sobre la instalación actual.

Leer el informe:

```bash
npm run --silent insights -- 7
npm run --silent insights -- 14 > .local/informe-14-dias.md
npm run --silent insights -- 7 --json > .local/informe-7-dias.json
```

También acepta `INSIGHTS_READ_TOKEN` desde el entorno y `INSIGHTS_URL` para consultar el Worker local. Nunca compartir el JSON completo públicamente: contiene comentarios de jugadores. El informe es texto/JSON local autenticado; no hay un panel público que exponga opiniones.

## Qué cuenta cada medida

| Evento | Fuente | Definición |
|---|---|---|
| `visit` | Navegador, app y guías SEO | Una visita por sesión de pestaña y atribución. Una campaña nueva abre una nueva atribución. No es una persona única. |
| `room_created` | Servidor | Sala creada y reclamada. Incluye categoría/entrada en la atribución disponible. |
| `player_joined` | Servidor | Entrada aceptada de un jugador nuevo en la sala. Reconectar no suma otra. |
| `group_ready` | Servidor | Primera vez que una sala reúne 3 jugadores conectados; todavía pueden faltar confirmaciones de «listo». |
| `room_activated` | Servidor | Primera vez que una sala llega a la fase de dar pistas. |
| `game_started` | Servidor | Primera fase `playing` de cada partida, después de la revelación. |
| `game_finished` | Servidor | Primera transición de cada partida a resultados. |
| `game_repeated` | Servidor | Partida iniciada en una sala que ya terminó al menos otra. Pulsar «Otra partida» no basta. |
| `share_invite` | Navegador | Acción de compartir/copiar o abrir WhatsApp. No prueba recepción ni entrada. |
| `join_attempt`, `join_failed` | Navegador | Intentos y errores de entrada. Los errores pueden repetirse al reintentar. |
| `lobby_left` | Navegador | Salida mediante el botón de la sala; no incluye cierres de pestaña o pérdida de red. |

La procedencia de una sala y sus partidas es la del creador, capturada al crearla. La de una entrada confirmada es la del invitado. No se copian las UTM del anfitrión a los enlaces de invitación: estos usan `medium=invite` y `source=whatsapp`, `qr`, `copy` o `share`. Se conserva si alguien llegó invitado durante esa atribución para contar salas creadas después por invitados. No identifica a esa persona entre dispositivos ni días.

`source`, `medium`, `campaign`, `content` y página de entrada están disponibles en el informe. Los clics de Search Console siguen consultándose allí; este recolector empieza a medir al desplegarlo y no reconstruye el histórico. El script de las guías y el frontend apuntan al mismo Worker de producción; si cambia el dominio del Worker, actualizar también `frontend/public/visit.js`.

Son totales de actividad por día UTC, no una cohorte cerrada: una sala puede crearse un día y jugar otro. No dividir automáticamente todos los totales para presentar tasas exactas de conversión o retención. Las repeticiones dentro de una sala no miden retorno a siete días. La analítica es de mejor esfuerzo: bloqueadores, fallos de red, límites y preferencias de privacidad pueden reducir los registros. Los errores de medición no interrumpen el juego.

## Almacenamiento y límites

`Engagement` es un Durable Object separado por día UTC. Guarda contadores agregados, claves de deduplicación y opiniones. Su alarma elimina todo al cumplir un máximo de 30 días. Los objetos de días consultados sin datos no escriben nada. Las alarmas de juego no se modifican.

La ingesta pública valida origen, tamaño (8 KiB), tipos, eventos y campos permitidos. Nunca admite eventos del servidor enviados desde el navegador. Hay límites por IP en memoria de una hora (600 eventos / 30 opiniones), un máximo diario de 20.000 eventos de navegador, otro de 20.000 eventos de servidor y 500 opiniones. Los límites en memoria se reinician si el objeto se reinicia; son una protección básica, no un sistema completo contra bots. A gran escala habría que revisar cuotas, partición y protección contra abuso.

No se almacenan IP, nombres de jugadores, códigos de sala, roles ni pistas en la medición. Las opiniones incluyen únicamente el texto voluntario y contexto validado: fase, categoría, tamaño, versión e identificador de partida si existe. Un jugador podría escribir datos personales por iniciativa propia; la interfaz pide evitarlos y los comentarios están protegidos por el informe privado. Los cuerpos de las opiniones y los tokens no se imprimen en logs.

La atribución usa `sessionStorage`; las preferencias y el límite de preguntas usan `localStorage`. «Datos y privacidad» explica el tratamiento y permite desactivar eventos del navegador. Se respetan DNT y GPC. Los contadores agregados del servidor siguen operativos. No se instalan cookies publicitarias, grabaciones de sesión ni adaptadores a terceros. El anterior adaptador genérico de `analytics.js` se sustituye por el recolector propio.

## Rutina semanal

1. Comparar partidas terminadas, salas activadas y repeticiones con una ventana equivalente. La primera semana sirve de línea base; no hay objetivos inventados.
2. Revisar fuentes y piezas del informe, junto con métricas de las plataformas. Elegir el siguiente experimento con `docs/promotion-kit.md`.
3. Agrupar valoraciones y temas. Leer comentarios de quienes terminaron y de quienes salieron sin jugar: son grupos distintos y ninguna muestra representa a todos los usuarios.
4. Seleccionar un problema repetido, solucionarlo y comprobar si desciende tras la siguiente versión. Ofrecer pruebas con personas del entorno por invitación directa; no se solicita correo a jugadores en esta primera versión.

## Validación

`npm test` cubre privacidad, validación, reintentos, límites, atribución desde SEO y preferencias. `npm run test:browser` arranca servicios locales aislados y realiza una partida completa con tres navegadores, recarga, valoración y segunda partida; comprueba los contadores del informe real y genera capturas en `test-results/`. Usa Google Chrome instalado, o definir `PLAYWRIGHT_CHANNEL=chromium` después de `npx playwright install chromium`. No reutiliza servidores existentes para evitar consultar datos ajenos al entorno de pruebas.

Las pruebas de navegador usan una clave local de prueba fija, sin acceso a producción. `npm run test:smoke`, con `npm run dev` arrancado, sigue comprobando el protocolo de juego mediante tres conexiones WebSocket.
