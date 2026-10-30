import { describe, expect, it } from 'vitest';
import { composeOrgContext } from './org-context';

const tenants = [
  { id: 't1', slug: 'brisa-demo', name: 'Brisa Demo' },
  { id: 't2', slug: 'luna-demo', name: 'Luna Demo' },
];
const branches = [
  { id: 'b1', tenant_id: 't1', code: 'central', name: 'Central', time_zone: 'America/Costa_Rica', active: true },
  { id: 'b2', tenant_id: 't1', code: 'norte', name: 'Norte', time_zone: 'America/Costa_Rica', active: false },
  { id: 'b3', tenant_id: 't2', code: 'central', name: 'Central Luna', time_zone: 'America/Costa_Rica', active: true },
];

describe('contexto autorizado de organización y sede', () => {
  it('compone solo sedes activas con membresía y rol válido', () => {
    const contexts = composeOrgContext({
      memberships: [
        { tenant_id: 't1', role: 'scheduler' },
        { tenant_id: 't2', role: 'viewer' },
      ],
      branchMemberships: [
        { tenant_id: 't1', branch_id: 'b1' },
        { tenant_id: 't1', branch_id: 'b2' },
        { tenant_id: 't2', branch_id: 'b3' },
      ],
      branches,
      tenants,
    });
    expect(contexts).toHaveLength(2);
    expect(contexts[0]).toMatchObject({ tenantSlug: 'brisa-demo', branchCode: 'central', role: 'scheduler' });
    expect(contexts[1]).toMatchObject({ tenantSlug: 'luna-demo', role: 'viewer' });
  });
  it('ignora vínculos cruzados, roles desconocidos e inactivos', () => {
    expect(
      composeOrgContext({
        memberships: [{ tenant_id: 't1', role: 'superadmin' }],
        branchMemberships: [{ tenant_id: 't2', branch_id: 'b1' }],
        branches,
        tenants,
      }),
    ).toEqual([]);
  });
});
