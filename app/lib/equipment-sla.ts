import type { Priority } from '@prisma/client';

// Surcharges SLA/priorité portées par un équipement. null = hérite de la catégorie.
export type EquipmentSlaOverrides = {
  defaultPriority: Priority | null;
  correctiveSlaHours: number | null;
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
};

// Config SLA/priorité d'une catégorie (valeurs de repli).
export type CategorySlaConfig = {
  defaultPriority: Priority;
  correctiveSlaHours: number | null;
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
};

export type EffectiveSlaConfig = {
  defaultPriority: Priority;
  correctiveSlaHours: number | null;
  p1DelayDays: number | null;
  p2DelayDays: number | null;
  p3DelayDays: number | null;
};

// Fusion « override équipement > catégorie » : toute valeur définie au niveau de
// l'équipement écrase la catégorie ; sinon on retombe sur la catégorie.
export function resolveEffectiveSla(
  equipment: EquipmentSlaOverrides,
  category: CategorySlaConfig,
): EffectiveSlaConfig {
  return {
    defaultPriority: equipment.defaultPriority ?? category.defaultPriority,
    correctiveSlaHours: equipment.correctiveSlaHours ?? category.correctiveSlaHours,
    p1DelayDays: equipment.p1DelayDays ?? category.p1DelayDays,
    p2DelayDays: equipment.p2DelayDays ?? category.p2DelayDays,
    p3DelayDays: equipment.p3DelayDays ?? category.p3DelayDays,
  };
}
