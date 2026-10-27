# Dentary y Denta · revisión de reutilización

Fecha: 27 de octubre de 2026. Estado: identidad integrada en la pantalla principal; `/brand-review` conserva la lámina de revisión.

## Hallazgos

Los vectores de Dentary y las seis expresiones de la mascota Denta están en este repositorio, en `public/brand`. Son activos previos de su autoría, no dibujos nuevos del hackathon. No se documentan rutas de otras máquinas ni ramas de otros proyectos.

## Qué se recuperó en este repositorio

| Destino                                             | Origen                      | Uso                                                             |
| --------------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| `public/brand/dentary/dentary-icon.svg`             | Paquete de marca Dentary    | Símbolo de la marca                                             |
| `public/brand/dentary/dentary-horizontal-light.svg` | Mismo paquete               | Wordmark sobre fondo claro                                      |
| `public/brand/dentary/dentary-horizontal-dark.svg`  | Mismo paquete               | Wordmark sobre fondo oscuro                                     |
| `public/brand/denta/denta-*.svg`                    | Paquete de la mascota Denta | Seis expresiones originales, archivos conservados sin modificar |
| `src/components/brand/DentaMascot.tsx`              | Componente de ese paquete   | Adaptado a los tokens y CSS Modules de este proyecto            |

Se conservó la geometría V2, sus poses y trazos reforzados para tamaños menores a 40 px. Se extrajeron las animaciones a CSS Modules, se sustituyeron las clases Tailwind del proyecto anterior por `--accent` y se mantuvo `prefers-reduced-motion`. Los dibujos decorativos se ocultan de lectores de pantalla; el mensaje contiguo comunica el estado.

Los nueve SVG recuperados se analizaron como XML y no contienen scripts, `foreignObject`, handlers ni referencias externas. Esto es una inspección de estos archivos, no una garantía universal sobre SVG.

## Recomendación de producto

Usar **Dentary como marca madre** y **Denta como nombre único de la asistente**. El isotipo identifica la aplicación; la mascota identifica a quien conversa. Mantener el wordmark completo para lugares con espacio y buena legibilidad.

Ubicaciones sugeridas: avatar de la cabecera, avatar de mensajes y bienvenida. Estados principales: neutral al estar disponible, pensando al consultar herramientas y feliz tras un cambio confirmado por el servidor. Un conflicto puede usar sorprendida junto a un mensaje claro; no convertir cancelaciones o rechazos en gestos de culpa o tristeza. Guiño y triste quedan disponibles en la revisión, sin asignarles un comportamiento automático.

La animación debe ser discreta: transición de pose y parpadeo ocasional. Sin personaje flotante que tape agenda, sin saltos continuos y sin sustituir los estados de carga, error o confirmación.

## Qué permite revisar `/brand-review`

Vista contextual del chat con los activos originales, cuatro estados seleccionables, seis expresiones a distintos tamaños y logos sobre fondos claro/oscuro. Los mensajes y la tarjeta son ejemplos estáticos; los botones solo cambian la expresión y su texto. No ejecuta herramientas, solicitudes al modelo ni escrituras de agenda.

Se registran como activos preexistentes del usuario para distinguirlos de la funcionalidad nueva del hackathon.

## Integración en la aplicación

El wordmark de Dentary identifica la barra lateral amplia, sobre fondo oscuro con la variante clara del logo. En la barra lateral compacta se muestra el isotipo. La cabecera muestra el isotipo y «Denta · Reception desk». `DentaryBrand` concentra estas variantes y sus estilos, sin duplicar los vectores.

El isotipo también se configura como favicon SVG y el título de la pestaña es «Denta · Dentary». Denta reemplaza el avatar genérico de la cabecera y de los mensajes de la asistente. La cabecera usa neutral y pensando según el estado ocupado existente; no interpreta el texto del modelo para mostrar éxito ni cambia el flujo de confirmación.

Denta se presenta sin recuadro, fondo ni borde, tanto en cabecera como en mensajes. La cabecera de 48 px incorpora respiración, miradas y parpadeo sutiles, y un balanceo suave al consultar. Tocar la mascota permite pausar/reanudar; su estado vive en `DentaAvatar`, separado de la coordinación del chat. Los mensajes históricos permanecen estáticos. Todas las animaciones están limitadas a `prefers-reduced-motion: no-preference`. La geometría original de la mascota se conserva.

Verificado en navegador: logos cargados desde los SVG existentes, cabecera/avatar/mensajes y variantes de escritorio/móvil. No se modifica la geometría ni se generan logos nuevos. La vista de revisión sigue siendo un ejemplo estático, independiente de la agenda.
