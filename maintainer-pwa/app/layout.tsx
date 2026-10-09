import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FixFlow - Maintainer PWA',
  description: 'Application mainteneurs externe',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold">FixFlow - Maintainer</p>
              <a href="/interventions" className="text-xs text-indigo-600">Mes interventions</a>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
