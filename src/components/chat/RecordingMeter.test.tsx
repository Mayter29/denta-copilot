// @vitest-environment happy-dom
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { WAVE_BARS } from '@/lib/client/wave';
import { RecordingMeter } from './RecordingMeter';

afterEach(cleanup);
const bars = () => screen.getByRole('status').querySelectorAll<HTMLElement>('.recording-wave span');

it('dibuja los niveles medidos y el reloj contra el límite', () => {
  render(createElement(RecordingMeter, { levels: [0, 0.5, 1], seconds: 65, label: 'Grabando dictado' }));
  const status = screen.getByRole('status', { name: 'Grabando dictado' });
  expect(bars().length).toBe(3);
  expect(bars()[0].style.height).toBe('2px');
  expect(bars()[1].style.height).toBe('19px');
  expect(bars()[2].style.height).toBe('36px');
  expect(status.textContent).toContain('1:05 / 1:00');
});

it('sin señal muestra el bloque en reposo, gris y sin movimiento', () => {
  render(createElement(RecordingMeter, { levels: [], seconds: 0, label: 'Grabando dictado' }));
  expect(bars().length).toBe(WAVE_BARS);
  expect([...bars()].every((bar) => bar.style.height === '2px')).toBe(true);
  expect(screen.getByRole('status').querySelector('.recording-wave.silent')).not.toBeNull();
});
