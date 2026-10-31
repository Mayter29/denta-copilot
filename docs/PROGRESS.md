# Progreso · 31 de octubre de 2026 · preparación para jueces

Rama `feat/hackathon-final`, sin push ni despliegue.

- Batería real `pnpm eval:scenarios` (12 escenarios, 17 turnos con Meta): 12/12 en tres corridas. Detalle en [EVALUACIONES.md](EVALUACIONES.md).
- Defecto encontrado y corregido: una corrección dejaba confirmable la tarjeta anterior.
- Latencia: `reasoningEffort: 'low'` bajó p50 de 6,1 s a 3,6–4,2 s y p90 de 13,0 s a 5,8–7,9 s, con las mismas decisiones.
- Resumen de propuestas generado por el servidor; «Aplicando…» en la tarjeta que se confirma; «Reiniciar demo» al pie del panel de contexto, accesible en escritorio, tablet y móvil (verificado en el navegador).
- README reescrito para evaluadores. `pnpm check` (238 pruebas, build), `pnpm eval:offline` 34/34. React Doctor: 11 avisos, ninguno nuevo sin justificar.

# Progreso · 30 de octubre de 2026 (noche) · calidad del bot y diseño

Implementado y probado localmente, sin desplegar. Prompts `secretary-v5-denta` y `secretary-v5-connected`.

- Batería real de 12 pedidos de recepción contra Meta (briefing, disponibilidad, reservar con fecha relativa, cancelar, reagendar, ambigüedad, precio, lote, domingo, consulta clínica, «¿quién tiene espacio?», recordatorio). Antes: 10/12 correctos (preguntaba «¿qué lunes?» y ofrecía al ortodoncista para valoración). Después: 12/12. Presupuesto usado: ~50 turnos de chat en total, incluidos navegador y reproducciones.
- Turno pausado reproducido con historial real: el primer paso terminaba por `length` (2 de 3 intentos). Muse Spark cuenta razonamiento como salida (~1,4–1,8k tokens medidos). Se subió `maxOutputTokens` a 4.000 en ambos agentes; 3/3 tras el cambio.
- Prompt: calendario de 14 días con día de la semana (`clinicCalendar`), regla para el día que coincide con hoy, fechas legibles en prosa, horarios resumidos, búsqueda del paciente antes de pedir datos.
- Dominio: cada profesional declara sus servicios y `validateSlot` rechaza combinaciones inválidas (el ortodoncista solo hace control de ortodoncia). El lote ignora citas que ya empezaron. Búsqueda de pacientes sin tildes ni mayúsculas. Errores de seguimiento en español. Semilla showcase: Pablo pasa a valoración con la Dra. Valeria. Sesiones locales antiguas pueden conservar la combinación anterior.
- UI (`/demo`): cada tarjeta se muestra bajo el mensaje que la creó; reagendar muestra «antes → después»; fechas «vie 6 nov» sin ICU (sin desajuste de hidratación); briefing con plurales y huecos agrupados; chips de hora sin extremos de rango; pie del compositor reducido a una línea; comprobante con estilo propio. `/app/copiloto` conserva las tarjetas al final.
- Navegación con el lenguaje visual de Dentary: ítems neutros, activo con tinte turquesa, barra lateral de 4 px, icono de acento y foco visible; en `/demo` el resaltado sigue la sección elegida. Grabación (patrón de EVA): bloque compacto y centrado de 40 barras calculadas del bloque de audio actual (sin movimiento inventado; en silencio queda gris), degradado turquesa→azul, reloj contra el límite de 60 s, y borde del compositor con degradado cónico que gira al enfocar y más rápido al grabar; respeta movimiento reducido. Probado con pruebas de componente; falta QA con micrófono físico.
- Voz en vivo reparada: el «Failed to fetch» venía de que Chrome rechaza subidas en streaming sobre HTTP/1.1. Ahora el audio va en POST cortos y el texto por SSE ([diseño](VOZ.md)). Verificado en Chrome contra Meta real con señal sintética; falta voz real. React Doctor suma `await` dentro de un bucle en `live-upload.ts`: intencional, los bloques deben ir de a uno y en orden.
- Verificado: `pnpm check` verde (220 pruebas), `pnpm eval:offline` 31/31, navegador con Meta real (reagendar, reserva en dos turnos con chip, lote 5/5 confirmado), móvil 375 px sin desborde, consola sin errores en carga limpia. React Doctor: 10 avisos (9 previos + `js-set-map-lookups` en `agent.ts`, falso positivo sobre `String.includes`).

# Progreso · 30 de octubre de 2026 (rama `feat/denta-wow`, sin merge)

## Avance wow para el hackatón (implementado local, verificado)

- La asistente sigue siendo Denta, en voseo y con montos en colones. Prompts: `secretary-v4-denta-wow` (local) y `secretary-v4-connected-wow` (conectado). Sin commits, sin despliegue, sin migraciones ni escrituras en Supabase.
- P0 briefing: `getDailyInsights` en dominio puro (`src/lib/domain/insights.ts`, reutilizado por agente local, conectado y UI), tool en ambos agentes y 4 tarjetas de un clic en `/demo` (`/api/workspace` incluye `insights`) y `/app/copiloto` (`/api/conversation` incluye `insights` por `readBranchInsights`, solo lecturas). Verificado en navegador con Meta real: resumen correcto con datos de la sesión.
- P1 lote: `proposeBatchReschedule` + `decideBatch` en dominio (intervalos distintos garantizados, parciales por fila, idempotencia), tool en ambos agentes (conectado: bucle sobre el RPC `reschedule` existente, tarjetas individuales), tarjeta agrupada con «Confirmar todas» solo en local (`POST /api/proposals` acepta `batchId`). Verificado en navegador con Meta real: 5/5 aplicadas, 5 auditorías. Eval offline nuevo: «la Dra. Valeria no viene el viernes».
- P2 canal simulado: `proposeFollowUp` sigue local; `PatientThread` interactivo (Confirmar/Reagendar/Cancelar) con `POST /api/patient-reply` (solo asistencia en confirmar; el resto solo deja mensaje) y resumen con el modelo en el chat. Verificado en navegador: Luis confirmó, asistencia actualizada, resumen correcto.
- P3 voz en vivo: puente servidor `POST /api/voice-stream` a `wss://api.meta.ai/v1/asr/realtime` (`ENDPOINTING`, parciales CUMULATIVE, español + vocabulario dental; clave solo en servidor; tope ~125 s). Cliente `useLiveDictation` con vista previa de parciales, turnos al borrador y envío manual; requiere 16 kHz o sugiere el dictado por archivo. Probado con WebSocket simulado (3 pruebas) y en navegador (sesión viva sin errores de consola; micrófono físico pendiente).
- P4 visual: indicador verificado discreto (`ResultLine`), chips de horario clicables (`TimeChips`), insignias de asistencia en agenda, `ProposalList`/`BatchProposalCard`. Semilla ficticia ampliada: 4 profesionales, 4 servicios, dos semanas con patrones (opt-in `showcase: true`; la semilla base no cambió y los evals existentes pasan).
- Calidad: `pnpm check` verde, `pnpm eval:offline` 30/30 + dominio 8/8, `pnpm run doctor` 9 avisos (0 errores; Zod `.strict()` por convención documentada, complejidad de coordinadores ya existentes). Navegador: 0 errores de consola en todo el recorrido.
- Límites: conectado sin agrupación de lote ni seguimiento (el RPC no tiene `follow_up`/`motivo`); voz en vivo sin TTS ni WebRTC (el proveedor no los ofrece para este servicio); QA de micrófono físico y de `/app/copiloto` con sede real pendientes; presupuesto Meta de QA: 4 turnos de chat + ~30 s de ASR en vivo.

# Progreso · 27 de octubre de 2026

Registro histórico. El estado conectado al 30 de octubre está en [SUPABASE.md](SUPABASE.md). Al integrar las ramas se conservó el seguimiento con confirmación humana exclusivamente en `/demo`, con canal simulado; el escritorio anterior se sustituyó por las rutas separadas de login, copiloto, agenda y conocimiento en español. El agente conectado no ofrece seguimiento ni envíos a pacientes.

Corte local sobre `fe0f47a`. No está desplegado. `pnpm check` es la verificación de este corte; no se corrió `pnpm eval:live`.

## Hecho

- La asistente se llama Denta en el prompt y en la interfaz. La clínica de demostración sigue siendo ficticia.
- `proposeFollowUp` prepara un mensaje en español para citas sin confirmar o inasistencias. No se envía hasta el clic. Hay pruebas de idempotencia, rechazo, vencimiento, cita confirmada o cancelada, inasistencia en un día anterior, versión y aislamiento de sesión.
- Escritorio en inglés: agenda con cola de seguimiento, tarjetas de propuesta, canal simulado del paciente en español y estados de carga y vacío. Componentes separados para la sesión, la agenda y el hilo.
- `pnpm run doctor` usa React Doctor fijado, sin telemetría. El último escaneo de este corte no reportó avisos. `pnpm doctor` sin `run` lo reserva pnpm.
- Skills mínimas copiadas en `.agents/skills/` y listadas en `AGENTS.md`.
- Docs públicas sin rutas personales, nombres internos ni enlace de Discord. El README documenta `META_API_KEY`, `META_MODEL` y `DEMO_SESSION_SECRET` (mínimo 32 caracteres).

## Pendiente

- Persistencia en Supabase: Auth, RLS y transacciones. La agenda sigue en archivos de un solo proceso.
- Listo para Vercel: no. `guardLocal` solo acepta loopback en el puerto 3420 y las sesiones son archivos en `work/sessions`.
- No hay API de WhatsApp, MCP ni voz en vivo. El canal del paciente es una simulación.
- No se desplegó. La revisión visual en el navegador de este corte quedó incompleta al detener el trabajo.
