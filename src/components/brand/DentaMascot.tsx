/**
 * Denta, mascota de Dentary. Adaptado del componente V2 proporcionado por la propietaria.
 *
 * Un solo cuerpo; cada expresión es una transformación alrededor de (128, 134) más sus ojos, así el
 * cambio de estado se anima en lugar de saltar. El cuerpo usa currentColor: por defecto el
 * turquesa de Dentary en claro y oscuro. Decorativa por defecto (el texto vecino comunica el estado);
 * si es lo único que comunica algo, pasar decorative={false} y label. Respeta movimiento reducido.
 */
import type { CSSProperties } from 'react';
import styles from './DentaMascot.module.css';

export type DentaMood = 'neutral' | 'feliz' | 'guino' | 'sorprendido' | 'pensando' | 'triste';

/** Bajo este tamaño se usa la geometría -sm (ojos y trazos más gruesos). */
const SMALL_BELOW = 40;

const BODY =
  'M128 76c18.5 0 33-32 63.9-32 37 0 49.4 36 43.2 76-4.1 30-16.5 52-26.8 76-8.2 20-24.7 30-39.1 26-16.5-4-22.7-20-41.2-20-18.5 0-24.7 16-41.2 20-14.4 4-30.9-6-39.1-26-10.3-24-22.7-46-26.8-76-6.2-40 6.2-76 43.2-76 30.9 0 45.4 32 63.9 32z';
const POSE: Record<DentaMood, { tilt: number; sy: number }> = {
  neutral: { tilt: 0, sy: 1 },
  feliz: { tilt: -5, sy: 1 },
  guino: { tilt: 0, sy: 1 },
  sorprendido: { tilt: 0, sy: 1.05 },
  pensando: { tilt: 8, sy: 1 },
  triste: { tilt: 0, sy: 0.93 },
};

function Eyes({ mood, small }: { mood: DentaMood; small: boolean }) {
  switch (mood) {
    case 'neutral':
      return small ? (
        <>
          <rect x="96.4" y="81.9" width="31.2" height="56.2" rx="15.6" />
          <rect x="140.4" y="81.9" width="31.2" height="56.2" rx="15.6" />
        </>
      ) : (
        <>
          <rect x="101" y="84" width="26" height="52" rx="13" />
          <rect x="141" y="84" width="26" height="52" rx="13" />
        </>
      );
    case 'feliz':
      return small ? (
        <>
          <path
            d="M98.9 118C101.5 84.7 122.5 84.7 125.1 118M142.9 118C145.5 84.7 166.5 84.7 169.1 118"
            fill="none"
            stroke="#0B1220"
            strokeWidth="15.6"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M103 118C105.2 86.6 122.7 86.6 124.9 118M143.1 118C145.3 86.6 162.7 86.6 164.9 118"
            fill="none"
            stroke="#0B1220"
            strokeWidth="13"
            strokeLinecap="round"
          />
        </>
      );
    case 'guino':
      return small ? (
        <>
          <rect x="96.4" y="81.9" width="31.2" height="56.2" rx="15.6" />
          <path
            d="M142.9 118C145.5 84.7 166.5 84.7 169.1 118"
            fill="none"
            stroke="#0B1220"
            strokeWidth="15.6"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <rect x="101" y="84" width="26" height="52" rx="13" />
          <path
            d="M143.1 118C145.3 86.6 162.7 86.6 164.9 118"
            fill="none"
            stroke="#0B1220"
            strokeWidth="13"
            strokeLinecap="round"
          />
        </>
      );
    case 'sorprendido':
      return small ? (
        <>
          <rect x="81.7" y="76.6" width="43.1" height="60.3" rx="21.5" />
          <rect x="143.3" y="76.6" width="43.1" height="60.3" rx="21.5" />
        </>
      ) : (
        <>
          <rect x="87.5" y="81.6" width="35.9" height="50.2" rx="17.9" />
          <rect x="144.7" y="81.6" width="35.9" height="50.2" rx="17.9" />
        </>
      );
    case 'pensando':
      return small ? (
        <>
          <rect x="114.6" y="72.6" width="25" height="44.9" rx="12.5" />
          <rect x="158.5" y="72.5" width="25" height="44.9" rx="12.5" />
        </>
      ) : (
        <>
          <rect x="118.6" y="74.2" width="20.8" height="41.6" rx="10.4" />
          <rect x="158.6" y="74.2" width="20.8" height="41.6" rx="10.4" />
        </>
      );
    case 'triste':
      return small ? (
        <>
          <path
            d="M123.6 112.7L123.6 140.9A15.6 15.6 0 0 1 92.4 140.9L92.4 125.9ZM144.4 112.7L144.4 140.9A15.6 15.6 0 0 0 175.6 140.9L175.6 125.9Z"
            stroke="#0B1220"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M123 108.7L123 141.4A13 13 0 0 1 97 141.4L97 119.7ZM145 108.7L145 141.4A13 13 0 0 0 171 141.4L171 119.7Z"
            stroke="#0B1220"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

const ORIGIN: CSSProperties = { transformBox: 'view-box', transformOrigin: '128px 134px' };

export function DentaMascot({
  mood = 'neutral',
  size = 24,
  blink = mood === 'neutral',
  decorative = true,
  label,
  className = '',
}: {
  mood?: DentaMood;
  size?: number;
  /** Parpadeo ocasional (solo con movimiento permitido). */
  blink?: boolean;
  decorative?: boolean;
  label?: string;
  className?: string;
}) {
  const small = size < SMALL_BELOW;
  const pose = POSE[mood];
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={`${styles.mascot} ${className}`}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      data-mood={mood}
    >
      <g className={styles.move} style={{ ...ORIGIN, transform: `rotate(${pose.tilt}deg)` }}>
        <path
          d={BODY}
          fill="currentColor"
          className={styles.move}
          style={{ ...ORIGIN, transform: `scaleY(${pose.sy})` }}
        />
        <g
          fill="#0B1220"
          className={blink ? styles.blink : undefined}
          style={{ transformBox: 'view-box', transformOrigin: '128px 110px' }}
        >
          <Eyes mood={mood} small={small} />
        </g>
      </g>
    </svg>
  );
}
