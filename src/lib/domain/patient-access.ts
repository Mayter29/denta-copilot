import { DomainError } from './agenda';

// The storage models appointments by fictitious patient_label only. There is no patient
// table and no verified link between auth.users and a patient, so NOTHING the browser
// sends — a name, a label, an appointment id, a URL parameter or a "patient mode"
// switch — can authorize access to "my appointments". Any patient flow must fail
// closed here until a verified patient link exists in the schema and the endpoint.
export const PATIENT_ACCESS_REASON =
  'El acceso de paciente no está habilitado: no existe un vínculo verificado entre tu identidad y una ficha. Tus citas las gestiona recepción por este copiloto.';

export function patientAccessStatus() {
  return { available: false as const, reason: PATIENT_ACCESS_REASON };
}

/** Fails closed for any patient-scoped action. Receptionist tools are unaffected. */
export function denyPatientAccess(action: string): never {
  if (!action.trim()) throw new DomainError('Acción inválida.');
  throw new DomainError(PATIENT_ACCESS_REASON);
}
