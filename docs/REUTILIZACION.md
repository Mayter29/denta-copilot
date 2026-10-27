# Referencias y contribuciones

Este registro distingue antecedentes de trabajo creado el 27 de octubre de 2026. No convierte automáticamente código privado en material autorizado para una entrega pública.

| Fuente revisada                                                       | Qué aporta                                                       | Qué se incorporó                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Dentary/Odontoser: `DESIGN.md` y `src/app/globals.css`                | Paleta turquesa, superficies, texto y bordes semánticos          | Valores de paleta adaptados en un CSS nuevo. No se copió el dashboard ni sus pantallas                                             |
| Dentary: `src/lib/appointments/slotEvaluation.ts` y `availability.ts` | Decisión del servidor, horarios, duración y choques              | Reglas nuevas simplificadas para una demo de dos profesionales; no se copió lógica dependiente de la BD real                       |
| EVA/ECP: `ProposalCard.tsx`, ADR-0073                                 | Tarjetas controladas por servidor y audio que vuelve al borrador | Implementación nueva del patrón de confirmación. No se copiaron código, mascota, componentes HeroUI ni prompts corporativos        |
| Istmo Insight: README de la rama development y lista de ramas         | Separación de gateway, memoria, contexto, herramientas y scopes  | Referencia conceptual. No se copiaron código, prompts, configuración, documentos internos ni activos. El README indica uso interno |
| Reglas oficiales del hackathon                                        | Trabajo nuevo identificable y demo verificable                   | Alcance orientado a operaciones administrativas                                                                                    |

## Trabajo nuevo de este proyecto

El repositorio público `meta-models/legal-agent-workshop` se revisó en el commit `2a8efc86c70d9a42d76db0afb6ae1511e5a86d8e` como referencia de verificación, progreso y evaluaciones. No se importó su código Python ni se ejecutó el taller. La adaptación propuesta y sus límites están en [AGENT-PATTERNS.md](AGENT-PATTERNS.md).

Scaffolding, interfaz de Denta Copilot, semilla ficticia, dominio de agenda, validación de horarios, propuestas, confirmación, auditoría, persistencia por sesión local, integración directa de Meta mediante AI SDK, recuperación léxica de fuentes ficticias, transcripción de WAV y pruebas. Todo creado para este repositorio durante el evento.

## Límites de la reutilización

Compositor actualizado: se tomó la captura aportada por la usuaria y se consultó el patrón visual de la barra de EVA como referencia. Se escribió CSS/JSX propio con la paleta Dentary y los iconos Lucide ya instalados. No se incorporaron código ni activos de EVA; se conserva audio WAV a borrador, sin añadir voz en vivo.

Actualización de marca: se recuperaron los SVG originales de Dentary y la mascota Denta V2 del paquete confirmado por el usuario. Están preparados en `public/brand` y en la vista `/brand-review`; son activos preexistentes de su autoría. Ver [inventario y recomendación](BRANDING.md). La interfaz principal conserva su identidad actual.

No se importaron datos reales de pacientes, empleados, clínicas, contactos o agendas. No se copiaron `.env`, secretos, credenciales ni conexiones de otros proyectos. El único secreto de proveedor configurado es la clave Meta indicada por la participante en `.env.local`, excluida de Git.

Dentary es la referencia de producto y diseño indicada por la participante; su diseño preexistente debe declararse en la entrega y comprobarse frente a las reglas del evento. Las referencias de EVA e Istmo se mantienen conceptuales porque son proyectos privados. La licencia de las dependencias de terceros sigue aplicando; no se asigna una licencia pública a código corporativo.

Antes de la entrega: verificar visibilidad pública, aportes del equipo, licencias/avisos de dependencias y correspondencia exacta entre video y capacidades nuevas.
