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
- Datos de cada sesión en `work/sessions`, separados con cookie firmada HttpOnly. Persisten recargas y reinicios del proceso local.

El chat espera la respuesta completa; todavía no transmite tokens progresivamente. La conexión al Supabase exclusivo de este proyecto está configurada y verificada; la agenda y el chat aún usan archivos locales. WhatsApp, servidor MCP y voz en vivo siguen pendientes. La persistencia local es para un único proceso y datos ficticios. No es el almacenamiento de producción.

Supabase está fijado a `lyphdzeazqnaepyzzisi` para impedir conexiones accidentales a otros proyectos. Verificar con `pnpm supabase:check`. Ver [configuración y alcance](docs/SUPABASE.md).

La [migración inicial de base de datos](docs/DATABASE.md) separa el núcleo del copiloto de la agenda ficticia para facilitar una futura integración autorizada con Dentary. Se prueba con `pnpm db:check` (requiere Docker); todavía no está aplicada en Supabase ni conectada a la app.

## Prueba rápida

1. «¿Cuál es el horario y cuánto cuesta una valoración? Citá tus fuentes».
2. «Buscá espacios mañana para una valoración con la Dra. Valeria».
3. Elegir una hora disponible y pedir reservar para una persona ficticia.
4. Confirmar la tarjeta y verificar la agenda. Pedir reagendar y luego cancelar.
5. Tocar el micrófono, dictar una solicitud ficticia, detener, corregir el borrador y enviar.

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
