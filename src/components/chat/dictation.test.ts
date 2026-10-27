// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDictation } from './useDictation';
import { ChatComposer } from './ChatComposer';

const mic = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  callbacks: null as null | { onLimit: () => void; onInterrupted: () => void },
}));
const remote = vi.hoisted(() => vi.fn());
vi.mock('@/lib/client/microphone', () => ({
  MicrophoneCapture: class {
    constructor(callbacks: NonNullable<typeof mic.callbacks>) {
      mic.callbacks = callbacks;
    }
    start = mic.start;
    stop = mic.stop;
    cancel = mic.cancel;
  },
  microphoneError: (error: unknown) => (error instanceof Error ? error.message : 'Error de audio'),
}));
vi.mock('@/lib/client/transcription', async (original) => ({
  ...(await original<typeof import('@/lib/client/transcription')>()),
  transcribeWav: remote,
}));
const onTranscript = vi.fn();
const onActivityChange = vi.fn();
const audio = new Blob(['synthetic-wav']);
beforeEach(() => {
  vi.clearAllMocks();
  mic.callbacks = null;
  mic.start.mockResolvedValue(undefined);
  mic.stop.mockResolvedValue(audio);
  remote.mockResolvedValue('Solicitud ficticia transcrita');
  onTranscript.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const subject = () => renderHook(() => useDictation({ onTranscript, onActivityChange }));

it('graba, detiene y añade texto sin enviar chat; libera el bloqueo al terminar', async () => {
  const { result } = subject();
  await act(async () => {
    await result.current.start();
  });
  expect(result.current.phase).toBe('recording');
  expect(remote).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.stop();
  });
  expect(remote).toHaveBeenCalledTimes(1);
  expect(onTranscript).toHaveBeenCalledWith('Solicitud ficticia transcrita');
  expect(result.current.phase).toBe('idle');
  expect(onActivityChange).toHaveBeenLastCalledWith(false);
});
it('cancelar mientras se pide permiso ignora una concesión tardía', async () => {
  let grant: () => void = () => {};
  mic.start.mockReturnValue(
    new Promise<void>((resolve) => {
      grant = resolve;
    }),
  );
  const { result } = subject();
  let opening: Promise<void> | undefined;
  await act(async () => {
    opening = result.current.start();
  });
  expect(result.current.phase).toBe('requesting');
  act(() => result.current.cancel());
  await act(async () => {
    grant();
    await opening;
  });
  expect(result.current.phase).toBe('idle');
  expect(mic.cancel).toHaveBeenCalled();
  expect(remote).not.toHaveBeenCalled();
});
it('una respuesta tardía tras cancelar no cambia el borrador', async () => {
  let reply: (text: string) => void = () => {};
  remote.mockReturnValue(
    new Promise<string>((resolve) => {
      reply = resolve;
    }),
  );
  const { result } = subject();
  let stopping: Promise<void> | undefined;
  await act(async () => {
    await result.current.start();
  });
  await act(async () => {
    stopping = result.current.stop();
  });
  expect(result.current.phase).toBe('transcribing');
  const signal = remote.mock.calls[0][1] as AbortSignal;
  act(() => result.current.cancel());
  expect(signal.aborted).toBe(true);
  await act(async () => {
    reply('Texto que ya no corresponde');
    await stopping;
  });
  expect(onTranscript).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('idle');
});
it('fallo conserva audio para reintentar sin volver a abrir el micrófono', async () => {
  remote.mockRejectedValueOnce(new Error('Meta no está disponible'));
  const { result } = subject();
  await act(async () => {
    await result.current.start();
    await result.current.stop();
  });
  expect(result.current.phase).toBe('retry');
  await act(async () => {
    result.current.retry();
  });
  expect(remote).toHaveBeenCalledTimes(2);
  expect(remote.mock.calls[0][0]).toBe(remote.mock.calls[1][0]);
  expect(mic.start).toHaveBeenCalledTimes(1);
  expect(result.current.phase).toBe('idle');
});
it('conserva texto que no cabe y exige decisión antes de reemplazar el borrador', async () => {
  onTranscript.mockReturnValue(false);
  const { result } = subject();
  await act(async () => {
    await result.current.start();
    await result.current.stop();
  });
  expect(result.current.phase).toBe('review');
  expect(result.current.transcript).toBe('Solicitud ficticia transcrita');
  expect(onActivityChange).toHaveBeenLastCalledWith(true);
  act(() => result.current.finishReview());
  expect(result.current.phase).toBe('idle');
});
it.each(['visibilitychange', 'pagehide'])(
  'abandonar la página descarta la captura: %s',
  async (event) => {
    const { result } = subject();
    await act(async () => {
      await result.current.start();
    });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      (event === 'pagehide' ? window : document).dispatchEvent(new Event(event));
    });
    expect(mic.cancel).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
    expect(remote).not.toHaveBeenCalled();
    expect(onActivityChange).toHaveBeenLastCalledWith(false);
  },
);
it('desmontar aborta la petición e ignora la transcripción que llega después', async () => {
  let reply: (text: string) => void = () => {};
  remote.mockReturnValue(
    new Promise<string>((resolve) => {
      reply = resolve;
    }),
  );
  const { result, unmount } = subject();
  let stopping: Promise<void> | undefined;
  await act(async () => {
    await result.current.start();
  });
  await act(async () => {
    stopping = result.current.stop();
  });
  const signal = remote.mock.calls[0][1] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    reply('Texto tardío');
    await stopping;
  });
  expect(onTranscript).not.toHaveBeenCalled();
});
it('el límite automático pasa por el mismo stop y transcribe solo una vez', async () => {
  const { result } = subject();
  await act(async () => {
    await result.current.start();
  });
  await act(async () => {
    mic.callbacks?.onLimit();
    mic.callbacks?.onLimit();
  });
  expect(mic.stop).toHaveBeenCalledTimes(1);
  expect(remote).toHaveBeenCalledTimes(1);
});
it('UI de micrófono conserva el borrador, bloquea enviar al grabar y nunca abre un selector', async () => {
  const change = vi.fn();
  const send = vi.fn();
  render(
    createElement(ChatComposer, {
      draft: 'Texto previo',
      onDraftChange: change,
      onSend: send,
      disabled: false,
      busy: false,
      onActivityChange,
      textareaRef: { current: null },
    }),
  );
  expect(document.querySelector('input[type=file]')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Record with microphone' }));
  });
  expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(true);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Stop and transcribe' }));
  });
  expect(change).toHaveBeenCalledWith('Texto previo\nSolicitud ficticia transcrita');
  expect(send).not.toHaveBeenCalled();
});
