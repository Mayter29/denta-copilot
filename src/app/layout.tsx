import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Denta · Dentary',
  icons: { icon: { url: '/brand/dentary/dentary-icon.svg', type: 'image/svg+xml' } },
  description: 'Denta helps a fictional dental clinic confirm, move, and follow up on visits.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
