/**
 * Geometría de Denta v2 (build.mjs del paquete de diseño), convertida a contornos interpolables.
 *
 * Cada ojo se vuelve un anillo de 2K puntos: K por arriba (izquierda → derecha) y K por abajo
 * (derecha → izquierda), partido en sus extremos horizontales. Así cualquier expresión se
 * transforma en otra punto a punto y la mitad superior siempre corresponde con la superior:
 * el ojo neutral «sube» su borde inferior hasta volverse el arco de feliz.
 */
export type DentaMood = 'neutral' | 'feliz' | 'guino' | 'sorprendido' | 'pensando' | 'triste';
type Point = [number, number];
type Eye =
  | { t: 'rect'; x: number; y: number; w: number; h: number }
  | { t: 'arc'; d: string; sw: number }
  | { t: 'blob'; d: string; sw: number };

export const EYE_COLOR = '#0B1220';
export const BODY_D =
  'M128 76C146.5 76 161 44 191.9 44C228.9 44 241.3 80 235.1 120C231 150 218.6 172 208.3 196C200.1 216 183.6 226 169.2 222C152.7 218 146.5 202 128 202C109.5 202 103.3 218 86.8 222C72.4 226 55.9 216 47.7 196C37.4 172 25 150 20.9 120C14.7 80 27.1 44 64.1 44C95 44 109.5 76 128 76Z';
/** Punto inicial + 10 cúbicas, plano: [x0, y0, c1x, c1y, c2x, c2y, x, y, …]. */
export const BODY_POINTS = nums(BODY_D);

/**
 * Volumen del cuerpo para girarlo: cada ancla del contorno es el borde de una sección horizontal
 * elíptica de centro `c` (relativo a x = 128) y proporción profundidad/ancho `r`. Las cúspides y las
 * raíces son redondas (r = 1); el cuerpo tiene 47 de profundidad. De perfil las dos cúspides se
 * superponen en una, igual que las raíces. El tercer valor es la altura a la que se cierra ese rasgo
 * de perfil (la muesca sube a las cúspides, el hueco de raíces baja a las raíces; si no, se abre un
 * agujero). Orden: muesca, cúspide der., borde der., flanco der., raíz der., hueco de raíces,
 * raíz izq., flanco izq., borde izq., cúspide izq., muesca.
 */
export const BODY_DEPTH: readonly (readonly [number, number, number?])[] = [
  [0, 0.45, 50],
  [63.9, 1],
  [0, 0.44],
  [0, 0.585],
  [41.2, 1],
  [0, 0.61, 218],
  [-41.2, 1],
  [0, 0.585],
  [0, 0.44],
  [-63.9, 1],
  [0, 0.45, 50],
];

const rect = (x: number, y: number, w: number, h: number): Eye => ({ t: 'rect', x, y, w, h });
const arc = (d: string, sw: number): Eye => ({ t: 'arc', d, sw });
const blob = (d: string): Eye => ({ t: 'blob', d, sw: 4 });

/** Ojos en el marco del grupo (antes del giro de la expresión). `r` ≥ 40 px, `s` para menos. */
export const MOODS: Record<DentaMood, { tilt: number; sy: number; r: [Eye, Eye]; s: [Eye, Eye] }> =
  {
    neutral: {
      tilt: 0,
      sy: 1,
      r: [rect(101, 84, 26, 52), rect(141, 84, 26, 52)],
      s: [rect(96.4, 81.9, 31.2, 56.2), rect(140.4, 81.9, 31.2, 56.2)],
    },
    feliz: {
      tilt: -5,
      sy: 1,
      r: [
        arc('M103 118C105.2 86.6 122.7 86.6 124.9 118', 13),
        arc('M143.1 118C145.3 86.6 162.7 86.6 164.9 118', 13),
      ],
      s: [
        arc('M98.9 118C101.5 84.7 122.5 84.7 125.1 118', 15.6),
        arc('M142.9 118C145.5 84.7 166.5 84.7 169.1 118', 15.6),
      ],
    },
    guino: {
      tilt: 0,
      sy: 1,
      r: [rect(101, 84, 26, 52), arc('M143.1 118C145.3 86.6 162.7 86.6 164.9 118', 13)],
      s: [rect(96.4, 81.9, 31.2, 56.2), arc('M142.9 118C145.5 84.7 166.5 84.7 169.1 118', 15.6)],
    },
    sorprendido: {
      tilt: 0,
      sy: 1.05,
      r: [rect(87.5, 81.6, 35.9, 50.2), rect(144.7, 81.6, 35.9, 50.2)],
      s: [rect(81.7, 76.6, 43.1, 60.3), rect(143.3, 76.6, 43.1, 60.3)],
    },
    pensando: {
      tilt: 8,
      sy: 1,
      r: [rect(118.6, 74.2, 20.8, 41.6), rect(158.6, 74.2, 20.8, 41.6)],
      s: [rect(114.6, 72.6, 25, 44.9), rect(158.5, 72.5, 25, 44.9)],
    },
    triste: {
      tilt: 0,
      sy: 0.93,
      r: [
        blob('M123 108.7L123 141.4A13 13 0 0 1 97 141.4L97 119.7Z'),
        blob('M145 108.7L145 141.4A13 13 0 0 0 171 141.4L171 119.7Z'),
      ],
      s: [
        blob('M123.6 112.7L123.6 140.9A15.6 15.6 0 0 1 92.4 140.9L92.4 125.9Z'),
        blob('M144.4 112.7L144.4 140.9A15.6 15.6 0 0 0 175.6 140.9L175.6 125.9Z'),
      ],
    },
  };

function nums(d: string): number[] {
  return (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
}

function densify(pts: Point[], step = 0.5): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

// Rect con rx = w/2 (todos los ojos de Denta): cápsula vertical.
function pillOutline(x: number, y: number, w: number, h: number): Point[] {
  const r = w / 2;
  const cx = x + r;
  const out: Point[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI + (Math.PI * i) / 48;
    out.push([cx + r * Math.cos(a), y + r + r * Math.sin(a)]);
  }
  for (let i = 0; i <= 48; i++) {
    const a = (Math.PI * i) / 48;
    out.push([cx + r * Math.cos(a), y + h - r + r * Math.sin(a)]);
  }
  return out;
}

function segmentHit(p: Point, q: Point, r: Point, s: Point): Point | null {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t > 0 && t < 1 && u > 0 && u < 1
    ? [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
    : null;
}

// El lado interno del arco de feliz se cruza consigo mismo (radio de curvatura < medio trazo):
// el trazo SVG lo tapa, así que el contorno real recorta ese lazo.
function trimLoops(line: Point[]): Point[] {
  for (let i = 0; i < line.length - 3; i++) {
    for (let j = line.length - 2; j > i + 1; j--) {
      const hit = segmentHit(line[i], line[i + 1], line[j], line[j + 1]);
      if (hit) {
        line.splice(i + 1, j - i, hit);
        break;
      }
    }
  }
  return line;
}

// Contorno de un trazo cúbico con extremos redondeados (stroke-linecap: round).
function arcOutline(d: string, sw: number): Point[] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = nums(d);
  const h = sw / 2;
  const at = (t: number): Point => {
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ];
  };
  const tangent = (t: number): Point => {
    const u = 1 - t;
    const dx = 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2);
    const dy = 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2);
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= 120; i++) {
    const [px, py] = at(i / 120);
    const [tx, ty] = tangent(i / 120);
    left.push([px - ty * h, py + tx * h]);
    right.push([px + ty * h, py - tx * h]);
  }
  trimLoops(left);
  trimLoops(right);
  const cap = (c: Point, a: Point, b: Point): Point[] => {
    const pts: Point[] = [];
    for (let k = 1; k < 24; k++) {
      const th = (Math.PI * k) / 24;
      pts.push([
        c[0] + h * (a[0] * Math.cos(th) + b[0] * Math.sin(th)),
        c[1] + h * (a[1] * Math.cos(th) + b[1] * Math.sin(th)),
      ]);
    }
    return pts;
  };
  const t1 = tangent(1);
  const t0 = tangent(0);
  return [
    ...left,
    ...cap(at(1), [-t1[1], t1[0]], t1),
    ...right.reverse(),
    ...cap(at(0), [t0[1], -t0[0]], [-t0[0], -t0[1]]),
  ];
}

// Polígono convexo agrandado h con uniones redondas (stroke-linejoin: round).
function offsetConvex(pts: Point[], h: number): Point[] {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    area += ax * by - bx * ay;
  }
  const sign = area > 0 ? 1 : -1;
  const n = pts.length;
  const normalAngle = (a: Point, b: Point) =>
    Math.atan2(-sign * (b[0] - a[0]), sign * (b[1] - a[1]));
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a1 = normalAngle(pts[(i - 1 + n) % n], p);
    let da = normalAngle(p, pts[(i + 1) % n]) - a1;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(1, Math.ceil(Math.abs(da) / 0.12));
    for (let k = 0; k < steps; k++) {
      const a = a1 + (da * k) / steps;
      out.push([p[0] + h * Math.cos(a), p[1] + h * Math.sin(a)]);
    }
  }
  return out;
}

// Ojo triste: media cápsula con tapa inclinada, rellena y con trazo de 4.
function blobOutline(d: string, sw: number): Point[] {
  const v = nums(d);
  const [ax, ay, bx, by, r] = v;
  const [cx, cy, ex, ey] = [v[9], v[10], v[11], v[12]];
  const mx = (bx + cx) / 2;
  const my = (by + cy) / 2;
  const a0 = Math.atan2(by - my, bx - mx);
  const dir = v[8] ? 1 : -1;
  const pts: Point[] = [
    [ax, ay],
    [bx, by],
  ];
  for (let k = 1; k < 48; k++) {
    const a = a0 + (dir * Math.PI * k) / 48;
    pts.push([mx + r * Math.cos(a), my + r * Math.sin(a)]);
  }
  pts.push([cx, cy], [ex, ey]);
  return offsetConvex(densify(pts), sw / 2);
}

/** Contorno denso y cerrado de un ojo, tal como lo pinta el SVG de v2. */
export function outline(eye: Eye): Point[] {
  if (eye.t === 'rect') return densify(pillOutline(eye.x, eye.y, eye.w, eye.h));
  if (eye.t === 'arc') return densify(arcOutline(eye.d, eye.sw));
  return densify(blobOutline(eye.d, eye.sw));
}

function resample(chain: Point[], K: number): Point[] {
  const acc = [0];
  for (let i = 1; i < chain.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]));
  }
  const total = acc[acc.length - 1];
  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k <= K; k++) {
    const target = (total * k) / K;
    while (j < chain.length - 1 && acc[j] < target) j++;
    const span = acc[j] - acc[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - acc[j - 1]) / span));
    out.push([
      chain[j - 1][0] + (chain[j][0] - chain[j - 1][0]) * f,
      chain[j - 1][1] + (chain[j][1] - chain[j - 1][1]) * f,
    ]);
  }
  return out;
}

/** Contorno → anillo canónico de 2K puntos (Float64Array plano). */
export function toRing(poly: Point[], K = 20): Float64Array {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x] of poly) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  const extreme = (target: number) => {
    const run = poly.map((p, i) => [p, i] as const).filter(([p]) => Math.abs(p[0] - target) < 0.05);
    const my = run.reduce((s, [p]) => s + p[1], 0) / run.length;
    return run.reduce((best, cur) =>
      Math.abs(cur[0][1] - my) < Math.abs(best[0][1] - my) ? cur : best,
    )[1];
  };
  const n = poly.length;
  const chain = (a: number, b: number) => {
    const out: Point[] = [];
    for (let i = a; ; i = (i + 1) % n) {
      out.push(poly[i]);
      if (i === b) return out;
    }
  };
  const iL = extreme(minX);
  const iR = extreme(maxX);
  let top = chain(iL, iR);
  let bottom = chain(iR, iL);
  const meanY = (c: Point[]) => c.reduce((s, p) => s + p[1], 0) / c.length;
  if (meanY(top) > meanY(bottom)) [top, bottom] = [bottom.reverse(), top.reverse()];
  const ring = new Float64Array(K * 4);
  [...resample(top, K).slice(0, K), ...resample(bottom, K).slice(0, K)].forEach(([x, y], i) => {
    ring[i * 2] = x;
    ring[i * 2 + 1] = y;
  });
  return ring;
}

export type EyeRings = Record<DentaMood, [Float64Array, Float64Array]>;
const cache = new Map<string, EyeRings>();
/** Anillos por expresión: { neutral: [izquierdo, derecho], … }. `small` usa la geometría -sm. */
export function eyeRings(small: boolean, K = 20): EyeRings {
  const key = `${small}-${K}`;
  let rings = cache.get(key);
  if (!rings) {
    rings = {} as EyeRings;
    for (const [mood, def] of Object.entries(MOODS) as [DentaMood, (typeof MOODS)[DentaMood]][]) {
      const eyes = small ? def.s : def.r;
      rings[mood] = [toRing(outline(eyes[0]), K), toRing(outline(eyes[1]), K)];
    }
    cache.set(key, rings);
  }
  return rings;
}
