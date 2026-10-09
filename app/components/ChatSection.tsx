'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AttachmentThumb from '@/components/AttachmentThumb';
import { createChatMessageWithAttachments } from '@/lib/actions/chat';

type Attachment = {
  id: string;
  type: 'PHOTO' | 'PDF' | 'OTHER';
  url: string;
  description: string | null;
};

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    displayName: string;
  };
  attachments?: Attachment[];
};

const AttachmentIcon = ({ type }: { type: 'PHOTO' | 'PDF' | 'OTHER' }) => {
  if (type === 'PDF') return <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
  return <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
};

// Palette d'avatars dérivée des tokens produit (cf. TicketKanban).
const AVATAR_COLORS = ['#ef7d63', '#2f6f9e', '#10b981', '#a78bfa', '#f59e0b', '#0ea5e9', '#f472b6', '#64748b'];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getAvatarColor(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function formatRelativeDate(value: Date | string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;

  return date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+|@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, index) => {
    if (!part) return null;

    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-accent-2 underline underline-offset-2">
          {part}
        </a>
      );
    }

    if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
      return (
        <span key={index} className="px-1 py-0.5 rounded text-accent" style={{ backgroundColor: '#e8513b1a' }}>
          {part}
        </span>
      );
    }

    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return <span key={index}>{part}</span>;
  });
}

function renderMarkdownBasic(text: string) {
  const lines = text.split('\n');
  return lines.map((line, index) => (
    <span key={index}>
      {renderInlineMarkdown(line)}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export default function ChatSection({
  ticketId,
  messages: initialMessages,
}: {
  ticketId: string;
  messages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(
    [...initialMessages].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Source de vérité = données serveur : re-synchronise quand le parent se rafraîchit
  // (après un envoi, ou via le polling ci-dessous) → les messages des autres apparaissent.
  useEffect(() => {
    setMessages(
      [...initialMessages].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }, [initialMessages]);

  // Rafraîchissement léger pour un chat quasi temps-réel sans recharger la page.
  // (router.refresh ne re-fetch que les server components ; l'état du brouillon est préservé.)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!content.trim() && selectedFiles.length === 0) || loading) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('ticketId', ticketId);
      formData.append('content', content.trim());

      for (const file of selectedFiles) {
        formData.append('files', file);
      }

      const newMessage = await createChatMessageWithAttachments(formData);

      if (newMessage) {
        setMessages((prev) => [newMessage as Message, ...prev]);
      }
      setContent('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'envoyer le message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border-default rounded-xl shadow-soft-md">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h2 className="text-base font-semibold text-foreground">Discussion</h2>
      </div>

      {/* Formulaire */}
      <div className="px-4 py-3 border-b border-border-default">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Écrire un message..."
            rows={3}
            className="flex-1 px-3 py-2 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/40 resize-none placeholder:text-muted"
            disabled={loading}
          />
          <div className="flex flex-col gap-1">
            <button
              type="submit"
              disabled={loading || (!content.trim() && selectedFiles.length === 0)}
              className="px-3 py-2 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : 'Envoyer'}
            </button>
            <label aria-label="Joindre un fichier" className="px-3 py-2 border border-border-default rounded-lg text-muted transition-colors hover:bg-surface-alt cursor-pointer text-sm text-center">
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                disabled={loading}
              />
            </label>
          </div>
        </form>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Fichiers sélectionnés */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-b border-border-default">
          <div className="flex flex-wrap gap-1.5">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-alt border border-border-default rounded text-[10px]"
              >
                {file.type.startsWith('image/') ? (
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    width={24}
                    height={24}
                    unoptimized
                    className="w-6 h-6 object-cover rounded"
                  />
                ) : (
                  <AttachmentIcon type={file.type === 'application/pdf' ? 'PDF' : 'OTHER'} />
                )}
                <span className="max-w-[80px] truncate text-muted">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-0.5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted py-5">
            Aucun message pour le moment
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex gap-2 animate-fade-in-up">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ backgroundColor: getAvatarColor(message.author.displayName) }}
                title={message.author.displayName}
              >
                {getInitials(message.author.displayName)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-foreground">
                    {message.author.displayName}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {formatRelativeDate(message.createdAt)}
                  </span>
                </div>
                {message.content && (
                  <p className="text-foreground text-sm leading-relaxed">
                    {renderMarkdownBasic(message.content)}
                  </p>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {message.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-alt border border-border-default rounded text-[10px] transition-colors hover:bg-surface"
                      >
                        {attachment.type === 'PHOTO' ? (
                          <AttachmentThumb
                            src={attachment.url}
                            alt={attachment.description || 'Image'}
                            size={32}
                            className="w-8 h-8 object-cover rounded"
                          />
                        ) : (
                          <>
                            <AttachmentIcon type={attachment.type} />
                            <span className="max-w-[80px] truncate text-muted">
                              {attachment.description || 'Fichier'}
                            </span>
                          </>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
