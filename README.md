# Flow.io pour Home Assistant

Intégration personnalisée pour le contrôleur de piscine Flow.io (firmware [Flow.io-Waveshare](https://github.com/christophebelmont/Flow.io-Waveshare)). Elle ne remplace pas la découverte MQTT du firmware : elle lit les entités qu'il publie et ajoute par-dessus de la qualité d'eau, des alertes, des volumes injectés, de l'autonomie de cuve, des notifications et des outils de diagnostic.

Elle ne pilote jamais le dosage. Les services ne font que déclencher des commandes que le firmware expose déjà sous forme d'entités.

## Ce que l'intégration ajoute

- Les cartes Lovelace Flow.io ([flowio-home-assistant-cards](https://github.com/christophebelmont/flowio-home-assistant-cards)), embarquées dans la release et servies automatiquement.
- Des capteurs : qualité du pH, de l'ORP et de l'eau, volumes injectés du jour, autonomie des cuves, redémarrages du contrôleur.
- Des alertes (`binary_sensor`) avec notifications, boutons d'action et seuils réglables (`number`).
- Des notifications de marche et d'arrêt des équipements que tu choisis.
- Des réparations Home Assistant et un export de diagnostic.
- Quatre services : forçage temporaire, fin de forçage, cuve remplie, remise à zéro d'un compteur de marche.

## Installation (HACS)

1. Dans HACS, ajoute ce dépôt comme dépôt personnalisé, catégorie **Intégration**.
2. Installe **Flow.io Piscine**, puis redémarre Home Assistant.
3. Va dans Paramètres → Appareils et services → Ajouter une intégration → **Flow.io**.

Prérequis : l'intégration MQTT de Home Assistant, et le contrôleur Flow.io qui publie ses entités par découverte MQTT.

Mise à jour : HACS propose chaque version publiée. Après une mise à jour, redémarre Home Assistant.

L'icône et le logo Flow.io viennent du dossier `custom_components/flowio/brand/`, pris en compte par Home Assistant 2026.3 ou plus récent.

## Configuration

Les réglages se font à l'ajout, puis dans Appareils et services → Flow.io → **Configurer**.

| Réglage | Rôle | Défaut |
|---|---|---|
| Préfixe des entités | Doit correspondre au préfixe d'entité Home Assistant réglé dans le firmware | `fio` |
| Service de notification | Par exemple `notify.mobile_app_xxx` | `notify.notify` |
| Racine MQTT du contrôleur | Facultative, de la forme `flowio/ESP32-XXXXXX`. Renseignée, l'intégration lit le volume réellement injecté, mesuré par le firmware. Vide, elle utilise l'estimation | vide |
| Slot de la pompe pH | Sert aux cuves, au topic des volumes et aux compteurs de marche | 1 |
| Slot de la pompe désinfectant | Idem | 2 |
| Notifier les niveaux « à surveiller » | Active les alertes de niveau moyen | non |
| Équipements à notifier | Cases à cocher, dans **Configurer** seulement. Rien de coché : aucune notification de marche ou d'arrêt | aucun |

Le préfixe est mis en minuscules, sans espace ni `_` final. Il ne peut contenir que des lettres minuscules, des chiffres et des `_`, et ne peut pas être vide. Un même préfixe ne peut être ajouté qu'une fois.

Par défaut, le firmware utilise le préfixe `fio`, la base MQTT `flowio` et un identifiant dérivé de l'appareil (de la forme `ESP32-XXXXXX`). La racine complète ressemble donc à `flowio/ESP32-XXXXXX`.

## Entités lues

| Usage | Entité |
|---|---|
| pH, ORP, température de l'eau | `sensor.<préfixe>_io_ph`, `io_orp`, `io_wat_tmp` |
| Température de l'air, pression (récapitulatif des notifications) | `sensor.<préfixe>_io_air_tmp`, `io_psi` |
| Filtration | `switch.<préfixe>_io_flt_pmp` |
| Débits des pompes (L/h) | `number.<préfixe>_pd1_flow` (pH), `pd2_flow` (désinfectant) |
| Marche du jour des pompes | `sensor.<préfixe>_pd_ph_pmp_upt` / `pd_chl_pmp_upt`, sinon `data_(144+slot)` |
| Cuves | `sensor.<préfixe>_data_(112+2×slot)` (litres) et `data_(113+2×slot)` (pourcentage) |
| Temps de fonctionnement du contrôleur (minutes) | `sensor.<préfixe>_sys_upt_mn` |
| Volume injecté mesuré (facultatif) | topic MQTT `<racine>/rt/pdm/metrics/pd<slot>`, champ `injected.day_ml` |

Les valeurs `data_*` (cuves, compteurs) ne sont publiées dans Home Assistant que si elles sont activées dans le firmware. Les unités de temps `s`, `min`, `mn` et `h` sont reconnues. La température de l'air et la pression ne servent qu'au récapitulatif : si elles sont absentes, elles n'y figurent pas.

## Qualité de l'eau

Plages par défaut, bornes incluses, réglables dans les entités `number` de l'appareil :

| Mesure | Bon | Moyen | Mauvais |
|---|---|---|---|
| pH | 7,0 à 7,4 | 6,8 à 7,6 | hors plage moyenne |
| ORP (mV) | 650 à 750 | 600 à 800 | hors plage moyenne |

Les valeurs du pH et la cible ORP viennent de `docs/CHEMISTRY.md` des cartes. Les bornes « moyen » de l'ORP sont un choix par défaut à adapter à ton installation.

Capteurs : `Qualité pH`, `Qualité ORP` et `Qualité de l'eau` (le pire des deux). Ils sont évalués en permanence.

> **Mesures peu fiables pompe arrêtée.** Quand la filtration est arrêtée, l'eau stagne autour des sondes : le pH et l'ORP peuvent être erronés. Les capteurs de qualité portent alors un attribut `warning`, et le capteur « Mesures pH/ORP peu fiables (filtration arrêtée) » est activé. Cette information n'envoie aucune notification.

## Volumes injectés et autonomie

Les capteurs `pH injecté` et `Désinfectant injecté` donnent le volume du jour en mL. Leur attribut `value_source` indique l'origine :

- `firmware` : volume réellement injecté, lu sur `<racine>/rt/pdm/metrics/pd<slot>` quand la racine MQTT est renseignée. Il n'est retenu que s'il a été reçu le jour courant.
- `estimation` : repli quand la racine est vide, que le topic n'est pas publié, que le message est invalide ou que la valeur date d'hier. Estimation = temps de marche (s) / 3600 × débit configuré (L/h) × 1000.

Les attributs `firmware_day_ml` et `estimated_ml` permettent de comparer les deux. Avec l'estimation, changer le débit réestime tout le compteur du jour.

L'autonomie d'une cuve est le volume restant divisé par la moyenne des totaux journaliers des 7 derniers jours. Elle apparaît après au moins un jour complet observé.

## Alertes

Chaque alerte est un `binary_sensor` de classe problème. Les seuils sont des entités `number` réglables.

| Alerte | Condition par défaut | Délai avant alerte | Filtration requise |
|---|---|---|---|
| pH mauvais | hors plage moyenne | 30 min | oui |
| pH à surveiller | hors plage bonne | 60 min | oui |
| ORP mauvais | hors plage moyenne | 60 min | oui |
| ORP à surveiller | hors plage bonne | 120 min | oui |
| Risque de gel | eau sous 4 °C | immédiat | non |
| Eau trop chaude | eau au-dessus de 32 °C | 60 min | non |
| Cuve pH basse | niveau sous 15 % | immédiat | non |
| Cuve désinfectant basse | niveau sous 15 % | immédiat | non |
| Contrôleur hors ligne | données indisponibles | 10 min (réglable) | non |

Les alertes « à surveiller » ne notifient que si l'option correspondante est activée. Quand la filtration est arrêtée, les alertes pH et ORP sont mises en pause (attribut `paused`) : leur état est conservé, rien n'est notifié et le compte à rebours est annulé.

## Notifications

Toutes les notifications partent vers le service choisi à la configuration. Avec un service `notify.mobile_app_*` (application Android), elles gagnent des couleurs, des icônes, des canaux et un regroupement. Avec un autre service, tu reçois le même texte, sans ces options.

### Alertes

- Au déclenchement : titre avec ⚠️, couleur rouge, priorité haute, canal « Flow.io alertes ».
- Au retour à la normale : titre avec ✅ et couleur verte.
- Sous le message, le récapitulatif (voir plus bas).

### Équipements

Dans **Configurer**, coche les équipements dont tu veux être prévenu. La liste reprend les `switch.<préfixe>_*` déjà connus de Home Assistant (filtration, pompes, relais…). Rien n'est coché par défaut.

Exemple à l'arrêt :

```text
Filtration : arrêt à 22:07 par le contrôleur, durée 12 min
pH 7,21 · ORP 720 mV
Eau 24,5 °C · Air 18,0 °C
Pression 1,2 bar
```

Au démarrage, la première ligne est par exemple « Filtration : démarrage à 21:55 par Benoît », sans durée.

- La première ligne (le titre) donne l'équipement, l'action, l'heure, l'auteur et, à l'arrêt seulement, la durée de fonctionnement. Le récapitulatif suit en dessous.
- L'icône de la notification est celle de l'entité (celle publiée par le firmware, ou celle que tu as choisie dans Home Assistant).
- Toucher la notification ouvre la fiche de l'équipement dans Home Assistant.
- L'auteur vient d'une commande Home Assistant passée dans les 2 minutes qui précèdent le changement : le nom de l'utilisateur, « une automatisation ou un script », ou « Home Assistant ». Sans commande de ce genre, le changement vient du contrôleur (programmation ou commande locale) et la ligne indique « par le contrôleur ».
- Chaque équipement a sa propre notification, qui remplace la précédente et se signale à chaque changement.
- Les passages par `unavailable` ou `unknown` (redémarrage, perte de lien) ne notifient pas.

La durée se base sur le dernier changement d'état connu de Home Assistant. Juste après un redémarrage de Home Assistant, la première durée affichée est donc plus courte que la réalité.

### Récapitulatif

Sous chaque notification d'alerte ou d'équipement : pH et ORP, température de l'eau et de l'air, pression. Une ligne est omise si ses mesures sont indisponibles. Les unités sont celles publiées par le firmware.

Sur Android, les libellés sont en gras et les valeurs de pH et d'ORP sont colorées selon la qualité : vert (bon), orange (moyen), rouge (mauvais), d'après les plages de la section Qualité de l'eau. Ce rendu n'est utilisé que si le service `notify.mobile_app_*` correspond à un appareil Android connu de Home Assistant. Sinon (iPhone, autre service), le récapitulatif est en texte simple. Les couleurs peuvent mal s'afficher en mode sombre.

### Boutons (Android)

Chaque alerte qui se déclenche propose :

- **Reporter 24 h** : supprime les notifications de cette alerte pendant 24 h. Le capteur reste exact, son attribut `snoozed` l'indique. Le report est gardé en mémoire et disparaît au redémarrage de Home Assistant.
- **Cuve remplie** (alertes de cuve basse seulement) : appelle `flowio.refill_tank`. Le bouton n'agit que si le niveau est encore sous le seuil, pour qu'un appui accidentel ne réinitialise pas une cuve pleine.

Chaque appui reçoit une réponse qui remplace la notification. Les notifications de retour à la normale n'ont pas de bouton. Les actions dynamiques ne sont pas supportées sur iOS : l'intégration n'en ajoute que pour un service `notify.mobile_app_*`. Il n'y a volontairement aucun bouton de forçage.

## Services

Les services utilisent les entités du firmware (`select`, `number`, `button`) et donc ses validations. Le champ facultatif `prefix` n'est utile qu'avec plusieurs installations.

| Service | Rôle | Garde-fous |
|---|---|---|
| `flowio.force_equipment` | Force un équipement `on` ou `off` pendant N minutes | Durée limitée à 120 min et au maximum du firmware ; l'équipement doit figurer dans les choix du firmware ; la sélection et la durée doivent être confirmées par le firmware avant la commande ; contrôleur hors ligne refusé |
| `flowio.release_override` | Termine le forçage | Option `target` pour sélectionner l'équipement d'abord |
| `flowio.refill_tank` | Signale qu'une cuve (`ph` ou `disinfection`) a été remplie | `confirm: true` obligatoire |
| `flowio.reset_uptime` | Remet un compteur de marche à zéro (`filtration`, `ph`, `disinfection`, `fill`, `chlorine_generator`, `all`) | `confirm: true` obligatoire ; la référence des volumes injectés est réinitialisée pour ne pas fausser l'autonomie |

La sélection de l'équipement forcé est globale dans le firmware et partagée entre tous les utilisateurs : un service qui sélectionne un équipement modifie cette sélection pour tout le monde. Un appel accepté n'atteste pas que l'équipement tourne physiquement, et les protections restent dans le firmware.

```yaml
action: flowio.force_equipment
data:
  target: pd0
  state: "on"
  minutes: 15
```

Les valeurs possibles de `target` sont celles de `select.<préfixe>_pdm_ovr_target` ; une erreur les liste si la valeur est inconnue.

## Diagnostic et réparations

Deux minutes après le démarrage, puis toutes les 15 minutes, l'intégration vérifie l'installation et publie des réparations dans Paramètres → Système → Réparations :

- entités attendues introuvables (préfixe ou slots erronés, valeurs non publiées par le firmware), avec la liste ; les alternatives sont séparées par `|` et une seule suffit ;
- service de notification inexistant, avec une réparation guidée pour en saisir un valide ;
- contrôleur redémarré au moins 3 fois en 24 h.

Le capteur `Redémarrages du contrôleur` compte les baisses de `sensor.<préfixe>_sys_upt_mn` et conserve les horodatages après un redémarrage de Home Assistant. Le premier relevé sert de référence : un redémarrage pendant que Home Assistant est arrêté n'est pas compté.

Pour dépanner, utilise Appareils et services → Flow.io → Télécharger les diagnostics. Le fichier contient la configuration (service de notification masqué), les seuils, les états et unités lus, l'historique des pompes et les entités manquantes. Pour suivre les notifications d'équipement, active le niveau debug de `custom_components.flowio` dans le journal de Home Assistant.

## Dépannage rapide

| Symptôme | Piste |
|---|---|
| Réparation « entités attendues introuvables » | Vérifie le préfixe, les slots et que les valeurs `data_*` sont activées dans le firmware |
| Le volume injecté reste en `estimation` | La racine MQTT est vide ou fausse, ou le topic n'est pas publié ; vérifie `flowio/ESP32-XXXXXX` avec un explorateur MQTT |
| Aucune notification | Vérifie le service de notification (réparation dédiée) et le canal Android du téléphone |
| Pas de notification d'équipement | Vérifie que l'équipement est coché dans **Configurer** et active le niveau debug pour voir les changements d'état reçus |
| Pas de couleur ni de boutons | Le service n'est pas de la forme `notify.mobile_app_*` |
| Récapitulatif en texte simple sur Android | Le service ne correspond pas à un appareil Android enregistré dans Home Assistant ; vérifie le nom `notify.mobile_app_<appareil>` |
| Aucun équipement dans la liste à cocher | Le contrôleur n'a pas encore publié ses `switch` dans Home Assistant, ou le préfixe est faux |

## Documentation du projet et release

- [CLAUDE.md](CLAUDE.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md) et [CHANGELOG.md](CHANGELOG.md) décrivent le code, les choix faits et l'historique.
- Un tag `vX.Y.Z`, identique à la version de `custom_components/flowio/manifest.json`, lance `.github/workflows/release.yml`. Il récupère les cartes au commit épinglé par `CARDS_REF`, lance leurs tests et leur `release:prepare` (notices de licences incluses), copie le bundle dans l'intégration, crée `flowio.zip` et ouvre une release en brouillon, à publier à la main. Pour changer la version des cartes, modifie `CARDS_REF` dans ce fichier.
