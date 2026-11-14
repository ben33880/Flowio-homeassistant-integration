# Cartes Lovelace Flow.io

Le code source des cartes est dans le dossier [`cards/`](../cards/) de ce dépôt. C'est une copie, faite le 14/11/2026, du dépôt `christophebelmont/flowio-home-assistant-cards` au commit `9977463e00e550703907d3ce7c8a380fcea31ad8` (licence MIT). Ce dépôt d'origine n'appartient pas au propriétaire de l'intégration : il n'est jamais modifié. Seule la copie `cards/` se modifie.

Les cartes n'ont plus de version propre. `cards/package.json` est figé à `1.0.0` et ce numéro n'est utilisé nulle part : le bundle est reconstruit à chaque release de l'intégration et porte la version de l'intégration.

Les fichiers `.md` des cartes restent dans `cards/` : le README affiche les captures de `cards/docs/*.png` par des liens relatifs. Cette page sert d'index.

## Comment les cartes arrivent dans Home Assistant

Au tag `vX.Y.Z`, le workflow `.github/workflows/release.yml` :

1. lance `npm ci`, `npm test` et `npm run build` dans `cards/` ;
2. rassemble les licences des dépendances de production dans `THIRD_PARTY_NOTICES.txt` et les ajoute au pied du bundle (erreur si un paquet n'a aucune licence) ;
3. copie le bundle et ce fichier dans `custom_components/flowio/frontend/` ;
4. crée `flowio.zip` et un brouillon de release.

L'intégration enregistre ce fichier JavaScript automatiquement. Il ne faut donc pas ajouter en plus les cartes comme ressource Dashboard ou comme dépôt HACS séparé. Le bundle n'est pas dans le dépôt : `cards/dist/` est généré à la release.

Les tests des cartes (`npm test`) ne tournent qu'à la release : il n'y a plus de workflow de tests au push.

## Documents des cartes

| Fichier | Contenu |
|---|---|
| [cards/README.md](../cards/README.md) | Catalogue des cartes (`custom:flowio-*`), exemples YAML, commandes et limites, développement. |
| [cards/docs/CHEMISTRY.md](../cards/docs/CHEMISTRY.md) | Valeurs de référence du pH et cible ORP, reprises par l'intégration pour ses seuils par défaut. |
| [cards/docs/DESIGN.md](../cards/docs/DESIGN.md) | Conception visuelle. Contenu non relu par l'assistant. |
| [cards/docs/DEVELOPMENT.md](../cards/docs/DEVELOPMENT.md) | Développement des cartes. Contenu non relu par l'assistant ; il peut encore parler de versions ou de release séparées. |
| [cards/docs/DISPLAY.md](../cards/docs/DISPLAY.md) | Affichage. Contenu non relu par l'assistant. |
| [cards/docs/INJECTIONS.md](../cards/docs/INJECTIONS.md) | Injections. Contenu non relu par l'assistant. |
| [cards/docs/MAINTENANCE.md](../cards/docs/MAINTENANCE.md) | Maintenance. Contenu non relu par l'assistant. |
| [cards/docs/TIMING.md](../cards/docs/TIMING.md) | Horaires et durees. Contenu non relu par l'assistant. |
| [cards/examples/](../cards/examples/) | Exemples de tableaux de bord (`dashboard-chlorine.yaml`, `pool.yaml`). |

Les captures d'écran des cartes sont dans `cards/docs/*.png`.

## Échelles des jauges

- Les cartes « sondes » et « sonde » reprennent les bornes `min` et `max` de l'entité, c'est-à-dire la plage d'affichage réglée dans le firmware.
- La carte piscine n'utilise aucune échelle par défaut : les jauges pH, ORP et pression utilisent les bornes du firmware ; sans bornes, la jauge reste vide.
