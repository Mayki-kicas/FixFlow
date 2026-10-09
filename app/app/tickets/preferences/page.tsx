import Link from 'next/link';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import NotificationPreferencesForm from '@/components/NotificationPreferencesForm';
import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';

export default async function TicketPreferencesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/signin');
  }

  const criticalCount = await getVisibleCriticalTicketsCountForUser(user);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link
                  href="/tickets"
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  ← Retour aux tickets
                </Link>
                <span className="text-muted">|</span>
                <h1 className="page-toolbar-title">Préférences notifications</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-surface border border-border-default rounded-xl p-4">
            <p className="text-xs text-muted mb-3">
              Configure quels événements doivent te notifier, et si tu souhaites recevoir les emails.
            </p>
            <NotificationPreferencesForm
              initialValues={{
                notifyTicketCreated: user.notifyTicketCreated,
                notifyStatusChanged: user.notifyStatusChanged,
                notifyNewMessage: user.notifyNewMessage,
                notifyDueDate: user.notifyDueDate,
                notifyEmailEnabled: user.notifyEmailEnabled,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

