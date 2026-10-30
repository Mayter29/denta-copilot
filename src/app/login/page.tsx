'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { login } from '@/lib/client/auth';
import { DentaryBrand } from '@/components/brand/DentaryBrand';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !email.trim() || !password) return;
    setPending(true);
    setError('');
    try {
      await login(email.trim(), password);
      router.push('/app/copiloto');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <DentaryBrand placement="header" />
      <form className="login-card" onSubmit={(e) => void submit(e)} aria-label="Ingreso de secretaría">
        <h1>Ingresá a Denta Copilot</h1>
        <p className="muted">Secretaría conectada a tu organización y sede.</p>
        <label>
          Correo
          <input
            type="email"
            autoComplete="username"
            value={email}
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={pending}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p role="alert" className="auth-error">{error}</p> : null}
        <button type="submit" className="primary" disabled={pending || !email.trim() || !password}>
          <LogIn size={15} />
          {pending ? 'Verificando…' : 'Ingresar'}
        </button>
        <p className="muted small">
          ¿Solo querés explorar? <Link href="/demo">Abrí la demostración local</Link> sin ingresar.
        </p>
      </form>
    </main>
  );
}
