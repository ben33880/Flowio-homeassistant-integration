# État du chantier — configuration unifiée

## Objectif

Supprimer progressivement les préfixes d’entités configurés localement dans les cartes Lovelace Flow.io. Le préfixe doit désormais venir de la configuration de l’intégration, via le contrôleur commun `InstallationController`.

Branche de travail : `config-unifiee`. La branche `main` reste inchangée.

## Règle commune

- Le préfixe est fourni par `flowio/config`.
- Aucun préfixe n’est deviné ni stocké dans la configuration de la carte.
- Si plusieurs installations sont chargées, la carte affiche une erreur explicite.
- Un ancien champ `entity_prefix` est rejeté avec un message demandant de le retirer.
- Les entités déjà sélectionnées, les couleurs, les ombrages, les durées et les autres réglages doivent être conservés.

## Cartes migrées

| Carte | État | Commit |
|---|---|---|
| Filtration | Migrée | — |
| Traitement | Migrée | — |
| Équipements / Modes | Migrée | — |
| Équipements du bassin | Migrée | — |
| Alarmes | Migrée | — |
| Gestion des alarmes | Migrée | — |
| Panneau firmware | Migrée | — |
| Sondes | Migrée | — |
| Sonde individuelle | Migrée | — |
| État système | Migrée | `b0f719b` |
| Forçage | Migrée | `a7ae685` |
| Graphique | Migrée | `116a739` |

## Ce qui reste à faire

- Vérifier la compilation et les tests après les derniers commits.
- Vérifier les cartes dans Home Assistant, notamment avec une installation réelle.
- Vérifier le comportement avec plusieurs installations Flow.io.
- Vérifier que les anciennes configurations avec `entity_prefix` affichent bien l’erreur attendue.
- Vérifier que les entités sélectionnées et les personnalisations restent conservées après migration.
- Mettre à jour le README, le CHANGELOG et les notes de projet.
- Ne créer la release qu’après des tests concluants.

## Tests à faire

1. Mettre à jour l’intégration et les cartes depuis `config-unifiee`.
2. Redémarrer Home Assistant.
3. Attendre au moins trois minutes.
4. Ouvrir chaque carte migrée et vérifier qu’elle affiche les bonnes entités.
5. Vérifier que les actions fonctionnent : filtration, traitement, équipements, alarmes, forçage.
6. Vérifier que les graphiques affichent les séries et les ombrages attendus.
7. Vérifier les notifications Android et iPhone.
8. Vérifier le suivi en direct de la filtration : apparition après 60 secondes, barre actualisée toutes les 15 minutes, disparition à l’arrêt.
9. Vérifier que l’éclairage notifie immédiatement au démarrage et à l’arrêt, avec une durée réelle.

## Rappel

Aucun changement n’a encore été testé dans Home Assistant. Aucune release n’a été créée.
