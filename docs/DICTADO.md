# Dictado de micrófono a borrador

Implementación local del 27 de octubre de 2026, con personas y solicitudes ficticias. No añade conversación hablada bidireccional, streaming ni escrituras automáticas.

## Flujo de producto

1. Tocar el micrófono. El navegador solicita permiso únicamente por esa acción.
2. Hablar: se muestran estado de grabación, tiempo y nivel de entrada. El audio permanece en memoria local durante la captura.
3. Detener, o alcanzar el límite de 60 segundos: se libera el micrófono y se envía un WAV al endpoint de transcripción, que llama a Meta.
4. Revisar/corregir el texto añadido al borrador. La transcripción no envía el chat.
5. Enviar manualmente. Cualquier propuesta de agenda conserva su confirmación humana por tarjeta.

El botón ya no abre el selector de archivos. El endpoint WAV sigue disponible y validado, pero esta interfaz se concentra en dictar con micrófono.

## Arquitectura y límites

- `ChatComposer`: edición, envío y presentación del dictado. `DictationControls`: controles y recuperación. `useDictation`: ciclo de vida, cancelación, reintento y entrega del texto. `CopilotWorkspace` coordina el chat y la agenda sin implementar captura de audio.
- `MicrophoneCapture`: posee stream, pistas, contexto, procesador, temporizador y muestras. `public/audio/pcm-capture.js` es un AudioWorklet propio; transmite bloques PCM al controlador y siempre emite silencio hacia la salida, sin reproducir el micrófono.
- Se intenta capturar a 16 kHz; si el navegador entrega otra frecuencia, `OfflineAudioContext` realiza el remuestreo. `encodePcmWav` convierte las muestras a mono PCM de 16 bits. Se conservan los límites del servidor: entre 1 y 60 segundos, hasta 2 MB. El hilo de audio también corta muestras a los 60 segundos.
- Se necesitan contexto seguro (localhost/HTTPS), permiso de audio y soporte de AudioWorklet. La demo continúa restringida a loopback:3420. No se cambia el proyecto Supabase exclusivo ni se usa almacenamiento remoto.
- No se graba al montar ni al cargar una página. Al descartar, perder el dispositivo, ocultar la página durante captura, navegar o desmontar, se liberan las pistas y el contexto. Un permiso concedido después de cancelar también se cierra.
- Un fallo de transcripción conserva el audio solo en memoria para reintentar o descartar. No se crean archivos ni entradas de localStorage. El envío a Meta ya ocurrido no se revierte al cancelar: se aborta la espera y se impide añadir texto tardío. La UI lo comunica.
- Si el texto no cabe en el borrador de 2.000 caracteres, se conserva para copiar o usar explícitamente como nuevo borrador. No se trunca ni sobrescribe silenciosamente el contenido anterior.
- Solicitar permiso, grabar, finalizar, transcribir, reintentar y revisar son estados distintos. En ese recorrido se bloquean el envío del chat y las decisiones de agenda para evitar acciones cruzadas.

## Verificación de este corte

- Tests del formato PCM/WAV, saturación, silencio, duración mínima/máxima y muestras inválidas.
- Tests del AudioWorklet: bloques finales, límite independiente del controlador y salida sin audio del micrófono.
- Tests del controlador con APIs de dispositivo simuladas: permiso denegado/tardío, interrupción, cancelación, límite, timeout de finalización, liberación de recursos y ruta de remuestreo de 48 a 16 kHz. La simulación de remuestreo prueba coordinación y formato, no su fidelidad acústica.
- Tests React del hook y compositor: solo micrófono, borrador conservado, bloqueo durante captura, respuesta tardía ignorada, reintento, texto que no cabe, limpieza al navegar/desmontar y límite sin doble transcripción.
- Navegador integrado: botón real de micrófono y cancelación mientras se espera permiso, recuperación del campo, sin selector de archivos ni errores de consola. Comprobación adaptable y captura en `work/dictation-review`, fuera de Git.
- Meta real: WAV de voz sintética ficticia de 4,335 segundos, pasado por el nuevo codificador y por `/api/transcribe`; HTTP 200 y texto recibido. Mensajes, propuestas, agenda y auditoría se compararon antes/después y no cambiaron. La evidencia local no guarda cookies ni credenciales.

## Validación manual pendiente

La grabación de voz humana con un micrófono físico y permiso concedido no se certifica con pruebas simuladas ni con la muestra sintética. Completar en los navegadores/dispositivos elegidos para la demo, incluyendo móvil y cambios de foco:

- Abrir la demo local y conceder permiso al tocar el micrófono. Dictar una solicitud completamente ficticia y comprobar nivel, tiempo, detener y borrador editable.
- Cancelar durante captura: no debe enviarse audio ni alterarse el borrador. Denegar permiso y desconectar el dispositivo deben dejar una recuperación clara.
- Repetir una grabación corta y otra al límite. Comprobar que el indicador del navegador deja de mostrar el micrófono activo al terminar.
- Enviar el borrador revisado, comprobar propuesta pendiente y confirmar únicamente con la tarjeta. Medir latencia y exactitud con las voces/acentos del piloto; no atribuir esas métricas a la muestra sintética.

Referencias técnicas consultadas: [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode), [permiso de micrófono](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) y [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext).
