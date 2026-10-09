import { prisma } from '@/lib/prisma';
import type { EmailConfig } from '@prisma/client';

export type SmtpSecurity = 'NONE' | 'STARTTLS' | 'SSL';

export type EffectiveSmtp = {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string; // secret : toujours depuis .env
  from: string;
  timeoutMs: number;
  ehloName: string;
};

export async function getEmailConfig(): Promise<EmailConfig> {
  const existing = await prisma.emailConfig.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return prisma.emailConfig.create({ data: { id: 'singleton' } });
}

function normSecurity(s: string | null | undefined): SmtpSecurity {
  const v = (s || '').toUpperCase();
  return v === 'NONE' || v === 'SSL' ? v : 'STARTTLS';
}

function composeFrom(fromName: string | null, fromEmail: string | null): string {
  const email = fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@fixflow.local';
  const name = fromName || process.env.SMTP_FROM_NAME || 'FixFlow';
  return `${name} <${email}>`;
}

// Réglages SMTP effectifs. Si un serveur est configuré en base (host renseigné),
// la config DB prime ; sinon fallback .env (dev / Mailpit). Le mot de passe est
// toujours lu dans .env (SMTP_PASSWORD).
export async function effectiveSmtpSettings(): Promise<EffectiveSmtp> {
  const cfg = await getEmailConfig();
  const dbConfigured = !!cfg.host;

  return {
    enabled: dbConfigured ? cfg.enabled : process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    host: dbConfigured ? cfg.host! : process.env.SMTP_HOST || 'mailpit',
    port: dbConfigured ? cfg.port ?? 587 : Number(process.env.SMTP_PORT || 1025),
    security: dbConfigured
      ? normSecurity(cfg.security)
      : process.env.SMTP_SECURE === 'true'
        ? 'SSL'
        : 'NONE',
    username: dbConfigured ? cfg.username || '' : process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    from: composeFrom(cfg.fromName, cfg.fromEmail),
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 10000),
    ehloName: process.env.SMTP_EHLO_NAME || 'localhost',
  };
}
