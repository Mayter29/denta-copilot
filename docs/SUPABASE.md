# Supabase de Denta Copilot

## Identidad comprobada

- Proyecto: **denta**.
- Organización: **dentacopilot**.
- Referencia: `lyphdzeazqnaepyzzisi`.
- Región observada en el dashboard: `us-west-2`.
- API: `https://lyphdzeazqnaepyzzisi.supabase.co`.
- [Configuración del proyecto](https://supabase.com/dashboard/project/lyphdzeazqnaepyzzisi/settings/general).

Se verificó la identidad en la sesión de Chrome de la participante el 27 de octubre de 2026. Se configuró únicamente la clave **publicable** de este proyecto en `.env.local`. No se reveló ni copió la clave secreta. El 29 de octubre se verificó además el MCP `denta-supabase`, restringido a esta referencia y en solo lectura; el conector anterior sigue sin permisos. El estado del esquema y la migración están en [DATABASE.md](DATABASE.md).

## Configuración y protección de destino

`src/lib/supabase/config.ts` fija el proyecto elegido. `getSupabaseConfig` rechaza URLs distintas, HTTP, subdominios engañosos, variables vacías y claves secretas. El cliente de servidor en `src/lib/supabase/server.ts` usa esa validación; no persiste sesiones ni dispone de permisos administrativos.

La URL está documentada porque es pública. El valor de la clave se conserva fuera del repositorio. Al cambiar variables, verificar o reiniciar `pnpm dev` para cargar el entorno actualizado.

```powershell
pnpm supabase:check
```

La comprobación consulta `GET /auth/v1/settings` con la clave publicable y exige una respuesta reconocible. Resultado real obtenido: conexión aceptada para `lyphdzeazqnaepyzzisi`. El endpoint local `GET /api/integrations/supabase` repite la comprobación sin devolver claves. Una URL correcta con una clave de otro proyecto no pasa la verificación remota.

La raíz de metadatos de PostgREST requiere una clave secreta en este proyecto. No se amplían privilegios para verificar conectividad; no se usa esa raíz como prueba de conexión.

## Alcance de este avance

Conectividad configurada y migración inicial aplicada al proyecto exclusivo. Esto no equivale todavía a login de usuarios ni persistencia de la aplicación en Supabase.

La agenda y el chat siguen en `work/sessions`. Ya existen las tablas, políticas y RPC del esquema inicial remoto; no se cargaron organizaciones, citas ni fixtures. Se creó una cuenta de prueba por el dashboard de Auth y se verificó ingreso con contraseña, identidad mediante `getUser` y cierre de esa sesión de prueba. Las credenciales están únicamente en `P:\denta-copilot\secrets`, ignorado por Git; no se guardaron tokens. La cuenta aún no tiene membresías ni acceso a una organización/sede de la demo. No se crearon buckets. Esta comprobación de Auth no sustituye las pruebas pendientes de autorización/RLS entre usuarios ni el login de la aplicación, todavía no implementado.

El [estado de la migración y su verificación remota](DATABASE.md) mantiene el detalle de versión, RLS, permisos y límites. Pendiente: integrar Auth y el adaptador de persistencia, crear datos ficticios controlados y probar sesiones reales de organizaciones/sedes diferentes. Nunca copiar conexiones o datos de Dentary/ECP.

Referencias: [inicialización del SDK](https://supabase.com/docs/reference/javascript/initializing) y [tipos de claves](https://supabase.com/docs/guides/getting-started/api-keys).
