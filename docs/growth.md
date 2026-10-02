# Medición, invitaciones y feedback

## Panel privado de estadísticas

Ruta: `https://juegoimpostor.app/admin-panel/`. Incluye resumen y actividad diaria, páginas visitadas y páginas de entrada (medidas distintas), partidas, interrupciones, errores desglosados y opiniones con búsqueda y filtro por tipo. Períodos de 7, 14 y 30 días, en UTC; el día actual es parcial. «Excluir pruebas identificadas» omite `source=verification`, `medium=qa` y campañas `activation_*` / `consent_check_*`. No identifica pruebas sin etiqueta ni filtra opiniones, que no tienen atribución.

El acceso requiere la clave exclusiva `ADMIN_PASSWORD` (mínimo 32 caracteres aleatorios), independiente de `INSIGHTS_READ_TOKEN`. La copia local está en `.local/admin-password`, ignorada por Git y con permisos 0600. No poner ninguna de estas claves en variables `VITE_`, URLs, código del navegador o capturas. El login se comprueba en el Worker; Pages Functions solo hace de proxy del mismo origen. `AdminAuth` guarda resúmenes de sesiones aleatorias de 8 horas; cerrar sesión las revoca y cambiar la clave invalida todas. Cookie `Secure`, `HttpOnly`, `SameSite=Strict`; cinco intentos fallidos por origen de red y ventana de 15 minutos. Las sesiones y los límites tienen alarmas independientes de las del juego y Engagement. No se crea una cuenta de jugador.

La ruta puede mostrar el formulario público de entrada, pero tanto `/admin-panel/api/report` como su URL directa en el Worker requieren sesión válida. El informe de consola sigue requiriendo su clave anterior. Las respuestas privadas llevan `no-store`; el panel tiene `noindex` y no recoge visitas ni errores de navegación.

Medidas añadidas con el panel (sin reconstrucción histórica):

| Evento | Fuente | Definición |
|---|---|---|
| `page_view` | Navegador, con consentimiento | Una carga de página mientras se acepta la medición, incluidas recargas. `path` es la página vista y `landing` conserva la entrada original. Sin parámetros ni rutas del panel. |
| `client_error` | Navegador, con consentimiento | Tipos generales de error JavaScript, promesa rechazada o desconexión inesperada. No se envían mensajes, trazas ni contenido. Los errores globales se limitan a cinco por carga. |
| `join_rejected` | Servidor | Entrada rechazada: datos inválidos, sala inexistente, partida en curso o sala llena. Sin atribución. |
| `server_error` | Servidor | Fallo al crear sala o abrir conexión. Sin atribución. No es un registro exhaustivo de todas las excepciones. |
| `game_interrupted` | Servidor | Primera vez que una partida ya iniciada queda sin ningún jugador conectado antes de resultados. Puede recuperarse y terminar después. No modifica fases ni temporizadores. |

**No interpretar iniciadas menos terminadas como partidas fallidas.** Los totales no son una cohorte y una partida puede cruzar días. No sumar errores de navegador y rechazos del servidor como fallos únicos: pueden describir el mismo intento. Las partidas que alcanzan resultados por alarma también cuentan como terminadas; esto no demuestra presencia o interacción humana al finalizar.

El panel usa la fecha UTC enviada por el servidor y avisa si difiere del dispositivo en más de diez minutos. Si una lectura diaria falla, devuelve un error completo en vez de mostrar datos parciales como totales.

Desde `connection-2026-10-03`, los errores de JavaScript incluyen únicamente el nombre de excepción de una lista cerrada, la versión, una categoría fija de script (aplicación, medición, consentimiento, externo o desconocido) y posición numérica para scripts propios. No se guardan mensajes, trazas ni URLs. Estos detalles pasan por `shared/engagement.js`, tienen el mismo consentimiento, máximo de cinco errores por carga y retención de 30 días. El panel conserva los registros anteriores como «Sin detalle histórico» y separa errores de JavaScript, desconexiones, entradas fallidas y rechazos normales; no reconstruye causas que no se recogieron.

Los nuevos rechazos de JOIN incluyen `payload.reason` (`invalid_join`, `room_not_found`, `game_in_progress` o `room_full`) además del mensaje. El navegador conserva ese motivo en `join_failed`. Una pestaña sustituida por otra del mismo jugador deja de reconectar automáticamente; la recuperación queda a una acción explícita del jugador. El watchdog espera al volver de segundo plano, y la reconexión espera a recuperar red o visibilidad.

## Qué incorpora

- Invitación por WhatsApp con texto según el número de personas que faltan; QR generado localmente, sin servicio externo. Los enlaces llevan el código y la fuente, de modo que entrar no exige transcribirlo.
- Resultados compartidos enlazan a crear una nueva sala. Una sala terminada no acepta nuevos jugadores: enviar su código frustraba a los nuevos visitantes. «Jugar con otro grupo» conserva el nombre y abre la creación de una sala nueva.
- Pregunta de valoración opcional bajo las acciones del resultado, como máximo una vez cada 24 horas por navegador si acepta la medición; sin aceptación, el límite funciona en memoria durante la carga de la página. Las preferencias y la disponibilidad del almacenamiento pueden reducir el número de preguntas. «Otra partida» sigue siendo la acción principal.
- Acceso a problemas, ideas y palabras desde todas las pantallas. Al salir explícitamente de la primera sala tras al menos 20 segundos sin jugar, se ofrece una pregunta opcional en el inicio; no bloquea la salida. También se limita a una al día con consentimiento y a una por carga de página sin él.
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

## Despliegue del consentimiento previo

Publicado el 6 de septiembre de 2026, código `15524a4`. Worker `fb534232-fdff-4337-9b5e-6fe94361fab7`; Pages `https://19f8a36a.el-impostor-djf.pages.dev` y dominio principal verificados.

Validación: 82 pruebas unitarias, cinco escenarios de navegador (incluida partida completa con tres jugadores, rechazo en invitados, feedback y repetición), compilación y comprobación de las 22 páginas SEO. Las pruebas estáticas locales usan `/index.html` explícito porque Vite dev sirve la app como fallback en rutas de directorio; en producción también se verificaron las rutas públicas con barra final.

Comprobación real en `juegoimpostor.app`: cero eventos y almacenamiento opcional antes de aceptar; una visita aceptada confirmada por el servidor; retirada que borra las claves y bloquea eventos tras navegar/recargar; política publicada con el responsable indicado; ninguna conexión a Google Fonts; evento antiguo sin consentimiento rechazado con 403. Esa única visita técnica figura como `source=verification`, `medium=qa`, campaña `consent_check_1788716583627`. No se creó ninguna partida ni opinión adicional en esa comprobación. Los artefactos locales están en `.local/verify-consent.mjs` y `.local/consent-production-mobile.png`, fuera de Git.

## Qué cuenta cada medida

| Evento | Fuente | Definición |
|---|---|---|
| `visit` | Navegador, app y guías SEO | Solo con consentimiento: una visita por sesión de pestaña y atribución. Una campaña nueva abre una nueva atribución. No es una persona única. |
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

La procedencia de una sala y sus partidas es la del creador, capturada al crearla solo si ha aceptado. Sin aceptación válida se usa `source=unattributed`; no confundirlo con tráfico directo. La retirada del creador elimina la atribución para los eventos futuros de esa sala, también al reconectar. No reconstruimos la atribución de salas creadas sin consentimiento si se acepta después. La de una entrada confirmada es la del invitado. No se copian las UTM del anfitrión a los enlaces de invitación: estos usan `medium=invite` y `source=whatsapp`, `qr`, `copy` o `share`. Se conserva si alguien llegó invitado durante esa atribución para contar salas creadas después por invitados. No identifica a esa persona entre dispositivos ni días.

`source`, `medium`, `campaign`, `content` y página de entrada están disponibles en el informe. Los clics de Search Console siguen consultándose allí; este recolector empieza a medir al desplegarlo y no reconstruye el histórico. El script de las guías y el frontend apuntan al mismo Worker de producción; si cambia el dominio del Worker, actualizar también `frontend/public/visit.js`.

Son totales de actividad por día UTC, no una cohorte cerrada: una sala puede crearse un día y jugar otro. No dividir automáticamente todos los totales para presentar tasas exactas de conversión o retención. Las repeticiones dentro de una sala no miden retorno a siete días. La analítica es de mejor esfuerzo: bloqueadores, fallos de red, límites y preferencias de privacidad pueden reducir los registros. Los errores de medición no interrumpen el juego.

## Almacenamiento y límites

`Engagement` es un Durable Object separado por día UTC. Guarda contadores agregados, claves de deduplicación y opiniones. Su alarma elimina todo al cumplir un máximo de 30 días. Los objetos de días consultados sin datos no escriben nada. Las alarmas de juego no se modifican.

La ingesta pública valida origen, tamaño (8 KiB), tipos, eventos y campos permitidos. Nunca admite eventos del servidor enviados desde el navegador. Hay límites por IP en memoria de una hora (600 eventos / 30 opiniones), un máximo diario de 20.000 eventos de navegador, otro de 20.000 eventos de servidor y 500 opiniones. Los límites en memoria se reinician si el objeto se reinicia; son una protección básica, no un sistema completo contra bots. A gran escala habría que revisar cuotas, partición y protección contra abuso.

No se almacenan IP, nombres de jugadores, códigos de sala, roles ni pistas en la medición. Las opiniones incluyen únicamente el texto voluntario y contexto validado: fase, categoría, tamaño, versión e identificador de partida si existe. Un jugador podría escribir datos personales por iniciativa propia; la interfaz pide evitarlos y los comentarios están protegidos por el informe privado. Los cuerpos de las opiniones y los tokens no se imprimen en logs.

La atribución y deduplicación opcionales usan `sessionStorage` **solo después de aceptar**. `frontend/public/consent.js` y `consent.css` se cargan antes de `visit.js` en la app y las guías; no depende de React. Sin decisión, ante una decisión inválida/caducada, o si el script no carga, las llamadas de medición fallan cerradas. El rechazo y la aceptación tienen igual relevancia. «Configurar medición» permite retirar el consentimiento. DNT y GPC bloquean la medición incluso con una aceptación guardada.

`el-impostor-consent` guarda versión, decisión y fecha en `localStorage`, con 180 días de validez. El consentimiento v1 no hereda el anterior opt-out: al cargar se eliminan las antiguas claves opcionales sin leer su contenido. Retirar limpia atribución, deduplicación y límites de preguntas, aborta la visita en curso y sincroniza otras pestañas. Las respuestas tardías no restauran datos retirados. El WS lee la preferencia actual en cada conexión y comunica `MEASUREMENT_PREFERENCE: {enabled:false}` a una sala abierta.

El Worker exige un recibo válido de aceptación en los eventos públicos de navegador y rechaza con 403 los clientes antiguos que no lo envían. Guarda versión y fecha junto a las claves de deduplicación, con la misma retención máxima de 30 días. Es una evidencia de la decisión comunicada por el cliente, no una prueba criptográfica de identidad. La creación y JOIN ignoran campañas sin ese recibo. La comprobación de caducidad también se aplica a eventos futuros del servidor. El feedback explícito es independiente del consentimiento analítico.

Los contadores agregados del servidor siguen operativos sin atribución cuando no hay consentimiento. **No dividir partidas totales entre visitas consentidas para calcular conversión:** las poblaciones difieren. Desde esta versión, menos visitas registradas puede reflejar rechazos, no una caída del tráfico. Search Console sigue siendo la referencia para los clics de Google.

La política pública está en `/privacidad/`, con Javier Vallejo y el contacto autorizado. Las fuentes se alojan localmente con sus licencias; no se carga Google Fonts. No se instalan cookies publicitarias, grabaciones de sesión ni adaptadores a terceros.

La caducidad de 30 días es la de `Engagement`, no la de `GameRoom`: aún no existe una política automática de borrado de salas inactivas. Se ha documentado esta limitación de forma expresa en la política pública; no afirmar que todos los datos del juego se eliminan a los 30 días. Como trabajo separado, definir e implementar la caducidad de salas con pruebas de reconexión y alarmas antes de prometerla.

Referencias revisadas para las medidas de consentimiento: [guía de cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf), [guía sobre medición de audiencia](https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf) y [art. 22 LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758#a22). Se aplica consentimiento previo; no se presume que el recolector cumpla una exención de medición de audiencia.

## Rutina semanal

1. Comparar partidas terminadas, salas activadas y repeticiones con una ventana equivalente. La primera semana sirve de línea base; no hay objetivos inventados.
2. Revisar fuentes y piezas del informe, junto con métricas de las plataformas. Elegir el siguiente experimento con `docs/promotion-kit.md`.
3. Agrupar valoraciones y temas. Leer comentarios de quienes terminaron y de quienes salieron sin jugar: son grupos distintos y ninguna muestra representa a todos los usuarios.
4. Seleccionar un problema repetido, solucionarlo y comprobar si desciende tras la siguiente versión. Ofrecer pruebas con personas del entorno por invitación directa; no se solicita correo a jugadores en esta primera versión.

## Validación

`npm test` cubre privacidad, validación, reintentos, límites, atribución desde SEO y preferencias. `npm run test:browser` arranca servicios locales aislados y realiza una partida completa con tres navegadores, recarga, valoración y segunda partida; comprueba los contadores del informe real y genera capturas en `test-results/`. Usa Google Chrome instalado, o definir `PLAYWRIGHT_CHANNEL=chromium` después de `npx playwright install chromium`. No reutiliza servidores existentes para evitar consultar datos ajenos al entorno de pruebas.

Las pruebas de navegador usan una clave local de prueba fija, sin acceso a producción. `npm run test:smoke`, con `npm run dev` arrancado, sigue comprobando el protocolo de juego mediante tres conexiones WebSocket.
