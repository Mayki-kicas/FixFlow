'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/session';
import {
  dispatchDueDateReminderNotificationsInternal,
  isNotificationTableMissing,
} from '@/lib/notifications-core';

// La logique interne/système (création de notifications, file d'emails, rappels
// d'échéance) vit dans lib/notifications-core.ts — volontairement HORS 'use server'
// pour ne pas l'exposer comme endpoint public. Ce fichier ne contient que les
// actions destinées au client, toutes authentifiées.

export async function getNotificationInbox(limit = 12) {
  const user = await requireAuth();

  try {
    const [unreadCount, notifications] = await Promise.all([
      prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      }),
      prisma.notification.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          isRead: true,
          createdAt: true,
        },
      }),
    ]);

    return { unreadCount, notifications };
  } catch (error) {
    if (isNotificationTableMissing(error)) {
      console.warn('Notification table missing, returning empty inbox');
      return { unreadCount: 0, notifications: [] };
    }
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const user = await requireAuth();

  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    if (isNotificationTableMissing(error)) {
      console.warn('Notification table missing, skipping markNotificationAsRead');
      return;
    }
    throw error;
  }
}

export async function markAllNotificationsAsRead() {
  const user = await requireAuth();

  try {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    if (isNotificationTableMissing(error)) {
      console.warn('Notification table missing, skipping markAllNotificationsAsRead');
      return;
    }
    throw error;
  }
}

export async function updateMyNotificationPreferences(input: {
  notifyTicketCreated: boolean;
  notifyStatusChanged: boolean;
  notifyNewMessage: boolean;
  notifyDueDate: boolean;
  notifyEmailEnabled: boolean;
}) {
  const user = await requireAuth();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifyTicketCreated: input.notifyTicketCreated,
      notifyStatusChanged: input.notifyStatusChanged,
      notifyNewMessage: input.notifyNewMessage,
      notifyDueDate: input.notifyDueDate,
      notifyEmailEnabled: input.notifyEmailEnabled,
    },
  });
}

export async function dispatchDueDateReminderNotifications() {
  await requireRole(['ADMIN', 'MANAGER']);
  return dispatchDueDateReminderNotificationsInternal();
}
