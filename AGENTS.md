# Denta Copilot — guía del proyecto

- Ubicación de trabajo: P:\denta-copilot. Package manager: pnpm.
- Demo administrativa con datos inventados. Nunca conectar la BD de Dentary/ECP.
- Leer docs/PLAN-V1.md y docs/REUTILIZACION.md antes de ampliar alcance.
- Credenciales solo servidor, .env.local ignorado; nunca imprimir ni copiar secretos a docs.
- Solo herramientas de lectura/propuesta para el modelo. Confirmación por endpoint y clic humano.
- Validar horarios, conflictos, versión e idempotencia al ejecutar, no solo al proponer.
- Persistencia local: un proceso, loopback:3420, cookie firmada, carpetas work/sessions.
- Para Supabase: proyecto nuevo, Auth, RLS y transacciones antes de publicar; no asumir aislamiento por filtros.
- No copiar código corporativo ni activos de EVA/Insight a este repositorio público.
- Verificar API del SDK/Next en node_modules de la versión instalada.
- Calidad: pnpm check. Reportar local/publicado y límites de verificación.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
