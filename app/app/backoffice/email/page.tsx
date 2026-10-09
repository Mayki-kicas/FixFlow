import Link from 'next/link';
import Header from '@/components/Header';
import EmailConfigForm from '@/components/EmailConfigForm';
import { getCurrentUser } from '@/lib/session';
import { getEmailConfig } from '@/lib/email-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function BackofficeEmailPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/tickets');
  }

  const [criticalCount, config] = await Promise.all([
    prisma.ticket.count({ where: { priority: 'P1', isArchived: false } }),
    getEmailConfig(),
  ]);

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/backoffice" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Retour au backoffice
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Email (SMTP)</h1>
                <span className="page-toolbar-subtitle">Envoi des notifications par email (ADMIN)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <EmailConfigForm
            config={{
              enabled: config.enabled,
              host: config.host,
              port: config.port,
              security: config.security,
              username: config.username,
              fromName: config.fromName,
              fromEmail: config.fromEmail,
            }}
            hasPassword={!!process.env.SMTP_PASSWORD}
            adminEmail={user.email}
          />
        </div>
      </div>
    </>
  );
}
