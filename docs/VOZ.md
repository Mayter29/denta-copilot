# Voz en tiempo real y WebRTC

Verificación oficial del 30 de octubre de 2026 contra la documentación instalada y pública:

- [Speech to text](https://dev.meta.ai/docs/speech-to-text): `wss://api.meta.ai/v1/asr/realtime` es WebSocket con handshake (la clave viaja en el primer frame JSON, nunca en header HTTP), parciales `CUMULATIVE`/`DELTA`, detección de turnos (`ENDPOINTING`), diarización e indicador de progreso.
- [API reference](https://dev.meta.ai/docs/api-reference): Voice expone transcribir grabación y transcribir en tiempo real. No existe síntesis de voz, tokens efímeros ni ningún endpoint WebRTC.

## Conclusión

No hay capacidad verificada de conversación voz-a-voz ni de WebRTC. Este proyecto no presenta SSE, dictado ni WebSocket como WebRTC y no incorpora proveedores pagos nuevos.

Lo implementado en este corte:

- `src/lib/client/live-transcription.ts`: máquina del protocolo realtime (handshake sin clave, parciales que reemplazan por turno con `turnId`, `speechComplete` por turno, `endStream` con drenaje, reintento solo con sesión nueva porque no hay resume token, backpressure a 5 s, códigos de cierre). Probada sin red en `live-transcription.test.ts`.
- El dictado WAV a borrador sigue siendo la modalidad soportada: micrófono → 60 s → transcripción → texto revisable → mismo flujo y permisos del chat.

## Puente en vivo (31 de octubre de 2026)

El navegador no puede abrir el WebSocket de Meta: la clave quedaría expuesta y Meta no ofrece tokens temporales. El puente pasa por el servidor propio, en `src/app/api/voice-stream/route.ts`.

El primer diseño subía el audio en un único `fetch` con cuerpo en streaming (`duplex: 'half'`). Chrome rechaza esos pedidos sobre HTTP/1.x ([Streaming requests with the fetch API](https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests)) y `next dev` sirve HTTP/1.1, así que fallaba con «Failed to fetch» antes de llegar al servidor. Las pruebas usaban sockets simulados y no lo detectaban.

Diseño actual, el patrón de dos pedidos que propone ese artículo:

1. `POST ?op=start`: abre el WebSocket con Meta y responde por SSE. El primer evento es `ready {id}`; luego llegan `partial`, `turn`, `progress`, `error` y `done`.
2. `POST ?op=audio&id=`: bloques de ~250 ms de PCM16 mono a 16 kHz, en orden y de a uno (`src/lib/client/live-upload.ts`).
3. `POST ?op=end&id=`: envía `endStream`; Meta procesa lo pendiente y cierra.

Cada stream queda atado a la cookie firmada que lo abrió (un ID ajeno responde 404), exige origen local, limita bloques a 2 s y la sesión a 125 s, y se cierra tras 15 s sin audio. El registro vive en memoria de un único proceso local; no sirve para funciones serverless.

Verificado en Chrome contra Meta real con señal sintética de 16 kHz: SSE abierto, bloques `audio` respondidos con 204 en 4–17 ms, cierre con `done` y consola sin errores. Falta QA con voz real y micrófono físico.

Se descartaron, por ahora, un servidor WebSocket propio (Next 16.4.3 no admite WebSocket en rutas; obliga a un servidor aparte) y WebRTC (Meta no lo ofrece y requiere servidor de medios). Sin síntesis de voz, Denta no responde hablando.
