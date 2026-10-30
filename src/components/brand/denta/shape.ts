/**
 * Piezas puras del rig de Denta: volumen y contorno del cuerpo, curvas de tiempo (parpadeo, giro,
 * lectura), luz y armado de trazados SVG.
 */
import { BODY_DEPTH, BODY_POINTS } from './geometry';

// Sección horizontal principal del cuerpo: elipse de medio ancho 107 y media profundidad 47.
// Los ojos viven sobre esa superficie, así de perfil no salen de la silueta.
export const HALF_W = 107;
export const EYE_DEPTH = 47;
// Luz fija en el mundo (izquierda y de frente), en el plano horizontal.
export const LIGHT = [-0.55, 0.835] as const;
export const SHADE_STOPS = 9;

// Centro, proporción y altura de cierre de la sección de cada punto de control: el manejador de
// salida usa su ancla de origen y el de llegada, su ancla de destino.
const count = BODY_POINTS.length / 2;
export const CTRL_C = new Float64Array(count);
export const CTRL_R = new Float64Array(count);
export const CTRL_CLOSE = new Float64Array(count).fill(NaN);
for (let j = 0; j < count; j++) {
  const [c, r, close = NaN] =
    BODY_DEPTH[j === 0 ? 0 : Math.floor((j - 1) / 3) + ((j - 1) % 3 === 0 ? 0 : 1)];
  CTRL_C[j] = c;
  CTRL_R[j] = r;
  CTRL_CLOSE[j] = close;
}

// Contorno del diente de frente, por columna (borde superior) y por fila (bordes laterales),
// para que los ojos nunca salgan de la silueta. Margen en unidades del viewBox.
export const EYE_MARGIN = 4;
export const TOP = new Float64Array(257).fill(Infinity);
export const LEFT = new Float64Array(257).fill(Infinity);
export const RIGHT = new Float64Array(257).fill(-Infinity);
export const BX: [number, number] = [Infinity, -Infinity];
export const BY: [number, number] = [45, 225];
for (let i = 2; i < BODY_POINTS.length; i += 6) {
  const p = BODY_POINTS;
  for (let k = 0; k <= 200; k++) {
    const t = k / 200;
    const u = 1 - t;
    const x =
      u * u * u * p[i - 2] + 3 * u * u * t * p[i] + 3 * u * t * t * p[i + 2] + t * t * t * p[i + 4];
    const y =
      u * u * u * p[i - 1] +
      3 * u * u * t * p[i + 1] +
      3 * u * t * t * p[i + 3] +
      t * t * t * p[i + 5];
    const col = Math.round(x);
    const row = Math.round(y);
    TOP[col] = Math.min(TOP[col], y);
    LEFT[row] = Math.min(LEFT[row], x);
    RIGHT[row] = Math.max(RIGHT[row], x);
    BX[0] = Math.min(BX[0], Math.ceil(x));
    BX[1] = Math.max(BX[1], Math.floor(x));
  }
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLINK = [0.06, 0.03, 0.11] as const;
export const BLINK_TOTAL = BLINK[0] + BLINK[1] + BLINK[2];
export function blinkAmount(t: number) {
  const [close, hold, open] = BLINK;
  if (t < 0) return 0;
  if (t < close) return (t / close) ** 2;
  if (t < close + hold) return 1;
  const k = Math.min(1, (t - close - hold) / open);
  return 1 - k * k * (3 - 2 * k);
}

export const SPIN = [0.14, 1.15] as const;
/**
 * Ángulo del giro de 360°: preparación hacia atrás y vuelta completa. Curva cuadrática (no cúbica)
 * para que los ángulos intermedios, los que muestran el volumen, duren más en pantalla.
 */
export function spinAngle(t: number) {
  const [prep, turn] = SPIN;
  if (t < prep) return -0.25 * Math.sin(((t / prep) * Math.PI) / 2);
  const k = Math.min(1, (t - prep) / turn);
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  return -0.25 + (Math.PI * 2 + 0.25) * e;
}

// Lectura (transcribiendo): recorre cada renglón palabra por palabra y vuelve al inicio.
// Pausado a propósito: renglones lentos y saltos suaves; más rápido se lee como un tic.
export const LINE = 1.6;
const WORDS = 4;
export function readingGaze(t: number): [number, number] {
  const line = Math.floor(t / LINE);
  const k = (t % LINE) / LINE;
  const y = -0.05 + 0.14 * (line % 3);
  if (k > 0.8) {
    const r = (k - 0.8) / 0.2;
    return [0.7 - 1.4 * r * r * (3 - 2 * r), y];
  }
  const w = (k / 0.8) * WORDS;
  const i = Math.floor(w);
  return [-0.7 + (1.4 * (i + Math.min(1, (w - i) * 2.2))) / WORDS, y];
}

/** Opacidad de una parada de sombreado: blanco donde la luz pega fuerte, oscuro donde no llega. */
export function shadeOpacity(lam: number, strength: number) {
  return (
    (lam >= 0.7 ? Math.min(0.16, (lam - 0.7) * 0.7) : Math.min(0.42, (0.7 - lam) * 0.65)) * strength
  );
}

/** Intensidad de la luz: suave en reposo, apenas más al girar. Bajo 64 px solo aparece al girar. */
export function lightStrength(size: number, turn: number) {
  const turning = Math.abs(Math.sin(turn));
  return size >= 64 ? 0.5 + 0.2 * turning : 0.7 * turning;
}

// Una décima de unidad (0,06 px a 160 px). Redondear y concatenar números es varias veces más
// rápido que toFixed, y armar los trazados es la mayor parte del costo por cuadro.
const f = (v: number) => Math.round(v * 10) / 10;

export function bodyPath(a: Float64Array) {
  let d = 'M' + f(a[0]) + ' ' + f(a[1]);
  for (let i = 2; i < a.length; i += 6) {
    d +=
      'C' +
      f(a[i]) +
      ' ' +
      f(a[i + 1]) +
      ' ' +
      f(a[i + 2]) +
      ' ' +
      f(a[i + 3]) +
      ' ' +
      f(a[i + 4]) +
      ' ' +
      f(a[i + 5]);
  }
  return d + 'Z';
}

/** Anillo cerrado → curva suave (Catmull-Rom uniforme convertida a cúbicas). */
export function ringPath(a: Float64Array) {
  const len = a.length;
  let d = 'M' + f(a[0]) + ' ' + f(a[1]);
  for (let i = 0; i < len; i += 2) {
    const i0 = (i - 2 + len) % len;
    const i2 = (i + 2) % len;
    const i3 = (i + 4) % len;
    d +=
      'C' +
      f(a[i] + (a[i2] - a[i0]) / 6) +
      ' ' +
      f(a[i + 1] + (a[i2 + 1] - a[i0 + 1]) / 6) +
      ' ' +
      f(a[i2] - (a[i3] - a[i]) / 6) +
      ' ' +
      f(a[i2 + 1] - (a[i3 + 1] - a[i + 1]) / 6) +
      ' ' +
      f(a[i2]) +
      ' ' +
      f(a[i2 + 1]);
  }
  return d + 'Z';
}
