import { createElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import AppLayout from './layout';
import CopilotPage from './copiloto/page';

const state = vi.hoisted(() => ({
  selection: null as null | { tenantId: string; branchId: string },
  serviceWrites: true,
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock('@/lib/server/auth', () => ({ authSession: async () => ({ userId: 'demo-user' }) }));
vi.mock('@/lib/server/cookies', () => ({
  CONTEXT_COOKIE: 'denta-context',
  decodeSelection: () => null,
  renderCookieStore: async () => ({}),
}));
vi.mock('@/lib/server/session-context', () => ({
  loadSessionContext: async () => ({
    userId: 'demo-user',
    contexts: [],
    serviceWrites: state.serviceWrites,
  }),
  validSelection: () => state.selection,
}));
vi.mock('@/components/app/AppShell', () => ({ AppShell: () => null }));
vi.mock('@/components/app/CopilotArea', () => ({ CopilotArea: () => null }));

beforeEach(() => {
  state.selection = null;
  state.serviceWrites = true;
});

it('allows the branch selector to render without a selection or pathname header', async () => {
  const children = createElement('p', null, 'Seleccioná tu sede');
  const layout = await AppLayout({ children });
  expect(layout.props.children).toBe(children);
  expect(layout.props.selection).toBeNull();
});

it('keeps the copilot page behind branch selection', async () => {
  await expect(CopilotPage()).rejects.toThrow('redirect:/app/seleccionar-sede');
});

it('keeps the explicit configuration block when the server key is missing', async () => {
  state.serviceWrites = false;
  const children = createElement('p', null, 'Contenido protegido');
  const layout = await AppLayout({ children });
  expect(layout.props.serviceWrites).toBe(false);
  expect(layout.props.children.props.role).toBe('alert');
  expect(layout.props.children).not.toBe(children);
});
