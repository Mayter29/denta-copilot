// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatProgress } from './ChatProgress';
import { useChatRequest } from './useChatRequest';

const transport = vi.hoisted(() => ({ sendChat: vi.fn() }));
vi.mock('@/lib/client/chat', () => transport);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('progreso, cancelación y respuestas tardías', () => {
  it('muestra actividad real con región accesible y botón de cancelar', async () => {
    let onProgress: ((p: { id: string; label: string }) => void) | undefined;
    transport.sendChat.mockImplementation(
      (_text: string, events: { onProgress?: (p: unknown) => void }) =>
        new Promise((resolve) => {
          onProgress = events.onProgress as typeof onProgress;
          setTimeout(() => {
            onProgress?.({ id: 'agenda', label: 'Consultando agenda' });
          }, 0);
          setTimeout(() => resolve({ messages: [], proposals: [], appointments: [], audit: [] }), 5);
        }),
    );
    const cancel = vi.fn();
    render(createElement(ChatProgress, { busy: true, progress: null, onCancel: cancel }));
    expect(screen.getByRole('status').textContent).toMatch('Conectando');
    expect(screen.getByRole('button', { name: 'Cancelar solicitud en curso' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud en curso' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    cleanup();

    render(
      createElement(ChatProgress, {
        busy: true,
        progress: { id: 'agenda', label: 'Consultando agenda' },
        onCancel: cancel,
      }),
    );
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toMatch('Consultando agenda');
  });

  it('no repite anuncios para la misma actividad consecutiva', async () => {
    const seen: string[] = [];
    transport.sendChat.mockImplementation(
      (_text: string, events: { onProgress?: (p: { id: string; label: string }) => void }) =>
        (async () => {
          events.onProgress?.({ id: 'availability', label: 'Buscando disponibilidad' });
          events.onProgress?.({ id: 'availability', label: 'Buscando disponibilidad' });
          events.onProgress?.({ id: 'proposal', label: 'Preparando propuesta' });
          return { messages: [], proposals: [], appointments: [], audit: [] };
        })(),
    );
    const { result } = renderHook(() => useChatRequest());
    let first: unknown;
    await act(async () => {
      first = await result.current.send('Buscá espacios');
    });
    expect(first).not.toBeNull();
    // El hook conserva solo el último estado distinto; hubo dos ids reales.
    expect(result.current.progress).toBeNull();
    expect(transport.sendChat).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([]);
  });

  it('cancelar detiene la espera y una respuesta tardía no modifica la UI', async () => {
    let resolveFirst!: (v: unknown) => void;
    let rejectFirst!: (e: unknown) => void;
    const firstProgress: { id: string; label: string }[] = [];
    transport.sendChat.mockImplementationOnce(
      (_text: string, events: { signal?: AbortSignal; onProgress?: (p: never) => void }) =>
        new Promise((resolve, reject) => {
          resolveFirst = resolve as typeof resolveFirst;
          rejectFirst = reject as typeof rejectFirst;
          events.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    transport.sendChat.mockImplementationOnce(async () => ({
      messages: [{ id: 'm2' }],
      proposals: [],
      appointments: [],
      audit: [],
    }));

    const { result } = renderHook(() => useChatRequest());
    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.send('Primera consulta');
    });
    expect(result.current.busy).toBe(true);
    act(() => result.current.cancel());
    await act(async () => {
      await pending;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.cancelled).toBe(true);

    // La respuesta tardía de la petición cancelada llega cuando ya hay otra petición.
    let second: unknown;
    await act(async () => {
      second = await result.current.send('Segunda consulta');
    });
    expect(second).not.toBeNull();
    // Resolver la primera después no debe reactivar ni cambiar el estado actual.
    await act(async () => {
      resolveFirst({ messages: [{ id: 'm1-tardío' }], proposals: [], appointments: [], audit: [] });
    });
    expect(result.current.busy).toBe(false);
    expect(rejectFirst).toBeTruthy();
    expect(firstProgress).toEqual([]);
  });

  it('un error no deja la UI en éxito y conserva el aviso', async () => {
    transport.sendChat.mockRejectedValueOnce(new Error('Alcanzaste el límite de esta sesión de demo.'));
    const { result } = renderHook(() => useChatRequest());
    let done: unknown = 'pending';
    await act(async () => {
      done = await result.current.send('Hola');
    });
    expect(done).toBeNull();
    expect(result.current.error).toMatch('límite');
    expect(result.current.busy).toBe(false);
    expect(result.current.progress).toBeNull();
  });
});
