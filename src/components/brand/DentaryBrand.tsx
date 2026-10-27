import Image from 'next/image';
import Link from 'next/link';
import styles from './DentaryBrand.module.css';

export function DentaryBrand({ placement }: { placement: 'sidebar' | 'header' }) {
  return (
    <Link
      href="/"
      className={`${styles.brand} ${styles[placement]}`}
      aria-label="Denta Copilot de Dentary, inicio"
    >
      <Image
        className={styles.icon}
        src="/brand/dentary/dentary-icon.svg"
        alt=""
        width={36}
        height={36}
      />
      {placement === 'sidebar' ? (
        <span className={styles.wordmark}>
          <Image
            src="/brand/dentary/dentary-horizontal-light.svg"
            alt="Dentary"
            width={164}
            height={21}
          />
          <span>Denta Copilot</span>
        </span>
      ) : (
        <span className={styles.product}>
          Denta Copilot<small>de Dentary</small>
        </span>
      )}
    </Link>
  );
}
