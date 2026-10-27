import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Denta Copilot · Dentary',
  icons: { icon: { url: '/brand/dentary/dentary-icon.svg', type: 'image/svg+xml' } },
  description: 'Copiloto operativo para clínicas dentales. Demostración con datos ficticios.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
