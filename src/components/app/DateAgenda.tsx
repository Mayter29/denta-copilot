'use client';
import { useState } from 'react';
import type { Appointment } from '@/lib/domain/types';
import type { AgendaCatalog } from '@/lib/domain/catalog';
import { AgendaPanel } from '@/components/AgendaPanel';
import { useAppContext } from '@/components/app/AppShell';

export type AgendaData = {
  appointments: Appointment[];
  doctors: AgendaCatalog['doctors'];
  services: AgendaCatalog['services'];
  hoursNote: string;
  timeZone: string;
  date: string;
};

export function DateAgenda({ initial }: { initial: AgendaData }) {
  const { selection } = useAppContext();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  async function changeDate(next: string) {
    if (!selection || !next) return;
    setError('');
    try {
      const query = `?tenantId=${selection.tenantId}&branchId=${selection.branchId}&date=${next}`;
      const response = await fetch(`/api/agenda${query}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar la agenda.');
      setData((await response.json()) as AgendaData);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="area-page">
      {error ? (
        <div className="error-message" role="alert">{error}</div>
      ) : null}
      <AgendaPanel
        state={{ messages: [], proposals: [], appointments: data.appointments, audit: [] }}
        date={data.date}
        onDate={(next) => void changeDate(next)}
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
    </div>
  );
}
