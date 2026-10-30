import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authSession } from '@/lib/server/auth';
import { CONTEXT_COOKIE, decodeSelection, renderCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, readerFor, validSelection } from '@/lib/server/session-context';
import { readDayAgenda } from '@/lib/server/connected-view';
import { readBranchTimeZone } from '@/lib/server/connected-chat';
import { clinicToday } from '@/lib/domain/types';
import { DateAgenda } from '@/components/app/DateAgenda';

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await authSession(await renderCookieStore());
  if (!session) redirect('/login');
  const context = await loadSessionContext(session);
  const jar = await cookies();
  const selection = validSelection(context.contexts, decodeSelection(jar.get(CONTEXT_COOKIE)?.value));
  if (!selection) redirect('/app/seleccionar-sede');
  const { date } = await searchParams;
  const reader = readerFor(session);
  const timeZone = await readBranchTimeZone(reader, selection.branchId);
  const agenda = await readDayAgenda(reader, {
    tenantId: selection.tenantId,
    branchId: selection.branchId,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : clinicToday(),
    timeZone,
  });
  return (
    <DateAgenda
      initial={{ ...agenda, date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : clinicToday(), timeZone }}
    />
  );
}
