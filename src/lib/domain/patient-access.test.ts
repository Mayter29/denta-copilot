import { describe, expect, it } from 'vitest';
import { denyPatientAccess, PATIENT_ACCESS_REASON, patientAccessStatus } from './patient-access';
import { DomainError } from './agenda';

describe('acceso de paciente', () => {
  it('está deshabilitado con un motivo explícito, sin modo paciente simulado', () => {
    expect(patientAccessStatus()).toEqual({ available: false, reason: PATIENT_ACCESS_REASON });
  });
  it.each([
    ['listar mis citas por nombre', 'list'],
    ['reservar como paciente', 'book'],
    ['cancelar mi cita por ID', 'cancel'],
    ['reagendar con patient_label', 'reschedule'],
  ])('deniega %s aunque traiga identificadores', (_label, action) => {
    expect(() => denyPatientAccess(action)).toThrow(DomainError);
    expect(() => denyPatientAccess(action)).toThrow('recepción');
  });
  it('no acepta acciones vacías ni filtra datos', () => {
    expect(() => denyPatientAccess('  ')).toThrow('inválida');
    expect(PATIENT_ACCESS_REASON).not.toMatch(/@|tel|password/i);
  });
});
