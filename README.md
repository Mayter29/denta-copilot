# Denta

Denta es el asistente de recepción de una clínica dental ficticia. Prepara propuestas para agendar, mover, cancelar y dar seguimiento a quien no confirmó o no se presentó. La interfaz del personal está en inglés. Los mensajes que vería el paciente están en español, dentro de un chat simulado: no hay API de WhatsApp. Demostración con datos inventados para el Meta Global AI Developer Hackathon 2026.

## Arrancar

Requiere Node.js 22+ y pnpm 10.12.1.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local # Solo si todavía no existe. No sobrescribir una clave configurada.
```

Variables de servidor. Van en `.env.local`, que Git ignora. No usar el prefijo `NEXT_PUBLIC_` para la clave del modelo.

| Variable              | Requerida                 | Uso                                                                       |
| --------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `META_API_KEY`        | Sí, para hablar con Denta | Clave de la API de Meta. También se acepta `MODEL_API_KEY` como alias.    |
| `META_MODEL`          | Sí, para hablar con Denta | Identificador del modelo. En esta demo: `muse-spark-1.3`.                 |
| `DEMO_SESSION_SECRET` | Sí                        | Secreto para firmar la cookie de sesión. Mínimo 32 caracteres aleatorios. |
| `DEMO_MODE`           | Sí                        | Debe quedar en `true` para la demo local.                                 |
| `META_BASE_URL`       | No                        | Por defecto `https://api.meta.ai/v1`. Otro valor se rechaza.              |

`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` solo sirven para la comprobación de conexión documentada en [docs/SUPABASE.md](docs/SUPABASE.md). La agenda no se guarda ahí.

```bash
pnpm dev
```

Abrir [la demo local](http://127.0.0.1:3420). El proceso escucha únicamente en loopback. La clave queda en el servidor y `.env.local` está ignorado por Git.

## Qué funciona hoy

- Chat real con Meta Model API, Muse Spark y AI SDK 7.
- Consultas de disponibilidad, reservas, cancelaciones, reagendamiento y seguimiento (`proposeFollowUp`) mediante herramientas tipadas.
- Resultados estructurados con referencias verificadas por turno, estados explícitos y comprobantes del servidor al confirmar.
- Propuestas guardadas por servidor; solo un clic de confirmación ejecuta el cambio.
- Horarios, duración, choques, vencimiento, control de versión, confirmación idempotente y auditoría.
- Agenda visible y fuentes ficticias de conocimiento con recuperación léxica.
- Micrófono con permiso explícito: grabar, detener y transcribir con Muse Voice Transcribe a un borrador editable. Cancelación, reintento y límite de 60 s; no se envía automáticamente al chat. Ver [flujo y límites del dictado](docs/DICTADO.md).
- Datos de cada sesión en `work/sessions`, separados con cookie firmada HttpOnly. Persisten recargas y reinicios del proceso local.

El chat espera la respuesta completa; todavía no transmite tokens progresivamente. La conexión al Supabase exclusivo de este proyecto está configurada y verificada; la agenda y el chat aún usan archivos locales en `work/sessions`. `guardLocal` solo acepta `localhost:3420` con `DEMO_MODE=true`, así que esta build no está lista para Vercel. WhatsApp real, servidor MCP y voz en vivo siguen pendientes. La persistencia local es para un único proceso y datos ficticios. No es el almacenamiento de producción.

Supabase está fijado a `lyphdzeazqnaepyzzisi` para impedir conexiones accidentales a otros proyectos. Verificar con `pnpm supabase:check`. Ver [configuración y alcance](docs/SUPABASE.md).

## Prueba rápida

1. «¿Cuál es el horario y cuánto cuesta una valoración? Citá tus fuentes».
2. «Buscá espacios mañana para una valoración con la Dra. Valeria».
3. Elegir una hora disponible y pedir reservar para una persona ficticia.
4. Confirmar la tarjeta y verificar la agenda. Pedir reagendar, un seguimiento en español para Luis o Sofía, y luego cancelar.
5. Tocar el micrófono, dictar una solicitud ficticia, detener, corregir el borrador y enviar.

```bash
pnpm check
pnpm run doctor
pnpm eval:offline
# Evaluación separada con Meta real y consumo de API; ver presupuesto en docs/EVALUACIONES.md
pnpm eval:live
```

Más información: [idea y plan V1](docs/PLAN-V1.md), [referencias y contribuciones](docs/REUTILIZACION.md), [validación](docs/VALIDACION.md).

Contrato, cobertura y límites: [evaluaciones conversacionales](docs/EVALUACIONES.md).

Reglas, skill local y diagnóstico inicial: [calidad y arquitectura](docs/CALIDAD.md).
