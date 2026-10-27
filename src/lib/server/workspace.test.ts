import { afterEach, expect, it, vi } from 'vitest';
import { boundedJson, guardLocal } from './workspace';
afterEach(() => vi.unstubAllEnvs());
it('rechaza otro origen, host y demo deshabilitada', () => {
  vi.stubEnv('DEMO_MODE', 'true');
  expect(() =>
    guardLocal(
      new Request('http://localhost:3420', {
        headers: { host: '127.0.0.1:3420', origin: 'http://evil.example' },
      }),
      true,
    ),
  ).toThrow('Origen');
  expect(() =>
    guardLocal(new Request('http://example.com', { headers: { host: 'example.com' } })),
  ).toThrow('localhost');
  vi.stubEnv('DEMO_MODE', 'false');
  expect(() =>
    guardLocal(new Request('http://localhost:3420', { headers: { host: 'localhost:3420' } })),
  ).toThrow();
});
it('acepta exactamente el origen y host locales', () => {
  vi.stubEnv('DEMO_MODE', 'true');
  expect(() =>
    guardLocal(
      new Request('http://localhost:3420', {
        headers: { host: '127.0.0.1:3420', origin: 'http://127.0.0.1:3420' },
      }),
      true,
    ),
  ).not.toThrow();
});
it('limita el cuerpo antes de parsear JSON', async () => {
  await expect(
    boundedJson(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(17000) })),
  ).rejects.toThrow('grande');
});
