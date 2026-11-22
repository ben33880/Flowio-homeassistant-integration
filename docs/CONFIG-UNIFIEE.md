# État du chantier — configuration unifiée

## Objectif

Supprimer les préfixes d'entités configurés localement dans les cartes Lovelace Flow.io. Le préfixe vient désormais de la configuration de l'intégration, via le contrôleur commun `InstallationController`.

Branche de travail `config-unifiee`, fusionnée dans `main`.

## Règle commune

- Le préfixe est fourni par `flowio/config`.
- Aucun préfixe n'est deviné ni stocké dans la configuration de la carte.
- Si plusieurs installations sont chargées, la carte affiche une erreur explicite.
- Un ancien champ `entity_prefix` est rejeté avec un message demandant de le retirer.
- Les entités déjà sélectionnées, les couleurs, les ombrages, les durées et les autres réglages doivent être conservés.

## Migration déjà faite

La migration a déjà porté sur :

- Le préfixe des entités, fourni par l'intégration.
- Le topic MQTT, fourni par l'intégration.
- Les seuils, fournis par l'intégration.

Les 12 cartes listées dans ce document ont été migrées. Le code a été relu, mais les correctifs listés plus bas n'ont pas encore été poussés.

## Bugs confirmés

| # | Fichier | Problème | Correctif |
|---|---|---|---|
| 1 | `tile-grid.ts` (Équipements/Modes) | La boucle d'attente est réelle. `syncTiles()` appelle `requestUpdate()` à chaque passage tant que l'installation n'est pas chargée, et `updated()` rappelle `syncTiles()`. La boucle peut bloquer le navigateur avant l'arrivée de la réponse WebSocket. Je ne l'ai pas reproduit. | Ne pas relancer `requestUpdate()` quand rien n'a changé. |
| 2 | `flowio-actuator-card.ts` | Le préfixe de nom (vide par défaut) est passé à `actuatorRole()` et `actuatorResetEntity()`, qui attendent le préfixe d'entité. Le rôle n'est pas reconnu et le bouton de remise à zéro par équipement disparaît. | Passer `installation.prefix` à ces deux fonctions. |
| 3 | `flowio-override-card.ts` | `connectedCallback()` appelle `refresh()` avant que l'installation soit chargée. `target` reste vide et tous les boutons restent désactivés. | Rappeler `refresh()` quand l'installation arrive, par exemple dans `updated()`. |
| 4 | `flowio-alarm-detail-card.ts` (éditeur) | Il appelle `detectedAlarmIds(hass, '')` avec un préfixe vide, donc la liste d'alarmes est vide. | Utiliser `InstallationController` dans l'éditeur, comme l'éditeur du graphique. |
| 5 | `flowio-alarms-card.ts`, `flowio-actuator-card.ts`, `tile-grid.ts` | La détection automatique du texte à retirer des noms a disparu. L'éditeur dit pourtant « vide = automatique ». | Rétablir `config.name_prefix || commonEntityPrefix(...)`. |
| 6 | `model.ts` / `flowio-pool-card.ts` | Les entités de cuve utilisent `tank_slots` de la config de la carte. Les diagnostics utilisent `runtime_slots`. Les slots de l'intégration ne sont pas pris en compte pour les cuves. | Prendre `ph_slot`, `disinfection_slot` et `filtration_slot` dans l'installation. Rejeter `tank_slots` et `runtime_slots` dans `normalizeConfig`, comme pour `entity_prefix`. |

## Points secondaires

- **Carte Filtration.** Elle duplique `InstallationController` et ne journalise pas l'erreur. Sans `callWS`, elle reste bloquée sur « Chargement… ».
- **Carte État système.** L'éditeur a `options: []` pour la sélection des informations, donc rien n'est sélectionnable.
- **Seuils.** Si l'entité d'un seuil est absente ou `unavailable`, les zones colorées disparaissent sans message. Les cuves n'ont que deux états côté carte, contre trois côté Python.
- **Carte piscine.** Elle recalcule l'injection estimée au lieu de lire `ph_injected` et `dis_injected` fournis par l'intégration. Ce n'est pas un bug, mais un point à revoir plus tard.
- **Intégration.** Changer le préfixe dans les options recrée les entités et perd les seuils restaurés.

## Ce qui reste à faire

- Corriger les bugs 2, 3, 4 et 5 dans un premier push.
- Corriger le bug 1 dans un second push, après reproduction.
- Corriger le bug 6 dans un troisième push, après lecture des fichiers restants.
- Vérifier la compilation et les tests après les correctifs.
- Vérifier les cartes dans Home Assistant, notamment avec une installation réelle.
- Vérifier le comportement avec plusieurs installations Flow.io.
- Vérifier que les anciennes configurations avec `entity_prefix` affichent bien l'erreur attendue.
- Vérifier que les entités sélectionnées et les personnalisations restent conservées après migration.
- Mettre à jour le README, le CHANGELOG et les notes de projet.
- Ne créer la release qu'après des tests concluants.

## Tests à faire

1. Mettre à jour l'intégration et les cartes depuis `config-unifiee`.
2. Redémarrer Home Assistant.
3. Attendre au moins trois minutes.
4. Ouvrir chaque carte migrée et vérifier qu'elle affiche les bonnes entités.
5. Vérifier que les actions fonctionnent : filtration, traitement, équipements, alarmes, forçage.
6. Vérifier que les graphiques affichent les séries et les ombrages attendus.
7. Vérifier les notifications Android et iPhone.
8. Vérifier le suivi en direct de la filtration : apparition après 60 secondes, barre actualisée toutes les 15 minutes, disparition à l'arrêt.
9. Vérifier que l'éclairage notifie immédiatement au démarrage et à l'arrêt, avec une durée réelle.

## Rappel

La configuration unifiée est fusionnée dans `main` et publiée (voir `CHANGELOG.md`). Le propriétaire a testé sur ses appareils le 22/11/2026 : tout fonctionne.
