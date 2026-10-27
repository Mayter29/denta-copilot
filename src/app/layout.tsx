import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Denta Copilot · Tu recepción, conectada',
  description: 'Copiloto operativo para clínicas dentales. Demostración con datos ficticios.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
