'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { sendEmail } from '@/lib/email';

function norm(v: string | undefined | null): string | null {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : null;
}

export async function updateEmailConfig(input: {
  enabled: boolean;
  host?: string;
  port?: number | null;
  security: 'NONE' | 'STARTTLS' | 'SSL';
  username?: string;
  fromName?: string;
  fromEmail?: string;
}) {
  await requireRole(['ADMIN']);
  const security = (['NONE', 'STARTTLS', 'SSL'] as const).includes(input.security)
    ? input.security
    : 'STARTTLS';

  const data = {
    enabled: !!input.enabled,
    host: norm(input.host),
    port: input.port != null && Number.isFinite(input.port) ? Math.trunc(input.port) : null,
    security,
    username: norm(input.username),
    fromName: norm(input.fromName),
    fromEmail: norm(input.fromEmail),
  };

  await prisma.emailConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  revalidatePath('/backoffice/email');
}

// Envoie un email de test à l'admin courant. Renvoie l'erreur SMTP éventuelle
// (ne lève pas) pour aider au diagnostic de la configuration.
export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  const admin = await requireRole(['ADMIN']);
  try {
    const result = await sendEmail({
      to: admin.email,
      subject: 'FixFlow — email de test',
      text: 'Ceci est un email de test envoyé depuis la configuration SMTP de FixFlow. Si vous le recevez, la configuration fonctionne.',
    });
    if ('skipped' in result && result.skipped) {
      return { ok: false, message: "Envoi désactivé : active l'envoi et enregistre avant de tester." };
    }
    return { ok: true, message: `Email de test envoyé à ${admin.email}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Échec de l'envoi." };
  }
}
