import type { Metadata } from 'next';
import { Caveat, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-caveat',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'The Grid · Ops Center',
  description: 'Claim tiles. See others claim in real time.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${caveat.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-[var(--bg-base)] text-[var(--ink)] min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
