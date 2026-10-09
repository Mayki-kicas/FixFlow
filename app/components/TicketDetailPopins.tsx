'use client';

import { useState, type ReactNode } from 'react';
import { UserRole } from '@prisma/client';
import TicketSubscriptionManager from '@/components/TicketSubscriptionManager';
import AttachmentSection from '@/components/AttachmentSection';

type Subscription = {
  id: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
  };
};

type AvailableUser = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
};

type AvailableGroup = {
  id: string;
  name: string;
  _count: { members: number };
};

type Attachment = {
  id: string;
  type: 'PHOTO' | 'PDF' | 'OTHER';
  url: string;
  description: string | null;
  createdAt: Date;
  uploadedBy: {
    id: string;
    displayName: string;
  };
};

type TicketDetailPopinsProps = {
  ticketId: string;
  requesterId: string;
  subscriptions: Subscription[];
  availableUsers: AvailableUser[];
  availableGroups: AvailableGroup[];
  canManageSubscriptions: boolean;
  canViewSubscriptions: boolean;
  attachments: Attachment[];
  canDeleteAttachments: boolean;
  currentUserId: string;
};

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] p-3 sm:p-6">
      <div className="mx-auto max-w-3xl h-full overflow-y-auto">
        <div className="bg-surface border border-border-default rounded-xl shadow-soft-xl animate-fade-in-up">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-0.5 text-xs font-medium border border-border-default rounded-lg text-foreground transition-colors hover:bg-surface-alt"
            >
              Fermer
            </button>
          </div>
          <div className="p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function TicketDetailPopins({
  ticketId,
  requesterId,
  subscriptions,
  availableUsers,
  availableGroups,
  canManageSubscriptions,
  canViewSubscriptions,
  attachments,
  canDeleteAttachments,
  currentUserId,
}: TicketDetailPopinsProps) {
  const [activeModal, setActiveModal] = useState<'subscriptions' | 'attachments' | null>(null);

  return (
    <>
      <div className={`grid gap-1.5 ${canViewSubscriptions ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {canViewSubscriptions && (
          <button
            type="button"
            onClick={() => setActiveModal('subscriptions')}
            className="px-2 py-1 text-xs font-medium border border-border-default rounded-lg bg-surface text-foreground transition-colors hover:bg-surface-alt"
          >
            Abonnés (<span className="tabular-nums">{subscriptions.length}</span>)
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveModal('attachments')}
          className="px-2 py-1 text-xs font-medium border border-border-default rounded-lg bg-surface text-foreground transition-colors hover:bg-surface-alt"
        >
          Pièces jointes (<span className="tabular-nums">{attachments.length}</span>)
        </button>
      </div>

      {canViewSubscriptions && activeModal === 'subscriptions' && (
        <Modal title="Abonnés" onClose={() => setActiveModal(null)}>
          <TicketSubscriptionManager
            ticketId={ticketId}
            requesterId={requesterId}
            subscriptions={subscriptions}
            availableUsers={availableUsers}
            availableGroups={availableGroups}
            canManage={canManageSubscriptions}
            forceOpen={true}
            hideToggle={true}
          />
        </Modal>
      )}

      {activeModal === 'attachments' && (
        <Modal title="Pièces jointes" onClose={() => setActiveModal(null)}>
          <AttachmentSection
            ticketId={ticketId}
            attachments={attachments}
            canUpload={true}
            canDelete={canDeleteAttachments}
            currentUserId={currentUserId}
            forceOpen={true}
            hideToggle={true}
          />
        </Modal>
      )}
    </>
  );
}
