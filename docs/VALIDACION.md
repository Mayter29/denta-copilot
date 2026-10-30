# Validación · 27 de octubre de 2026

## Continuación y QA · 30 de octubre de 2026

- `pnpm check`: lint, tipos, 186 pruebas en 35 archivos y build aprobados. El harness admite pruebas React `.test.tsx` además de `.test.ts`.
- Navegador interactivo: login real, estado explícito sin clave de escritura, cierre de sesión y redirección de una ruta protegida después de salir. Se corrigió el menú del área conectada: en pantallas compactas ahora permite navegar, ver/cambiar sede y cerrar sesión. Antes la CSS ocultaba todos esos controles.
- Los fallos de cierre/cambio de sede se muestran sin fingir éxito ni redirigir. Una sola acción de sesión puede estar pendiente; al salir correctamente se limpian solo las preferencias del usuario actual. Pruebas de regresión de fallos, reintento, selección y doble acción.
- Mascota: revisión visual interactiva de silueta/volumen y estados en escritorio y móvil, a través de `/brand-review`; pausa manual del avatar comprobada en `/demo`. La página de revisión renderiza tamaños de 24/32/40/52/92 px y muestras claras/oscuras. La geometría y reduced motion también tienen las pruebas del rig del corte anterior; no se afirma una auditoría completa de accesibilidad o dispositivos.
- Un turno informativo con Meta real en `/demo`: respuesta de horario con fuente verificada, dos pasos del agente, **5153 ms** totales medidos por el servidor, 4398 tokens de entrada y 799 de salida reportados por el SDK. Sin propuestas ni escrituras de agenda. Es una sola muestra del modo local y no una medición del recorrido conectado o de producción; no se calcularon percentiles.
- `pnpm db:check`: semilla controlada y asignación probadas en una transacción local que se revierte; aislamiento, publicación, recuperación, doble clic y conflictos concurrentes entre sedes aprobados. Se corrigieron el `ends_at` obligatorio, las citas de fin de semana fuera de horario y la atomicidad de ambos scripts de semilla.
- Se aplicaron semilla y membresía en una sola transacción al Supabase exclusivo: una clínica/sede, dos profesionales, dos servicios, tres fuentes, tres citas ficticias y una membresía de secretaría. Las citas se comprobaron completas y futuras. No se modificó la migración inicial ni se crearon cuentas adicionales.
- React Doctor: ocho avisos existentes, ninguno en el shell/controles nuevos; cuatro recomendaciones de API Zod y cuatro avisos de complejidad/tamaño en DemoWorkspace/CopilotArea. No se silenciaron reglas.
- Evidencias locales en `work/qa-20261030`, ignoradas por Git. Se logró guardar capturas desde el navegador interactivo; la limitación previa de capturas headless no implica ausencia de estas evidencias.
- Pendiente: configurar la clave de escritura exclusivamente servidor y verificar reserva/reagendamiento/cancelación contra Supabase, persistencia al recargar y aislamiento con JWT de cuentas de prueba diferentes. No hubo despliegue ni merge a main. No se implementó voz bidireccional/WebRTC en este corte.

Historia probada: el usuario pide una operación administrativa por chat → API local → Meta Model API → herramientas tipadas → tarjeta pendiente → confirmación → escritura y actualización de la agenda ficticia.

## Evidencia obtenida

- Autenticación real: `GET https://api.meta.ai/v1/models` devolvió los modelos disponibles con la clave de la participante. La clave nunca se imprimió.
- Modelo real: Muse Spark 1.3 generó propuesta de reserva desde el navegador. Se confirmó con clic; el servidor devolvió estado `confirmed`.
- API real sobre datos ficticios: reserva para Marta Prueba, segunda confirmación idempotente (una auditoría), reagendamiento a las 12:00 y cancelación final. Tres eventos de auditoría, estado final `cancelled`.
- Otra sesión mantuvo solo sus tres citas de semilla; no recibió la cita creada en la primera sesión.
- Transcripción real: WAV generado por síntesis de Windows, enviado al endpoint Meta. Devolvió texto; hubo errores de reconocimiento en las primeras palabras. Es una prueba de integración, no certificación de exactitud ni de español/acento costarricense.
- Interfaz de escritorio revisada en Chrome; agenda, chat, fuentes, propuesta y confirmación visibles. Revisión móvil a 390 × 844: chat legible y panel lateral accesible; se corrigió su apertura inicial para conservar el chat visible.
- `pnpm test`: 25 pruebas aprobadas. Horarios, fechas, choques, sesiones, expiración, versiones, idempotencia, recuperación de fuentes, origen y tamaño de solicitudes.
- `pnpm lint`, `pnpm typecheck` y `pnpm build`: aprobados; incluye compilación de las cuatro rutas API.

## Límites de la evidencia

Supabase `lyphdzeazqnaepyzzisi` tiene configuración y conectividad a API Auth verificadas; la agenda aún no persiste allí y no hay aislamiento RLS probado. La persistencia usa archivos locales y mutex en un único proceso; no prueba concurrencia distribuida ni durabilidad de producción. No hay envío a WhatsApp, servidor MCP, API keys de consumidores, voz en vivo, embeddings ni streaming de tokens. No se ejecutaron migraciones, escrituras en otros proyectos ni deploy. El código de este corte se versiona en GitHub como primer avance.

Faltan evaluaciones adversariales de inyección y permisos, citas ambiguas, audio real en español, interrupciones, reintentos del proveedor, tasas de error, latencia p95 y presupuestos. La semilla incluye citas del día, incluso si la hora ya pasó, para demostrar la visualización; la validación de nuevas reservas rechaza pasado.

Los artefactos intermedios de pruebas están en `work/`, excluido de Git. No contienen expedientes reales.

## Avance de conexión Supabase

Identidad confirmada en Chrome (denta / dentacopilot). Clave publicable guardada solo en entorno local. Consulta real de API Auth aceptada. Nueve pruebas adicionales de configuración: 34 pruebas en total. La URL queda fijada al proyecto indicado. Ver docs/SUPABASE.md para límites y reproducibilidad.

## Avance de resultados verificables y evaluaciones

- `pnpm check`: lint, tipos, 61 pruebas offline en ocho archivos y build aprobados el 27 de octubre de 2026. El harness dedicado contiene 24 escenarios, incluidos cierres del proveedor por longitud, error y filtro.
- `pnpm eval:live`: 3/3 casos aprobados con Meta real, ejecutados por separado. Datos faltantes, reserva pendiente con parámetros esperados y horario con fuente recuperada. Cero citas nuevas y cero auditorías; estado ficticio en memoria.
- La suite offline ejercita el bucle del SDK, herramientas y endpoints; incluye referencias inválidas, fallos, límite de pasos, timeout, ID de otra sesión, inyección que intenta invocar una herramienta de escritura inexistente, conflicto/versión/vencimiento al confirmar, doble clic y audio a texto sin mutaciones.
- Este corte no repite QA visual ni transcripción real. La evidencia anterior de navegador y audio corresponde a la base previa. La cobertura nueva de audio simula el proveedor y comprueba el endpoint, sin probar el selector del navegador.
- Sin despliegue, cambios remotos en Supabase ni migraciones. El repositorio sigue en `main`; contrato inicial enviado como `16fe351`.

Ver [contrato, comandos, presupuesto y límites](EVALUACIONES.md). Las pruebas simuladas no miden la calidad lingüística del modelo ni RLS. Tres casos con Meta son una validación inicial de integración, no una evaluación general de robustez. Los IDs/versiones de fuentes verifican procedencia; no certifican cada afirmación del texto.

## Avance de micrófono a borrador

`pnpm check`: lint, tipos, **92 pruebas** en 13 archivos y build aprobados. React Doctor: cero errores y cuatro avisos previos; sin supresiones nuevas. Se probó la transcripción con Meta real de un WAV sintético ficticio de 4,335 s pasado por el codificador del dictado; HTTP 200, sin cambios en mensajes, propuestas, agenda ni auditoría.

En el navegador se comprobaron el botón, espera de permiso, cancelación y recuperación del campo. Los casos de captura satisfactoria, interrupción, reintento y respuestas tardías cuentan con pruebas simuladas. La validación con un micrófono físico, permiso concedido y voces/dispositivos del piloto sigue pendiente. Detalle, privacidad y pasos manuales en [DICTADO.md](DICTADO.md). No se desplegó ni se modificó Supabase.
