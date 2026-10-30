# Voz en tiempo real y WebRTC

Verificación oficial del 30 de octubre de 2026 contra la documentación instalada y pública:

- [Speech to text](https://dev.meta.ai/docs/speech-to-text): `wss://api.meta.ai/v1/asr/realtime` es WebSocket con handshake (la clave viaja en el primer frame JSON, nunca en header HTTP), parciales `CUMULATIVE`/`DELTA`, detección de turnos (`ENDPOINTING`), diarización e indicador de progreso.
- [API reference](https://dev.meta.ai/docs/api-reference): Voice expone transcribir grabación y transcribir en tiempo real. No existe síntesis de voz, tokens efímeros ni ningún endpoint WebRTC.

## Conclusión

No hay capacidad verificada de conversación voz-a-voz ni de WebRTC. Este proyecto no presenta SSE, dictado ni WebSocket como WebRTC y no incorpora proveedores pagos nuevos.

Lo implementado en este corte:

- `src/lib/client/live-transcription.ts`: máquina del protocolo realtime (handshake sin clave, parciales que reemplazan por turno con `turnId`, `speechComplete` por turno, `endStream` con drenaje, reintento solo con sesión nueva porque no hay resume token, backpressure a 5 s, códigos de cierre). Probada sin red en `live-transcription.test.ts`.
- El dictado WAV a borrador sigue siendo la modalidad soportada: micrófono → 60 s → transcripción → texto revisable → mismo flujo y permisos del chat.

## Bloqueo del puente en vivo

El navegador no puede abrir el WebSocket de Meta directamente: la clave quedaría expuesta. El puente (navegador → servidor propio → `wss://api.meta.ai/v1/asr/realtime`) es obligatorio y hoy no existe porque:

1. Las rutas de Next no aceptan actualización a WebSocket; haría falta un servidor WS dedicado o un proceso relay junto a `next start`.
2. Cada sesión en vivo consume presupuesto ($0.18/hora de audio procesado, sesiones de hasta 60 min, 256 transmisiones concurrentes y 16.000 inicios/hora por tenant).
3. Faltan captura continua, turnos hablados, interrupción, respuesta hablada real (sin TTS no hay voz de Denta) y cierre de tracks.

Opciones concretas: relay WS mínimo con la misma clave de la participante y presupuesto explícito; o mantener dictado por turnos (recomendado para la demo). Ninguna opción simula WebRTC: sin síntesis verificada no hay conversación bidireccional hablada.
