# Referencias y contribuciones

Este registro distingue antecedentes de trabajo creado el 27 de octubre de 2026. No convierte automáticamente código privado en material autorizado para una entrega pública.

| Fuente revisada                        | Qué aporta                                              | Qué se incorporó                                                                                     |
| -------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Marca Dentary ya presente en este repo | Paleta turquesa, superficies, texto y bordes semánticos | Valores de paleta adaptados en un CSS nuevo. No se copió un dashboard ni sus pantallas               |
| Práctica habitual de agendas           | Decisión del servidor, horarios, duración y choques     | Reglas nuevas simplificadas para una demo de dos profesionales. No dependen de una base clínica real |
| Patrón de confirmación humana          | Tarjeta generada por el servidor y audio a borrador     | Implementación nueva. No se copiaron componentes, mascotas ni prompts de otros productos             |
| Separación de herramientas y permisos  | Lectura, propuesta y confirmación en pasos distintos    | Referencia conceptual. No se copiaron código, prompts, configuración ni documentos internos          |
| Reglas oficiales del hackathon         | Trabajo nuevo identificable y demo verificable          | Alcance orientado a operaciones administrativas                                                      |

## Trabajo nuevo de este proyecto

El repositorio público `meta-models/legal-agent-workshop` se revisó en el commit `2a8efc86c70d9a42d76db0afb6ae1511e5a86d8e` como referencia de verificación, progreso y evaluaciones. No se importó su código Python ni se ejecutó el taller. La adaptación propuesta y sus límites están en [AGENT-PATTERNS.md](AGENT-PATTERNS.md).

Scaffolding, interfaz de Denta Copilot, semilla ficticia, dominio de agenda, validación de horarios, propuestas, confirmación, auditoría, persistencia por sesión local, integración directa de Meta mediante AI SDK, recuperación léxica de fuentes ficticias, transcripción de WAV y pruebas. Todo creado para este repositorio durante el evento.

## Límites de la reutilización

Compositor actualizado: se escribió CSS y JSX propios con la paleta Dentary y los iconos Lucide ya instalados. Se conserva audio WAV a borrador, sin añadir voz en vivo. No se incorporaron código ni activos de otros productos.

Dictado desde micrófono: controlador Web Audio, AudioWorklet, codificador PCM, hook de ciclo de vida y compositor extraído son implementaciones nuevas de este repositorio. Se reutiliza su endpoint WAV. No se añaden conexiones externas de otros proyectos.

Actualización de marca: los SVG originales de Dentary y la mascota Denta V2 del paquete confirmado por el usuario están en `public/brand` y en `/brand-review`; son activos preexistentes de su autoría. Ya se integran en la aplicación principal: logo/isotipo Dentary, favicon y avatar Denta en cabecera y mensajes. Ver [inventario e integración](BRANDING.md).

No se importaron datos reales de pacientes, empleados, clínicas, contactos o agendas. No se copiaron `.env`, secretos, credenciales ni conexiones de otros proyectos. El único secreto de proveedor configurado es la clave Meta indicada por la participante en `.env.local`, excluida de Git.

La marca Dentary y la mascota Denta son activos previos de su autoría, ya guardados en este repositorio, y deben declararse en la entrega. La licencia de las dependencias de terceros sigue aplicando. No se asigna una licencia pública a código que no está en este repositorio.

Antes de la entrega: verificar visibilidad pública, aportes del equipo, licencias/avisos de dependencias y correspondencia exacta entre video y capacidades nuevas.
