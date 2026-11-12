# Décisions

Choix validés ou refusés par le propriétaire. À respecter.

## Validé

- **Préfixe d'entités** : défaut `fio`, aligné sur le firmware. Normalisé et validé avec la même règle que les cartes. Un préfixe vide est refusé.
- **Racine MQTT** : champ facultatif. Renseignée, l'intégration lit le volume mesuré par le firmware. Vide, elle utilise l'estimation. Exemple affiché : `flowio/ESP32-XXXXXX`.
- **Notifications d'équipement** : au choix de l'utilisateur, par cases à cocher dans Configurer, rien de coché par défaut. Seuls les `switch` sont proposés.
- **Notifications soignées** : couleurs, icônes, durée, température de l'eau, pH et ORP. Le style n'est appliqué qu'aux services `notify.mobile_app_*`.
- **Alertes pH/ORP** : seulement filtration en marche, car l'eau stagne autour des sondes pompe arrêtée.
- **Seuils par défaut** : pH bon 7,0–7,4 et moyen 6,8–7,6. ORP bon 650–750 mV ; les bornes « moyen » 600–800 mV sont un choix par défaut réglable.
- **Tags de notification** : contiennent le préfixe, pour que deux installations ne s'écrasent pas.

## Refusé

- **Détection automatique de la racine MQTT** (écoute de `flowio/+/rt/pdm/metrics/pd<slot>`) : refusée le 12/11/2026. Le propriétaire veut que l'utilisateur renseigne le champ, sinon la valeur mesurée n'est pas utilisée. Ne pas la réintroduire.

## Questions ouvertes

- Un contrôleur configuré sans préfixe : les cartes l'acceptent, l'intégration le refuse. Pas de demande à ce jour.
- Faut-il proposer d'autres entités que les `switch` dans les notifications (capteurs binaires du contrôleur) ?
- Mettre à jour le README pour les nouvelles options.
