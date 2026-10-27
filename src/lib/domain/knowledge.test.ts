import { expect, it } from 'vitest';
import { retrieveKnowledge } from './knowledge';
it('recupera fuentes pertinentes con título y contenido', () => {
  const sources = retrieveKnowledge('precio valoración');
  expect(sources.some((s) => s.id === 'services')).toBe(true);
  expect(sources.length).toBeLessThanOrEqual(3);
});
it('no inventa documentos cuando no hay coincidencia', () => {
  expect(retrieveKnowledge('xyzzyq')).toEqual([]);
});
