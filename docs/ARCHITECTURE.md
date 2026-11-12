# Architecture

Résumé du code dans `custom_components/flowio/`. En cas de doute, relire le fichier concerné.

## Fichiers

| Fichier | Rôle |
|---|---|
| `__init__.py` | Installation, enregistrement du JS des cartes, services, abonnements (santé, actions de notification, notifications d'équipement), rechargement sur changement d'options. |
| `const.py` | Clés de configuration, seuils par défaut (`THRESHOLDS`), définition des alertes (`ALERTS`). |
| `config_flow.py` | Formulaire d'ajout et d'options, normalisation et validation du préfixe et de la racine MQTT, liste des équipements à notifier. |
| `runtime.py` | Objet par installation : configuration fusionnée, résolution des noms d'entités, report d'alertes, envoi de notifications, ligne de contexte. |
| `sensor.py` | Qualité pH/ORP/eau, volumes injectés, autonomie des cuves, compteur de redémarrages. |
| `binary_sensor.py` | Une entité par alerte, plus la fiabilité des mesures (filtration arrêtée). |
| `number.py` | Seuils réglables. |
| `health.py` | Vérifie les entités attendues, le service de notification et les redémarrages fréquents ; crée des réparations. |
| `device_notifications.py` | Notifications on/off des équipements choisis. |
| `notification_actions.py` | Boutons des notifications mobiles (reporter, cuve remplie). Contenu non relu récemment. |
| `services.py`, `services.yaml` | Services `force_equipment`, `release_override`, `refill_tank`, `reset_uptime`. |
| `quality.py` | Calcul bon/moyen/mauvais et conversions de valeurs. |
| `repairs.py`, `diagnostics.py` | Réparations corrigeables, export de diagnostic. |
| `translations/en.json`, `fr.json`, `strings.json` | Textes. `strings.json` à resynchroniser. |

## Entités du firmware lues

`<p>` est le préfixe d'entités (défaut du firmware : `fio`).

- `sensor.<p>_io_ph`, `sensor.<p>_io_orp`, `sensor.<p>_io_wat_tmp` : mesures.
- `switch.<p>_io_flt_pmp` : filtration. Les alertes pH/ORP ne partent que filtration en marche.
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

Clés : `entity_prefix`, `notify_service`, `mqtt_root`, `ph_slot`, `disinfection_slot`, `notify_medium`, `notify_devices` (ce dernier seulement dans Configurer). Le `unique_id` de l'entrée de configuration est le préfixe.

## Notifications

- `FlowioRuntime.async_send` : envoi générique. Paramètres `style` (couleur, icône, canal...), `context` (ajoute température, pH, ORP, filtration) et `about` (entité évitée dans la ligne de contexte).
- `FlowioRuntime.async_notify` : alertes, avec report et boutons.
- Tag : `flowio_<préfixe>_<clé>`. Groupe : `flowio_<préfixe>`.
- Les options de style ne sont envoyées qu'avec un service `notify.mobile_app_*`.
