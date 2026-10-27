# Validación · 27 de octubre de 2026

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
