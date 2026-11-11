# Flow.io pour Home Assistant

Intégration personnalisée (version 0.1.0) pour le firmware Flow.io-Waveshare. Elle ajoute :

- les cartes Lovelace Flow.io (sous-module `cards/`, bundle servi automatiquement) ;
- des plages de qualité réglables (entités `number`) ;
- des capteurs de qualité, de volumes injectés estimés et d'autonomie des cuves ;
- des alertes (entités `binary_sensor`, classe problème) avec notifications ;
- un diagnostic et des réparations Home Assistant.

Les entités du firmware (pH, ORP, températures, équipements…) restent créées par la découverte MQTT du firmware. L'intégration les lit et ne les remplace pas. Elle ne commande aucun équipement.

## Installation (HACS)

Ajouter ce dépôt comme dépôt personnalisé HACS (catégorie Intégration), installer, redémarrer Home Assistant, puis Paramètres → Appareils et services → Ajouter une intégration → Flow.io.

## Configuration

- Préfixe des entités (`fio` par défaut).
- Service de notification (ex. `notify.mobile_app_xxx`).
- Slots des pompes pH et désinfectant (1 et 2 par défaut), utilisés pour les cuves (`data_(112+2×slot)` volume en L, `data_(113+2×slot)` remplissage en %) et, en repli, pour les compteurs de marche (`data_(144+slot)`).
- Option : notifier aussi les niveaux « à surveiller ».

## Entités lues (vérifiées dans le firmware)

| Usage | Entité |
|---|---|
| pH, ORP, eau | `sensor.<préfixe>_io_ph`, `io_orp`, `io_wat_tmp` |
| Filtration | `switch.<préfixe>_io_flt_pmp` |
| Débits des pompes (L/h) | `number.<préfixe>_pd1_flow` (pH), `pd2_flow` (chlore) |
| Marche du jour | `sensor.<préfixe>_pd_ph_pmp_upt` / `pd_chl_pmp_upt`, sinon `data_(144+slot)` |
| Cuves | `sensor.<préfixe>_data_(112+2×slot)` (L) et `data_(113+2×slot)` (%) |
| Temps de fonctionnement du contrôleur (minutes) | `sensor.<préfixe>_sys_upt_mn` |

Dans le catalogue du firmware, les valeurs `data_*` (cuves, compteurs) ne sont publiées dans Home Assistant que si elles sont activées côté firmware. Les unités de temps `s`, `min`, `mn` et `h` sont reconnues.

## Qualité de l'eau

Plages par défaut, inclusives et réglables dans les entités de configuration :

| Mesure | Bon | Moyen | Mauvais |
|---|---|---|---|
| pH | 7,0 à 7,4 | 6,8 à 7,6 | hors plage moyenne |
| ORP (mV) | 650 à 750 | 600 à 800 (choix par défaut) | hors plage moyenne |

Les valeurs du pH et la cible ORP reprennent `docs/CHEMISTRY.md` des cartes. Les bornes « moyen » de l'ORP sont un choix par défaut à adapter. L'ORP n'est évalué que filtration en marche.

Capteurs : `Qualité pH`, `Qualité ORP`, `Qualité de l'eau` (le pire des deux).

## Volumes injectés et autonomie

- Volume injecté estimé du jour = temps de marche (s) / 3600 × débit configuré (L/h) × 1000. C'est une estimation, pas une mesure.
- Autonomie de la cuve = volume restant / moyenne des totaux journaliers (7 derniers jours). Elle apparaît après au moins un jour complet observé.
- Changer le débit réestime tout le compteur du jour, ce qui peut fausser le total d'une journée.

## Alertes

pH et ORP mauvais (délai 30 / 60 min), pH et ORP à surveiller (notifiés seulement avec l'option), gel, eau trop chaude, cuves basses, contrôleur hors ligne.

## Diagnostic et réparations

Deux minutes après le démarrage, puis toutes les 15 minutes, l'intégration vérifie l'installation et publie des réparations dans Paramètres → Système → Réparations :

- entités attendues introuvables (préfixe ou slots erronés, valeurs non publiées par le firmware), avec la liste ; les alternatives sont séparées par `|` et une seule suffit ;
- service de notification inexistant, avec une réparation guidée pour en saisir un valide ;
- contrôleur redémarré au moins 3 fois en 24 h.

Le capteur de diagnostic `Redémarrages du contrôleur` compte les baisses de `sensor.<préfixe>_sys_upt_mn` et conserve les horodatages après un redémarrage de Home Assistant. Le premier relevé sert de référence : un redémarrage pendant que Home Assistant est arrêté n'est pas compté.

Pour dépanner, utilisez Appareils et services → Flow.io → Télécharger les diagnostics : le fichier contient la configuration (service de notification masqué), les seuils, les états et unités lus, l'historique des pompes et les entités manquantes.

## Développement

```sh
git clone --recurse-submodules https://github.com/ben33880/Flowio-homeassistant-integration
```

Le workflow de release compile les cartes (`cards/`) et publie `flowio.zip`.
