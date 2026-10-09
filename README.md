# FixFlow - Maintenance Tickets

## Aperçu
Plateforme interne de gestion de maintenance : déclaration d'incidents, workflow tickets par équipe, chat + pièces jointes, analytique/exports manuels et backoffice de localisations/équipements. La stack se base sur Next.js pour le front/API, PostgreSQL+Prisma pour les données et Docker pour les environnements.

## Mises a jour recentes (2026-02-19)

- La page "Dashboard manager" a ete retiree.
- La page `Statistiques` a ete renommee `Analytique` : `/backoffice/analytique`.
- Filtres analytique consolides dans un bloc unique :
  - periode rapide
  - plage de dates custom
  - filtrage multi-localisations
- Ajout de nouvelles visualisations analytiques :
  - backlog ouvert dans le temps
  - top equipements en evolution (sparkbars)
  - top localisations en evolution (sparkbars)
- Photo d'equipement :
  - champ `photoBase64` sur les equipements
  - miniature dans l'entete ticket
  - previsualisation en popin (fermeture croix ou clic exterieur)
- Script de generation de donnees pour l'analytique :
  - `docker compose exec app npx tsx scripts/generate-tickets.ts`
  - regenere un volume important de tickets sur les 90 derniers jours (configurable via `COUNT` et `DAYS`).
- Mainteneurs (hors LDAP) :
  - role `MAINTAINER` unifie partout (code + base + docs)
  - authentification locale mainteneur (email + mot de passe hash)
  - creation/edition des comptes mainteneur par `ADMIN`/`MANAGER` depuis le backoffice
- Visibilite et permissions tickets :
  - `BASIC` et `MAINTAINER` ne voient que les equipes/tickets accessibles par abonnements
  - en kanban, un mainteneur ne peut pas changer l'etat (message permission explicite)
  - en detail ticket, un mainteneur ne peut pas se desabonner lui-meme (badge "Abonne")

## Démarrage rapide

Résumé :

```bash
# 1. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres LDAP

# 2. Démarrer les services Docker
docker compose up --build -d

# (Optionnel) Rebuild toolchain app si besoin
docker compose build --no-cache app
docker compose up -d --force-recreate app

# 3. Initialiser la base de données
docker compose exec app npm run prisma:generate
docker compose exec app npm run prisma:migrate
docker compose exec app npm run prisma:seed

# 4. Accéder à l'application
# http://localhost:3000 - Application Next.js
# http://localhost:8080 - Adminer (base de données)
# http://localhost:8025 - Mailpit (emails de dev)
```

## Toolchain dev (dans Docker)

Le conteneur `app` embarque la toolchain complète pour le dev:
- `next`, `react`, `typescript`
- `prisma` + client Prisma
- `tsx` (seed TypeScript)
- `eslint`
- variables LDAP/NextAuth depuis `.env`
- polling activé (`WATCHPACK_POLLING`, `CHOKIDAR_USEPOLLING`) pour le hot-reload Docker
- bootstrap au démarrage: `npm ci` si besoin + `prisma generate` automatique

Vérification rapide:

```bash
docker compose exec app npx next -v
docker compose exec app npx prisma -v
docker compose exec app npx tsx --version
docker compose exec app npm run lint
```

## Structure du dépôt
- `app/` : Application Next.js (front + API)
- `docker-compose.yml` : Services Docker (PostgreSQL, Adminer, Next.js)
- `app/prisma/` : Schéma Prisma, migrations et seed
- `.env.example` : Variables d'environnement à configurer
- `docs/` : Documentation technique
- `CLAUDE.md` : Guide pour Claude Code

## Liens importants
- `docs/DATA_MODEL.md` : modèle Prisma expliqué + prototype JSON + instructions seed/env.  
- `docs/DB_SCHEMA.md` : référence du schéma de base de données.  
- `docs/PWA_TECHNICIEN_SECURITY.md` : modèle de sécurité de la PWA mainteneur externe.  
- `docker-compose.yml` : démarrage PG + Adminer, utilisé avant de lancer le serveur Next.js.  

## Emails en local (Mailpit)

Les notifications email sont envoyées en SMTP vers Mailpit en développement.

- SMTP : `localhost:1025`
- Interface web : `http://localhost:8025`

Variables `.env` utilisées :

```env
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=FixFlow <noreply@fixflow.local>
SMTP_TIMEOUT_MS=10000
```

## Sauvegarde base de donnees

Scripts disponibles a la racine du projet:

```bash
# Creer un backup horodate (format pg_dump custom)
npm run db:backup

# Lister les backups
npm run db:backup:list

# Restaurer un backup (arrete/redemarre le container app automatiquement)
npm run db:restore -- ./backups/db/fixflow_maintenance_YYYYMMDD_HHMMSS.dump
```

Les backups sont stockes dans `backups/db/` avec un checksum `*.sha256`.

## Deploiement distant (sans Docker)

Script disponible :

```bash
sh scripts/deploy-remote.sh --help
```

Premiere installation (installe/active le service systemd) :

```bash
DEPLOY_HOST=203.0.113.12 \
DEPLOY_USER=ubuntu \
DEPLOY_PATH=/opt/fixflow \
APP_SERVICE=fixflow \
APP_PORT=3000 \
sh scripts/deploy-remote.sh --first-deploy --upload-env .env
```

Mise a jour applicative :

```bash
DEPLOY_HOST=203.0.113.12 \
DEPLOY_USER=ubuntu \
DEPLOY_PATH=/opt/fixflow \
APP_SERVICE=fixflow \
APP_PORT=3000 \
sh scripts/deploy-remote.sh
```

Le script :
- synchronise `app/` sur le serveur
- build en production sur le serveur
- applique `prisma migrate deploy`
- prepare le runtime Next.js standalone
- restart le service systemd
- effectue un preflight securite avant release:
  - bloque si `DEV_AUTH_BYPASS=true`
  - bloque si `FORCE_HTTPS=true` mais `NEXTAUTH_URL` n'est pas en `https://`
  - bloque si `ALLOWED_HOSTS` est renseigne mais n'inclut pas l'host de `NEXTAUTH_URL`

## Stack technique

- **Frontend** : Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Backend** : Next.js Server Actions + API Routes
- **Base de données** : PostgreSQL 15 + Prisma ORM
- **Authentification** : NextAuth.js + LDAP (internes) + comptes locaux mainteneurs (hors LDAP)
- **Dev** : Docker Compose
- **Prod** : Node.js standalone (sans Docker)

## Durcissement WAN (recommande)

Pour une exposition internet, active au minimum:

```env
DEV_AUTH_BYPASS=false
NEXT_PUBLIC_DEV_AUTH_BYPASS=false
ALLOWED_HOSTS=fixflow.example.com
FORCE_HTTPS=true
NEXTAUTH_URL=https://fixflow.example.com
NEXTAUTH_SECRET=<secret-long-et-aleatoire>
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

Le projet applique deja:
- headers HTTP de securite (CSP, HSTS en prod, no-sniff, frame deny),
- limitation de tentatives login (fenetre + plafond),
- controle strict d'acces ticket pour profils restreints,
- validation des pieces jointes (MIME, taille, nombre).

## Prochaines étapes de développement

1. Affiner les dashboards analytiques (comparatifs, baseline, drill-down)
2. Renforcer les preferences de notifications email (par type utilisateur)
3. Completer les features avancees (mentions, recherche full-text, historique detaille)
4. Finaliser les sujets qualite/deploiement (hardening, observabilite, runbook)
