import { doctors as localDoctors, services as localServices } from './types';
import { knowledge as localKnowledge } from './knowledge';

export type AgendaCatalog = {
  doctors: { id: string; name: string }[];
  services: { id: string; name: string; duration?: number; price?: number }[];
  knowledge: { id: string; title: string; content: string }[];
  hoursNote: string;
  timeZone: string;
};

export const LOCAL_CATALOG: AgendaCatalog = {
  doctors: localDoctors,
  services: localServices,
  knowledge: localKnowledge,
  hoursNote: 'Lun–vie 8:00–17:00 · Sáb 8:00–12:00',
  timeZone: 'America/Costa_Rica',
};
