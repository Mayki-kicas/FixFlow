'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getNotificationInbox,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/actions/notifications';

type InboxNotification = {
  id: string;
  type: 'TICKET_CREATED' | 'STATUS_CHANGED' | 'NEW_MESSAGE' | 'DUE_DATE_REMINDER' | 'SYSTEM';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string | Date;
};

const TYPE_LABELS: Record<InboxNotification['type'], string> = {
  TICKET_CREATED: 'Nouveau ticket',
  STATUS_CHANGED: 'Statut',
  NEW_MESSAGE: 'Message',
  DUE_DATE_REMINDER: 'Echéance',
  SYSTEM: 'Systeme',
};

function formatRelativeDate(value: string | Date) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'A l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;

  return date.toLocaleDateString('fr-FR');
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);

  const hasNotifications = notifications.length > 0;

  const loadInbox = async () => {
    setLoading(true);
    try {
      const inbox = await getNotificationInbox(15);
      setUnreadCount(inbox.unreadCount);
      setNotifications(inbox.notifications as InboxNotification[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInbox();

    const interval = setInterval(() => {
      void loadInbox();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      void loadInbox();
    }
  }, [open]);

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return null;
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

  const handleOpenNotification = async (notification: InboxNotification) => {
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      );
    }

    setOpen(false);
    router.push(notification.link || '/tickets');
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={unreadBadge ? `Notifications (${unreadBadge} non lues)` : 'Notifications'}
        className="relative p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-alt transition-colors"
        title="Notifications"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {unreadBadge && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--accent)] text-[color:var(--surface)] text-[10px] font-medium leading-4 text-center tabular-nums">
            {unreadBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 max-w-[90vw] rounded-xl border border-border-default bg-surface shadow-soft-lg z-50">
          <div className="px-3 py-2 border-b border-border-default flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || markingAll}
              className="text-xs text-[color:var(--accent)] hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              Tout lire
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-xs text-muted">Chargement...</p>
            ) : !hasNotifications ? (
              <p className="px-3 py-4 text-xs text-muted">Aucune notification</p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => void handleOpenNotification(notification)}
                  className={`w-full text-left px-3 py-2 border-b border-border-default last:border-b-0 hover:bg-surface-alt transition-colors ${
                    notification.isRead ? 'opacity-80' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      {TYPE_LABELS[notification.type]}
                    </span>
                    <span className="text-[10px] text-muted tabular-nums">
                      {formatRelativeDate(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground mt-0.5">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {notification.message}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
