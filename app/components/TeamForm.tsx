'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createTeam, updateTeam } from '@/lib/actions/teams';

type Status = {
  id: string;
  name: string;
  color: string | null;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  statuses: Status[];
};

type TeamFormProps = {
  team?: Team;
};

export default function TeamForm({ team }: TeamFormProps) {
  const router = useRouter();
  const isEditing = !!team;

  const [formData, setFormData] = useState({
    name: team?.name || '',
    description: team?.description || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        await updateTeam({
          id: team.id,
          name: formData.name,
          description: formData.description || undefined,
        });
      } else {
        await createTeam({
          name: formData.name,
          description: formData.description || undefined,
        });
      }
      router.push('/backoffice/teams');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {/* Nom */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Nom de l&apos;équipe *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            placeholder="Ex: Équipe Maintenance Toulouse"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Description
          </label>
          <textarea
            id="description"
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] resize-none transition-colors duration-150 ease-out"
            placeholder="Description de l'équipe et de ses responsabilités..."
          />
        </div>
      </div>

      {/* Boutons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-border-default">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-3 py-1.5 text-sm text-foreground bg-surface-alt rounded-lg hover:bg-surface-alt border border-border-default transition-colors duration-150 ease-out"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
        >
          {isSubmitting
            ? 'Enregistrement...'
            : isEditing
            ? 'Mettre à jour'
            : 'Créer l\'équipe'}
        </button>
      </div>
    </form>
  );
}
