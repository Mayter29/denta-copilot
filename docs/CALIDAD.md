# Calidad y diagnóstico React

Las reglas del proyecto viven en [AGENTS.md](../AGENTS.md). Para una revisión o refactor significativo está disponible la skill local [denta-quality](../.agents/skills/denta-quality/SKILL.md), con redacción propia. Se consultaron skills públicas de React, composición y rendimiento. No se copiaron código de producto, conexiones ni documentos internos.

## Comandos reproducibles

```powershell
pnpm check
pnpm run doctor
```

`check` mantiene lint, tipos, tests y build. React Doctor es un diagnóstico adicional separado: no añade hooks, servicios, CI ni un umbral de puntuación. Se fija `react-doctor@0.9.18` como dependencia de desarrollo y el lockfile conserva su resolución. Revisar `pnpm exec react-doctor --help` antes de cambiar opciones o actualizar versión.

El comando desactiva telemetría/score remoto y el análisis de dependencias con Socket.dev. `doctor.config.json` excluye `work`, dependencias y salidas generadas, sin desactivar reglas ni excluir `src`. Los detalles del análisis quedan en `work/react-doctor`, ignorado por Git. No subir los informes crudos al repositorio.

La herramienta es análisis estático complementario; no prueba autorización, comportamiento del modelo, accesibilidad completa, seguridad general ni experiencia en navegador. Un análisis con avisos no equivale a código impecable. Revisar el impacto y la evidencia antes de corregir o suprimir.

## Diagnóstico inicial · 27 de octubre de 2026

Escaneo completo con la versión fijada: cero errores, siete avisos. No se desactivaron reglas para obtener ese resultado. La primera ejecución sin configuración también señaló un script de un taller externo en `work`; esa copia no forma parte del producto y por eso se excluye por ruta.

| Hallazgo                                              | Evaluación y siguiente paso                                                                                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tamaño y complejidad de `CopilotWorkspace` (2 avisos) | Deuda real de mantenibilidad. Al retomar cambios en esta UI, extraer primero compositor, mensajes o coordinación de sesión según la tarea, con contratos claros y validación del flujo. No dividir mecánicamente por cantidad de líneas. |
| API `.strict()` de Zod (3 avisos)                     | La versión instalada conserva ese método y la validación estricta está cubierta por pruebas. La recomendación `z.strictObject` puede adoptarse al tocar esos esquemas; el título del aviso no demuestra una rotura actual.               |
| Lectura de respuesta de transcripción (1 aviso)       | Se lee el cuerpo de error y luego se comprueba `response.ok` antes de usar el texto. Un HTTP fallido lanza error y no actualiza el borrador; el `catch` también captura un JSON inválido. No se confirmó el bug descrito por el aviso.   |
| Creación de `Intl.DateTimeFormat` (1 aviso)           | Asignación repetida real, sin impacto medido. Considerar reutilizar el formateador si se toca la utilidad o aparece un coste demostrable.                                                                                                |

Estos avisos previos permanecen visibles. No se usa una baseline para ocultarlos ni se amplía esta tarea documental a una refactorización de toda la aplicación. Las nuevas reglas guían los siguientes cambios y los problemas de seguridad/integridad introducidos por un cambio deben resolverse en ese mismo avance.

## Avance con el dictado de micrófono

Al implementar el dictado se extrajeron compositor, controles, ciclo de vida y acceso al dispositivo. El diagnóstico posterior conserva **cero errores y cuatro avisos** (tres recomendaciones de Zod y el formateador Intl). Desaparecieron los avisos de tamaño/complejidad del workspace y lectura HTTP de transcripción, sin silenciar reglas. La complejidad detectada durante el desarrollo del compositor nuevo también se resolvió separando controles y recuperación antes de cerrar el cambio.

`pnpm check` aprobó 92 pruebas en 13 archivos, lint, tipos y build. Se añadieron Testing Library y happy-dom como dependencias de desarrollo fijadas para probar interacción React y limpieza/cancelación, además de las pruebas del AudioWorklet y del controlador. Ver [evidencia y límites del dictado](DICTADO.md).
