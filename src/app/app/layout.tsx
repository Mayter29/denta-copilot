import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authSession } from '@/lib/server/auth';
import { CONTEXT_COOKIE, decodeSelection, renderCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, validSelection } from '@/lib/server/session-context';
import { AppShell } from '@/components/app/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await authSession(await renderCookieStore());
  if (!session) redirect('/login');
  const context = await loadSessionContext(session);
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/app/copiloto';
  const jar = await cookies();
  const selection = validSelection(
    context.contexts,
    decodeSelection(jar.get(CONTEXT_COOKIE)?.value),
  );
  const onSelector = pathname.startsWith('/app/seleccionar-sede');
  if (!context.serviceWrites) {
    return (
      <AppShell
        userId={context.userId}
        contexts={context.contexts}
        selection={selection}
        serviceWrites={false}
      >
        {onSelector ? (
          children
        ) : (
          <section className="config-unavailable" role="alert">
            <h1>Configuración no disponible</h1>
            <p>
              Tu sesión está verificada, pero el servidor no tiene configurada la escritura remota.
              No se activó ninguna agenda local. Configurá la clave de servicio fuera del chat y
              volvé a ingresar.
            </p>
          </section>
        )}
      </AppShell>
    );
  }
  if (!selection && !onSelector) redirect('/app/seleccionar-sede');
  return (
    <AppShell
      userId={context.userId}
      contexts={context.contexts}
      selection={selection}
      serviceWrites={context.serviceWrites}
    >
      {children}
    </AppShell>
  );
}
