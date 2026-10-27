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
