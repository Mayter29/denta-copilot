---
name: denta-quality
description: Revisar calidad, composición React y fronteras de arquitectura de Denta Copilot al diseñar una capacidad, refactorizar o investigar mantenibilidad/rendimiento. Aplicar controles proporcionales; no activar una auditoría global por un cambio trivial de texto o CSS.
---

# Calidad de Denta Copilot

Usar [AGENTS.md](../../../AGENTS.md) como contrato del proyecto. Esta skill ayuda a decidir qué revisar; no añade permisos de publicación, migración ni acceso a otros proyectos.

## Revisar el cambio concreto

Leer el diff, sus consumidores y las pruebas relacionadas. Identificar el comportamiento solicitado y qué debe conservarse. Trabajar solo en ese recorrido; registrar deuda ajena sin ampliar la tarea.

Comprobar estas fronteras cuando el cambio las toca:

- Dominio: reglas puras y contratos, independientes de React, Next, proveedor y persistencia. El reloj y otras entradas variables se pueden controlar en pruebas.
- Servidor: credenciales, sesión, proveedor y almacenamiento detrás de contratos claros. Adaptadores hacia el dominio; nada de secretos en imports del cliente.
- Endpoint: valida datos no confiables y permisos antes de actuar. No implementa una segunda versión de la regla de negocio.
- UI: muestra datos del servidor y recoge decisiones. El modelo solo lee/propone; las escrituras conservan el endpoint y clic humano. Un refactor no modifica esa frontera.

Mantener la estructura existente. Crear servicios, interfaces, contextos, hooks o carpetas solo para resolver una dependencia o responsabilidad concreta, sin imponer una arquitectura de capas ceremonial.

## Composición React

- Si un componente mezcla varios flujos o concentra ramas/estado no relacionados, extraer una unidad funcional coherente. Preferir props y composición simple; contextos y componentes compuestos solo si simplifican consumidores reales.
- Mantener estado cerca de quien lo usa, evitar copias de datos derivados y comprobar cierres obsoletos, dependencias, limpieza y carreras de efectos.
- Conservar carga/error/vacío, foco, teclado y controles deshabilitados. Probar el flujo después de extraer, no solo que el componente renderiza.
- No añadir memoización o lazy loading por defecto. Medir el coste que se quiere reducir y verificar que la optimización mantiene el comportamiento.
- Revisar Next/SDK contra las versiones instaladas; no importar recomendaciones de otra versión ni migrar APIs válidas solo por estilo.

## Diagnóstico y decisión

Para componentes/hooks, ejecutar `pnpm react:doctor`; en una refactorización amplia, guardar diagnóstico antes y después. Comando y versión viven en `package.json`, no instalar otra copia con `@latest` ni usar el instalador de hooks/CI automáticamente.

Leer el código señalado antes de actuar y distinguir:

- Problema real introducido o agravado por el cambio: corregirlo y validar el comportamiento.
- Deuda previa relevante: proponer una extracción o arreglo pequeño si ayuda a la tarea; si no, registrar ubicación, impacto y siguiente paso.
- Falso positivo o preferencia: explicar la evidencia. No desactivar reglas globales ni generar excepciones para mejorar la puntuación.

No confundir aviso con fallo, análisis parcial con revisión completa, o código de referencia local con producto. La configuración excluye solo artefactos y copias externas; no oculta código de `src`. Los informes se guardan en `work`, fuera de Git. Si la herramienta falla, reportar el fallo y continuar las comprobaciones independientes; no presentar ese diagnóstico como aprobado.

Aplicar las verificaciones proporcionales de AGENTS.md y detenerse cuando exista evidencia suficiente. No repetir suites ni llamadas al proveedor si no hubo cambios o incertidumbre nueva. Cerrar con cambios, pruebas, hallazgos pendientes y estado local/GitHub/desplegado.

## Procedencia

Redacción propia para este repositorio. Se consultaron conceptualmente las skills `react-best-practices`, `composition-patterns` y `performance-optimization` disponibles en Odontoser. No se trasladaron documentos privados, código de producto ni conexiones. Referencias públicas para profundizar cuando haga falta: [React](https://react.dev/learn), [patrones Vercel](https://github.com/vercel-labs/agent-skills) y [React Doctor](https://github.com/millionco/react-doctor).
