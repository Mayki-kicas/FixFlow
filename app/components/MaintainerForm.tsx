'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateMaintainer, deleteMaintainer } from '@/lib/actions/maintainers';

type MaintainerFormProps = {
  maintainer: {
    id: string;
    name: string;
    email?: string | null;
    contact: string | null;
    phone?: string | null;
    specialties?: string | null;
    notes?: string | null;
    userId?: string | null;
    tickets: unknown[];
  };
};

export default function MaintainerForm({ maintainer }: MaintainerFormProps) {
  const router = useRouter();
  const [name, setName] = useState(maintainer.name);
  const [email, setEmail] = useState(maintainer.email || '');
  const [password, setPassword] = useState('');
  const [contact, setContact] = useState(maintainer.contact || '');
  const [phone, setPhone] = useState(maintainer.phone || '');
  const [specialties, setSpecialties] = useState(maintainer.specialties || '');
  const [notes, setNotes] = useState(maintainer.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await updateMaintainer({
        id: maintainer.id,
        name: name.trim(),
        email: email.trim() || undefined,
        password: password.trim() || undefined,
        contact: contact.trim() || undefined,
        phone: phone.trim(),
        specialties: specialties.trim(),
        notes: notes.trim(),
      });
      setSuccess(true);
      setPassword('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (maintainer.tickets.length > 0) {
      setError(`Ce mainteneur a ${maintainer.tickets.length} ticket(s) assigné(s). Réassignez-les d'abord.`);
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer ce mainteneur ?')) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await deleteMaintainer(maintainer.id);
      router.push('/backoffice/maintainers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg" aria-live="polite">
          <p className="text-sm text-green-600 dark:text-green-400">Mainteneur mis à jour avec succès</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
          Nom *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
          Contact
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Téléphone, email..."
          className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">Téléphone</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">Spécialités</label>
          <input type="text" value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="ex. Ascenseurs, Portails" className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)]" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] resize-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
          Email de connexion
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mainteneur@exemple.fr"
          className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
          Mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={maintainer.userId ? 'Laisser vide pour ne pas changer' : 'Obligatoire si email saisi'}
          className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
        />
        {!maintainer.userId && (
          <p className="mt-1 text-xs text-muted">
            Ce mainteneur n&apos;a pas encore de compte local.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <Link
            href="/backoffice/maintainers"
            className="px-3 py-1.5 text-sm font-medium border border-border-default text-foreground rounded-lg hover:bg-surface-alt transition-colors duration-150 ease-out"
          >
            Annuler
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
        >
          Supprimer
        </button>
      </div>
    </form>
  );
}
