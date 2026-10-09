'use client';

import { useMemo, useState } from 'react';

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

type EquipmentPickerModalProps = {
  open: boolean;
  onClose: () => void;
  equipments: Equipment[];
  selectedEquipmentId?: string;
  onSelect: (equipmentId: string) => void;
};

export default function EquipmentPickerModal({
  open,
  onClose,
  equipments,
  selectedEquipmentId,
  onSelect,
}: EquipmentPickerModalProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = useMemo(() => {
    return Array.from(new Set(equipments.map((eq) => eq.category.name))).sort((a, b) =>
      a.localeCompare(b, 'fr')
    );
  }, [equipments]);

  const filteredEquipments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return equipments.filter((eq) => {
      if (categoryFilter && eq.category.name !== categoryFilter) return false;
      if (!normalizedQuery) return true;

      return (
        eq.name.toLowerCase().includes(normalizedQuery) ||
        eq.refCode.toLowerCase().includes(normalizedQuery) ||
        eq.category.name.toLowerCase().includes(normalizedQuery) ||
        eq.team.name.toLowerCase().includes(normalizedQuery) ||
        (eq.location?.name.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [equipments, query, categoryFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12 overflow-y-auto">
      <div className="w-full max-w-4xl bg-surface border border-border-default rounded-xl shadow-soft-lg">
        <div className="px-4 py-3 border-b border-border-default flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Selectionner un equipement</h3>
            <p className="text-xs text-muted">Recherche rapide + filtre par categorie</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs border border-border-default rounded-lg text-muted hover:bg-surface-alt hover:text-foreground transition-colors duration-150 ease-out"
          >
            Fermer
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border-default grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, code, categorie, equipe...)"
            className="md:col-span-2 w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
          >
            <option value="">Toutes les categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {filteredEquipments.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted">Aucun equipement trouve</p>
          ) : (
            <table className="min-w-full divide-y divide-[color:var(--border-default)]">
              <thead className="bg-surface-alt">
                <tr>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted uppercase tracking-wide">Code</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted uppercase tracking-wide">Equipement</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted uppercase tracking-wide">Categorie</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted uppercase tracking-wide">Equipe</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted uppercase tracking-wide">Localisation</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-default)]">
                {filteredEquipments.map((eq) => (
                  <tr
                    key={eq.id}
                    className={eq.id === selectedEquipmentId ? 'bg-[#e8513b]/10' : 'hover:bg-surface-alt transition-colors duration-150 ease-out'}
                  >
                    <td className="px-3 py-2 text-xs font-mono text-foreground">{eq.refCode}</td>
                    <td className="px-3 py-2 text-xs text-foreground">{eq.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{eq.category.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{eq.team.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{eq.location?.name || 'Global'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(eq.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-xs font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out"
                      >
                        Choisir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
