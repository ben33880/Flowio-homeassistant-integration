# Cartes Lovelace Flow.io

Le code source des cartes est dans le dossier [`cards/`](../cards/) de ce dépôt depuis le 14/11/2026. C'est une copie du commit `9977463e00e550703907d3ce7c8a380fcea31ad8` du dépôt `christophebelmont/flowio-home-assistant-cards` (version 0.3.5, licence MIT). Ce dépôt d'origine n'appartient pas au propriétaire de l'intégration : il n'est jamais modifié. Seule la copie `cards/` se modifie.

Les fichiers `.md` des cartes restent dans `cards/` : leurs liens relatifs (images, notes de release) et le script `cards/scripts/prepare-release.mjs` en dépendent. Cette page sert d'index pour ne pas les oublier.

## Comment les cartes arrivent dans Home Assistant

- Au tag `vX.Y.Z`, le workflow `.github/workflows/release.yml` construit le bundle depuis `cards/` (`npm ci`, `npm test`, `npm run release:prepare`), le copie dans `custom_components/flowio/frontend/` avec `THIRD_PARTY_NOTICES.txt`, puis crée `flowio.zip` et un brouillon de release.
- L'intégration enregistre ce fichier JavaScript automatiquement. Il ne faut donc pas ajouter en plus les cartes comme ressource Dashboard ou comme dépôt HACS séparé, sinon elles seraient chargées deux fois.
- Le bundle n'est pas dans le dépôt : `cards/dist/` est généré à la release.

## Documents des cartes

| Fichier | Contenu |
|---|---|
| [cards/README.md](../cards/README.md) | Catalogue des cartes (`custom:flowio-*`), exemples YAML, commandes et limites. |
| [cards/CHANGELOG.md](../cards/CHANGELOG.md) | Historique des versions des cartes. |
| [cards/docs/CHEMISTRY.md](../cards/docs/CHEMISTRY.md) | Valeurs de référence du pH et cible ORP, reprises par l'intégration pour ses seuils par défaut. |
| [cards/docs/HACS.md](../cards/docs/HACS.md) | Installation HACS et manuelle des cartes seules (voir la remarque plus bas). |
| [cards/docs/HACS-TROUBLESHOOTING.md](../cards/docs/HACS-TROUBLESHOOTING.md) | Dépannage HACS des cartes. |
| [cards/docs/RELEASE.md](../cards/docs/RELEASE.md) | Procédure de release des cartes. |
| [cards/docs/releases/](../cards/docs/releases/) | Notes de chaque version des cartes. `v<version>.md` doit exister pour la version de `cards/package.json`, sinon `prepare-release.mjs` échoue. |
| [cards/docs/DESIGN.md](../cards/docs/DESIGN.md) | Conception visuelle. Contenu non relu par l'assistant. |
| [cards/docs/DEVELOPMENT.md](../cards/docs/DEVELOPMENT.md) | Développement des cartes. Contenu non relu par l'assistant. |
| [cards/docs/DISPLAY.md](../cards/docs/DISPLAY.md) | Affichage. Contenu non relu par l'assistant. |
| [cards/docs/INJECTIONS.md](../cards/docs/INJECTIONS.md) | Injections. Contenu non relu par l'assistant. |
| [cards/docs/MAINTENANCE.md](../cards/docs/MAINTENANCE.md) | Maintenance. Contenu non relu par l'assistant. |
| [cards/docs/TIMING.md](../cards/docs/TIMING.md) | Horaires et durees. Contenu non relu par l'assistant. |
| [cards/examples/](../cards/examples/) | Exemples de tableaux de bord (`dashboard-chlorine.yaml`, `pool.yaml`). |

Les captures d'écran des cartes sont dans `cards/docs/*.png`.

## Points à corriger dans la copie

Ces écarts viennent du dépôt d'origine et n'ont pas encore été corrigés dans `cards/` :

- Le README des cartes annonce la version 0.3.2 construite et la 0.3.3 en préparation, alors que `cards/package.json` indique 0.3.5 et que `cards/docs/releases/` va jusqu'à `v0.3.5.md`.
- Sa section Installation décrit un ajout via HACS du dépôt `ben33880/flowio-home-assistant-cards` (catégorie Dashboard). Avec les cartes intégrées, cette installation séparée n'est plus nécessaire et fait doublon.
- `cards/hacs.json` et `cards/.github/workflows/` ne servent à rien dans un sous-dossier : HACS et GitHub Actions ne lisent que la racine du dépôt.
- Dans le README des cartes, la jauge de la carte piscine utilise une échelle par défaut (pH 6 à 8,4 ; ORP 400 à 1 000), réglable avec `visuals`. Les cartes « sondes » et « sonde » reprennent les bornes `min` et `max` de l'entité, c'est-à-dire la plage d'affichage réglée dans le firmware.
