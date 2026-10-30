'use client';
import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useAppContext } from '@/components/app/AppShell';

type Source = { id: string; title: string; content: string };

export default function KnowledgePage() {
  const { selection } = useAppContext();
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selection) return;
    let active = true;
    void fetch(`/api/knowledge?tenantId=${selection.tenantId}&branchId=${selection.branchId}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar el conocimiento.');
        return (await response.json()) as { knowledge: Source[] };
      })
      .then((data) => {
        if (active) setSources(data.knowledge);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [selection]);
  return (
    <div className="area-page knowledge-page">
      <div className="context-heading">
        <div>
          <span className="eyebrow">CONTEXTO VERIFICABLE</span>
          <h2>Conocimiento de la sede</h2>
        </div>
      </div>
      {error ? <div className="error-message" role="alert">{error}</div> : null}
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
