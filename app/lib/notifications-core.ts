// Logique interne des notifications (création, file d'emails, rappels d'échéance).
//
// ⚠️ Ce module n'est PAS 'use server' : ces fonctions ne doivent JAMAIS être
// exposées comme Server Actions (elles n'ont pas de contrôle d'accès utilisateur).
// Elles sont appelées :
//   - depuis d'autres Server Actions déjà authentifiées (chat/tickets),
//   - depuis les routes API cron protégées par token (isValidCronToken).
// Les actions destinées au client vivent dans lib/actions/notifications.ts.

import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { EmailAttachment } from '@/lib/email';
import { sendEmail } from '@/lib/email';
import { buildNotificationEmail } from '@/lib/notification-email';
import { getObject } from '@/lib/storage';

export type UserNotificationPrefs = {
  id: string;
  email: string;
  displayName: string;
  notifyTicketCreated: boolean;
  notifyStatusChanged: boolean;
  notifyNewMessage: boolean;
  notifyDueDate: boolean;
  notifyEmailEnabled: boolean;
};

export function isNotificationTableMissing(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2021'
  );
}

function shouldNotifyByType(type: NotificationType, user: UserNotificationPrefs) {
  switch (type) {
    case 'TICKET_CREATED':
      return user.notifyTicketCreated;
    case 'STATUS_CHANGED':
      return user.notifyStatusChanged;
    case 'NEW_MESSAGE':
      return user.notifyNewMessage;
    case 'DUE_DATE_REMINDER':
      return user.notifyDueDate;
    case 'SYSTEM':
    default:
      return true;
  }
}

function dateDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function processPendingNotificationEmailJobs(limit = 20) {
  const jobs = await prisma.notificationEmailJob.findMany({
    where: {
      status: {
        in: ['PENDING', 'FAILED'],
      },
      attempts: {
        lt: 5,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  if (jobs.length === 0) {
    return { processed: 0 };
  }

  let processed = 0;

  for (const job of jobs) {
    const claimed = await prisma.notificationEmailJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
      },
      data: {
        status: 'SENDING',
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 0) {
      continue;
    }

    try {
      // Ré-hydrate les pièces jointes depuis la base (leurs IDs sont stockés sur le job).
      const attachmentIds = Array.isArray(job.attachmentIds)
        ? (job.attachmentIds as unknown[]).filter((id): id is string => typeof id === 'string')
        : [];
      let attachments: EmailAttachment[] = [];
      if (attachmentIds.length > 0) {
        const rows = await prisma.attachment.findMany({
          where: { id: { in: attachmentIds } },
          select: { type: true, fileName: true, description: true, contentType: true, storageKey: true },
        });
        const hydrated = await Promise.all(
          rows.map(async (row) => {
            if (!row.storageKey) return null;
            const buffer = await getObject(row.storageKey);
            if (!buffer || buffer.length === 0) return null;
            return {
              filename:
                (row.fileName && row.fileName.trim()) ||
                (row.description && row.description.trim()) ||
                'piece-jointe',
              contentType:
                row.contentType || (row.type === 'PDF' ? 'application/pdf' : 'application/octet-stream'),
              content: buffer,
            };
          }),
        );
        attachments = hydrated.filter((a): a is NonNullable<typeof a> => a !== null);
      }

      await sendEmail({
        to: job.toEmail,
        subject: job.subject,
        text: job.text,
        html: job.html || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      await prisma.notificationEmailJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          lastError: null,
        },
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown SMTP error';
      await prisma.notificationEmailJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: message,
        },
      });
    }
  }

  return { processed };
}

export async function createNotificationsForUsers(input: {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
  email?: {
    messageContent?: string;
    attachmentIds?: string[];
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
}) {
  if (input.userIds.length === 0) {
    return;
  }

  const uniqueUserIds = Array.from(new Set(input.userIds));

  let users: UserNotificationPrefs[] = [];
  try {
    users = await prisma.user.findMany({
      where: {
        id: { in: uniqueUserIds },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        notifyTicketCreated: true,
        notifyStatusChanged: true,
        notifyNewMessage: true,
        notifyDueDate: true,
        notifyEmailEnabled: true,
      },
    });
  } catch (error) {
    console.error('Failed to fetch recipients:', error);
    return;
  }

  const enabledUsers = users.filter((user) => shouldNotifyByType(input.type, user));
  if (enabledUsers.length === 0) {
    return;
  }

  try {
    await prisma.notification.createMany({
      data: enabledUsers.map((user) => ({
        userId: user.id,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        dedupeKey: input.dedupeKey ?? null,
      })),
    });
  } catch (error) {
    if (isNotificationTableMissing(error)) {
      console.warn('Notification table missing, skipping notification inserts but continuing email notifications');
    } else {
      console.error('Failed to create in-app notifications:', error);
      return;
    }
  }

  const emailEnabledUsers = enabledUsers.filter((user) => user.notifyEmailEnabled);
  if (emailEnabledUsers.length === 0) {
    return;
  }

  const template = buildNotificationEmail({
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    messageContent: input.email?.messageContent,
    ticketContext: input.email?.ticketContext,
    statusContext: input.email?.statusContext,
  });

  // Les emails AVEC pièces jointes passent désormais aussi par la file (retry) :
  // on stocke les IDs des PJ, ré-hydratées à l'envoi par le processeur (cf. M7).
  const attachmentIds = input.email?.attachmentIds || [];

  await prisma.notificationEmailJob.createMany({
    data: emailEnabledUsers.map((user) => ({
      userId: user.id,
      type: input.type,
      toEmail: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      status: 'PENDING',
    })),
  });

  void processPendingNotificationEmailJobs(15);
}

export async function dispatchDueDateReminderNotificationsInternal() {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const windows = [
    { offsetDays: -1, label: 'J-1' },
    { offsetDays: 0, label: 'J' },
    { offsetDays: 1, label: 'J+1' },
  ];

  let notifications = 0;

  for (const window of windows) {
    const start = new Date(base);
    start.setDate(start.getDate() + window.offsetDays);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const tickets = await prisma.ticket.findMany({
      where: {
        isArchived: false,
        dueDate: {
          gte: start,
          lt: end,
        },
        status: {
          isFinal: false,
        },
      },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        dueDate: true,
        requesterId: true,
        team: { select: { name: true } },
        equipment: { select: { name: true } },
        subscriptions: { select: { userId: true } },
      },
    });

    for (const ticket of tickets) {
      const userIds = Array.from(
        new Set([ticket.requesterId, ...ticket.subscriptions.map((subscription) => subscription.userId)])
      );

      if (userIds.length === 0) {
        continue;
      }

      const dayKey = dateDayKey(start);
      const dedupeKey = `due:${window.label}:${dayKey}:${ticket.id}`;

      // Dé-dup exacte sur la clé indexée (fini le LIKE non indexé sur le titre).
      const existingCount = await prisma.notification.count({
        where: {
          type: 'DUE_DATE_REMINDER',
          dedupeKey,
        },
      });

      if (existingCount > 0) {
        continue;
      }

      await createNotificationsForUsers({
        userIds,
        type: 'DUE_DATE_REMINDER',
        title: `Echeance ticket #${ticket.ticketNumber}`,
        message: `Le ticket #${ticket.ticketNumber} (${ticket.title}) est a ${window.label} de l'echeance.`,
        link: `/tickets/${ticket.id}`,
        dedupeKey,
        email: {
          ticketContext: {
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            teamName: ticket.team.name,
            equipmentName: ticket.equipment.name,
          },
        },
      });

      notifications += 1;
    }
  }

  return { notifications };
}
