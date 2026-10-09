import { prisma } from '../lib/prisma';

const COUNT = Number(process.env.COUNT || 500);
const DAYS = Number(process.env.DAYS || 90);
const REQUESTER_EMAIL = (process.env.REQUESTER_EMAIL || '').trim().toLowerCase();

const titles = [
  "Imprimante en panne",
  "Climatisation défectueuse",
  "Panne internet",
  "Problème d'accès",
  "Écran noir",
  "Fuite d'eau",
  "Badge non reconnu",
  "Alarme déclenchée",
  "Porte automatique bloquée",
  "Caméra hors service",
  "PC accueil lent",
  "Interphone muet",
  "Toilettes bouchées",
  "Lumière clignotante",
  "Système audio HS",
  "Bruit suspect",
  "Incident logiciel",
  "Mise à jour impossible",
  "Erreur de lecture",
  "Vitre fissurée",
];

const descriptions = [
  "Signalé par un utilisateur. Merci d'intervenir rapidement.",
  "Le problème est récurrent depuis plusieurs jours.",
  "Impact limité mais à corriger dès que possible.",
  "Incident bloquant sur l'activité.",
  "Merci de diagnostiquer et proposer une solution.",
  "Le matériel semble hors service.",
  "Le symptôme apparaît de façon intermittente.",
  "Besoin d'un remplacement si nécessaire.",
  "Signalé par l'équipe d'accueil.",
  "Contexte à confirmer sur place.",
];

const priorities = ['P1', 'P2', 'P3'] as const;

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateInLastDays(days: number) {
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const time = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(time);
}

async function main() {
  await prisma.attachment.deleteMany({
    where: {
      OR: [{ ticketId: { not: null } }, { chatMessageId: { not: null } }],
    },
  });
  await prisma.chatMessage.deleteMany({});
  await prisma.ticketSubscription.deleteMany({});
  await prisma.ticket.deleteMany({});

  const equipments = await prisma.equipment.findMany({
    include: {
      team: { include: { statuses: { orderBy: { order: 'asc' } } } },
    },
  });

  const users = await prisma.user.findMany();
  const locations = await prisma.location.findMany();

  const maintainers = await prisma.maintainer.findMany();

  if (equipments.length === 0) {
    console.error('No equipment found.');
    process.exit(1);
  }
  if (users.length === 0) {
    console.error('No users found.');
    process.exit(1);
  }

  let forcedRequesterId: string | null = null;
  if (REQUESTER_EMAIL) {
    const forcedUser = users.find((u) => u.email.toLowerCase() === REQUESTER_EMAIL);
    if (!forcedUser) {
      console.error(`Requested requester not found: ${REQUESTER_EMAIL}`);
      process.exit(1);
    }
    forcedRequesterId = forcedUser.id;
  }

  const ticketCreates = [] as ReturnType<typeof prisma.ticket.create>[];

  for (let i = 0; i < COUNT; i += 1) {
    const equipment = randomItem(equipments);
    const teamStatuses = equipment.team.statuses.length
      ? equipment.team.statuses
      : await prisma.ticketStatus.findMany({
          where: { teamId: equipment.teamId },
          orderBy: { order: 'asc' },
        });

    const status = teamStatuses.length ? randomItem(teamStatuses) : null;
    if (!status) {
      continue;
    }

    const createdAt = randomDateInLastDays(DAYS);
    const isFinal = status.isFinal;
    const closedAt = isFinal ? new Date(createdAt.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000) : null;

    const requester = forcedRequesterId
      ? users.find((u) => u.id === forcedRequesterId)!
      : randomItem(users);
    const maintainer = Math.random() < 0.3 && maintainers.length ? randomItem(maintainers) : null;
    const location = locations.length ? (Math.random() < 0.15 ? null : randomItem(locations)) : null;

    ticketCreates.push(
      prisma.ticket.create({
        data: {
          title: randomItem(titles),
          description: randomItem(descriptions),
          statusId: status.id,
          priority: randomItem([...priorities]),
          equipmentId: equipment.id,
          requesterId: requester.id,
          teamId: equipment.teamId,
          locationId: location ? location.id : null,
          createdAt,
          updatedAt: createdAt,
          openedAt: createdAt,
          closedAt,
          maintainerId: maintainer ? maintainer.id : null,
          subscriptions: {
            create: {
              userId: requester.id,
            },
          },
        },
      })
    );
  }

  console.log(`Creating ${ticketCreates.length} tickets...`);
  for (const create of ticketCreates) {
    await create;
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
