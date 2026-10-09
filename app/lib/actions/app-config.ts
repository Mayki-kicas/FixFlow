'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import {
  APP_CONFIG_ID,
  FIRST_RESPONSE_HOURS_MIN,
  FIRST_RESPONSE_HOURS_MAX,
} from '@/lib/app-config';

// Met à jour les réglages globaux. ADMIN uniquement.
export async function updateAppConfig(input: { firstResponseHours: number; laborRateCents?: number | null }) {
  const user = await requireRole(['ADMIN']);

  const hours = Math.trunc(Number(input.firstResponseHours));
  if (!Number.isFinite(hours) || hours < FIRST_RESPONSE_HOURS_MIN || hours > FIRST_RESPONSE_HOURS_MAX) {
    throw new Error(
      `Délai de prise en charge invalide (${FIRST_RESPONSE_HOURS_MIN} à ${FIRST_RESPONSE_HOURS_MAX} heures)`,
    );
  }

  // Taux horaire main d'œuvre (centimes) : null = non valorisée ; sinon entier >= 0.
  let laborRateCents: number | null | undefined;
  if (input.laborRateCents !== undefined) {
    if (input.laborRateCents === null) {
      laborRateCents = null;
    } else {
      const rate = Math.trunc(Number(input.laborRateCents));
      if (!Number.isFinite(rate) || rate < 0 || rate > 100000000) {
        throw new Error('Taux horaire invalide');
      }
      laborRateCents = rate;
    }
  }

  const config = await prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: { firstResponseHours: hours, laborRateCents },
    create: { id: APP_CONFIG_ID, firstResponseHours: hours, laborRateCents: laborRateCents ?? null },
  });

  revalidatePath('/backoffice/settings');
  await logAudit({
    actorId: user.id,
    entity: 'APP_CONFIG',
    entityId: APP_CONFIG_ID,
    action: 'APP_CONFIG_UPDATED',
    changes: { firstResponseHours: hours, laborRateCents },
  });
  return config;
}
