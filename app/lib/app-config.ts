import { prisma } from '@/lib/prisma';

// Réglages globaux de l'outil (singleton). NON 'use server' : lisible côté serveur
// (création de ticket, pages) sans exposer d'endpoint. L'écriture passe par
// lib/actions/app-config.ts (gardée ADMIN).
export const APP_CONFIG_ID = 'singleton';

// Bornes du délai de prise en charge (heures) — partagées lecture/écriture.
export const FIRST_RESPONSE_HOURS_MIN = 1;
export const FIRST_RESPONSE_HOURS_MAX = 720;

// Lit la config, en la créant paresseusement si absente (lecture toujours sûre).
export async function getAppConfig() {
  return prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: {},
    create: { id: APP_CONFIG_ID },
  });
}
