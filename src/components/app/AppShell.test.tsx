// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/lib/domain/org-context';
import { AppShell } from './AppShell';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const remote = vi.hoisted(() => ({ logout: vi.fn(), select: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/copiloto',
  useRouter: () => navigation,
}));
vi.mock('@/lib/client/auth', () => ({ logout: remote.logout, selectContext: remote.select }));
vi.mock('../brand/DentaryBrand', () => ({
  DentaryBrand: () => createElement('span', null, 'Dentary'),
}));

const context: OrgContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  tenantSlug: 'demo',
  tenantName: 'Clínica ficticia',
  branchId: '20000000-0000-4000-8000-000000000001',
  branchCode: 'central',
  branchName: 'Central',
  timeZone: 'America/Costa_Rica',
  role: 'scheduler',
};
const otherBranch = {
  ...context,
  branchId: '20000000-0000-4000-8000-000000000002',
  branchName: 'Norte',
};
const userId = '00000000-0000-4000-8000-000000000001';
const draftKey = `denta-draft-${userId}-${context.tenantId}-${context.branchId}`;
const otherDraft = 'denta-draft-other-user-private';
const desktop = () => within(screen.getByRole('navigation', { name: 'Navegación principal' }));
const subject = () =>
  render(
    <AppShell userId={userId} contexts={[context, otherBranch]} selection={context} serviceWrites>
      <p>Área de trabajo</p>
    </AppShell>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  remote.logout.mockResolvedValue(undefined);
  remote.select.mockResolvedValue(undefined);
  localStorage.clear();
  localStorage.setItem(draftKey, 'Borrador ficticio');
  localStorage.setItem(otherDraft, 'Otro usuario');
});
afterEach(cleanup);

it('permite seleccionar la única sede disponible cuando todavía no hay sede activa', async () => {
  render(
    <AppShell userId={userId} contexts={[context]} selection={null} serviceWrites>
      <p>Elegí una sede</p>
    </AppShell>,
  );
  const select = desktop().getByRole('combobox', { name: 'Sede activa' });
  expect(select.hasAttribute('disabled')).toBe(false);
  await act(async () => {
    fireEvent.change(select, { target: { value: `${context.tenantId}/${context.branchId}` } });
  });
  expect(remote.select).toHaveBeenCalledWith({
    tenantId: context.tenantId,
    branchId: context.branchId,
  });
  expect(navigation.refresh).toHaveBeenCalledTimes(1);
});

it('conserva sesión y borrador al fallar el cierre; permite reintentar', async () => {
  remote.logout.mockRejectedValueOnce(new Error('No se pudo cerrar la sesión.'));
  subject();
  await act(async () => {
    fireEvent.click(desktop().getByRole('button', { name: 'Cerrar sesión' }));
  });
  expect(desktop().getByRole('alert').textContent).toContain('No se pudo cerrar la sesión.');
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(navigation.refresh).not.toHaveBeenCalled();
  expect(localStorage.getItem(draftKey)).toBe('Borrador ficticio');
  await act(async () => {
    fireEvent.click(desktop().getByRole('button', { name: 'Cerrar sesión' }));
  });
  expect(navigation.replace).toHaveBeenCalledWith('/login');
  expect(localStorage.getItem(draftKey)).toBeNull();
  expect(localStorage.getItem(otherDraft)).toBe('Otro usuario');
});

it('bloquea acciones de sesión simultáneas mientras espera la respuesta del servidor', async () => {
  let complete = () => {};
  remote.logout.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  subject();
  fireEvent.click(desktop().getByRole('button', { name: 'Cerrar sesión' }));
  const button = desktop().getByRole('button', { name: 'Cerrando sesión…' });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.click(button);
  expect(remote.logout).toHaveBeenCalledTimes(1);
  expect(navigation.replace).not.toHaveBeenCalled();
  await act(async () => {
    complete();
  });
  expect(navigation.replace).toHaveBeenCalledWith('/login');
});

it('muestra el fallo al cambiar de sede sin refrescar ni alterar la selección activa', async () => {
  remote.select.mockRejectedValueOnce(new Error('Sin acceso a esa sede.'));
  subject();
  const select = desktop().getByRole('combobox', { name: 'Sede activa' }) as HTMLSelectElement;
  await act(async () => {
    fireEvent.change(select, { target: { value: `${context.tenantId}/${otherBranch.branchId}` } });
  });
  expect(remote.select).toHaveBeenCalledWith({
    tenantId: context.tenantId,
    branchId: otherBranch.branchId,
  });
  expect(desktop().getByRole('alert').textContent).toContain('Sin acceso');
  expect(navigation.refresh).not.toHaveBeenCalled();
  expect(select.value).toBe(`${context.tenantId}/${context.branchId}`);
});
