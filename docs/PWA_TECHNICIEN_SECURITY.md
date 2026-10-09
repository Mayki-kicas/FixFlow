# Sécurité — App technicien en PWA (mainteneur externe)

Spec de sécurité pour transformer **l'app mainteneur externe** (reliée au
logiciel interne par HMAC) en **PWA installable**.

**Choix cadrés :**
- Périmètre : l'**app mainteneur EXTERNE** (codebase et hébergement séparés du logiciel interne).
- Auth technicien : **compte local (email + mot de passe) DURCI** (pas de SSO externe en V1).
- Hors-ligne : **installable, en ligne uniquement** (aucune donnée métier en cache).

> Principe directeur : la PWA est un **client non fiable** sur un appareil non maîtrisé
> (téléphone du technicien). Toute autorisation se fait **côté serveur**, à chaque requête.

---

## 1. Authentification technicien (durcie)

- **Mots de passe** : hash **argon2id** (ou bcrypt coût ≥ 12). Politique minimale (longueur ≥ 10,
  blocage des mots de passe courants). Jamais de mot de passe en clair, en log, ni en cache.
- **Sessions courtes + refresh rotatif** :
  - *access token* court (~15 min), *refresh token* longue durée **à rotation** (un refresh
    utilisé est invalidé et remplacé ; réutilisation détectée ⇒ révocation de la famille).
  - Tokens en **cookies `HttpOnly` + `Secure` + `SameSite=Strict`** (jamais en `localStorage`/JS).
  - Révocation serveur (déconnexion, changement de mot de passe ⇒ invalide toutes les sessions).
- **Anti-brute-force PERSISTANT** : compteur de tentatives en base/Redis (⚠️ pas en mémoire
  process — voir « Dette côté logiciel interne » plus bas), verrouillage temporisé + rate-limit
  par IP et par compte.
- **2FA optionnel** (TOTP) recommandé pour les prestataires sensibles.
- **Provisioning** : comptes technicien créés/désactivés côté back (jamais d'auto-inscription
  ouverte). Désactivation immédiate à la fin d'un contrat.

## 2. PWA « online-only » (service worker & manifest)

- **Service Worker = app-shell UNIQUEMENT** : cache le HTML/CSS/JS **statiques**. **Aucune
  réponse d'API ni donnée métier** (tickets, photos, coordonnées) mise en cache.
  - Stratégie : `network-first`/`network-only` pour tout ce qui est `/api/*` ; `cache-first`
    seulement pour les assets statiques versionnés.
  - Pas de `IndexedDB`/`localStorage` contenant des données métier.
- **Manifest** : `scope` et `start_url` restreints à l'app, `display: standalone`. Icônes maîtrisées.
- **Déconnexion** : purge le cache applicatif et supprime les cookies de session.
- **HTTPS strict + HSTS** (`max-age` long, `includeSubDomains`). Pas de contenu mixte.

## 3. CSP & en-têtes (compatibles PWA)

- **CSP stricte**, sans `unsafe-inline` : `script-src 'self' 'nonce-…' 'strict-dynamic'`,
  `worker-src 'self'`, `connect-src 'self' https://<api-interne>` (liste blanche des origines
  API), `img-src 'self' data: blob:` (photos), `object-src 'none'`, `base-uri 'none'`,
  `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` minimal (caméra autorisée si capture photo, géoloc désactivée sauf besoin).
- Cookies : `Secure`, `HttpOnly`, `SameSite=Strict`.

## 4. Portée d'API technicien (least privilege)

- **Endpoints dédiés** au technicien, **séparés** des routes internes (managers/basic).
- Chaque endpoint filtre **côté serveur** sur le technicien authentifié : il ne voit/agit que
  sur **ses interventions assignées** (jamais toute la base). Pas d'IDOR : vérifier l' owner
  de chaque ressource (dispatch/ticket/photo) à chaque requête.
- **Rate-limit par utilisateur** sur les endpoints d'action (upload, feedback, dépôt de devis).
- Réponses d'erreur génériques (pas de fuite Prisma/DB).

## 5. Upload de photos / devis (terrain)

- **Validation serveur** : taille max, **magic bytes** (ne pas se fier à l'extension ni au MIME
  déclaré), liste blanche `image/jpeg|png|webp` (+ `application/pdf` pour les devis). **SVG interdit**
  (vecteur XSS).
- **Strip EXIF/GPS** des photos (vie privée + évite de divulguer la localisation du technicien).
- **Antivirus** (ClamAV local) sur tout fichier déposé.
- Stockage **privé** hors base, accès via endpoint backend authentifié + `Content-Disposition`
  + `nosniff` ; **Content-Type figé** (ne pas renvoyer le MIME fourni par le client).

## 6. Intégration inter-services (déjà en place côté logiciel interne)

- **Token Bearer partagé** (`INTEGRATION_SHARED_TOKEN`) + **signature HMAC-SHA256** sur
  `${x-request-timestamp}.${corps_brut}` (secret **distinct** `INTEGRATION_SIGNING_SECRET`).
- **Fail-closed en production** : la signature est **obligatoire** (endpoints `/integration/v1/*`
  rejettent si le secret de signature n'est pas configuré en prod).
- Fraîcheur timestamp ±60 s, **idempotence** (dispatch/feedback/quote), comparaison en temps constant.
- Détail du contrat : voir la doc interne de l'app mainteneur.

## 7. Transport & infra

- Reverse proxy / **WAF** devant la PWA et l'API technicien : TLS strict, **rate-limit**,
  allowlist IP si le parc est maîtrisé, taille de corps limitée.
- Journaux d'audit immuables : connexion, upload accepté/rejeté, dépôt de devis, feedback.
- Rotation documentée des secrets (token + secret de signature).

## 8. Dette de sécurité à traiter côté logiciel interne (avant prod à l'échelle)

- ~~Throttle de login en mémoire~~ — ✅ **FAIT** : anti-brute-force **persistant** en base
  (`lib/login-throttle.ts` + table `LoginAttempt`), fiable au redémarrage et multi-instance,
  best-effort (fail-open si incident du store). Logique de fenêtre testée (`isWithinRateLimit`).
- **NextAuth v4** : conserver (v5 en beta, non retenu). Vérifier la config de session
  (durée, cookies sécurisés) pour l'usage technicien.

## 9. Checklist go-live sécurité (PWA technicien)

- [ ] HTTPS strict + HSTS actifs, aucun contenu mixte
- [ ] CSP stricte sans `unsafe-inline` validée (script/worker/connect/img)
- [ ] Service worker ne cache **aucune** donnée métier ; purge au logout
- [ ] Cookies de session `HttpOnly`+`Secure`+`SameSite=Strict` ; refresh rotatif + révocation
- [ ] Anti-brute-force **persistant** + rate-limit (IP + compte)
- [ ] 2FA disponible (au moins optionnel)
- [ ] API technicien : chaque endpoint scoppé aux interventions du technicien (tests IDOR)
- [ ] Upload : magic bytes + antivirus + strip EXIF + Content-Type figé + SVG interdit
- [ ] Intégration : Bearer + HMAC **fail-closed en prod** + idempotence testés
- [ ] `INTEGRATION_SIGNING_SECRET` configuré des deux côtés (distinct du token)
- [ ] Provisioning/désactivation des comptes technicien opérationnel
- [ ] Journaux d'audit exportables ; procédure d'incident (révocation token + blocage endpoint)

---

Schéma d'architecture cible : voir la doc interne de process.
