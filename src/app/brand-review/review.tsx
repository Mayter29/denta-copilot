'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck2, Check, ShieldCheck } from 'lucide-react';
import { DentaMascot, type DentaMood } from '@/components/brand/DentaMascot';
import styles from './review.module.css';

const states: { label: string; mood: DentaMood; message: string }[] = [
  { label: 'Lista para ayudar', mood: 'neutral', message: '¿Qué resolvemos hoy en la clínica?' },
  {
    label: 'Consultando agenda',
    mood: 'pensando',
    message: 'Estoy comprobando los espacios disponibles.',
  },
  { label: 'Cambio confirmado', mood: 'feliz', message: 'La cita quedó guardada en la agenda.' },
  {
    label: 'Requiere revisión',
    mood: 'sorprendido',
    message: 'Ese horario está ocupado. Revisemos otra opción.',
  },
];
const expressions: { mood: DentaMood; title: string }[] = [
  { mood: 'neutral', title: 'Neutral' },
  { mood: 'pensando', title: 'Pensando' },
  { mood: 'feliz', title: 'Feliz' },
  { mood: 'sorprendido', title: 'Sorprendida' },
  { mood: 'guino', title: 'Guiño' },
  { mood: 'triste', title: 'Triste' },
];
export function BrandReview() {
  const [selected, setSelected] = useState(0);
  const state = states[selected];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Image
          src="/brand/dentary/dentary-horizontal-light.svg"
          alt="Dentary"
          width={181}
          height={23}
          priority
        />
        <Link href="/">
          <ArrowLeft size={14} />
          Volver al copiloto
        </Link>
      </header>
      <div className={styles.intro}>
        <span>EXPLORACIÓN DE IDENTIDAD · DENTA COPILOT</span>
        <h1>
          La misma familia.
          <br />
          <em>Una nueva forma de acompañar.</em>
        </h1>
        <p>
          Denta ya tiene personalidad propia. Podemos darle un lugar discreto en el copiloto y
          conservar la marca Dentary.
        </p>
      </div>
      <section className={styles.previewSection} aria-labelledby="preview-title">
        <div className={styles.sectionTitle}>
          <div>
            <span>01 / PROPUESTA EN CONTEXTO</span>
            <h2 id="preview-title">Denta como cara del asistente</h2>
          </div>
          <span className={styles.tag}>Vista de revisión</span>
        </div>
        <div className={styles.previewGrid}>
          <div className={styles.preview}>
            <div className={styles.previewTop}>
              <div className={styles.productBrand}>
                <Image src="/brand/dentary/dentary-icon.svg" alt="" width={31} height={31} />
                <strong>
                  Denta Copilot<small>de Dentary</small>
                </strong>
              </div>
              <span className={styles.demo}>DEMO</span>
            </div>
            <div className={styles.chatHeader}>
              <DentaMascot mood={state.mood} size={52} />
              <div>
                <strong>Tu copiloto de recepción</strong>
                <span>{state.label}</span>
              </div>
            </div>
            <div className={styles.chatBody}>
              <div className={styles.chatMessage}>
                <DentaMascot mood={state.mood} size={32} />
                <div>
                  <strong>Denta Copilot</strong>
                  <p aria-live="polite">{state.message}</p>
                </div>
              </div>
              <div className={styles.action}>
                <CalendarCheck2 size={17} />
                <strong>Valoración · Clara Demo</strong>
                <p>Mañana · 11:00 · Dra. Valeria Soto</p>
                <span>
                  <Check size={13} />
                  {selected === 2
                    ? 'Cambio confirmado en la agenda'
                    : 'Propuesta de ejemplo · pendiente de confirmar'}
                </span>
              </div>
              <div className={styles.input}>
                ¿Qué resolvemos hoy en la clínica?<span>↑</span>
              </div>
              <small className={styles.note}>
                <ShieldCheck size={12} />
                Vos confirmás cada cambio. Denta te acompaña.
              </small>
            </div>
          </div>
          <div className={styles.controls}>
            <span>CAMBIAR ESTADO</span>
            {states.map((s, i) => (
              <button key={s.label} aria-pressed={selected === i} onClick={() => setSelected(i)}>
                <DentaMascot mood={s.mood} size={31} blink={false} />
                {s.label}
              </button>
            ))}
            <p>
              La expresión acompaña al texto. Las confirmaciones y los errores conservan su mensaje
              y sus controles.
            </p>
          </div>
        </div>
      </section>
      <section className={styles.expressions} aria-labelledby="expressions-title">
        <div className={styles.sectionTitle}>
          <div>
            <span>02 / MASCOTA ORIGINAL · V2</span>
            <h2 id="expressions-title">Seis expresiones, una sola Denta</h2>
          </div>
        </div>
        <div className={styles.expressionGrid}>
          {expressions.map(({ mood, title }) => (
            <div key={mood}>
              <DentaMascot mood={mood} size={92} blink={false} />
              <strong>{title}</strong>
              <div className={styles.scales}>
                <DentaMascot mood={mood} size={24} blink={false} />
                <DentaMascot mood={mood} size={32} blink={false} />
                <DentaMascot mood={mood} size={40} blink={false} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.logos} aria-labelledby="logos-title">
        <div className={styles.sectionTitle}>
          <div>
            <span>03 / MARCA RECUPERADA</span>
            <h2 id="logos-title">Los vectores de Dentary están disponibles</h2>
          </div>
        </div>
        <div className={styles.logoGrid}>
          <div>
            <Image
              src="/brand/dentary/dentary-horizontal-light.svg"
              alt="Dentary sobre fondo claro"
              width={301}
              height={38}
            />
            <span>Variante para fondo claro</span>
          </div>
          <div className={styles.dark}>
            <Image
              src="/brand/dentary/dentary-horizontal-dark.svg"
              alt="Dentary sobre fondo oscuro"
              width={301}
              height={38}
            />
            <span>Variante para fondo oscuro</span>
          </div>
        </div>
      </section>
      <footer className={styles.footer}>
        Activos originales de Dentary reutilizados con autorización de su propietaria. Esta vista
        propone su ubicación; la pantalla principal conserva su identidad actual.
      </footer>
    </main>
  );
}
