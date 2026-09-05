# Entrega del 5 de septiembre de 2026

## Publicación de las mejoras anteriores

Las mejoras de flujo, reconexión, votación, tarjeta de resultados y SEO quedaron
publicadas antes de empezar esta propuesta visual:

- Commit: `9bc6088` — `Improve room flow, session recovery and category SEO`.
- Rama remota: `origin/main`.
- Web: https://juegoimpostor.app
- Despliegue de Pages: https://47879876.el-impostor-djf.pages.dev
- Versión del Worker: `8394f4dc-c916-48dc-b3f0-35ac021f3338`.
- Validación previa: 50 pruebas, build y comprobación SEO correctos. Se abrió
  una sala de producción desde la categoría Animales y se salió al terminar.

## Diseño y sala aprobados para producción

Desarrollado en `codex/club-misterio-svg-audio` y aprobado por el propietario
el 5 de septiembre de 2026 para integrar en `main` y desplegar en producción.

La dirección visual es un pequeño club de misterio: papel cálido, tinta,
verde bosque, arcilla y latón; titulares Fraunces, retratos ilustrados y una
radio con un tocadiscos SVG. Portada, entrada, sala, juego, votación y tarjeta
de resultado comparten la paleta.

Se han dibujado doce avatares SVG originales: zorro, conejo, búho, gato, oso,
mapache, rana, perro, polilla, paloma, nutria y ratón. El nombre determina el
retrato inicial de forma estable; tocarlo permite elegir cualquier personaje,
tanto antes de entrar como dentro de la sala. Las formas, accesorios y siluetas son distintos;
no hay peticiones a servicios de avatares. Se conserva la indicación de turno,
anfitrión y eliminación. Las animaciones respetan movimiento reducido.

- Aplicación: http://localhost:3000/
- Galería con descarga individual de SVG: http://localhost:3000/atelier.html

La galería es una entrada de desarrollo aparte, con `noindex`, y no se incluye
en el build de producción habitual.

## Radio de la sala

«George Street Shuffle», de Kevin MacLeod, procede de la biblioteca oficial
del autor y se distribuye con atribución CC BY 4.0. Fuente, licencia y cambios
al archivo se documentan en `frontend/public/music/CREDITS.md` y en los créditos
visibles del reproductor. La pista completa ocupa 4,3 MB tras recomprimirla.
`preload="none"` evita descargarla antes de activar la escucha.

El código de sala y el reloj de servidor existente determinan el punto de la
canción. Las personas que entran más tarde se incorporan a esa misma línea
temporal. Una comprobación cada ocho segundos corrige desviaciones superiores
a 0,8 segundos. Se usa una duración canónica para que las pequeñas diferencias
de duración entre decodificadores no alteren el cálculo.

La radio intenta reproducirse automáticamente al entrar. La escucha y el
volumen son personales, con preferencias guardadas por dispositivo; se respeta
un silencio elegido expresamente. Si el navegador bloquea el autoplay, se
reintenta con la siguiente interacción real o con el botón de sonido.
Al comenzar la partida, salir de la sala o desmontar el componente se pausa
el audio y se liberan los eventos y el intervalo. Al volver a la sala se
recupera la preferencia. No se han añadido mensajes WebSocket para esta radio.
La sincronización es aproximada: la latencia del
dispositivo de audio puede variar entre equipos.

## Revisión de la sala para móvil

Se retira el titular promocional de la sala. El grupo se presenta en una
cuadrícula de retratos, con una sola acción para invitar y plazas libres
tocables. Se mantiene el menú nativo de compartir o la copia del enlace, con
un campo seleccionable si ninguno está disponible. Se elimina el acceso
específico a WhatsApp de esta pantalla.

«Personalizar partida» está siempre visible: categorías, botones de tiempo
y rondas, plazas y pista al impostor. Las categorías abren un panel con
búsqueda y selección múltiple; cada cambio se guarda inmediatamente. El botón
de empezar o prepararse permanece accesible al pie. La radio ocupa un
tocadiscos y un botón de sonido; tocar el disco abre volumen, pista y créditos.

Los selectores usan diálogos nativos con foco contenido, cierre con Escape,
botón de cerrar y restauración del foco. Los controles principales tienen
44 px o más de área táctil. A 320 y 390 px no hay desbordamiento horizontal.

Los avatares elegidos se guardan en el servidor con `UPDATE_AVATAR` y se
comparten con toda la sala. El servidor obtiene la identidad del socket,
acepta solo IDs de 0 a 11 y solo permite cambios propios durante la espera.
`JOIN` acepta un avatar inicial opcional. Reconexión y otra partida conservan
la elección del servidor; `sessionStorage` guarda la preferencia de cada
pestaña para salas posteriores. El historial de pistas también usa esa
elección. El catálogo común está en `shared/avatars.js`.

Esta revisión necesita publicar primero el Worker y después el frontend,
siguiendo `docs/deployment.md`; el protocolo admite clientes anteriores que
no envían un avatar inicial.

## Comprobaciones de la propuesta local

- 64 pruebas automatizadas: 17 del frontend y 47 del Worker.
  Incluyen radio, reloj compartido, distintas duraciones de
  decodificación, silencio local, reentrada, bloqueo de reproducción,
  cancelación, limpieza, autoplay por defecto, preferencias y conservación
  del avatar en el historial, reconexión y otra partida. Se validan los IDs y
  se comprueba que un cliente no puede cambiar el avatar de otro.
- Build de Vite y comprobación SEO correctos: 22 archivos generados a partir
  del catálogo de 400 palabras.
- Partida completa en tres pestañas independientes: creación, entrada,
  preparación, roles, dos rondas, seis pistas, votación, resultados y otra
  partida. El temporizador cerró la votación después de dos confirmaciones
  manuales y el tercer voto seleccionado. Resultado y recuento correctos.
- Tres reproducciones simultáneas se observaron separadas por unos 22 ms en
  los indicadores de tiempo del navegador. Silenciar una dejó las otras dos
  reproduciendo. Se comprobó la reincorporación y la retirada de los tres
  elementos de audio al empezar la partida.
- Inspección visual de portada y galería en escritorio, y portada, sala,
  partida y votación a 390 px de ancho, sin desbordamiento horizontal.
- Descarga del SVG de zorro y validación del XML, `viewBox` y referencias
  internas. Exportación de la tarjeta PNG de resultados comprobada y
  contraste de los textos exteriores corregido para la nueva paleta.
- Sin errores ni avisos en la consola de la pestaña local al terminar.
- Segunda partida completa, sala CVCG, para la revisión móvil: avatar de Ana
  elegido antes de crear la sala; avatar de Bruno cambiado y observado en
  los tres clientes, conservado tras recargar. Autoplay observado en los tres,
  silencio individual y audio retirado al iniciar. Categoría Animales, 60 s,
  una ronda, tres votos confirmados manualmente, resultados y otra partida.
  También se comprobó la búsqueda sin tildes y el cierre con Escape.

Las pruebas de audio verifican reproducción, controles y sincronización en
el navegador; no equivalen a una escucha en distintos altavoces o móviles
físicos.
