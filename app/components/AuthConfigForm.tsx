'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { updateAuthConfig } from '@/lib/actions/auth-config';

type Props = {
  config: {
    activeProvider: 'LDAP' | 'ENTRA' | 'LOCAL';
    ldapUrl: string | null;
    ldapSearchBase: string | null;
    ldapBindDn: string | null;
    entraTenantId: string | null;
    entraClientId: string | null;
  };
  hasLdapBindPassword: boolean;
  hasEntraSecret: boolean;
};

function SecretStatus({ present, envVar }: { present: boolean; envVar: string }) {
  return (
    <span className={`badge ${present ? 'badge-success' : 'badge-warn'}`}>
      {envVar} {present ? 'présent' : 'manquant'}
    </span>
  );
}

export default function AuthConfigForm({ config, hasLdapBindPassword, hasEntraSecret }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState<'LDAP' | 'ENTRA'>(config.activeProvider === 'ENTRA' ? 'ENTRA' : 'LDAP');
  const [form, setForm] = useState({
    ldapUrl: config.ldapUrl ?? '',
    ldapSearchBase: config.ldapSearchBase ?? '',
    ldapBindDn: config.ldapBindDn ?? '',
    entraTenantId: config.entraTenantId ?? '',
    entraClientId: config.entraClientId ?? '',
  });

  const field = 'mt-1 block w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm';

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            await updateAuthConfig({ activeProvider: provider, ...form });
            toast.success('Configuration enregistrée.');
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Enregistrement impossible.');
          }
        });
      }}
    >
      <div className="card p-3">
        <span className="card-head-title">Méthode SSO active</span>
        <p className="mt-1 text-xs text-muted">
          Le compte admin local reste toujours disponible, quelle que soit la méthode.
        </p>
        <div className="mt-3 flex gap-2">
          {(['LDAP', 'ENTRA'] as const).map((p) => (
            <button
              key={p} type="button" onClick={() => setProvider(p)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                provider === p
                  ? 'border-[color:var(--accent)] bg-[#e8513b]/10 text-foreground'
                  : 'border-border-default text-muted hover:text-foreground'
              }`}
            >
              {p === 'LDAP' ? 'LDAP / Active Directory' : 'Microsoft (Entra ID)'}
            </button>
          ))}
        </div>
      </div>

      {provider === 'LDAP' && (
        <div className="card p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="card-head-title">Paramètres LDAP</span>
            <SecretStatus present={hasLdapBindPassword} envVar="LDAP_BIND_PASSWORD" />
          </div>
          <label className="block text-xs text-muted">URL
            <input className={field} value={form.ldapUrl} placeholder="ldap://dc.exemple.local:389"
              onChange={(e) => setForm({ ...form, ldapUrl: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">Base de recherche (DN)
            <input className={field} value={form.ldapSearchBase} placeholder="DC=exemple,DC=local"
              onChange={(e) => setForm({ ...form, ldapSearchBase: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">Bind DN
            <input className={field} value={form.ldapBindDn} placeholder="CN=svc,OU=…,DC=exemple,DC=local"
              onChange={(e) => setForm({ ...form, ldapBindDn: e.target.value })} />
          </label>
        </div>
      )}

      {provider === 'ENTRA' && (
        <div className="card p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="card-head-title">Paramètres Microsoft Entra</span>
            <SecretStatus present={hasEntraSecret} envVar="ENTRA_CLIENT_SECRET" />
          </div>
          <label className="block text-xs text-muted">Tenant ID
            <input className={field} value={form.entraTenantId} placeholder="00000000-0000-0000-0000-000000000000"
              onChange={(e) => setForm({ ...form, entraTenantId: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">Client ID (Application ID)
            <input className={field} value={form.entraClientId} placeholder="00000000-0000-0000-0000-000000000000"
              onChange={(e) => setForm({ ...form, entraClientId: e.target.value })} />
          </label>
          <p className="text-[11px] text-muted">
            Redirect URI à déclarer côté Azure : <span className="font-mono">/api/auth/callback/azure-ad</span>
          </p>
        </div>
      )}

      <button
        type="submit" disabled={pending}
        className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
