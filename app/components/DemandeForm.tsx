'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDemandeWithAttachments } from '@/lib/actions/demandes';
import { useToast } from '@/components/ToastProvider';

type Location = { id: string; name: string };

// Formulaire de DEMANDE (idée/suggestion) : simple, sans équipement ni priorité.
// L'équipement/équipe et la priorité sont choisis par le manager à la validation.
export default function DemandeForm({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Renseigne au moins un titre et une description.');
      return;
    }
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('title', title.trim());
      payload.append('description', description.trim());
      if (locationId) payload.append('locationId', locationId);
      for (const file of files) payload.append('files', file);

      await createDemandeWithAttachments(payload);
      toast.success('Demande envoyée. Elle sera étudiée par un responsable.');
      router.push('/demandes/mine');
    } catch (error) {
      console.error('Erreur lors de la creation de la demande:', error);
      toast.error("Impossible d'envoyer la demande pour l'instant. Réessaie dans quelques secondes.");
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none';

  return (
    <div className="bg-surface border border-border-default rounded-xl shadow-soft-md p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Titre de la demande *
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="Ex : Ajouter un panneau de signalisation à l'entrée"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Description / justification *
          </label>
          <textarea
            id="description"
            required
            rows={5}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} resize-none`}
            placeholder="Explique ton idée : ce que tu proposes, pourquoi, à quel endroit..."
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Localisation concernée (optionnel)
          </label>
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={inputCls}
            disabled={loading}
          >
            <option value="">— Non précisée —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Photos (optionnel)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-surface-alt file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
            disabled={loading}
          />
          {files.length > 0 && (
            <p className="mt-1 text-[11px] text-muted">{files.length} fichier(s) sélectionné(s)</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
          >
            {loading ? 'Envoi en cours...' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </div>
  );
}
