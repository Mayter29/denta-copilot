import { z } from 'zod';

const contextSchema = z.object({
  tenantId: z.uuid(),
  tenantSlug: z.string(),
  tenantName: z.string(),
  branchId: z.uuid(),
  branchCode: z.string(),
  branchName: z.string(),
  timeZone: z.string(),
  role: z.enum(['admin', 'scheduler', 'viewer']),
});
const sessionSchema = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    userId: z.uuid(),
    contexts: z.array(contextSchema),
    serviceWrites: z.boolean(),
    patient: z.object({ available: z.literal(false), reason: z.string() }),
  }),
]);
export type AuthSessionState = z.infer<typeof sessionSchema>;
export type OrgSelection = { tenantId: string; branchId: string };

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message = z.object({ error: z.string() }).safeParse(data);
    throw new Error(message.success ? message.data.error : 'No se pudo completar la solicitud.');
  }
  return (await response.json().catch(() => null)) as unknown;
}

export async function login(email: string, password: string): Promise<{ userId: string }> {
  const parsed = z
    .object({ userId: z.uuid() })
    .safeParse(await postJson('/api/auth/login', { email, password }));
  if (!parsed.success) throw new Error('Respuesta de ingreso inválida.');
  return parsed.data;
}

export async function logout(): Promise<void> {
  await postJson('/api/auth/logout', {});
}

export async function selectContext(selection: OrgSelection): Promise<void> {
  const input = z.object({ tenantId: z.uuid(), branchId: z.uuid() }).parse(selection);
  await postJson('/api/auth/context', input);
}

export async function fetchSession(): Promise<AuthSessionState> {
  const response = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message = z.object({ error: z.string() }).safeParse(data);
    throw new Error(message.success ? message.data.error : 'No se pudo leer la sesión.');
  }
  const parsed = sessionSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new Error('Respuesta de sesión inválida.');
  return parsed.data;
}
