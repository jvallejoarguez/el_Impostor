# Mejoras de experiencia y SEO — 3 de septiembre de 2026

Implementación de la propuesta de la auditoría inicial. Los cambios están en el código local; no se han desplegado. El vídeo y su guion quedan a cargo del propietario.

## Experiencia

- Portada con ejemplo interactivo de deducción, H1 accesible, ventajas visibles y dos entradas claras: crear sala o entrar con código.
- Formularios con etiquetas, envío con Enter, nombre recuperado y estado de creación que evita solicitudes duplicadas. El código se puede pegar de una vez.
- Sala compacta: lista del grupo, estado que identifica quién falta, invitación con respuesta visible y configuración plegable. Los invitados ven un resumen de reglas. En móvil la acción de empezar o marcar listo precede a la lista, para mantenerse accesible incluso con grupos largos.
- Historial público por jugador y ronda durante la partida y antes de votar. Votación en filas con todas las pistas y confirmación explícita. Las pistas omitidas aparecen como «Sin pista».
- Secreto que se puede ocultar mientras se juega, cuenta durante la revelación y disposición en tarjetas para grupos de más de seis personas.
- Resultado con «Otra partida» como acción principal; vuelve a reunir al grupo en la sala conservando las reglas. Compartir pasa a un desplegable. «Guardar tarjeta» genera un PNG de 1080 × 1350 con el resultado, la palabra y la marca, solo al terminar; no incluye el código de invitación.
- Salida accesible al pie de las fases de juego, foco visible, etiquetas de controles y respeto a la preferencia de reducir movimiento.

## Sesión y reglas

La pestaña conserva solo código y nombre en `sessionStorage`, junto al identificador de jugador existente. La recarga intenta recuperar el mismo sitio; los secretos se solicitan de nuevo por `ROLE`. Una invitación a otra sala o una entrada con categoría prevalece sobre la sesión anterior. «Salir» borra la recuperación guardada.

Los errores de entrada se muestran con acciones para reintentar, cambiar datos o volver al inicio. Las conexiones fallidas tienen un plazo inicial de 12 segundos y reconexión con esperas progresivas. Las respuestas de sockets sustituidos no alteran el estado actual.

`STATE` añade `serverNow` al sobre del mensaje. `PING` puede enviar `payload.clientSentAt`; `PONG` devuelve ese valor y `serverNow`. Los contadores se calculan desde el reloj del servidor con tiempo monotónico local y se limitan a la duración de la fase. Las alarmas del servidor siguen decidiendo cuándo avanzar.

El servidor rechaza cambiar votos confirmados, confirmar sin selección, empezar fuera de la sala o reiniciar fuera de resultados. Las acciones rechazadas no reinician los temporizadores. Completa el cierre del WebSocket y evita que el cierre tardío de una conexión sustituida desconecte al jugador que acaba de volver.

Se han definido dos empates: si todos han elegido y empatan «Otra ronda» y «Votar ya», se pasa a votar. Si varios sospechosos empatan en el primer puesto, el impostor escapa. Antes, la primera situación podía quedarse esperando y la segunda dependía del orden de los votos.

## SEO y medición

Las 20 páginas de categorías enlazan a `/?category=<id>`. Esa entrada abre el formulario de creación y `POST /rooms?category=<id>` configura la categoría en el servidor al crear la sala. Los valores desconocidos usan todas las categorías. Los enlaces genéricos para crear sala usan `/?create=1`.

La guía de cómo jugar incluye los cinco pasos reales, un ejemplo con León, reglas de tiempo y empates, y la explicación de que el debate a distancia necesita una llamada externa. La página de juego online tiene un recorrido más concreto. Las dos usan la imagen social PNG existente. Se actualizaron sitemap y fechas de modificación; las URLs canonical se conservan sin parámetros. No se crearon páginas duplicadas ni se modificó el catálogo de 400 palabras.

La analítica conserva `utm_source`, `utm_medium` y `utm_campaign`, y añade eventos del ejemplo y de la tarjeta descargada. Las fases y el inicio/final de partida se deduplican por pestaña y `gameId`, incluso tras recargar. **Son eventos por participante**: una partida compartida se cuenta agrupando por `gameId`, no sumando sus eventos. Se mantienen los adaptadores existentes; no se ha verificado un recolector ni consultado Search Console. No hay evidencia todavía de mejora de posiciones o conversión.

## Comprobaciones

- `npm test`: 50 pruebas correctas, incluyendo sesión, desfase del reloj, privacidad, reconexión, empates y acciones rechazadas.
- `npm run build -w frontend`: compilación correcta.
- `npm run seo:check -w frontend`: 22 archivos generados consistentes con las 400 palabras.
- `npm run test:smoke` (Node 22+, con `npm run dev` abierto): completó una partida contra el Worker local real por HTTP y WebSocket. Tres clientes, Animales, papeles privados, rechazo de un invitado tardío, reconexión del mismo jugador, dos rondas, seis pistas, votación, resultado y retorno a la sala.
- `git diff --check`: sin errores de espacios.

La prueba de red no sustituye la navegación con tres pestañas. El Mac estaba bloqueado y el control del navegador no pudo desbloquearlo. Quedan pendientes la partida desde la interfaz, revisión visual en escritorio y 390 px, teclado móvil, descarga/apertura del PNG y comprobación visual de grupos grandes. No se afirma que esas verificaciones hayan pasado.

## Publicación

Antes de publicar, completar la revisión visual pendiente. Después desplegar primero el Worker y después Pages con los comandos de `docs/deployment.md`. El nuevo cliente usa el reloj y la categoría inicial del Worker actualizado; desplegar solo la interfaz no completa esas mejoras. No hay cambios de migraciones ni de dominios.
