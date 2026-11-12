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
- Vérifier l'état réel des tags et des releases avant de dire qu'une version est publiée ou non.

## Publier une version

1. Modifier `version` dans `custom_components/flowio/manifest.json` et mettre à jour `CHANGELOG.md`.
2. Créer le tag `vX.Y.Z` identique à la version du manifest. Le workflow `.github/workflows/release.yml` échoue sinon.
3. Le workflow embarque les cartes (commit pinglé `CARDS_REF`), construit `flowio.zip` et crée une release en **brouillon**.
4. Publier le brouillon sur GitHub (Releases). HACS ne voit la version qu'après publication.
5. Mettre à jour dans HACS, puis redémarrer Home Assistant.

## État au 12/11/2026

- Version dans le code : 0.2.0, à publier (tag `v0.2.0` pas encore créé au moment de l'écriture).
- Versions déjà publiées : 0.1.0 (11/11/2026) et 0.1.1 (12/11/2026).
- README.md non mis à jour pour les nouvelles options (notifications d'équipement, préfixe validé). À faire.
- `strings.json` non synchronisé avec les traductions `en.json` / `fr.json`. À vérifier.
- `notification_actions.py` n'a pas été relu après le changement de signature de `FlowioRuntime.async_send` (arguments ajoutés en fin, anciens appels théoriquement compatibles).
