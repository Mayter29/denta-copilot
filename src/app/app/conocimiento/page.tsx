import { redirect } from 'next/navigation';
import { authSession } from '@/lib/server/auth';
import { CONTEXT_COOKIE, decodeSelection, renderCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, readerFor, validSelection } from '@/lib/server/session-context';
import { readBranchKnowledge } from '@/lib/server/connected-view';
import { BookOpen } from 'lucide-react';
import { cookies } from 'next/headers';

export default async function KnowledgePage() {
  const session = await authSession(await renderCookieStore());
  if (!session) redirect('/login');
  const context = await loadSessionContext(session);
  const jar = await cookies();
  const selection = validSelection(context.contexts, decodeSelection(jar.get(CONTEXT_COOKIE)?.value));
  if (!selection) redirect('/app/seleccionar-sede');
  const sources = await readBranchKnowledge(readerFor(session), {
    tenantId: selection.tenantId,
    branchId: selection.branchId,
  });
  return (
    <div className="area-page knowledge-page">
      <div className="context-heading">
        <div>
          <span className="eyebrow">CONTEXTO VERIFICABLE</span>
          <h2>Conocimiento de la sede</h2>
        </div>
      </div>
      {sources.length ? (
        sources.map((source) => (
          <article className="source" key={source.id}>
            <BookOpen size={17} />
            <div>
              <h3>{source.title}</h3>
              <p>{source.content}</p>
            </div>
          </article>
        ))
      ) : (
        <p className="muted" role="status">Sin fuentes publicadas para esta sede.</p>
      )}
    </div>
  );
}
