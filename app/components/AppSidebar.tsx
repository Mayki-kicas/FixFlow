'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type UserInfo = { id: string; displayName: string; email: string; role: string };
type Item = { name: string; href: string };
type Group = { title?: string; items: Item[] };

// Navigation principale (barre latérale desktop). Regroupée par domaine, filtrée par rôle.
function buildGroups(role: string): Group[] {
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const canManage = isAdmin || isManager;

  const groups: Group[] = [
    {
      items: [
        { name: 'Tickets', href: '/tickets' },
        canManage
          ? { name: 'Demandes', href: '/demandes' }
          : role !== 'MAINTAINER'
            ? { name: 'Mes demandes', href: '/demandes/mine' }
            : { name: 'Mes demandes', href: '/demandes/mine' },
        { name: 'Plans', href: '/plans' },
      ].filter(Boolean) as Item[],
    },
  ];

  if (canManage) {
    groups.push({
      title: 'GMAO',
      items: [
        { name: 'Préventif', href: '/backoffice/preventif' },
        { name: 'Planification', href: '/backoffice/planning' },
        { name: 'Pièces & stock', href: '/backoffice/pieces' },
      ],
    });
    groups.push({
      title: 'Pilotage',
      items: [
        { name: 'Fiabilité', href: '/backoffice/fiabilite' },
        { name: 'Analytique', href: '/backoffice/analytique' },
        { name: 'Rapports', href: '/backoffice/incident-reports' },
        { name: 'Codes défaut', href: '/backoffice/codes-defaut' },
        { name: 'Exports', href: '/backoffice/exports' },
      ],
    });
    groups.push({
      title: 'Référentiel',
      items: [
        { name: 'Équipements', href: '/backoffice/equipments' },
        { name: 'Catégories', href: '/backoffice/categories' },
        { name: 'Localisations', href: '/backoffice/locations' },
        { name: 'Équipes', href: '/backoffice/teams' },
      ],
    });
    groups.push({
      title: 'Acteurs',
      items: [
        { name: 'Prestataires', href: '/backoffice/maintainers' },
        { name: 'Techniciens', href: '/backoffice/techniciens' },
        { name: 'Groupes', href: '/backoffice/groups' },
        ...(isAdmin ? [{ name: 'Utilisateurs & rôles', href: '/backoffice/users' }] : []),
      ],
    });
    if (isAdmin) {
      groups.push({
        title: 'Configuration',
        items: [
          { name: 'Réglages', href: '/backoffice/settings' },
          { name: 'Authentification', href: '/backoffice/auth' },
        ],
      });
    }
  }

  return groups;
}

// Un lien est actif si le chemin courant correspond (match le plus spécifique).
function isActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + '/')) return false;
  // Évite que /backoffice "capture" /backoffice/preventif : on ne garde que si aucun
  // autre href plus long ne matche aussi.
  return !allHrefs.some((h) => h !== href && h.startsWith(href + '/') && (pathname === h || pathname.startsWith(h + '/')));
}

export default function AppSidebar({ user }: { user: UserInfo }) {
  const pathname = usePathname();
  const groups = buildGroups(user.role);
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

  return (
    <aside className="hidden lg:flex lg:w-56 lg:flex-shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen border-r border-border-default bg-white/60 dark:bg-[#121821]/60 backdrop-blur">
      <div className="h-[2px] bg-[color:var(--accent)]" />
      <Link href="/tickets" className="flex items-center gap-2 px-4 py-3 text-base font-bold text-foreground">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#e8513b] text-xs font-extrabold text-white">F</span>
        FixFlow
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-3">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{group.title}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, allHrefs);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[color:var(--primary)] text-[color:var(--surface)]'
                        : 'text-muted hover:text-foreground hover:bg-surface-alt'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
