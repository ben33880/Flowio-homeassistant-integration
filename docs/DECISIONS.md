# Décisions

Choix validés ou refusés par le propriétaire. À respecter.

## Validé

- **Préfixe d'entités** : défaut `fio`, aligné sur le firmware. Normalisé et validé avec la même règle que les cartes. Un préfixe vide est refusé.
- **Racine MQTT** : champ facultatif. Renseignée, l'intégration lit le volume mesuré par le firmware. Vide, elle utilise l'estimation. Exemple affiché : `flowio/ESP32-XXXXXX`.
- **Cartes dans le dépôt, sans version propre** (14/11/2026) : le code source des cartes est dans `cards/`, et non plus dans un dépôt à part. Les cartes n'ont pas de numéro de version : `cards/package.json` est figé à `1.0.0` et le bundle est reconstruit à chaque release de l'intégration, avec la version de l'intégration. Plus de changelog ni de notes de release des cartes, plus d'installation HACS séparée, plus de CI propre aux cartes.
- **Release portée par le workflow** (14/11/2026) : le workflow `release.yml` lance les tests, le build, génère les mentions de licences des dépendances et copie le bundle. Le script `prepare-release.mjs` est supprimé.
- **Destinataires des notifications** (14/11/2026) : une liste de téléphones de l'application mobile, choisis dans un sélecteur d'appareils. Le champ `notify_service` est supprimé, sans mécanisme de repli. Rien de choisi : aucune notification.
- **Notifications par plateforme** (14/11/2026) : chaque téléphone reçoit un format adapté, Android en HTML, iPhone en texte simple. « Soyons créatifs », avec emojis dans le corps et couleurs, mais le titre reste sans emoji.
- **Notifications d'équipement** : au choix de l'utilisateur, par cases à cocher dans Configurer, rien de coché par défaut. Seuls les `switch` sont proposés. Démarrages et arrêts peuvent être désactivés séparément.
- **Titre d'équipement** : « Équipement : arrêt à HH:MM par X, durée Y », durée à l'arrêt seulement. « Par le contrôleur » quand aucune commande Home Assistant n'est trouvée (formulation du propriétaire).
- **Durée** : affichée seulement si elle est fiable ; « durée inconnue » plutôt qu'une durée trompeuse, quand l'équipement a démarré dans les 2 minutes qui suivent le démarrage de Home Assistant.
- **Récapitulatif** : désactivable, avec emojis (🧪 🌡️ 📊 🧴) et pastilles 🟢🟠🔴. Une ligne ⚠️ prévient que le pH et l'ORP sont peu fiables quand la filtration est arrêtée.
- **Alertes** : message précédé de 🚨 (déclenchement) ou ✅ (retour à la normale). Niveau d'interruption iPhone réglable, « urgent » par défaut.
- **Suivi en direct** : option désactivée par défaut, limitée à la filtration. Notification de démarrage immédiate, remplacée après 60 secondes de marche par une carte (titre « en marche depuis HH:MM », demandé le 21/11/2026) avec barre de progression de la plage prévue rafraîchie à un intervalle réglable dans Configurer (`notify_live_refresh`, 15 minutes par défaut, demandé le 21/11/2026), sinon chronomètre. Les autres équipements gardent leurs notifications immédiates.
- **Alertes pH/ORP** : seulement filtration en marche, car l'eau stagne autour des sondes pompe arrêtée.
- **Seuils par défaut** : pH bon 7,0–7,4 et moyen 6,8–7,6. ORP bon 650–750 mV ; les bornes « moyen » 600–800 mV sont un choix par défaut réglable.
- **Tags de notification** : contiennent le préfixe, pour que deux installations ne s'écrasent pas.
- **Réparations** : elles signalent, sans correction guidée ; l'utilisateur corrige dans Configurer.

## Refusé

- **Détection automatique de la racine MQTT** (écoute de `flowio/+/rt/pdm/metrics/pd<slot>`) : refusée le 12/11/2026. Le propriétaire veut que l'utilisateur renseigne le champ, sinon la valeur mesurée n'est pas utilisée. Ne pas la réintroduire.
- **Service ou groupe `notify` unique comme destinataire** : remplacé par la liste d'appareils en 0.3.0. Ne pas le remettre.
- **Boutons de forçage, de dosage ou de démarrage dans les notifications** : volontairement absents.
- **Emoji dans le titre des notifications d'équipement** : refusé par le propriétaire.
- **Écrire dans le dépôt externe des cartes ou dans celui du firmware** (14/11/2026) : ils n'appartiennent pas au propriétaire. Lecture seule. Les changements de cartes se font dans `cards/`.
- **Version, changelog ou notes de release propres aux cartes** (14/11/2026) : refusés par le propriétaire. Ne pas les réintroduire.
- **Chiffres inventés** : pas de pourcentage de progression sans durée prévue connue ; la barre de la filtration vient de la plage publiée par le firmware.

## À faire (retenu le 21/11/2026)

Les trois fonctionnalités choisies par le propriétaire sont codées (21/11/2026, version 0.5.0 préparée). Testées seulement avec un Home Assistant 2025.1.4 de test, pas sur les appareils du propriétaire. Elles réutilisent des données déjà lues. Respecter les décisions ci-dessus (pas de boutons d'action, pas de chiffres inventés).

1. **Tendance et stabilité du pH/ORP** : capteur de dérive sur 24 h et 7 jours, pour prévenir avant le passage en « mauvais » et repérer une sonde qui vieillit.
2. **Dosage anormal** : alerte si le volume injecté du jour dépasse nettement la moyenne des 7 derniers jours (fuite, siphonnage, sonde défaillante). Ne demande pas de limite du firmware.
3. **Filtration non démarrée** : alerte si la plage prévue (`pl_flt_start`) a commencé depuis plus de 15 min et que `switch.<p>_io_flt_pmp` est arrêté.

## À prévoir (idées, non validées)

- Alerte « sonde figée ou aberrante » (valeur immobile X heures, ou hors plage physique).
- Durée de filtration réalisée dans la journée face à la durée recommandée (règle température ÷ 2, à laisser réglable car ce n'est pas une valeur du firmware).
- Alerte « cuve basse » prédictive : autonomie sous 7 jours.
- Rapport quotidien ou hebdomadaire planifié (réutilise le récapitulatif).
- Journal des interventions (contre-lavage, nettoyage du filtre) et alerte de pression (`io_psi`).
- Indice de qualité global (baignable / à surveiller / non baignable).
- Mode saison / hivernage : garde seulement gel et hors ligne.
- Blueprints, événements HA (`flowio_alert`), suivi d'énergie (à vérifier dans le firmware), capteur « dernière alerte ».

## Questions ouvertes

- Un contrôleur configuré sans préfixe : les cartes l'acceptent, l'intégration le refuse. Pas de demande à ce jour.
- Faut-il proposer d'autres entités que les `switch` dans les notifications (capteurs binaires du contrôleur) ?
- Progression des pompes doseuses (volume injecté face à une limite journalière) : non fait, à demander au propriétaire si une limite existe dans le firmware.
- Barre de progression sur Android : un rapport de bug de l'application signale qu'elle ne s'affiche pas toujours avec `live_update`. À revérifier sur l'appareil du propriétaire.
- Les tests des cartes (`npm test`) ne tournent qu'à la release : faut-il un workflow de tests au push ? Pas de demande à ce jour.
- Les fiches `cards/docs/DESIGN.md`, `DEVELOPMENT.md`, `DISPLAY.md`, `INJECTIONS.md`, `MAINTENANCE.md` et `TIMING.md` n'ont pas été relues : elles peuvent encore parler de versions ou de release séparées.
