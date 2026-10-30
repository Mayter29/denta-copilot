import 'server-only';
import { z } from 'zod';
import { composeOrgContext, type OrgContext } from '../domain/org-context';
import { patientAccessStatus } from '../domain/patient-access';
import { isServiceWritesConfigured } from '../supabase/service';
import { userSupabase, type AuthSession } from './auth';
import { asReaderClient, type ReaderClient } from './connected-view';

const membershipSchema = z.array(z.object({ tenant_id: z.uuid(), role: z.string() }));
const linkSchema = z.array(z.object({ tenant_id: z.uuid(), branch_id: z.uuid() }));
const branchSchema = z.array(
  z.object({
    id: z.uuid(), tenant_id: z.uuid(), code: z.string(), name: z.string(),
    time_zone: z.string(), active: z.boolean(),
  }),
);
const tenantSchema = z.array(z.object({ id: z.uuid(), slug: z.string(), name: z.string() }));

export type SessionContext = {
  userId: string;
  contexts: OrgContext[];
  serviceWrites: boolean;
  patient: ReturnType<typeof patientAccessStatus>;
};

/** Authorized org/branch context for a verified session. RLS applies via the user token. */
export async function loadSessionContext(session: AuthSession): Promise<SessionContext> {
  const client = userSupabase(session.accessToken);
  const [memberships, links, branches, tenants] = await Promise.all([
    client.from('dc_memberships').select('tenant_id,role'),
    client.from('dc_branch_memberships').select('tenant_id,branch_id'),
    client.from('dc_branches').select('id,tenant_id,code,name,time_zone,active'),
    client.from('dc_tenants').select('id,slug,name'),
  ]);
  for (const result of [memberships, links, branches, tenants]) {
    if (result.error) throw new Error('No se pudo leer el contexto autorizado.');
  }
  return {
    userId: session.userId,
    contexts: composeOrgContext({
      memberships: membershipSchema.parse(memberships.data ?? []),
      branchMemberships: linkSchema.parse(links.data ?? []),
      branches: branchSchema.parse(branches.data ?? []),
      tenants: tenantSchema.parse(tenants.data ?? []),
    }),
    serviceWrites: isServiceWritesConfigured(),
    patient: patientAccessStatus(),
  };
}

export function readerFor(session: AuthSession): ReaderClient {
  return asReaderClient(userSupabase(session.accessToken));
}

/** Validates a requested selection against the authorized contexts. Never trusts the browser alone. */
export function validSelection(
  contexts: OrgContext[],
  selection: { tenantId: string; branchId: string } | null,
): OrgContext | null {
  if (!selection) return null;
  return (
    contexts.find((c) => c.tenantId === selection.tenantId && c.branchId === selection.branchId) ??
    null
  );
}
