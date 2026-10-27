# Supabase de Denta Copilot

## Identidad comprobada

- Proyecto: **denta**.
- Organización: **dentacopilot**.
- Referencia: `lyphdzeazqnaepyzzisi`.
- Región observada en el dashboard: `us-west-2`.
- API: `https://lyphdzeazqnaepyzzisi.supabase.co`.
- [Configuración del proyecto](https://supabase.com/dashboard/project/lyphdzeazqnaepyzzisi/settings/general).

Se verificó la identidad en la sesión de Chrome de la participante el 27 de octubre de 2026. Se configuró únicamente la clave **publicable** de este proyecto en `.env.local`. No se reveló ni copió la clave secreta. El conector MCP disponible no tiene permiso sobre este proyecto; se usó el dashboard para obtener su configuración.

## Configuración y protección de destino

`src/lib/supabase/config.ts` fija el proyecto elegido. `getSupabaseConfig` rechaza URLs distintas, HTTP, subdominios engañosos, variables vacías y claves secretas. El cliente de servidor en `src/lib/supabase/server.ts` usa esa validación; no persiste sesiones ni dispone de permisos administrativos.

La URL está documentada porque es pública. El valor de la clave se conserva fuera del repositorio. Al cambiar variables, verificar o reiniciar `pnpm dev` para cargar el entorno actualizado.

```powershell
pnpm supabase:check
```

La comprobación consulta `GET /auth/v1/settings` con la clave publicable y exige una respuesta reconocible. Resultado real obtenido: conexión aceptada para `lyphdzeazqnaepyzzisi`. El endpoint local `GET /api/integrations/supabase` repite la comprobación sin devolver claves. Una URL correcta con una clave de otro proyecto no pasa la verificación remota.

La raíz de metadatos de PostgREST requiere una clave secreta en este proyecto. No se amplían privilegios para verificar conectividad; no se usa esa raíz como prueba de conexión.

## Alcance de este avance

Conectividad y configuración listas. Esto no equivale a login de usuarios, consultas de citas, persistencia de conversaciones ni aislamiento de filas.

La agenda y el chat siguen en `work/sessions`. No se crearon tablas, usuarios, políticas, buckets ni registros remotos. No se ejecutaron migraciones. Las pruebas de configuración impiden seleccionar accidentalmente otro proyecto, pero no sustituyen pruebas de autorización y RLS.

Siguiente corte: esquema propio, Auth, RLS, restricciones de agenda y confirmación transaccional. Se implementará exclusivamente en esta referencia, con datos ficticios y migraciones versionadas. Nunca copiar conexiones o datos de otro proyecto.

Referencias: [inicialización del SDK](https://supabase.com/docs/reference/javascript/initializing) y [tipos de claves](https://supabase.com/docs/guides/getting-started/api-keys).
