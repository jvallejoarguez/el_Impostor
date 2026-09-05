# El Impostor: experiencia y crecimiento

La siguiente inversión debería facilitar que una visita se convierta en una partida y que el grupo repita. La identidad visual actual —papel, rojo, mostaza, turquesa, tipografía contundente y personajes— merece conservarse. Las mejoras más evidentes están en la jerarquía, las instrucciones y el uso de las pistas.

## Prueba realizada

Se jugó una partida real de producción en tres pestañas independientes. Ana creó la sala `M7ZW`; Bruno y Clara entraron mediante la invitación del dominio principal. Se comprobaron nombre, código precargado, jugadores listos, modificación de reglas, roles privados, dos rondas, decisión de continuar, selección y confirmación de votos, resultados, vuelta a la sala, recarga y reincorporación, copia del código y salida.

La categoría fue Animales; se configuraron 60 segundos por turno y dos rondas. Ana y Bruno recibieron **León**. Clara recibió el rol de impostora y la pista **Trono**.

| Jugador | Primera ronda | Segunda ronda | Votó a |
| --- | --- | --- | --- |
| Ana | Sabana | Rugido | Clara |
| Bruno | Melena | Felino | Clara |
| Clara | Rey | Corona | Ana |

Resultado mostrado: impostora descubierta, Clara 2 votos, Ana 1, Bruno 0. La reincorporación no duplicó a Clara. El código copiado coincidió con la sala. Los tres jugadores salieron al terminar.

También se inspeccionó la guía pública de cómo jugar y el contenido SEO local. `npm run seo:check -w frontend` terminó correctamente: **22 archivos SEO verificados a partir de 400 palabras**. Esto comprueba la consistencia de los archivos generados; no prueba indexación ni posiciones en Google.

### Límites de la prueba

- El dominio principal produjo un timeout inicial en el navegador. El alojamiento oficial alternativo abrió bien; las invitaciones posteriores en `juegoimpostor.app` y la guía también funcionaron. Ambos dominios respondieron HTTP 200 en la comprobación con curl. No hay evidencia suficiente para declarar una caída general.
- Se inspeccionaron pantallas de escritorio y una vista más estrecha. El control del navegador no mantuvo de forma fiable los 390 píxeles solicitados: devolvió anchuras de 1280 y 844. Queda pendiente validar en un teléfono real o emulación fiable a 360–430 px, especialmente con teclado abierto.
- El reloj local y el HTTP Date de producción tenían unas 26 horas de diferencia. Los contadores mostraron valores cercanos a 93.783 segundos mientras las fases avanzaban normalmente. Es una debilidad reproducida ante relojes desajustados; no demuestra que todos los usuarios vean ese fallo.
- No se verificaron entrega de analítica, Search Console, audio perceptivo, lectores de pantalla, 12 jugadores, empate ni todas las desconexiones posibles. Los 15 clics proceden de la información del propietario; no se han convertido en una supuesta tasa de conversión.
- Se realizó una auditoría y una propuesta visual. No se modificó ni desplegó código de la aplicación.

## Mejoras prioritarias

| Prioridad | Evidencia | Cambio propuesto | Criterio de aceptación |
| --- | --- | --- | --- |
| Primero | En escritorio, las 20 categorías empujan «Empezar partida» y «Marcar listo» fuera de la primera pantalla. El invitado ve todos los controles de categorías deshabilitados. | Separar la acción principal de las reglas. Mostrar resumen y abrir ajustes bajo demanda; al invitado, resumen de solo lectura. | A 390×844 y 1280×720 se identifica el siguiente paso sin atravesar 20 categorías. Con más jugadores, mantener la acción accesible sin tapar contenido. |
| Primero | En la segunda ronda, cada nueva palabra sustituye a la anterior junto al avatar. Durante la votación no se ve ninguna pista. | Historial agrupado por jugador y ronda, disponible al jugar y al votar. | Se pueden comparar «Sabana → Rugido», «Melena → Felino» y «Rey → Corona» antes de confirmar. Solo se usan pistas públicas. |
| Primero | Recargar la pestaña de Clara volvió al formulario vacío de nombre. El identificador persistía y reentrar recuperó a la misma jugadora. | Guardar sala y nombre de sesión, ofrecer «Volver a tu partida» y restaurar la conexión. | Recargar no exige recordar datos; una sala no disponible permite salir o crear otra. Los secretos se vuelven a recibir por ROLE. |
| Primero | Los temporizadores restan `Date.now()` local al instante del servidor. | Sincronizar una referencia de tiempo del servidor y calcular el avance con tiempo monotónico local; resincronizar al reconectar. | Un desfase de ±24 h no altera la cuenta visible. Las transiciones siguen siendo responsabilidad de las alarmas del servidor. |
| Después | La portada explica la idea con texto y tres pasos pequeños; no muestra un ejemplo de deducción. | Ejemplo breve y visible: palabra «León», tres pistas, un sospechoso. Añadir «Gratis · Sin registro · 3–12 jugadores» cerca de las acciones. | Un visitante sin grupo puede entender la mecánica antes de crear una sala. No confundir el ejemplo con una sala pública o jugadores reales. |
| Después | El tablero tiene amplias zonas vacías con tres jugadores, mientras el texto de las pistas es pequeño. | Aumentar protagonismo de pistas y del turno activo; adaptar composición a pocos jugadores. Dar un lugar estable al historial. | Nombres largos, pistas de 20 caracteres y teclado móvil no se solapan. |
| Después | En resultados hay cuatro acciones con peso parecido; compartir aparece antes que repetir. | «Otra partida» como acción principal; compartir como secundaria. Crear una tarjeta de resultado con marca, palabra y pistas después de terminar. | La revancha se reconoce primero. Una futura imagen exportable no revela información de una partida todavía activa. |
| Después | Hay «Esperando ready…», «dueño», «lobby» y distintas formas de dirigirse al grupo. Las etiquetas de algunos controles no están asociadas al input. | Unificar lenguaje: «Esperando a Clara», «anfitrión», «sala», «¿Otra ronda?». Asociar etiquetas y controles; restaurar foco visible. | Los estados explican quién debe actuar y los campos tienen nombre accesible. |

La revelación de rol ya tiene fuerza visual y merece conservarse. Le añadiría una cuenta visible para entender cuándo comienza el juego y una forma de consultar u ocultar el secreto durante la partida, especialmente si se juega en la misma habitación.

Hay además un riesgo detectado **en código, no reproducido en esta partida**: tras solicitar entrada, la app navega a `lobby`; si no llega STATE, muestra «Conectando…» sin salida. Los errores se pintan en la pantalla `join`. Revisar sala inexistente, llena y partida empezada con salas de prueba controladas, mostrando un mensaje recuperable. Referencias: `frontend/src/app.jsx`, `frontend/src/ws/useGameSocket.js` y `_handleJoin` en `worker/src/GameRoom.js`.

## SEO: mejorar la intención que ya llega

El proyecto ya tiene metadatos, canonical, sitemap, guías y 20 páginas de categorías. El siguiente paso requiere consultar qué páginas y búsquedas generan impresiones y clics en Search Console; no hay datos aquí para recomendar una palabra clave por volumen.

1. **Conectar categoría y partida.** En la página de animales, «Jugar con animales» enlaza a `/`. Proponer una entrada con categoría, por ejemplo `/?category=animales`, que abra el formulario de creación y configure la sala mediante el flujo autorizado del servidor. El parámetro es una propuesta; hoy no existe ese comportamiento.
2. **Mejorar cómo jugar.** La guía salta de recibir el rol a votar y habla de escuchar. Incluir el paso de escribir una pista, un ejemplo real y aclarar que el debate se hace en persona o por una llamada externa. Añadir el vídeo cuando exista.
3. **Reforzar contenido con utilidad específica.** Considerar una guía de pistas difíciles y otra para organizar una partida a distancia, solo si aportan ejemplos y responden a búsquedas observadas. Evitar páginas casi duplicadas por cada variación de una consulta.
4. **Conservar semántica tras React.** El HTML inicial tiene H1, pero el DOM de la portada del juego muestra el logo como elementos genéricos. Añadir un H1 accesible y alinear el contenido visible con la descripción inicial. Esto mejora coherencia y accesibilidad; no implica una penalización demostrada.

Google recomienda contenido útil para personas y una experiencia satisfactoria, no producir páginas por volumen: [documentación oficial sobre contenido útil](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). También recomienda dar a conocer el sitio en comunidades pertinentes: [Search Essentials](https://developers.google.com/search/docs/essentials).

## Promoción y medición

Probaría primero **tres vídeos cortos con el mismo juego y distinto inicio**: «¿Quién miente?», «Cuando te toca ser el impostor» y «El juego para tu próxima quedada». Son hipótesis creativas, no una promesa de alcance. El guion del primer experimento está en `guion-short-el-impostor.md`.

Para distribución adicional, preparar una demostración breve para comunidades de juegos de mesa o Discord que admitan autopromoción, y una colaboración con un creador pequeño cuya audiencia juegue en grupo. La aportación sería una partida o un reto concreto. No se ha publicado ni enviado ningún mensaje.

Antes de invertir en anuncios, medir el recorrido:

`visita → sala creada → 3 jugadores conectados → primera partida iniciada → resultado → otra partida`

El código contiene hooks de eventos como `create_room`, `invite_link_opened`, `start_game`, `phase_*` y `finish_game`. Hay que verificar que un receptor de analítica realmente los almacena. Algunos eventos se emiten por cada cliente y `start_game` representa un clic: no son automáticamente una cuenta fiable de partidas. Para medir grupos, deduplicar por un identificador de partida; distinguir solicitud y transición confirmada. Añadir inicio de revancha y origen de campaña si se necesitan para evaluar los experimentos. No incluir nombres, palabras secretas ni roles en eventos de adquisición.

Usar UTM distintas para cada pieza, y comparar **partidas iniciadas por visitas de esa campaña**, además de retención y reproducción del vídeo. Con una muestra de 15 clics no se puede estimar de forma estable el coste de adquisición ni elegir ganadores por diferencias pequeñas.

## Orden recomendado

1. Sala compacta, historial de pistas, recuperación al recargar y temporizadores resistentes a desfases.
2. Ejemplo breve en portada, CTA de categorías con contexto y comprobación de eventos.
3. Publicar un primer Short y una guía de juego mejorada; preparar las otras variantes según los resultados.
4. Evaluar visitas que llegan a jugar y grupos que repiten. Decidir entonces el siguiente contenido SEO, colaboración o presupuesto.
