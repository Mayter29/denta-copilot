# Denta Copilot

Copiloto de recepción para clínicas dentales: convierte una conversación en propuestas verificables para agendar, cancelar y reagendar. Demostración independiente con datos ficticios, creada para el Meta Global AI Developer Hackathon 2026.

## Arrancar

Requiere Node.js 22+ y pnpm 10.12.1. Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
```

No sobrescribir un `.env.local` que ya tenga claves. El archivo está ignorado por Git. Las variables viven solo en el servidor: no usar el prefijo `NEXT_PUBLIC_` para la clave del modelo.

| Variable              | Obligatoria | Qué espera                                                             |
| --------------------- | ----------- | ---------------------------------------------------------------------- |
| `META_API_KEY`        | Sí          | Clave de la API de modelos de Meta                                     |
| `META_MODEL`          | Sí          | Identificador del modelo. En esta demo: `muse-spark-1.3`               |
| `DEMO_SESSION_SECRET` | Sí          | Secreto aleatorio de al menos 32 caracteres. Firma la cookie de sesión |
| `DEMO_MODE`           | Sí          | `true` para habilitar la demo local                                    |

`META_BASE_URL` es opcional y, si se define, tiene que seguir siendo `https://api.meta.ai/v1`. Supabase se documenta en [docs/SUPABASE.md](docs/SUPABASE.md); la agenda de esta demo no escribe ahí.

```bash
pnpm dev
```

Abrir [la demo local](http://127.0.0.1:3420). El proceso escucha únicamente en loopback.

## Qué funciona hoy

- Chat real con Meta Model API, Muse Spark y AI SDK 7.
- Consultas de disponibilidad, reservas, cancelaciones, reagendamiento y seguimiento de quien no confirmó o no asistió. El seguimiento propone un mensaje en español y solo se envía al confirmar la tarjeta.
- Escritorio en inglés para el equipo. El canal del paciente es una simulación dentro de la app, con aspecto de mensajería. No hay API de WhatsApp.
- Resultados estructurados con referencias verificadas por turno, estados explícitos y comprobantes del servidor al confirmar.
- Propuestas guardadas por servidor; solo un clic de confirmación ejecuta el cambio.
- Horarios, duración, choques, vencimiento, control de versión, confirmación idempotente y auditoría.
- Agenda visible y fuentes ficticias de conocimiento con recuperación léxica.
- Micrófono con permiso explícito: grabar, detener y transcribir con Muse Voice Transcribe a un borrador editable. Cancelación, reintento y límite de 60 s; no se envía automáticamente al chat. Ver [flujo y límites del dictado](docs/DICTADO.md).
- Datos de cada sesión en `work/sessions`, separados con cookie firmada HttpOnly. Persisten recargas y reinicios del proceso local.

El chat espera la respuesta completa; todavía no transmite tokens progresivamente. La conexión al Supabase exclusivo de este proyecto está configurada y verificada; la agenda y el chat aún usan archivos locales. No hay despliegue: `guardLocal` solo acepta `localhost:3420` o `127.0.0.1:3420`, y las sesiones viven en `work/sessions` de un solo proceso. WhatsApp, servidor MCP y voz en vivo siguen pendientes. Esa persistencia es para datos ficticios. No es el almacenamiento de producción.

Supabase está fijado a `lyphdzeazqnaepyzzisi` para impedir conexiones accidentales a otros proyectos. Verificar con `pnpm supabase:check`. Ver [configuración y alcance](docs/SUPABASE.md).

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
