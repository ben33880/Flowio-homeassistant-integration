# Changelog

## 0.3.5 — en préparation

- Nouvelle carte `custom:flowio-alarm-detail-card` : tableau des alarmes (nom, condition) — icône rouge quand l'alarme est active, condition rouge si active, orange si inactive alors que l'alarme est latchée, verte sinon — et acquittement par ligne (`button.<préfixe>_alm_<id>_reset`, icône ↻, activé si `resettable`) ou « Acquitter les disponibles » ; choix des alarmes et classement par glisser-déposer dans l'éditeur.
- Nouvelle carte `custom:flowio-actuator-card` : tableau des actionneurs (nom, icône colorée à l'activation, durées de fonctionnement jour/semaine/mois/total lues dans les attributs de l'entité de commutation) sans interrupteur, avec remise à zéro par ligne (`button.<préfixe>_pd_reset_upt_*`) et « Tout remettre à zéro ». L'éditeur permet de choisir titre, sous-titre, préfixe, texte à retirer devant les noms et la liste des actionneurs, avec classement par glisser-déposer.
- Nouvelle carte `custom:flowio-state-history-card` : frise des états booléens (interrupteurs et capteurs binaires) sur les 24 h du jour, piste grise hors activation, icônes et segments à la couleur d'activation, badge de l'heure courante placé en haut de la frise, choix des entités, classement par glisser-déposer et texte retiré devant les noms (titre par défaut « Historique »). L'éditeur permet un nom affiché et une couleur d'activation par entité (`items[<entité>]`).
- Popups (tooltips) des graphiques ApexCharts : fond et texte forcés sur les variables du thème Home Assistant, pour rester lisibles en thème sombre même quand la détection du mode sombre échoue.
- Carte Équipements : quand l'attribut booléen `forced` (`true`/`false`) de l'entité de l'actionneur est actif, le libellé multilingue « Forcé » s'affiche aligné à droite de la tuile, sur la même ligne et avec la même police et couleur que l'état, et le cadre de la tuile passe au rouge avec un double « serpent » (deux segments opposés) alternant une phase rapide (un tour en 0,5 s) et une phase lente (un tour en 1 s), avec transitions progressives.
- Ajout du paramètre permanent `mqtt_topic` à la carte, distinct du préfixe Home Assistant et disponible dans l’éditeur visuel.
- La popup Maintenance lit automatiquement l’état des alarmes via le topic MQTT configuré ; la saisie locale du topic est supprimée.
- Les souscriptions MQTT sont fermées à la fermeture de la popup, au changement de topic, de préfixe ou de connexion ; les messages d’une ancienne cible sont ignorés.
- Sans `mqtt_topic`, le pilotage des alarmes reste indisponible avec un message explicite, tandis que le forçage temporaire reste utilisable.
- Le test e2e du forçage cible explicitement le champ « Durée (minutes) », évitant l’ambiguïté avec le nouveau switch d’évaluation des alarmes.
- Détails : [notes de release 0.3.5](docs/releases/v0.3.5.md).

## 0.3.4 — en préparation

- Correction ciblée de l’ouverture du dialogue « Système » sur mobile : le bouton interactif reste dans le composant Flow.io, hors du shadow DOM de l’en-tête natif Home Assistant.
- Emplacement de 44 px réservé juste après le titre pour conserver la disposition « titre + Système à gauche, badges à droite » ; repositionnement au redimensionnement du composant ou du titre et lors des transitions mobile/desktop.
- Bouton de secours conservé si le titre natif est introuvable ; nettoyage des éléments et des observateurs lors de la déconnexion du composant.
- Tests tactiles ajoutés pour l’ouverture et la fermeture du dialogue et les transitions mobile/desktop ; les assertions existantes d’alignement des badges sont conservées. Validation du dernier correctif encore à confirmer.
- Préparation des métadonnées et des notes ; synchronisation du lockfile et génération des artefacts encore requises avant release.
- Détails : [notes de release 0.3.4](docs/releases/v0.3.4.md).

## 0.3.3 — en préparation

- Icône « Système » native HA placée juste après le titre ; badges « Traitement » et « Alertes » alignés à droite, avec style Flow.io accordé au thème et icônes firmware dans le dialogue.
- Tension (V) et courant (A) ajoutés au diagnostic système depuis `sensor.<préfixe>_io_voltage` et `sensor.<préfixe>_io_current` ; le signal Wi-Fi n’apparaît que s’il est disponible.
- Actions de remplissage pH/désinfectant placées en icônes à infobulle à côté des jauges de cuves correspondantes.
- Remises à zéro des durées de filtration, pH et désinfection placées sous leurs compteurs dans « Horaires & durées » ; leur durée est ajoutée à l’affichage si nécessaire.
- Toutes les options des paramètres de chaque carte sont sélectionnées par défaut ; l’utilisateur peut décocher les éléments inutiles.
- Pourcentage des cuves agrandi ; volume restant et action de remplissage alignés au pied des jauges.
- Forçage temporaire placé dans la section Filtration de « Horaires & durées », avec un bouton harmonisé.
- Les nouvelles cartes occupent toute la largeur d’une vue Sections par défaut.
- Valeurs calculées et télémétrie regroupées dans une section configurable, alignée à gauche sur « Qualité de l’eau » et étendue sur toute la largeur ; les horaires restent placés avant cette section.
- Titre par défaut raccourci à « Supervision » ; bouton Système redessiné plus discret et fiabilisé pour le toucher sur mobile.
- Type de traitement déduit de `select.<préfixe>_pl_modes_dis`, sans réglage manuel redondant ; les modes, les équipements, les injections et les actions suivent le mode firmware actif.
- Routage distinct des commandes électrolyseur et désinfection chimique. En mode inconnu ou désactivé, les commandes dépendantes du traitement sont indisponibles. L’ancien `display.treatment` est accepté mais ignoré.
- Switch autonome Électrolyseur retiré des équipements ; « Pompe désinfectant » pilote l’électrolyseur en mode « Electrolyse », la pompe désinfectant pour « Chlore/Brome » ou « Oxygène actif ».
- Libellé de la mesure dans « Qualité de l’eau » fixé à « ORP », indépendamment du traitement actif.
- En mode électrolyse, la remise à zéro désinfection cible le compteur électrolyseur ; remplissage et estimation d’injection désinfectant masqués.
- Détails : [notes de release 0.3.3](docs/releases/v0.3.3.md).

## 0.3.2 — construite

- Libellé « Injecté aujourd’hui · estimé » déplacé sous chaque jauge pH/ORP correspondante.
- Détails : [notes de release 0.3.2](docs/releases/v0.3.2.md).

## 0.3.1 — en préparation

- Jauges agrandies et estimations d'injection placées sous la jauge correspondante.
- Détails : [notes de release 0.3.1](docs/releases/v0.3.1.md).

## 0.3.0 — en préparation

- Espacements et alignements uniformisés entre les sections, cuves rapprochées des équipements et section Horaires remontée.
- Titres Supervision et Historique harmonisés, icônes mises en valeur et badge d'alarme vert à zéro / rouge clignotant en cas d'alarme.
- Diagnostic de configuration masqué en l'absence d'entités manquantes.
- Détails : [notes de release 0.3.0](docs/releases/v0.3.0.md).

## 0.2.0

- Entête native compacte avec traitement et compteur d'alarmes.
- Jauges compactes et durées intégrées à la frise de filtration.
- Estimations d'injection et configuration étendue des équipements, cuves et diagnostics.
- Notes : [release 0.2.0](docs/releases/v0.2.0.md).

## 0.1.0

- Première version stable ; voir [notes de release 0.1.0](docs/releases/v0.1.0.md).
