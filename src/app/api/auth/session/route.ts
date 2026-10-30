import { cookies } from 'next/headers';
import { authSession, userSupabase, type CookieStore } from '@/lib/server/auth';
import { composeOrgContext } from '@/lib/domain/org-context';
import { isServiceWritesConfigured } from '@/lib/supabase/service';
import { apiError, guardLocal } from '@/lib/server/workspace';
import { z } from 'zod';
export const runtime = 'nodejs';
const membershipSchema = z.array(z.object({ tenant_id: z.uuid(), role: z.string() }));
const linkSchema = z.array(z.object({ tenant_id: z.uuid(), branch_id: z.uuid() }));
const branchSchema = z.array(
  z.object({
    id: z.uuid(),
    tenant_id: z.uuid(),
    code: z.string(),
    name: z.string(),
    time_zone: z.string(),
    active: z.boolean(),
  }),
);
const tenantSchema = z.array(z.object({ id: z.uuid(), slug: z.string(), name: z.string() }));

function storeFromJar(jar: { get: (n: string) => { value: string } | undefined }): CookieStore {
  return { get: (name) => jar.get(name)?.value, set: () => {}, clear: () => {} };
}

export async function GET(request: Request) {
  try {
    guardLocal(request);
    const jar = await cookies();
    const session = await authSession(storeFromJar(jar));
    if (!session) return Response.json({ authenticated: false as const });
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
    return Response.json({
      authenticated: true as const,
      userId: session.userId,
      contexts: composeOrgContext({
        memberships: membershipSchema.parse(memberships.data ?? []),
        branchMemberships: linkSchema.parse(links.data ?? []),
        branches: branchSchema.parse(branches.data ?? []),
        tenants: tenantSchema.parse(tenants.data ?? []),
      }),
      serviceWrites: isServiceWritesConfigured(),
    });
  } catch (error) {
    return apiError(error);
  }
}
