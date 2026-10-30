'use client';
import { useEffect, useState } from 'react';
import type { Appointment } from '@/lib/domain/types';
import type { AgendaCatalog } from '@/lib/domain/catalog';
import { AgendaPanel } from '@/components/AgendaPanel';
import { useAppContext } from '@/components/app/AppShell';

type AgendaData = {
  appointments: Appointment[];
  doctors: AgendaCatalog['doctors'];
  services: AgendaCatalog['services'];
  hoursNote: string;
  timeZone: string;
  date: string;
};

export default function AgendaPage() {
  const { selection } = useAppContext();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AgendaData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selection) return;
    let active = true;
    const query = `?tenantId=${selection.tenantId}&branchId=${selection.branchId}&date=${date}`;
    void fetch(`/api/agenda${query}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar la agenda.');
        return (await response.json()) as AgendaData;
      })
      .then((next) => {
        if (active) setData(next);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [selection, date]);
  if (!selection) return null;
  return (
    <div className="area-page">
      {error ? (
        <div className="error-message" role="alert">{error}</div>
      ) : null}
      {data ? (
        <AgendaPanel
          state={{ messages: [], proposals: [], appointments: data.appointments, audit: [] }}
          date={date}
          onDate={setDate}
          tab="agenda"
          onTab={() => {}}
          catalog={{
            doctors: data.doctors,
            services: data.services,
            knowledge: [],
            hoursNote: data.hoursNote,
            timeZone: data.timeZone,
          }}
        />
      ) : (
        <p role="status">Cargando agenda…</p>
      )}
    </div>
  );
}
