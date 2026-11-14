# Changelog

Les versions antérieures sont dans l'historique Git. Dates au format JJ/MM/AAAA.

## Non publié

### 14/11/2026 — Notifications plus lisibles

- Notifications d'équipement : titre « nom : démarrage » ou « nom : arrêt », puis une première ligne avec l'heure, l'auteur (« par Benoît », « par une automatisation ou un script », « par Home Assistant » ou « par le contrôleur ») et, à l'arrêt seulement, la durée de fonctionnement.
- L'icône de la notification est celle de l'entité (attribut `icon`, sinon icône du registre d'entités). Plus d'emoji dans ces titres.
- Chronomètre Android retiré : c'était la seule différence entre les notifications de démarrage et d'arrêt, et les démarrages n'arrivaient pas.
- Récapitulatif sous le message, pour les équipements et pour les alertes : pH et ORP, eau et air, pression. La ligne de filtration est supprimée.
- Journal de débogage (`custom_components.flowio`) pour suivre les changements d'état reçus.

## 0.2.1 — 13/11/2026

Publiée le 13/11/2026 (workflow de release et manifest modifiés par le propriétaire). Voir l'historique Git.

## 0.2.0 — 12/11/2026

La version 0.1.1 avait déjà été publiée le 12/11/2026 ; tout ce qui suit est donc dans la 0.2.0.

### Notifications enrichies (`64079a5`)

- Notifications d'équipement : titre « 🟢 / ⚪ nom », heure, durée de marche ou d'arrêt, chronomètre Android au démarrage.
- Ligne de contexte ajoutée aux alertes et aux notifications d'équipement : température de l'eau, pH, ORP, état de la filtration.
- Alertes : couleur rouge et priorité haute au déclenchement, verte au retour à la normale. Canaux Android « Flow.io alertes » et « Flow.io équipements ». Regroupement par installation.
- Couleurs, icônes, canaux et chronomètre uniquement avec un service `notify.mobile_app_*`.

### Notifications de changement d'état des équipements (`cbfc273`)

- Nouveau champ dans Configurer : cases à cocher des `switch.<préfixe>_*` à notifier. Rien de coché par défaut.
- Les passages par `unavailable` ou `unknown` sont ignorés.
- Nouveau fichier `device_notifications.py`.

### Exemple de racine MQTT (`42d47dc`)

- L'exemple du champ passe de `flowio/abcd` à `flowio/ESP32-XXXXXX` (traductions en et fr).

### Préfixe (`8e41120`)

- Le préfixe est normalisé (minuscules, espaces et `_` final retirés) et validé (`^[a-z0-9]+(?:_[a-z0-9]+)*$`), à l'ajout et dans Configurer.
- Le tag des notifications contient le préfixe : `flowio_<préfixe>_<alerte>`.
- Messages d'erreur `invalid_prefix` et `invalid_mqtt_root` en en et fr.

## 0.1.1 — 12/11/2026

Publiée le 12/11/2026. Contenu détaillé : voir l'historique Git (tag `v0.1.1`).

## 0.1.0 — 11/11/2026

Première version publiée.
