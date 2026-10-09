# Data model & prototype

Ce document décrit le modèle de données Prisma créé pour la plateforme de maintenance et fournit un prototype d’instances pour visualiser les relations.

## Principaux modèles

1. **Ticket** : central ; lié à un équipement, une localisation, une équipe, un statut et un demandeur utilisateur. Il agrège les chats, pièces jointes, rapports et abonnements. Chaque ticket conserve ses **dates d’ouverture (`openedAt`) et de fermeture** (`closedAt` optionnelle) ainsi que des références optionnelles `invoiceNumber` et `quoteNumber` pour les suivis administratifs.
2. **Equipment / Location / Team** : permettent d’organiser les tickets par site, type d’équipement et équipe de maintenance responsable.
3. **User / Group / GroupMember** : gèrent l’accès et la visibilité via LDAP. Les groupes permettent d’abonner plusieurs utilisateurs en masse à des tickets/équipements.
4. **TicketStatus** : statut personnalisable par équipe, contrôlé uniquement par les administrateurs.
5. **ChatMessage / Attachment** : supportent la conversation contextualisée, avec photos/PDF en pièce jointe.
6. **TicketReport** : généré automatiquement après soumission du formulaire d’incident et attaché au ticket.
7. **Maintainer** : entité optionnelle représentant un mainteneur ou prestataire affecté au ticket, avec des tickets récurrents liés.

## Prototype de données

```json
{
  "teams": [
    { "id": "team-1", "name": "Équipe Site A" }
  ],
  "locations": [
    { "id": "loc-1", "name": "Site A" }
  ],
  "equipment": [
    {
      "id": "equip-1",
      "name": "Onduleur ECO",
      "refCode": "REF-U1",
      "teamId": "team-1",
      "locationId": "loc-1",
      "categoryId": "cat-1"
    }
  ],
  "users": [
    {
      "id": "user-1",
      "ldapId": "uid=mathilde,ou=infra,dc=example,dc=local",
      "email": "mathilde@example.com",
      "role": "MAINTAINER"
    }
  ],
  "groups": [
    {
      "id": "group-site-a",
      "name": "Maintenance Site A"
    }
  ],
  "tickets": [
    {
      "id": "ticket-1001",
      "title": "Onduleur non alimenté",
      "description": "Aucun redémarrage possible, voyant rouge et alarme sonnante.",
      "statusId": "status-1",
      "equipmentId": "equip-1",
      "teamId": "team-1",
      "locationId": "loc-1",
      "requesterId": "user-1",
      "urgency": "HIGH",
      "isArchived": false,
      "openedAt": "2026-02-01T07:30:00.000Z",
      "closedAt": null,
      "invoiceNumber": null,
      "quoteNumber": "DEV-2026-0045",
      "maintainerId": "maint-1"
    }
  ],
  "maintainers": [
    {
      "id": "maint-1",
      "name": "Nicolas D.",
      "contact": "+33 6 00 00 00 01"
    }
  ]
}
```

Ce prototype montre un ticket actif avec liaison à un équipement, une équipe, un statut, des dates d’ouverture/fermeture et un mainteneur optionnel qui peut être assigné. Les champs `invoiceNumber` et `quoteNumber` peuvent rester vides si l’information n’est pas encore saisie. La structure prouve aussi que les groupes peuvent être utilisés pour contrôler la visibilité des tickets/sélections d’équipement.

## Étapes suivantes du dev

1. Générer les migrations Prisma à partir de `schema.prisma`.  
2. Créer des factories ou seeds fournissant des exemples en lien avec les données ci-dessus pour faciliter le dev local.  
3. Exposer les principales entités via API/Server Actions (tickets, chat, rapport, groupes) avec les contrôles d’accès LDAP.

## Mise en route locale

1. Duplique `.env.example` en `.env` et adapte les valeurs (les services Docker écoutent sur `db:5432` par défaut).  
2. Lance `docker compose up -d db adminer` pour démarrer PostgreSQL (et Adminer pour inspecter la base).  
3. Génère le client Prisma depuis le conteneur app : `docker compose exec app npm run prisma:generate`.  
4. Terminer en lançant `docker compose exec app npm run prisma:seed` : le fichier `app/prisma/seed.ts` supprime les données existantes et insère un ticket, un mainteneur, des groupes et le chat d’exemple.
5. À partir de là, ton application (Next.js + Server Actions) pourra pointer vers `DATABASE_URL` (voir `.env`) pour consommer les données pré-remplies.
