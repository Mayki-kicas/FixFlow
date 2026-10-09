'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLocation, updateLocation, deleteLocation } from '@/lib/actions/locations';

type Location = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  email: string | null;
  description: string | null;
};

export default function LocationForm({ location }: { location?: Location }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: location?.code || '',
    name: location?.name || '',
    address: location?.address || '',
    city: location?.city || '',
    postalCode: location?.postalCode || '',
    email: location?.email || '',
    description: location?.description || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (location) {
        await updateLocation({ id: location.id, ...formData });
      } else {
        await createLocation(formData);
      }
      router.push('/backoffice/locations');
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Une erreur est survenue');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!location) return;

    if (
      !confirm(
        'Êtes-vous sûr de vouloir supprimer cette localisation ? Cette action est irréversible.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await deleteLocation(location.id);
      router.push('/backoffice/locations');
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Impossible de supprimer cette localisation');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Code */}
        <div>
          <label htmlFor="code" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Code * (ex: TU, BXL)
          </label>
          <input
            type="text"
            id="code"
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            disabled={loading}
            maxLength={10}
          />
        </div>

        {/* Nom */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Nom complet *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            disabled={loading}
          />
        </div>

        {/* Adresse */}
        <div>
          <label htmlFor="address" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Adresse
          </label>
          <input
            type="text"
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            disabled={loading}
          />
        </div>

        {/* Ville */}
        <div>
          <label htmlFor="city" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Ville
          </label>
          <input
            type="text"
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            disabled={loading}
          />
        </div>

        {/* Code postal */}
        <div>
          <label htmlFor="postalCode" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Code postal
          </label>
          <input
            type="text"
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            disabled={loading}
            maxLength={10}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Email de contact
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            disabled={loading}
          />
        </div>
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
          disabled={loading}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-3 border-t border-border-default">
        <div>
          {location && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors duration-150 ease-out"
            >
              Supprimer
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-border-default text-foreground rounded-lg hover:bg-surface-alt disabled:opacity-50 transition-colors duration-150 ease-out"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
          >
            {loading ? 'Enregistrement...' : location ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </form>
  );
}
