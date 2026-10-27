# Denta Copilot — guía del proyecto

- Package manager: pnpm.
- Demo administrativa con datos inventados. Nunca conectar una base clínica real.
- Leer docs/PLAN-V1.md y docs/REUTILIZACION.md antes de ampliar alcance.
- Credenciales solo servidor, .env.local ignorado; nunca imprimir ni copiar secretos a docs.
- Solo herramientas de lectura/propuesta para el modelo. Confirmación por endpoint y clic humano.
- Validar horarios, conflictos, versión e idempotencia al ejecutar, no solo al proponer.
- Persistencia local: un proceso, loopback:3420, cookie firmada, carpetas work/sessions.
- Para Supabase: proyecto nuevo, Auth, RLS y transacciones antes de publicar; no asumir aislamiento por filtros.
- Supabase exclusivo: `lyphdzeazqnaepyzzisi` (denta / dentacopilot). Leer `docs/SUPABASE.md`. Todo cliente pasa por `getSupabaseConfig`; nunca sustituirlo por otro proyecto.
- No copiar código ni activos privados de otros productos a este repositorio público.
- Verificar API del SDK/Next en node_modules de la versión instalada.
- Calidad: pnpm check. Reportar local/publicado y límites de verificación.

## Calidad y arquitectura para avanzar rápido

- Resolver el problema con el cambio más pequeño que quede claro y comprobable. Reutilizar lo existente; introducir dependencias, abstracciones o capas solo cuando aporten al caso actual.
- Mantener componentes enfocados. Separar presentación, coordinación de estado y lógica de negocio cuando mezclarlas dificulte entender o probar el flujo. No acumular chat, audio, agenda y acceso a datos en un componente monolítico.
- Un componente de unas 250–300 líneas merece revisión de responsabilidades; es una señal, no una meta ni motivo para dividir archivos mecánicamente. Extraer una unidad con nombre y contrato claros. No convertir cada fragmento de JSX en un componente ni crear hooks sin beneficio concreto.
- Arquitectura actual: `src/lib/domain` contiene reglas y contratos sin React, Next, HTTP ni acceso a datos; `src/lib/server` integra proveedor y persistencia; `src/lib/client` adapta APIs del navegador y HTTP del cliente sin React; `src/app/api` valida sesión/entrada y coordina; `src/components` presenta e interactúa. Las dependencias apuntan al dominio, nunca del dominio a la UI o al servidor.
- Mantener código y secretos de servidor fuera del cliente. Aplicar autorización y validación en la frontera de confianza; el prompt, una tarjeta o un filtro visual no sustituyen controles de servidor.
- TypeScript con contratos explícitos en las fronteras; entradas externas se validan en ejecución. Evitar `any`, casts y aserciones no nulas que oculten incertidumbre. Estados derivados se calculan; efectos sincronizan con sistemas externos. No desactivar reglas de hooks para esconder un problema.
- Optimizar con evidencia: revisar solicitudes duplicadas, trabajo secuencial independiente, payloads y renders antes de añadir caché, memoización o dependencias. Accesibilidad, teclado, foco visible, estados de error/carga y movimiento reducido forman parte de la UI.

### Validación proporcional

- Durante cambios de texto/estilo: revisión de diff y comprobación visual si afecta UI. Durante cambios de lógica: tipos/lint y pruebas relevantes. Antes de commit/push con código o configuración ejecutable: `pnpm check`.
- Al cambiar componentes/hooks o revisar arquitectura React: `pnpm react:doctor`. Para cambios grandes, ejecutar antes y después. La versión está fijada; el comando desactiva telemetría, score remoto y análisis externo de dependencias. Los informes quedan en `work/react-doctor`, ignorado por Git.
- React Doctor complementa ESLint, tipos, pruebas y navegador. Verificar cada hallazgo en el código; corregir regresiones y problemas relevantes del alcance. No perseguir 100 puntos, ocultar reglas ni iniciar refactors masivos para limpiar avisos. Deuda previa y falsos positivos se documentan con evidencia y siguiente paso; un fallo real de seguridad o integridad del cambio se resuelve antes de publicarlo.
- Tests para comportamiento e invariantes: conflictos, versión, idempotencia, aislamiento y confirmación humana. No agregar tests que solo reproduzcan la implementación o congelen estilos/copys por rutina. Si cambia la frontera del agente, ejecutar `pnpm eval:offline`; `pnpm eval:live` es separado, con presupuesto explícito en `docs/EVALUACIONES.md`.
- Documentación/skills sin cambios ejecutables: enlaces, comandos, formato y validación de la skill; no repetir build o llamadas a Meta sin motivo. Comprobar el resultado real y reportar verificaciones omitidas o bloqueadas.

### Repositorio público

- Commits pequeños y descriptivos; diff enfocado, sin temporales, informes, secretos, datos reales ni material privado copiado. Conservar procedencia y licencias cuando corresponda.
- Una fuente de documentación por decisión. README con comandos reproducibles y límites actuales; distinguir implementado, probado localmente, subido a GitHub y desplegado. No afirmar capacidades a partir de una puntuación o simulación.
- Para una revisión de calidad, arquitectura o refactor significativo, usar la skill local [denta-quality](.agents/skills/denta-quality/SKILL.md). No exige ceremonias adicionales para cambios triviales.

## Skills

Están en el repositorio para este proyecto. Usar la que coincida con la tarea; no hace falta abrirlas todas.

| Skill                                                                                  | Cuándo                                                          |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [denta-quality](.agents/skills/denta-quality/SKILL.md)                                 | Fronteras de este repo, composición y diagnóstico React         |
| [web-design-guidelines](.agents/skills/web-design-guidelines/SKILL.md)                 | Revisión de UI: accesibilidad, foco, formularios (Vercel)       |
| [composition-patterns](.agents/skills/composition-patterns/SKILL.md)                   | Extraer componentes React sin booleanos (Vercel)                |
| [frontend-design](.agents/skills/frontend-design/SKILL.md)                             | Dirección visual de una pantalla (Anthropic)                    |
| [webapp-testing](.agents/skills/webapp-testing/SKILL.md)                               | Probar la app en el navegador con Playwright (Anthropic)        |
| [shadcn](.agents/skills/shadcn/SKILL.md)                                               | Si se introducen componentes de shadcn/ui                       |
| [tdd](.agents/skills/tdd/SKILL.md)                                                     | Comportamiento nuevo cubierto por pruebas (Matt Pocock)         |
| [improve-codebase-architecture](.agents/skills/improve-codebase-architecture/SKILL.md) | Refactor amplio de límites (Matt Pocock)                        |
| [systematic-debugging](.agents/skills/systematic-debugging/SKILL.md)                   | Fallo que hay que localizar antes de parchar (obra/superpowers) |

`pnpm run doctor` ejecuta React Doctor con la versión fijada (`pnpm react:doctor`): sin telemetría, sin score remoto y con el informe en `work/react-doctor`. Hay que usar `run` porque `pnpm doctor` lo reserva el propio pnpm.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
