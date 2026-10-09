'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

type DevRole = 'ADMIN' | 'MANAGER' | 'MAINTAINER' | 'BASIC';

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [entraActive, setEntraActive] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isDevBypassEnabled = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';

  useEffect(() => {
    setIsHydrated(true);
    // Un refus OAuth (compte non encore autorisé) revient ici en ?error=AccessDenied.
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'AccessDenied') {
      router.replace('/auth/pending');
      return;
    }
    // Affiche le bouton Microsoft uniquement si le provider Entra est actif.
    getProviders()
      .then((providers) => setEntraActive(Boolean(providers && 'azure-ad' in providers)))
      .catch(() => setEntraActive(false));
  }, [router]);

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHydrated) return;
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Compte authentifié mais sans accès accordé → message dédié.
        if (result.error.includes('attente de validation')) {
          router.replace('/auth/pending');
          return;
        }
        setError(result.error.includes('tentatives') ? result.error : 'Identifiants incorrects');
      } else {
        router.replace('/');
        router.refresh();
      }
    } catch (err) {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = async (role: DevRole) => {
    if (!isHydrated) return;
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username: '__dev__',
        password: '__dev__',
        devRole: role,
        redirect: false,
      });

      if (result?.error) {
        setError(`Connexion dev impossible pour le rôle ${role}`);
      } else {
        router.replace('/');
        router.refresh();
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const cycleTheme = () => {
    const next: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    setTheme(next[theme]);
  };

  const themeIcon = () => {
    if (theme === 'light') {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    }
    if (theme === 'dark') {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      );
    }
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-transparent px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center">
        <div className="w-full rounded-xl border border-border-default bg-surface p-4 shadow-soft-md">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-alt px-2 py-1 text-xs text-muted transition-colors hover:bg-surface"
              title={`Theme: ${theme}`}
              aria-label={`Changer le thème (${theme})`}
            >
              {themeIcon()}
              <span>{theme}</span>
            </button>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground text-center">
            FixFlow
          </h2>
          <p className="mt-1 text-center text-xs text-muted">
            Connectez-vous avec vos identifiants LDAP
          </p>

          <form method="post" className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
              >
                Nom d&apos;utilisateur
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={submitOnEnter}
                disabled={!isHydrated || loading}
                className="block w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
              >
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={submitOnEnter}
                disabled={!isHydrated || loading}
                className="block w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isHydrated || loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-sm font-medium text-[color:var(--surface)] transition-colors hover:bg-[color:var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {entraActive && (
            <div className="mt-4 border-t border-border-default pt-3">
              <button
                type="button"
                disabled={!isHydrated || loading}
                onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Se connecter avec Microsoft
              </button>
            </div>
          )}

          {isDevBypassEnabled && (
            <div className="mt-4 border-t border-border-default pt-3">
              <p className="mb-2 text-xs text-muted">
                Connexion rapide DEV (bypass LDAP)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isHydrated || loading}
                  onClick={() => handleDevSignIn('ADMIN')}
                  className="rounded-lg border border-border-default bg-surface-alt px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ADMIN
                </button>
                <button
                  type="button"
                  disabled={!isHydrated || loading}
                  onClick={() => handleDevSignIn('MANAGER')}
                  className="rounded-lg border border-border-default bg-surface-alt px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  MANAGER
                </button>
                <button
                  type="button"
                  disabled={!isHydrated || loading}
                  onClick={() => handleDevSignIn('MAINTAINER')}
                  className="rounded-lg border border-border-default bg-surface-alt px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  MAINTAINER
                </button>
                <button
                  type="button"
                  disabled={!isHydrated || loading}
                  onClick={() => handleDevSignIn('BASIC')}
                  className="rounded-lg border border-border-default bg-surface-alt px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  BASIC
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
