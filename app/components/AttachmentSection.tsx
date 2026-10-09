'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AttachmentThumb from '@/components/AttachmentThumb';
import { uploadAttachment, deleteAttachment } from '@/lib/actions/attachments';

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

type AttachmentSectionProps = {
  ticketId: string;
  attachments: Attachment[];
  canUpload: boolean;
  canDelete: boolean;
  currentUserId: string;
  forceOpen?: boolean;
  hideToggle?: boolean;
};

const FileIcon = ({ type }: { type: 'PHOTO' | 'PDF' | 'OTHER' }) => {
  if (type === 'PDF') {
    return <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
  }
  if (type === 'PHOTO') {
    return <svg className="w-5 h-5 text-accent-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  }
  return <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
};

export default function AttachmentSection({
  ticketId,
  attachments,
  canUpload,
  canDelete,
  currentUserId,
  forceOpen = false,
  hideToggle = false,
}: AttachmentSectionProps) {
  const router = useRouter();
  const [isOpenState, setIsOpenState] = useState(forceOpen);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isOpen = forceOpen || isOpenState;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ticketId', ticketId);
        await uploadAttachment(formData);
      }
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Supprimer cette pièce jointe ?')) return;

    setDeletingId(attachmentId);
    try {
      await deleteAttachment(attachmentId);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-surface border border-border-default rounded-xl shadow-soft-md">
      <div className="flex justify-between items-center px-3 py-2 border-b border-border-default">
        <h2 className="text-sm font-semibold text-foreground">
          Pièces jointes <span className="text-xs font-normal text-muted tabular-nums">({attachments.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {!hideToggle && (
            <button
              type="button"
              onClick={() => setIsOpenState((prev) => !prev)}
              className="px-2 py-0.5 text-[11px] font-medium border border-border-default rounded-lg text-foreground transition-colors hover:bg-surface-alt"
            >
              {isOpen ? 'Masquer' : 'Afficher'}
            </button>
          )}
          {canUpload && isOpen && (
            <label className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] cursor-pointer">
              {isUploading ? 'Envoi...' : '+ Ajouter'}
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          )}
        </div>
      </div>

      {!isOpen && (
        <p className="px-3 py-1.5 text-xs text-muted">Clique sur Afficher pour voir les pièces jointes.</p>
      )}

      {isOpen && (
        <>
          {uploadError && (
            <div role="alert" className="mx-3 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">{uploadError}</div>
          )}

          <div className="p-3">
            {attachments.length === 0 ? (
              <p className="text-xs text-muted italic">Aucune pièce jointe</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="border border-border-default rounded-xl p-2 flex items-start gap-2"
                  >
                    {attachment.type === 'PHOTO' ? (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <AttachmentThumb
                          src={attachment.url}
                          alt={attachment.description || 'Image'}
                          size={40}
                          className="w-10 h-10 object-cover rounded border border-border-default transition-opacity hover:opacity-80"
                        />
                      </a>
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-surface-alt rounded border border-border-default">
                        <FileIcon type={attachment.type} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-accent-2 transition-colors hover:text-accent truncate block"
                      >
                        {attachment.description || 'Fichier'}
                      </a>
                      <p className="text-[11px] text-foreground mt-0.5">
                        {attachment.uploadedBy.displayName}
                      </p>
                      <p className="text-[11px] text-muted tabular-nums">
                        {new Date(attachment.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {(canDelete || attachment.uploadedBy.id === currentUserId) && (
                      <button
                        onClick={() => handleDelete(attachment.id)}
                        disabled={deletingId === attachment.id}
                        aria-label="Supprimer la pièce jointe"
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs flex-shrink-0 disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === attachment.id ? '...' : '×'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
