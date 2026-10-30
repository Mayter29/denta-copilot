// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DentaAvatar, type DentaPresence } from './DentaAvatar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderAvatar = (presence: DentaPresence, busy = false, level = 0) =>
  render(createElement(DentaAvatar, { busy, presence, level }));

describe('Denta viva', () => {
  it.each([
    ['reposo', 'neutral'],
    ['escucha', 'sorprendido'],
    ['transcribe', 'pensando'],
    ['consulta', 'pensando'],
    ['exito', 'feliz'],
  ] as [DentaPresence, string][])('presencia %s usa ánimo %s', (presence, mood) => {
    renderAvatar(presence);
    expect(document.querySelector('svg')?.getAttribute('data-mood')).toBe(mood);
    cleanup();
  });
  it('la consulta del chat prevalece salvo éxito confirmado', () => {
    renderAvatar('escucha', true);
    expect(document.querySelector('svg')?.getAttribute('data-mood')).toBe('pensando');
    cleanup();
    renderAvatar('escucha', false, 0.5);
    expect(document.querySelector('button')?.className).toContain('is-listening');
  });
  it('el nivel de micrófono solo anima al escuchar y respeta pausa', () => {
    renderAvatar('transcribe', false, 0.9);
    expect(document.querySelector('button')?.className).not.toContain('is-listening');
    cleanup();
    renderAvatar('reposo');
    const button = screen.getByRole('button', { name: 'Animación de Denta' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
  it('desmonta sin errores y sin observadores colgados', () => {
    const { unmount } = renderAvatar('escucha', false, 0.4);
    expect(screen.getByRole('button', { name: 'Animación de Denta' })).toBeTruthy();
    act(() => {
      unmount();
    });
    expect(screen.queryByRole('button', { name: 'Animación de Denta' })).toBeNull();
  });
});
