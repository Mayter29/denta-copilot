// Pure composition of the authorized org/branch context from RLS reads.
// IO (Supabase selects with the user's JWT) lives in the route; this stays testable.
export type MembershipRow = { tenant_id: string; role: string };
export type BranchMembershipRow = { tenant_id: string; branch_id: string };
export type BranchRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  time_zone: string;
  active: boolean;
};
export type TenantRow = { id: string; slug: string; name: string };
export type OrgContext = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  timeZone: string;
  role: 'admin' | 'scheduler' | 'viewer';
};
const roles = ['admin', 'scheduler', 'viewer'] as const;

export function composeOrgContext(input: {
  memberships: MembershipRow[];
  branchMemberships: BranchMembershipRow[];
  branches: BranchRow[];
  tenants: TenantRow[];
}): OrgContext[] {
  const roleByTenant = new Map<string, (typeof roles)[number]>();
  for (const membership of input.memberships) {
    if (!(roles as readonly string[]).includes(membership.role)) continue;
    if (membership.tenant_id && !roleByTenant.has(membership.tenant_id))
      roleByTenant.set(membership.tenant_id, membership.role as (typeof roles)[number]);
  }
  const branchById = new Map(input.branches.filter((b) => b.active).map((b) => [b.id, b]));
  const tenantById = new Map(input.tenants.map((t) => [t.id, t]));
  const contexts: OrgContext[] = [];
  for (const link of input.branchMemberships) {
    const branch = branchById.get(link.branch_id);
    const tenant = tenantById.get(link.tenant_id);
    const role = roleByTenant.get(link.tenant_id);
    if (!branch || !tenant || !role) continue;
    if (branch.tenant_id !== tenant.id) continue;
    contexts.push({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      timeZone: branch.time_zone,
      role,
    });
  }
  return contexts.sort((a, b) =>
    `${a.tenantSlug}/${a.branchCode}` < `${b.tenantSlug}/${b.branchCode}` ? -1 : 1,
  );
}
