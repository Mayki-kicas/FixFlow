'use client';

import { useState, useTransition } from 'react';
import { updateMyNotificationPreferences } from '@/lib/actions/notifications';
import { useToast } from '@/components/ToastProvider';

type NotificationPreferencesFormProps = {
  initialValues: {
    notifyTicketCreated: boolean;
    notifyStatusChanged: boolean;
    notifyNewMessage: boolean;
    notifyDueDate: boolean;
    notifyEmailEnabled: boolean;
  };
};

export default function NotificationPreferencesForm({ initialValues }: NotificationPreferencesFormProps) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const setFlag = (key: keyof typeof values, checked: boolean) => {
    setValues((prev) => ({ ...prev, [key]: checked }));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        await updateMyNotificationPreferences(values);
        toast.success('Préférences mises à jour.');
      } catch (error) {
        console.error(error);
        toast.error('Impossible de sauvegarder les préférences.');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="flex items-center justify-between gap-3 p-2 min-h-[44px] border border-border-default rounded-lg transition-colors hover:bg-surface-alt cursor-pointer">
          <span className="text-sm text-foreground">Nouveau ticket</span>
          <input type="checkbox" className="h-4 w-4 accent-[#e8513b]" checked={values.notifyTicketCreated} onChange={(e) => setFlag('notifyTicketCreated', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-3 p-2 min-h-[44px] border border-border-default rounded-lg transition-colors hover:bg-surface-alt cursor-pointer">
          <span className="text-sm text-foreground">Changement de statut</span>
          <input type="checkbox" className="h-4 w-4 accent-[#e8513b]" checked={values.notifyStatusChanged} onChange={(e) => setFlag('notifyStatusChanged', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-3 p-2 min-h-[44px] border border-border-default rounded-lg transition-colors hover:bg-surface-alt cursor-pointer">
          <span className="text-sm text-foreground">Nouveau message</span>
          <input type="checkbox" className="h-4 w-4 accent-[#e8513b]" checked={values.notifyNewMessage} onChange={(e) => setFlag('notifyNewMessage', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-3 p-2 min-h-[44px] border border-border-default rounded-lg transition-colors hover:bg-surface-alt cursor-pointer">
          <span className="text-sm text-foreground">Rappels d’échéance (J-1/J/J+1)</span>
          <input type="checkbox" className="h-4 w-4 accent-[#e8513b]" checked={values.notifyDueDate} onChange={(e) => setFlag('notifyDueDate', e.target.checked)} />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 p-2 min-h-[44px] border border-border-default rounded-lg transition-colors hover:bg-surface-alt cursor-pointer">
        <span className="text-sm text-foreground">Activer les emails</span>
        <input type="checkbox" className="h-4 w-4 accent-[#e8513b]" checked={values.notifyEmailEnabled} onChange={(e) => setFlag('notifyEmailEnabled', e.target.checked)} />
      </label>

      <div className="pt-2 border-t border-border-default">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending && (
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

