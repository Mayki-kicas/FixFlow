# Maintainer PWA (MVP scaffold)

Application externe mainteneurs, séparée de l'app interne LDAP.

## Démarrage

```bash
cd maintainer-pwa
npm install
npm run dev
```

Port par défaut: `3010`.

## Scope actuel

- squelette PWA (`manifest.webmanifest`)
- pages MVP: login, liste interventions, détail + feedback
- aucun backend branché pour le moment

## Prochaines étapes

1. API auth locale mainteneur
2. API fetch dispatches affectés
3. API envoi feedback + photos
4. sync avec endpoint interne `/api/integration/v1/feedback`
