# Resultados verificables y evaluaciones

Implementación propia del 27 de octubre de 2026. Persistencia local, clínica y personas ficticias. Este corte no crea tablas ni cambia la conexión Supabase exclusiva `lyphdzeazqnaepyzzisi`.

## Contrato en uso

El agente termina mediante `submitResult` con `kind` (`answer`, `needs_input`, `proposal`), `text`, `sourceIds` y `proposalIds`. No existe una salida conversacional `executed`. Se usa una herramienta terminal compatible con el protocolo de herramientas de Meta; no se requiere un modo JSON adicional del proveedor. La API se comprobó contra `ai@7.0.154` instalado.

El servidor exige una única entrega final en un paso separado, resuelve las referencias y valida el resultado con Zod. Solo admite fuentes recuperadas en el mismo turno, identificadas por ID y hash SHA-256 de título/contenido. Todas las propuestas preparadas deben aparecer en el resultado, existir en esa sesión y seguir pendientes. Una fuente estática existente pero no recuperada también se rechaza. No se permite que el modelo entregue campos de comprobante.

Las herramientas trabajan sobre una copia. Solo se incorporan las propuestas después de verificar el resultado completo. Una referencia inválida, salida incompleta, fallo o timeout descarta esas propuestas parciales. El mensaje guardado distingue `failed` y `paused`; lleva ID de ejecución y versión de prompt. No hay reanudación automática ni registro duradero de pasos intermedios.

Para `proposal`, el texto visible de estado se genera por código y descarta la redacción del modelo. Cada mensaje nuevo muestra su estado y que el turno no cambió la agenda. Las respuestas informativas y preguntas conservan prosa del modelo: la verificación de referencias no demuestra que cada frase sea correcta. Las fuentes desplegables muestran contenido y título del servidor; no se verifican citas textuales redactadas por el modelo ni inferencias semánticas.

El endpoint de confirmación acepta exclusivamente ID y decisión. Conserva horario, conflictos, vigencia, versión e idempotencia. Al ejecutar guarda un comprobante con ID de propuesta, acción, hora y una copia de la cita resultante; confirma también su correspondencia con la auditoría antes de devolverlo. Ese comprobante conserva el estado al ejecutar aunque otra acción cambie luego la cita. Se presenta en la tarjeta confirmada y no necesita otra llamada a Meta. Las sesiones/propuestas anteriores a este corte siguen siendo legibles, pero sus textos y ejecuciones no reciben evidencia retroactiva.

## Ejecutar

```powershell
pnpm eval:offline
pnpm check
pnpm eval:live
```

`eval:offline` ejecuta el bucle real de `ToolLoopAgent` con `MockLanguageModelV4` y las herramientas del producto, sin red ni claves. Los guiones adversos, reloj fijo, estado inicial y expectativas viven fuera de los mensajes y fuentes disponibles al agente. Las expectativas inspeccionan parámetros y resultados de herramientas, estado, efectos y número de llamadas; no comparan la respuesta por igualdad textual. Los tests del endpoint conservan validación de entrada y dominio, con sesión/almacenamiento simulados en memoria.

Cobertura offline: reserva completa, dato faltante, nombre ambiguo, espacio ocupado, conflicto/versión/vencimiento entre propuesta y clic, sí por chat, doble clic, fuente inventada/no recuperada, contenido recuperado versionado, inyección en documento que intenta invocar una herramienta de escritura inexistente, ID ajeno, texto libre sin entrega, límite de pasos, fallo de herramienta, timeout, salida inválida y parámetros manipulados. Progreso real: mapeo herramienta→estado, secuencia de eventos con final verificado, propuesta pendiente sin escrituras, error/límite sin éxito ni parciales, cancelación/aborto y respuestas tardías ignoradas. Audio se comprueba en el endpoint de transcripción: devuelve texto sin abrir chat ni mutar agenda. El formato WAV tiene sus pruebas propias. No se automatiza aquí la interacción del selector de archivos del navegador.

La inyección simulada prueba que ni siquiera una selección adversa de herramientas puede habilitar escritura; no mide resistencia general de Muse Spark a inyección ni impide que redacte texto incorrecto. La ambigüedad y los datos faltantes comprueban las secuencias simuladas, no una comprensión universal del lenguaje. Los IDs de otra sesión se rechazan en servidor; esto no constituye una prueba de RLS multi tenant.

`eval:live` es una suite separada y explícita que carga `.env.local` solo en el proceso servidor de pruebas. Hace tres casos secuenciales con Meta: datos faltantes, reserva pendiente y horario con fuente. Usa el mismo reloj fijo y nunca confirma una propuesta; todo el estado queda en memoria. No usa Supabase ni escribe archivos de sesiones. No forma parte de `pnpm check`.

Presupuesto máximo de esa suite: tres turnos; cada uno mantiene seis pasos, 1.800 tokens de salida por paso, un reintento del SDK y timeout de 55 segundos. Sin repeticiones de Vitest. Cota conservadora: 36 solicitudes contando reintentos y 64.800 tokens de salida; el consumo efectivo normalmente es menor. No se fija un costo monetario porque depende de la tarifa de la cuenta. Ampliar casos o repeticiones debe ser una decisión explícita.

## Evidencia de este corte

- `pnpm eval:live`: 3/3 casos aprobados con Meta real el 27 de octubre de 2026. Reserva pendiente con parámetros esperados, fuente de horario recuperada y aclaración sin propuestas. Cero citas nuevas y cero auditorías de escritura.
- Suite offline y calidad completa: ver resultado final en [VALIDACION.md](VALIDACION.md).
- Commit inicial del contrato: `16fe351`, enviado a `origin/main`. El harness y esta documentación se guardan en el avance siguiente.

No hay despliegue de este corte ni migraciones remotas. Pendientes: evaluación amplia con proveedor, QA visual, RLS/Auth/transacciones Supabase, presupuesto agregado por sesión y recuperación duradera.

## Latencia y streaming (corte de arquitectura)

Medición por `requestId`/`runId` con reloj monotónico (`src/lib/server/timing.ts`): sesión, autorización, run, lecturas, modelo (pasos y tokens cuando el SDK los expone), herramientas, publicación, respuesta y total. Solo números e IDs; nunca prompts, contenido, cookies ni tokens.

- Antes: 20 consultas PostgREST por turno conectado (8 de contexto + 10 de reconstrucción + autorización/sede), historial sin límite SQL y posible duplicación del mensaje actual al correr `beginRun` en paralelo.
- Después: 12 consultas por turno (autorización/sede en paralelo, catálogo e historial acotados, delta del run), historial de 18 con `sequence` desc + límite y exclusión del run actual.
- Muestras con latencias RPC simuladas de 40 ms (5 turnos publicados): mediana 198 ms, máximo 237 ms. Son muestras de harness, no percentiles ni medición remota.
- Streaming: se inspeccionó `ToolLoopAgent.stream` en AI SDK 7.0.154. El texto verificable vive dentro de la llamada `submitResult`; transmitir deltas expondría JSON parcial de herramientas y ninguna prosa publicable. Se conserva `generate()` deliberadamente: el progreso nace de eventos reales de paso/herramienta y las tarjetas se habilitan solo tras `publishRun`. No se simula streaming cortando texto terminado.
