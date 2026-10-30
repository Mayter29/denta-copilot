import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authSession } from '@/lib/server/auth';
import { renderCookieStore } from '@/lib/server/cookies';
import { DentaryBrand } from '@/components/brand/DentaryBrand';

export default async function Home() {
  const session = await authSession(await renderCookieStore()).catch(() => null);
  if (session) redirect('/app/copiloto');
  return (
    <main className="login-page">
      <DentaryBrand placement="header" />
      <section className="login-card">
        <h1>Denta Copilot</h1>
        <p className="muted">Copiloto administrativo para la recepción de tu clínica.</p>
        <Link className="primary login-link" href="/login">
          Ingresar como secretaría
        </Link>
        <Link className="secondary login-link" href="/demo">
          Ver demostración local
        </Link>
        <p className="muted small">Datos completamente ficticios. Sin diagnóstico ni consejo médico.</p>
      </section>
    </main>
  );
}
