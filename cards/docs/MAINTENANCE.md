# Menu Maintenance

## Configuration partagée

Le préfixe Home Assistant et la racine MQTT viennent de l’intégration Flow.io. La carte conserve uniquement son contenu affiché :

```yaml
type: custom:flowio-pool-card
display:
  operations: [timed_override]
```

La commande WebSocket `flowio/config` transmet notamment `prefix` et `mqtt_root`. Cette dernière est la racine complète `<baseTopic>/<deviceId>`, sans `/cfg/set`, configurée dans l’intégration. Aucun topic n’est inventé ni enregistré localement par la carte.

## Interface

Le bouton Maintenance remplace Forçage temporaire dans Filtration sous Horaires & durées, avec la même présentation. La popup contient Alarmes et Forçage. La clé `display.operations: [timed_override]`, le formulaire de forçage, ses commandes et ses confirmations restent compatibles.

À l’ouverture, la section Alarmes lit automatiquement l’état via le topic configuré et l’affiche en lecture seule. Il n’y a plus de saisie locale du topic. Relire l’état MQTT permet une nouvelle tentative après erreur. Les souscriptions ne sont ouvertes que pendant le dialogue et sont retirées à sa fermeture, au changement de topic, de préfixe HA ou de connexion. Les callbacks d’une ancienne cible sont ignorés.

Si la racine MQTT manque dans l’intégration, seul le pilotage des alarmes reste indisponible ; le forçage reste utilisable.

## Commandes et limites

L’interrupteur Évaluation des alarmes est bloqué tant que l’état est inconnu, que le contrôleur n’est pas confirmé en ligne ou qu’une commande attend confirmation. Désactivation et réactivation demandent confirmation. L’état ne change qu’au retour de configuration du firmware, pas à la seule réussite de la publication. Les commandes de forçage sont bloquées pendant la lecture ou modification des alarmes ; les commandes MQTT sont bloquées pendant une commande ou confirmation de forçage.

La fermeture du dialogue n’annule pas une commande déjà transmise. Désactiver l’évaluation globale n’acquitte pas les alarmes mémorisées et ne garantit pas la levée des interlocks. Aucun reset d’alarme n’est envoyé. Un avertissement rappelle de réactiver les alarmes après maintenance. La configuration du moteur d’alarmes est persistante côté firmware.

## Contrat MQTT et permissions

Référence firmware : `christophebelmont/Flow.io-Waveshare`, `docs/core/mqtt-topics.md`, `docs/modules/AlarmModule.md` et `src/Modules/AlarmModule/AlarmModule.cpp`.

- Lecture : `<mqtt_root>/cfg/alarms` (`enabled`) et `<mqtt_root>/status` (`online`).
- Commande : `<mqtt_root>/cfg/set`, patch `{"alarms":{"enabled":false}}` ou `true`, via `mqtt.publish`, QoS 1 et `retain: false`.
- Sans confirmation, l’état est invalidé et doit être relu avant une nouvelle commande.

L’API WebSocket Home Assistant `mqtt/subscribe` consultée exige un compte administrateur. L’intégration MQTT et les droits de publication doivent être disponibles.

## Validation

Les tests unitaires couvrent la configuration partagée et le protocole. Les scénarios `e2e/maintenance.spec.ts` couvrent la popup à 390 et 1100 px, les confirmations, l’absence de racine MQTT, son changement et sa suppression, l’éditeur et le nettoyage des souscriptions. Les tests utilisent des simulations et ne commandent aucun matériel réel.

Exécuter `npm run check`, `npm test`, `npx playwright test e2e/maintenance.spec.ts`, puis la suite navigateur complète avant fusion. Vérifier ensuite dans Home Assistant réel.
