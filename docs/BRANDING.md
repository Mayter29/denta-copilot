# Dentary y Denta · revisión de reutilización

Fecha: 27 de octubre de 2026. Estado: activos recuperados y propuesta visible en `/brand-review`. La pantalla principal no cambia todavía.

## Hallazgos

Los vectores de Dentary sí están guardados en Git. El remoto usa `master`, no `main`. Después de actualizar las referencias, se encontraron en `origin/master:public/dentary/`. El commit que introdujo los vectores es `840b4fb7b65e9e5e22fa67b304534af410c1f581` del 10 de octubre. La referencia remota revisada fue `6462647bbdaab6c0e4e251fb9f1ff30e3ec42867`.

La carpeta local de Odontoser estaba en `codex/dentary-ai-v1`; allí todavía no aparecen los SVG de Dentary, aunque sí los PNG y los SVG de Odontoser. No se cambió de rama ni se modificaron sus archivos de trabajo. También hay una copia del paquete de logos en `C:\Users\mayte\Downloads\dentary\dentary-logo`.

La mascota correcta fue confirmada por el usuario: `C:\Users\mayte\Downloads\denta-v1\denta-v1\v2`. No se encontró integrada en el árbol local ni en `origin/master` de Odontoser. El paquete trae 47 SVG y un componente React `DentaMascot.tsx`, además del generador y una lámina HTML.

## Qué se recuperó en este repositorio

| Destino                                             | Origen                                              | Uso                                                             |
| --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `public/brand/dentary/dentary-icon.svg`             | `origin/master:public/dentary/dentary-icon.svg`     | Símbolo de la marca                                             |
| `public/brand/dentary/dentary-horizontal-light.svg` | Mismo path bajo `public/dentary` en `origin/master` | Wordmark sobre fondo claro                                      |
| `public/brand/dentary/dentary-horizontal-dark.svg`  | Mismo path bajo `public/dentary` en `origin/master` | Wordmark sobre fondo oscuro                                     |
| `public/brand/denta/denta-*.svg`                    | `v2/svg` del paquete confirmado                     | Seis expresiones originales, archivos conservados sin modificar |
| `src/components/brand/DentaMascot.tsx`              | `v2/DentaMascot.tsx` del paquete confirmado         | Componente adaptado a los tokens y CSS Modules de este proyecto |

Se conservó la geometría V2, sus poses y trazos reforzados para tamaños menores a 40 px. Se extrajeron las animaciones a CSS Modules, se sustituyeron las clases Tailwind del proyecto anterior por `--accent` y se mantuvo `prefers-reduced-motion`. Los dibujos decorativos se ocultan de lectores de pantalla; el mensaje contiguo comunica el estado.

Los nueve SVG recuperados se analizaron como XML y no contienen scripts, `foreignObject`, handlers ni referencias externas. Esto es una inspección de estos archivos, no una garantía universal sobre SVG.

## Recomendación de producto

Usar **Dentary como marca madre**, **Denta Copilot como nombre de esta experiencia** y **Denta como cara del agente**. El isotipo identifica la aplicación; la mascota identifica a quien conversa. Mantener el wordmark completo para lugares con espacio y buena legibilidad.

Ubicaciones sugeridas: avatar de la cabecera, avatar de mensajes y bienvenida. Estados principales: neutral al estar disponible, pensando al consultar herramientas y feliz tras un cambio confirmado por el servidor. Un conflicto puede usar sorprendida junto a un mensaje claro; no convertir cancelaciones o rechazos en gestos de culpa o tristeza. Guiño y triste quedan disponibles en la revisión, sin asignarles un comportamiento automático.

La animación debe ser discreta: transición de pose y parpadeo ocasional. Sin personaje flotante que tape agenda, sin saltos continuos y sin sustituir los estados de carga, error o confirmación.

## Qué permite revisar `/brand-review`

Vista contextual del chat con los activos originales, cuatro estados seleccionables, seis expresiones a distintos tamaños y logos sobre fondos claro/oscuro. Los mensajes y la tarjeta son ejemplos estáticos; los botones solo cambian la expresión y su texto. No ejecuta herramientas, solicitudes al modelo ni escrituras de agenda.

Se registran como activos preexistentes del usuario para distinguirlos de la funcionalidad nueva del hackathon. La integración definitiva en la pantalla principal es el siguiente cambio, una vez elegida esta dirección visual.
