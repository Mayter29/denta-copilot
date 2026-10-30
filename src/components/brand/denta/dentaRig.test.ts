import { describe, expect, it } from 'vitest';
import {
  BODY_POINTS,
  MOODS,
  eyeRings,
  outline,
  type DentaMood,
} from './geometry';
import { createRig, type DentaActivity } from './rig';
import { bodyPath, ringPath } from './shape';

type Point = [number, number];
const moods = Object.keys(MOODS) as DentaMood[];

// Curva suave (Catmull-Rom) que dibuja ringPath, muestreada.
function curve(ring: Float64Array, steps = 10): Point[] {
  const n = ring.length / 2;
  const p = (i: number): Point => [ring[((i + n) % n) * 2], ring[((i + n) % n) * 2 + 1]];
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      const at = (j: 0 | 1) =>
        u * u * u * p1[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p2[j];
      out.push([at(0), at(1)]);
    }
  }
  return out;
}

function distance(pt: Point, poly: Point[]) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(pt[0] - a[0] - dx * t, pt[1] - a[1] - dy * t));
  }
  return best;
}

// Contorno del cuerpo (10 cúbicas) como polígono, para preguntar si un punto está adentro.
function bodyPolygon(p: Float64Array | number[]): Point[] {
  const poly: Point[] = [];
  for (let i = 2; i < p.length; i += 6) {
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      const u = 1 - t;
      const at = (o: number) =>
        u * u * u * p[i - 2 + o] +
        3 * u * u * t * p[i + o] +
        3 * u * t * t * p[i + 2 + o] +
        t * t * t * p[i + 4 + o];
      poly.push([at(0), at(1)]);
    }
  }
  return poly;
}

function inside([x, y]: Point, poly: Point[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

describe('rig de Denta', () => {
  it('reproduce el contorno de cada ojo de v2 con menos de 0,5 unidades de desvío', () => {
    for (const small of [false, true]) {
      for (const mood of moods) {
        const eyes = small ? MOODS[mood].s : MOODS[mood].r;
        eyes.forEach((eye, k) => {
          const exact = outline(eye);
          const smooth = curve(eyeRings(small)[mood][k]);
          const worst = Math.max(
            ...smooth.map((p) => distance(p, exact)),
            ...exact.map((p) => distance(p, smooth)),
          );
          expect(worst, `${mood} ${small ? 'sm' : ''} ojo ${k}`).toBeLessThan(0.5);
        });
      }
    }
  });

  it('en reposo con movimiento reducido da exactamente la pose de v2', () => {
    for (const mood of moods) {
      const rig = createRig({ reduced: true, contain: false });
      rig.setMood(mood);
      rig.step(0.016);
      const f = rig.frame();
      const { tilt, sy } = MOODS[mood];
      const c = Math.cos((tilt * Math.PI) / 180);
      const s = Math.sin((tilt * Math.PI) / 180);
      const rot = (x: number, y: number) => [
        128 + (x - 128) * c - (y - 134) * s,
        134 + (x - 128) * s + (y - 134) * c,
      ];
      for (let i = 0; i < BODY_POINTS.length; i += 2) {
        const [x, y] = rot(BODY_POINTS[i], 134 + (BODY_POINTS[i + 1] - 134) * sy);
        expect(Math.hypot(f.body[i] - x, f.body[i + 1] - y)).toBeLessThan(1e-9);
      }
      const rings = eyeRings(false)[mood];
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < rings[k].length; i += 2) {
          const [x, y] = rot(rings[k][i], rings[k][i + 1]);
          expect(Math.hypot(f.eyes[k][i] - x, f.eyes[k][i + 1] - y)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('mantiene los ojos dentro del diente en todas las expresiones y miradas extremas', () => {
    const cases: [DentaMood, DentaActivity][] = [
      ['pensando', 'thinking'],
      ['pensando', 'transcribing'],
      ['neutral', 'idle'],
      ['sorprendido', 'listening'],
      ['feliz', 'idle'],
      ['guino', 'idle'],
      ['triste', 'idle'],
    ];
    let outside = 0;
    for (const [mood, activity] of cases) {
      for (const gaze of [[0, -1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], null] as (
        [number, number] | null
      )[]) {
        const rig = createRig({ seed: 9, eyeLength: 0.15 });
        rig.setMood(mood);
        rig.setActivity(activity);
        rig.setGaze(gaze);
        rig.setLevel(1);
        // 2,5 s por caso a 30 cuadros/s: cubre transiciones, saltos y sacadas sin acercarse al timeout.
        for (let i = 0; i < 75; i++) {
          rig.step(1 / 30);
          const f = rig.frame();
          const body = bodyPolygon(f.body);
          for (const eye of f.eyes)
            for (let j = 0; j < eye.length; j += 2)
              if (!inside([eye[j], eye[j + 1]], body)) outside++;
        }
      }
    }
    expect(outside).toBe(0);
  }, 20_000);

  it('con movimiento reducido ignora toque y giro y no se mueve', () => {
    const rig = createRig({ reduced: true });
    rig.setMood('neutral');
    rig.step(0.016);
    const before = bodyPath(rig.frame().body);
    rig.poke();
    rig.spin();
    for (let i = 0; i < 120; i++) rig.step(1 / 60);
    expect(rig.mood).toBe('neutral');
    expect(bodyPath(rig.frame().body)).toBe(before);
  });

  it('el toque vuelve a la expresión anterior y un cambio externo lo cancela', () => {
    const rig = createRig({ seed: 2 });
    rig.poke();
    expect(rig.mood).toBe('feliz');
    for (let i = 0; i < 60; i++) rig.step(1 / 60);
    expect(rig.mood).toBe('neutral');
    rig.poke();
    rig.setMood('triste');
    for (let i = 0; i < 60; i++) rig.step(1 / 60);
    expect(rig.mood).toBe('triste');
  });

  it('el giro completa 360° y todo queda finito durante una sesión larga', () => {
    const rig = createRig({ seed: 3, eyeLength: 0.15 });
    rig.spin();
    let maxTurn = 0;
    for (let i = 0; i < 90; i++) {
      rig.step(1 / 60);
      maxTurn = Math.max(maxTurn, rig.frame().turn);
    }
    expect(maxTurn).toBeGreaterThan(2 * Math.PI - 0.1);
    const states: [DentaMood, DentaActivity][] = [
      ['sorprendido', 'listening'],
      ['pensando', 'transcribing'],
      ['pensando', 'thinking'],
      ['feliz', 'idle'],
      ['guino', 'idle'],
      ['triste', 'idle'],
    ];
    for (let i = 0; i < 3600; i++) {
      if (i % 200 === 0) {
        const [mood, activity] = states[(i / 200) % states.length];
        rig.setMood(mood);
        rig.setActivity(activity);
      }
      rig.setLevel(Math.abs(Math.sin(i / 7)));
      rig.step(1 / 60);
      const f = rig.frame();
      const path = bodyPath(f.body) + ringPath(f.eyes[0]) + ringPath(f.eyes[1]);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
  });
});
