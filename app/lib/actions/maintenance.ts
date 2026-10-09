'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES, canManageTicketLifecycle } from '@/lib/access-policy';
import { requireAuth } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { generateDuePreventiveTickets } from '@/lib/maintenance-core';
import { Priority } from '@prisma/client';

type PlanTaskInput = { label: string; order?: number };

type PlanTrigger = 'CALENDAR' | 'METER';

export type CreateMaintenancePlanInput = {
  name: string;
  description?: string | null;
  equipmentId: string;
  trigger?: PlanTrigger;
  // Calendaire
  intervalDays?: number | null;
  leadTimeDays?: number;
  firstDueAt?: Date | null;
  // Compteur
  meterId?: string | null;
  meterInterval?: number | null;
  isRegulatory?: boolean;
  priority?: Priority | null;
  teamId?: string | null;
  maintainerId?: string | null;
  tasks?: PlanTaskInput[];
};

export type UpdateMaintenancePlanInput = Partial<Omit<CreateMaintenancePlanInput, 'firstDueAt'>> & {
  id: string;
  nextDueAt?: Date;
};

function validateCommon(input: { name?: string; leadTimeDays?: number }) {
  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > 160)) {
    throw new Error('Nom du plan invalide');
  }
  if (input.leadTimeDays !== undefined && (!Number.isInteger(input.leadTimeDays) || input.leadTimeDays < 0)) {
    throw new Error("Délai d'anticipation invalide (jours, entier ≥ 0)");
  }
}

function cleanTasks(tasks?: PlanTaskInput[]) {
  return (tasks ?? [])
    .map((t, i) => ({ label: t.label.trim(), order: t.order ?? i }))
    .filter((t) => t.label !== '');
}

export async function createMaintenancePlan(input: CreateMaintenancePlanInput) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  validateCommon(input);
  if (!input.equipmentId) throw new Error('Équipement requis');

  const trigger: PlanTrigger = input.trigger ?? 'CALENDAR';

  // Données spécifiques au déclencheur.
  let triggerData: {
    intervalDays: number | null;
    nextDueAt: Date | null;
    meterId: string | null;
    meterInterval: number | null;
    lastGeneratedMeterValue: number | null;
  };

  if (trigger === 'METER') {
    if (!input.meterId) throw new Error('Compteur requis');
    if (input.meterInterval == null || !(input.meterInterval > 0)) {
      throw new Error('Intervalle compteur invalide (> 0)');
    }
    const meter = await prisma.meter.findUnique({
      where: { id: input.meterId },
      select: { readings: { orderBy: { readAt: 'desc' }, take: 1, select: { value: true } } },
    });
    if (!meter) throw new Error('Compteur introuvable');
    triggerData = {
      intervalDays: null,
      nextDueAt: null,
      meterId: input.meterId,
      meterInterval: input.meterInterval,
      lastGeneratedMeterValue: meter.readings[0]?.value ?? 0,
    };
  } else {
    if (input.intervalDays == null || !Number.isInteger(input.intervalDays) || input.intervalDays < 1) {
      throw new Error('Périodicité invalide (jours, entier ≥ 1)');
    }
    if (!(input.firstDueAt instanceof Date) || Number.isNaN(input.firstDueAt.getTime())) {
      throw new Error('Première échéance invalide');
    }
    triggerData = {
      intervalDays: input.intervalDays,
      nextDueAt: input.firstDueAt,
      meterId: null,
      meterInterval: null,
      lastGeneratedMeterValue: null,
    };
  }

  const plan = await prisma.maintenancePlan.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      equipmentId: input.equipmentId,
      trigger,
      leadTimeDays: input.leadTimeDays ?? 0,
      isRegulatory: input.isRegulatory ?? false,
      priority: input.priority ?? null,
      teamId: input.teamId || null,
      maintainerId: input.maintainerId || null,
      createdByUserId: user.id,
      ...triggerData,
      tasks: { create: cleanTasks(input.tasks) },
    },
  });

  revalidatePath('/backoffice/preventif');
  await logAudit({ actorId: user.id, entity: 'MAINTENANCE_PLAN', entityId: plan.id, action: 'MAINTENANCE_PLAN_CREATED', changes: { name: plan.name, trigger } });
  return { id: plan.id };
}

export async function updateMaintenancePlan(input: UpdateMaintenancePlanInput) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  validateCommon(input);

  const { id, tasks, firstDueAt: _ignored, ...rest } = input as UpdateMaintenancePlanInput & { firstDueAt?: Date };
  void _ignored;

  await prisma.$transaction(async (tx) => {
    await tx.maintenancePlan.update({
      where: { id },
      data: {
        name: rest.name?.trim(),
        description: rest.description === undefined ? undefined : rest.description?.trim() || null,
        equipmentId: rest.equipmentId,
        intervalDays: rest.intervalDays === undefined ? undefined : rest.intervalDays,
        leadTimeDays: rest.leadTimeDays,
        meterInterval: rest.meterInterval === undefined ? undefined : rest.meterInterval,
        isRegulatory: rest.isRegulatory,
        priority: rest.priority === undefined ? undefined : rest.priority ?? null,
        teamId: rest.teamId === undefined ? undefined : rest.teamId || null,
        maintainerId: rest.maintainerId === undefined ? undefined : rest.maintainerId || null,
        nextDueAt: rest.nextDueAt,
      },
    });
    // Si des tâches sont fournies, on remplace la gamme.
    if (tasks !== undefined) {
      await tx.maintenanceTask.deleteMany({ where: { planId: id } });
      const clean = cleanTasks(tasks);
      if (clean.length) {
        await tx.maintenanceTask.createMany({ data: clean.map((t) => ({ ...t, planId: id })) });
      }
    }
  });

  revalidatePath('/backoffice/preventif');
  await logAudit({ actorId: user.id, entity: 'MAINTENANCE_PLAN', entityId: id, action: 'MAINTENANCE_PLAN_UPDATED' });
  return { id };
}

export async function setMaintenancePlanActive(id: string, active: boolean) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  await prisma.maintenancePlan.update({ where: { id }, data: { active } });
  revalidatePath('/backoffice/preventif');
  await logAudit({ actorId: user.id, entity: 'MAINTENANCE_PLAN', entityId: id, action: active ? 'MAINTENANCE_PLAN_ACTIVATED' : 'MAINTENANCE_PLAN_PAUSED' });
  return { ok: true };
}

export async function deleteMaintenancePlan(id: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  await prisma.maintenancePlan.delete({ where: { id } });
  revalidatePath('/backoffice/preventif');
  await logAudit({ actorId: user.id, entity: 'MAINTENANCE_PLAN', entityId: id, action: 'MAINTENANCE_PLAN_DELETED' });
  return { ok: true };
}

export async function getMaintenancePlans() {
  await requireRole(TICKET_MANAGER_ROLES);
  return prisma.maintenancePlan.findMany({
    orderBy: [{ active: 'desc' }, { nextDueAt: 'asc' }],
    select: {
      id: true,
      name: true,
      trigger: true,
      intervalDays: true,
      leadTimeDays: true,
      meterInterval: true,
      lastGeneratedMeterValue: true,
      isRegulatory: true,
      active: true,
      nextDueAt: true,
      lastGeneratedAt: true,
      priority: true,
      equipment: { select: { id: true, name: true, refCode: true } },
      meter: {
        select: { id: true, name: true, unit: true, readings: { orderBy: { readAt: 'desc' }, take: 1, select: { value: true } } },
      },
      team: { select: { id: true, name: true } },
      maintainer: { select: { id: true, name: true } },
      tasks: { orderBy: { order: 'asc' }, select: { label: true, order: true } },
      _count: { select: { tickets: true } },
    },
  });
}

// Déclenchement manuel de la génération (bouton backoffice) — utile pour tester / rattraper.
export async function generatePreventiveNow() {
  await requireRole(TICKET_MANAGER_ROLES);
  const result = await generateDuePreventiveTickets(new Date());
  revalidatePath('/backoffice/preventif');
  revalidatePath('/tickets');
  return result;
}

// Coche / décoche une tâche d'OT.
export async function toggleTicketTask(taskId: string, done: boolean) {
  const user = await requireAuth();
  if (!canManageTicketLifecycle(user.role)) {
    throw new Error('Permissions insuffisantes');
  }
  const task = await prisma.ticketTask.update({
    where: { id: taskId },
    data: { done, doneByUserId: done ? user.id : null, doneAt: done ? new Date() : null },
    select: { id: true, ticketId: true },
  });
  revalidatePath(`/tickets/${task.ticketId}`);
  return { ok: true };
}
