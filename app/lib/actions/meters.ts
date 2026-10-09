'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { TICKET_MANAGER_ROLES } from '@/lib/access-policy';
import { logAudit } from '@/lib/audit';

export async function createMeter(equipmentId: string, name: string, unit: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const cleanName = name?.trim();
  const cleanUnit = unit?.trim();
  if (!equipmentId) throw new Error('Équipement requis');
  if (!cleanName || cleanName.length > 80) throw new Error('Nom de compteur invalide');
  if (!cleanUnit || cleanUnit.length > 20) throw new Error('Unité invalide');

  const meter = await prisma.meter.create({ data: { equipmentId, name: cleanName, unit: cleanUnit } });
  revalidatePath(`/backoffice/equipments/${equipmentId}`);
  await logAudit({ actorId: user.id, entity: 'METER', entityId: meter.id, action: 'METER_CREATED', changes: { equipmentId, name: cleanName, unit: cleanUnit } });
  return { id: meter.id };
}

export async function deleteMeter(id: string) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  const meter = await prisma.meter.delete({ where: { id }, select: { equipmentId: true } });
  revalidatePath(`/backoffice/equipments/${meter.equipmentId}`);
  await logAudit({ actorId: user.id, entity: 'METER', entityId: id, action: 'METER_DELETED' });
  return { ok: true };
}

export async function addMeterReading(meterId: string, value: number, readAt?: Date | null) {
  const user = await requireRole(TICKET_MANAGER_ROLES);
  if (!meterId) throw new Error('Compteur requis');
  if (!Number.isFinite(value) || value < 0) throw new Error('Valeur invalide');

  const meter = await prisma.meter.findUnique({ where: { id: meterId }, select: { equipmentId: true } });
  if (!meter) throw new Error('Compteur introuvable');

  const reading = await prisma.meterReading.create({
    data: { meterId, value, readAt: readAt ?? new Date(), byUserId: user.id },
    select: { id: true },
  });
  revalidatePath(`/backoffice/equipments/${meter.equipmentId}`);
  await logAudit({ actorId: user.id, entity: 'METER_READING', entityId: reading.id, action: 'METER_READING_ADDED', changes: { meterId, value } });
  return { id: reading.id };
}
