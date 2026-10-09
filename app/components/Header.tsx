'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import NotificationBell from '@/components/NotificationBell';

type UserInfo = {
  id: string;
  displayName: string;
  email: string;
  role: string;
};

type HeaderProps = {
  user: UserInfo | null;
  criticalTicketsCount?: number;
};

export default function Header({ user, criticalTicketsCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tickets/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  const canAccessBackoffice = isAdmin || isManager;

  const navigation = [
    { name: 'Tickets', href: '/tickets', current: pathname.startsWith('/tickets') },
    ...(canAccessBackoffice
      ? [{ name: 'Demandes', href: '/demandes', current: pathname === '/demandes' }]
      : user.role !== 'MAINTAINER'
        ? [{ name: 'Mes demandes', href: '/demandes/mine', current: pathname.startsWith('/demandes') }]
        : []),
    { name: 'Plans', href: '/plans', current: pathname.startsWith('/plans') },
    ...(canAccessBackoffice
      ? [{ name: 'Backoffice', href: '/backoffice', current: pathname.startsWith('/backoffice') }]
      : []),
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'MANAGER': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'MAINTAINER': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default: return 'bg-surface-alt text-muted';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Admin';
      case 'MANAGER': return 'Manager';
      case 'MAINTAINER': return 'Mainteneur';
      default: return 'Utilisateur';
    }
  };

  const cycleTheme = () => {
    const next: Record<string, 'dark' | 'light' | 'system'> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    setTheme(next[theme]);
  };

  const themeIcon = () => {
    if (theme === 'light') return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
    if (theme === 'dark') return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    );
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border-default bg-white/70 dark:bg-[#121821]/70 backdrop-blur-md">
      <div className="h-[2px] bg-[color:var(--accent)]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-12">
          {/* Logo + nav */}
          <div className="flex items-center">
            <Link href="/tickets" className="text-base font-bold text-foreground mr-6 lg:hidden">
              FixFlow
            </Link>
            <nav className="hidden sm:flex lg:hidden space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-2.5 py-1.5 text-sm font-medium rounded transition-colors ${
                    item.current
                      ? 'bg-[color:var(--primary)] text-[color:var(--surface)]'
                      : 'text-muted hover:text-foreground hover:bg-surface-alt'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Recherche */}
          <div className="hidden sm:flex flex-1 max-w-sm mx-4 items-center">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative flex items-center gap-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un ticket, un site, un équipement..."
                  className="w-full pl-8 pr-3 py-1 border border-border-default rounded text-sm bg-surface text-foreground placeholder-[color:var(--muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)] focus:border-[color:var(--accent)] transition-colors"
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <svg className="h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <Link
                  href="/tickets/search"
                  className="shrink-0 px-2 py-1 text-xs border border-border-default rounded text-muted hover:bg-surface-alt transition-colors"
                  title="Recherche avancée"
                >
                  Avancée
                </Link>
              </div>
            </form>
          </div>

          {/* Droite */}
          <div className="flex items-center space-x-2">
            {/* Badge critique */}
            {criticalTicketsCount > 0 && (
              <Link
                href="/tickets?priority=P1"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-[color:var(--accent)] text-[color:var(--accent)] bg-[#e8513b]/10 hover:bg-[#e8513b]/20 transition-colors"
              >
                <span className="tabular-nums">{criticalTicketsCount}</span> critique{criticalTicketsCount > 1 ? 's' : ''}
              </Link>
            )}

            <NotificationBell />

            {/* Toggle theme */}
            <button
              onClick={cycleTheme}
              aria-label={`Changer le theme (actuel : ${theme})`}
              className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-alt transition-colors"
              title={`Theme: ${theme}`}
            >
              {themeIcon()}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="Menu utilisateur"
                className="flex items-center space-x-2 text-sm focus:outline-none p-1 rounded hover:bg-surface-alt transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#e8513b]/15 flex items-center justify-center">
                  <span className="text-[color:var(--accent)] text-xs font-semibold">
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:flex items-center space-x-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {user.displayName}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getRoleBadgeColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </div>
                <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-border-default bg-surface shadow-soft-lg z-50">
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-xs text-muted border-b border-border-default">
                      {user.email}
                    </div>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        router.push('/tickets/preferences');
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt transition-colors"
                    >
                      Preferences notifications
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                      className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt transition-colors"
                    >
                      Se deconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Menu mobile */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="sm:hidden p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-alt transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="sm:hidden border-t border-border-default">
          <div className="py-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-4 py-2 text-sm font-medium transition-colors ${
                  item.current
                    ? 'bg-[color:var(--primary)] text-[color:var(--surface)]'
                    : 'text-muted hover:bg-surface-alt'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border-default">
            <form onSubmit={handleSearch}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un ticket..."
                className="w-full px-3 py-1.5 border border-border-default rounded text-sm bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)] transition-colors"
              />
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
