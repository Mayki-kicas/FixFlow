'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  subscribeGroupToCategory,
  unsubscribeGroupFromCategory,
  subscribeUserToCategory,
  unsubscribeUserFromCategory,
} from '@/lib/actions/categories';
import { UserRole, Priority } from '@prisma/client';
import { PRIORITIES, PRIORITY_META } from '@/lib/priority';

type Category = {
  id: string;
  name: string;
  description: string | null;
  defaultPriority: Priority;
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
  correctiveSlaHours: number | null;
  _count: {
    equipments: number;
  };
  groupSubscriptions: Array<{
    group: {
      id: string;
      name: string;
    };
  }>;
  userSubscriptions: Array<{
    user: {
      id: string;
      displayName: string;
      role: UserRole;
    };
  }>;
};

type CategoryManagerProps = {
  categories: Category[];
  groups: Array<{
    id: string;
    name: string;
  }>;
  users: Array<{
    id: string;
    displayName: string;
    role: UserRole;
  }>;
};

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out';

const roleLabel: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MAINTAINER: 'Mainteneur',
  BASIC: 'Utilisateur',
};

// État de formulaire d'une catégorie : les délais sont des chaînes (champ vide = "à définir").
type CategoryFormState = {
  name: string;
  description: string;
  defaultPriority: Priority;
  p1DelayDays: string;
  p2DelayDays: string;
  p3DelayDays: string;
  correctiveSlaHours: string;
};

const emptyForm: CategoryFormState = {
  name: '',
  description: '',
  defaultPriority: 'P2',
  p1DelayDays: '3',
  p2DelayDays: '7',
  p3DelayDays: '',
  correctiveSlaHours: '',
};

function formFromCategory(category: Category): CategoryFormState {
  return {
    name: category.name,
    description: category.description || '',
    defaultPriority: category.defaultPriority,
    p1DelayDays: category.p1DelayDays?.toString() ?? '',
    p2DelayDays: category.p2DelayDays?.toString() ?? '',
    p3DelayDays: category.p3DelayDays?.toString() ?? '',
    correctiveSlaHours: category.correctiveSlaHours?.toString() ?? '',
  };
}

// Chaîne -> nombre|null (vide => null = à définir / pas de SLA).
function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function slaPayload(form: CategoryFormState) {
  return {
    defaultPriority: form.defaultPriority,
    p1DelayDays: toIntOrNull(form.p1DelayDays),
    p2DelayDays: toIntOrNull(form.p2DelayDays),
    p3DelayDays: toIntOrNull(form.p3DelayDays),
    correctiveSlaHours: toIntOrNull(form.correctiveSlaHours),
  };
}

const slaInputClass =
  'w-full px-2 py-1 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out';

// Champs SLA / priorité d'une catégorie, partagés entre l'ajout et l'édition.
function SlaFieldset({
  form,
  onChange,
}: {
  form: CategoryFormState;
  onChange: (patch: Partial<CategoryFormState>) => void;
}) {
  return (
    <div className="rounded-xl border border-border-default p-2 space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">SLA &amp; priorité</p>
      <div>
        <label className="block text-[11px] text-muted mb-0.5">Priorité par défaut des tickets</label>
        <select
          value={form.defaultPriority}
          onChange={(e) => onChange({ defaultPriority: e.target.value as Priority })}
          className={slaInputClass}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].short} — {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="text-[11px] text-muted mb-0.5">Délai devis (amélioratif, en jours — vide = à définir)</p>
        <div className="grid grid-cols-3 gap-1">
          {(['p1DelayDays', 'p2DelayDays', 'p3DelayDays'] as const).map((key, i) => (
            <input
              key={key}
              type="number"
              min={0}
              value={form[key]}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<CategoryFormState>)}
              placeholder={`P${i + 1}`}
              className={slaInputClass}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-muted mb-0.5">
          SLA correctif — résolution, en heures (vide = aucun)
        </label>
        <input
          type="number"
          min={0}
          value={form.correctiveSlaHours}
          onChange={(e) => onChange({ correctiveSlaHours: e.target.value })}
          placeholder="ex. 1 (désincarcération), 4 (porte auto), 72 (éclairage)"
          className={slaInputClass}
        />
      </div>
    </div>
  );
}

export default function CategoryManager({ categories, groups, users }: CategoryManagerProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<CategoryFormState>(emptyForm);
  const [editCategory, setEditCategory] = useState<CategoryFormState>(emptyForm);
  const [selectedGroupByCategory, setSelectedGroupByCategory] = useState<Record<string, string>>({});
  const [selectedUserByCategory, setSelectedUserByCategory] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAsync = async (fn: () => Promise<void>) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;
    await handleAsync(async () => {
      await createCategory({
        name: newCategory.name,
        description: newCategory.description || undefined,
        ...slaPayload(newCategory),
      });
      setNewCategory(emptyForm);
      setIsAdding(false);
    });
  };

  const handleUpdateCategory = async (categoryId: string) => {
    if (!editCategory.name.trim()) return;
    await handleAsync(async () => {
      await updateCategory({
        id: categoryId,
        name: editCategory.name,
        description: editCategory.description || undefined,
        ...slaPayload(editCategory),
      });
      setEditingId(null);
    });
  };

  const handleDeleteCategory = async (categoryId: string, equipmentCount: number) => {
    if (equipmentCount > 0) {
      setError(
        `Cette catégorie contient ${equipmentCount} équipement(s). Supprimez ou modifiez ces équipements d'abord.`
      );
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    await handleAsync(async () => {
      await deleteCategory(categoryId);
    });
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setEditCategory(formFromCategory(category));
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] transition-colors duration-150 ease-out"
        >
          + Ajouter une catégorie
        </button>
      )}

      {isAdding && (
        <div className="p-3 bg-surface-alt rounded-xl border border-border-default">
          <h3 className="text-sm font-medium text-foreground mb-2">Nouvelle catégorie</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="Nom de la catégorie *"
              className={inputClass}
              autoFocus
            />
            <input
              type="text"
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              placeholder="Description (optionnel)"
              className={inputClass}
            />
            <SlaFieldset form={newCategory} onChange={(patch) => setNewCategory((f) => ({ ...f, ...patch }))} />
            <div className="flex gap-2">
              <button
                onClick={handleAddCategory}
                disabled={isSubmitting || !newCategory.name.trim()}
                className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out"
              >
                {isSubmitting ? 'Création...' : 'Créer'}
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewCategory(emptyForm);
                  setError(null);
                }}
                className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-[color:var(--border-default)] border border-border-default rounded-xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">
            Aucune catégorie. Créez-en une pour commencer.
          </div>
        ) : (
          categories.map((category) => {
            const availableGroups = groups.filter(
              (group) => !category.groupSubscriptions.some((entry) => entry.group.id === group.id)
            );
            const availableUsers = users.filter(
              (user) => !category.userSubscriptions.some((entry) => entry.user.id === user.id)
            );
            const selectedGroupId = selectedGroupByCategory[category.id] || '';
            const selectedUserId = selectedUserByCategory[category.id] || '';

            return (
              <div key={category.id} className="px-3 py-2.5 bg-surface">
                {editingId === category.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editCategory.name}
                      onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                      className={inputClass}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editCategory.description}
                      onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                      placeholder="Description (optionnel)"
                      className={inputClass}
                    />
                    <SlaFieldset form={editCategory} onChange={(patch) => setEditCategory((f) => ({ ...f, ...patch }))} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateCategory(category.id)}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out"
                      >
                        Sauver
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-sm text-muted hover:text-foreground transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{category.name}</h4>
                        {category.description && (
                          <p className="text-xs text-muted">{category.description}</p>
                        )}
                        <p className="text-xs text-muted mt-0.5 tabular-nums">
                          {category._count.equipments} équipement(s)
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1 tabular-nums">
                          <span className="badge badge-neutral">Prio {PRIORITY_META[category.defaultPriority].short}</span>
                          <span className="badge badge-neutral">
                            Devis {category.p1DelayDays ?? '—'}/{category.p2DelayDays ?? '—'}/{category.p3DelayDays ?? '—'} j
                          </span>
                          <span className="badge badge-neutral">
                            Correctif {category.correctiveSlaHours != null ? `${category.correctiveSlaHours} h` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-[11px] text-muted tabular-nums">
                          Accès BASIC: {category.groupSubscriptions.length} groupe(s), {category.userSubscriptions.length} utilisateur(s)
                        </span>
                        <button
                          onClick={() => startEditing(category)}
                          className="text-xs text-[color:var(--accent)] hover:opacity-80 transition-opacity"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id, category._count.equipments)}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border-default grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-border-default p-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">
                          1) Groupes autorisés
                        </p>
                        <p className="text-[11px] text-muted mb-1">
                          Tous les membres de ces groupes voient cette catégorie.
                        </p>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {category.groupSubscriptions.length === 0 && (
                            <span className="text-xs text-muted">Aucun</span>
                          )}
                          {category.groupSubscriptions.map((entry) => (
                            <span
                              key={entry.group.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[#2f6f9e]/10 text-[color:var(--accent-2)]"
                            >
                              {entry.group.name}
                              <button
                                type="button"
                                onClick={() =>
                                  handleAsync(() => unsubscribeGroupFromCategory(category.id, entry.group.id))
                                }
                                disabled={isSubmitting}
                                className="hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                                title="Retirer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <select
                            value={selectedGroupId}
                            onChange={(e) =>
                              setSelectedGroupByCategory((prev) => ({ ...prev, [category.id]: e.target.value }))
                            }
                            className="flex-1 px-2 py-1 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
                          >
                            <option value="">Ajouter un groupe...</option>
                            {availableGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedGroupId || isSubmitting}
                            onClick={() =>
                              handleAsync(async () => {
                                await subscribeGroupToCategory(category.id, selectedGroupId);
                                setSelectedGroupByCategory((prev) => ({ ...prev, [category.id]: '' }));
                              })
                            }
                            className="px-2 py-1 text-xs font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors duration-150 ease-out"
                          >
                            Autoriser
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border-default p-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">
                          2) Utilisateurs autorisés
                        </p>
                        <p className="text-[11px] text-muted mb-1">
                          Accès direct utilisateur (même sans groupe).
                        </p>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {category.userSubscriptions.length === 0 && (
                            <span className="text-xs text-muted">Aucun</span>
                          )}
                          {category.userSubscriptions.map((entry) => (
                            <span
                              key={entry.user.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            >
                              {entry.user.displayName} · {roleLabel[entry.user.role]}
                              <button
                                type="button"
                                onClick={() =>
                                  handleAsync(() => unsubscribeUserFromCategory(category.id, entry.user.id))
                                }
                                disabled={isSubmitting}
                                className="hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                                title="Retirer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <select
                            value={selectedUserId}
                            onChange={(e) =>
                              setSelectedUserByCategory((prev) => ({ ...prev, [category.id]: e.target.value }))
                            }
                            className="flex-1 px-2 py-1 text-xs border border-border-default rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8513b]/25 focus:border-[color:var(--accent)] transition-colors duration-150 ease-out"
                          >
                            <option value="">Ajouter un utilisateur...</option>
                            {availableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.displayName} - {roleLabel[user.role]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedUserId || isSubmitting}
                            onClick={() =>
                              handleAsync(async () => {
                                await subscribeUserToCategory(category.id, selectedUserId);
                                setSelectedUserByCategory((prev) => ({ ...prev, [category.id]: '' }));
                              })
                            }
                            className="px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 ease-out"
                          >
                            Autoriser
                          </button>
                        </div>
                      </div>
                    </div>

                    {category.groupSubscriptions.length === 0 && category.userSubscriptions.length === 0 && (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                        Aucun accès défini: les utilisateurs BASIC ne verront pas cette catégorie.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
