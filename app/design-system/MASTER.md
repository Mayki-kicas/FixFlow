# Design System — FixFlow (MASTER)

> Source de vérité UI. Toute nouvelle page/composant s'y conforme. Les dérogations par page vont dans `design-system/pages/<page>.md` et **surchargent** ce fichier.
>
> Établi le 2026-07-28 via UI/UX Pro Max, **ancré sur les tokens déjà en production** (`app/app/globals.css` + `tailwind.config.ts`) — l'identité crème/corail existante est conservée, pas remplacée.

## 1. Direction

- **Style :** *Data-Dense Dashboard (BI / Analytics)* — light + dark complet, WCAG AA, densité maximale mais lisible. Padding compact, tables triables, en-têtes collants, cartes KPI.
- **Personnalité :** outil interne de maintenance, utilisé au quotidien par des dispatchers/techniciens. Priorité à la **vitesse de scan** et à la **clarté opérationnelle**, pas à la décoration.
- **Fréquence d'usage élevée → motion courte et discrète** (`frequency-of-use`).

## 1bis. Direction « Atelier » (parti pris actif depuis 2026-10)

Univers d'**établi de technicien / fiche de maintenance**. Les neutres sont **chauds** (papier
en light, graphite en dark — jamais de noir pur ni de slate froid). La **donnée technique** (n° OT,
refCodes, SLA, compteurs, montants) est en **monospace** (IBM Plex Mono) : c'est la signature.
Les **hairlines** et la **signalétique couleur** portent la hiérarchie, pas les ombres (quasi plates).
Coins nets (rayons réduits). Titres en **Space Grotesk**.

## 2. Tokens couleur (CSS vars — ne pas hardcoder de hex dans les composants)

| Rôle | Light | Dark | Var |
|------|-------|------|-----|
| Background | `#f3efe6` (papier chaud, dégradé) | `#12161c` (graphite) | `--background` |
| Foreground | `#1b1714` (espresso) | `#ece7dd` (blanc cassé chaud) | `--foreground` |
| Surface | `#fbf8f2` | `#1a1f27` | `--surface` |
| Surface alt | `#eae3d5` (kraft) | `#232a34` | `--surface-alt` |
| Border | `rgba(27,23,20,.14)` | `rgba(190,178,160,.18)` | `--border-default` |
| Border strong | `rgba(27,23,20,.28)` | `rgba(190,178,160,.34)` | `--border-strong` |
| Muted (texte 2ndaire) | `#6e655a` (gris chaud) | `#a49b8d` | `--muted` |
| Primary (CTA sombre) | `#1b1714` | `#ece7dd` | `--primary` |
| Accent (corail) | `#e8513b` | `#ff6f57` | `--accent` |
| Accent 2 (bleu acier) | `#2f6f9e` | `#6fa7d8` | `--accent-2` |
| Signal — en cours (ambre) | `#c97e1a` | `#e0982e` | `--signal-progress` |
| Signal — résolu (vert sapin) | `#2f7d5b` | `#46a67e` | `--signal-done` |

**Classes Tailwind mappées :** `bg-surface`, `bg-surface-alt`, `text-foreground`, `text-muted`, `border-border-default`, `text-accent`, `text-accent-2`, `bg-primary`, `text-signal-progress`, `text-signal-done`. Le dark mode bascule automatiquement via les vars → **toujours** préférer ces classes aux `slate-*`/`indigo-*` bruts.

### Couleurs sémantiques (état/urgence) — obligatoire d'ajouter icône/texte, jamais la couleur seule (`color-not-only`)

| Urgence | Couleur | | Statut (défaut) | Couleur |
|---------|---------|-|-----------------|---------|
| Basse | `#94a3b8` | | Nouvelle demande | `#2f6f9e` (acier) |
| Moyenne | `#2f6f9e` | | En cours | `#c97e1a` (ambre) |
| Haute | `#c97e1a` | | En attente pièce | `#a78bfa` |
| Critique | `#e8513b` (corail) | | Résolu | `#2f7d5b` (sapin) |

Le badge d'état est **mono majuscule**, texte coloré + fond `couleur + 12 %`, jamais de fond plein. Statuts personnalisés : couleur portée par `TicketStatus.color`.

## 3. Typographie

- **Polices :** **Space Grotesk** titres (`--font-display`, h1–h4) · **Inter** corps (`--font-sans`) · **IBM Plex Mono** donnée technique (`--font-mono` : n° OT, refCodes, SLA, compteurs, montants, badges). Chargées via Google Fonts (`@import`, `display=swap`). Titres 500–700, labels 500, corps 400.
- **Échelle :** 11 / 12 / 13 / 14 / 16 / 20 / 30 px. Corps ≥ 14px en interface dense, ≥ 16px sur mobile (`readable-font-size`).
- **Chiffres tabulaires** (`tabular-nums`) obligatoires pour n° de ticket, compteurs, dates, montants — évite le décalage (`number-tabular`).
- **Grands nombres formatés** : séparateurs de milliers / abréviations (`1 234`, `1,2 k`) — pas de `1234567` brut.
- Line-height corps 1.5 ; troncature à l'ellipsis + `title`/tooltip pour le texte complet.

## 4. Espacement & layout

- **Rythme 4/8** partout. Variables de densité : `--card-padding: 12px`, `--table-row-height: 36px`, `--header-height: 56px`, `--grid-gap: 8px`.
- Container : `max-w-7xl` (ou `max-w-full` pour le board kanban).
- **Tables** : wrapper `overflow-x-auto`, en-têtes `sticky`, tri via `aria-sort`. Sur mobile → scroll horizontal ou bascule en cartes (`data-table`, `Table Handling`).
- Rayons : cartes `rounded-xl` (12px) / colonnes `rounded-2xl` (16px) / chips `rounded` (6px) / boutons `rounded-lg`.
- Ombres : échelle `soft-md / soft-lg / soft-xl` uniquement (pas de valeurs ad hoc, `elevation-consistent`).

## 5. Composants (conventions actées)

- **Carte ticket** (réf. `TicketKanban`) : ligne 1 = point d'urgence + `#numéro` (tabular) + drapeau HAUTE/CRITIQUE ; titre 2 lignes ; chip réf. équipement + site ; footer = avatar à initiales (couleur dérivée du nom) + âge + compteurs chat/PJ.
- **Colonne kanban** : fond `surface` translucide, en-tête = pastille statut + nom + pastille compteur. Survol de dépôt en **accent corail**.
- **Boutons** : 1 seul CTA primaire par écran (`primary-action`) = fond `primary`. Secondaires subordonnés. États hover/pressed/disabled distincts (`state-clarity`), disabled à opacité 0.38–0.5 + `disabled`.
- **Chips/badges** : bord `border-default`, fond `surface-alt`, texte `muted`.
- **Icônes** : SVG uniquement (stroke ~1.7), jamais d'emoji (`no-emoji-icons`). Un seul jeu, filled OU outline par niveau.
- **Avatars** : initiales sur pastille, couleur dérivée déterministe du displayName.

## 6. Motion (règles fréquence-d'usage)

- Durées **150–300 ms**, ease-out à l'entrée, ease-in à la sortie (sortie ~60–70 % de l'entrée). Rien > 400 ms.
- **`transform`/`opacity` uniquement** — jamais width/height/top/left (`layout-shift-avoid`).
- Entrées de liste : **stagger 30–50 ms/item**, fade + `translateY(10px)`.
- Feedback presse : `scale(0.97)`. Transitions d'état animées, pas de snap.
- **`prefers-reduced-motion` respecté systématiquement** (High severity). Pas d'animation infinie décorative (spinners de chargement uniquement).

## 7. Accessibilité (CRITIQUE — checklist de sortie)

- Contraste texte ≥ 4.5:1 (corps), ≥ 3:1 (large/glyphes) **en light ET dark** (tester séparément).
- Focus visible sur tout élément interactif (2–4px). Ordre de tab = ordre visuel.
- `aria-label` sur boutons icône seule ; labels de champs visibles (pas placeholder-only).
- Cible tactile ≥ 44×44 ; `cursor-pointer` sur le cliquable.
- Info jamais portée par la couleur seule → toujours icône/texte associé.
- Toasts `aria-live="polite"`, erreurs `role="alert"`, focus auto sur 1er champ invalide.

## 8. Anti-patterns à éviter

- `slate-*`/`indigo-*` bruts au lieu des tokens → casse le dark mode et la cohérence.
- Fond de badge plein saturé (contraste), hex hardcodés dans les composants.
- Tables larges qui débordent le viewport mobile.
- Animer width/height ; motion décorative ; ignorer reduced-motion.
- Plus d'un CTA primaire par écran ; icônes emoji.

---

### Pages à décliner (runs `/prototype` suivants → `design-system/pages/*.md`)
Détail ticket · Backoffice (équipements, équipes, groupes, users) · Analytique (charts) · Formulaires (nouveau ticket, incident report) · Header/navigation.
