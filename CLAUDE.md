# CLAUDE.md — à lire en premier

Mémoire du projet pour tout assistant qui reprend le travail. Les détails sont dans :

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : fichiers, entités lues, topics MQTT, formules.
- [docs/DECISIONS.md](docs/DECISIONS.md) : choix validés par le propriétaire et choix refusés. Ne pas les remettre en cause sans demande.
- [CHANGELOG.md](CHANGELOG.md) : historique des changements avec les commits.

## Le projet

Intégration Home Assistant (HACS) pour le contrôleur de piscine Flow.io (firmware `christophebelmont/Flow.io-Waveshare`). Domaine `flowio`. Elle ajoute qualité pH/ORP/eau, alertes, volumes injectés, autonomie des cuves, diagnostic et notifications. Les cartes Lovelace associées sont dans un autre dépôt.

## Règles de travail avec le propriétaire

- Langue : français, réponses courtes et directes.
- Toute écriture sur GitHub passe par une confirmation explicite avant le push (branche `main`, outil `push_files`).
- Ne pas sur-concevoir : quand le propriétaire dit « ne te prends pas la tête », on garde la solution simple.
- Lire le firmware avant d'affirmer quoi que ce soit sur ses valeurs par défaut ou ses topics. Ne jamais deviner.
- Rien n'est testé dans un vrai Home Assistant par l'assistant : le dire clairement dans les réponses.
- Après un changement de code : publier une nouvelle version (tag `vX.Y.Z`), attendre l'onglet Actions vert, mettre à jour dans HACS, redémarrer Home Assistant.

## État au 12/11/2026

- Dernier commit de code : `64079a5` (notifications enrichies).
- La version 0.1.1 est préparée dans le code mais n'était pas encore publiée lors de la dernière conversation.
- README.md non mis à jour pour les nouvelles options (notifications d'équipement, préfixe validé). À faire.
- `strings.json` non synchronisé avec les traductions `en.json` / `fr.json`. À vérifier.
- `notification_actions.py` n'a pas été relu après le changement de signature de `FlowioRuntime.async_send` (arguments ajoutés en fin, anciens appels théoriquement compatibles).
