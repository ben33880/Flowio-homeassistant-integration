# Changelog

Les versions antérieures sont dans l'historique Git. Dates au format JJ/MM/AAAA.

## Non publié (prévu 0.1.1)

### 12/11/2026 — Notifications enrichies (`64079a5`)

- Notifications d'équipement : titre « 🟢 / ⚪ nom », heure, durée de marche ou d'arrêt, chronomètre Android au démarrage.
- Ligne de contexte ajoutée aux alertes et aux notifications d'équipement : température de l'eau, pH, ORP, état de la filtration.
- Alertes : couleur rouge et priorité haute au déclenchement, verte au retour à la normale. Canaux Android « Flow.io alertes » et « Flow.io équipements ». Regroupement par installation.
- Couleurs, icônes, canaux et chronomètre uniquement avec un service `notify.mobile_app_*`.

### 12/11/2026 — Notifications de changement d'état des équipements (`cbfc273`)

- Nouveau champ dans Configurer : cases à cocher des `switch.<préfixe>_*` à notifier. Rien de coché par défaut.
- Les passages par `unavailable` ou `unknown` sont ignorés.
- Nouveau fichier `device_notifications.py`.

### 12/11/2026 — Exemple de racine MQTT (`42d47dc`)

- L'exemple du champ passe de `flowio/abcd` à `flowio/ESP32-XXXXXX` (traductions en et fr).

### 12/11/2026 — Préfixe (`8e41120`)

- Le préfixe est normalisé (minuscules, espaces et `_` final retirés) et validé (`^[a-z0-9]+(?:_[a-z0-9]+)*$`), à l'ajout et dans Configurer.
- Le tag des notifications contient le préfixe : `flowio_<préfixe>_<alerte>`.
- Messages d'erreur `invalid_prefix` et `invalid_mqtt_root` en en et fr.
