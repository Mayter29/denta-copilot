import { describe, expect, it } from 'vitest';
import { CHAT_PROGRESS, progressForTool } from './chat-progress';

describe('progreso del chat', () => {
  it('mapea herramientas reales a estados breves sin exponer detalles internos', () => {
    expect(progressForTool('listAppointments')).toEqual(CHAT_PROGRESS.agenda);
    expect(progressForTool('findAvailability')).toEqual(CHAT_PROGRESS.availability);
    expect(progressForTool('searchKnowledge')).toEqual(CHAT_PROGRESS.knowledge);
    expect(progressForTool('proposeBooking')).toEqual(CHAT_PROGRESS.proposal);
    expect(progressForTool('proposeCancellation')).toEqual(CHAT_PROGRESS.proposal);
    expect(progressForTool('proposeReschedule')).toEqual(CHAT_PROGRESS.proposal);
  });
  it('no publica actividad para la entrega final ni herramientas desconocidas', () => {
    expect(progressForTool('submitResult')).toBeNull();
    expect(progressForTool('executeBooking')).toBeNull();
    expect(progressForTool('')).toBeNull();
  });
  it('usa etiquetas breves en español sin secretos ni argumentos', () => {
    for (const progress of Object.values(CHAT_PROGRESS)) {
      expect(progress.label.length).toBeLessThanOrEqual(30);
      expect(JSON.stringify(progress)).not.toMatch(/paciente|hora|query|token|key/i);
    }
  });
});
