# Sites (localisations)

## Structure dans la base de données

Les sites sont stockés dans le modèle `Location` avec les champs suivants :
- `id` : Identifiant unique (généré automatiquement)
- `code` : Code court unique du site
- `name` : Nom complet du site
- `address` / `city` / `postalCode` : Adresse postale
- `email` : Email de contact du site
- `createdAt` / `updatedAt` : Dates de création et modification

## Gestion des sites

### Via le backoffice (ADMIN/MANAGER)
- Interface CRUD complète accessible depuis `/backoffice/locations`
- Ajout, modification, suppression de sites
- Association avec les équipements

### Via le seed
Le fichier [`app/prisma/locations-data.ts`](../app/prisma/locations-data.ts) contient des
**sites de démonstration fictifs** chargés au `seed`. Remplace-les par tes propres sites
(ou vide le tableau) pour un déploiement réel.

## Format d'import

```typescript
const locations = [
  { code: 'NOR', name: 'Site Nord', address: '1 rue de la Démo', city: 'Lille', postalCode: '59000', email: 'nord@example.com' },
  { code: 'SUD', name: 'Site Sud', address: '2 avenue Exemple', city: 'Marseille', postalCode: '13001', email: 'sud@example.com' },
  // ... etc
];
```
