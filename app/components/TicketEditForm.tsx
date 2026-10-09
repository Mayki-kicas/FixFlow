'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicket } from '@/lib/actions/tickets';
import EquipmentPickerModal from '@/components/EquipmentPickerModal';

type Maintainer = {
  id: string;
  name: string;
  contact: string | null;
};

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

type TicketNature = 'CORRECTIVE' | 'IMPROVEMENT' | 'PREVENTIVE';

type TicketEditFormProps = {
  ticket: {
    id: string;
    title: string;
    description: string;
    equipmentId: string;
    maintainerId: string | null;
    invoiceNumber: string | null;
    quoteNumber: string | null;
    dueDate: Date | null;
    nature: TicketNature;
    interventionStartAt: Date | null;
    interventionEndAt: Date | null;
  };
  maintainers: Maintainer[];
  equipments: Equipment[];
};

function formatDateInput(date: Date): string {
  // Use UTC components to avoid local timezone shifting the date-only value.
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOnlyToUtcDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number);
  // Noon UTC avoids edge-case drift around DST when rendered in local timezones.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export default function TicketEditForm({ ticket, maintainers, equipments }: TicketEditFormProps) {
  const router = useRouter();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: ticket.title,
    description: ticket.description,
    equipmentId: ticket.equipmentId,
    maintainerId: ticket.maintainerId || '',
    invoiceNumber: ticket.invoiceNumber || '',
    quoteNumber: ticket.quoteNumber || '',
    dueDate: ticket.dueDate ? formatDateInput(ticket.dueDate) : '',
    nature: ticket.nature as TicketNature,
    interventionStartAt: ticket.interventionStartAt ? formatDateInput(ticket.interventionStartAt) : '',
    interventionEndAt: ticket.interventionEndAt ? formatDateInput(ticket.interventionEndAt) : '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEquipment = useMemo(
    () => equipments.find((eq) => eq.id === formData.equipmentId) || null,
    [equipments, formData.equipmentId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await updateTicket({
        id: ticket.id,
        title: formData.title,
        description: formData.description,
        equipmentId: formData.equipmentId,
        maintainerId: formData.maintainerId || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        quoteNumber: formData.quoteNumber || undefined,
        dueDate: formData.dueDate ? dateOnlyToUtcDate(formData.dueDate) : undefined,
        nature: formData.nature,
        // Champ vidé => null (efface la date planifiée).
        interventionStartAt: formData.interventionStartAt ? dateOnlyToUtcDate(formData.interventionStartAt) : null,
        interventionEndAt: formData.interventionEndAt ? dateOnlyToUtcDate(formData.interventionEndAt) : null,
      });
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

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
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Equipement concerne *
          </label>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors hover:border-[color:var(--accent)]"
          >
            Rechercher un equipement
          </button>
          {selectedEquipment && (
            <div className="mt-2 p-2 border border-border-default rounded-lg bg-surface-alt">
              <p className="text-sm font-medium text-foreground">
                {selectedEquipment.name} <span className="font-mono text-xs text-muted">({selectedEquipment.refCode})</span>
              </p>
              <p className="text-xs text-muted">
                {selectedEquipment.category.name} · {selectedEquipment.team.name} · {selectedEquipment.location?.name || 'Global'}
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Description *
          </label>
          <textarea
            id="description"
            required
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label htmlFor="nature" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Nature
          </label>
          <select
            id="nature"
            value={formData.nature}
            onChange={(e) => setFormData({ ...formData, nature: e.target.value as TicketNature })}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
          >
            <option value="CORRECTIVE">Corrective (panne / incident)</option>
            <option value="IMPROVEMENT">Améliorative (demande validée)</option>
            <option value="PREVENTIVE">Préventive (plan de maintenance)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dueDate" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
            Date d&apos;échéance
            </label>
            <input
              type="date"
              id="dueDate"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="maintainerId" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
              Mainteneur assigné
            </label>
            <select
              id="maintainerId"
              value={formData.maintainerId}
              onChange={(e) => setFormData({ ...formData, maintainerId: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
            >
              <option value="">Aucun mainteneur</option>
              {maintainers.map((maintainer) => (
                <option key={maintainer.id} value={maintainer.id}>
                  {maintainer.name}
                  {maintainer.contact && ` (${maintainer.contact})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quoteNumber" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
              N deg devis
            </label>
            <input
              type="text"
              id="quoteNumber"
              value={formData.quoteNumber}
              onChange={(e) => setFormData({ ...formData, quoteNumber: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
              placeholder="Ex: DEV-2026-0001"
            />
          </div>

          <div>
            <label htmlFor="invoiceNumber" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
              N deg facture
            </label>
            <input
              type="text"
              id="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
              placeholder="Ex: FAC-2026-0001"
            />
          </div>

          <div>
            <label htmlFor="interventionStartAt" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
              Début de chantier
            </label>
            <input
              type="date"
              id="interventionStartAt"
              value={formData.interventionStartAt}
              onChange={(e) => setFormData({ ...formData, interventionStartAt: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="interventionEndAt" className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wide">
              Fin de chantier
            </label>
            <input
              type="date"
              id="interventionEndAt"
              value={formData.interventionEndAt}
              onChange={(e) => setFormData({ ...formData, interventionEndAt: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground tabular-nums transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border-default">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-1.5 text-sm text-foreground bg-surface-alt border border-border-default rounded-lg transition-colors hover:border-[color:var(--accent)]"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isSubmitting ? 'Enregistrement...' : 'Mettre a jour'}
          </button>
        </div>
      </form>

      <EquipmentPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        equipments={equipments}
        selectedEquipmentId={formData.equipmentId}
        onSelect={(equipmentId) => setFormData((prev) => ({ ...prev, equipmentId }))}
      />
    </>
  );
}
