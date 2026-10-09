import { NotificationType } from '@prisma/client';

type BuildNotificationEmailInput = {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  messageContent?: string;
  ticketContext?: {
    ticketNumber?: number;
    ticketTitle?: string;
    teamName?: string;
    equipmentName?: string;
    requesterName?: string;
  };
  statusContext?: {
    previousStatus?: string;
    nextStatus?: string;
  };
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildNotificationEmail(input: BuildNotificationEmailInput) {
  const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const absoluteLink = input.link
    ? input.link.startsWith('http')
      ? input.link
      : `${appBaseUrl}${input.link}`
    : `${appBaseUrl}/tickets`;

  const typeLabel = (() => {
    switch (input.type) {
      case 'TICKET_CREATED':
        return 'Nouveau ticket';
      case 'STATUS_CHANGED':
        return 'Changement de statut';
      case 'NEW_MESSAGE':
        return 'Nouveau message';
      case 'DUE_DATE_REMINDER':
        return 'Rappel d echeance';
      case 'SYSTEM':
      default:
        return 'Notification systeme';
    }
  })();

  const discussionContent =
    input.type === 'NEW_MESSAGE'
      ? input.messageContent?.trim() || '[Message sans texte]'
      : null;

  const ticketHeader = input.ticketContext?.ticketNumber
    ? `Ticket #${input.ticketContext.ticketNumber}`
    : 'Ticket';

  const ticketLines =
    input.type === 'TICKET_CREATED' && input.ticketContext
      ? [
          `${ticketHeader}${input.ticketContext.ticketTitle ? ` - ${input.ticketContext.ticketTitle}` : ''}`,
          ...(input.ticketContext.teamName ? [`Equipe: ${input.ticketContext.teamName}`] : []),
          ...(input.ticketContext.equipmentName ? [`Equipement: ${input.ticketContext.equipmentName}`] : []),
          ...(input.ticketContext.requesterName ? [`Demandeur: ${input.ticketContext.requesterName}`] : []),
        ]
      : [];

  const statusLines =
    input.type === 'STATUS_CHANGED' && input.statusContext
      ? [
          `${ticketHeader}${input.ticketContext?.ticketTitle ? ` - ${input.ticketContext.ticketTitle}` : ''}`,
          ...(input.statusContext.previousStatus && input.statusContext.nextStatus
            ? [`Statut: ${input.statusContext.previousStatus} -> ${input.statusContext.nextStatus}`]
            : []),
        ]
      : [];

  const htmlSections: string[] = [];
  htmlSections.push(`<p style="margin:0 0 12px;color:#0f172a;font-size:14px;line-height:1.45;"><strong>${escapeHtml(input.title)}</strong></p>`);
  htmlSections.push(`<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.45;">${escapeHtml(input.message)}</p>`);

  if (ticketLines.length > 0) {
    htmlSections.push('<div style="margin:0 0 12px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;">');
    htmlSections.push('<p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:600;">Contexte ticket</p>');
    htmlSections.push('<ul style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.45;">');
    for (const line of ticketLines) {
      htmlSections.push(`<li>${escapeHtml(line)}</li>`);
    }
    htmlSections.push('</ul></div>');
  }

  if (statusLines.length > 0) {
    htmlSections.push('<div style="margin:0 0 12px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;">');
    htmlSections.push('<p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:600;">Contexte statut</p>');
    htmlSections.push('<ul style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.45;">');
    for (const line of statusLines) {
      htmlSections.push(`<li>${escapeHtml(line)}</li>`);
    }
    htmlSections.push('</ul></div>');
  }

  if (discussionContent) {
    htmlSections.push('<div style="margin:0 0 12px;padding:10px;border:1px solid #e2e8f0;border-radius:6px;background:#ffffff;">');
    htmlSections.push('<p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:600;">Contenu du message</p>');
    htmlSections.push(`<pre style="margin:0;white-space:pre-wrap;color:#334155;font-size:13px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(discussionContent)}</pre>`);
    htmlSections.push('</div>');
  }

  const openButton = `<a href="${escapeHtml(absoluteLink)}" style="display:inline-block;padding:8px 12px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Ouvrir le ticket</a>`;

  const html = [
    '<!doctype html><html><body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial, sans-serif;">',
    '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:16px;">',
    `<p style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(typeLabel)}</p>`,
    ...htmlSections,
    `<div style="margin-top:14px;">${openButton}</div>`,
    `<p style="margin:12px 0 0;color:#64748b;font-size:12px;">Lien direct: <a href="${escapeHtml(absoluteLink)}" style="color:#4f46e5;">${escapeHtml(absoluteLink)}</a></p>`,
    '</div></body></html>',
  ].join('');

  return {
    subject: `[FixFlow] ${typeLabel}${input.ticketContext?.ticketNumber ? ` - #${input.ticketContext.ticketNumber}` : ''}`,
    text: [
      `${input.title}`,
      '',
      `${input.message}`,
      ...(ticketLines.length > 0 ? ['', ...ticketLines] : []),
      ...(statusLines.length > 0 ? ['', ...statusLines] : []),
      ...(discussionContent
        ? [
            '',
            'Contenu du message:',
            discussionContent,
          ]
        : []),
      '',
      `Ouvrir: ${absoluteLink}`,
    ].join('\n'),
    html,
  };
}
