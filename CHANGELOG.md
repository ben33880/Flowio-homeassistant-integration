# Changelog

Les versions antérieures sont dans l'historique Git. Dates au format JJ/MM/AAAA.

Les tags `v0.3.0` et `v0.3.4` ont été créés par le propriétaire. Les versions 0.3.1, 0.3.2, 0.3.3, 0.3.5 et 0.3.6 n'ont pas de tag à la date du 14/11/2026.

## 0.3.6 — 14/11/2026

- Suivi en direct limité à la filtration. L'éclairage et les autres équipements reçoivent leur notification de démarrage tout de suite, sans le délai de 60 secondes. La filtration doit être cochée dans les équipements à notifier.
- Libellé et description de l'option « Suivre la filtration en direct » mis à jour (en, fr, strings).

## 0.3.5 — 14/11/2026

- « Durée inconnue » : le repère est le démarrage de Home Assistant (`PROCESS_START`, instant d'import du module) et non plus le chargement de l'intégration. Enregistrer les options recharge l'intégration : une durée devenait « inconnue » si l'équipement démarrait dans les 2 minutes qui suivaient.

## 0.3.4 — 14/11/2026

- Suivi en direct de la filtration : barre de progression de la plage prévue (`sensor.<préfixe>_pl_flt_start` et `pl_flt_stop`, heures décimales, attribut `scheduled_minutes`), avec le temps restant, rafraîchie toutes les 15 minutes. Le chronomètre est abandonné dans ce cas, car il ne se combine pas avec une barre figée. Pas de barre pour une filtration continue ; la plage peut franchir minuit.
- Récapitulatif : ligne 🧴 des cuves, volume restant et pourcentage, avec pastille selon le seuil d'alerte de cuve.

## 0.3.3 — 14/11/2026

- Suivi en direct : la carte n'est créée que si l'équipement tourne encore après 60 secondes (iOS limite les démarrages d'activités par notification).
- La carte est retirée quand l'équipement devient indisponible, et quand il revient arrêté après une indisponibilité (redémarrage de Home Assistant).

## 0.3.2 — 14/11/2026

- iPhone : icône de secours `mdi:pool` quand l'équipement n'en a pas, pour que la couleur (fond de l'icône d'une notification de communication) reste visible ; glyphe blanc envoyé explicitement.
- Android : retour à `<span style="color: …">`, la balise de l'exemple de la documentation officielle, à la place de `<font color>`.

## 0.3.1 — 14/11/2026

- Récapitulatif avec emojis : 🧪 pH et ORP avec pastille 🟢🟠🔴, 🌡️ eau et air, 📊 pression, ⚠️ avertissement quand la filtration est arrêtée. Le titre reste sans emoji.
- Alertes : message précédé de 🚨 au déclenchement et de ✅ au retour à la normale, en gras et coloré sur Android.
- Nouvelle option « Suivre en direct » (Live Activities iPhone et Live Updates Android), désactivée par défaut, avec chronomètre depuis le démarrage. Restreinte à la filtration en 0.3.6.

## 0.3.0 — 14/11/2026

### Changement de configuration

- Le champ « Service de notification » (`notify_service`) est supprimé, sans repli. Il est remplacé par une liste de téléphones (appareils de l'application mobile Home Assistant). Les groupes `notify` ne sont plus utilisés. La version de l'entrée de configuration passe à 2 : la migration supprime `notify_service` ; aucun téléphone n'est choisi après la migration, il faut les cocher dans Configurer.
- La réparation « service de notification introuvable » et son flux de correction sont remplacés par « téléphone injoignable », sans correction guidée. L'ancienne réparation est supprimée au démarrage.
- Diagnostic : les téléphones sont masqués ; le nombre de téléphones choisis et joignables est indiqué.

### Notifications par plateforme

- Chaque téléphone reçoit sa propre notification, avec le format de sa plateforme. Un échec sur un téléphone n'empêche pas les autres.
- Android : HTML (gras, couleurs selon la qualité), canal, priorité haute pour les alertes, `clickAction`.
- iPhone : texte simple, `url`, niveau d'interruption, couleur du fond de l'icône.
- Nouvelles options : notifier les démarrages, notifier les arrêts, ajouter le récapitulatif, niveau d'interruption iPhone des alertes (discret, normal, urgent).
- Durée à l'arrêt : « durée inconnue » quand le démarrage n'a pas pu être observé de façon fiable (démarré dans les 2 minutes qui suivent le démarrage de Home Assistant), au lieu d'une durée trompeuse.
- Récapitulatif : ligne d'avertissement quand la filtration est arrêtée (pH et ORP peu fiables).

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
