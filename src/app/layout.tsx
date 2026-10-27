import type { Metadata } from 'next';
import { Fraunces, Source_Sans_3 } from 'next/font/google';
import './globals.css';
import './desk.css';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});
export const metadata: Metadata = {
  title: 'Denta · Dentary',
  icons: { icon: { url: '/brand/dentary/dentary-icon.svg', type: 'image/svg+xml' } },
  description: 'Reception desk for a fictional dental clinic. Confirm, reschedule, and follow up.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
