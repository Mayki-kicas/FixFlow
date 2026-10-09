'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { createEquipment, updateEquipment } from '@/lib/actions/equipments';
import { Priority, Criticality, EquipmentLifecycleStatus } from '@prisma/client';
import { PRIORITIES, PRIORITY_META } from '@/lib/priority';

type Location = {
  id: string;
  code: string;
  name: string;
  city: string | null;
};

type Team = {
  id: string;
  name: string;
};

type Maintainer = {
  id: string;
  name: string;
};

const CRITICALITY_OPTIONS = [
  { value: 'LOW', label: 'Basse' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'CRITICAL', label: 'Critique' },
];

const LIFECYCLE_OPTIONS = [
  { value: 'IN_SERVICE', label: 'En service' },
  { value: 'OUT_OF_SERVICE', label: 'Hors service' },
  { value: 'RETIRED', label: 'Réformé' },
];

// Date <-> input date-only (UTC midi pour éviter la dérive de fuseau).
function formatDateInput(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function dateOnlyToUtcDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

type Category = {
  id: string;
  name: string;
  defaultPriority: Priority;
  correctiveSlaHours: number | null;
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
};

type Equipment = {
  id: string;
  name: string;
  refCode: string;
  photoStorageKey?: string | null;
  locationId: string | null;
  teamId: string;
  categoryId: string;
  defaultPriority: Priority | null;
  correctiveSlaHours: number | null;
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  commissionedAt: Date | null;
  warrantyUntil: Date | null;
  criticality: string;
  lifecycleStatus: string;
  supplierId: string | null;
  parentEquipmentId: string | null;
};

// Chaîne -> nombre|null (vide = hérite de la catégorie).
function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

const regInputClass =
  'w-full px-2 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out';

type EquipmentFormProps = {
  equipment?: Equipment;
  locations: Location[];
  teams: Team[];
  categories: Category[];
  maintainers: Maintainer[];
  parentOptions: { id: string; name: string; refCode: string }[];
};

export default function EquipmentForm({
  equipment,
  locations,
  teams,
  categories,
  maintainers,
  parentOptions,
}: EquipmentFormProps) {
  const router = useRouter();
  const isEditing = !!equipment;

  const [formData, setFormData] = useState({
    name: equipment?.name || '',
    refCode: equipment?.refCode || '',
    locationId: equipment?.locationId || '',
    teamId: equipment?.teamId || '',
    categoryId: equipment?.categoryId || '',
    // Surcharges (chaînes ; vide = hérite de la catégorie). '' pour la priorité = hérite.
    defaultPriority: (equipment?.defaultPriority ?? '') as '' | Priority,
    correctiveSlaHours: equipment?.correctiveSlaHours?.toString() ?? '',
    p1DelayDays: equipment?.p1DelayDays?.toString() ?? '',
    p2DelayDays: equipment?.p2DelayDays?.toString() ?? '',
    p3DelayDays: equipment?.p3DelayDays?.toString() ?? '',
    // Référentiel
    serialNumber: equipment?.serialNumber ?? '',
    brand: equipment?.brand ?? '',
    model: equipment?.model ?? '',
    commissionedAt: formatDateInput(equipment?.commissionedAt),
    warrantyUntil: formatDateInput(equipment?.warrantyUntil),
    criticality: equipment?.criticality ?? 'MEDIUM',
    lifecycleStatus: equipment?.lifecycleStatus ?? 'IN_SERVICE',
    supplierId: equipment?.supplierId ?? '',
    parentEquipmentId: equipment?.parentEquipmentId ?? '',
  });

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === formData.categoryId) || null,
    [categories, formData.categoryId],
  );

  const existingPhotoUrl = equipment?.photoStorageKey
    ? `/api/equipments/${equipment.id}/photo`
    : null;
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aperçu : nouvelle photo choisie, sinon la photo existante (sauf si retirée).
  const previewSrc = photoDataUrl || (!photoRemoved ? existingPhotoUrl : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // data URL (nouvelle) | '' (retrait) | undefined (inchangée)
    const photo = photoDataUrl ? photoDataUrl : photoRemoved ? '' : undefined;

    // Surcharges : vide => null (hérite de la catégorie).
    const {
      defaultPriority,
      correctiveSlaHours,
      p1DelayDays,
      p2DelayDays,
      p3DelayDays,
      commissionedAt,
      warrantyUntil,
      criticality,
      lifecycleStatus,
      supplierId,
      ...baseData
    } = formData;
    const overrides = {
      defaultPriority: defaultPriority === '' ? null : defaultPriority,
      correctiveSlaHours: toIntOrNull(correctiveSlaHours),
      p1DelayDays: toIntOrNull(p1DelayDays),
      p2DelayDays: toIntOrNull(p2DelayDays),
      p3DelayDays: toIntOrNull(p3DelayDays),
    };
    const registry = {
      commissionedAt: dateOnlyToUtcDate(commissionedAt),
      warrantyUntil: dateOnlyToUtcDate(warrantyUntil),
      criticality: criticality as Criticality,
      lifecycleStatus: lifecycleStatus as EquipmentLifecycleStatus,
      supplierId: supplierId || null,
    };

    try {
      if (isEditing) {
        await updateEquipment({ id: equipment.id, ...baseData, ...overrides, ...registry, photo });
      } else {
        await createEquipment({ ...baseData, ...overrides, ...registry, photo });
      }
      router.push('/backoffice/equipments');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result?.toString() || '');
      setPhotoRemoved(false);
    };
    reader.onerror = () => setError("Impossible de lire l'image.");
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl('');
    setPhotoRemoved(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nom */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Nom de l&apos;équipement *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            placeholder="Ex: Onduleur principal"
          />
        </div>

        {/* Photo */}
        <div>
          <label htmlFor="photo" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Photo (optionnelle)
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="block w-full text-xs text-muted file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-surface-alt file:text-foreground hover:file:bg-surface-alt file:transition-colors"
          />
          {previewSrc && (
            <div className="mt-2 flex items-center gap-3">
              <Image
                src={previewSrc}
                alt="Aperçu"
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 rounded-lg border border-border-default object-cover"
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Retirer la photo
              </button>
            </div>
          )}
          <p className="mt-1 text-[10px] text-muted">
            1 image max, stockée sur le stockage de fichiers.
          </p>
        </div>

        {/* Code de référence */}
        <div>
          <label htmlFor="refCode" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Code de référence *
          </label>
          <input
            type="text"
            id="refCode"
            required
            value={formData.refCode}
            onChange={(e) => setFormData({ ...formData, refCode: e.target.value.toUpperCase() })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
            placeholder="Ex: OND-TU-001"
          />
          <p className="mt-1 text-xs text-muted">
            Code unique pour identifier l&apos;équipement
          </p>
        </div>

        {/* Localisation */}
        <div>
          <label htmlFor="locationId" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Localisation
          </label>
          <select
            id="locationId"
            value={formData.locationId}
            onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          >
            <option value="">Global (toutes localisations)</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name} {location.city && `(${location.city})`}
              </option>
            ))}
          </select>
        </div>

        {/* Équipe */}
        <div>
          <label htmlFor="teamId" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Équipe responsable *
          </label>
          <select
            id="teamId"
            required
            value={formData.teamId}
            onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          >
            <option value="">Sélectionner une équipe</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* Catégorie */}
        <div className="md:col-span-2">
          <label htmlFor="categoryId" className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Catégorie *
          </label>
          <select
            id="categoryId"
            required
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          >
            <option value="">Sélectionner une catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Aucune catégorie disponible. Créez-en une d&apos;abord dans la section Catégories.
            </p>
          )}
        </div>
      </div>

      {/* Référentiel GMAO */}
      <div className="rounded-xl border border-border-default p-3 space-y-2.5">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Référentiel</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-muted mb-0.5">N° de série</label>
            <input type="text" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} className={regInputClass} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Fournisseur</label>
            <select value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })} className={regInputClass}>
              <option value="">— Aucun —</option>
              {maintainers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Marque</label>
            <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className={regInputClass} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Modèle</label>
            <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className={regInputClass} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Criticité</label>
            <select value={formData.criticality} onChange={(e) => setFormData({ ...formData, criticality: e.target.value })} className={regInputClass}>
              {CRITICALITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">État (cycle de vie)</label>
            <select value={formData.lifecycleStatus} onChange={(e) => setFormData({ ...formData, lifecycleStatus: e.target.value })} className={regInputClass}>
              {LIFECYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Mise en service</label>
            <input type="date" value={formData.commissionedAt} onChange={(e) => setFormData({ ...formData, commissionedAt: e.target.value })} className={regInputClass} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Garantie jusqu&apos;au</label>
            <input type="date" value={formData.warrantyUntil} onChange={(e) => setFormData({ ...formData, warrantyUntil: e.target.value })} className={regInputClass} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] text-muted mb-0.5">Équipement parent (hiérarchie)</label>
            <select value={formData.parentEquipmentId} onChange={(e) => setFormData({ ...formData, parentEquipmentId: e.target.value })} className={regInputClass}>
              <option value="">— Aucun —</option>
              {parentOptions.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name} ({eq.refCode})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Surcharges SLA / priorité au niveau de l'équipement */}
      <div className="rounded-xl border border-border-default p-3 space-y-2.5">
        <div>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Surcharges SLA / priorité (optionnel)</p>
          <p className="text-[11px] text-muted mt-0.5">
            Laisser vide = hériter de la catégorie. Une valeur ici <strong>écrase</strong> la catégorie pour cet équipement.
          </p>
        </div>

        <div>
          <label htmlFor="ov-priority" className="block text-[11px] text-muted mb-0.5">Priorité par défaut</label>
          <select
            id="ov-priority"
            value={formData.defaultPriority}
            onChange={(e) => setFormData({ ...formData, defaultPriority: e.target.value as '' | Priority })}
            className="w-full px-2 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)]"
          >
            <option value="">
              Hériter{selectedCategory ? ` (${PRIORITY_META[selectedCategory.defaultPriority].short})` : ''}
            </option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].short} — {PRIORITY_META[p].label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ov-corrective" className="block text-[11px] text-muted mb-0.5">
            SLA correctif — résolution, en heures
          </label>
          <input
            id="ov-corrective"
            type="number"
            min={0}
            value={formData.correctiveSlaHours}
            onChange={(e) => setFormData({ ...formData, correctiveSlaHours: e.target.value })}
            placeholder={selectedCategory?.correctiveSlaHours != null ? `Hérite : ${selectedCategory.correctiveSlaHours} h` : 'Hérite (aucun)'}
            className="w-full px-2 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)]"
          />
        </div>

        <div>
          <p className="text-[11px] text-muted mb-0.5">Délai devis (amélioratif, en jours)</p>
          <div className="grid grid-cols-3 gap-1">
            {(['p1DelayDays', 'p2DelayDays', 'p3DelayDays'] as const).map((key, i) => {
              const inherited = selectedCategory?.[key];
              return (
                <input
                  key={key}
                  type="number"
                  min={0}
                  value={formData[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  placeholder={inherited != null ? `P${i + 1}: ${inherited} j` : `P${i + 1}: hérite`}
                  className="w-full px-2 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)]"
                />
              );
            })}
          </div>
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
            : 'Créer l\'équipement'}
        </button>
      </div>
    </form>
  );
}
