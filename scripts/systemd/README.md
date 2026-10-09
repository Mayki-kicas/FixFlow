# Unités systemd — FixFlow

## Service web
`fixflow.service.template` — le serveur Next.js (installé par `scripts/deploy-remote.sh`).

## Jobs de notifications (H6)

Sans planificateur, **les emails de notification et les rappels d'échéance ne partent jamais** :
- la **file d'emails** (`process-queue`) draine les emails en attente ;
- les **rappels d'échéance** (`dispatch-due`) notifient les tickets qui arrivent à échéance.

Deux paires service+timer les déclenchent via les endpoints internes du serveur
(auth par `INTERNAL_CRON_TOKEN`, cf. `.env`) :

| Job | Fréquence par défaut | Endpoint |
|-----|----------------------|----------|
| File d'emails | toutes les **5 min** | `POST /api/notifications/email-queue/process` |
| Rappels d'échéance | chaque jour à **08h00** | `POST /api/notifications/due/dispatch` |

### Installation (prod)

Les templates utilisent les mêmes placeholders que le service web
(`__APP_SERVICE__`, `__APP_USER__`, `__DEPLOY_PATH__`, `__APP_PORT__`).
Remplace-les puis installe (exemple, à adapter / à intégrer dans `deploy-remote.sh`) :

```bash
APP_SERVICE=fixflow
APP_USER=deploy
DEPLOY_PATH=/opt/fixflow
APP_PORT=3000

for unit in notif-queue.service notif-queue.timer notif-due.service notif-due.timer; do
  sed -e "s|__APP_SERVICE__|$APP_SERVICE|g" \
      -e "s|__APP_USER__|$APP_USER|g" \
      -e "s|__DEPLOY_PATH__|$DEPLOY_PATH|g" \
      -e "s|__APP_PORT__|$APP_PORT|g" \
      "scripts/systemd/fixflow-$unit.template" \
      | sudo tee "/etc/systemd/system/$APP_SERVICE-$unit" > /dev/null
done

sudo systemctl daemon-reload
sudo systemctl enable --now "$APP_SERVICE-notif-queue.timer" "$APP_SERVICE-notif-due.timer"
```

### Vérification / exploitation

```bash
systemctl list-timers | grep fixflow      # prochaines exécutions
journalctl -u fixflow-notif-queue.service # logs de la file
systemctl start fixflow-notif-due.service # déclenchement manuel
```

### Ajuster les fréquences
- File d'emails : `OnUnitActiveSec=` dans `fixflow-notif-queue.timer`.
- Rappels : `OnCalendar=` dans `fixflow-notif-due.timer` (ex. `*-*-* 08,14:00:00` pour 2×/jour).

> Prérequis : `INTERNAL_CRON_TOKEN` défini dans `<DEPLOY_PATH>/shared/.env`, identique à celui du serveur.
> Alternative sans HTTP : `npm run notifications:process-queue` / `notifications:dispatch-due`
> (nécessite `tsx` + accès DB ; le mode endpoint ci-dessus est préféré avec le build standalone).
