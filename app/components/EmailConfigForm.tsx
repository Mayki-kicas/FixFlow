'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { updateEmailConfig, sendTestEmail } from '@/lib/actions/email-config';

type Security = 'NONE' | 'STARTTLS' | 'SSL';

type Props = {
  config: {
    enabled: boolean;
    host: string | null;
    port: number | null;
    security: string;
    username: string | null;
    fromName: string | null;
    fromEmail: string | null;
  };
  hasPassword: boolean;
  adminEmail: string;
};

export default function EmailConfigForm({ config, hasPassword, adminEmail }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    enabled: config.enabled,
    host: config.host ?? '',
    port: config.port != null ? String(config.port) : '',
    security: (['NONE', 'STARTTLS', 'SSL'].includes(config.security) ? config.security : 'STARTTLS') as Security,
    username: config.username ?? '',
    fromName: config.fromName ?? '',
    fromEmail: config.fromEmail ?? '',
  });

  const field = 'mt-1 block w-full rounded-lg border border-border-default bg-surface px-2.5 py-1.5 text-sm';

  const save = () =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          await updateEmailConfig({
            enabled: form.enabled,
            host: form.host,
            port: form.port ? Number(form.port) : null,
            security: form.security,
            username: form.username,
            fromName: form.fromName,
            fromEmail: form.fromEmail,
          });
          toast.success('Configuration email enregistrée.');
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Enregistrement impossible.');
        } finally {
          resolve();
        }
      });
    });

  const test = async () => {
    setTesting(true);
    try {
      const res = await sendTestEmail();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="card p-3 space-y-2.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Envoi d&apos;emails activé
        </label>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label className="block text-xs text-muted sm:col-span-2">Serveur SMTP (host)
            <input className={field} value={form.host} placeholder="smtp.exemple.com"
              onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">Port
            <input className={field} type="number" value={form.port} placeholder="587"
              onChange={(e) => setForm({ ...form, port: e.target.value })} />
          </label>
        </div>

        <label className="block text-xs text-muted">Sécurité
          <select className={field} value={form.security}
            onChange={(e) => setForm({ ...form, security: e.target.value as Security })}>
            <option value="STARTTLS">STARTTLS (port 587)</option>
            <option value="SSL">SSL/TLS implicite (port 465)</option>
            <option value="NONE">Aucune (dev / relais local)</option>
          </select>
        </label>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="block text-xs text-muted">Identifiant SMTP
            <input className={field} value={form.username} placeholder="user@exemple.com"
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </label>
          <div className="flex items-end">
            <span className={`badge ${hasPassword ? 'badge-success' : 'badge-warn'}`}>
              SMTP_PASSWORD {hasPassword ? 'présent' : 'manquant'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="block text-xs text-muted">Nom expéditeur
            <input className={field} value={form.fromName} placeholder="FixFlow"
              onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">Email expéditeur
            <input className={field} type="email" value={form.fromEmail} placeholder="noreply@exemple.com"
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
          </label>
        </div>
        <p className="text-[11px] text-muted">
          Le mot de passe SMTP se définit dans <span className="font-mono">.env</span> (SMTP_PASSWORD) — jamais ici.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit" disabled={pending}
          className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button" disabled={testing || pending}
          onClick={async () => { await save(); await test(); }}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-alt disabled:opacity-50"
        >
          {testing ? 'Envoi…' : `Envoyer un test à ${adminEmail}`}
        </button>
      </div>
    </form>
  );
}
