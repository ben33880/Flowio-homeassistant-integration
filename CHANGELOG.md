# Changelog

Les versions antérieures sont dans l'historique Git. Dates au format JJ/MM/AAAA.

## 0.2.5 — 14/11/2026

- Notifications d'équipement : l'option `alert_once` est retirée. Comme un démarrage et un arrêt d'un même équipement partagent le même tag, un démarrage qui remplace la notification d'arrêt restait silencieux. Chaque changement se signale de nouveau.
- Icône et logo Flow.io pour Home Assistant : dossier `custom_components/flowio/brand/` (`icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png`), pris en compte par Home Assistant 2026.3 ou plus récent.
- iPhone : les alertes qui se déclenchent utilisent le niveau d'interruption « time-sensitive » (elles traversent le mode Concentration) et le retour à la normale le niveau « passive » (sans réveiller l'écran). Le niveau n'est pas envoyé à un appareil Android connu.
- Documentation : les boutons « Reporter 24 h » et « Cuve remplie » sont bien proposés sur iPhone (actions intégrées aux notifications depuis iOS 2021.5). Le README disait à tort qu'iOS ne les supportait pas.

## 0.2.3 et 0.2.4 — 14/11/2026

Ajustements du workflow de release et du manifest faits à la main par le propriétaire. Voir l'historique Git.

## 0.2.2 — 14/11/2026

### Notifications plus lisibles

- Notifications d'équipement : tout sur la première ligne (le titre), par exemple « Filtration : arrêt à 22:07 par le contrôleur, durée 12 min » ou « Filtration : démarrage à 21:55 par Benoît ». L'auteur peut être un utilisateur, « une automatisation ou un script », « Home Assistant » ou « le contrôleur ». La durée n'apparaît qu'à l'arrêt.
- L'icône de la notification est celle de l'entité (attribut `icon`, sinon icône du registre d'entités). Plus d'emoji dans ces titres.
- Chronomètre Android retiré : c'était la seule différence entre les notifications de démarrage et d'arrêt, et les démarrages n'arrivaient pas.
- Récapitulatif sous le titre, pour les équipements et pour les alertes : pH et ORP, eau et air, pression. La ligne de filtration est supprimée.
- Journal de débogage (`custom_components.flowio`) pour suivre les changements d'état reçus.
- Seuls `flowio.force_equipment` et `flowio.release_override` comptent comme commandes d'équipement pour déterminer l'auteur ; `refill_tank` et `reset_uptime` n'y sont plus pris en compte.
- README, CLAUDE.md et CHANGELOG mis à jour.

### Design (Android)

- Dans le récapitulatif, les libellés sont en gras et les valeurs de pH et d'ORP sont colorées selon la qualité : vert (bon), orange (moyen), rouge (mauvais). Utilisé seulement si le service `notify.mobile_app_*` correspond à un appareil Android connu ; sinon texte simple.
- Toucher une notification d'équipement ouvre la fiche de l'équipement.
- Les notifications d'équipement ne sonnent qu'une fois quand elles en remplacent une autre (`alert_once`). Retiré en 0.2.5.

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
