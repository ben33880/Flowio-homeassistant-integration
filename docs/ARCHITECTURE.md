# Architecture

Résumé du code dans `custom_components/flowio/`. En cas de doute, relire le fichier concerné.

## Fichiers

| Fichier | Rôle |
|---|---|
| `__init__.py` | Installation, migration de la configuration (version 2), enregistrement du JS des cartes, services, abonnements (santé, actions de notification, notifications d'équipement), rechargement sur changement d'options. |
| `const.py` | Clés de configuration, seuils par défaut (`THRESHOLDS`), définition des alertes (`ALERTS`). |
| `config_flow.py` | Formulaire d'ajout et d'options, sélecteur d'appareils mobiles, normalisation et validation du préfixe et de la racine MQTT, liste des équipements à notifier, options de notification. |
| `runtime.py` | Objet par installation : configuration fusionnée, résolution des noms d'entités, résolution des téléphones, report d'alertes, envoi de notifications par plateforme, récapitulatif, plage de filtration, suivi en direct. |
| `sensor.py` | Qualité pH/ORP/eau, volumes injectés, autonomie des cuves, compteur de redémarrages. |
| `binary_sensor.py` | Une entité par alerte, plus la fiabilité des mesures (filtration arrêtée). |
| `number.py` | Seuils réglables. |
| `health.py` | Vérifie les entités attendues, les téléphones injoignables et les redémarrages fréquents ; crée des réparations (non corrigeables depuis la 0.3.0). Supprime l'ancienne réparation `notify_service_missing_*`. |
| `device_notifications.py` | Notifications on/off des équipements choisis, durée, auteur, suivi en direct de la filtration. |
| `notification_actions.py` | Boutons des notifications mobiles (reporter, cuve remplie). Non relu depuis la 0.2.5. |
| `services.py`, `services.yaml` | Services `force_equipment`, `release_override`, `refill_tank`, `reset_uptime`. |
| `quality.py` | Calcul bon/moyen/mauvais et conversions de valeurs. |
| `repairs.py`, `diagnostics.py` | `repairs.py` ne contient plus qu'un flux de confirmation sans usage ; `diagnostics.py` exporte la configuration (téléphones masqués), les états et le nombre de téléphones joignables. |
| `translations/en.json`, `fr.json`, `strings.json` | Textes. `strings.json` et `en.json` sont identiques. |

## Entités du firmware lues

`<p>` est le préfixe d'entités (défaut du firmware : `fio`).

- `sensor.<p>_io_ph`, `sensor.<p>_io_orp`, `sensor.<p>_io_wat_tmp` : mesures. `io_air_tmp` et `io_psi` : récapitulatif.
- `switch.<p>_io_flt_pmp` : filtration. Les alertes pH/ORP ne partent que filtration en marche.
- `sensor.<p>_pl_flt_start`, `sensor.<p>_pl_flt_stop` : plage de filtration prévue, en heures ; le capteur de début porte l'attribut `scheduled_minutes` (1 440 = filtration continue). Lus pour la barre de progression.
- `number.<p>_pd1_flow`, `number.<p>_pd2_flow` : débits des pompes doseuses.
- `sensor.<p>_pd_ph_pmp_upt`, `sensor.<p>_pd_chl_pmp_upt` : temps de marche des pompes (repli : `data_*`).
- `sensor.<p>_sys_upt_mn` : durée de fonctionnement du contrôleur, sert à compter les redémarrages.
- `sensor.<p>_data_<n>` : cuves et compteurs, avec `n` dépendant du slot (formules ci-dessous).

## Slots et formules

Slots par défaut : pH = 1, désinfectant = 2.

- Volume de cuve : `data_(112 + 2 × slot)`. Pourcentage : `data_(113 + 2 × slot)`.
- Compteur de marche : `data_(144 + slot)`.

## Volume injecté

- Source 1 (si la racine MQTT est renseignée) : topic `<racine>/rt/pdm/metrics/pd<slot>`, JSON `injected.day_ml`, retenu s'il date du jour.
- Source 2 (repli) : estimation = temps de marche (s) / 3600 × débit (L/h) × 1000.
- L'autonomie d'une cuve = volume de la cuve / moyenne des totaux journaliers (7 jours).

## Valeurs par défaut du firmware (lues dans le code)

| Réglage | Valeur |
|---|---|
| Préfixe d'entité Home Assistant (`FLOW_WIRDEF_HA_ENTITY_PREFIX`) | `fio` |
| Base du topic MQTT (`FLOW_WIRDEF_MQ_BASE`) | `flowio` |
| Identifiant du topic MQTT (`FLOW_WIRDEF_MQ_TID`) | vide, donc dérivé de l'appareil (forme `ESP32-XXXXXX`) |

La racine MQTT complète est donc de la forme `flowio/ESP32-XXXXXX`.

## Configuration

Clés : `entity_prefix`, `mobile_devices` (liste d'identifiants du registre d'appareils, appareils de l'application mobile), `mqtt_root`, `ph_slot`, `disinfection_slot`, `notify_medium`. Dans Configurer seulement : `notify_devices` (équipements), `notify_on_start`, `notify_on_stop`, `notify_recap`, `notify_live`, `ios_alert_level` (`passive`, `active`, `time-sensitive`). Le `unique_id` de l'entrée de configuration est le préfixe. Version de l'entrée : 2 ; la migration supprime `notify_service`.

## Notifications

- `FlowioRuntime.resolve_targets` : transforme `mobile_devices` en cibles. Pour chaque appareil, trouve l'entrée `mobile_app` du registre, nom du service = `notify.mobile_app_<slug du device_name>`, plateforme = `os_name == "Android"` ou non. Renvoie aussi les appareils injoignables (supprimés, ou sans service `notify`), utilisés par la réparation.
- `FlowioRuntime.async_send` : envoi à chaque cible avec son format. Android : HTML, `channel`, `importance`/`priority`/`ttl` pour l'urgent, `clickAction`. iPhone : texte simple, `url`, `push.interruption-level`, `notification_icon_color` blanc. Commun : `tag`, `group`, `color`, `notification_icon` (icône de secours `mdi:pool` si une couleur est donnée), `actions`. Un échec sur une cible est journalisé et n'arrête pas les autres.
- `FlowioRuntime.async_notify` : alertes, avec report et boutons ; message préfixé 🚨 ou ✅.
- `FlowioRuntime.context_line` : récapitulatif (🧪 🌡️ 📊 🧴, ligne ⚠️ si la filtration est arrêtée), en HTML pour Android.
- `FlowioRuntime.filtration_window`, `filtration_progress` : plage et pourcentage d'avancement de la filtration.
- `FlowioRuntime.async_send_live`, `async_clear_live` : Live Activity / Live Update, tag `flowio_<préfixe>_live_<clé>` (64 caractères max). Avec progression : `progress`, `progress_max`, `critical_text`, `alert_once` pour les mises à jour. Sans : `chronometer`, `when`, `when_relative: false`.
- Tag : `flowio_<préfixe>_<clé>`. Groupe : `flowio_<préfixe>`.
- `device_notifications.py` : durée fiable si `old.last_changed - PROCESS_START > 120 s` (`PROCESS_START` = import du module, donc démarrage de Home Assistant). Suivi en direct de la filtration seulement, démarré après 60 s (`async_call_later`), rafraîchi toutes les 15 min (`async_track_time_interval`), retiré à l'arrêt, à l'indisponibilité et au retour à `off` après une indisponibilité.
