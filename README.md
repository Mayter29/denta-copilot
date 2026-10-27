# Denta Copilot

Copiloto de recepción para clínicas dentales: convierte una conversación en propuestas verificables para agendar, cancelar y reagendar. Demostración independiente con datos ficticios, creada para el Meta Global AI Developer Hackathon 2026.

## Arrancar

Requiere Node.js 22+ y pnpm 10.12.1.

```powershell
cd P:\denta-copilot
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local # Solo si todavía no existe. No sobrescribir una clave configurada.
```

Completar `META_API_KEY`, `META_MODEL=muse-spark-1.3` y `DEMO_SESSION_SECRET` (mínimo 32 caracteres aleatorios). Conservar `DEMO_MODE=true`.

```powershell
pnpm dev
```

Abrir [la demo local](http://127.0.0.1:3420). El proceso escucha únicamente en loopback. La clave queda en el servidor y `.env.local` está ignorado por Git.

## Qué funciona hoy

- Chat real con Meta Model API, Muse Spark y AI SDK 7.
- Consultas de disponibilidad, reservas, cancelaciones y reagendamiento mediante herramientas tipadas.
- Propuestas guardadas por servidor; solo un clic de confirmación ejecuta el cambio.
- Horarios, duración, choques, vencimiento, control de versión, confirmación idempotente y auditoría.
- Agenda visible y fuentes ficticias de conocimiento con recuperación léxica.
- Audio WAV mono, PCM 16 bits, 16 kHz, hasta 60 s / 2 MB, transcrito por Muse Voice Transcribe a un borrador editable. No se envía automáticamente al agente.
- Datos de cada sesión en `work/sessions`, separados con cookie firmada HttpOnly. Persisten recargas y reinicios del proceso local.

El chat espera la respuesta completa; todavía no transmite tokens progresivamente. No hay conexión a Supabase, WhatsApp, servidor MCP ni voz en vivo. La persistencia local es para un único proceso y datos ficticios. No es el almacenamiento de producción.

## Prueba rápida

1. «¿Cuál es el horario y cuánto cuesta una valoración? Citá tus fuentes».
2. «Buscá espacios mañana para una valoración con la Dra. Valeria».
3. Elegir una hora disponible y pedir reservar para una persona ficticia.
4. Confirmar la tarjeta y verificar la agenda. Pedir reagendar y luego cancelar.
5. Adjuntar un WAV inventado con el clip, corregir el borrador y enviar.

```powershell
pnpm check
```

Más información: [idea y plan V1](docs/PLAN-V1.md), [referencias y contribuciones](docs/REUTILIZACION.md), [validación](docs/VALIDACION.md).
