# Flow.io pour Home Assistant

Intégration personnalisée (version 0.1.0) pour le firmware Flow.io-Waveshare. Elle ajoute :

- les cartes Lovelace Flow.io (sous-module `cards/`, bundle servi automatiquement) ;
- des seuils réglables (entités `number`) ;
- des alertes de seuils (entités `binary_sensor`, classe problème) avec notifications.

Les entités du firmware (pH, ORP, températures, équipements…) restent créées par la découverte MQTT du firmware. L'intégration les lit et ne les remplace pas.

## Installation (HACS)

Ajouter ce dépôt comme dépôt personnalisé HACS (catégorie Intégration), installer, redémarrer Home Assistant, puis Paramètres → Appareils et services → Ajouter une intégration → Flow.io.

## Configuration

- Préfixe des entités (`fio` par défaut).
- Service de notification (ex. `notify.mobile_app_xxx`).
- Entités de niveau de cuve pH / désinfectant (optionnel ; sans elles, les alertes de cuve ne sont pas créées).

## Alertes

pH bas/haut, ORP bas (filtration en marche), gel, eau trop chaude, cuves basses, contrôleur hors ligne. Les seuils sont des entités de configuration de l'appareil Flow.io.

## Développement

```sh
git clone --recurse-submodules https://github.com/ben33880/Flowio-homeassistant-integration
```

Le workflow de release compile les cartes (`cards/`) et publie `flowio.zip`.
