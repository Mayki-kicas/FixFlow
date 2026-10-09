'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import { createNotificationsForUsers } from '@/lib/notifications-core';
import { logAudit } from '@/lib/audit';

// Rôles considérés comme personnel interne pouvant être affecté à un OT.
const STAFF_ROLES = ['ADMIN', 'MANAGER', 'MAINTAINER'] as const;

// --- Affectation d'un OT à un technicien interne ---------------------------
export async function assignTicket(ticketId: string, userId: string | null) {
  const actor = await requireRole(TICKET_MANAGER_ROLES);

  if (userId) {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, displayName: true } });
    if (!target) throw new Error('Utilisateur introuvable');
    if (!STAFF_ROLES.includes(target.role as (typeof STAFF_ROLES)[number])) {
      throw new Error("Cet utilisateur ne peut pas être affecté (personnel interne uniquement)");
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneeId: userId },
    select: { id: true, ticketNumber: true, title: true },
  });

  if (userId && userId !== actor.id) {
    await createNotificationsForUsers({
      userIds: [userId],
      type: 'SYSTEM',
      title: 'Ordre de travail affecté',
      message: `Vous êtes affecté à l'OT #${ticket.ticketNumber} : ${ticket.title}`,
      link: `/tickets/${ticket.id}`,
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  await logAudit({ actorId: actor.id, entity: 'TICKET', entityId: ticketId, ticketId, action: 'TICKET_ASSIGNED', changes: { assigneeId: userId } });
  return { ok: true };
}

export async function getAssignableTechnicians() {
  await requireRole(TICKET_MANAGER_ROLES);
  return prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    select: { id: true, displayName: true, role: true },
    orderBy: { displayName: 'asc' },
  });
}

// --- Compétences / habilitations -------------------------------------------
export async function createSkill(name: string) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  const clean = name?.trim();
  if (!clean || clean.length > 80) throw new Error('Nom de compétence invalide');
  try {
    const skill = await prisma.skill.create({ data: { name: clean } });
    revalidatePath('/backoffice/techniciens');
    await logAudit({ actorId: user.id, entity: 'SKILL', entityId: skill.id, action: 'SKILL_CREATED', changes: { name: clean } });
    return { id: skill.id };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      throw new Error('Cette compétence existe déjà');
    }
    throw error;
  }
}

export async function deleteSkill(id: string) {
  const user = await requireRole(['ADMIN', 'MANAGER']);
  await prisma.skill.delete({ where: { id } });
  revalidatePath('/backoffice/techniciens');
  await logAudit({ actorId: user.id, entity: 'SKILL', entityId: id, action: 'SKILL_DELETED' });
  return { ok: true };
}

export async function setUserSkills(userId: string, skillIds: string[]) {
  const actor = await requireRole(['ADMIN', 'MANAGER']);
  const uniqueIds = [...new Set(skillIds.filter(Boolean))];

  // Ne garde que des compétences existantes.
  const valid = uniqueIds.length
    ? await prisma.skill.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } })
    : [];

  await prisma.$transaction([
    prisma.userSkill.deleteMany({ where: { userId } }),
    ...(valid.length ? [prisma.userSkill.createMany({ data: valid.map((s) => ({ userId, skillId: s.id })) })] : []),
  ]);

  revalidatePath('/backoffice/techniciens');
  await logAudit({ actorId: actor.id, entity: 'USER', entityId: userId, action: 'USER_SKILLS_SET', changes: { skillIds: valid.map((s) => s.id) } });
  return { count: valid.length };
}

export async function getSkills() {
  await requireRole(['ADMIN', 'MANAGER']);
  return prisma.skill.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, _count: { select: { users: true } } },
  });
}

export async function getTechniciansWithSkills() {
  await requireRole(['ADMIN', 'MANAGER']);
  return prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    orderBy: { displayName: 'asc' },
    select: {
      id: true,
      displayName: true,
      role: true,
      skills: { select: { skillId: true } },
    },
  });
}

// Feuille de temps : minutes loguées par technicien sur la période (jours).
export async function getTimesheet(sinceDays = 30) {
  await requireRole(['ADMIN', 'MANAGER']);
  const since = new Date(Date.now() - sinceDays * 24 * 3_600_000);
  const grouped = await prisma.workLog.groupBy({
    by: ['userId'],
    where: { performedAt: { gte: since } },
    _sum: { minutes: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));
  return grouped
    .map((g) => ({ userId: g.userId, displayName: nameById.get(g.userId) ?? '—', minutes: g._sum.minutes ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes);
}
