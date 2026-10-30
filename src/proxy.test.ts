import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

describe('proxy de áreas protegidas', () => {
  it('solo cubre /app y redirige a login sin cookie de sesión', () => {
    expect(config.matcher).toEqual(['/app/:path*']);
    const response = proxy(new NextRequest('http://127.0.0.1:3420/app/copiloto'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?next=%2Fapp%2Fcopiloto');
  });
  it('deja pasar con cookie y propaga la ruta al layout', () => {
    const request = new NextRequest('http://127.0.0.1:3420/app/agenda', {
      headers: { cookie: 'denta-auth=firmada.valor' },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
