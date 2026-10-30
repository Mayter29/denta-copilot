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
