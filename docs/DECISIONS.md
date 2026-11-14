# Décisions

Choix validés ou refusés par le propriétaire. À respecter.

## Validé

- **Préfixe d'entités** : défaut `fio`, aligné sur le firmware. Normalisé et validé avec la même règle que les cartes. Un préfixe vide est refusé.
- **Racine MQTT** : champ facultatif. Renseignée, l'intégration lit le volume mesuré par le firmware. Vide, elle utilise l'estimation. Exemple affiché : `flowio/ESP32-XXXXXX`.
- **Destinataires des notifications** (14/11/2026) : une liste de téléphones de l'application mobile, choisis dans un sélecteur d'appareils. Le champ `notify_service` est supprimé, sans mécanisme de repli. Rien de choisi : aucune notification.
- **Notifications par plateforme** (14/11/2026) : chaque téléphone reçoit un format adapté, Android en HTML, iPhone en texte simple. « Soyons créatifs », avec emojis dans le corps et couleurs, mais le titre reste sans emoji.
- **Notifications d'équipement** : au choix de l'utilisateur, par cases à cocher dans Configurer, rien de coché par défaut. Seuls les `switch` sont proposés. Démarrages et arrêts peuvent être désactivés séparément.
- **Titre d'équipement** : « Équipement : arrêt à HH:MM par X, durée Y », durée à l'arrêt seulement. « Par le contrôleur » quand aucune commande Home Assistant n'est trouvée (formulation du propriétaire).
- **Durée** : affichée seulement si elle est fiable ; « durée inconnue » plutôt qu'une durée trompeuse, quand l'équipement a démarré dans les 2 minutes qui suivent le démarrage de Home Assistant.
- **Récapitulatif** : désactivable, avec emojis (🧪 🌡️ 📊 🧴) et pastilles 🟢🟠🔴. Une ligne ⚠️ prévient que le pH et l'ORP sont peu fiables quand la filtration est arrêtée.
- **Alertes** : message précédé de 🚨 (déclenchement) ou ✅ (retour à la normale). Niveau d'interruption iPhone réglable, « urgent » par défaut.
- **Suivi en direct** : option désactivée par défaut, limitée à la filtration, après 60 secondes de marche, avec barre de progression de la plage prévue rafraîchie toutes les 15 minutes, sinon chronomètre. Les autres équipements gardent leurs notifications immédiates.
- **Alertes pH/ORP** : seulement filtration en marche, car l'eau stagne autour des sondes pompe arrêtée.
- **Seuils par défaut** : pH bon 7,0–7,4 et moyen 6,8–7,6. ORP bon 650–750 mV ; les bornes « moyen » 600–800 mV sont un choix par défaut réglable.
- **Tags de notification** : contiennent le préfixe, pour que deux installations ne s'écrasent pas.
- **Réparations** : elles signalent, sans correction guidée ; l'utilisateur corrige dans Configurer.

## Refusé

- **Détection automatique de la racine MQTT** (écoute de `flowio/+/rt/pdm/metrics/pd<slot>`) : refusée le 12/11/2026. Le propriétaire veut que l'utilisateur renseigne le champ, sinon la valeur mesurée n'est pas utilisée. Ne pas la réintroduire.
- **Service ou groupe `notify` unique comme destinataire** : remplacé par la liste d'appareils en 0.3.0. Ne pas le remettre.
- **Boutons de forçage, de dosage ou de démarrage dans les notifications** : volontairement absents.
- **Emoji dans le titre des notifications d'équipement** : refusé par le propriétaire.
- **Chiffres inventés** : pas de pourcentage de progression sans durée prévue connue ; la barre de la filtration vient de la plage publiée par le firmware.

## Questions ouvertes

- Un contrôleur configuré sans préfixe : les cartes l'acceptent, l'intégration le refuse. Pas de demande à ce jour.
- Faut-il proposer d'autres entités que les `switch` dans les notifications (capteurs binaires du contrôleur) ?
- Progression des pompes doseuses (volume injecté face à une limite journalière) : non fait, à demander au propriétaire si une limite existe dans le firmware.
- Barre de progression sur Android : un rapport de bug de l'application signale qu'elle ne s'affiche pas toujours avec `live_update`. À revérifier sur l'appareil du propriétaire.
