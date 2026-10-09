# Authentification & gestion des rôles — guide

Ce guide couvre tout le fonctionnement de l'auth de FixFlow : premier démarrage,
choix du SSO (LDAP ou Microsoft Entra), gestion des utilisateurs et des rôles,
et dépannage.

---

## 1. Le modèle en bref

- **Une seule méthode SSO active à la fois** : LDAP **ou** Microsoft Entra, choisie
  dans le backoffice (`/backoffice/auth`).
- **Un compte admin local** (email + mot de passe) reste **toujours** disponible,
  quelle que soit la méthode SSO — c'est le filet de sécurité (« break-glass »).
- **Les rôles ne viennent plus des groupes AD.** Ils sont attribués **dans l'interface**
  (`/backoffice/users`). Chaque compte a un **rôle** et un **état d'accès** (`actif` / `en attente`).
- **Un nouvel utilisateur SSO arrive « en attente »** : il peut s'authentifier mais n'a
  aucun accès tant qu'un administrateur ne l'a pas activé et ne lui a pas donné un rôle.
- **Les secrets** (mot de passe de bind LDAP, secret client Entra) vivent dans `.env`.
  Le reste de la configuration se fait dans l'UI.

### Les 4 rôles

| Rôle | Peut faire |
|------|-----------|
| **ADMIN** | Tout : backoffice complet, statuts, rôles/accès, configuration auth, exports. |
| **MANAGER** | Backoffice (sites, équipements, groupes), validation des demandes, exports, voit tout. |
| **MAINTAINER** | Technicien : traite les tickets **auxquels il est abonné** (chat, PJ). Ne change pas les statuts. |
| **BASIC** | Déclare des incidents ; ne voit que ses abonnements / équipes accessibles via groupe. |

---

## 2. Premier démarrage (amorçage)

Comme les rôles ne viennent plus de l'AD, il faut un premier administrateur. Deux
mécanismes, utilisables ensemble :

### a) Admin local seedé (recommandé pour démarrer)

Le `seed` crée un compte **local** administrateur :

- **Email** : `admin@example.com`
- **Mot de passe** : valeur de `BOOTSTRAP_ADMIN_PASSWORD` dans `.env` (défaut `ChangeMe-admin-123`)

```bash
# .env
BOOTSTRAP_ADMIN_PASSWORD=un-mot-de-passe-fort
```

Connecte-toi avec cet email + mot de passe sur `/auth/signin`, puis **change le mot de passe**
(ou crée ton propre compte local) depuis `/backoffice/users`.

### b) Emails admin d'amorçage (pour le SSO)

Tout email listé ici devient **ADMIN actif automatiquement** à sa première connexion SSO :

```bash
# .env
BOOTSTRAP_ADMIN_EMAILS=toi@ta-boite.com,collegue@ta-boite.com
```

Pratique pour te promouvoir via Microsoft/LDAP sans toucher à la base.

---

## 3. Choisir et configurer le SSO

Va dans **Backoffice → Authentification** (`/backoffice/auth`), choisis la méthode, remplis
les champs, enregistre. Un indicateur te dit si le **secret** attendu est présent dans `.env`.

### Option A — LDAP / Active Directory

Dans l'UI :
- **URL** : `ldap://ton-dc.exemple.local:389` (ou `ldaps://…:636`)
- **Base de recherche (DN)** : `DC=exemple,DC=local`
- **Bind DN** : `CN=svc-fixflow,OU=Services,DC=exemple,DC=local`

Dans `.env` (secret) :
```bash
LDAP_BIND_PASSWORD=le-mot-de-passe-du-compte-de-service
# TLS : mettre false uniquement en dev avec certificat auto-signé
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

> Les variables `LDAP_GROUP_*` / `LDAP_ROLE_OU` ne servent plus qu'à **suggérer** un rôle
> lors de l'import manuel LDAP — elles n'attribuent plus l'accès.

### Option B — Microsoft Entra ID (Azure AD)

**1) Déclarer l'application dans Azure** (portail Entra → *App registrations* → *New registration*) :
- **Redirect URI** (type *Web*) : `<NEXTAUTH_URL>/api/auth/callback/azure-ad`
  - ex. en local : `http://localhost:3000/api/auth/callback/azure-ad`
  - en prod : `https://fixflow.ta-boite.com/api/auth/callback/azure-ad`
- Relève le **Application (client) ID** et le **Directory (tenant) ID**.
- *Certificates & secrets* → **New client secret** → copie la **valeur**.
- *API permissions* : `openid`, `profile`, `email` (Microsoft Graph, delegated) suffisent.

**2) Côté FixFlow** :
- Backoffice → Authentification → **Microsoft (Entra ID)** :
  - **Tenant ID** = Directory (tenant) ID
  - **Client ID** = Application (client) ID
- `.env` (secret) :
  ```bash
  ENTRA_CLIENT_SECRET=la-valeur-du-secret-client
  ```
- Enregistre. Un bouton **« Se connecter avec Microsoft »** apparaît sur la page de connexion.

> Après toute modification de `.env`, redémarre l'application pour qu'elle relise les secrets.

---

## 4. Gérer les utilisateurs & les rôles

**Backoffice → Utilisateurs & rôles** (`/backoffice/users`, ADMIN uniquement).

- **Changer un rôle** : menu déroulant sur la ligne de l'utilisateur.
- **Activer / Désactiver l'accès** : bouton `Activer` / `Désactiver`.
  - *Désactiver* révoque l'accès **immédiatement**, même si la personne a une session ouverte.
- **Créer un compte local** : bouton *+ Nouveau compte local* (email, nom, rôle, mot de passe ≥ 10 car.).
  Utile pour un mainteneur externe ou un admin de secours, sans dépendre du SSO.
- **Réinitialiser un mot de passe** : bouton *Mot de passe* (comptes locaux uniquement).
- **Import LDAP** (si LDAP actif) : section en bas de page pour intégrer des comptes de l'annuaire.
  Les comptes importés sont **activés** d'emblée ; ajuste leur rôle au-dessus.

**Garde-fous** : tu ne peux pas modifier/désactiver **ton propre** compte, ni retirer le
**dernier administrateur actif** (anti-verrouillage).

---

## 5. Le flux « accès en attente »

1. Une personne se connecte via le SSO pour la première fois.
2. Son compte est créé **en attente** (rôle BASIC, inactif) → elle est redirigée vers `/auth/pending`.
3. Un ADMIN la voit dans `/backoffice/users` avec le badge **En attente**, lui attribue un rôle et l'**active**.
4. À sa prochaine connexion, elle entre normalement.

> Exception : si son email est dans `BOOTSTRAP_ADMIN_EMAILS`, elle devient ADMIN actif directement.

---

## 6. Sécurité & dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| « Compte en attente de validation » | Compte SSO pas encore activé | Un ADMIN l'active dans `/backoffice/users`. |
| Bouton Microsoft absent | Entra pas actif, ou Tenant/Client ID / secret manquant | Vérifie `/backoffice/auth` + `ENTRA_CLIENT_SECRET` dans `.env`, redémarre. |
| Erreur de redirection Azure | Redirect URI non déclarée | Ajoute `<NEXTAUTH_URL>/api/auth/callback/azure-ad` dans l'app Azure. |
| LDAP : connexion refusée | URL / bind DN / mot de passe | Vérifie les champs UI + `LDAP_BIND_PASSWORD`. |
| Plus aucun admin ne peut entrer | Verrouillage | Connecte-toi avec l'**admin local** (`admin@example.com` + `BOOTSTRAP_ADMIN_PASSWORD`). |

**Secrets** : ne mets jamais `LDAP_BIND_PASSWORD` ni `ENTRA_CLIENT_SECRET` dans l'UI ou le repo — uniquement `.env` (jamais committé).

**Mode dev** : `DEV_AUTH_BYPASS=true` (NON-production) active des boutons de connexion rapide
par rôle sur la page de login. À laisser à `false` partout ailleurs.
