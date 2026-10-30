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
