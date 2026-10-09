'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getEquipmentKanban } from '@/lib/actions/floor-plans';
import TicketKanban from '@/components/TicketKanban';

type KanbanData = Awaited<ReturnType<typeof getEquipmentKanban>>;

// Panneau affiché au clic sur un marqueur : infos équipement + kanban de ses tickets.
// `canEdit` : le lien vers la fiche équipement (backoffice) n'est montré qu'aux
// utilisateurs habilités à la modifier.
export default function EquipmentTicketsPanel({
  equipmentId,
  canEdit = false,
}: {
  equipmentId: string;
  canEdit?: boolean;
}) {
  const [data, setData] = useState<KanbanData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getEquipmentKanban(equipmentId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [equipmentId]);

  if (loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }
  if (error) {
    return <p className="text-sm text-[#b91c1c] dark:text-[#f87171]">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted">Équipement introuvable.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="card-head">
          <span className="card-head-title">Équipement</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3">
          <div className="col-span-2">
            <span className="field-label">Nom</span>
            <p className="field-value">{data.equipment.name}</p>
          </div>
          <div>
            <span className="field-label">Référence</span>
            <p className="field-value font-mono">{data.equipment.refCode}</p>
          </div>
          <div>
            <span className="field-label">Catégorie</span>
            <p className="field-value">{data.equipment.category.name}</p>
          </div>
          <div>
            <span className="field-label">Équipe</span>
            <p className="field-value">{data.equipment.team.name}</p>
          </div>
          {canEdit && (
            <div className="col-span-2">
              <Link
                href={`/backoffice/equipments/${data.equipment.id}`}
                className="text-xs font-medium text-[color:var(--accent)] hover:opacity-80"
              >
                Fiche équipement →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
          Tickets ({data.tickets.length})
        </p>
        {data.tickets.length === 0 ? (
          <p className="text-sm text-muted">Aucun ticket visible pour cet équipement.</p>
        ) : (
          <TicketKanban statuses={data.statuses} tickets={data.tickets} />
        )}
      </div>
    </div>
  );
}
