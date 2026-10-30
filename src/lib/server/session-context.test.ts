import { describe, expect, it } from 'vitest';
import { decodeSelection, encodeSelection } from './cookies';
import { validSelection } from './session-context';
import type { OrgContext } from '../domain/org-context';

const contexts: OrgContext[] = [
  {
    tenantId: '10000000-0000-4000-8000-000000000001',
    tenantSlug: 'brisa',
    tenantName: 'Brisa',
    branchId: '20000000-0000-4000-8000-000000000001',
    branchCode: 'central',
    branchName: 'Central',
    timeZone: 'America/Costa_Rica',
    role: 'scheduler',
  },
];

describe('selección de sede', () => {
  it('acepta solo selecciones dentro de los contextos autorizados', () => {
    expect(
      validSelection(contexts, { tenantId: contexts[0].tenantId, branchId: contexts[0].branchId })
        ?.branchName,
    ).toBe('Central');
    expect(
      validSelection(contexts, {
        tenantId: contexts[0].tenantId,
        branchId: '99999999-0000-4000-8000-000000000009',
      }),
    ).toBeNull();
    expect(validSelection(contexts, null)).toEqual(contexts[0]);
    expect(
      validSelection([], { tenantId: contexts[0].tenantId, branchId: contexts[0].branchId }),
    ).toBeNull();
  });
  it('solo elige automáticamente cuando existe una única sede autorizada', () => {
    expect(validSelection([], null)).toBeNull();
    const other = { ...contexts[0], branchId: '20000000-0000-4000-8000-000000000002' };
    expect(validSelection([...contexts, other], null)).toBeNull();
    expect(
      validSelection([...contexts, other], { tenantId: other.tenantId, branchId: other.branchId }),
    ).toEqual(other);
  });
  it('codifica y decodifica la selección; rechaza valores manipulados', () => {
    const encoded = encodeSelection({
      tenantId: contexts[0].tenantId,
      branchId: contexts[0].branchId,
    });
    expect(decodeSelection(encoded)).toEqual({
      tenantId: contexts[0].tenantId,
      branchId: contexts[0].branchId,
    });
    expect(decodeSelection('basura')).toBeNull();
    expect(decodeSelection(undefined)).toBeNull();
    expect(decodeSelection(Buffer.from('{"tenantId":"x"}').toString('base64url'))).toBeNull();
  });
  it('las claves de cliente incluyen usuario y sede (sin datos entre cuentas)', () => {
    const key = (userId: string, tenantId: string, branchId: string) =>
      `denta-conversation-${userId}-${tenantId}-${branchId}`;
    expect(key('u1', 't1', 'b1')).not.toBe(key('u2', 't1', 'b1'));
    expect(key('u1', 't1', 'b1')).not.toBe(key('u1', 't1', 'b2'));
  });
});
