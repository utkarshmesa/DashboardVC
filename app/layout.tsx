import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Motion from '@/components/Motion.client';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = { title: 'Pipeline · Seed round', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#07080a', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Before first paint: hide only what will animate in, and always release it within 2.5 s. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){var d=document.documentElement;d.classList.add('motion-pending');setTimeout(function(){d.classList.remove('motion-pending')},2500)}}catch(e){}" }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Motion />
        {children}
      </body>
    </html>
  );
}
