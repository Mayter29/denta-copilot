import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authSession } from '@/lib/server/auth';
import { CONTEXT_COOKIE, decodeSelection, renderCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, validSelection } from '@/lib/server/session-context';
import { CopilotArea } from '@/components/app/CopilotArea';

export default async function CopilotPage() {
  const session = await authSession(await renderCookieStore());
  if (!session) redirect('/login');
  const context = await loadSessionContext(session);
  const jar = await cookies();
  const selection = validSelection(
    context.contexts,
    decodeSelection(jar.get(CONTEXT_COOKIE)?.value),
  );
  // This guard belongs to the page: shared layouts retain state across navigation.
  if (!selection) redirect('/app/seleccionar-sede');
  return <CopilotArea key={`${context.userId}-${selection.tenantId}-${selection.branchId}`} />;
}
