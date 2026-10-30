'use client';
/**
 * Denta, mascota del asistente de Dentary. Geometría de los assets de diseño Denta v2 (build.mjs del
 * paquete de diseño); el movimiento es un rig procedural (denta/rig.ts).
 *
 * El servidor dibuja la pose de reposo; en el cliente un solo requestAnimationFrame escribe los
 * trazados por referencia (sin re-render de React). Se pausa fuera de pantalla o con la pestaña
 * oculta, y con movimiento reducido queda en la pose fija de cada expresión. Decorativa por defecto
 * (el texto vecino comunica el estado); si es lo único que comunica algo, pasar decorative={false}
 * y label. Mira al cursor solo cuando está cerca, para no distraer mientras se trabaja.
 *
 * Procedencia: módulo gráfico aislado de Odontoser (commit 5db8cfcf) a pedido del propietario,
 * con imports, tokens y formato adaptados a este repositorio público. No incluye AssistantView,
 * lógica clínica, permisos, hooks de expediente, datos ni conexiones de Odontoser/ECP.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { EYE_COLOR, type DentaMood } from './denta/geometry';
import { createRig, type DentaActivity, type DentaRig } from './denta/rig';
import {
  SHADE_STOPS,
  bodyPath,
  lightStrength,
  ringPath,
  shadeOpacity,
} from './denta/shape';
import styles from './DentaMascot.module.css';

export type { DentaMood, DentaActivity };

/** Bajo este tamaño se usa la geometría -sm (ojos y trazos más gruesos). */
const SMALL_BELOW = 40;
/** Ojos 15 % más alargados que v2: decisión de diseño (con 0 vuelve a la proporción original). */
const EYE_LENGTH = 0.15;
/** Distancia (px) a la que Denta mira el cursor y a la que reacciona si pasa rápido. */
const FOLLOW_RADIUS = 260;
const NOTICE_RADIUS = 200;
const HIDDEN: CSSProperties = { display: 'none' };

type Live = {
  mood: DentaMood;
  activity: DentaActivity;
  level: number;
  playful: boolean;
  blink: boolean;
  paused: boolean;
};

function restPose(mood: DentaMood, small: boolean) {
  const rig = createRig({ small, reduced: true, eyeLength: EYE_LENGTH });
  rig.setMood(mood);
  rig.step(0);
  const f = rig.frame();
  return { body: bodyPath(f.body), eyes: ringPath(f.eyes[0]) + ringPath(f.eyes[1]) };
}

function apply(rig: DentaRig, p: Live) {
  rig.setMood(p.mood);
  rig.setActivity(p.activity);
  rig.setLevel(p.level);
  rig.setAutoSpin(p.playful);
  rig.setBlink(p.blink);
}

export function DentaMascot({
  mood = 'neutral',
  size = 24,
  blink = true,
  activity = 'idle',
  level = 0,
  playful = false,
  interactive = true,
  paused = false,
  decorative = true,
  label,
  className = '',
}: {
  mood?: DentaMood;
  size?: number;
  /** Parpadeo aleatorio (solo con movimiento permitido). */
  blink?: boolean;
  /** Qué está haciendo: escucha (con `level`), lee al transcribir o piensa. */
  activity?: DentaActivity;
  /** Nivel del micrófono 0–1 mientras escucha. */
  level?: number;
  /** Permite un giro de 360° de vez en cuando, solo en reposo. */
  playful?: boolean;
  /** Mira al cursor cercano, se sorprende si pasa rápido y reacciona al clic. */
  interactive?: boolean;
  /** Congela la pose (historial, accesibilidad): sin RAF ni reacciones. */
  paused?: boolean;
  decorative?: boolean;
  label?: string;
  className?: string;
}) {
  const small = size < SMALL_BELOW;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [initial] = useState(() => restPose(mood, small));
  const svgRef = useRef<SVGSVGElement>(null);
  const rigRef = useRef<DentaRig | null>(null);
  const wakeRef = useRef<() => void>(() => {});
  const liveRef = useRef<Live>({ mood, activity, level, playful, blink, paused });

  useEffect(() => {
    liveRef.current = { mood, activity, level, playful, blink, paused };
    if (rigRef.current) {
      apply(rigRef.current, liveRef.current);
      wakeRef.current();
    }
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const [body, shade, light, eyes] = Array.from(svg.querySelectorAll('path'));
    const hi = svg.querySelector('radialGradient');
    const lin = svg.querySelector('linearGradient');
    if (!body || !shade || !light || !eyes || !hi || !lin) return;
    const stops = Array.from(lin.children);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rig = createRig({
      small,
      eyeLength: EYE_LENGTH,
      reduced: motion.matches,
      seed: 1 + Math.floor(Math.random() * 1e6),
    });
    rigRef.current = rig;
    apply(rig, liveRef.current);

    let raf = 0;
    let last = 0;
    let visible = true;
    let rect = svg.getBoundingClientRect();
    let rectAt = 0;
    let pointer: [number, number] | null = null;
    let lastMove: [number, number, number] | null = null;
    let noticed = 0;
    let lastBody = '';
    let lastEyes = '';
    let lit = false;

    const draw = () => {
      const f = rig.frame();
      const d = bodyPath(f.body);
      const strength = lightStrength(size, f.turn);
      if (d !== lastBody) {
        body.setAttribute('d', d);
        lastBody = d;
      }
      if (strength > 0.01) {
        shade.setAttribute('d', d);
        light.setAttribute('d', d);
        light.setAttribute('opacity', String(strength));
        hi.setAttribute('cx', String(f.light[0]));
        hi.setAttribute('cy', String(f.light[1]));
        lin.setAttribute('x1', String(f.shade.x1));
        lin.setAttribute('x2', String(f.shade.x2));
        stops.forEach((stop, j) => {
          const lam = f.shade.stops[j * 2 + 1];
          stop.setAttribute('offset', String(f.shade.stops[j * 2]));
          stop.setAttribute('stop-color', lam >= 0.7 ? '#fff' : EYE_COLOR);
          stop.setAttribute('stop-opacity', String(shadeOpacity(lam, strength)));
        });
      }
      if (lit !== strength > 0.01) {
        lit = strength > 0.01;
        shade.style.display = lit ? '' : 'none';
        light.style.display = lit ? '' : 'none';
      }
      const e = ringPath(f.eyes[0]) + ringPath(f.eyes[1]);
      if (e !== lastEyes) {
        eyes.setAttribute('d', e);
        lastEyes = e;
      }
    };
    const gaze = (): [number, number] | null => {
      if (!interactive || !pointer) return null;
      const dx = pointer[0] - (rect.left + rect.width / 2);
      const dy = pointer[1] - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      return dist > FOLLOW_RADIUS ? null : [dx / (dist + 90), dy / (dist + 90)];
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (now - rectAt > 300) {
        rect = svg.getBoundingClientRect();
        rectAt = now;
      }
      rig.setGaze(gaze());
      rig.step(dt);
      draw();
      schedule();
    };
    const schedule = () => {
      if (!raf && visible && !document.hidden && !motion.matches && !liveRef.current.paused)
        raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    // Con movimiento reducido o pausa no hay bucle: cada cambio dibuja una pose fija.
    wakeRef.current = () => {
      if (motion.matches || liveRef.current.paused) {
        rig.setReduced(true);
        rig.step(0);
        draw();
      } else {
        rig.setReduced(false);
        schedule();
      }
    };

    const onMotion = () => {
      rig.setReduced(motion.matches);
      pause();
      wakeRef.current();
    };
    const onVisibility = () => (document.hidden ? pause() : schedule());
    const onPointer = (e: PointerEvent) => {
      const now = performance.now();
      pointer = [e.clientX, e.clientY];
      if (lastMove && now - noticed > 1500) {
        const speed =
          Math.hypot(e.clientX - lastMove[0], e.clientY - lastMove[1]) /
          Math.max(1, now - lastMove[2]);
        const dist = Math.hypot(
          e.clientX - (rect.left + rect.width / 2),
          e.clientY - (rect.top + rect.height / 2),
        );
        if (speed > 2 && dist < NOTICE_RADIUS) {
          noticed = now;
          rig.notice(Math.min(1, speed / 5));
        }
      }
      lastMove = [e.clientX, e.clientY, now];
    };
    const onPoke = () => {
      rig.poke();
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else pause();
    });
    observer.observe(svg);
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    if (interactive) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      svg.addEventListener('pointerdown', onPoke);
    }
    rig.step(0);
    draw();
    schedule();
    return () => {
      pause();
      observer.disconnect();
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      svg.removeEventListener('pointerdown', onPoke);
      wakeRef.current = () => {};
      rigRef.current = null;
    };
  }, [small, size, interactive]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={`${styles.mascot} ${className}`}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      data-mood={mood}
    >
      <defs>
        <radialGradient id={`${id}l`} gradientUnits="userSpaceOnUse" r="110">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" y1="0" y2="0">
          {Array.from({ length: SHADE_STOPS }, (_, i) => (
            <stop key={i} />
          ))}
        </linearGradient>
      </defs>
      <path d={initial.body} fill="currentColor" />
      <path d={initial.body} fill={`url(#${id}s)`} style={HIDDEN} />
      <path d={initial.body} fill={`url(#${id}l)`} style={HIDDEN} />
      <path d={initial.eyes} fill={EYE_COLOR} />
    </svg>
  );
}
