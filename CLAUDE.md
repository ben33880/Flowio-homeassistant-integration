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
- Le propriétaire modifie aussi le dépôt à la main (workflow, manifest). Avant de modifier un fichier, relire sa version actuelle ; avant de parler de versions, lister les tags et les releases.
- Après chaque push, relire `CLAUDE.md` : tout point d'état devenu faux doit être corrigé dans le même push, pas annoncé comme fait sans l'être.
- Format des notifications d'équipement voulu par le propriétaire (14/11/2026) : une seule première ligne (le titre) du type « Filtration : arrêt à 22:07 par le contrôleur, durée 12 min », la durée seulement à l'arrêt, sans emoji, icône = celle de l'entité MQTT. Dessous : récapitulatif pH/ORP, eau/air, pression.
- Les fichiers de texte `strings.json` et `translations/en.json` doivent rester identiques ; `fr.json` suit la même structure.

## Publier une version

1. Modifier `version` dans `custom_components/flowio/manifest.json` et mettre à jour `CHANGELOG.md`.
2. Créer le tag `vX.Y.Z` identique à la version du manifest. Le workflow `.github/workflows/release.yml` échoue sinon.
3. Le workflow embarque les cartes (commit pinglé `CARDS_REF`), construit `flowio.zip` et crée une release. Le propriétaire a modifié ce workflow le 13/11/2026 : le relire avant d'expliquer la procédure.
4. Vérifier que la release est publiée (et non en brouillon). HACS ne voit la version qu'après publication.
5. Mettre à jour dans HACS, puis redémarrer Home Assistant.

## État au 14/11/2026

- Versions publiées : 0.1.0 (11/11), 0.1.1 (12/11), 0.2.0 (12/11), 0.2.1 (13/11).
- Version préparée dans le code : 0.2.2 (refonte des notifications et design Android), tag `v0.2.2` à créer par le propriétaire. Si le tag existe déjà sur un commit plus ancien, préparer une 0.2.3.
- Le README, le CHANGELOG et `strings.json` sont à jour avec le code de la 0.2.2.
- `notification_actions.py` relu le 14/11/2026 : ses réponses appellent `rt.async_send(titre, message, clé)` avec trois arguments, compatible avec la signature actuelle ; le tag et le groupe sont les mêmes que ceux de l'alerte, donc la réponse la remplace bien. Lecture seule, rien n'a été exécuté.
- Problème signalé le 14/11/2026 : aucune notification de démarrage d'équipement. Cause non confirmée ; le chronomètre Android a été retiré (seule différence avec l'arrêt). À revérifier avec les journaux (niveau debug de `custom_components.flowio`) si cela persiste.
