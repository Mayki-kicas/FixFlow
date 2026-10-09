'use client';

import { usePathname } from 'next/navigation';
import AppSidebar from '@/components/AppSidebar';

type UserInfo = { id: string; displayName: string; email: string; role: string };

// Cadre applicatif : barre latérale persistante (desktop) + zone de contenu.
// Masqué sur les pages d'authentification et si non connecté.
export default function AppShell({ user, children }: { user: UserInfo | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = !user || pathname.startsWith('/auth');

  if (bare) {
    return <div className="app-shell">{children}</div>;
  }

  return (
    <div className="app-shell lg:flex lg:items-start">
      <AppSidebar user={user} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
