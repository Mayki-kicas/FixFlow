import { PrismaClient, Priority } from '@prisma/client';
import { locationsData } from './locations-data.js';
import { hashPassword } from '../lib/password.js';

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { name: 'Nouvelle demande', color: '#3b82f6', order: 0, isFinal: false },
  { name: 'En cours de traitement', color: '#f59e0b', order: 1, isFinal: false },
  { name: "En attente d'intervention", color: '#8b5cf6', order: 2, isFinal: false },
  { name: 'Termine', color: '#22c55e', order: 3, isFinal: true },
  { name: 'Annule', color: '#6b7280', order: 4, isFinal: true },
];

const IT_EQUIPMENTS = [
  'Spacemanager',
  'Cameras interieur',
  'Cameras exterieur',
  'Ecran video 50"',
  'Ecran PC accueil',
  'Ecran PC manager',
  'Clavier/Souris',
  'Telephone accueil',
  'Telephone manager',
  'Interphone',
  'Systeme SonoIP',
  'Logiciel lecture video',
  'Windows',
  'Office / Outlook',
  'Impression',
  'Payzen',
  'Autres (Informatique)',
  'Onduleur',
  'Ordinateur portable',
  'Ordinateur accueil',
  'BearBox (Generique)',
  'Chrome',
  'Logiciel',
  'Application mobile',
  'Clavier',
  'Casque telephonique',
  'Smartphone',
  'Bug COL - Contrat en ligne',
  'Camera video',
];

const MAINTENANCE_EQUIPMENTS = [
  'Luminaire exterieur',
  'Luminaire interieur',
  'Prise electrique',
  'Climatisation',
  "Controle d'acces",
  'Nuisibles',
  'Toilettes',
  'Gabions',
  "Infiltrations d'eau (toiture, bardage, etc.)",
  'Equipement non repertorie',
  'Fontaine a eau',
  'Espaces verts',
  'Systeme de securite incendie',
  'Box tampon',
  'Chariots Wanzl',
  'Extincteur',
  'Autres (Maintenance)',
];

async function clearDatabase() {
  const safeDelete = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2021'
      ) {
        return;
      }
      throw error;
    }
  };

  await safeDelete(() => prisma.chatMessage.deleteMany());
  await safeDelete(() => prisma.attachment.deleteMany());
  await safeDelete(() => prisma.ticketSubscription.deleteMany());
  await safeDelete(() => prisma.userCategorySubscription.deleteMany());
  await safeDelete(() => prisma.groupCategorySubscription.deleteMany());
  await safeDelete(() => prisma.ticket.deleteMany());
  await safeDelete(() => prisma.ticketStatus.deleteMany());
  await safeDelete(() => prisma.notification.deleteMany());
  await safeDelete(() => prisma.maintainer.deleteMany());
  await safeDelete(() => prisma.groupTeam.deleteMany());
  await safeDelete(() => prisma.groupMember.deleteMany());
  await safeDelete(() => prisma.group.deleteMany());
  await safeDelete(() => prisma.user.deleteMany());
  await safeDelete(() => prisma.equipment.deleteMany());
  await safeDelete(() => prisma.equipmentCategory.deleteMany());
  await safeDelete(() => prisma.location.deleteMany());
  await safeDelete(() => prisma.team.deleteMany());
}

async function createTeamWithStatuses(name: string, description: string) {
  return prisma.team.create({
    data: {
      name,
      description,
      statuses: {
        create: DEFAULT_STATUSES,
      },
    },
    include: {
      statuses: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

async function main() {
  await clearDatabase();

  console.log('Chargement des sites...');
  const createdLocations = await Promise.all(
    locationsData.map((loc) =>
      prisma.location.create({
        data: {
          code: loc.code,
          name: loc.name,
          address: loc.address,
          city: loc.city,
          postalCode: loc.postalCode,
          email: loc.email,
        },
      })
    )
  );

  const globalLocation = await prisma.location.create({
    data: {
      code: 'GLOBAL',
      name: 'Global',
      address: 'Tous sites',
      city: 'GLOBAL',
      postalCode: '00000',
      email: 'global@example.com',
      description: 'Localisation globale applicable a tous les sites',
    },
  });

  console.log(`${createdLocations.length + 1} localisations creees (incluant Global)`);

  const maintenanceTeam = await createTeamWithStatuses(
    'Service Maintenance',
    'Gestion des maintenances et interventions techniques'
  );
  const communicationTeam = await createTeamWithStatuses(
    'Service Communication',
    'Gestion des supports et equipements de communication'
  );
  const itTeam = await createTeamWithStatuses(
    'Service Informatique',
    'Gestion du parc informatique et du support IT'
  );
  const webTeam = await createTeamWithStatuses(
    'Service Web',
    'Gestion des services web et outils digitaux'
  );

  console.log('Equipes par defaut creees :');
  console.log(' - Service Maintenance');
  console.log(' - Service Communication');
  console.log(' - Service Informatique');
  console.log(' - Service Web');

  const itCategory = await prisma.equipmentCategory.create({
    data: {
      name: 'Systeme informatique',
      description: 'Equipements et logiciels informatiques globaux',
    },
  });

  const maintenanceCategory = await prisma.equipmentCategory.create({
    data: {
      name: 'Equipements',
      description: 'Equipements globaux de maintenance et infrastructures',
    },
  });

  await Promise.all(
    IT_EQUIPMENTS.map((name, index) =>
      prisma.equipment.create({
        data: {
          name,
          refCode: `IT-GLOBAL-${String(index + 1).padStart(3, '0')}`,
          categoryId: itCategory.id,
          locationId: globalLocation.id,
          teamId: itTeam.id,
        },
      })
    )
  );

  await Promise.all(
    MAINTENANCE_EQUIPMENTS.map((name, index) =>
      prisma.equipment.create({
        data: {
          name,
          refCode: `MAINT-GLOBAL-${String(index + 1).padStart(3, '0')}`,
          categoryId: maintenanceCategory.id,
          locationId: globalLocation.id,
          teamId: maintenanceTeam.id,
        },
      })
    )
  );

  console.log(`${IT_EQUIPMENTS.length} equipements Informatique globaux crees`);
  console.log(`${MAINTENANCE_EQUIPMENTS.length} equipements Maintenance globaux crees`);

  // Admin LOCAL (break-glass) : email + mot de passe, toujours utilisable même
  // sans SSO. Change le mot de passe via BOOTSTRAP_ADMIN_PASSWORD (ou en UI).
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'ADMIN',
      authProvider: 'LOCAL',
      isActive: true,
      passwordHash: await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe-admin-123'),
    },
  });

  const group = await prisma.group.create({
    data: {
      name: 'Groupe Global Operations',
      description: 'Abonnements globaux pour les services operationnels',
    },
  });

  await Promise.all(
    [admin.id].map((userId) =>
      prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId,
        },
      })
    )
  );

  const siteGroup = await prisma.group.create({
    data: {
      name: 'Site',
      description: 'Groupe abonne a tous les equipements existants',
    },
  });

  await Promise.all(
    [admin.id].map((userId) =>
      prisma.groupMember.create({
        data: {
          groupId: siteGroup.id,
          userId,
        },
      })
    )
  );

  const allCategories = await prisma.equipmentCategory.findMany({
    select: { id: true },
  });

  await Promise.all(
    allCategories.map((category) =>
      prisma.groupCategorySubscription.create({
        data: {
          groupId: siteGroup.id,
          categoryId: category.id,
        },
      })
    )
  );

  const maintainer = await prisma.maintainer.create({
    data: {
      name: 'Prestataire Démo',
      email: 'prestataire@example.com',
      contact: '+33 6 00 00 00 01',
    },
  });

  const sampleEquipment = await prisma.equipment.findFirstOrThrow({
    where: { refCode: 'IT-GLOBAL-018' },
  });

  const initialStatus = itTeam.statuses[0];

  const ticket = await prisma.ticket.create({
    data: {
      title: 'Onduleur non alimente',
      description: 'Aucun redemarrage possible, voyant rouge et alarme sonore permanente.',
      statusId: initialStatus.id,
      priority: Priority.P1,
      equipmentId: sampleEquipment.id,
      teamId: itTeam.id,
      locationId: globalLocation.id,
      requesterId: admin.id,
      openedAt: new Date('2026-02-01T07:30:00.000Z'),
      dueDate: new Date('2026-02-10T17:00:00.000Z'),
      quoteNumber: 'DEV-2026-0045',
      maintainerId: maintainer.id,
      subscriptions: {
        create: {
          userId: admin.id,
        },
      },
    },
  });

  await prisma.chatMessage.create({
    data: {
      content:
        "J'ai alerte l'equipe et declenche la procedure d'urgence. Mise a jour des pieces jointes des reception.",
      authorId: admin.id,
      ticketId: ticket.id,
    },
  });

  console.log('Compte créé :');
  console.log(' - admin@example.com (ADMIN, local) — mot de passe: BOOTSTRAP_ADMIN_PASSWORD');
  console.log(`Groupe cree : ${siteGroup.name} (membres par defaut + abonnes a ${allCategories.length} categorie(s))`);
  console.log('Seed termine : localisations, equipes, equipements globaux, ticket exemple.');
}

main()
  .catch((error) => {
    console.error('Erreur pendant le seed :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
