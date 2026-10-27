import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { DomainError, normalizeWorkspace, seedWorkspace } from '../domain/agenda';
import type { Workspace } from '../domain/types';

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function guardLocal(request: Request, mutation = false) {
  const host = request.headers.get('host') ?? '';
  if (process.env.DEMO_MODE !== 'true' || !/^(127\.0\.0\.1|localhost):3420$/.test(host))
    throw new RequestError('This demo only runs on localhost:3420.', 403);
  if (mutation && request.headers.get('origin') !== `http://${host}`)
    throw new RequestError('Invalid origin.', 403);
}
function signature(id: string) {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new RequestError('Set DEMO_SESSION_SECRET to at least 32 characters.', 503);
  return createHmac('sha256', secret).update(id).digest('hex');
}
export async function sessionId(create = false) {
  const jar = await cookies();
  const token = jar.get('denta-demo')?.value;
  if (token) {
    const [id, mac] = token.split('.');
    if (/^[0-9a-f-]{36}$/.test(id) && /^[0-9a-f]{64}$/.test(mac ?? '')) {
      const expected = signature(id);
      if (timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return id;
    }
  }
  if (!create) throw new RequestError('Open the demo to start a session.', 401);
  const id = randomUUID();
  jar.set('denta-demo', `${id}.${signature(id)}`, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 86400,
  });
  return id;
}
// One local Node process only. Replace with transactional Postgres before deployment.
const globalStore = globalThis as typeof globalThis & {
  dentaLocks?: Map<string, Promise<unknown>>;
};
const locks = (globalStore.dentaLocks ??= new Map());
export async function withWorkspace<T>(
  id: string,
  fn: (state: Workspace) => T | Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new RequestError('Invalid session.', 401);
  const previous = locks.get(id) ?? Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(async () => {
      const directory = path.join(process.cwd(), 'work', 'sessions');
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, `${id}.json`);
      let state: Workspace;
      try {
        state = normalizeWorkspace(JSON.parse(await readFile(file, 'utf8')) as Workspace);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        state = seedWorkspace();
      }
      const result = await fn(state);
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(state), 'utf8');
      await rename(temporary, file);
      return result;
    });
  locks.set(id, current);
  try {
    return await current;
  } finally {
    if (locks.get(id) === current) locks.delete(id);
  }
}
export async function boundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Empty request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 16_384) {
      await reader.cancel();
      throw new RequestError('Request is too large.', 413);
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RequestError('Invalid request.');
  }
}
export function apiError(error: unknown) {
  if (error instanceof RequestError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof DomainError) return Response.json({ error: error.message }, { status: 409 });
  // Provider errors may contain requests/headers: never serialize or log them.
  return Response.json(
    { error: 'The operation could not be completed. Check the connection and try again.' },
    { status: 502 },
  );
}
