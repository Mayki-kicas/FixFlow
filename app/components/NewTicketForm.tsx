'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTicketWithAttachments } from '@/lib/actions/tickets';
import EquipmentPickerModal from '@/components/EquipmentPickerModal';
import { useToast } from '@/components/ToastProvider';

type Equipment = {
  id: string;
  name: string;
  refCode: string;
  location: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
  };
};

type Location = {
  id: string;
  name: string;
};

export default function NewTicketForm({
  locations,
  equipments,
}: {
  locations: Location[];
  equipments: Equipment[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    equipmentId: '',
    // '' = automatique (priorité par défaut de la catégorie d'équipement, côté serveur).
    priority: '' as '' | 'P1' | 'P2' | 'P3',
  });

  const globalLocationIds = useMemo(
    () =>
      new Set(
        locations
          .filter((location) => location.name.trim().toLowerCase() === 'global')
          .map((location) => location.id)
      ),
    [locations]
  );

  const visibleEquipments = useMemo(() => {
    if (!selectedLocationId) return equipments;

    return equipments.filter((eq) => {
      const eqLocationId = eq.location?.id || null;
      if (!eqLocationId) return true;
      if (eqLocationId === selectedLocationId) return true;
      if (globalLocationIds.has(eqLocationId)) return true;
      return false;
    });
  }, [equipments, selectedLocationId, globalLocationIds]);

  const selectedEquipment = useMemo(
    () => equipments.find((eq) => eq.id === formData.equipmentId) || null,
    [equipments, formData.equipmentId]
  );

  const filteredCount = useMemo(
    () => visibleEquipments.length,
    [visibleEquipments]
  );

  useEffect(() => {
    if (!formData.equipmentId) return;
    const stillVisible = visibleEquipments.some((eq) => eq.id === formData.equipmentId);
    if (!stillVisible) {
      setFormData((prev) => ({ ...prev, equipmentId: '' }));
    }
  }, [visibleEquipments, formData.equipmentId]);

  // Étape 1 (Où & quoi) → étape 2 (Le problème) : on valide localisation + équipement avant d'avancer.
  const goToProblemStep = () => {
    if (!selectedLocationId || !formData.equipmentId) {
      toast.error('Sélectionne d’abord une localisation et un équipement.');
      return;
    }
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.equipmentId || !selectedLocationId) {
      toast.error('Il manque des informations. Complète les champs obligatoires pour créer le ticket.');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('equipmentId', formData.equipmentId);
      payload.append('locationId', selectedLocationId);
      // Priorité : omise si "Automatique" -> le serveur applique le défaut de la catégorie.
      if (formData.priority) {
        payload.append('priority', formData.priority);
      }
      for (const file of selectedFiles) {
        payload.append('files', file);
      }

      const ticket = await createTicketWithAttachments(payload);
      toast.success('Ticket créé avec succès.');
      router.push(`/tickets/${ticket.id}`);
    } catch (error) {
      console.error('Erreur lors de la creation du ticket:', error);
      toast.error("Impossible de créer le ticket pour l'instant. Réessaie dans quelques secondes.");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-surface border border-border-default rounded-xl shadow-soft-md overflow-hidden">
        {/* Progression du wizard */}
        <div className="px-4 py-3 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${step >= 0 ? 'bg-[color:var(--accent)] border-[color:var(--accent)] text-white' : 'bg-surface-alt border-border-default text-muted'}`}>1</span>
              <span className={step === 0 ? 'text-foreground' : 'text-muted'}>Où &amp; quoi</span>
            </div>
            <div className="relative h-0.5 flex-1 overflow-hidden rounded bg-border-default">
              <div
                className="absolute inset-0 origin-left bg-[color:var(--accent)] transition-transform duration-300 ease-out"
                style={{ transform: step >= 1 ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${step >= 1 ? 'bg-[color:var(--accent)] border-[color:var(--accent)] text-white' : 'bg-surface-alt border-border-default text-muted'}`}>2</span>
              <span className={step === 1 ? 'text-foreground' : 'text-muted'}>Le problème</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div key={step} className="p-4 space-y-4 animate-fade-in-up">
            {step === 0 ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-foreground">Où se situe l’incident ?</p>
                  <p className="text-xs text-muted mt-0.5">Localisation puis équipement concerné.</p>
                </div>
                <div>
                  <label htmlFor="location" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
                    Localisation *
                  </label>
                  <select
                    id="location"
                    value={selectedLocationId}
                    onChange={(e) => {
                      setSelectedLocationId(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
                    disabled={loading}
                  >
                    <option value="">Selectionner une localisation</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
                    Equipement concerne *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(true)}
                      disabled={loading}
                      className="px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors hover:border-[color:var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Rechercher un equipement
                    </button>
                    <div className="text-xs text-muted self-center tabular-nums">
                      {`${filteredCount} equipement(s)`}
                    </div>
                  </div>
                  {selectedEquipment ? (
                    <div className="mt-2 p-2 border border-border-default rounded-lg bg-surface-alt">
                      <p className="text-sm font-medium text-foreground">
                        {selectedEquipment.name} <span className="font-mono text-xs text-muted">({selectedEquipment.refCode})</span>
                      </p>
                      <p className="text-xs text-muted">
                        {selectedEquipment.category.name} · {selectedEquipment.team.name}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted">Choisis l’équipement concerné pour continuer.</p>
                  )}
                  {selectedLocationId && (
                    <p className="mt-1 text-xs text-muted">
                      Affichage: équipements de la localisation sélectionnée + équipements globaux.
                    </p>
                  )}
                  {filteredCount === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Aucun équipement visible avec vos abonnements actuels. Demande à un manager de t’abonner à la catégorie.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold text-foreground">Décris le problème</p>
                  <p className="text-xs text-muted mt-0.5">Un titre clair, le détail, et des photos si possible.</p>
                </div>
                <div>
                  <label htmlFor="title" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
                    Titre *
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
                    placeholder="Ex: Onduleur non alimente"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
                    Description detaillee *
                  </label>
                  <textarea
                    id="description"
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none resize-none"
                    placeholder="Decrivez le probleme rencontre en detail..."
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="priority" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
                    Priorite
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value as '' | 'P1' | 'P2' | 'P3' })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
                    disabled={loading}
                  >
                    <option value="">Automatique (selon l&apos;equipement)</option>
                    <option value="P1">P1 &mdash; devis sous 3 jours</option>
                    <option value="P2">P2 &mdash; devis sous 1 semaine</option>
                    <option value="P3">P3 &mdash; a definir</option>
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    Laisse &laquo;&nbsp;Automatique&nbsp;&raquo; pour appliquer la priorite par defaut de l&apos;equipement.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
                    Pieces jointes (optionnel)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    disabled={loading}
                    onChange={(e) => setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])}
                    className="w-full text-sm file:mr-2 file:px-2 file:py-1 file:text-xs file:font-medium file:bg-[#e8513b]/10 file:text-[color:var(--accent)] file:border-0 file:rounded border border-border-default rounded-lg bg-surface text-muted"
                  />
                  {selectedFiles.length > 0 && (
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      {selectedFiles.length} pièce(s) jointe(s) prête(s) à l’envoi
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border-default bg-surface-alt">
            {step === 0 ? (
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="px-3 py-1.5 text-sm border border-border-default text-foreground rounded-lg transition-colors hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={loading}
                className="px-3 py-1.5 text-sm border border-border-default text-foreground rounded-lg transition-colors hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Précédent
              </button>
            )}
            {step === 0 ? (
              <button
                type="button"
                onClick={goToProblemStep}
                className="px-4 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)]"
              >
                Suivant →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium bg-[color:var(--accent)] text-white rounded-lg transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {loading && (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Creation en cours...' : 'Creer le ticket'}
              </button>
            )}
          </div>
        </form>
      </div>

      <EquipmentPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        equipments={visibleEquipments}
        selectedEquipmentId={formData.equipmentId}
        onSelect={(equipmentId) => setFormData((prev) => ({ ...prev, equipmentId }))}
      />
    </>
  );
}
