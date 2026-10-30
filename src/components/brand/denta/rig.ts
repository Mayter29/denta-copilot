/**
 * Rig procedural de Denta: el «cerebro» de movimiento, independiente del render.
 *
 * Todo se mueve con resortes (x, v, objetivo, ω, ζ) integrados a paso fijo de 1/120 s, así el
 * resultado no depende de los fps. Las capas se suman sobre la pose de la expresión: respiración,
 * mirada con micro-sacadas (y mirar alrededor si nadie mueve el cursor), giro de cabeza con retardo,
 * estiramiento de los ojos al moverse, parpadeo aleatorio, escucha (nivel del micrófono), lectura al
 * transcribir, balanceo y asimetría al pensar, curiosidad, toque, giro de 360° y reacciones al
 * cambiar de expresión. Los ojos nunca salen del contorno del diente.
 *
 * Con movimiento reducido no hay capas: la pose es la de v2 (con `contain: false` y `eyeLength` 0,
 * exactamente; los tests lo verifican).
 */
import { BODY_POINTS, MOODS, eyeRings, type DentaMood } from './geometry';
import {
  BLINK_TOTAL,
  BX,
  BY,
  CTRL_C,
  CTRL_CLOSE,
  CTRL_R,
  EYE_DEPTH,
  EYE_MARGIN,
  HALF_W,
  LEFT,
  LIGHT,
  LINE,
  RIGHT,
  SHADE_STOPS,
  SPIN,
  TOP,
  blinkAmount,
  mulberry32,
  readingGaze,
  spinAngle,
} from './shape';

export type DentaActivity = 'idle' | 'listening' | 'transcribing' | 'thinking';
type Spring = { x: number; v: number; t: number; w: number; z: number };
type SpringName =
  | 'tilt'
  | 'sy'
  | 'morph'
  | 'sq'
  | 'sink'
  | 'gx'
  | 'gy'
  | 'yaw'
  | 'lean'
  | 'wob'
  | 'eye'
  | 'asym'
  | 'focus';
type Api = { hop(h: number, wob: number): void; kick(name: SpringName, v: number): void };

const STEP = 1 / 120;
const RAD = Math.PI / 180;
const GRAVITY = 2600;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const spring = (x: number, w: number, z: number): Spring => ({ x, v: 0, t: x, w, z });

/** Reacción al entrar en cada expresión (no corre con movimiento reducido). */
const REACTION: Record<DentaMood, (r: Api) => void> = {
  feliz: (r) => {
    r.hop(16, 12);
    r.kick('gy', -6);
  },
  guino: (r) => {
    r.hop(9, 8);
    r.kick('tilt', -70);
  },
  sorprendido: (r) => {
    r.kick('sq', 2.4);
    r.kick('eye', 2);
  },
  pensando: (r) => r.kick('lean', 20),
  neutral: (r) => r.kick('wob', 3),
  triste: () => {},
};

export function createRig({
  small = false,
  reduced = false,
  seed = 1,
  eyeLength = 0,
  contain = true,
}: {
  small?: boolean;
  reduced?: boolean;
  seed?: number;
  eyeLength?: number;
  contain?: boolean;
} = {}) {
  const rings = eyeRings(small);
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const s: Record<SpringName, Spring> = {
    tilt: spring(0, 14, 0.5),
    sy: spring(1, 16, 0.55),
    morph: spring(1, 17, 0.6),
    sq: spring(0, 22, 0.35),
    sink: spring(0, 10, 0.9),
    gx: spring(0, 32, 0.85),
    gy: spring(0, 32, 0.85),
    yaw: spring(0, 8, 0.75),
    lean: spring(0, 9, 0.6),
    wob: spring(0, 24, 0.15),
    eye: spring(1, 18, 0.55),
    asym: spring(0, 10, 0.5),
    focus: spring(0, 12, 0.8),
  };
  const springs = Object.values(s);
  let mood: DentaMood = 'neutral';
  let activity: DentaActivity = 'idle';
  let from = rings.neutral;
  let to = rings.neutral;
  let level = 0;
  let heard = 0;
  let gaze: [number, number] | null = null;
  let prevGaze: [number, number] | null = null;
  let lastGazeChange = 0;
  let sacc: [number, number] = [0, 0];
  let time = 0;
  let acc = 0;
  let breath = 0;
  let nextSacc = between(1, 3);
  let nextBlink = between(1.5, 4);
  let blinkT = -1;
  let again = false;
  let blinks = true;
  let hop: { t: number; air: boolean; y: number; vy: number; h: number; wob: number } | null = null;
  let spin: { t: number } | null = null;
  let autoSpin = false;
  let nextSpin = between(25, 50);
  let restore: { mood: DentaMood; at: number } | null = null;
  let readT = 0;
  let readLine = 0;

  const n = rings.neutral[0].length;
  const eyeBuf = [new Float64Array(n), new Float64Array(n)];
  const out = {
    body: new Float64Array(BODY_POINTS.length),
    eyes: [new Float64Array(n), new Float64Array(n)] as [Float64Array, Float64Array],
    light: [0, 0] as [number, number],
    /** Sombreado de la sección principal: rango x en pantalla y paradas [offset, luz 0–1]. */
    shade: { x1: 21, x2: 235, stops: new Float64Array(SHADE_STOPS * 2) },
    /** Ángulo de giro total (radianes): la luz se intensifica al girar. */
    turn: 0,
  };

  const blend = (m: number): [Float64Array, Float64Array] => {
    const pair = [0, 1].map((k) => {
      const r = new Float64Array(n);
      for (let i = 0; i < n; i++) r[i] = from[k][i] + (to[k][i] - from[k][i]) * m;
      return r;
    });
    return [pair[0], pair[1]];
  };

  const change = (next: DentaMood) => {
    if (next === mood) return;
    from = blend(clamp(s.morph.x, 0, 1.1));
    to = rings[next];
    s.morph.x = 0;
    s.morph.v = 0;
    s.tilt.t = MOODS[next].tilt;
    s.sy.t = MOODS[next].sy;
    mood = next;
    if (!reduced) REACTION[next](api);
  };

  const api = {
    get mood() {
      return mood;
    },
    setMood(next: DentaMood) {
      restore = null;
      change(next);
    },
    setActivity(next: DentaActivity) {
      if (next === 'transcribing' && activity !== next) {
        readT = 0;
        readLine = 0;
      }
      activity = next;
    },
    /** Nivel del micrófono 0–1 (solo se usa al escuchar). */
    setLevel(next: number) {
      level = clamp(next, 0, 1);
    },
    /** Objetivo de mirada normalizado [-1, 1] o null para la mirada automática. */
    setGaze(next: [number, number] | null) {
      gaze = next;
    },
    setReduced(next: boolean) {
      reduced = next;
    },
    /** Giros espontáneos de vez en cuando, solo en reposo. */
    setAutoSpin(next: boolean) {
      autoSpin = next;
    },
    setBlink(next: boolean) {
      blinks = next;
    },
    hop(h: number, wob: number) {
      if (!hop) hop = { t: 0, air: false, y: 0, vy: 0, h, wob };
    },
    kick(name: SpringName, v: number) {
      s[name].v += v;
    },
    spin() {
      if (reduced || spin) return;
      spin = { t: 0 };
      api.hop(10, 0);
    },
    /** El cursor pasó rápido cerca: ojos que se abren, uno más que el otro. */
    notice(strength = 1) {
      if (reduced) return;
      s.eye.v += 2.2 * strength;
      s.asym.v += 7 * strength;
      s.sq.v += 1.2 * strength;
    },
    /** Toque (clic): ojos felices un instante, salto y vuelta a la expresión anterior. */
    poke() {
      if (reduced) return;
      const back = restore ? restore.mood : mood;
      if (mood === 'feliz') api.hop(12, 14);
      change('feliz');
      restore = back === 'feliz' ? null : { mood: back, at: time + 0.9 };
    },
    step(dt: number) {
      dt = Math.min(dt, 0.1);
      time += dt;
      heard += (level - heard) * Math.min(1, dt * (level > heard ? 25 : 6));
      const listening = activity === 'listening';
      const reading = activity === 'transcribing';
      const thinking = activity === 'thinking' || reading;
      const live = !reduced;
      if (reading && live) {
        readT += dt;
        // Cada tres renglones (párrafo), un gesto mínimo; en cada renglón se leía como un tic.
        const line = Math.floor(readT / LINE);
        if (line !== readLine) {
          readLine = line;
          if (line % 3 === 0) s.lean.v -= 4;
        }
      }
      breath = live ? (listening ? 0.004 : 0.009) * Math.sin((time * Math.PI * 2) / 3.6) : 0;
      if (restore && time >= restore.at) {
        const back = restore.mood;
        restore = null;
        change(back);
      }

      // Si el cursor no se mueve, deja de mirarlo y mira alrededor.
      if (gaze && (!prevGaze || Math.hypot(gaze[0] - prevGaze[0], gaze[1] - prevGaze[1]) > 0.02))
        lastGazeChange = time;
      prevGaze = gaze;
      const wander = time - lastGazeChange > 7;
      if (live && time >= nextSacc) {
        const radius = thinking ? 0.28 : wander ? 0.42 : 0.14;
        const a = rand() * Math.PI * 2;
        const d = rand() < (wander ? 0.35 : 0.25) ? 0 : Math.sqrt(rand()) * radius;
        sacc = [Math.cos(a) * d, Math.sin(a) * d * 0.7];
        nextSacc =
          time + (thinking ? between(0.6, 1.6) : wander ? between(1.2, 3.2) : between(1.8, 4.5));
      }
      const sad = live && mood === 'triste';
      if (reading) sacc = [0, 0];
      let base: [number, number] = gaze && !wander ? gaze : [0, 0];
      if (!live) base = [0, 0];
      else if (reading) base = readingGaze(readT);
      else if (thinking) base = [0.35, -0.5];
      else if (listening) base = [0.15, 0.55];
      else if (sad) base = [0, 0.45];
      s.gx.t = clamp(base[0] + sacc[0], -1, 1);
      s.gy.t = clamp(base[1] + sacc[1], -1, 1);
      // Al leer la cabeza acompaña poco: se mueven sobre todo los ojos.
      s.yaw.t = s.gx.t * (reading ? 0.35 : 0.75);
      s.lean.t =
        s.gx.t * (reading ? 1 : 3) +
        (thinking && !reading && live ? 2.2 * Math.sin(time * 1.7) : 0);
      s.sq.t =
        (listening && live ? 0.06 * heard : 0) +
        (sad ? -0.03 : 0) +
        (hop ? (hop.air ? 0.07 : -0.1) : 0);
      s.sink.t = sad ? 3 : 0;
      s.eye.t = 1 + (listening && live ? 0.12 * heard : 0) + (reading && live ? 0.14 : 0);
      s.asym.t = thinking && live ? (reading ? 0.4 : 1) : 0;
      s.focus.t = reading && live ? 1 : 0;

      const canBlink = live && blinks && mood !== 'feliz' && mood !== 'guino' && !spin;
      if (blinkT < 0 && canBlink && time >= nextBlink) {
        blinkT = 0;
        again = rand() < 0.15;
        nextBlink = time + (thinking ? between(3.5, 8) : between(2.5, 6.5));
      }
      if (blinkT >= 0) {
        blinkT += dt;
        if (blinkT > BLINK_TOTAL) {
          blinkT = again ? 0 : -1;
          again = false;
        }
      }

      if (reduced) {
        sacc = [0, 0];
        for (const p of springs) {
          p.x = p.t;
          p.v = 0;
        }
        hop = null;
        spin = null;
        blinkT = -1;
        return;
      }
      // Giro espontáneo, solo en reposo y sin nada en curso: de vez en cuando, nunca al trabajar.
      if (autoSpin && activity === 'idle' && mood === 'neutral' && !restore) {
        if (time >= nextSpin && !spin && !hop) {
          api.spin();
          nextSpin = time + between(30, 70);
        }
      } else nextSpin = Math.max(nextSpin, time + 8);
      if (spin) {
        spin.t += dt;
        if (spin.t > SPIN[0] + SPIN[1]) {
          spin = null;
          s.wob.v += 10;
          s.sq.v -= 1.5;
        }
      }
      if (hop) {
        hop.t += dt;
        if (!hop.air && hop.t >= 0.08) {
          hop.air = true;
          hop.vy = -Math.sqrt(2 * GRAVITY * hop.h);
        }
        if (hop.air) {
          hop.vy += GRAVITY * dt;
          hop.y += hop.vy * dt;
          if (hop.y >= 0) {
            s.sq.v -= 2.4;
            s.wob.v += hop.wob;
            hop = null;
          }
        }
      }
      acc += dt;
      while (acc >= STEP) {
        for (const p of springs) {
          p.v += (-2 * p.z * p.w * p.v - p.w * p.w * (p.x - p.t)) * STEP;
          p.x += p.v * STEP;
        }
        acc -= STEP;
      }
    },
    frame() {
      const m = clamp(s.morph.x, 0, 1.1);
      const b = blinkAmount(blinkT);
      const yaw = clamp(s.yaw.x, -0.8, 0.8);
      const turn = yaw * 0.42 + (spin ? spinAngle(spin.t) : 0);
      const cT = Math.cos(turn);
      const sT = Math.sin(turn);
      // El cuerpo es simétrico adelante/atrás: su silueta solo depende de |cos|; así las cúspides
      // se juntan de perfil y no se cruzan al pasar de espaldas. La dirección la dan ojos y luz.
      const cA = Math.abs(cT);
      const sq = s.sq.x + breath;
      const Sx = 1 - 0.55 * sq;
      const Sy = 1 + sq;
      const ty = (hop ? hop.y : 0) + s.sink.x;
      const ct = Math.cos(s.tilt.x * RAD);
      const st = Math.sin(s.tilt.x * RAD);
      const cl = Math.cos(s.lean.x * RAD);
      const sl = Math.sin(s.lean.x * RAD);
      const sy = s.sy.x;
      const gx = s.gx.x * 14;
      const gy = s.gy.x * 10;
      // Estiramiento de los ojos en la dirección en que se mueve la mirada (no al leer: tiembla).
      const vx = s.gx.v * 14;
      const vy = s.gy.v * 10;
      const speed = Math.hypot(vx, vy);
      const smear = Math.min(0.3, speed * 0.0022) * (1 - s.focus.x);
      const dx = speed > 1e-6 ? vx / speed : 0;
      const dy = speed > 1e-6 ? vy / speed : 0;
      // Aplastar/estirar y respirar desde la base, giro de la expresión, inclinación desde la base.
      const shared = (arr: Float64Array | [number, number], i: number, x: number, y: number) => {
        x = 128 + (x - 128) * Sx;
        y = 224 + (y - 224) * Sy;
        let ux = x - 128;
        let uy = y - 134;
        x = 128 + ux * ct - uy * st;
        y = 134 + ux * st + uy * ct;
        ux = x - 128;
        uy = y - 224;
        arr[i] = 128 + ux * cl - uy * sl;
        arr[i + 1] = 224 + ux * sl + uy * cl + ty;
      };
      const depthAt = (r: number) => EYE_DEPTH * Math.sqrt(Math.max(0, 1 - (r / HALF_W) ** 2));

      for (let i = 0; i < BODY_POINTS.length; i += 2) {
        let x = BODY_POINTS[i];
        let y0 = BODY_POINTS[i + 1];
        const close = CTRL_CLOSE[i / 2];
        if (!Number.isNaN(close)) {
          // Muesca y hueco de raíces: se achican y se cierran al ponerse de perfil.
          x = 128 + (x - 128) * cA;
          y0 += (close - y0) * (1 - cA);
        }
        let y = 134 + (y0 - 134) * sy;
        y += s.wob.x * 6 * clamp((x - 128) / 100, -1, 1) * clamp((150 - y) / 100, 0, 1);
        const u = clamp((x - 128) / 114, -1, 1);
        // Cada sección elíptica gira: su centro se acerca al eje y su ancho pasa a la profundidad.
        const c = CTRL_C[i / 2];
        const r = CTRL_R[i / 2];
        const k = Math.sqrt(cT * cT + r * r * sT * sT);
        shared(out.body, i, 128 + c * cA + (x - 128 - c) * k + yaw * 16 * (1 - u * u), y);
      }

      // Sombreado lambertiano de la sección principal visible desde el frente.
      const half = Math.sqrt(HALF_W * HALF_W * cT * cT + EYE_DEPTH * EYE_DEPTH * sT * sT);
      const delta = Math.atan2(sT / HALF_W, cT / EYE_DEPTH);
      const stops = out.shade.stops;
      let best = -1;
      let bestX = 0;
      for (let j = 0; j < SHADE_STOPS; j++) {
        const phi = delta + (Math.PI * (j + 0.5)) / SHADE_STOPS;
        const X = HALF_W * Math.cos(phi) * cT + EYE_DEPTH * Math.sin(phi) * sT;
        const nx0 = Math.cos(phi) / HALF_W;
        const nz0 = Math.sin(phi) / EYE_DEPTH;
        const nl = Math.hypot(nx0, nz0);
        const nx = nx0 / nl;
        const nz = nz0 / nl;
        const lam = Math.max(0, (nx * cT + nz * sT) * LIGHT[0] + (-nx * sT + nz * cT) * LIGHT[1]);
        stops[j * 2] = (X + half) / (2 * half);
        stops[j * 2 + 1] = lam;
        if (lam > best) {
          best = lam;
          bestX = X;
        }
      }
      // El arco visible puede recorrerse de derecha a izquierda: las paradas van en orden creciente.
      if (stops[0] > stops[(SHADE_STOPS - 1) * 2]) {
        for (let j = 0; j < (SHADE_STOPS - 1) / 2; j++) {
          const o = (SHADE_STOPS - 1 - j) * 2;
          [stops[j * 2], stops[o]] = [stops[o], stops[j * 2]];
          [stops[j * 2 + 1], stops[o + 1]] = [stops[o + 1], stops[j * 2 + 1]];
        }
      }
      out.shade.x1 = 128 - half * Sx;
      out.shade.x2 = 128 + half * Sx;

      for (let k = 0; k < 2; k++) {
        const L = eyeBuf[k];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < n; i += 2) {
          const x = from[k][i] + (to[k][i] - from[k][i]) * m;
          const y = from[k][i + 1] + (to[k][i + 1] - from[k][i + 1]) * m;
          L[i] = x;
          L[i + 1] = y;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const h = maxY - minY;
        const e = s.eye.x * (k === 0 ? 1 - 0.1 * s.asym.x : 1 + 0.06 * s.asym.x);
        const ex = e * (1 - eyeLength * 0.25);
        // Concentrado al transcribir: ojos un poco entrecerrados.
        const ey = e * (1 + eyeLength) * (1 - 0.12 * s.focus.x);
        let ecx = cx + gx;
        let ecy = cy + gy;
        for (let i = 0; i < n; i += 2) {
          let x = L[i];
          let y = L[i + 1];
          if (b) {
            // Mismo cierre que el cuadro «parpadeo» de v2: más ancho, más bajo, hacia abajo.
            x += (cx + (x - cx) * 1.25 - x) * b;
            y += (cy + 0.27 * h + (y - cy) * 0.3 - y) * b;
          }
          let rx = (x - cx) * ex;
          let ry = (y - cy) * ey;
          if (smear) {
            const along = (rx * dx + ry * dy) * smear;
            rx = (rx + dx * along) * (1 - smear * 0.35);
            ry = (ry + dy * along) * (1 - smear * 0.35);
          }
          L[i] = ecx + rx;
          L[i + 1] = ecy + ry;
        }
        if (contain) {
          // Si el ojo pisa el borde (muesca o costados), se desplaza hacia adentro lo justo.
          let top = 0;
          let left = 0;
          let right = 0;
          for (let i = 0; i < n; i += 2) {
            const x = L[i];
            const y = L[i + 1];
            top = Math.max(
              top,
              134 + (TOP[clamp(Math.round(x), BX[0], BX[1])] - 134) * sy + EYE_MARGIN - y,
            );
            const row = clamp(Math.round(134 + (y - 134) / sy), BY[0], BY[1]);
            left = Math.max(left, LEFT[row] + EYE_MARGIN - x);
            right = Math.max(right, x - RIGHT[row] + EYE_MARGIN);
          }
          const ox = left > 0 ? left : -right;
          if (top > 0 || ox) {
            for (let i = 0; i < n; i += 2) {
              L[i] += ox;
              L[i + 1] += top;
            }
            ecx += ox;
            ecy += top;
          }
        }
        // Visibilidad: el ojo se achica al irse por el costado y se apaga antes del borde.
        const rc = ecx - 128;
        const zc = depthAt(rc);
        const vis = clamp((-rc * sT + zc * cT - 8) / 14, 0, 1);
        const pcx = 128 + rc * cT + zc * sT;
        for (let i = 0; i < n; i += 2) {
          const r = L[i] - 128;
          const px = 128 + r * cT + depthAt(r) * sT;
          shared(out.eyes[k], i, pcx + (px - pcx) * vis, ecy + (L[i + 1] - ecy) * vis);
        }
      }

      // Brillo especular donde la superficie mira más a la luz: se desliza al girar.
      shared(out.light, 0, 128 + bestX, 84);
      out.turn = turn;
      return out;
    },
  };
  return api;
}

export type DentaRig = ReturnType<typeof createRig>;
