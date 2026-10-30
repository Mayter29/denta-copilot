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

Conectividad, migración inicial, ingreso con Auth y adaptador de persistencia implementados para el proyecto exclusivo. El ingreso se comprobó en el navegador con la cuenta de prueba. La escritura desde la app todavía requiere configurar la clave de servidor.

La demostración explícita `/demo` mantiene su agenda y chat en `work/sessions`. El área `/app` verifica sesión y muestra un bloqueo explícito cuando falta la clave de escritura: nunca cae silenciosamente al almacenamiento local. Las credenciales de prueba están únicamente en `P:\denta-copilot\secrets`, ignorado por Git.

El 30 de octubre se cargó atómicamente la semilla controlada: Clínica Brisa Demo, Sede Central, dos profesionales, dos servicios, tres fuentes y tres citas ficticias futuras dentro del horario. La cuenta de prueba recibió el rol `scheduler` únicamente en esa clínica/sede. No se cargaron los fixtures del harness ni se crearon usuarios adicionales o buckets. La semilla y la asignación ya están aplicadas: no repetirlas. Detalle de pruebas y límites en [VALIDACION.md](VALIDACION.md).

El [estado de la migración y su verificación remota](DATABASE.md) mantiene el detalle de versión, RLS, permisos y límites. Pendiente: configurar la clave secreta fuera del chat y probar el recorrido remoto completo y sesiones reales de organizaciones/sedes diferentes. Una sesión verificada y un catálogo cargado no certifican la reserva remota ni el aislamiento entre dos usuarios. Nunca copiar conexiones o datos de Dentary/ECP.

Referencias: [inicialización del SDK](https://supabase.com/docs/reference/javascript/initializing) y [tipos de claves](https://supabase.com/docs/guides/getting-started/api-keys).
