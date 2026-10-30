// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DentaAvatar, type DentaPresence } from './DentaAvatar';
import { DentaMascot } from './DentaMascot';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderAvatar = (presence: DentaPresence, busy = false, level = 0) =>
  render(createElement(DentaAvatar, { busy, presence, level }));

describe('Denta viva (rig procedural)', () => {
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
  });
  it('pausa congela la animación desde el control accesible', () => {
    renderAvatar('reposo');
    const button = screen.getByRole('button', { name: 'Animación de Denta' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
  it('los IDs SVG son únicos entre instancias', () => {
    render(
      createElement(
        'div',
        null,
        createElement(DentaMascot, { size: 24 }),
        createElement(DentaMascot, { size: 48 }),
        createElement(DentaMascot, { size: 160 }),
      ),
    );
    const ids = Array.from(document.querySelectorAll('radialGradient, linearGradient')).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
  });
  it('una instancia pausada de historial no reacciona ni anima', () => {
    render(createElement(DentaMascot, { size: 29, blink: false, interactive: false, paused: true }));
    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('data-mood')).toBe('neutral');
    expect(svg?.querySelectorAll('path').length).toBe(4);
  });
  it('desmonta sin errores y sin listeners colgados', () => {
    const { unmount } = renderAvatar('escucha', false, 0.4);
    expect(screen.getByRole('button', { name: 'Animación de Denta' })).toBeTruthy();
    act(() => {
      unmount();
    });
    expect(screen.queryByRole('button', { name: 'Animación de Denta' })).toBeNull();
  });
});
