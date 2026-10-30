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
- Resultados estructurados con referencias verificadas por turno, estados explícitos y comprobantes del servidor al confirmar.
- Propuestas guardadas por servidor; solo un clic de confirmación ejecuta el cambio.
- Horarios, duración, choques, vencimiento, control de versión, confirmación idempotente y auditoría.
- Agenda visible y fuentes ficticias de conocimiento con recuperación léxica.
- Micrófono con permiso explícito: grabar, detener y transcribir con Muse Voice Transcribe a un borrador editable. Cancelación, reintento y límite de 60 s; no se envía automáticamente al chat. Ver [flujo y límites del dictado](docs/DICTADO.md).
- Voz en vivo con Meta (ruta `/api/voice-stream`, puente WebSocket en servidor con `ENDPOINTING`, parciales CUMULATIVE, `languageBias: Spanish` y vocabulario dental): la clave nunca llega al navegador; los turnos confirmados caen al borrador y el envío sigue siendo manual. Requiere micrófono a 16 kHz; si el dispositivo entrega otra frecuencia, se usa el dictado por archivo.
- Briefing proactivo «Buenos días»: `getDailyInsights` (sin confirmar de mañana, inasistencias recientes, huecos libres, pacientes sin cita futura) con 4 tarjetas de un clic que generan la propuesta correspondiente.
- Reprogramación en lote `proposeBatchReschedule`: agrupa una propuesta por cita afectada, confirma todo junto o por fila, reporta parciales; doble confirmación idempotente.
- Canal simulado del paciente: `proposeFollowUp` reintegrado; el panel permite simular Confirmar/Reagendar/Cancelar, la agenda se actualiza en vivo (solo la confirmación cambia asistencia) y Denta resume con el modelo. Nunca envía WhatsApp.
- Datos de cada sesión en `work/sessions`, separados con cookie firmada HttpOnly. Persisten recargas y reinicios del proceso local.

El chat muestra progreso real por SSE (consultando agenda, disponibilidad, información, preparando propuesta) derivado de herramientas ejecutadas; todavía no transmite tokens progresivamente. La conexión al Supabase exclusivo de este proyecto está configurada y verificada; la agenda y el chat aún usan archivos locales. En modo conectado, el briefing y el lote funcionan sobre lecturas (sin RPC nuevos) y las tarjetas de lote se confirman por separado; el seguimiento de pacientes sigue siendo solo local. WhatsApp y servidor MCP siguen pendientes. La persistencia local es para un único proceso y datos ficticios. No es el almacenamiento de producción.

Supabase está fijado a `lyphdzeazqnaepyzzisi` para impedir conexiones accidentales a otros proyectos. Verificar con `pnpm supabase:check`. Ver [configuración y alcance](docs/SUPABASE.md).

La [migración inicial de base de datos](docs/DATABASE.md) separa el núcleo del copiloto de la agenda ficticia para facilitar una futura integración autorizada con Dentary. Está aplicada en el Supabase exclusivo, con RLS y permisos verificados. Se prueba localmente con `pnpm db:check` (requiere Docker); Auth y la conexión de la app a esa persistencia siguen pendientes.

## Prueba rápida

1. «¿Cuál es el horario y cuánto cuesta una valoración? Citá tus fuentes».
2. «Buscá espacios mañana para una valoración con la Dra. Valeria».
3. Elegir una hora disponible y pedir reservar para una persona ficticia.
4. Confirmar la tarjeta y verificar la agenda. Pedir reagendar y luego cancelar.
5. Tocar el micrófono, dictar una solicitud ficticia, detener, corregir el borrador y enviar.
6. «Buenos días, Denta. ¿Qué tenemos pendiente hoy?» y usar una tarjeta del resumen.
7. «La doctora Valeria no viene el viernes. Reorganizá sus citas.» Confirmar todo junto y revisar la actividad.
8. En Pacientes · simulación, simular que Luis confirma y leer el resumen de Denta.

```powershell
pnpm check
pnpm react:doctor
pnpm eval:offline
# Evaluación separada con Meta real y consumo de API; ver presupuesto en docs/EVALUACIONES.md
pnpm eval:live
```

Más información: [idea y plan V1](docs/PLAN-V1.md), [referencias y contribuciones](docs/REUTILIZACION.md), [validación](docs/VALIDACION.md).

Contrato, cobertura y límites: [evaluaciones conversacionales](docs/EVALUACIONES.md).

Reglas, skill local y diagnóstico inicial: [calidad y arquitectura](docs/CALIDAD.md).
