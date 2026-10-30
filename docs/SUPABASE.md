# Supabase de Denta Copilot

## Identidad comprobada

- Proyecto: **denta**.
- Organización: **dentacopilot**.
- Referencia: `lyphdzeazqnaepyzzisi`.
- Región observada en el dashboard: `us-west-2`.
- API: `https://lyphdzeazqnaepyzzisi.supabase.co`.
- [Configuración del proyecto](https://supabase.com/dashboard/project/lyphdzeazqnaepyzzisi/settings/general).

Se verificó la identidad en la sesión de Chrome de la participante el 27 de octubre de 2026. Se configuró inicialmente la clave **publicable** de este proyecto en `.env.local`. El 30 de octubre se configuró también la clave secreta existente, exclusivamente en el servidor y fuera de Git, sin crear ni rotar claves. Se verificó su acceso mediante una consulta administrativa de lectura de la cuenta de prueba y se reinició el servidor local. El 29 de octubre se verificó además el MCP `denta-supabase`, restringido a esta referencia y en solo lectura; el conector anterior sigue sin permisos. El estado del esquema y la migración están en [DATABASE.md](DATABASE.md).

## Configuración y protección de destino

`src/lib/supabase/config.ts` fija el proyecto elegido. `getSupabaseConfig` rechaza URLs distintas, HTTP, subdominios engañosos, variables vacías y claves secretas. El cliente de servidor en `src/lib/supabase/server.ts` usa esa validación; no persiste sesiones ni dispone de permisos administrativos.

La URL está documentada porque es pública. El valor de la clave se conserva fuera del repositorio. Al cambiar variables, verificar o reiniciar `pnpm dev` para cargar el entorno actualizado.

```powershell
pnpm supabase:check
```

La comprobación consulta `GET /auth/v1/settings` con la clave publicable y exige una respuesta reconocible. Resultado real obtenido: conexión aceptada para `lyphdzeazqnaepyzzisi`. El endpoint local `GET /api/integrations/supabase` repite la comprobación sin devolver claves. Una URL correcta con una clave de otro proyecto no pasa la verificación remota.

La raíz de metadatos de PostgREST requiere una clave secreta en este proyecto. No se amplían privilegios para verificar conectividad; no se usa esa raíz como prueba de conexión.

## Alcance de este avance

Conectividad, migración inicial, ingreso con Auth y adaptador de persistencia implementados para el proyecto exclusivo. El ingreso se comprobó en el navegador con la cuenta de prueba. La clave de servidor ya está configurada localmente como `SUPABASE_SERVICE_ROLE_KEY`; admite la clave secreta moderna. `src/lib/supabase/service.ts` crea el cliente privilegiado solo en el servidor, con el mismo control de destino.

La demostración explícita `/demo` mantiene su agenda y chat en `work/sessions`. El área `/app` verifica sesión y muestra un bloqueo explícito cuando falta la clave de escritura: nunca cae silenciosamente al almacenamiento local. Las credenciales de prueba están únicamente en `P:\denta-copilot\secrets`, ignorado por Git.

Con la configuración cargada se comprobaron ingreso, selección manual de Sede Central, apertura del copiloto, lectura de agenda y cierre/reingreso en Chrome. Se corrigió un bucle al seleccionar sede: el layout compartido ya no decide redirecciones según un pathname que Next puede conservar entre navegaciones; el guard de selección vive en la página del copiloto, como en agenda y conocimiento. `pnpm check`: 189 pruebas en 36 archivos, lint, tipos y build aprobados. React Doctor: los mismos ocho avisos previos, sin avisos nuevos en los archivos modificados. No se confirmó ninguna reserva remota en este corte.

Corrección posterior del chat: la consulta de historial ahora incluye `conversation_id`, exigido por su contrato. Los dobles de PostgREST proyectan solo las columnas solicitadas para detectar este tipo de omisión. Si fallan las lecturas previas al modelo, el servidor cierra el run; se cerraron también los tres runs ficticios que el error había dejado activos, mediante la RPC existente y sin cambios de agenda. Una cuenta con una sola sede autorizada entra directamente; con varias sigue eligiendo, y una selección explícita ajena se rechaza. Se mantiene la verificación de sesión en cada solicitud y RLS en las lecturas; el progreso visible usa «Preparando respuesta» y la cabecera ya no muestra el nombre del modelo. Verificación: `pnpm check` (192 pruebas, lint, tipos y build), `pnpm eval:offline` (24 casos) y React Doctor (ocho avisos previos). La reserva remota completa sigue pendiente.

QA real de esa corrección: dos mensajes informativos consecutivos con Meta y Supabase, fuente recuperada en ambos y recuperación del historial al recargar. El primer POST tardó 8,2 s en desarrollo (dos pasos del modelo); es una muestra, no un percentil. Un ingreso nuevo por HTTP sin cookie de selección abrió directamente el copiloto con la única sede autorizada. No se aprobaron propuestas ni se alteraron citas. Captura local: `work/qa-20261030/chat-recovered.png`, ignorada por Git.

El 30 de octubre se cargó atómicamente la semilla controlada: Clínica Brisa Demo, Sede Central, dos profesionales, dos servicios, tres fuentes y tres citas ficticias futuras dentro del horario. La cuenta de prueba recibió el rol `scheduler` únicamente en esa clínica/sede. No se cargaron los fixtures del harness ni se crearon usuarios adicionales o buckets. La semilla y la asignación ya están aplicadas: no repetirlas. Detalle de pruebas y límites en [VALIDACION.md](VALIDACION.md).

El [estado de la migración y su verificación remota](DATABASE.md) mantiene el detalle de versión, RLS, permisos y límites. Pendiente: probar el recorrido remoto completo y sesiones reales de organizaciones/sedes diferentes. Una sesión verificada y un catálogo cargado no certifican la reserva remota ni el aislamiento entre dos usuarios. Nunca copiar conexiones o datos de Dentary/ECP.

Referencias: [inicialización del SDK](https://supabase.com/docs/reference/javascript/initializing) y [tipos de claves](https://supabase.com/docs/guides/getting-started/api-keys).
